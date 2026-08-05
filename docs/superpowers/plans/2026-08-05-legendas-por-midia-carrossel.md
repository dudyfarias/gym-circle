# Legendas por mídia no carrossel — Implementation Plan (rev. 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir uma legenda por foto/vídeo do carrossel (paridade com o Instagram), com composer e leitura completos na web e leitura no app nativo.

**Architecture:** As legendas moram numa tabela separada `post_media_caption`, chaveada por `(post_id, media_key)` — `media_key` é a URL normalizada da mídia. Isso é obrigatório: o app iOS já publicado apaga e reinsere `post_media` direto na tabela, em duas transações, e não conhece legendas. `posts.caption_mode` distingue os modos; `posts.caption` guarda um espelho (primeira legenda não-vazia) mantido por trigger, para leitores que ignoram o modo.

**Tech Stack:** Postgres/Supabase (RLS, triggers, RPCs `security definer`), TypeScript (`packages/core`), Next.js + React (`apps/web`), SwiftUI (`ios-native`), vitest.

**Spec:** `docs/superpowers/specs/2026-08-05-legendas-por-midia-carrossel-design.md` (rev. 4)

---

## Regras inegociáveis

1. **Nenhum trigger em `delete` de `post_media`.** O app publicado faz delete e insert em requisições separadas; entre elas a tabela fica vazia. Reagir a esse estado destrói as legendas.
2. **Nenhum `DROP` das RPCs `update_social_post` / `update_social_post_full` de aridade antiga.** O binário na App Store chama a de 4 argumentos (`PostComposerService.swift:389`).
3. **Casamento por `media_key` (URL sem query string), nunca por posição.**
4. **Não aplique a migration.** Escreva o arquivo; aplicar é decisão do Eduardo, via MCP `apply_migration` (nunca `supabase db push` — o folder local divergiu de produção).
5. **`git add` por caminho explícito.** Há trabalho paralelo do Codex no repo; `git add .` é proibido. Em `pt-BR.json`/`en.json` só entram as chaves desta feature.
6. **Em trigger de linha, nunca referencie `NEW` num `DELETE`.** PL/pgSQL levanta `record "new" is not assigned yet` — `coalesce(new.x, old.x)` **não** protege.

---

## File Structure

**Banco**
- Create: `supabase/migrations/20260805120000_post_media_captions.sql`

**packages/core**
- Create: `packages/core/src/domain/post-caption.ts` + `.test.ts`
- Modify: `packages/core/src/domain/types.ts` — `PostMediaInput.caption`, `CreatePostInput.captionMode`, e `caption_mode` em `PostRow` / `FeedPostRow` / `SurfacePostRow` (typegen só regenera `database.types.ts`, não este arquivo)
- Modify: `packages/core/src/domain/index.ts`
- Modify: `packages/core/src/services/posts.ts` + `posts.test.ts`
- Regenerate: `packages/core/src/database.types.ts`

**apps/web**
- Create: `apps/web/src/components/gym-circle/composer/MediaCaptionStrip.tsx` — **diretório novo** (o resto do composer vive achatado em `gym-circle/` e `screens/`)
- Modify: `screens/PostScreen.tsx`, `EditPostSheet.tsx`
- Modify: `design-system/MediaCarousel.tsx`, `design-system/SocialPostCard.tsx`
- Modify: `social/types.ts`, `social/supabaseSocialSelectors.ts`, `social/supabaseSocialActions.ts`, `social/useSupabaseSocial.ts`, **`social/supabaseSocialSurfaces.ts`**
- Verify (sem mudança esperada): `CommentsBottomSheet.tsx:556-561`, `PostDetailOverlay.tsx`, `RecapCoverPickerSheet.tsx:206`
- Modify: `apps/web/src/i18n/locales/pt-BR.json`, `en.json`

**ios-native** (caminhos completos)
- Modify: `ios-native/GymCircleNative/Sources/GymCircleNativeFoundation/Models/FeedPost.swift`
- Modify: `ios-native/GymCircleNative/Sources/GymCircleNativeFoundation/Services/GymCircleAPI.swift` (select de `post_media` em `:330`)
- Modify: `ios-native/GymCircleNative/Sources/GymCircleNativeFoundation/Screens/FeedView.swift`

**Fora de escopo declarado:** role/label/teclado do próprio `MediaCarousel` (a spec observa a lacuna; esta entrega cobre só a legenda e as miniaturas do composer).

---

## Fatia 1 — Banco (arquivo, NÃO aplicar)

### Task 1.1: Tabela, RLS, grants, realtime

**Files:** Create `supabase/migrations/20260805120000_post_media_captions.sql`

- [ ] **Step 1: Cabeçalho + tabela + normalização**

```sql
-- Legendas por mídia no carrossel.
-- Preparada para revisão. Não aplicar sem gate de release explícito.
--
-- As legendas vivem FORA de post_media porque o app iOS publicado apaga e
-- reinsere post_media direto na tabela, em duas transações separadas.

create table if not exists public.post_media_caption (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  media_key text not null,
  caption text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_media_caption_key unique (post_id, media_key),
  constraint post_media_caption_length_check check (char_length(caption) <= 300)
);

create or replace function private.normalize_media_key(p_url text)
returns text language sql immutable set search_path = '' as $$
  select split_part(coalesce(p_url, ''), '?', 1);
$$;
```

`unique (post_id, media_key)` cobre o índice da FK — não crie índice extra.

- [ ] **Step 2: RLS e políticas** — espelha `post_media` (`20260609140000:29-58`), **mas com `UPDATE`**, que `post_media` não tem e o upsert exige.

```sql
alter table public.post_media_caption enable row level security;

create policy post_media_caption_select on public.post_media_caption
  for select using (exists (
    select 1 from public.posts p
    where p.id = post_media_caption.post_id
      and private.can_view_profile_posts(p.user_id)));

create policy post_media_caption_insert on public.post_media_caption
  for insert with check (exists (
    select 1 from public.posts p
    where p.id = post_media_caption.post_id and p.user_id = (select auth.uid())));

create policy post_media_caption_update on public.post_media_caption
  for update using (exists (
    select 1 from public.posts p
    where p.id = post_media_caption.post_id and p.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.posts p
    where p.id = post_media_caption.post_id and p.user_id = (select auth.uid())));

create policy post_media_caption_delete on public.post_media_caption
  for delete using (exists (
    select 1 from public.posts p
    where p.id = post_media_caption.post_id and p.user_id = (select auth.uid())));

grant select, insert, update, delete on public.post_media_caption to authenticated;
grant select on public.post_media_caption to anon;
```

- [ ] **Step 3: Touch + realtime — ambos idempotentes**

A migration é aplicada manualmente e uma falha no meio deixa estado parcial; a retentativa precisa passar.

```sql
create or replace function private.tg_touch_post_media_caption()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists post_media_caption_touch on public.post_media_caption;
create trigger post_media_caption_touch
  before update on public.post_media_caption
  for each row execute function private.tg_touch_post_media_caption();

do $$
begin
  alter publication supabase_realtime add table public.post_media_caption;
exception when duplicate_object then null;
end $$;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260805120000_post_media_captions.sql
git commit -m "feat(captions): post_media_caption table with RLS, grants, realtime"
```

### Task 1.2: `caption_mode` e espelho

- [ ] **Step 1: Coluna (constraint idempotente)**

```sql
alter table public.posts
  add column if not exists caption_mode text not null default 'single';

do $$
begin
  alter table public.posts add constraint posts_caption_mode_check
    check (caption_mode in ('single', 'per_media'));
exception when duplicate_object then null;
end $$;
```

- [ ] **Step 2: Função do espelho**

```sql
create or replace function private.sync_post_caption_mirror(p_post_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_mode text;
  v_media_count integer;
  v_first text;
begin
  select caption_mode into v_mode from public.posts where id = p_post_id;
  if v_mode is distinct from 'per_media' then
    return;
  end if;

  select count(*) into v_media_count
    from public.post_media where post_id = p_post_id;

  -- Janela do cliente legado (delete sem insert ainda): não mexer.
  if v_media_count = 0 then
    return;
  end if;

  select c.caption into v_first
    from public.post_media m
    join public.post_media_caption c
      on c.post_id = m.post_id
     and c.media_key = private.normalize_media_key(m.image_url)
   where m.post_id = p_post_id
     and nullif(btrim(c.caption), '') is not null
   order by m.position
   limit 1;

  -- Só sobrescreve quando há legenda de verdade. Zerar aqui deixaria o post
  -- mudo se depois o cliente legado reduzisse o carrossel a 1 mídia (o
  -- fallback de estado degenerado cairia num caption vazio).
  -- NULL (não '') é a representação de "sem legenda" no resto do schema.
  if v_first is null then
    return;
  end if;

  update public.posts
     set caption = v_first
   where id = p_post_id
     and caption is distinct from v_first;
end;
$$;
```

- [ ] **Step 3: Triggers — atenção ao `TG_OP`**

```sql
-- REGRA 6: em DELETE, NEW não existe. Ramificar por TG_OP.
create or replace function private.tg_sync_caption_mirror()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform private.sync_post_caption_mirror(old.post_id);
    return old;
  end if;
  perform private.sync_post_caption_mirror(new.post_id);
  return new;
end;
$$;

drop trigger if exists post_media_caption_sync_mirror on public.post_media_caption;
create trigger post_media_caption_sync_mirror
  after insert or update or delete on public.post_media_caption
  for each row execute function private.tg_sync_caption_mirror();

-- Ordem das mídias mudou. APENAS insert (regra 1).
drop trigger if exists post_media_insert_sync_mirror on public.post_media;
create trigger post_media_insert_sync_mirror
  after insert on public.post_media
  for each row execute function private.tg_sync_caption_mirror();

-- Escrita direta em posts.caption (postService.update) ou troca de modo.
-- pg_trigger_depth() = 0 evita recursão: a função escreve em posts.caption a
-- partir de profundidade >= 1, e este trigger só dispara em profundidade 0.
create or replace function private.tg_sync_caption_mirror_posts()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.sync_post_caption_mirror(new.id);
  return null;
end;
$$;

drop trigger if exists posts_sync_caption_mirror on public.posts;
create trigger posts_sync_caption_mirror
  after update of caption, caption_mode on public.posts
  for each row when (pg_trigger_depth() = 0)
  execute function private.tg_sync_caption_mirror_posts();
```

**Não crie trigger de "rebaixar para single".** Ele seria código morto: `replace_social_post_media` só insere em `post_media` quando `media_count > 1`, e o app publicado idem — então um trigger `after insert` nunca veria contagem < 2. A regra vai dentro da RPC (Task 1.3).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260805120000_post_media_captions.sql
git commit -m "feat(captions): caption_mode + trigger-kept mirror (TG_OP-safe, recursion-guarded)"
```

### Task 1.3: RPCs de mídia

Base: `supabase/migrations/20260703192608_resilient_media_pipeline.sql`.

- [ ] **Step 1: Recriar `private.replace_social_post_media`**

Copie o corpo atual **na íntegra** e acrescente, **nesta ordem**, após o bloco que insere em `post_media`:

```sql
  -- (2) Legendas DEPOIS das mídias: o trigger do espelho precisa das linhas
  -- de post_media presentes, senão o guarda de "mídia vazia" o impede.
  if p_media is not null then
    -- Chave AUSENTE = cliente legado (não conhece legenda) -> preservar.
    -- Chave presente com null/'' = limpar de fato.
    delete from public.post_media_caption c
     where c.post_id = p_post_id
       and exists (
         select 1 from jsonb_array_elements(p_media) as item
          where item ? 'caption'
            and nullif(btrim(coalesce(item ->> 'caption', '')), '') is null
            and private.normalize_media_key(item ->> 'image_url') = c.media_key);

    -- distinct on: a spec ACEITA a mesma mídia repetida no carrossel. Sem
    -- deduplicar, "ON CONFLICT DO UPDATE cannot affect row a second time"
    -- (21000) derrubaria a publicação inteira. Vence a primeira ocorrência.
    insert into public.post_media_caption (post_id, media_key, caption)
    select distinct on (media_key)
      p_post_id,
      private.normalize_media_key(e.item ->> 'image_url'),
      left(btrim(e.item ->> 'caption'), 300)
    from jsonb_array_elements(p_media) with ordinality as e(item, ord)
    where e.item ? 'caption'
      and nullif(btrim(coalesce(e.item ->> 'caption', '')), '') is not null
    order by media_key, e.ord
    on conflict (post_id, media_key) do update
      set caption = excluded.caption
      where public.post_media_caption.caption is distinct from excluded.caption;

    -- (3) Órfãs do conjunto final. NUNCA disparado por delete de post_media.
    delete from public.post_media_caption c
     where c.post_id = p_post_id
       and not exists (
         select 1 from jsonb_array_elements(p_media) as item
          where private.normalize_media_key(item ->> 'image_url') = c.media_key);
  end if;

  -- (4) Menos de 2 mídias -> volta para single. Aqui, não em trigger: esta é
  -- a única instrução que enxerga o conjunto final dentro da transação.
  if media_count < 2 then
    update public.posts set caption_mode = 'single'
     where id = p_post_id and caption_mode = 'per_media';
  end if;

  -- (5) Espelho por último.
  perform private.sync_post_caption_mirror(p_post_id);
```

`left(..., 300)` trunca no servidor: a RPC é fronteira de confiança e um texto de 400 caracteres estouraria o CHECK com um `23514` opaco.

- [ ] **Step 2: `private.create_social_post_with_media` — mudança MÍNIMA**

Esta função **não tem** `insert into post_media`: ela delega em `:125` com
`perform private.replace_social_post_media(created_post.id, p_media);`.

A **única** alteração é acrescentar `caption_mode` ao `insert into public.posts` (`:65`), com `coalesce(p_post ->> 'caption_mode', 'single')`.
**Não repita o bloco de legendas** — ele já vem da delegação. Repetir gravaria e limparia duas vezes.

- [ ] **Step 3: Reaplicar grants dos pares recriados** (`private` e `public`, para `replace_social_post_media` e `create_social_post_with_media`):

```sql
revoke all on function private.replace_social_post_media(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function private.replace_social_post_media(uuid, jsonb)
  to authenticated;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260805120000_post_media_captions.sql
git commit -m "feat(captions): media RPCs persist captions (absent key preserves, dedup safe)"
```

### Task 1.4: Sobrecargas de update (sem DROP)

- [ ] **Step 1: As quatro assinaturas novas**

Parâmetro obrigatório cria sobrecarga resolvida por aridade; o PostgREST escolhe pelo conjunto de nomes de chaves do corpo JSON. **`p_caption_mode` NÃO pode ter `DEFAULT`** (criaria ambiguidade com a versão antiga). Os wrappers `public` existentes já têm `default null` nos parâmetros após o primeiro — **mantenha esses defaults** nos quatro primeiros parâmetros dos wrappers novos.

```sql
create or replace function private.update_social_post(
  p_post_id uuid, p_caption text, p_workout_types text[],
  p_gym_id uuid, p_caption_mode text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_caption_mode not in ('single', 'per_media') then
    raise exception 'caption_mode inválido' using errcode = '22023';
  end if;

  -- ORDEM CRÍTICA: o modo vem ANTES da legenda.
  -- private.update_social_post (4 args) escreve posts.caption; estamos numa
  -- função (profundidade 0), então o trigger do espelho dispara. Se o modo
  -- ainda fosse 'per_media', o espelho sobrescreveria a legenda geral nova.
  update public.posts set caption_mode = p_caption_mode where id = p_post_id;

  perform private.update_social_post(p_post_id, p_caption, p_workout_types, p_gym_id);

  perform private.sync_post_caption_mirror(p_post_id);
end;
$$;
```

A chamada de 4 args dentro da de 5 resolve para a função de 4 args (a de 5 não tem default no último parâmetro, logo não é candidata) — não recursa.

Faça o par `public.update_social_post(uuid, text, text[], uuid, text)` `security invoker`, e os dois equivalentes de `update_social_post_full` (que recebe `p_media jsonb`). Em `update_social_post_full` a ordem é **modo → caption → mídia → espelho**.

Aplique em todas: `revoke all ... from public, anon, authenticated`, `grant execute ... to authenticated`, e `comment on function`.

**As versões de 4 e 5 argumentos antigas permanecem intactas.**

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260805120000_post_media_captions.sql
git commit -m "feat(captions): update RPC overloads (mode before caption; old arities kept)"
```

### Task 1.5: Propagar `caption_mode` aos leitores

Copie os corpos vigentes destes arquivos (copiar versão desatualizada reverte features em silêncio):

| Objeto | Definição vigente |
|---|---|
| view `feed_posts` | `20260514113227_streak_restore.sql` |
| `get_home_feed` | `20260705190000_activity_strength_sets.sql` |
| `get_profile_posts` | `20260704220912_hydrate_profile_workout_routes.sql` |
| `get_suggested_feed_posts` | `20260803205214_suggested_public_feed_posts.sql` |

- [ ] **Step 1:** Recriar a view incluindo `p.caption_mode`.
- [ ] **Step 2:** Para cada RPC `returns table`: `drop` + `create` com a coluna nova e **reaplicar** `security definer`, `set search_path = ''`, `revoke`, `grant` (o `DROP` descarta grants). Adicionar coluna é seguro para o app publicado — Swift `Codable` ignora chaves desconhecidas.
- [ ] **Step 3:** Nota no fim do arquivo: após aplicar, recarregar o schema cache do PostgREST e confirmar que as sobrecargas novas respondem (não `PGRST202`).
- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260805120000_post_media_captions.sql
git commit -m "feat(captions): thread caption_mode through feed view and 3 read RPCs"
```

### Task 1.6: Purga de legendas órfãs

**Files:** Modify `supabase/functions/media-cleanup/` (job existente)

A spec declara que uma legenda órfã **ressuscita** se a mesma mídia voltar (comportamento desejado), com purga por idade limitando a janela.

- [ ] **Step 1:** Acrescentar ao job: `delete from public.post_media_caption c where c.updated_at < now() - interval '30 days' and not exists (select 1 from public.post_media m where m.post_id = c.post_id and private.normalize_media_key(m.image_url) = c.media_key)`.
- [ ] **Step 2:** Registrar a contagem apagada em `media_cleanup_runs.metadata`.
- [ ] **Step 3: Commit.**

### Task 1.7: Testes de banco (branch Supabase)

Os casos abaixo justificam o design inteiro e **não** são cobertos por vitest.

- [ ] **Step 1:** Criar branch Supabase via MCP `create_branch` e aplicar a migration nela (**nunca** em produção).
- [ ] **Step 2:** Rodar, via MCP `execute_sql`, um script que verifica:
  1. `delete` + `insert` direto em `post_media` (caminho do app publicado) **não** apaga legendas e elas voltam casadas por URL;
  2. reordenar pelo cliente legado não troca legenda de foto **e** atualiza o espelho;
  3. `delete` sem insert (redução a 1 mídia) não deixa o post mudo;
  4. espelho não recalcula com `post_media` vazia;
  5. editar legenda não recursa (conclui sem `stack depth`);
  6. **apagar um post que tem legendas não falha** (o cascade dispara o trigger em DELETE);
  7. `caption` `null`/`""` remove a linha; chave ausente preserva;
  8. mídia repetida no mesmo post não estoura o `on conflict`;
  9. `per_media` → `single` preserva a legenda geral enviada;
  10. `per_media` sem nenhuma legenda não apaga `posts.caption`;
  11. corpo mínimo resolve a sobrecarga certa; corpo de 4 chaves cai na antiga;
  12. `caption_mode` sai pela view e pelas 3 RPCs;
  13. RLS: terceiro não escreve legenda em post alheio; `anon` lê de post público.
- [ ] **Step 3:** Versionar o script em `supabase/tests/post_media_captions.sql`.
- [ ] **Step 4:** Apagar a branch (`delete_branch`). **Commit.**

---

## Fatia 2 — Core (TDD)

### Task 2.1: `resolvePostCaption`

**Files:** Create `packages/core/src/domain/post-caption.ts` + `post-caption.test.ts`; Modify `domain/index.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { resolvePostCaption } from "./post-caption";

const m = (caption: string | null) => ({ caption });

describe("resolvePostCaption", () => {
  it("modo single devolve a legenda do post", () => {
    expect(resolvePostCaption({ caption: "geral", captionMode: "single", media: [] }, 0))
      .toBe("geral");
  });
  it("modo per_media devolve a legenda da mídia ativa", () => {
    expect(resolvePostCaption(
      { caption: "espelho", captionMode: "per_media", media: [m("primeira"), m("segunda")] }, 1,
    )).toBe("segunda");
  });
  it("card sem legenda devolve string vazia", () => {
    expect(resolvePostCaption(
      { caption: "espelho", captionMode: "per_media", media: [m("primeira"), m(null)] }, 1,
    )).toBe("");
  });
  // O app publicado reduz o carrossel a 1 mídia com delete SEM insert,
  // deixando per_media com menos de 2 mídias. Sem este fallback o post
  // ficaria mudo para sempre.
  it("per_media com menos de 2 mídias cai para a legenda do post", () => {
    expect(resolvePostCaption(
      { caption: "espelho", captionMode: "per_media", media: [m(null)] }, 0,
    )).toBe("espelho");
  });
  it("índice fora do intervalo cai para a legenda do post", () => {
    expect(resolvePostCaption(
      { caption: "espelho", captionMode: "per_media", media: [m("a"), m("b")] }, 9,
    )).toBe("espelho");
  });
  it("post legado sem array de mídia cai para a legenda do post", () => {
    expect(resolvePostCaption(
      { caption: "antiga", captionMode: "per_media", media: undefined }, 0,
    )).toBe("antiga");
  });
});
```

- [ ] **Step 2:** Run `cd packages/core && npx vitest run src/domain/post-caption.test.ts` → FAIL (não existe)

- [ ] **Step 3: Implementar**

```ts
export type PostCaptionMode = "single" | "per_media";

export type PostCaptionSource = {
  /** Já normalizado para "" no mapper — as linhas do banco trazem string | null. */
  caption: string;
  captionMode?: PostCaptionMode | null;
  media?: Array<{ caption?: string | null }> | undefined;
};

/**
 * Qual legenda mostrar para o card ativo. Devolve sempre `string` (nunca
 * null) porque `GymPost.caption` é não-nullable e o card chama `.length`.
 *
 * Degrada para a legenda do post quando: modo único; sem array de mídia
 * (post legado); índice fora do intervalo; ou estado degenerado `per_media`
 * com menos de 2 mídias — que o app iOS publicado produz ao reduzir o
 * carrossel com um delete sem insert.
 */
export function resolvePostCaption(post: PostCaptionSource, activeIndex: number): string {
  if (post.captionMode !== "per_media") return post.caption;
  const media = post.media;
  if (!Array.isArray(media) || media.length < 2) return post.caption;
  const item = media[activeIndex];
  if (!item) return post.caption;
  return item.caption ?? "";
}
```

- [ ] **Step 4:** Run o mesmo comando → PASS (6 testes)
- [ ] **Step 5:** `export * from "./post-caption";` em `packages/core/src/domain/index.ts`
- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain/post-caption.ts packages/core/src/domain/post-caption.test.ts packages/core/src/domain/index.ts
git commit -m "feat(captions): resolvePostCaption with degenerate-state fallback"
```

### Task 2.2: Tipos e payload das RPCs

**Files:** Modify `domain/types.ts` (`PostMediaInput` `:164`, `CreatePostInput`, `PostRow`, `FeedPostRow`, `SurfacePostRow`), `services/posts.ts` (`mediaRpcRows` `:22`, `p_post` `:64-93`, `updateSocialDetails` `:156-173`), `services/posts.test.ts`

- [ ] **Step 1: Teste do contrato** — capturar o corpo enviado à RPC e afirmar:
  - `mediaRpcRows` inclui `caption` (trimada, `null` quando vazia) e mantém `slice(0, 10)`;
  - `updateSocialDetails` envia **`null` explícito**, nunca `undefined`, em `p_caption`, `p_gym_id`, `p_media`.

  **Por quê:** `JSON.stringify` remove chaves `undefined`; com o corpo encolhido o PostgREST resolveria a sobrecarga errada (ou `PGRST202`), porque a resolução é pelo conjunto de nomes de chaves.
- [ ] **Step 2:** Run `cd packages/core && npx vitest run src/services/posts.test.ts` → FAIL
- [ ] **Step 3: Implementar** — `caption?: string | null` em `PostMediaInput`; `captionMode?: PostCaptionMode` em `CreatePostInput`; `caption_mode` em `PostRow`/`FeedPostRow`/`SurfacePostRow`; `caption: media.caption?.trim() || null` em `mediaRpcRows`; `caption_mode` em `p_post`; `p_caption_mode` em `updateSocialDetails`; trocar `?? undefined` por `?? null`.
- [ ] **Step 4:** Run → PASS
- [ ] **Step 5: Commit**

```bash
git add packages/core/src/domain/types.ts packages/core/src/services/posts.ts packages/core/src/services/posts.test.ts
git commit -m "feat(captions): caption in media payload + explicit nulls for overload resolution"
```

### Task 2.3: Busca em lote + typegen

**Files:** Modify `packages/core/src/services/posts.ts` (junto de `mediaForPosts` `:110-121`)

- [ ] **Step 1: Teste** — `captionsForPosts(postIds)` faz **uma** query `.in("post_id", ids)` e agrupa por `post_id` + `media_key`. Nunca uma query por post (o feed viraria N+1 — motivo pelo qual `mediaForPosts` já é em lote).
- [ ] **Step 2:** Run → FAIL
- [ ] **Step 3: Implementar.** `post_media` segue com `select("*")`, então a legenda é casada em memória por URL normalizada — **mesma normalização do banco** (URL sem query string).
- [ ] **Step 4:** Run → PASS
- [ ] **Step 5:** Regenerar `packages/core/src/database.types.ts` (sem typegen, `caption_mode` e a tabela nova não compilam).
- [ ] **Step 6: Commit**

```bash
git add packages/core/src/services/posts.ts packages/core/src/services/posts.test.ts packages/core/src/database.types.ts
git commit -m "feat(captions): batched caption fetch + regenerated database types"
```

---

## Fatia 3 — Composer web

### Task 3.1: `MediaCaptionStrip`

**Files:** Create `apps/web/src/components/gym-circle/composer/MediaCaptionStrip.tsx` (+ `.test.tsx`) — **diretório novo**

Props: `media`, `captions`, `activeIndex`, `onActiveIndexChange`, `onCaptionChange`, `maxLength = 300`.

- [ ] **Step 1: Teste** — selecionar a miniatura 2 passa a editar a legenda 2; o contador mostra `"2 de 4 · N/300"`; legenda vazia é aceita.
- [ ] **Step 2:** Run `cd apps/web && npx vitest run src/components/gym-circle/composer/MediaCaptionStrip.test.tsx` → FAIL
- [ ] **Step 3: Implementar** — miniaturas como `<button type="button">` com `aria-current` na ativa e nome acessível (`"mídia 2 de 4, com legenda"`); marcador nas que têm texto.
- [ ] **Step 4:** Run → PASS
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/gym-circle/composer/MediaCaptionStrip.tsx apps/web/src/components/gym-circle/composer/MediaCaptionStrip.test.tsx
git commit -m "feat(captions): MediaCaptionStrip composer component"
```

### Task 3.2: Wire em criar e editar

**Files:** Modify `screens/PostScreen.tsx`, `EditPostSheet.tsx` (**atenção a `:464`**), `i18n/locales/pt-BR.json`, `en.json`

- [ ] **Step 1: Teste** — editar **apenas** uma legenda faz o payload de mídia ser enviado (hoje `media: mediaChanged ? mediaItems : undefined` mandaria `undefined` e a edição sumiria em silêncio).
- [ ] **Step 2:** Run → FAIL
- [ ] **Step 3: Implementar:**
  - toggle "Legenda única / Várias legendas" **só com 2+ mídias**;
  - `EditPostSheet` carrega as legendas existentes para `mediaItems`;
  - alterar legenda marca `mediaChanged = true`;
  - remover a mídia selecionada move a seleção para a anterior (ou 0);
  - cair para 1 mídia: avisar que a legenda daquela mídia sai da leitura e voltar para `single`;
  - i18n PT/EN, sem string hardcoded.
- [ ] **Step 4:** Run → PASS; `npx tsc --noEmit`; `npx eslint <arquivos>`
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/gym-circle/screens/PostScreen.tsx apps/web/src/components/gym-circle/EditPostSheet.tsx apps/web/src/i18n/locales/pt-BR.json apps/web/src/i18n/locales/en.json
git commit -m "feat(captions): compose and edit per-media captions"
```

---

## Fatia 4 — Leitura web

### Task 4.1: `MediaCarousel` notifica o índice

**Files:** Modify `design-system/MediaCarousel.tsx`

- [ ] **Step 1:** Adicionar `onActiveIndexChange?: (index: number) => void`.
- [ ] **Step 2:** Declarar o efeito **ANTES dos early returns** (o componente retorna cedo com 0 e com 1 mídia — hook depois disso viola as regras dos hooks):

```tsx
useEffect(() => {
  onActiveIndexChange?.(active);
}, [active, onActiveIndexChange]);
```

Não chame o callback de dentro do updater de `setActive` em `handleScroll` — dispararia setState de outro componente durante a render.
- [ ] **Step 3:** Trocar a key do slide de `item.imageUrl` (`:88`) para o índice — mídia repetida colide.
- [ ] **Step 4:** `npx tsc --noEmit`; `npx eslint`. **Commit.**

### Task 4.2: `SocialPostCard` + camada social

**Files:** Modify `design-system/SocialPostCard.tsx`, `social/types.ts`, `social/supabaseSocialSelectors.ts` (`mediaByPost` `:356-400`), `social/supabaseSocialActions.ts` (`:1116-1130`), `social/useSupabaseSocial.ts` (`:1489-1511`, canal `:1887-1904`), `social/supabaseSocialSurfaces.ts` (`:160-183`)

- [ ] **Step 1: Teste** — a legenda muda conforme o índice ativo; "ver mais" reseta ao trocar de card.
- [ ] **Step 2:** Run → FAIL
- [ ] **Step 3: Implementar:**
  - estado `activeMediaIndex`; legenda via `resolvePostCaption` (normalizar `caption ?? ""` no mapper);
  - **altura estável:** `min-height` de 2 linhas; truncar por caracteres com limiar **120** (o global é 140 em `social/caption.ts`; medir DOM é evitado por causa da WebView iOS);
  - `aria-live="polite"` na região da legenda, incluindo a posição ("2 de 4");
  - `GymPost.media[].caption` + `captionMode` em `types.ts`;
  - `mediaByPost` carrega a legenda (o mapper monta campo a campo e descarta o que não conhece);
  - **`captionsForPosts` consumido nas 3 call sites de `mediaForPosts`**: `useSupabaseSocial.ts:601`, `:978`, `:1694`;
  - `caption_mode` nos `.select()` de `useSupabaseSocial.ts` **e de `supabaseSocialSurfaces.ts`** (o fallback de `feed_posts` enumera 24 colunas; sem isso todo post renderiza como `single`);
  - patch otimista respeita o modo;
  - canal realtime inclui `post_media_caption`.
- [ ] **Step 4:** Run → PASS; gate. **Commit.**

### Task 4.3: Superfícies de legenda (verificação)

- [ ] `CommentsBottomSheet.tsx:556-561` — mostra a legenda **inteira** no topo; num post `per_media` passa a mostrar a espelhada (a da 1ª mídia), fixa. **Confirmar por inspeção/teste; sem mudança de código.**
- [ ] `PostDetailOverlay.tsx` — **decisão: abre no índice 0** e mostra a legenda daquele card (coerente com o sheet de comentários).
- [ ] `RecapCoverPickerSheet.tsx:206` (`alt`) — confirmar que segue coerente.
- [ ] **Commit** (se houver mudança).

---

## Fatia 5 — Nativo (somente leitura)

**Files:** `ios-native/GymCircleNative/Sources/GymCircleNativeFoundation/{Models/FeedPost.swift, Services/GymCircleAPI.swift, Screens/FeedView.swift}`

- [ ] **Step 1:** `FeedPost` ganha `captionMode` e legenda por mídia.
- [ ] **Step 2:** `GymCircleAPI` busca `post_media_caption` (em lote) e casa por URL normalizada; o select de `post_media` está em `:330`.
- [ ] **Step 3:** Carrossel do `FeedView` troca a legenda pelo card ativo, com o **mesmo fallback de estado degenerado** do `resolvePostCaption`.
- [ ] **Step 4:** **Não** mexer no composer nativo (segue criando em `single`).
- [ ] **Step 5:** Build do app. **Commit.**

---

## Fatia 6 — Verificação e publicação

- [ ] `cd apps/web && npx tsc --noEmit` → OK
- [ ] `npx eslint` nos arquivos tocados → limpo
- [ ] `cd packages/core && npx vitest run` → verde
- [ ] `cd apps/web && npx vitest run` → verde
- [ ] `npm run build` (raiz) → compila
- [ ] **GATE:** apresentar ao Eduardo para aplicar a migration em produção (MCP `apply_migration`, **nunca** `db push`) e autorizar push/deploy.
- [ ] Após aplicar: recarregar schema cache do PostgREST; rodar `get_advisors` (security + performance) e confirmar que a tabela nova não aparece em `rls_enabled_no_policy` nem em `unindexed_foreign_keys`.
- [ ] Smoke no iPhone: post com 3 fotos e legendas distintas; deslizar e ver a legenda trocar; editar só uma legenda e confirmar que salvou.

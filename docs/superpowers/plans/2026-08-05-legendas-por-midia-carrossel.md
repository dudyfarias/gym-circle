# Legendas por mídia no carrossel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir uma legenda por foto/vídeo do carrossel (paridade com o recurso do Instagram), com composer e leitura completos na web e leitura no app nativo.

**Architecture:** As legendas moram numa tabela separada `post_media_caption`, chaveada por `(post_id, media_key)` onde `media_key` é a URL normalizada da mídia. Isso é obrigatório porque o app iOS já publicado apaga e reinsere `post_media` direto na tabela, em duas transações — uma coluna em `post_media` seria destruída. `posts.caption_mode` distingue os modos, e `posts.caption` guarda um espelho (primeira legenda não-vazia) mantido por trigger, para leitores que não conhecem o modo.

**Tech Stack:** Postgres/Supabase (RLS, triggers, RPCs `security definer`), TypeScript (`packages/core`), Next.js + React (`apps/web`), SwiftUI (`ios-native`), vitest.

**Spec:** `docs/superpowers/specs/2026-08-05-legendas-por-midia-carrossel-design.md` (rev. 4)

---

## Regras inegociáveis (leia antes de qualquer tarefa)

1. **Nenhum trigger em `delete` de `post_media`.** O app publicado faz `delete` e `insert` em requisições separadas; entre elas a tabela fica vazia. Reagir a esse estado destrói as legendas.
2. **Nenhum `DROP` de `update_social_post` / `update_social_post_full` de aridade antiga.** O binário na App Store chama a versão de 4 argumentos (`PostComposerService.swift:389`).
3. **Casamento por `media_key` (URL normalizada), nunca por posição.**
4. **Migration não é aplicada pelo executor.** Escreva o arquivo; aplicar em produção é decisão do Eduardo, via MCP `apply_migration` (nunca `supabase db push` — o folder local divergiu de produção).
5. **`git add` sempre por caminho explícito.** O repositório tem trabalho paralelo do Codex não relacionado; `git add .` é proibido.

---

## File Structure

**Banco**
- Create: `supabase/migrations/20260805120000_post_media_captions.sql` — tabela, RLS, grants, publicação realtime, `caption_mode`, funções de espelho, triggers, atualização das RPCs de mídia, sobrecargas de update, propagação nas superfícies de leitura.

**packages/core**
- Create: `packages/core/src/domain/post-caption.ts` — `resolvePostCaption` (pura).
- Create: `packages/core/src/domain/post-caption.test.ts`
- Modify: `packages/core/src/domain/types.ts` — `PostMediaInput.caption`, `CreatePostInput.captionMode`.
- Modify: `packages/core/src/domain/index.ts` — exportar o novo módulo.
- Modify: `packages/core/src/services/posts.ts` — `mediaRpcRows`, `p_post`, `updateSocialDetails`, `null` explícito, busca em lote de legendas.
- Modify: `packages/core/src/services/posts.test.ts` (ou criar) — contrato das RPCs.
- Regenerate: `packages/core/src/database.types.ts`.

**apps/web**
- Create: `apps/web/src/components/gym-circle/composer/MediaCaptionStrip.tsx` — tira de miniaturas + caixa de legenda (usada por criar e editar).
- Modify: `apps/web/src/components/gym-circle/screens/PostScreen.tsx` — toggle + strip no fluxo de criação.
- Modify: `apps/web/src/components/gym-circle/EditPostSheet.tsx` — idem na edição + `mediaChanged`.
- Modify: `apps/web/src/components/gym-circle/design-system/MediaCarousel.tsx` — `onActiveIndexChange`, key do slide.
- Modify: `apps/web/src/components/gym-circle/design-system/SocialPostCard.tsx` — legenda por card ativo, altura estável, reset do "ver mais".
- Modify: `apps/web/src/components/gym-circle/social/types.ts` — `GymPost.media[].caption`, `captionMode`.
- Modify: `apps/web/src/components/gym-circle/social/supabaseSocialSelectors.ts` — mapper carregando legenda.
- Modify: `apps/web/src/components/gym-circle/social/supabaseSocialActions.ts` — patch otimista respeitando o modo.
- Modify: `apps/web/src/components/gym-circle/social/useSupabaseSocial.ts` — `.select()` com `caption_mode`, canal realtime.
- Modify: `apps/web/src/i18n/locales/pt-BR.json`, `en.json` — chaves novas.

**ios-native**
- Modify: `Sources/GymCircleNativeFoundation/Models/FeedPost.swift`
- Modify: `Sources/GymCircleNativeFoundation/Services/GymCircleAPI.swift`
- Modify: `Sources/GymCircleNativeFoundation/Screens/FeedView.swift`

---

## Fatia 1 — Banco (arquivo de migration, NÃO aplicar)

### Task 1.1: Tabela, RLS, grants, realtime

**Files:**
- Create: `supabase/migrations/20260805120000_post_media_captions.sql`

- [ ] **Step 1: Criar o arquivo com o cabeçalho e a tabela**

```sql
-- Legendas por mídia no carrossel.
-- Preparada para revisão. Não aplicar sem gate de release explícito.
--
-- As legendas vivem FORA de post_media porque o app iOS publicado apaga e
-- reinsere post_media direto na tabela, em duas transações separadas. Uma
-- coluna em post_media seria destruída por esse delete cego.

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
```

Nota: `unique (post_id, media_key)` já cobre o índice da FK — `post_id` é a coluna líder. Não crie índice extra.

- [ ] **Step 2: Normalização da chave**

```sql
-- media_key é a URL sem query string. Hoje as URLs de mídia não têm
-- cache-buster, mas o projeto já anexa um em avatares; normalizar imuniza.
create or replace function private.normalize_media_key(p_url text)
returns text
language sql
immutable
set search_path = ''
as $$
  select split_part(coalesce(p_url, ''), '?', 1);
$$;
```

- [ ] **Step 3: RLS e políticas** (espelha `post_media`, MAS com `UPDATE`, que `post_media` não tem)

```sql
alter table public.post_media_caption enable row level security;

create policy post_media_caption_select on public.post_media_caption
  for select using (
    exists (
      select 1 from public.posts p
      where p.id = post_media_caption.post_id
        and private.can_view_profile_posts(p.user_id)
    )
  );

create policy post_media_caption_insert on public.post_media_caption
  for insert with check (
    exists (
      select 1 from public.posts p
      where p.id = post_media_caption.post_id and p.user_id = (select auth.uid())
    )
  );

create policy post_media_caption_update on public.post_media_caption
  for update using (
    exists (
      select 1 from public.posts p
      where p.id = post_media_caption.post_id and p.user_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.posts p
      where p.id = post_media_caption.post_id and p.user_id = (select auth.uid())
    )
  );

create policy post_media_caption_delete on public.post_media_caption
  for delete using (
    exists (
      select 1 from public.posts p
      where p.id = post_media_caption.post_id and p.user_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.post_media_caption to authenticated;
grant select on public.post_media_caption to anon;
```

- [ ] **Step 4: Touch de `updated_at` e publicação realtime**

```sql
create or replace function private.tg_touch_post_media_caption()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger post_media_caption_touch
  before update on public.post_media_caption
  for each row execute function private.tg_touch_post_media_caption();

alter publication supabase_realtime add table public.post_media_caption;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260805120000_post_media_captions.sql
git commit -m "feat(captions): post_media_caption table with RLS, grants, realtime"
```

### Task 1.2: `caption_mode` e o espelho

**Files:**
- Modify: `supabase/migrations/20260805120000_post_media_captions.sql`

- [ ] **Step 1: Coluna de modo**

```sql
alter table public.posts
  add column if not exists caption_mode text not null default 'single';

alter table public.posts
  add constraint posts_caption_mode_check
  check (caption_mode in ('single', 'per_media'));
```

- [ ] **Step 2: Função de sincronização do espelho**

```sql
-- posts.caption espelha a PRIMEIRA legenda não-vazia, para leitores que não
-- conhecem caption_mode (app publicado, superfícies de uma linha).
create or replace function private.sync_post_caption_mirror(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

  select c.caption
    into v_first
    from public.post_media m
    join public.post_media_caption c
      on c.post_id = m.post_id
     and c.media_key = private.normalize_media_key(m.image_url)
   where m.post_id = p_post_id
     and nullif(btrim(c.caption), '') is not null
   order by m.position
   limit 1;

  update public.posts
     set caption = coalesce(v_first, '')
   where id = p_post_id
     and caption is distinct from coalesce(v_first, '');
end;
$$;
```

- [ ] **Step 3: Triggers do espelho**

```sql
create or replace function private.tg_sync_caption_mirror()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_post_caption_mirror(coalesce(new.post_id, old.post_id));
  return null;
end;
$$;

-- Legenda mudou.
create trigger post_media_caption_sync_mirror
  after insert or update or delete on public.post_media_caption
  for each row execute function private.tg_sync_caption_mirror();

-- Ordem das mídias mudou. APENAS insert — delete é proibido (ver regra 1).
create trigger post_media_insert_sync_mirror
  after insert on public.post_media
  for each row execute function private.tg_sync_caption_mirror();

-- Escrita direta em posts.caption (postService.update) ou troca de modo.
-- pg_trigger_depth() = 0 evita a recursão: a própria função escreve em
-- posts.caption, e sem o guarda o trigger redispararia até estourar a pilha.
create or replace function private.tg_sync_caption_mirror_posts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_post_caption_mirror(new.id);
  return null;
end;
$$;

create trigger posts_sync_caption_mirror
  after update of caption, caption_mode on public.posts
  for each row
  when (pg_trigger_depth() = 0)
  execute function private.tg_sync_caption_mirror_posts();
```

- [ ] **Step 4: Regra "menos de 2 mídias volta para single"** (só no insert)

```sql
create or replace function private.tg_demote_caption_mode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.post_media where post_id = new.post_id) < 2 then
    update public.posts
       set caption_mode = 'single'
     where id = new.post_id
       and caption_mode = 'per_media';
  end if;
  return null;
end;
$$;

create trigger post_media_insert_demote_mode
  after insert on public.post_media
  for each row execute function private.tg_demote_caption_mode();
```

Nota: o caminho legado de reduzir para 1 mídia é um **delete sem insert**, então este trigger não cobre esse caso — quem cobre é `resolvePostCaption` (Task 2.1), que degrada para `post.caption` quando o modo é `per_media` mas há menos de 2 mídias.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260805120000_post_media_captions.sql
git commit -m "feat(captions): caption_mode + mirror kept by trigger (recursion-guarded)"
```

### Task 1.3: RPCs de mídia gravam legenda

**Files:**
- Modify: `supabase/migrations/20260805120000_post_media_captions.sql`

Base: `supabase/migrations/20260703192608_resilient_media_pipeline.sql` (corpo atual de `private.replace_social_post_media` e `private.create_social_post_with_media`).

- [ ] **Step 1: Recriar `private.replace_social_post_media` com legendas**

Copie o corpo atual **na íntegra** e acrescente, **nesta ordem obrigatória**, logo após o bloco que insere em `post_media`:

```sql
  -- (2) Legendas DEPOIS das mídias: o trigger do espelho precisa das linhas
  -- de post_media já presentes, senão o guarda de "mídia vazia" o impede.
  if p_media is not null then
    -- Chave AUSENTE = cliente legado (não conhece legenda) -> preservar.
    -- Chave presente com null/'' = limpar de fato.
    delete from public.post_media_caption c
     where c.post_id = p_post_id
       and exists (
         select 1
           from jsonb_array_elements(p_media) as item
          where item ? 'caption'
            and nullif(btrim(coalesce(item ->> 'caption', '')), '') is null
            and private.normalize_media_key(item ->> 'image_url') = c.media_key
       );

    insert into public.post_media_caption (post_id, media_key, caption)
    select
      p_post_id,
      private.normalize_media_key(item ->> 'image_url'),
      btrim(item ->> 'caption')
    from jsonb_array_elements(p_media) as item
    where item ? 'caption'
      and nullif(btrim(coalesce(item ->> 'caption', '')), '') is not null
    on conflict (post_id, media_key)
      do update set caption = excluded.caption;

    -- (3) Órfãs do conjunto final. NUNCA disparado por delete de post_media.
    delete from public.post_media_caption c
     where c.post_id = p_post_id
       and not exists (
         select 1
           from jsonb_array_elements(p_media) as item
          where private.normalize_media_key(item ->> 'image_url') = c.media_key
       );
  end if;

  -- (4) Espelho por último.
  perform private.sync_post_caption_mirror(p_post_id);
```

- [ ] **Step 2: Recriar `private.create_social_post_with_media`**

Copie o corpo atual e acrescente: ler `caption_mode` de `p_post` (`coalesce(p_post ->> 'caption_mode', 'single')`) ao inserir em `posts`, e o mesmo bloco de legendas acima após o insert de `post_media`.

- [ ] **Step 3: Reaplicar grants dos pares recriados**

```sql
revoke all on function private.replace_social_post_media(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function private.replace_social_post_media(uuid, jsonb)
  to authenticated;
-- idem para public.replace_social_post_media e para o par de create_*
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260805120000_post_media_captions.sql
git commit -m "feat(captions): media RPCs persist captions (absent key preserves)"
```

### Task 1.4: Sobrecargas de update (sem DROP)

**Files:**
- Modify: `supabase/migrations/20260805120000_post_media_captions.sql`

- [ ] **Step 1: Criar as sobrecargas com parâmetro OBRIGATÓRIO**

Parâmetro obrigatório cria sobrecarga resolvida por aridade; o PostgREST escolhe pelo conjunto de nomes de chaves do corpo JSON. **`DEFAULT` causaria ambiguidade** — não use.

```sql
create or replace function private.update_social_post(
  p_post_id uuid,
  p_caption text,
  p_workout_types text[],
  p_gym_id uuid,
  p_caption_mode text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_caption_mode not in ('single', 'per_media') then
    raise exception 'caption_mode inválido' using errcode = '22023';
  end if;

  perform private.update_social_post(p_post_id, p_caption, p_workout_types, p_gym_id);

  update public.posts
     set caption_mode = p_caption_mode
   where id = p_post_id;

  perform private.sync_post_caption_mirror(p_post_id);
end;
$$;
```

Crie o wrapper `public.update_social_post(uuid, text, text[], uuid, text)` `security invoker`, e o par equivalente para `update_social_post_full` (que recebe também `p_media jsonb`). Aplique `revoke`/`grant` em todas.

**As versões de 4 e 5 argumentos permanecem intactas** — o app publicado depende delas. Uma edição vinda delas num post `per_media` tem a legenda sobrescrita pelo espelho (comportamento declarado na spec).

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260805120000_post_media_captions.sql
git commit -m "feat(captions): update RPC overloads (old arities kept for shipped app)"
```

### Task 1.5: Propagar `caption_mode` até os leitores

**Files:**
- Modify: `supabase/migrations/20260805120000_post_media_captions.sql`

- [ ] **Step 1: View `public.feed_posts`**

Recriar incluindo `p.caption_mode` (colunas são enumeradas — ver `20260514113227_streak_restore.sql:746`).

- [ ] **Step 2: RPCs de leitura**

`get_home_feed`, `get_suggested_feed_posts`, `get_profile_posts` são `returns table(...)`. Alterar o tipo de retorno **exige `drop` + `create`** — e `DROP FUNCTION` descarta grants. Para cada uma, reaplicar: `security definer`, `set search_path = ''`, `revoke all ... from public, anon, authenticated`, `grant execute ... to authenticated`.

Adicionar coluna é seguro para o app publicado: Swift `Codable` ignora chaves desconhecidas.

- [ ] **Step 3: Nota de aplicação no fim do arquivo**

```sql
-- Após aplicar: recarregar o schema cache do PostgREST e verificar que as
-- sobrecargas novas respondem (não 404/PGRST202).
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260805120000_post_media_captions.sql
git commit -m "feat(captions): thread caption_mode through feed view and read RPCs"
```

---

## Fatia 2 — Core (TDD)

### Task 2.1: `resolvePostCaption`

**Files:**
- Create: `packages/core/src/domain/post-caption.ts`
- Test: `packages/core/src/domain/post-caption.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { resolvePostCaption } from "./post-caption";

const media = (caption: string | null) => ({ imageUrl: "u", caption });

describe("resolvePostCaption", () => {
  it("modo single devolve a legenda do post", () => {
    expect(
      resolvePostCaption({ caption: "geral", captionMode: "single", media: [] }, 0),
    ).toBe("geral");
  });

  it("modo per_media devolve a legenda da mídia ativa", () => {
    const post = {
      caption: "espelho",
      captionMode: "per_media" as const,
      media: [media("primeira"), media("segunda")],
    };
    expect(resolvePostCaption(post, 1)).toBe("segunda");
  });

  it("card sem legenda devolve string vazia", () => {
    const post = {
      caption: "espelho",
      captionMode: "per_media" as const,
      media: [media("primeira"), media(null)],
    };
    expect(resolvePostCaption(post, 1)).toBe("");
  });

  // Estado degenerado: o app publicado reduz o carrossel a 1 mídia com um
  // delete SEM insert, deixando per_media com menos de 2 mídias. Sem este
  // fallback o post ficaria mudo para sempre.
  it("per_media com menos de 2 mídias cai para a legenda do post", () => {
    const post = {
      caption: "espelho",
      captionMode: "per_media" as const,
      media: [media(null)],
    };
    expect(resolvePostCaption(post, 0)).toBe("espelho");
  });

  it("índice fora do intervalo cai para a legenda do post", () => {
    const post = {
      caption: "espelho",
      captionMode: "per_media" as const,
      media: [media("a"), media("b")],
    };
    expect(resolvePostCaption(post, 9)).toBe("espelho");
  });

  it("post legado sem array de mídia cai para a legenda do post", () => {
    expect(
      resolvePostCaption({ caption: "antiga", captionMode: "per_media", media: undefined }, 0),
    ).toBe("antiga");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd packages/core && npx vitest run src/domain/post-caption.test.ts`
Expected: FAIL — `resolvePostCaption` não existe.

- [ ] **Step 3: Implementação mínima**

```ts
export type PostCaptionMode = "single" | "per_media";

export type PostCaptionSource = {
  caption: string;
  captionMode?: PostCaptionMode | null;
  media?: Array<{ caption?: string | null }> | undefined;
};

/**
 * Qual legenda mostrar para o card ativo do carrossel.
 *
 * Devolve sempre `string` (nunca null) porque `GymPost.caption` é
 * não-nullable e o card chama `.length` sem guarda.
 *
 * Degrada para a legenda do post quando: o modo é único; não há array de
 * mídia (post legado); o índice está fora do intervalo; ou o post está no
 * estado degenerado `per_media` com menos de 2 mídias — que o app iOS
 * publicado produz ao reduzir o carrossel com um delete sem insert.
 */
export function resolvePostCaption(
  post: PostCaptionSource,
  activeIndex: number,
): string {
  const media = post.media;
  if (post.captionMode !== "per_media") return post.caption;
  if (!Array.isArray(media) || media.length < 2) return post.caption;
  const item = media[activeIndex];
  if (!item) return post.caption;
  return item.caption ?? "";
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd packages/core && npx vitest run src/domain/post-caption.test.ts`
Expected: PASS (6 testes)

- [ ] **Step 5: Exportar no barrel**

Em `packages/core/src/domain/index.ts`, adicionar `export * from "./post-caption";`

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain/post-caption.ts packages/core/src/domain/post-caption.test.ts packages/core/src/domain/index.ts
git commit -m "feat(captions): resolvePostCaption pure resolver with degenerate-state fallback"
```

### Task 2.2: Tipos e payload das RPCs

**Files:**
- Modify: `packages/core/src/domain/types.ts:164` (`PostMediaInput`), `CreatePostInput`
- Modify: `packages/core/src/services/posts.ts` — `mediaRpcRows` (linha ~22), `p_post` (~64-93), `updateSocialDetails` (~156-173)

- [ ] **Step 1: Teste do contrato do payload**

Escreva um teste que capture o corpo enviado à RPC e afirme:
- `mediaRpcRows` inclui `caption` (trimada; `null` quando vazia) e continua com `slice(0, 10)`;
- `updateSocialDetails` envia **`null` explícito**, nunca `undefined`, em `p_caption`, `p_gym_id`, `p_media`.

**Por quê:** `JSON.stringify` remove chaves `undefined`. Com o corpo encolhido, o PostgREST resolveria a sobrecarga errada (ou 404 `PGRST202`), porque a resolução é pelo conjunto de nomes de chaves.

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** — `caption?: string | null` em `PostMediaInput`; `captionMode?: PostCaptionMode` em `CreatePostInput`; `caption: media.caption?.trim() || null` em `mediaRpcRows`; `caption_mode` na montagem de `p_post`; `p_caption_mode` em `updateSocialDetails`; trocar todos os `?? undefined` por `?? null`.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit**

```bash
git add packages/core/src/domain/types.ts packages/core/src/services/posts.ts packages/core/src/services/posts.test.ts
git commit -m "feat(captions): caption in media payload + explicit nulls for overload resolution"
```

### Task 2.3: Busca de legendas em lote

**Files:**
- Modify: `packages/core/src/services/posts.ts` (junto de `mediaForPosts`, ~110-121)

- [ ] **Step 1: Teste** — `captionsForPosts(postIds)` usa **uma** query `.in("post_id", ids)` e agrupa por `post_id` + `media_key`. Nunca uma query por post (o feed viraria N+1 — o mesmo motivo pelo qual `mediaForPosts` já é em lote).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** `post_media` continua com `select("*")`, então a legenda é casada em memória por URL normalizada (mesma normalização do banco: URL sem query string).
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Regenerar tipos**

Run: typegen do Supabase para `packages/core/src/database.types.ts` (sem isso `caption_mode` e a tabela nova não compilam).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/services/posts.ts packages/core/src/services/posts.test.ts packages/core/src/database.types.ts
git commit -m "feat(captions): batched caption fetch + regenerated database types"
```

---

## Fatia 3 — Composer web

### Task 3.1: Componente `MediaCaptionStrip`

**Files:**
- Create: `apps/web/src/components/gym-circle/composer/MediaCaptionStrip.tsx`

Props: `media`, `captions`, `activeIndex`, `onActiveIndexChange`, `onCaptionChange`, `maxLength = 300`.

Requisitos:
- Miniaturas como `<button type="button">` reais, com `aria-current` na ativa e nome acessível (`"mídia 2 de 4, com legenda"`).
- Marcador visual nas miniaturas que já têm texto.
- Contador `"2 de 4 · 42/300"`.
- Legenda vazia é válida.

- [ ] Escrever teste de comportamento (seleção muda o texto editado; contador acompanha).
- [ ] Rodar e ver falhar.
- [ ] Implementar.
- [ ] Rodar e ver passar.
- [ ] Commit.

### Task 3.2: Wire em criar e editar

**Files:**
- Modify: `apps/web/src/components/gym-circle/screens/PostScreen.tsx`
- Modify: `apps/web/src/components/gym-circle/EditPostSheet.tsx` (atenção a `:464`)
- Modify: `apps/web/src/i18n/locales/pt-BR.json`, `en.json`

- [ ] Toggle "Legenda única / Várias legendas" **só com 2+ mídias**.
- [ ] `EditPostSheet` carrega as legendas existentes para dentro de `mediaItems`.
- [ ] **Alterar qualquer legenda marca `mediaChanged = true`.** Hoje `media: mediaChanged ? mediaItems : undefined` — sem isso, editar só legendas não salva nada e falha em silêncio.
- [ ] Remover a mídia selecionada move a seleção para a anterior (ou 0).
- [ ] Cair para 1 mídia: avisar que a legenda daquela mídia sai da leitura, e voltar para `single`.
- [ ] i18n PT/EN (sem string hardcoded).
- [ ] Gate: `npx tsc --noEmit`, `npx eslint <arquivos>`, testes.
- [ ] Commit (staging por caminho explícito; **não** incluir mudanças do Codex nos JSON de i18n).

---

## Fatia 4 — Leitura web

### Task 4.1: `MediaCarousel` notifica o índice

**Files:**
- Modify: `apps/web/src/components/gym-circle/design-system/MediaCarousel.tsx`

- [ ] Adicionar `onActiveIndexChange?: (index: number) => void` às props.
- [ ] **Declarar o `useEffect` ANTES dos early returns** (o componente retorna cedo com 0 ou 1 mídia — hook depois disso viola as regras dos hooks):

```tsx
useEffect(() => {
  onActiveIndexChange?.(active);
}, [active, onActiveIndexChange]);
```

Não chame o callback de dentro do updater de `setActive` (`handleScroll`) — dispararia setState de outro componente durante a render.
- [ ] Trocar a key do slide de `item.imageUrl` para o índice/posição (mídia repetida colide).
- [ ] Commit.

### Task 4.2: `SocialPostCard` troca a legenda

**Files:**
- Modify: `apps/web/src/components/gym-circle/design-system/SocialPostCard.tsx`
- Modify: `apps/web/src/components/gym-circle/social/types.ts`, `supabaseSocialSelectors.ts`, `supabaseSocialActions.ts`, `useSupabaseSocial.ts`

- [ ] Estado `activeMediaIndex`; legenda via `resolvePostCaption`.
- [ ] **Altura estável:** área com `min-height` de 2 linhas; truncar por caracteres com limiar **120** (o global é 140 em `social/caption.ts`; medir DOM é evitado no projeto por causa da WebView iOS).
- [ ] Resetar `captionExpanded` ao mudar de card.
- [ ] `aria-live="polite"` na região da legenda, incluindo a posição ("2 de 4").
- [ ] Mapper `mediaByPost` carrega `caption`; `.select()` inclui `caption_mode`; patch otimista respeita o modo; canal realtime inclui `post_media_caption`.
- [ ] Gate + commit.

---

## Fatia 5 — Nativo (somente leitura)

**Files:**
- Modify: `FeedPost.swift`, `GymCircleAPI.swift` (o select de `post_media` está em `:330`), `FeedView.swift`

- [ ] Modelo ganha `captionMode` e legenda por mídia.
- [ ] Buscar `post_media_caption` e casar por URL normalizada.
- [ ] Carrossel troca a legenda pelo card ativo, com o mesmo fallback do estado degenerado.
- [ ] **Não** mexer no composer nativo (segue criando em `single`).
- [ ] Build do app + commit.

---

## Fatia 6 — Verificação e publicação

- [ ] `cd apps/web && npx tsc --noEmit` → OK
- [ ] `npx eslint` nos arquivos tocados → limpo
- [ ] `cd packages/core && npx vitest run` → verde
- [ ] `cd apps/web && npx vitest run` → verde
- [ ] `npm run build` (raiz) → compila
- [ ] **GATE:** apresentar ao Eduardo para aplicar a migration em produção (via MCP `apply_migration`, **nunca** `db push`) e autorizar push/deploy.
- [ ] Após aplicar: recarregar schema cache do PostgREST; rodar `get_advisors` (security + performance) e confirmar que a tabela nova não aparece em `rls_enabled_no_policy` nem em `unindexed_foreign_keys`.
- [ ] Smoke no iPhone: criar post com 3 fotos e legendas distintas; deslizar e ver a legenda trocar; editar só uma legenda e confirmar que salvou.

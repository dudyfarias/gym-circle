# Legendas por mídia no carrossel — design

**Data:** 2026-08-05
**Status:** rev. 3 (pós-review 2) — aguardando plano de implementação

## Problema

Um post do Gym Circle tem uma legenda só (`posts.caption`), mesmo quando o
carrossel tem até 10 fotos ou vídeos. Quem publica um treino com várias fotos
não consegue comentar cada uma. O Instagram lançou legendas múltiplas em junho
de 2026 — seletor "Legenda única / Várias legendas" acima da caixa de texto, e
no modo múltiplo a pessoa escreve o texto de cada card. Vamos copiar isso.

## Escopo aprovado

| Decisão | Escolha |
|---|---|
| Relação entre as legendas | **Substitui** — no modo múltiplo não há legenda geral *editável* (ver "espelho" abaixo) |
| Alcance desta entrega | **Web completo** (criar + editar + ler); **nativo só leitura** |
| Editar post existente | **Sim**, inclusive alternar de modo |
| Padrão do composer | **Tira de miniaturas** |
| Limite por legenda | **300 caracteres** |
| Proteção contra o app publicado | **Tabela separada** (opção A) |

Fora de escopo: composer nativo multi-legenda; mudar o limite de 10 mídias.

## Restrição dominante: o binário iOS já publicado

O app na App Store **não se corrige retroativamente**, e o que ele faz decide
quase todo este design:

- **Edita mídia escrevendo direto na tabela, não por RPC:**
  `client.from("post_media").delete().eq("post_id", ...)` seguido de
  `client.from("post_media").insert(rows)` —
  `PostComposerService.swift:323-345`; `publish` também insere direto
  (`:267-286`). **Quem usa `replace_social_post_media` é só o web**
  (`packages/core/src/services/posts.ts:130`).
- **São duas requisições HTTP = duas transações.** Existe um instante em que
  `post_media` está **vazia** para aquele post. Nenhum trigger pode reagir a
  esse estado intermediário — se reagir, é ele quem destrói as legendas.
- Só insere linhas quando `items.count > 1` (`:330`) — post de 1 mídia não tem
  linha em `post_media`.
- Chama `update_social_post` com **4 argumentos** (`:389`),
  `get_home_feed` (`GymCircleAPI.swift:32`) e `get_profile_posts` (`:300`).
- Lê `post_media` com select enumerado (`GymCircleAPI.swift:330`).

Consequência central: **guardar a legenda dentro de `post_media` a condena** —
o `DELETE` cego do app publicado a apaga, e nenhuma lógica de RPC intercepta,
porque a RPC não é chamada.

## Arquitetura

### Modelo de dados: tabela separada

A legenda vive **fora** de `post_media`, chaveada por **identidade da mídia**:

```sql
create table if not exists public.post_media_caption (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  media_key text not null,          -- image_url da mídia
  caption text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_media_caption_key unique (post_id, media_key),
  constraint post_media_caption_length_check check (char_length(caption) <= 300)
);

alter table public.posts
  add column if not exists caption_mode text not null default 'single';
alter table public.posts
  add constraint posts_caption_mode_check
  check (caption_mode in ('single', 'per_media'));
```

`post_media` **não ganha coluna de legenda.** O `unique (post_id, media_key)`
já cobre o índice da FK (`post_id` é a coluna líder).

**Chave por identidade, nunca por posição.** `media_key` = `image_url`.
Casar por posição reconstruiria exatamente o defeito pelo qual a alternativa
JSONB foi descartada: se o app antigo reordenar o carrossel, a legenda cola na
**foto errada** — publicamente. Legenda errada é pior que legenda ausente. Se
a URL não encontra par, a legenda simplesmente não aparece (e é limpa no
próximo write do web, ver "órfãs").

Posts existentes: `caption_mode='single'` pelo default, sem backfill.

### O que NÃO pode ter trigger

Por causa da janela de duas transações do app publicado:

- **Nada de trigger em `delete` de `post_media`.** No instante do delete a
  tabela fica vazia; qualquer limpeza ou "forçar single" disparada ali apagaria
  as legendas ou desligaria o modo de todo post editado pelo app antigo.
- **Limpeza de órfãs não é automática.** Uma legenda cuja `media_key` não
  corresponde a nenhuma mídia atual fica dormente (invisível, inofensiva) e é
  removida no próximo write do cliente web, que conhece o conjunto final
  pretendido. É o preço de sobreviver ao cliente legado, e é aceito.

### Espelho `posts.caption`

Ao gravar em `per_media`, `posts.caption` recebe a **primeira legenda
não-vazia** na ordem das mídias. Motivo: todo leitor que não conhece
`caption_mode` — incluindo o app publicado e as superfícies de uma linha —
renderiza `posts.caption`. Sem espelho, ou o post aparece mudo, ou (pior, na
rev. 1) vazaria um rascunho não relacionado.

**O espelho é garantido por trigger, não por disciplina de RPC.** Há um
caminho que escreve `posts.caption` direto na tabela —
`postService.update()` (`posts.ts:142-154`) — e a RLS permite que o dono o
faça de qualquer cliente. Portanto:

- função `private.sync_post_caption_mirror(p_post_id)` recalcula o espelho;
- trigger em `post_media_caption` (insert/update/delete) e em `posts`
  (update de `caption` ou `caption_mode`) chama a função quando o post está em
  `per_media`;
- **se não houver nenhuma linha em `post_media` naquele instante, a função não
  mexe no espelho** (é a janela intermediária do app antigo — recalcular ali
  zeraria a legenda).

Consequência declarada: uma edição de legenda feita pelo app publicado (que
manda `p_caption` num post `per_media`) é **sobrescrita pelo espelho**. É a
escolha coerente: o espelho é sempre derivado, nunca autoral. A alternativa —
recusar a chamada — daria erro insolúvel no app da loja.

### Regra "menos de 2 mídias → single"

Vale no servidor, **avaliada apenas no `insert`** (nunca no delete):
se após um insert em `post_media` o post tiver menos de 2 mídias, `caption_mode`
volta para `single`. O composer web avisa antes de aplicar. Como post de 1
mídia não tem linha em `post_media`, a legenda daquela mídia fica órfã e some
da leitura — o composer deve dizer isso ao usuário antes de confirmar.

### RPCs

`p_media` é `jsonb`, então a legenda entra como chave de cada item **sem mudar
assinatura** em `create_social_post_with_media` e `replace_social_post_media`.
Estas passam a gravar em `post_media_caption` (upsert por `media_key`) e a
limpar as órfãs do post, já que conhecem o conjunto final.

**As duas RPCs de update ganham sobrecarga, sem `DROP`.** Adicionar parâmetro
**obrigatório** cria sobrecarga (resolvida por aridade; o PostgREST resolve
pelo conjunto de nomes de chaves do corpo JSON). `DEFAULT` causaria
ambiguidade, por isso o parâmetro é obrigatório. As versões antigas continuam
vivas para o binário publicado:

- `update_social_post(p_post_id, p_caption, p_workout_types, p_gym_id, p_caption_mode)`
- `update_social_post_full(p_post_id, p_caption, p_workout_types, p_gym_id, p_media, p_caption_mode)`

**Armadilha que quebraria a sobrecarga:** `posts.ts:165-172` monta
`p_caption: input.caption ?? undefined` (idem `p_gym_id`, `p_media`), e
`JSON.stringify` **remove chaves `undefined`** — com corpo encolhido a chamada
cairia na assinatura antiga ou em `PGRST202`. O cliente web passa a enviar
**`null` explícito**, e há teste de contrato do corpo mínimo.

DDL no Postgres é transacional (não existe "janela sem função"). O risco real é
cliente antigo depois do commit e o **schema cache do PostgREST**: recarregar e
verificar é passo explícito da migration.

Se alguma função precisar ser recriada (caso das `returns table` abaixo),
reaplicar `security definer`, `set search_path = ''`, `revoke all ... from
public, anon` e `grant execute ... to authenticated` no par `private`/`public`
— `DROP FUNCTION` descarta grants e a função nova nasce com `EXECUTE` para
`PUBLIC`.

### Propagação até o cliente

- `caption_mode` em: view `public.feed_posts`, `get_home_feed`,
  `get_suggested_feed_posts`, `get_profile_posts` (colunas enumeradas; alterar
  `returns table` exige `drop`+`create` → reaplicar grants), e nos `.select()`
  de `useSupabaseSocial.ts:1489-1511` e `supabaseSocialSurfaces.ts:160-183`.
- Legendas: o web lê `post_media` com `select("*")`
  (`posts.ts:113-118`), então basta **buscar `post_media_caption` do post** e
  casar por `image_url` no mapper.
- Nativo: `GymCircleAPI.swift:330` enumera colunas de `post_media` e precisa da
  consulta nova à tabela de legendas.
- Adicionar coluna às RPCs de leitura é seguro para o binário publicado: Swift
  `Codable` ignora chaves desconhecidas.

### Código compartilhado

- `CreatePostInput` ganha `captionMode`; o objeto `p_post` (`posts.ts:64-93`)
  ganha a chave.
- `updateSocialDetails` (`posts.ts:156-173`) recebe e repassa `p_caption_mode`.
- `PostMediaInput` ganha `caption?: string | null`; `mediaRpcRows` emite
  `caption` mantendo `slice(0, 10)`.
- Regenerar `packages/core/src/database.types.ts` (typegen).
- Mapper `mediaByPost` (`supabaseSocialSelectors.ts:356-400`) monta item a item
  e descarta o desconhecido → carregar a legenda casada por URL.
- `GymPost.media[]` ganha `caption`.
- Patch otimista (`supabaseSocialActions.ts:1116-1130`) escreve
  `caption: input.caption` na linha local → respeitar o modo.

Função pura:

```ts
resolvePostCaption(post, activeIndex): string
```

Retorna `string` (nunca `null`) para casar com `GymPost.caption: string` e não
quebrar `SocialPostCard.tsx:177-181`. `single` → `post.caption`; `per_media` →
legenda da mídia ativa (`""` se vazia); índice inválido ou post legado sem
array → `post.caption`.

### Composer

Seletor só com 2+ mídias. Modo único intocado. Modo múltiplo: tira de
miniaturas, contador `"2 de 4 · 42/300"`, marcador nas que têm texto.

- **Editar só legendas precisa salvar:** hoje `EditPostSheet.tsx:464` manda
  `media` apenas se `mediaChanged` — alterar legenda passa a sujar o payload.
- **Carregar legendas existentes** ao abrir a edição.
- **Remover a mídia selecionada** → seleção vai para a anterior (ou 0).
- **Cair para 1 mídia** → avisa que a legenda daquela mídia será descartada.

### Leitura (web)

`MediaCarousel` ganha `onActiveIndexChange?` opcional; continua dono do índice.
A notificação sai de um `useEffect` sobre `active`, declarado **antes dos early
returns** (`MediaCarousel.tsx:54-71` retorna cedo quando há 0 ou 1 mídia —
hook depois disso violaria as regras dos hooks).

- **Altura estável:** área com altura mínima de 2 linhas; truncamento por
  **caracteres** (o projeto já evita medir DOM por causa da WebView iOS) com
  limiar de **120 caracteres** para legenda por mídia (o global é 140 em
  `social/caption.ts`, ~4 linhas).
- **"Ver mais" reseta ao trocar de card.**
- **Key do slide:** hoje `item.imageUrl` (`MediaCarousel.tsx:88`) — com mídia
  repetida as keys colidem e a legenda gruda na duplicata → usar posição/índice.
  (A `media_key` por URL tem a mesma limitação: mídia repetida no mesmo post
  compartilha legenda. Aceito e declarado.)
- **`CommentsBottomSheet.tsx:556-561`** renderiza a legenda **inteira** no topo
  — num post `per_media` mostrará a legenda espelhada (a da 1ª mídia), fixa,
  independentemente do card. Escolha declarada, não efeito colateral.
- Demais superfícies via espelho: grade do perfil, notificações,
  compartilhamento, `PostDetailOverlay` (definir se abre no índice ativo ou 0),
  `RecapCoverPickerSheet.tsx:206` (`alt`).
- **Acessibilidade:** legenda em região `aria-live="polite"` incluindo posição
  ("2 de 4"); miniaturas do composer como `<button>` com nome acessível e
  `aria-current`; o carrossel hoje não tem role/label/teclado
  (`MediaCarousel.tsx:79-120`).
- **Realtime:** o canal (`useSupabaseSocial.ts:1887-1904`) não assina
  `post_media` nem `post_media_caption` → incluir a tabela nova, senão editar
  só legendas não propaga entre dispositivos.

### Nativo (só leitura)

`FeedPost.swift` ganha `captionMode` + legendas; `GymCircleAPI` busca a tabela
nova; o carrossel do `FeedView` troca a legenda pelo card ativo. O composer
nativo segue criando em `single`. A edição nativa
(`FeedView.swift:1445` → `GymCircleAppModel.swift:1089`) fica protegida pela
tabela separada, sem código novo no app.

## Testes

**Puros** — `resolvePostCaption` (5 casos); `mediaRpcRows` (legenda, trim,
`slice(0,10)`).

**Banco / caminhos legados (o que quebra produção)**
- `delete` + `insert` direto em `post_media` (caminho do app publicado)
  **não** apaga legendas, e elas voltam casadas por URL;
- reordenar as mídias pelo cliente legado **não** troca legenda de foto;
- espelho recalculado por `replace_social_post_media` e por escrita direta em
  `posts.caption`;
- espelho **não** é recalculado quando `post_media` está vazia;
- `update_social_post` de 4 args sobre post `per_media` tem a legenda
  sobrescrita pelo espelho (não corrompe);
- resultado com menos de 2 mídias força `single` (avaliado no insert);
- corpo mínimo da RPC resolve a sobrecarga certa (`null` explícito);
- `caption_mode` sai pela view e pelas 3 RPCs de leitura.

**Composer** — toggle só com 2+; editar só legendas persiste; queda para 1
mídia avisa; remover a selecionada move a seleção.

**Leitura** — legenda troca com o índice; "ver mais" reseta; altura estável.

Suíte existente segue verde.

## Riscos

| Risco | Mitigação |
|---|---|
| App publicado apaga legendas | Tabela separada — o `DELETE` cego não a alcança |
| Trigger reagir à janela de 2 transações | Nenhum trigger em `delete` de `post_media`; espelho não recalcula com mídia vazia |
| Legenda na foto errada | Casamento por `image_url`, nunca por posição |
| Sobrecarga não resolver (chaves `undefined`) | Cliente web envia `null` explícito + teste de contrato |
| Espelho dessincronizar por escrita direta | Garantido por trigger, não por disciplina de RPC |
| `DROP`+`CREATE` das RPCs de leitura perde grants | Reaplicar definer/search_path/revoke/grant |
| Schema cache do PostgREST desatualizado | Recarga + verificação como passo da migration |
| Legendas órfãs acumulando | Limpas no próximo write do web; dormentes e inofensivas até lá |
| Divergência migrations locais × produção | Aplicar via MCP `apply_migration`, nunca `db push`; gated no ok do Eduardo |

Concorrência: `for update` em `posts` serializa, mas legendas seguem
*last-write-wins* — aceito.

## Alternativas descartadas

- **Coluna `caption` em `post_media`**: o `DELETE` cego do app publicado a
  apaga, e a RPC não intercepta porque o app não a chama.
- **Array JSONB em `posts`**: amarra a legenda à posição.
- **Preservação dentro da RPC**: inerte — o cliente legado não passa por ela.
- **Bloquear escrita direta em `post_media`**: erro insolúvel no app da loja.
- **`DROP` + recriar as RPCs de update**: quebraria o app publicado e perderia
  grants, sem necessidade técnica.
- **Composer em lista vertical / passo dedicado**: rolagem longa; passo extra.

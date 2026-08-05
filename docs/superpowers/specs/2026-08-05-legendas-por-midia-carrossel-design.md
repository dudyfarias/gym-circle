# Legendas por mídia no carrossel — design

**Data:** 2026-08-05
**Status:** aprovado (aguardando plano de implementação)

## Problema

Um post do Gym Circle tem uma legenda só (`posts.caption`), mesmo quando o
carrossel tem até 10 fotos ou vídeos. Quem publica um treino com várias fotos
não consegue comentar cada uma — "aquecimento", "PR no agachamento", "final
destruído" viram um texto único descolado das imagens.

O Instagram lançou legendas múltiplas em junho de 2026: um seletor
"Legenda única / Várias legendas" acima da caixa de texto; no modo múltiplo a
pessoa desliza card a card e escreve o texto de cada um. Vamos copiar essa
solução.

## Escopo aprovado

| Decisão | Escolha |
|---|---|
| Relação entre as legendas | **Substitui** — no modo múltiplo o post não tem legenda geral (igual Instagram) |
| Alcance desta entrega | **Web completo** (criar + editar + ler); **nativo só leitura** |
| Editar post existente | **Sim** — inclusive alternar entre os modos depois de publicado |
| Padrão do composer | **Tira de miniaturas** (fiel ao Instagram) |
| Limite por legenda | **300 caracteres** (a legenda geral do post fica como está) |

Fora de escopo: composer nativo com legendas múltiplas (fica para depois);
mudar o limite de 10 mídias.

## Estado atual (verificado)

- `posts.caption text` — legenda única, nullable. Sem `check` de tamanho no DB.
- `post_media` — `id, post_id, position, media_type, image_url, thumbnail_url,
  poster_url, blur_data_url, media_width, media_height, media_duration_seconds,
  created_at`. **Não existe coluna de legenda.**
- Gravação passa por RPCs (não há insert direto):
  - `create_social_post_with_media(p_post jsonb, p_media jsonb)`
  - `replace_social_post_media(p_post_id uuid, p_media jsonb)`
  - `update_social_post(p_post_id uuid, p_caption text, p_workout_types text[], p_gym_id uuid)`
  - `update_social_post_full(p_post_id uuid, p_caption text, p_workout_types text[], p_gym_id uuid, p_media jsonb)`
  - Cada uma tem o par `private.<fn>` (security definer) + `public.<fn>` (wrapper).
- `packages/core/src/services/posts.ts` — `mediaRpcRows()` mapeia
  `PostMediaInput` → linhas jsonb da RPC, com `slice(0, 10)`.
- `PostMediaInput` — `packages/core/src/domain/types.ts:164`.
- Leitura web: `MediaCarousel` (`design-system/MediaCarousel.tsx`) guarda o
  índice ativo internamente; `SocialPostCard` renderiza a legenda separada, com
  estado `captionExpanded` ("ver mais").
- Composer web: `screens/PostScreen.tsx` (criar), `EditPostSheet.tsx` (editar,
  `MAX_MEDIA = 10`).
- Nativo: `FeedPost.swift`, `FeedView.swift`, `ComposerView.swift`,
  `PostComposerService.swift`, `GymCircleAPI.swift`.

## Arquitetura

### Modelo de dados

Migration aditiva:

```sql
alter table public.post_media
  add column if not exists caption text;

alter table public.post_media
  add constraint post_media_caption_length_check
  check (caption is null or char_length(caption) <= 300);

alter table public.posts
  add column if not exists caption_mode text not null default 'single';

alter table public.posts
  add constraint posts_caption_mode_check
  check (caption_mode in ('single', 'per_media'));
```

Posts existentes caem em `'single'` pelo default — **sem backfill, sem mudança
de comportamento para quem já postou**.

**Por que um `caption_mode` explícito em vez de deduzir.** Deduzir o modo de
"alguma mídia tem legenda?" é frágil: um post no modo único com legendas
residuais renderizaria errado. O modo explícito também permite alternar entre
os modos no composer sem perder texto.

**`posts.caption` é preservado no modo `per_media`** — guardado, apenas não
exibido. É o que torna o toggle não-destrutivo (ida e volta preserva o texto
original) e mantém o dado antigo intacto.

Legenda nula/vazia por mídia é válida (card sem legenda, igual Instagram).

### Gravação (RPCs)

`p_media` é `jsonb` em todas as RPCs de mídia, então a legenda entra como mais
uma chave de cada objeto — **sem mudança de assinatura**:

- `create_social_post_with_media` → ler `caption` de cada item de `p_media`;
  ler `caption_mode` de `p_post`.
- `replace_social_post_media` → ler `caption` de cada item de `p_media`.

As duas RPCs de update recebem `p_caption text` explícito e precisam de um
`p_caption_mode`. **Adicionar parâmetro cria sobrecarga no Postgres e gera
ambiguidade com a versão antiga**, então a migration precisa fazer
`drop function` + recriar o par `private`/`public` de:

- `update_social_post`
- `update_social_post_full`

Tudo dentro de uma transação (a janela em que a função não existe é o ponto
mais delicado desta migration).

### Código compartilhado

- `PostMediaInput` ganha `caption?: string | null`.
- `mediaRpcRows()` passa a emitir `caption: media.caption?.trim() || null`.
- Nova função **pura** em `packages/core` (domínio, sem I/O nem React):

```ts
resolvePostCaption(post, activeIndex): string | null
```

Regras: modo `single` → `post.caption`; modo `per_media` → legenda da mídia no
índice ativo; índice fora do intervalo ou post legado sem array de mídia →
degrada para `post.caption`.

### Composer (criar + editar)

O seletor "Legenda única / Várias legendas" aparece **somente com 2+ mídias**.

- **Modo único:** exatamente o comportamento de hoje.
- **Modo múltiplo:** tira de miniaturas acima da caixa; tocar numa miniatura
  seleciona qual legenda está sendo editada; contador `"2 de 4 · 42/300"`;
  marcador nas miniaturas que já têm texto.

**Regra de borda:** se durante a edição as mídias caírem para 1, o post volta
automaticamente para `single` — e o texto de `posts.caption` reaparece, porque
nunca foi apagado.

Mesma UI em `PostScreen` (criar) e `EditPostSheet` (editar).

### Leitura (web)

`MediaCarousel` ganha um `onActiveIndexChange?: (index: number) => void`
opcional. O carrossel **continua dono do índice** — apenas notifica. Isso evita
transformá-lo num componente controlado (refactor grande em todos os call
sites) e mantém retrocompatibilidade.

`SocialPostCard` guarda o índice ativo e usa `resolvePostCaption`.

Três regras de UX:

1. **Altura estável.** No modo `per_media` a área da legenda reserva altura
   fixa de 2 linhas (com "ver mais" para expandir). Sem isso o card cresce e
   encolhe a cada swipe e o feed treme sob o dedo. Card sem legenda mantém a
   área reservada, vazia.
2. **"Ver mais" reseta ao trocar de foto** — senão o leitor cai num texto novo
   já meio-expandido, num estado que não é dele.
3. **Onde só cabe uma linha** (grade do perfil, notificações, texto de
   compartilhamento): mostrar a **primeira legenda não-vazia**, derivada em
   tempo de render e **nunca persistida** — a decisão foi não promover a 1ª
   legenda a legenda do post.

### Nativo (somente leitura)

- `FeedPost.swift` ganha `captionMode` e a legenda por mídia.
- O `select` em `GymCircleAPI.swift` passa a trazer as colunas novas.
- O carrossel do `FeedView` troca a legenda conforme o card ativo.
- O composer nativo continua criando posts em `single` (default da coluna).

**Trava de segurança a verificar na implementação:** se existir edição de post
no nativo, ela **não pode** salvar por cima de um post `per_media` e apagar as
legendas silenciosamente. Se existir, bloquear a edição desses posts ou
preservar modo + legendas.

## Testes

- **Puros (`packages/core`)** — `resolvePostCaption`: modo único; modo múltiplo
  com texto; card com legenda vazia; índice fora do intervalo; post legado sem
  array de mídia.
- **Serviço** — `mediaRpcRows` carrega a legenda e continua respeitando
  `slice(0, 10)`; `create`/`setMedia` propagam legendas e modo.
- **Composer** — toggle aparece só com 2+ mídias; alternar modos preserva os
  dois textos; queda para 1 mídia reverte para `single`.
- **Leitura** — legenda troca conforme o índice ativo; "ver mais" reseta ao
  trocar de card; altura da área não muda entre cards.
- Suíte existente segue verde (`SocialPostCard`, `mediaFileType`, etc.).

## Riscos

| Risco | Mitigação |
|---|---|
| `drop function` + recriar as 2 RPCs de update | Tudo numa transação; migration aplicada só com ok explícito do Eduardo |
| Feed tremendo ao deslizar (altura variável) | Área de legenda com altura reservada de 2 linhas |
| Nativo apagar legendas ao editar | Verificar se há edição nativa; bloquear ou preservar |
| Legenda grudar na foto errada ao reordenar | Legenda mora na linha de `post_media` — anda junto com a mídia |

## Alternativas descartadas

- **Array JSONB em `posts`** (ex.: `media_captions`): amarra a legenda à
  *posição*. Como a edição permite reordenar, remover e adicionar mídia, é
  exatamente o cenário em que a legenda gruda na foto errada.
- **Tabela nova `post_media_caption`**: 1:1 com `post_media` — join extra, RLS
  extra, nenhum ganho.
- **Composer em lista vertical**: boa revisão geral, mas com 10 mídias vira
  rolagem longa no celular.
- **Composer em passo dedicado card a card**: imersivo, mas adiciona um passo
  ao fluxo de publicar.

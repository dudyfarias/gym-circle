# Sprint 13 — Carrossel multi-mídia + até 5 tags de treino (design)

**Status:** aprovado pelo usuário (2026-06-09). Web-only (feed/composer são web no
app híbrido). Vai pro ar via Vercel, sem build iOS.

## Objetivo
Post estilo carrossel do Instagram: escolher várias fotos/vídeos (misturados) e
passar arrastando esquerda/direita no feed. Mais: até 5 tags de tipo de treino
por post.

## Regras de produto (decididas)
- **Câmera = mídia única.** Tirar foto/gravar no app → post de 1 mídia (fluxo
  simples atual, já blindado do bug de WebView na Sprint 12.3). Sem "adicionar
  mais" nesse caminho.
- **Galeria = carrossel.** Multi-seleção de **até 10**, foto+vídeo misturado.
- **Story = 1ª mídia.** Quando o post também vira story, o story usa só o item 0
  (capa). Já é o comportamento natural (story lê a capa).
- **Tags de treino:** até **5** por post.
- Sem (v1): reordenar mídias (usa ordem de seleção), pinch-zoom no carrossel,
  editar mídias de post publicado, badge multi no grid nativo, legenda por item.

## Schema (retrocompatível — não quebra feed/grids/recap/stats)
Tabela nova, ordenada:
```
post_media(id uuid pk, post_id uuid fk→posts on delete cascade, position int,
           media_type text, image_url text, thumbnail_url, poster_url,
           blur_data_url, media_width, media_height, media_duration_seconds,
           created_at) ; unique(post_id, position)
RLS: SELECT se pode ver o post (espelha posts_select); INSERT/DELETE do dono do post.
```
- `posts` MANTÉM as colunas de mídia como **capa = item 0**. Feed antigo, grids
  nativos, stories, recap continuam lendo `posts.image_url` e pegam a capa.
- Posts antigos não têm linhas em `post_media` → tratados como 1 mídia. Zero
  backfill.
- `posts.workout_types text[]` (1–5). `posts.workout_type` continua = primeira
  tag (retrocompat: card, grids, recap, stats, conquista "5 tipos").

## Fluxo de dados
1. **Composer:** câmera → `mediaItems = [1]`; galeria → multi-select (≤10). Cada
   item sobe pelo pipeline atual (thumbnail/blur/poster). Tags: multi-select ≤5.
2. **Publish:** `posts.create` grava capa (item 0) + `post_media` (N linhas) +
   `workout_types`. Story (se escolhido) usa item 0.
3. **Feed (enrich):** busca em lote `post_media` dos posts visíveis (igual
   likes/comments) → `EnrichedPost.media[]`. Vazio = `[capa]`. Todo post tem
   `media[]` ≥1.

## UI do carrossel (feed)
- Novo componente `MediaCarousel` (trilho **CSS scroll-snap x mandatory** —
  momentum nativo iOS, **sem lib de gesto**, seguro pós-bug de WebView).
- Dots + "1/N" quando `media.length > 1`. `data-gc-no-screen-swipe` no trilho.
- Vídeo: só o slide **ativo** dá autoplay (IntersectionObserver por slide).
- 1 mídia → render idêntico a hoje (sem carrossel).
- Reusado no composer como preview (swipe pra revisar + remover item ativo).

## Fases
1. **DB** — migration `post_media` (RLS) + `posts.workout_types`. Aplicar + arquivo.
2. **Core** — `posts.create` aceita `media[]`+`workoutTypes`; insere post_media;
   tipos (`PostMediaRow`, `CreatePostInput`); `database.types.ts`.
3. **Hook** — `publishWorkout` monta media[]+workoutTypes; enrich adiciona
   `media[]` (batch fetch); story = item 0.
4. **Composer** — `mediaItems[]`; câmera single / galeria multi (≤10) + remover;
   tags multi-select (≤5); wire publish.
5. **Feed** — `MediaCarousel` em `SocialPostCard` (+ embedded no CommentsSheet).
6. **i18n + tsc + smoke + deploy.**

## Riscos / mitigação
- **Não quebrar feed:** capa em `posts.*` + `media[]` sempre ≥1 (fallback à capa).
- **Gesto no WKWebView:** scroll-snap nativo, sem custom gesture (lição da 12.3).
- **Upload de N itens:** sequencial com progresso; falha de 1 não derruba os outros
  (mostra erro, mantém os que subiram).
- **Conquista "5 tipos":** continua via `workout_type` primária (não conta os 5 de
  um post só como 5 tipos distintos — decisão consciente pra v1).

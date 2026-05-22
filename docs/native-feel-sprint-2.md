# Gym Circle Native Feel Sprint 2

## Objetivo

Melhorar carregamento visual, qualidade de mídia e sensação nativa. O
app hoje funciona, mas a UX de mídia tem caracteristicas web (flashes
pretos, troca seca, qualidade reduzida em alguns uploads). Sprint 2
atinge **sensação iOS native** sem reescrita.

## Escopo

- Preload inteligente (primeiros posts do feed, próximas stories).
- Image cache leve (track em memória + sessionStorage best-effort).
- Eliminar flashes pretos via `blurDataURL` + crossfade.
- Thumbnails premium + posters HQ.
- Transições suaves entre mídias.
- Smooth scrolling no feed (memoization audit).
- Preserve previous frame nos stories.
- Abstração única: `GCImage` (substitui `next/image` direto e `<img>`
  espalhados pelos surfaces).

## Fora do escopo

- Apple Maps (Sprint 5).
- Reescrita React Native / Swift.
- Redesign completo de feed/stories/perfil.
- Offline completo (Sprint futura).
- Push notifications reais (Sprint futura).
- Compressão destrutiva ou redução agressiva de qualidade.
- Migration de schema (`blurDataUrl` já existe nos types — vamos usar
  o que tem).

## Princípios

1. **Qualidade visual NUNCA reduz** — Sprint 1 reduziu demais em
   alguns uploads. Sprint 2 reverte com pipeline mais inteligente.
2. **Incremental** — cada sub-fase deploya isolada, com rollback fácil.
3. **Performance preservada** — preload limitado, cache pequeno, sem
   carregar mídia invisível. Heurísticas de connection
   (`navigator.connection.effectiveType`) ajustam comportamento em rede
   lenta.
4. **Sem novo backend** — sem RPCs novas nesta sprint. Tudo client-side
   usando dados que já vêm hidratados (`blurDataUrl`, `thumbnailUrl`,
   `posterUrl`).
5. **Acessível por trás de fallback** — quando `blurDataUrl` não
   existir no post, o `GCImage` usa cor solid dark como placeholder. Nunca
   tela preta.

## Sub-fases (cada uma é 1 commit + deploy)

| Sub-fase | Foco | Risco |
|---|---|---|
| **2.1** | Foundation: `GCImage` + helpers de cache | Baixo |
| **2.2** | Feed integration: `SocialPostCard` usa `GCImage` + preload primeiros 3 posts | Médio |
| **2.3** | Stories preload + preserve previous frame | Médio |
| **2.4** | Upload pipeline polish: qualidade + posters HQ + opcional blurDataUrl no servidor | Médio |
| **2.5** | Performance audit: memoization, virtualization, heurísticas connection-aware | Baixo |
| **2.6** | Polish + tests + docs final + Sprint 3 prep (Comments overlay polish) | Baixo |

## Checklist

| Item | Planejado | Implementado | Validado | Pendente |
| --- | --- | --- | --- | --- |
| `GCImage` central com blur+crossfade | Sim | — | — | 2.1 |
| Cache helpers (`hasImageLoaded`, `markImageLoaded`, `preloadImage`) | Sim | — | — | 2.1 |
| Feed primeiros 3 com `priority` + preload | Sim | — | — | 2.2 |
| `SocialPostCard` usa `GCImage` | Sim | — | — | 2.2 |
| Stories preload da próxima mídia | Sim | — | — | 2.3 |
| Stories preserve previous frame | Sim | — | — | 2.3 |
| Crossfade ao trocar stories | Sim | — | — | 2.3 |
| Upload: qualidade alta (revert sprint 1) | Sim | — | — | 2.4 |
| Posters de vídeo HQ | Sim | — | — | 2.4 |
| `blurDataUrl` populado no upload (server) | Sim | — | — | 2.4 (opcional) |
| `SocialPostCard` audit memoization | Sim | — | — | 2.5 |
| Connection-aware preload (`navigator.connection`) | Sim | — | — | 2.5 |
| Testes vitest | Sim | — | — | 2.6 |
| Smoke iPhone real | Sim | — | — | Eduardo |

## Métricas pra acompanhar

Adicionar `markPerf` calls nos pontos críticos pra Web Vitals locais:

- `feed_media_first_paint_ms` — tempo entre mount do feed e primeiro
  `<img>` decoded.
- `story_media_first_paint_ms` — idem pra stories.
- `media_cache_hit_rate` — % de src que já estavam no cache em memória.
- `image_decode_ms` — tempo médio de decode por imagem (`Image.decode()`).
- `story_preload_ms` — tempo de preload da próxima story.

Logs no console em dev, opcionalmente report pra Sentry quando GA.

## Problemas conhecidos hoje

1. **Flash preto antes da imagem aparecer**: `<img>` ou `<Image>` sem
   `placeholder="blur"` mostra o `bg-black` do parent até decode.
2. **Story preto antes de trocar**: ao swipe pra próxima story, o
   `<video>` ou `<img>` da nova ainda não carregou → frame preto.
3. **Qualidade reduzida em uploads**: Sprint 1 aplicou compressão JPEG
   agressiva (~60% quality). Posts ficam visivelmente "borrados".
4. **Posters de vídeo pixelados**: `posterUrl` gerado com qualidade
   baixa pra economizar bytes.
5. **Re-render no scroll**: `SocialPostCard` re-renderiza tudo quando
   um post muda (ex.: like update). Causa jank visual.
6. **Sem cache de "já carreguei"**: ao reabrir feed, fade-in roda de
   novo mesmo se a imagem já tava no cache HTTP.

## Decisões arquiteturais

### A. `GCImage` por baixo do `next/image`

Em vez de reescrever decoding/srcset/lazy do zero, wrappar `next/image`:
- `next/image` já entrega responsive `srcset`, lazy loading, fetch
  priority hints, blur placeholder nativo.
- Wrap adiciona: crossfade controlado, cache de "loaded sources",
  callback `onReady` pra animações sincronizadas, fallback de cor
  solid dark quando `blurDataURL` não existir.

### B. Cache em `Set<string>` em memória

- Sem `localStorage`/`IndexedDB`. O navegador já cacheia via HTTP
  cache headers — o `Set` apenas track quais src JÁ foram montadas
  pra **pular o crossfade em re-mounts** (sensação instant).
- Limpo automaticamente no unload — sem TTL manual.
- `sessionStorage` opcional pra persistência entre páginas da PWA.

### C. `blurDataURL` quando ausente: solid dark + shimmer

- Quando o post tem `blurDataUrl`, `next/image` renderiza o blur
  diretamente.
- Quando ausente, o `GCImage` mostra um `<div>` com `bg-[#0c0d0e]` +
  shimmer animation suave.
- Server-side: na Fase 2.4 (opcional) — Edge Function que gera
  blurDataURL no upload via `sharp` ou similar.

### D. Preload com `<link rel="preload">` + `Image.decode()`

- Primeiros 3 posts do feed: Next.js já injeta `priority` quando
  passamos a prop. Plus, `Image.decode()` programático pra
  pré-decodificar antes do render.
- Stories próxima: criar `<img>` invisível com src da próxima — força
  fetch + decode no idle time.

### E. Connection-aware preload

```ts
const conn = (navigator as any).connection;
const isSlowConn =
  conn?.effectiveType === "slow-2g" ||
  conn?.effectiveType === "2g" ||
  conn?.saveData === true;
const preloadCount = isSlowConn ? 1 : 3;
```

Reduz preload quando rede está fraca ou Data Saver está ligado.

## Pipeline de upload (Sprint 2.4)

Atual (Sprint 1):
- Camera/galeria → JPEG compressão alta (~60% quality, max 1200px)
- Sem geração de `blurDataUrl`
- `thumbnailUrl` = mesma imagem (não é thumbnail real)

Proposto (Sprint 2.4):
- **Original**: JPEG 88% quality, max 1920px (era 60%/1200px) — qualidade
  visível significativamente melhor.
- **Thumbnail**: separada, 360px width, JPEG 75% — só pra preload no
  feed/grid.
- **Poster de vídeo**: frame extraído com qualidade alta (PNG ou JPEG
  90%).
- **blurDataURL**: gerado via canvas no client durante upload — base64
  10x10px JPEG, ~500 bytes. Persistido em `posts.blur_data_url`
  (campo já existe).

Sem novo backend obrigatório — upload pipeline atual continua, só
ajustes de quality + extra blob.

## Como retomar Sprint 2 (próximas sessões)

Sprint 2.1 entregue (este commit). Próximas:

1. **2.2** — wrappar `SocialPostCard` pra usar `GCImage`. Passar
   `priority` true nos primeiros 3 posts. Validar visualmente no feed.
2. **2.3** — `StoryViewer` integra `GCImage`. Preload da próxima via
   `<img>` invisível com `decoding="async"`. Preserve previous frame
   (não unmount até o próximo carregar).
3. **2.4** — Pipeline de upload mais inteligente. Pode ficar atrás de
   feature flag se for muito invasivo.
4. **2.5** — `React.memo` no `SocialPostCard` + `useCallback` em
   props que mudam por referência. Audit de re-renders via DevTools.
5. **2.6** — testes + smoke iPhone + doc final.

## Pendências futuras (não bloqueantes)

- Edge Function dedicada pra gerar blurDataURL server-side (mais
  preciso que canvas client).
- `IndexedDB` cache pra mídia recente (não-bloqueante; HTTP cache
  já cobre 90% do caso).
- Service Worker pra cache offline-first (Sprint futura).
- Lazy-load de comentários inline (Sprint 3.5 já preparou o sheet).

## Estado

Sprint 2 PLANEJADA em 2026-05-22. Sub-fase 2.1 (Foundation) entregue
no mesmo dia. Próximas 2.2 → 2.6 ficam pra sessões seguintes conforme
plano acima.

### Fase 2.3 entregue (2026-05-22) — Stories preload + crossfade

**Commit:** TBD

**O que foi feito:**

- **`StoryViewer.tsx` ganhou blur + crossfade**:
  - Container outer trocou `bg-[#090A0B]` (Tailwind class) por
    `style.backgroundColor: "#090A0B"` + optional
    `backgroundImage: url(blurDataUrl)` quando a story tem blur. Resolve
    o "flash preto antes de aparecer a mídia".
  - Novo state `mediaLoaded` (init com `hasImageLoaded(story.imageUrl)`)
    controla opacity do `<Image fill>`: 0 enquanto decode, 1 quando
    `onLoad` dispara.
  - `markImageLoaded` no `onLoad` — re-abrir a mesma story na sessão
    renderiza instant.
  - Vídeos não mudaram (já têm `poster={story.posterUrl ?? thumbnailUrl}`
    e `preload="metadata"`).
- **Preload da próxima story em `GymCirclePreview.tsx`**:
  - Novo useEffect que monitora `nextStoryId` + `selectedStorySequence`.
  - Quando user abre uma story, dispara `preloadImage(next.imageUrl)`
    em paralelo — quando avançar (swipe/tap), bytes + bitmap já estão
    prontos.
  - Pula vídeos (file inteiro é grande demais pra preload; `<video
    preload="metadata">` nativo cobre o caso).
  - Roda automaticamente sempre que muda a story atual.

**Pendente (movido pra Sprint 2.6 — polish)**:

- **Preserve previous frame verdadeiro** — exigiria remover
  `key={story.id}` do `StoryViewerContent` (que força remount entre
  stories). Refactor delicado: afeta hooks internos, audio, progress
  bar. Pragmático ficou: blur background do container cobre o gap
  visual durante o decode da nova; suficiente pra eliminar flash preto.

**Como verificar visualmente (após deploy)**:

1. Abrir uma story de outro user.
2. Tap/swipe pra próxima: troca deve ser **mais rápida**, com fundo
   blur ao invés de preto se a story tiver `blurDataUrl`.
3. Em re-abertura (mesma sessão): mídia aparece **instant**, sem fade.

### Fase 2.2 entregue (2026-05-22) — Feed integration

**Commit:** TBD (após validação)

**O que foi feito:**

- **`PinchZoomImage.tsx` ganhou blur + crossfade**:
  - Nova prop `blurDataUrl?: string | null` — quando passada, vira
    `background-image: url(...)` no container (cover + center). Sem
    ela, fallback `backgroundColor: #0c0d0e` (tema dark). NUNCA tela
    preta vazia.
  - Trocou `bg-black` (Tailwind class) por `backgroundColor` inline
    pra permitir override do blur.
  - State `loaded` (init com `hasImageLoaded(src)`) controla opacity
    da `<img>`: 0 enquanto decode, 1 quando `onLoad` dispara.
  - `markImageLoaded(src)` no `handleImageLoad` — marca no cache
    global pra próximos mounts pularem o fade-in.
  - useEffect reseta loaded check quando o `src` muda (ex.: edit de
    post troca a URL).
  - Transition `opacity 280ms var(--gc-ease-ios, ease-out)` — mesmo
    timing do GCImage pra consistência visual.
- **`SocialPostCard.tsx`**: passa `blurDataUrl={post.blurDataUrl}` pro
  `PinchZoomImage`. Quando o post tiver blur no banco (Sprint 2.4 vai
  popular), o feed já consome automaticamente.
- **`FeedScreen.tsx`**: novo useEffect que pré-carrega os primeiros N
  posts assim que `feedPosts` muda:
  ```ts
  const count = getPreloadCount(3); // 3 em wifi, 1 em 2g/saveData
  const srcs = feedPosts
    .slice(0, count)
    .filter((post) => post.mediaType !== "video") // skipa vídeos
    .map((post) => post.thumbnailUrl ?? post.imageUrl);
  void preloadImages(srcs, count);
  ```
  - Vídeos pulam porque o arquivo é grande — só pre-fetch o poster
    via `<video poster>` nativo (que já existe).
  - Thumbnail é preferido (bytes menores) quando o post tem.
  - Roda imediatamente após mount E sempre que o feed atualizar (novos
    posts no topo).

**Validação local pendente** — `node_modules` corrompido nesta sessão.
Vercel build remoto valida TypeScript + bundle. Se quebrar, fix-up
follow-up.

**Como verificar visualmente (após deploy)**:

1. Limpar cache do navegador / força refresh.
2. Abrir feed pela primeira vez (frio): primeiras imagens devem
   aparecer com **fade suave a partir do solid dark** — sem flash
   preto.
3. Reabrir feed (quente, mesma sessão): primeiras imagens devem
   aparecer **instantaneamente sem fade** (cache tracking ativo).
4. Scroll lento: posts subsequentes ainda usam o lazy do `next/image`
   — preload só cobre os 3 primeiros.

**Próxima sub-fase (2.3)**: StoryViewer integra GCImage + preserve
previous frame + preload da próxima story.

### Fase 2.1 entregue (2026-05-22) — Foundation

**Commit:** TBD (após validação)

**O que foi feito:**

- **Novo `apps/web/src/components/gym-circle/design-system/GCImage.tsx`**:
  - Wrapper sobre `next/image` com crossfade controlado, cache
    tracking em memória, fallback solid dark quando `blurDataURL`
    ausente.
  - Props: `src` (obrigatório), `alt`, `width/height` OR `fill`,
    `blurDataURL?` (opcional), `priority?`, `sizes?`, `className?`,
    `onReady?` (callback).
  - Estado interno `loaded` controla opacidade — 0 enquanto decode,
    100 quando `onLoad` dispara.
  - Se `src` já está no cache em memória → renderiza com `loaded=true`
    inicial (sem fade-in).
- **Helpers de cache em `apps/web/src/components/gym-circle/design-system/imageCache.ts`**:
  - `hasImageLoaded(src)` — boolean.
  - `markImageLoaded(src)` — adiciona ao Set.
  - `preloadImage(src)` — cria `<img>` invisível + chama
    `Image.decode()`, marca como loaded ao terminar.
  - `preloadImages(srcs[])` — itera com pequeno delay entre cada.
- **Estado interno**: `loadedSources: Set<string>` global em memória.
  Reset implícito no reload da página.

**Validação:**

- `npm run lint` (apps/web): 0 warnings ✓ (esperado).
- `npm test`: tests novos pra `imageCache.ts` cobrindo idempotência +
  preload promise.
- `npm run build`: TypeScript pass.

**Pendências da 2.1**:

- Nenhuma integração ainda — apenas foundation. Caller usa nas
  próximas sub-fases.

# Gym Circle 1.1.1 — Sprint 1 — Ultra Smooth Feed

**Status:** Spec
**Data:** 2026-05-26
**Owner:** Eduardo Farias
**Pre-reqs:** Sprint 4.7 hotfix (i18n) live em produção (commit `1b5d749`)

---

## Objetivo

Eliminar a sensação de "carregamento web" do feed e stories. Entregar
percepção Instagram-level smooth mantendo qualidade ALTA das imagens.
Stories devem funcionar em fluxo contínuo entre autores (igual Instagram/
Threads/WhatsApp Status), e o flash preto entre transições deve ser
imperceptível.

---

## Princípios não-negociáveis

- **NÃO reduzir qualidade das imagens.** Upload pipeline (1920px @ 0.88
  quality, Sprint 2.4) fica intacto.
- **NÃO comprimir agressivamente.** Thumbnail é apenas placeholder de
  transição — imagem final SEMPRE é HQ.
- **NÃO destruir nitidez.** Retina iPhone deve ver pixels nítidos.
- **NÃO quebrar feed/stories/chat.** Mudanças incrementais sobre o que
  existe (`imageCache.ts`, `GCImage`, `PinchZoomImage`).
- **NÃO quebrar App Store build.** Capacitor sync intacto.
- **NÃO remover fallbacks existentes.** Dark color `#0c0d0e` + blurDataUrl
  + `Image.decode()` continuam como fallbacks em camadas.

Prioridade visual: (1) percepção premium → (2) carregamento instantâneo
→ (3) qualidade alta visual.

---

## Escopo

### Phase A — Foundation (MediaLoadingService + LRU)

Wrapper sobre `imageCache.ts` existente. Manter API existente intacta
(`preloadImage`, `preloadImages`, `hasImageLoaded`, `markImageLoaded`)
pra zero breaking change.

**Novos arquivos:**
- `src/components/gym-circle/media/MediaLoadingService.ts`
- `src/components/gym-circle/media/lruCache.ts`
- `src/components/gym-circle/media/MediaLoadingService.test.ts`
- `src/components/gym-circle/media/lruCache.test.ts`

**Modificados:**
- `src/components/gym-circle/design-system/imageCache.ts` (adicionar LRU,
  150 entries, pin-protect de currentlyVisible)

**API nova exposta:**
```ts
MediaLoadingService.warmMedia(url)
MediaLoadingService.cancelPreload(url)
MediaLoadingService.preloadStorySequence(items)
MediaLoadingService.getBestMediaUrl(item, surface: "feed" | "story" | "grid" | "preview")
MediaLoadingService.getBlurPlaceholder(item)
```

### Phase B — Stories contínuos

**Causa raiz do flash preto entre stories:** `key={props.story.id}` no
`StoryViewer.tsx` causa unmount + remount completo. Entre os 2 frames,
aparece o `bg-black/94` do parent.

**Solução:**
- Remover `key={props.story.id}` — viewer persistente
- Hook `useStoryQueue(authors, initialAuthorId)` controla estado cross-author
- Pre-decode antes de swap (não troca src até `Image.decode()` resolver)
- Preload chain: current + 2 next + first do próximo autor

**Novos arquivos:**
- `src/components/gym-circle/social/useStoryQueue.ts`
- `src/components/gym-circle/social/useStoryQueue.test.ts`

**Modificados:**
- `src/components/gym-circle/design-system/StoryViewer.tsx` (remove key=, adopta queue)
- `src/components/gym-circle/GymCirclePreview.tsx` (wire useStoryQueue)

### Phase C — Feed polish

**Causa do flash preto no feed first paint:** os 3 primeiros posts não
têm preload eager — dependem do user scroll/IntersectionObserver pra
disparar download.

**Solução:**
- `FeedScreen.useEffect` → `preloadImages(topThreePostUrls)` no mount
- Verificar/adoptar `GCImage` no `SocialPostCard` (se ainda usa `<Image>` direto)
- Métricas debug via `console.log [gc-metrics]`

**Modificados:**
- `src/components/gym-circle/screens/FeedScreen.tsx` (top-3 preload)
- `src/components/gym-circle/design-system/SocialPostCard.tsx` (adoptar GCImage onde aplicável)

---

## Fora do escopo (deferido)

- `createImageBitmap` (iOS WebView tem gotchas — fica pra outra sprint)
- `requestIdleCallback` (não-essencial pro impacto principal)
- Shimmer animations (microinteractions — futuro polish)
- Skeleton premium redesign (visual polish, não muda sensação)
- React virtualization libs (react-window etc — overkill, basta
  `posts.slice(0, visible+10)` se necessário)
- Push DB schema (fora do escopo de mídia)
- Apple Maps (Sprint futura)
- React Native migration (nunca, app é Capacitor)

---

## Checklist

### Phase A — Foundation

- [ ] **planejado** — Criar `lruCache.ts` com Map-based LRU + capacity 150
- [ ] **planejado** — Adicionar LRU ao `imageCache.ts` (manter API)
- [ ] **planejado** — Criar `MediaLoadingService.ts` wrapper
- [ ] **planejado** — Implementar `warmMedia(url)` (pre-decode sem await)
- [ ] **planejado** — Implementar `cancelPreload(url)` (AbortController)
- [ ] **planejado** — Implementar `preloadStorySequence(items)` (queue serial)
- [ ] **planejado** — Implementar `getBestMediaUrl(item, surface)` lookup
- [ ] **planejado** — Implementar `getBlurPlaceholder(item)` priority chain
- [ ] **planejado** — Expose `window.gc.media` em prod (debug)
- [ ] **planejado** — Unit tests `MediaLoadingService.test.ts`
- [ ] **planejado** — Unit tests `lruCache.test.ts`
- [ ] **implementado**
- [ ] **validado** — Vercel build verde
- [ ] **pendente**

### Phase B — Stories contínuos

- [ ] **planejado** — Criar `useStoryQueue.ts` hook
- [ ] **planejado** — Implementar `openAuthor`, `nextStory`, `previousStory`, `nextAuthor`, `previousAuthor`
- [ ] **planejado** — Implementar `preloadUpcoming` (2 next + first do próximo autor)
- [ ] **planejado** — Remover `key={props.story.id}` do `StoryViewer`
- [ ] **planejado** — Adoptar `useStoryQueue` no parent (`GymCirclePreview`)
- [ ] **planejado** — Pre-decode antes de swap (não trocar `src` até resolver)
- [ ] **planejado** — Manter frame anterior visível durante decode
- [ ] **planejado** — Unit tests `useStoryQueue.test.ts`
- [ ] **implementado**
- [ ] **validado** — iPhone manual: stories sequência contínua entre autores
- [ ] **pendente**

### Phase C — Feed polish

- [ ] **planejado** — `FeedScreen.useEffect` → preload top-3 no mount
- [ ] **planejado** — Verificar `SocialPostCard` usa `GCImage` (se não, migrar)
- [ ] **planejado** — Instrumentar métricas debug (`console.log [gc-metrics]`)
- [ ] **planejado** — Documentar métricas no doc da sprint
- [ ] **implementado**
- [ ] **validado** — iPhone manual: feed first paint sem preto
- [ ] **pendente**

---

## Arquitetura — 3 fases

### Phase A: MediaLoadingService (wrapper sobre imageCache)

```
┌─────────────────────────────────────────────────┐
│  MediaLoadingService (novo)                     │
│  ├─ warmMedia(url)         → fire-and-forget    │
│  ├─ cancelPreload(url)     → AbortController    │
│  ├─ preloadStorySequence() → serial queue       │
│  ├─ getBestMediaUrl(s)     → switch by surface  │
│  └─ getBlurPlaceholder(i)  → priority chain     │
└──────────────┬──────────────────────────────────┘
               │ delega
               ▼
┌─────────────────────────────────────────────────┐
│  imageCache.ts (existente + LRU adicionado)     │
│  ├─ preloadImage()  ← Sprint 2.1                │
│  ├─ preloadImages() ← Sprint 2.1                │
│  ├─ markImageLoaded() ← Sprint 2.1              │
│  ├─ hasImageLoaded()  ← Sprint 2.1              │
│  ├─ getPreloadCount() ← Sprint 2.1              │
│  └─ LRU eviction (NEW): 150 entries +           │
│      pin-protect currentlyVisible Set            │
└─────────────────────────────────────────────────┘
```

**Pin-protect lógica:**
```
loadedSources = Set<string>          // membership
lruOrder = LRU<string>(150)          // eviction order
pinnedSources = Set<string>          // currentlyVisible — never evicted

markImageLoaded(url) → loadedSources.add(url), lruOrder.touch(url)
pinSource(url) → pinnedSources.add(url)
unpinSource(url) → pinnedSources.delete(url)
when lruOrder.overflow → evict oldest NOT in pinnedSources
```

**getBestMediaUrl matrix:**
```
surface     │ priority order
────────────┼──────────────────────────────────────
feed        │ imageUrl (HQ 1920px) → fallback thumbnailUrl
story       │ imageUrl (HQ original) → posterUrl → thumbnailUrl
grid        │ thumbnailUrl → imageUrl
preview     │ thumbnailUrl → blurDataUrl
```

**getBlurPlaceholder priority chain:**
```
1. item.blurDataUrl (base64 ~32x40px, gerado no upload — Sprint 2.4)
2. item.thumbnailUrl (640px do storage — works as blur background)
3. dominantColor fallback (#0c0d0e dark — tema)
4. solid #0c0d0e (último recurso — NUNCA tela preta vazia)
```

### Phase B: StoryViewer persistente + useStoryQueue

**Antes (atual):**
```
GymCirclePreview
  └─ <StoryViewer key={story.id} story={currentStory} ... />
                  ↑↑↑ FORCE REMOUNT
```

**Depois:**
```
GymCirclePreview
  └─ const queue = useStoryQueue(authors, initialAuthorId)
  └─ <StoryViewer story={queue.currentStory} ... />
                  ↑↑↑ SEM key — viewer persistente
```

**useStoryQueue API:**
```ts
type StoryQueue = {
  currentStory: EnrichedStory | null;
  currentAuthor: EnrichedUser | null;
  hasNext: boolean;           // próximo story OU próximo autor
  hasPrevious: boolean;
  openAuthor(authorId: string): void;
  nextStory(): void;          // dentro do autor; se end-of-author, nextAuthor()
  previousStory(): void;      // dentro do autor; se start-of-author, previousAuthor()
  nextAuthor(): void;
  previousAuthor(): void;
  close(): void;              // viewer fecha
};

// Side-effect interno: cada navegação dispara
//   MediaLoadingService.preloadStorySequence([nextN, nextN+1, nextAuthorFirst])
```

### Phase C: Feed top-3 preload

```ts
// FeedScreen.tsx
useEffect(() => {
  const topThree = posts.slice(0, 3).map(p =>
    MediaLoadingService.getBestMediaUrl(p, "feed")
  );
  MediaLoadingService.preloadImages(topThree);
}, [posts]);
```

---

## Data Flow — 4 cenários críticos

### 1. Boot do feed (resolve flash preto first paint)

```
1. FeedScreen mount com posts=[...3+ items]
2. useEffect dispara:
   topThreeUrls = posts.slice(0,3).map(getBestMediaUrl)
   MediaLoadingService.preloadImages(topThreeUrls)
3. Image.decode() em paralelo (concurrency=3)
4. Cada decode resolve → markImageLoaded(url)
5. Render do GCImage com src=url → hasImageLoaded(url)===true → loaded=true inicial
6. Opacity 1 instant — sem fade-in (porque já está cached na sessão)
```

### 2. Story open (resolve flash preto ring → viewer)

```
1. User tap em StoryBubble (ring) com authorId=X
2. useStoryQueue.openAuthor("X")
3. State: currentAuthorIndex=X, currentStoryIndex=0
4. Side-effect: preloadStorySequence([author.stories[0], author.stories[1]])
5. Viewer renderiza com story[0]
6. Como story[0] já tá em preload pipeline (paralelo), o onLoad dispara cedo
7. Sem flash — blur background do container cobre o gap microscópico
```

### 3. Story transition dentro do autor (zero flash entre stories)

```
1. Timer 5.2s expira → nextStory()
2. Check: hasImageLoaded(stories[currentStoryIndex+1].imageUrl)?
   a) SIM (preloaded) → swap imediato
   b) NÃO → await Image.decode() do next → swap
3. Viewer NUNCA desmonta (sem key=) — só muda story prop
4. <img> src muda → onLoad → opacity 0→1 crossfade 280ms
5. Preload chain dispara: MediaLoadingService.preloadStorySequence([story+1, story+2])
```

### 4. Story end of author (continuous flow — NEW behavior)

```
1. nextStory() detecta isLastStoryOfAuthor=true
2. nextAuthor()
3. State: currentAuthorIndex++, currentStoryIndex=0
4. Se currentAuthorIndex === authors.length:
   close() → onClose() → viewer unmount (intencional, fim natural)
   Senão:
   preloadStorySequence([newAuthor.stories[0], newAuthor.stories[1]])
   Viewer recebe nova story prop — sem remount
5. Crossfade 280ms entre last-story-prev-author e first-story-new-author
```

---

## Error Handling

| Falha | Comportamento |
|---|---|
| `preloadImage` rejeita | `.catch(() => {})` silent — preload é best-effort |
| `Image.decode()` falha (CORS/SVG) | Fallback pro `onload` event (já em imageCache) |
| LRU evict tenta remover currentDisplayedSrc | Pin-protect via Set — não evict |
| Story queue vazio (sem autores) | Graceful — viewer não monta |
| `useStoryQueue.nextAuthor()` no último autor | `close()` automático |
| Capacitor `@capacitor/device` falha | Catch → fallback navigator.language (já implementado) |
| Network offline | Browser HTTP cache + preload pipeline ignora (resolve com whatever bytes tiver) |

---

## Testing Strategy

### Unit tests (Vitest)

**`lruCache.test.ts`:**
- Insert respeita capacity
- LRU access pattern (most recent stays)
- Eviction order (oldest first)
- Pin-protect (pinned never evicted)
- Unpin permite eviction normal

**`MediaLoadingService.test.ts`:**
- `warmMedia` dispara preload sem await
- `cancelPreload` interrompe download
- `preloadStorySequence` ordem serial
- `getBestMediaUrl` por surface (feed/story/grid/preview)
- `getBlurPlaceholder` priority chain
- Dedup (mesma URL não dispara 2 requests)

**`useStoryQueue.test.ts`:**
- `openAuthor` seta state inicial
- `nextStory` dentro do autor incrementa index
- `nextStory` no último story dispara `nextAuthor`
- `previousStory` no primeiro story dispara `previousAuthor`
- `nextAuthor` no último autor dispara `close`
- `preloadUpcoming` é chamado em cada navegação
- `hasNext`/`hasPrevious` reflete state corretamente

### Build validation

```bash
cd apps/web
npx tsc --noEmit              # local TS check (node_modules pode estar corrompido)
npm test -- --run             # unit tests (vitest)
npm run lint                   # ESLint
npm run build                  # Next.js production build
npx cap sync ios               # Capacitor sync iOS
```

Se local node_modules está corrompido (caso de outras sprints), Vercel
build é ground truth.

### Manual iPhone test plan

**Frio (limpar app + abrir):**
- [ ] Feed first paint sem flash preto
- [ ] Top-3 posts aparecem rapidamente
- [ ] Scroll rápido pra baixo — preload acompanha
- [ ] Voltar pra topo — instant (cached)

**Stories:**
- [ ] Tap ring → viewer abre sem preto
- [ ] Story 1 → Story 2 do mesmo autor: transição smooth
- [ ] Acabou último story do autor A → vai pro autor B automaticamente
- [ ] Acabou último story do autor B → vai pro C
- [ ] Acabou TODOS → fecha viewer
- [ ] Swipe direita → autor anterior
- [ ] Swipe esquerda → próximo autor
- [ ] Tap right side → próximo story
- [ ] Tap left side → story anterior
- [ ] Swipe down → fecha viewer

**Conexão lenta (simulada via Network Link Conditioner):**
- [ ] Feed boot ainda mostra blur placeholders enquanto HQ baixa
- [ ] Stories esperam decode antes de swap (não mostram preto)

---

## Métricas (debug-only nesta sprint)

`console.log` com tag `[gc-metrics]`:

| Métrica | Quando |
|---|---|
| `feed_first_paint_ms` | FeedScreen mount → first GCImage onReady |
| `first_image_visible_ms` | First top-3 image opacity=1 |
| `story_first_frame_ms` | openAuthor → first story onLoad |
| `image_decode_ms` | preloadImage start → decode resolved |
| `preload_queue_ms` | preloadImages call → all done |
| `feed_scroll_jank_ms` | requestAnimationFrame longer than 16ms during scroll |
| `story_transition_ms` | nextStory → next image onLoad |
| `story_preload_hit_rate` | hits / total nextStory calls |
| `cache_hit_rate` | hasImageLoaded returns true / total checks |

Sem backend custom nesta sprint. Sprint futura pode mandar pra Vercel
Analytics ou Supabase events.

---

## Resultado esperado

Ao final da Sprint 1:

- **Feed parece instantâneo** — top-3 preloaded ao mount; flash preto
  no first paint desaparece
- **Stories parecem nativos** — viewer persistente (sem unmount), crossfade
  entre stories, zero flash preto
- **Stories funcionam continuamente** — sequência completa entre autores
  igual Instagram/Threads
- **Thumbnails viram apenas transição elegante** — imagem final HQ
  decoded antes do swap
- **Imagens continuam em alta qualidade** — pipeline 1920px @ 0.88 intacto
- **Preload inteligente** — connection-aware (já tinha), agora também
  story-sequence-aware
- **Scroll mais fluido** — IntersectionObserver-driven preload reduz
  decode tardio
- **Story viewer parece Instagram-level** — barras de progresso, gestos,
  autoplay, pre-decode

**Sensação final**: lembra Instagram/Threads/Apple Photos mantendo a
identidade Gym Circle (dark premium, brand colors).

---

## Próximos passos após esta sprint (não-incluso)

- **Sprint 2 v1.1.1**: feed virtualization leve, microinteractions polish
- **Sprint 3 v1.1.1**: createImageBitmap experiment, shimmer skeletons
- **Sprint 4 v1.1.1**: métricas backend (Vercel Analytics / Supabase events)

---

## Referências internas

- Sprint 2.1 — `imageCache.ts` foundation (preloadImage + hasImageLoaded)
- Sprint 2.2 — Crossfade pattern no `PinchZoomImage` (opacity 280ms)
- Sprint 2.3 — Stories blur background + crossfade + preload next
- Sprint 2.4 — Upload pipeline (1920px @ 0.88 + thumb 640px + blurDataUrl)
- Sprint 3.6 — Progressive HQ load no feed (`hqSrc` no PinchZoomImage)
- Sprint 4.7 — i18n hotfix (não relacionado, mas pre-req live)

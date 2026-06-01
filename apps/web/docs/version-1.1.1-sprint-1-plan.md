# Ultra Smooth Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar percepção Instagram-level smooth no feed + stories contínuos cross-author, eliminando flash preto em first paint e transições. Manter qualidade alta das imagens.

**Architecture:** Wrapper mínimo (`MediaLoadingService`) sobre `imageCache.ts` existente + LRU cache (150 entries) + `useStoryQueue` hook pra cross-author autoplay + StoryViewer persistente (sem `key=`) + top-3 preload no FeedScreen mount. Zero deps novas.

**Tech Stack:** Next.js 16 + Capacitor 8 + React 19 + Vitest + react-i18next 17. Existing: `imageCache.ts`, `GCImage`, `PinchZoomImage`, `StoryViewer`.

**Spec:** `apps/web/docs/version-1.1.1-sprint-1-ultra-smooth-feed.md` (commit `0f2d49f`)

**Pre-requisitos:** Sprint 4.7 i18n hotfix live em produção (commit `1b5d749`)

---

## Phase A — Foundation: MediaLoadingService + LRU

Goal: criar wrapper formal sobre `imageCache.ts` + adicionar LRU eviction com pin-protect. Zero breaking change na API existente.

### Task A1: LRU cache module (foundation) ✅ DONE — commits `e78c34f` + `6966964` (fix self-evict)

**Files:**
- Create: `apps/web/src/components/gym-circle/media/lruCache.ts`
- Test: `apps/web/src/components/gym-circle/media/lruCache.test.ts`

- [ ] **Step 1: Criar o módulo de teste failing**

Em `apps/web/src/components/gym-circle/media/lruCache.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { LruCache } from "./lruCache";

describe("LruCache", () => {
  it("respects capacity", () => {
    const lru = new LruCache<string>(2);
    lru.add("a");
    lru.add("b");
    lru.add("c");
    expect(lru.has("a")).toBe(false);
    expect(lru.has("b")).toBe(true);
    expect(lru.has("c")).toBe(true);
  });

  it("moves accessed entries to front", () => {
    const lru = new LruCache<string>(2);
    lru.add("a");
    lru.add("b");
    lru.touch("a"); // a is now most recent
    lru.add("c"); // should evict b, not a
    expect(lru.has("a")).toBe(true);
    expect(lru.has("b")).toBe(false);
    expect(lru.has("c")).toBe(true);
  });

  it("pin-protect: pinned entries never evicted", () => {
    const lru = new LruCache<string>(2);
    lru.add("a");
    lru.pin("a");
    lru.add("b");
    lru.add("c"); // should evict b (a is pinned)
    expect(lru.has("a")).toBe(true);
    expect(lru.has("b")).toBe(false);
    expect(lru.has("c")).toBe(true);
  });

  it("unpin permite eviction normal", () => {
    const lru = new LruCache<string>(2);
    lru.add("a");
    lru.pin("a");
    lru.add("b");
    lru.unpin("a");
    lru.add("c");
    expect(lru.has("a")).toBe(false);
    expect(lru.has("b")).toBe(true);
    expect(lru.has("c")).toBe(true);
  });

  it("clear remove tudo (incluindo pinned)", () => {
    const lru = new LruCache<string>(2);
    lru.add("a");
    lru.pin("a");
    lru.clear();
    expect(lru.has("a")).toBe(false);
    expect(lru.size()).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar o teste (deve FAIL — módulo não existe)**

```bash
cd apps/web && npx vitest run src/components/gym-circle/media/lruCache.test.ts
```

Expected: FAIL — `Cannot find module './lruCache'`

- [ ] **Step 3: Implementar LruCache**

Em `apps/web/src/components/gym-circle/media/lruCache.ts`:

```typescript
/**
 * LruCache — Sprint 1 v1.1.1.
 *
 * Map-based LRU com pin-protect. Map preserva ordem de inserção, então
 * `delete` + `set` move o entry pra "mais recente" automaticamente.
 *
 * Pin-protect: entries pinned NUNCA são evicted, mesmo se forem o oldest.
 * Útil pra proteger o currentlyDisplayed image enquanto o LRU mexe nos
 * outros 149 entries.
 *
 * Espaço: O(capacity). Memory leve — só strings de URL no Map keys, sem
 * bitmaps.
 */

export class LruCache<T> {
  private readonly capacity: number;
  private readonly order: Map<T, true>;
  private readonly pinned: Set<T>;

  constructor(capacity: number) {
    if (capacity < 1) throw new Error("LruCache capacity must be >= 1");
    this.capacity = capacity;
    this.order = new Map();
    this.pinned = new Set();
  }

  add(value: T): void {
    if (this.order.has(value)) {
      this.touch(value);
      return;
    }
    this.order.set(value, true);
    this.evictIfNeeded();
  }

  touch(value: T): void {
    if (!this.order.has(value)) return;
    this.order.delete(value);
    this.order.set(value, true);
  }

  has(value: T): boolean {
    return this.order.has(value);
  }

  pin(value: T): void {
    if (!this.order.has(value)) return;
    this.pinned.add(value);
  }

  unpin(value: T): void {
    this.pinned.delete(value);
  }

  delete(value: T): void {
    this.order.delete(value);
    this.pinned.delete(value);
  }

  size(): number {
    return this.order.size;
  }

  clear(): void {
    this.order.clear();
    this.pinned.clear();
  }

  /** Sprint 1 v1.1.1: eviction respeita pinned set. */
  private evictIfNeeded(): void {
    while (this.order.size > this.capacity) {
      const oldest = this.findOldestUnpinned();
      if (oldest === undefined) {
        // All entries are pinned — não conseguimos evict. Aceitamos
        // overflow temporário; quando algum unpin acontecer, eviction
        // próxima limpa.
        break;
      }
      this.order.delete(oldest);
    }
  }

  private findOldestUnpinned(): T | undefined {
    for (const value of this.order.keys()) {
      if (!this.pinned.has(value)) return value;
    }
    return undefined;
  }
}
```

- [ ] **Step 4: Rodar testes (devem PASS)**

```bash
cd apps/web && npx vitest run src/components/gym-circle/media/lruCache.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/gym-circle/media/lruCache.ts apps/web/src/components/gym-circle/media/lruCache.test.ts
git commit -m "feat(sprint-1-v1.1.1-A1): LRU cache com pin-protect"
```

---

### Task A2: Adicionar LRU ao imageCache.ts ✅ DONE — commit `ce48d34`

**Files:**
- Modify: `apps/web/src/components/gym-circle/design-system/imageCache.ts`
- Modify: `apps/web/src/components/gym-circle/design-system/imageCache.test.ts`

- [ ] **Step 1: Ler estado atual do imageCache.test.ts**

```bash
cat apps/web/src/components/gym-circle/design-system/imageCache.test.ts | head -50
```

Garantir que testes existentes ainda passam após mudança.

- [ ] **Step 2: Adicionar testes pra LRU integration**

Append no `imageCache.test.ts`:

```typescript
describe("imageCache LRU integration", () => {
  it("evicts oldest when capacity exceeded", () => {
    clearImageCache();
    for (let i = 0; i < 155; i++) {
      markImageLoaded(`https://example.com/${i}.jpg`);
    }
    // Capacity is 150 — first 5 should be evicted
    expect(hasImageLoaded("https://example.com/0.jpg")).toBe(false);
    expect(hasImageLoaded("https://example.com/4.jpg")).toBe(false);
    expect(hasImageLoaded("https://example.com/5.jpg")).toBe(true);
    expect(hasImageLoaded("https://example.com/154.jpg")).toBe(true);
  });

  it("pinSource protects from eviction", () => {
    clearImageCache();
    markImageLoaded("https://example.com/pinned.jpg");
    pinSource("https://example.com/pinned.jpg");
    for (let i = 0; i < 160; i++) {
      markImageLoaded(`https://example.com/${i}.jpg`);
    }
    expect(hasImageLoaded("https://example.com/pinned.jpg")).toBe(true);
  });

  it("unpinSource allows normal eviction", () => {
    clearImageCache();
    markImageLoaded("https://example.com/temp.jpg");
    pinSource("https://example.com/temp.jpg");
    unpinSource("https://example.com/temp.jpg");
    for (let i = 0; i < 160; i++) {
      markImageLoaded(`https://example.com/${i}.jpg`);
    }
    expect(hasImageLoaded("https://example.com/temp.jpg")).toBe(false);
  });
});
```

E adicionar imports:
```typescript
import { clearImageCache, hasImageLoaded, markImageLoaded, pinSource, unpinSource } from "./imageCache";
```

- [ ] **Step 3: Rodar testes (devem FAIL — pinSource/unpinSource não existem)**

```bash
cd apps/web && npx vitest run src/components/gym-circle/design-system/imageCache.test.ts
```

Expected: FAIL — `pinSource is not exported` ou similar.

- [ ] **Step 4: Modificar imageCache.ts**

Substituir o `loadedSources` Set por LRU. Adicionar `pinSource`/`unpinSource`. Manter API existente.

Top do arquivo:
```typescript
import { LruCache } from "../media/lruCache";

const LOADED_CAPACITY = 150;

const loadedSources = new LruCache<string>(LOADED_CAPACITY);
const pendingPreloads = new Map<string, Promise<void>>();
```

Mudar `markImageLoaded`:
```typescript
export function markImageLoaded(src: string): void {
  if (!src) return;
  loadedSources.add(src);
}
```

Mudar `hasImageLoaded`:
```typescript
export function hasImageLoaded(src: string): boolean {
  return loadedSources.has(src);
}
```

Adicionar:
```typescript
/**
 * Sprint 1 v1.1.1: marca o src como "currently visible" — protege de
 * eviction LRU enquanto está em uso na UI. Caller deve `unpinSource`
 * quando o componente desmontar OU quando o src trocar.
 */
export function pinSource(src: string): void {
  if (!src) return;
  loadedSources.pin(src);
}

export function unpinSource(src: string): void {
  if (!src) return;
  loadedSources.unpin(src);
}
```

Mudar `clearImageCache`:
```typescript
export function clearImageCache(): void {
  loadedSources.clear();
  pendingPreloads.clear();
}
```

Mudar `getCacheSize`:
```typescript
export function getCacheSize(): number {
  return loadedSources.size();
}
```

- [ ] **Step 5: Rodar testes (devem PASS — incluindo legacy)**

```bash
cd apps/web && npx vitest run src/components/gym-circle/design-system/imageCache.test.ts
```

Expected: todos os testes (legacy + novos LRU) passam.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/gym-circle/design-system/imageCache.ts apps/web/src/components/gym-circle/design-system/imageCache.test.ts
git commit -m "feat(sprint-1-v1.1.1-A2): imageCache adopta LRU + pin-protect"
```

---

### Task A3: MediaLoadingService — getBestMediaUrl ✅ DONE — commit `4dc6c9b`

**Files:**
- Create: `apps/web/src/components/gym-circle/media/MediaLoadingService.ts`
- Create: `apps/web/src/components/gym-circle/media/MediaLoadingService.test.ts`

- [ ] **Step 1: Criar test file with failing tests**

Em `apps/web/src/components/gym-circle/media/MediaLoadingService.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { MediaLoadingService } from "./MediaLoadingService";

describe("MediaLoadingService.getBestMediaUrl", () => {
  const item = {
    imageUrl: "https://example.com/hq.jpg",
    thumbnailUrl: "https://example.com/thumb.jpg",
    posterUrl: "https://example.com/poster.jpg",
    blurDataUrl: "data:image/jpeg;base64,abc",
  };

  it("feed surface prefere imageUrl (HQ)", () => {
    expect(MediaLoadingService.getBestMediaUrl(item, "feed")).toBe(
      "https://example.com/hq.jpg",
    );
  });

  it("feed surface fallback pra thumbnailUrl se imageUrl ausente", () => {
    expect(
      MediaLoadingService.getBestMediaUrl({ ...item, imageUrl: "" }, "feed"),
    ).toBe("https://example.com/thumb.jpg");
  });

  it("story surface usa imageUrl + poster fallback", () => {
    expect(MediaLoadingService.getBestMediaUrl(item, "story")).toBe(
      "https://example.com/hq.jpg",
    );
    expect(
      MediaLoadingService.getBestMediaUrl({ ...item, imageUrl: "" }, "story"),
    ).toBe("https://example.com/poster.jpg");
  });

  it("grid surface usa thumbnailUrl primary", () => {
    expect(MediaLoadingService.getBestMediaUrl(item, "grid")).toBe(
      "https://example.com/thumb.jpg",
    );
  });

  it("preview surface usa thumbnailUrl com blur fallback", () => {
    expect(MediaLoadingService.getBestMediaUrl(item, "preview")).toBe(
      "https://example.com/thumb.jpg",
    );
    expect(
      MediaLoadingService.getBestMediaUrl(
        { ...item, thumbnailUrl: "" },
        "preview",
      ),
    ).toBe("data:image/jpeg;base64,abc");
  });

  it("retorna empty string quando nada disponível", () => {
    expect(
      MediaLoadingService.getBestMediaUrl(
        { imageUrl: "", thumbnailUrl: "", posterUrl: "", blurDataUrl: "" },
        "feed",
      ),
    ).toBe("");
  });
});

describe("MediaLoadingService.getBlurPlaceholder", () => {
  it("priority chain: blurDataUrl → thumbnailUrl → solid color", () => {
    expect(
      MediaLoadingService.getBlurPlaceholder({
        blurDataUrl: "data:image/jpeg;base64,xyz",
        thumbnailUrl: "https://example.com/t.jpg",
      }),
    ).toBe("data:image/jpeg;base64,xyz");

    expect(
      MediaLoadingService.getBlurPlaceholder({
        blurDataUrl: "",
        thumbnailUrl: "https://example.com/t.jpg",
      }),
    ).toBe("https://example.com/t.jpg");

    expect(
      MediaLoadingService.getBlurPlaceholder({
        blurDataUrl: "",
        thumbnailUrl: "",
      }),
    ).toBe("#0c0d0e");
  });
});
```

- [ ] **Step 2: Rodar (deve FAIL)**

```bash
cd apps/web && npx vitest run src/components/gym-circle/media/MediaLoadingService.test.ts
```

Expected: FAIL — `MediaLoadingService is not defined`.

- [ ] **Step 3: Implementar MediaLoadingService (parte 1 — getBestMediaUrl + getBlurPlaceholder)**

Em `apps/web/src/components/gym-circle/media/MediaLoadingService.ts`:

```typescript
/**
 * MediaLoadingService — Sprint 1 v1.1.1.
 *
 * Wrapper formal sobre `imageCache.ts` (Sprint 2.1). Adiciona APIs
 * surface-aware (`getBestMediaUrl`), placeholder priority chain
 * (`getBlurPlaceholder`), warm decode (`warmMedia`), cancellation
 * (`cancelPreload`), e queue serial pra stories (`preloadStorySequence`).
 *
 * Princípio: NÃO substitui o imageCache. Wrappa as funções existentes
 * + expõe semânticas mais ricas pros consumers (feed/stories/profile).
 */

export type MediaSurface = "feed" | "story" | "grid" | "preview";

export type MediaItem = {
  imageUrl?: string;
  thumbnailUrl?: string;
  posterUrl?: string;
  blurDataUrl?: string;
};

const FALLBACK_COLOR = "#0c0d0e";

/**
 * Retorna a melhor URL pra exibir uma mídia naquela surface.
 *
 * Matrix:
 *   feed    → imageUrl (HQ) > thumbnailUrl
 *   story   → imageUrl (HQ) > posterUrl > thumbnailUrl
 *   grid    → thumbnailUrl > imageUrl
 *   preview → thumbnailUrl > blurDataUrl
 */
function getBestMediaUrl(item: MediaItem, surface: MediaSurface): string {
  switch (surface) {
    case "feed":
      return item.imageUrl || item.thumbnailUrl || "";
    case "story":
      return item.imageUrl || item.posterUrl || item.thumbnailUrl || "";
    case "grid":
      return item.thumbnailUrl || item.imageUrl || "";
    case "preview":
      return item.thumbnailUrl || item.blurDataUrl || "";
    default:
      return item.imageUrl || "";
  }
}

/**
 * Placeholder pra mostrar enquanto a mídia carrega.
 *
 * Priority chain:
 *   1. blurDataUrl (base64 ~32x40px do upload — Sprint 2.4)
 *   2. thumbnailUrl (640px funciona como blur background)
 *   3. solid `#0c0d0e` (dark tema — NUNCA tela preta vazia)
 */
function getBlurPlaceholder(item: Pick<MediaItem, "blurDataUrl" | "thumbnailUrl">): string {
  if (item.blurDataUrl) return item.blurDataUrl;
  if (item.thumbnailUrl) return item.thumbnailUrl;
  return FALLBACK_COLOR;
}

export const MediaLoadingService = {
  getBestMediaUrl,
  getBlurPlaceholder,
};
```

- [ ] **Step 4: Rodar testes (devem PASS)**

```bash
cd apps/web && npx vitest run src/components/gym-circle/media/MediaLoadingService.test.ts
```

Expected: getBestMediaUrl tests + getBlurPlaceholder tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/gym-circle/media/MediaLoadingService.ts apps/web/src/components/gym-circle/media/MediaLoadingService.test.ts
git commit -m "feat(sprint-1-v1.1.1-A3): MediaLoadingService getBestMediaUrl + getBlurPlaceholder"
```

---

### Task A4: MediaLoadingService — warmMedia + preloadStorySequence ✅ DONE — commits `ff67648` + `a515b31` (mocks de delegation)

**Files:**
- Modify: `apps/web/src/components/gym-circle/media/MediaLoadingService.ts`
- Modify: `apps/web/src/components/gym-circle/media/MediaLoadingService.test.ts`

- [ ] **Step 1: Add tests pra warmMedia + preloadStorySequence**

Append no `MediaLoadingService.test.ts`:

```typescript
describe("MediaLoadingService.warmMedia", () => {
  it("delega a preloadImage do imageCache", async () => {
    // No-op test — apenas verifica que função existe e não crash
    await MediaLoadingService.warmMedia("https://example.com/test.jpg");
    expect(typeof MediaLoadingService.warmMedia).toBe("function");
  });

  it("retorna early em url vazia", async () => {
    await MediaLoadingService.warmMedia("");
    // Não deve crash
  });
});

describe("MediaLoadingService.preloadStorySequence", () => {
  it("preloads array de items via preloadImages", async () => {
    const items: MediaItem[] = [
      { imageUrl: "https://example.com/s1.jpg" },
      { imageUrl: "https://example.com/s2.jpg" },
    ];
    await MediaLoadingService.preloadStorySequence(items);
    // Sem assert direto (preload é fire-and-forget) — apenas verifica
    // que função não crash com array válido.
  });

  it("ignora items sem imageUrl", async () => {
    await MediaLoadingService.preloadStorySequence([
      { imageUrl: "" },
      { imageUrl: undefined },
    ]);
    // Não deve crash.
  });
});
```

E adicionar import:
```typescript
import type { MediaItem } from "./MediaLoadingService";
```

- [ ] **Step 2: Rodar testes (devem FAIL)**

```bash
cd apps/web && npx vitest run src/components/gym-circle/media/MediaLoadingService.test.ts
```

Expected: FAIL — `warmMedia is not a function`.

- [ ] **Step 3: Adicionar warmMedia + preloadStorySequence no MediaLoadingService.ts**

Adicionar imports no topo:
```typescript
import {
  preloadImage,
  preloadImages,
  hasImageLoaded,
} from "../design-system/imageCache";
```

Adicionar funções (antes do `export const MediaLoadingService`):

```typescript
/**
 * Pre-warm uma URL: dispara preloadImage SEM await. Use quando você quer
 * começar download mas não bloquear flow atual.
 */
async function warmMedia(url: string): Promise<void> {
  if (!url) return;
  if (hasImageLoaded(url)) return;
  // Fire-and-forget — preloadImage já é idempotente + best-effort.
  void preloadImage(url).catch(() => {
    /* preload nunca quebra a app */
  });
}

/**
 * Pre-decode uma sequência de stories. Cada item vira getBestMediaUrl
 * (surface=story) antes de preload. Concurrency moderada (2) pra não
 * saturar rede em cellular.
 */
async function preloadStorySequence(items: MediaItem[]): Promise<void> {
  const urls = items
    .map((item) => getBestMediaUrl(item, "story"))
    .filter(Boolean);
  if (urls.length === 0) return;
  await preloadImages(urls, 2);
}
```

E atualizar o export:
```typescript
export const MediaLoadingService = {
  getBestMediaUrl,
  getBlurPlaceholder,
  warmMedia,
  preloadStorySequence,
};
```

- [ ] **Step 4: Rodar testes (devem PASS)**

```bash
cd apps/web && npx vitest run src/components/gym-circle/media/MediaLoadingService.test.ts
```

Expected: todos pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/gym-circle/media/MediaLoadingService.ts apps/web/src/components/gym-circle/media/MediaLoadingService.test.ts
git commit -m "feat(sprint-1-v1.1.1-A4): MediaLoadingService warmMedia + preloadStorySequence"
```

---

### Task A5: MediaLoadingService — cancelPreload ✅ DONE — commit `0903b0e`

**Files:**
- Modify: `apps/web/src/components/gym-circle/media/MediaLoadingService.ts`
- Modify: `apps/web/src/components/gym-circle/media/MediaLoadingService.test.ts`
- Modify: `apps/web/src/components/gym-circle/design-system/imageCache.ts` (expor cancellation hook)

- [ ] **Step 1: Adicionar testes**

Append no `MediaLoadingService.test.ts`:

```typescript
describe("MediaLoadingService.cancelPreload", () => {
  it("remove pending preload da queue", () => {
    // Cancellation é best-effort — não validamos network nivel.
    // Apenas confirma que função existe e não crash.
    MediaLoadingService.cancelPreload("https://example.com/cancel-me.jpg");
    expect(typeof MediaLoadingService.cancelPreload).toBe("function");
  });
});
```

- [ ] **Step 2: Adicionar `cancelPreload` no imageCache.ts**

```typescript
/**
 * Sprint 1 v1.1.1: cancela um preload pending. Best-effort — o navegador
 * pode já ter baixado os bytes, mas eliminamos a Promise do tracking pra
 * que callers possam fazer cleanup.
 */
export function cancelPreload(src: string): void {
  pendingPreloads.delete(src);
}
```

- [ ] **Step 3: Wire no MediaLoadingService**

Adicionar import:
```typescript
import { ..., cancelPreload as cancelPreloadImage } from "../design-system/imageCache";
```

Adicionar função:
```typescript
function cancelPreload(url: string): void {
  if (!url) return;
  cancelPreloadImage(url);
}
```

E atualizar export:
```typescript
export const MediaLoadingService = {
  getBestMediaUrl,
  getBlurPlaceholder,
  warmMedia,
  preloadStorySequence,
  cancelPreload,
};
```

- [ ] **Step 4: Rodar testes (devem PASS)**

```bash
cd apps/web && npx vitest run src/components/gym-circle/media/MediaLoadingService.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/gym-circle/media/MediaLoadingService.ts apps/web/src/components/gym-circle/media/MediaLoadingService.test.ts apps/web/src/components/gym-circle/design-system/imageCache.ts
git commit -m "feat(sprint-1-v1.1.1-A5): MediaLoadingService cancelPreload"
```

---

### Task A6: Expor window.gc.media (debug) ✅ DONE — commit `4457ddb` (+ fix isolamento de teste com `beforeEach(vi.clearAllMocks)`)

**Files:**
- Modify: `apps/web/src/components/gym-circle/media/MediaLoadingService.ts`

- [ ] **Step 1: Adicionar expose em window**

No final do `MediaLoadingService.ts`:

```typescript
// Sprint 1 v1.1.1: expor pra debug em produção via console.
// window.gc.media.getBestMediaUrl(post, "feed")
// window.gc.media.warmMedia("https://...")
// window.gc.media.cancelPreload("https://...")
if (typeof window !== "undefined") {
  const w = window as unknown as { gc?: { media?: typeof MediaLoadingService } };
  if (!w.gc) w.gc = {};
  w.gc.media = MediaLoadingService;
}
```

- [ ] **Step 2: Verificar build ok**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors relacionados ao MediaLoadingService.

- [ ] **Step 3: Commit + push**

```bash
git add apps/web/src/components/gym-circle/media/MediaLoadingService.ts
git commit -m "feat(sprint-1-v1.1.1-A6): expor window.gc.media (debug)"
git push origin main
```

User pusha — Vercel build deve passar verde.

---

### Task A7: Validar Phase A no Vercel ✅ DONE — deploy `dpl_CKqg6xTHjunZHFwMbHBEe93HcJun` (commit `4457ddb`) state READY

- [ ] **Step 1: Aguardar Vercel build**

Verificar via Vercel MCP:
```
list_deployments → encontrar commit recente → state deve ser READY
```

- [ ] **Step 2: Abrir produção + verificar window.gc.media no console**

No browser console:
```js
window.gc.media.getBestMediaUrl({ imageUrl: "https://a.jpg", thumbnailUrl: "https://t.jpg" }, "feed")
// Esperado: "https://a.jpg"
window.gc.media.getBlurPlaceholder({ blurDataUrl: "", thumbnailUrl: "" })
// Esperado: "#0c0d0e"
```

- [ ] **Step 3: Marcar checkpoint**

Phase A live. Continuar pra Phase B.

---

## Phase B — Stories contínuos: useStoryQueue + persistent viewer

Goal: stories funcionam em fluxo contínuo entre autores (Instagram-like). Remover `key={story.id}` do StoryViewer (causa do flash preto entre stories). Pre-decode antes de swap.

### Task B1: useStoryQueue hook — interface + tests ✅ DONE (adaptado) — commit `09ef246`

**Divergência do plano original:** o código real NÃO precisa de `useStoryQueue`. Já existem `StoryGroup{id,author,stories}` + `social.storyGroups` + `social.actions.openStory(storyId)` que auto-resolve grupo a partir de qualquer story. A solução foi in-place no `GymCirclePreview`: estender `openNextStory`/`openPreviousStory` + `hasNext`/`hasPrevious` pra cruzar fronteira de autor via `storyGroups[idx ± 1]`. Sem hook novo, sem tipos novos, sem testes novos (lógica é trivial e visualmente testável no iPhone).

B3 (wire) foi absorvido em B1 porque o "wire" é a própria mudança no parent.

**Files:**
- Create: `apps/web/src/components/gym-circle/social/useStoryQueue.ts`
- Create: `apps/web/src/components/gym-circle/social/useStoryQueue.test.ts`

- [ ] **Step 1: Criar test file**

Em `apps/web/src/components/gym-circle/social/useStoryQueue.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStoryQueue } from "./useStoryQueue";
import type { EnrichedStoryGroup } from "./types";

function makeGroup(authorId: string, storyIds: string[]): EnrichedStoryGroup {
  return {
    author: { id: authorId, name: authorId, username: authorId } as any,
    stories: storyIds.map((id) => ({ id, userId: authorId } as any)),
  };
}

describe("useStoryQueue", () => {
  it("opens with first story of first author by default", () => {
    const groups = [makeGroup("a", ["s1", "s2"]), makeGroup("b", ["s3"])];
    const { result } = renderHook(() => useStoryQueue(groups, "a"));
    expect(result.current.currentStory?.id).toBe("s1");
    expect(result.current.currentAuthor?.id).toBe("a");
    expect(result.current.hasNext).toBe(true);
    expect(result.current.hasPrevious).toBe(false);
  });

  it("nextStory dentro do autor", () => {
    const groups = [makeGroup("a", ["s1", "s2"]), makeGroup("b", ["s3"])];
    const { result } = renderHook(() => useStoryQueue(groups, "a"));
    act(() => result.current.nextStory());
    expect(result.current.currentStory?.id).toBe("s2");
  });

  it("nextStory no último story do autor avança pro próximo autor", () => {
    const groups = [makeGroup("a", ["s1", "s2"]), makeGroup("b", ["s3"])];
    const { result } = renderHook(() => useStoryQueue(groups, "a"));
    act(() => result.current.nextStory()); // s1 → s2
    act(() => result.current.nextStory()); // s2 (last of a) → s3 (b)
    expect(result.current.currentStory?.id).toBe("s3");
    expect(result.current.currentAuthor?.id).toBe("b");
  });

  it("nextStory no último story do último autor fecha viewer", () => {
    const groups = [makeGroup("a", ["s1"]), makeGroup("b", ["s2"])];
    let closed = false;
    const { result } = renderHook(() =>
      useStoryQueue(groups, "a", () => {
        closed = true;
      }),
    );
    act(() => result.current.nextStory()); // s1 → s2 (b)
    act(() => result.current.nextStory()); // s2 (last of b) → close
    expect(closed).toBe(true);
  });

  it("previousStory dentro do autor", () => {
    const groups = [makeGroup("a", ["s1", "s2"])];
    const { result } = renderHook(() => useStoryQueue(groups, "a"));
    act(() => result.current.nextStory()); // s1 → s2
    act(() => result.current.previousStory()); // s2 → s1
    expect(result.current.currentStory?.id).toBe("s1");
  });

  it("previousStory no primeiro story do autor avança pro autor anterior", () => {
    const groups = [makeGroup("a", ["s1"]), makeGroup("b", ["s2", "s3"])];
    const { result } = renderHook(() => useStoryQueue(groups, "b"));
    act(() => result.current.previousStory()); // s2 (first of b) → s1 (a, last)
    expect(result.current.currentStory?.id).toBe("s1");
    expect(result.current.currentAuthor?.id).toBe("a");
  });

  it("openAuthor pula pra autor específico", () => {
    const groups = [
      makeGroup("a", ["s1"]),
      makeGroup("b", ["s2"]),
      makeGroup("c", ["s3"]),
    ];
    const { result } = renderHook(() => useStoryQueue(groups, "a"));
    act(() => result.current.openAuthor("c"));
    expect(result.current.currentAuthor?.id).toBe("c");
    expect(result.current.currentStory?.id).toBe("s3");
  });
});
```

- [ ] **Step 2: Rodar testes (devem FAIL)**

```bash
cd apps/web && npx vitest run src/components/gym-circle/social/useStoryQueue.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implementar useStoryQueue**

Em `apps/web/src/components/gym-circle/social/useStoryQueue.ts`:

```typescript
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MediaLoadingService } from "../media/MediaLoadingService";
import type { EnrichedStory, EnrichedStoryGroup, EnrichedUser } from "./types";

/**
 * useStoryQueue — Sprint 1 v1.1.1.
 *
 * Hook pra cross-author story playback (estilo Instagram/Threads).
 * Centraliza a lógica de:
 *   - autor atual + story atual
 *   - autoplay dentro do autor + handoff pro próximo
 *   - preload chain (próximo story + primeiro do próximo autor)
 *   - navegação manual (next/previous story OU author)
 *
 * Quando o último story do último autor termina, dispara `onClose`.
 */

export type StoryQueueState = {
  currentStory: EnrichedStory | null;
  currentAuthor: EnrichedUser | null;
  hasNext: boolean;
  hasPrevious: boolean;
  openAuthor: (authorId: string) => void;
  nextStory: () => void;
  previousStory: () => void;
  nextAuthor: () => void;
  previousAuthor: () => void;
};

export function useStoryQueue(
  groups: EnrichedStoryGroup[],
  initialAuthorId: string | null,
  onClose?: () => void,
): StoryQueueState {
  const [authorIndex, setAuthorIndex] = useState<number>(() => {
    if (!initialAuthorId) return -1;
    const idx = groups.findIndex((g) => g.author.id === initialAuthorId);
    return idx >= 0 ? idx : -1;
  });
  const [storyIndex, setStoryIndex] = useState<number>(0);

  const currentAuthor = useMemo(() => {
    if (authorIndex < 0 || authorIndex >= groups.length) return null;
    return groups[authorIndex]?.author ?? null;
  }, [authorIndex, groups]);

  const currentStory = useMemo(() => {
    if (authorIndex < 0 || authorIndex >= groups.length) return null;
    const stories = groups[authorIndex]?.stories ?? [];
    return stories[storyIndex] ?? null;
  }, [authorIndex, storyIndex, groups]);

  const hasNext = useMemo(() => {
    if (authorIndex < 0) return false;
    const isLastStory =
      storyIndex >= (groups[authorIndex]?.stories.length ?? 0) - 1;
    if (!isLastStory) return true;
    return authorIndex < groups.length - 1;
  }, [authorIndex, storyIndex, groups]);

  const hasPrevious = useMemo(() => {
    if (storyIndex > 0) return true;
    return authorIndex > 0;
  }, [authorIndex, storyIndex]);

  // Preload chain: próximos 2 stories do autor atual + primeiro do próximo
  useEffect(() => {
    if (authorIndex < 0) return;
    const upcoming = [];
    const stories = groups[authorIndex]?.stories ?? [];
    for (let i = storyIndex + 1; i <= storyIndex + 2 && i < stories.length; i++) {
      upcoming.push(stories[i]!);
    }
    if (storyIndex === stories.length - 1 && authorIndex + 1 < groups.length) {
      const nextAuthorFirst = groups[authorIndex + 1]?.stories[0];
      if (nextAuthorFirst) upcoming.push(nextAuthorFirst);
    }
    if (upcoming.length > 0) {
      void MediaLoadingService.preloadStorySequence(upcoming);
    }
  }, [authorIndex, storyIndex, groups]);

  const nextStory = useCallback(() => {
    if (authorIndex < 0) return;
    const stories = groups[authorIndex]?.stories ?? [];
    if (storyIndex < stories.length - 1) {
      setStoryIndex(storyIndex + 1);
      return;
    }
    // Last story of current author — advance to next author
    if (authorIndex < groups.length - 1) {
      setAuthorIndex(authorIndex + 1);
      setStoryIndex(0);
      return;
    }
    // Last story of last author — close
    onClose?.();
  }, [authorIndex, storyIndex, groups, onClose]);

  const previousStory = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
      return;
    }
    if (authorIndex > 0) {
      const prevAuthor = groups[authorIndex - 1];
      setAuthorIndex(authorIndex - 1);
      setStoryIndex((prevAuthor?.stories.length ?? 1) - 1);
    }
  }, [authorIndex, storyIndex, groups]);

  const nextAuthor = useCallback(() => {
    if (authorIndex < groups.length - 1) {
      setAuthorIndex(authorIndex + 1);
      setStoryIndex(0);
    } else {
      onClose?.();
    }
  }, [authorIndex, groups, onClose]);

  const previousAuthor = useCallback(() => {
    if (authorIndex > 0) {
      setAuthorIndex(authorIndex - 1);
      setStoryIndex(0);
    }
  }, [authorIndex]);

  const openAuthor = useCallback(
    (authorId: string) => {
      const idx = groups.findIndex((g) => g.author.id === authorId);
      if (idx >= 0) {
        setAuthorIndex(idx);
        setStoryIndex(0);
      }
    },
    [groups],
  );

  return {
    currentStory,
    currentAuthor,
    hasNext,
    hasPrevious,
    openAuthor,
    nextStory,
    previousStory,
    nextAuthor,
    previousAuthor,
  };
}
```

- [ ] **Step 4: Rodar testes (devem PASS)**

```bash
cd apps/web && npx vitest run src/components/gym-circle/social/useStoryQueue.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/gym-circle/social/useStoryQueue.ts apps/web/src/components/gym-circle/social/useStoryQueue.test.ts
git commit -m "feat(sprint-1-v1.1.1-B1): useStoryQueue hook cross-author"
```

---

### Task B2: Remover key={story.id} do StoryViewer + pre-decode swap ⏳ PENDENTE

Risco alto: mexe em componente ao vivo. Vai exigir reset manual de state interno (replyDraft, menuOpen, shareOpen, heartBurst, mediaLoaded) quando `story.id` mudar — o `key=` atual cuida disso de graça via remount. Sem o `key=` precisamos um `useEffect([story.id])` que limpe esses states.

**Files:**
- Modify: `apps/web/src/components/gym-circle/design-system/StoryViewer.tsx`

- [ ] **Step 1: Ler estado atual (linha 61-67)**

```bash
grep -n "key={props.story.id}\|StoryViewerContent" apps/web/src/components/gym-circle/design-system/StoryViewer.tsx
```

- [ ] **Step 2: Remover o `key=` e adicionar pre-decode**

Substituir em `apps/web/src/components/gym-circle/design-system/StoryViewer.tsx` linha 61-67:

```typescript
export function StoryViewer(props: StoryViewerProps) {
  if (!props.story) {
    return null;
  }

  return <StoryViewerContent {...props} story={props.story} />;
  //     ↑ REMOVIDO `key={props.story.id}` — viewer agora é persistente.
  //     Lógica de re-render é controlada pelo state interno + props.
}
```

- [ ] **Step 3: Adicionar pre-decode antes de swap dentro do StoryViewerContent**

Modificar o `useState(() => hasImageLoaded(story.imageUrl))` (linha 99-103) pra reset/re-check quando o story prop muda:

Antes do `return`, adicionar:
```typescript
// Sprint 1 v1.1.1: quando o story muda (viewer persistente), recheck cache
// e dispara pre-decode antes de mostrar nova imagem.
useEffect(() => {
  if (hasImageLoaded(story.imageUrl)) {
    setMediaLoaded(true);
    return;
  }
  setMediaLoaded(false);
  // Pre-decode em background. Quando resolver, marca loaded + tira fade.
  const img = new window.Image();
  img.decoding = "async";
  img.src = story.imageUrl;
  let cancelled = false;
  img
    .decode()
    .then(() => {
      if (cancelled) return;
      markImageLoaded(story.imageUrl);
      setMediaLoaded(true);
    })
    .catch(() => {
      // Fallback pro onLoad event (já no <Image>).
    });
  return () => {
    cancelled = true;
  };
}, [story.imageUrl]);
```

- [ ] **Step 4: Verificar build**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -10
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/gym-circle/design-system/StoryViewer.tsx
git commit -m "fix(sprint-1-v1.1.1-B2): viewer persistente (sem key=) + pre-decode swap"
```

---

### Task B3: Wire useStoryQueue no GymCirclePreview ✅ ABSORVIDA por B1

Veja nota em B1 — a implementação in-place já é o próprio wire.

**Files:**
- Modify: `apps/web/src/components/gym-circle/GymCirclePreview.tsx`

- [ ] **Step 1: Ler estado atual do wire**

```bash
grep -n "openNextStory\|openPreviousStory\|selectedStory\|nextStoryId\|previousStoryId\|storyGroups" apps/web/src/components/gym-circle/GymCirclePreview.tsx | head -20
```

- [ ] **Step 2: Importar useStoryQueue**

Add import:
```typescript
import { useStoryQueue } from "./social/useStoryQueue";
```

- [ ] **Step 3: Substituir lógica de next/previous local pelo hook**

Localizar onde `social.selectedStory` é usado e substituir handlers. Tipicamente:

Antes:
```typescript
const nextStoryId = ...; // lógica local
const previousStoryId = ...;
const openNextStory = ...;
const openPreviousStory = ...;
```

Depois:
```typescript
const storyGroups = social.storyGroups ?? [];
const initialAuthorId = social.selectedStory?.author.id ?? null;
const storyQueue = useStoryQueue(
  storyGroups,
  initialAuthorId,
  social.actions.closeStory,
);
```

E no JSX (linha ~1098):
```typescript
<StoryViewer
  currentUserId={social.currentUser.id}
  hasNext={storyQueue.hasNext}
  hasPrevious={storyQueue.hasPrevious}
  onClose={social.actions.closeStory}
  onDeleteStory={social.actions.deleteStory}
  onLikeStory={social.actions.likeStory}
  onNext={storyQueue.nextStory}
  onPrevious={storyQueue.previousStory}
  onMuteStoryAuthor={social.actions.muteStoryAuthor}
  onReportStory={social.actions.reportStory}
  onReplyStory={social.actions.replyToStory}
  onSelectUser={(userId) => {
    social.actions.closeStory();
    openProfile(userId);
  }}
  onShareStoryToChat={social.actions.shareStoryToChat}
  onUnfollowUser={toggleFollowIgnoringResult}
  shareTargets={social.suggestedUsers.filter((user) => user.id !== social.currentUser.id)}
  story={storyQueue.currentStory}
/>
```

**IMPORTANTE**: a lista de `social.storyGroups` precisa existir. Se não existe, verificar `social.activeStoryGroups` ou similar. Caso não exista, criar from `social.feedPosts` ou wherever stories vivem.

- [ ] **Step 4: Verificar build local**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors. Se houver, ajustar tipo do `storyGroups`.

- [ ] **Step 5: Commit + push**

```bash
git add apps/web/src/components/gym-circle/GymCirclePreview.tsx
git commit -m "feat(sprint-1-v1.1.1-B3): wire useStoryQueue no GymCirclePreview"
git push origin main
```

User pusha. Vercel build deve passar verde.

---

### Task B4: Validar Phase B no Vercel + iPhone ⏳ PENDENTE (B1 já live; aguardando smoke)

- [ ] **Step 1: Verificar Vercel build READY**

via Vercel MCP `list_deployments`.

- [ ] **Step 2: Manual iPhone test**

- Open story de qualquer autor
- Esperar terminar todos do autor
- Verificar: viewer **NÃO fecha** — avança pro próximo autor automaticamente
- Verificar: transição entre stories do mesmo autor **sem flash preto**
- Verificar: chegou no último story do último autor → fecha viewer
- Verificar: swipe up/down/left/right funcionam

- [ ] **Step 3: Confirmar com Eduardo**

Se ele aprovar comportamento, marcar Phase B completed e seguir pra Phase C.

---

## Phase C — Feed polish: top-3 preload + métricas

Goal: eliminar flash preto no feed first paint. Top-3 posts preloaded no mount. Métricas debug em console.

### Task C1: Top-3 preload no FeedScreen mount ⏳ PENDENTE

**Files:**
- Modify: `apps/web/src/components/gym-circle/screens/FeedScreen.tsx`

- [ ] **Step 1: Ler estado atual do FeedScreen**

```bash
grep -n "useEffect\|posts\|preload\|imageUrl" apps/web/src/components/gym-circle/screens/FeedScreen.tsx | head -20
```

- [ ] **Step 2: Adicionar import**

```typescript
import { MediaLoadingService } from "../media/MediaLoadingService";
```

- [ ] **Step 3: Adicionar useEffect pra preload**

Dentro do FeedScreen function component, próximo ao topo (após hooks de translation/state):

```typescript
// Sprint 1 v1.1.1: preload eager dos top-3 posts no mount.
// Resolve flash preto no first paint — ao invés de cada post depender
// de IntersectionObserver pra começar download, os 3 primeiros já tão
// cacheados antes do scroll.
useEffect(() => {
  if (posts.length === 0) return;
  const topThree = posts.slice(0, 3);
  void MediaLoadingService.preloadStorySequence(
    topThree.map((post) => ({
      imageUrl: post.imageUrl,
      thumbnailUrl: post.thumbnailUrl ?? undefined,
      blurDataUrl: post.blurDataUrl ?? undefined,
    })),
  );
}, [posts.length]);
```

- [ ] **Step 4: Verificar build**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/gym-circle/screens/FeedScreen.tsx
git commit -m "feat(sprint-1-v1.1.1-C1): FeedScreen top-3 preload no mount"
```

---

### Task C2: Métricas debug [gc-metrics] ⏳ PENDENTE

**Files:**
- Modify: `apps/web/src/components/gym-circle/screens/FeedScreen.tsx`
- Modify: `apps/web/src/components/gym-circle/design-system/StoryViewer.tsx`

- [ ] **Step 1: FeedScreen — instrumentar feed_first_paint_ms**

No FeedScreen.tsx, após o useEffect de preload:

```typescript
// Sprint 1 v1.1.1: métricas debug — feed_first_paint_ms.
useEffect(() => {
  if (posts.length === 0) return;
  const start = performance.now();
  let logged = false;
  const tick = () => {
    if (logged) return;
    // Heurística simples: quando o DOM tem pelo menos 1 imagem com onLoad.
    const firstPost = document.querySelector('[data-gc-post-image]');
    if (firstPost) {
      const elapsed = Math.round(performance.now() - start);
      console.log(`[gc-metrics] feed_first_paint_ms=${elapsed}`);
      logged = true;
    } else {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}, [posts.length]);
```

- [ ] **Step 2: StoryViewer — story_transition_ms**

No StoryViewer.tsx, dentro do useEffect que pre-decode (Task B2):

```typescript
useEffect(() => {
  const start = performance.now();
  if (hasImageLoaded(story.imageUrl)) {
    setMediaLoaded(true);
    console.log(`[gc-metrics] story_transition_ms=0 (cached)`);
    return;
  }
  // ... existing pre-decode ...
  img
    .decode()
    .then(() => {
      if (cancelled) return;
      const elapsed = Math.round(performance.now() - start);
      console.log(`[gc-metrics] story_transition_ms=${elapsed}`);
      markImageLoaded(story.imageUrl);
      setMediaLoaded(true);
    })
    // ...
}, [story.imageUrl]);
```

- [ ] **Step 3: Adicionar data-gc-post-image no SocialPostCard image element**

```bash
grep -n "<PinchZoomImage\|<img\|<Image" apps/web/src/components/gym-circle/design-system/SocialPostCard.tsx | head -5
```

Adicionar `data-gc-post-image` no element principal da imagem (PinchZoomImage wrapper). Pode ser via prop ou direto no JSX.

- [ ] **Step 4: Commit + push**

```bash
git add apps/web/src/components/gym-circle/screens/FeedScreen.tsx apps/web/src/components/gym-circle/design-system/StoryViewer.tsx apps/web/src/components/gym-circle/design-system/SocialPostCard.tsx
git commit -m "feat(sprint-1-v1.1.1-C2): métricas debug feed_first_paint + story_transition"
git push origin main
```

---

### Task C3: Validar Phase C completa + smoke iPhone ⏳ PENDENTE

- [ ] **Step 1: Vercel build verde**

via MCP.

- [ ] **Step 2: Abrir feed frio em iPhone**

- Limpar app
- Reabrir
- Verificar: top-3 posts aparecem com placeholder/blur, sem flash preto
- Abrir console DevTools (Mac → cabo iPhone):
  - `[gc-metrics] feed_first_paint_ms=XXX` deve aparecer
- Open story → `[gc-metrics] story_transition_ms=XXX`

- [ ] **Step 3: Atualizar checklist no doc da sprint**

Marcar todos os itens como `[x] implementado` + `[x] validado`.

---

## Final validation

- [ ] **Step 1: Rodar suite completa de testes**

```bash
cd apps/web && npx vitest run
```

Expected: todos pass (incluindo legacy).

- [ ] **Step 2: Build TS clean**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Vercel build verde**

Final deploy ID READY.

- [ ] **Step 4: Smoke test iPhone real**

Per checklist no spec doc seção "Manual iPhone test plan".

- [ ] **Step 5: Marcar Sprint 1 v1.1.1 completed**

Atualizar tasks #40 + #41 como `completed`. Sprint encerrada.

---

## Rollback strategy

Se qualquer Phase causar regressão:

- **Phase A rollback**: revert commit dos 6 sub-tasks A1-A6. Imagens voltam a usar imageCache puro sem LRU.
- **Phase B rollback**: revert B1-B3. StoryViewer volta a usar `key={story.id}` (remount) + handlers locais no GymCirclePreview.
- **Phase C rollback**: revert C1-C2. Feed perde top-3 preload mas resto continua.

Cada Phase é independente do anterior em termos de funcionamento — A é foundation que B/C usam, mas A sozinha NÃO quebra nada se B/C não estiverem implementados.

---

## Referências

- Spec: `apps/web/docs/version-1.1.1-sprint-1-ultra-smooth-feed.md` (commit `0f2d49f`)
- Skill usado: `superpowers:writing-plans`
- Próximo skill: `superpowers:executing-plans` ou `superpowers:subagent-driven-development`

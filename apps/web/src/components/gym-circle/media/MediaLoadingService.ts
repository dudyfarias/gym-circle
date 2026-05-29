/**
 * MediaLoadingService — Sprint 1 v1.1.1.
 *
 * Wrapper formal sobre imageCache.ts (Sprint 2.1). Adiciona APIs
 * surface-aware (getBestMediaUrl), placeholder priority chain
 * (getBlurPlaceholder). Outras funções (warmMedia, preloadStorySequence,
 * cancelPreload) vêm nas tasks A4-A5.
 */

import { preloadImage, preloadImages, hasImageLoaded, cancelPreload as cancelPreloadImage } from "../design-system/imageCache";

export type MediaSurface = "feed" | "story" | "grid" | "preview";

export type MediaItem = {
  imageUrl?: string;
  thumbnailUrl?: string;
  posterUrl?: string;
  blurDataUrl?: string;
};

const FALLBACK_COLOR = "#0c0d0e";

/**
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
 * Priority chain:
 *   1. blurDataUrl (base64 ~32x40px gerado no upload — Sprint 2.4)
 *   2. thumbnailUrl (640px funciona como blur background)
 *   3. solid #0c0d0e (dark tema — NUNCA tela preta vazia)
 */
function getBlurPlaceholder(item: Pick<MediaItem, "blurDataUrl" | "thumbnailUrl">): string {
  if (item.blurDataUrl) return item.blurDataUrl;
  if (item.thumbnailUrl) return item.thumbnailUrl;
  return FALLBACK_COLOR;
}

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
 * (surface=story) antes de preload. Concurrency 2 pra não saturar rede em cellular.
 */
async function preloadStorySequence(items: MediaItem[]): Promise<void> {
  const urls = items
    .map((item) => getBestMediaUrl(item, "story"))
    .filter(Boolean);
  if (urls.length === 0) return;
  await preloadImages(urls, 2);
}

/**
 * Cancela preload pending. Best-effort (browser pode já ter baixado bytes).
 */
function cancelPreload(url: string): void {
  if (!url) return;
  cancelPreloadImage(url);
}

export const MediaLoadingService = {
  getBestMediaUrl,
  getBlurPlaceholder,
  warmMedia,
  preloadStorySequence,
  cancelPreload,
};

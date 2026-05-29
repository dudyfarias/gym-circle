/**
 * MediaLoadingService — Sprint 1 v1.1.1.
 *
 * Wrapper formal sobre imageCache.ts (Sprint 2.1). Adiciona APIs
 * surface-aware (getBestMediaUrl), placeholder priority chain
 * (getBlurPlaceholder). Outras funções (warmMedia, preloadStorySequence,
 * cancelPreload) vêm nas tasks A4-A5.
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

export const MediaLoadingService = {
  getBestMediaUrl,
  getBlurPlaceholder,
};

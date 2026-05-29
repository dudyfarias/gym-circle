import { describe, expect, it, vi } from "vitest";
import { MediaLoadingService } from "./MediaLoadingService";
import type { MediaItem } from "./MediaLoadingService";

// Sprint 1 v1.1.1 A4: mocks pra verificar delegation real ao imageCache.
// Sem isso, tests de warmMedia/preloadStorySequence passariam mesmo se
// as funções fossem no-ops — não validariam o contrato.
vi.mock("../design-system/imageCache", () => ({
  preloadImage: vi.fn(() => Promise.resolve()),
  preloadImages: vi.fn(() => Promise.resolve()),
  hasImageLoaded: vi.fn(() => false),
  cancelPreload: vi.fn(),
}));

describe("MediaLoadingService.getBestMediaUrl", () => {
  const item = {
    imageUrl: "https://example.com/hq.jpg",
    thumbnailUrl: "https://example.com/thumb.jpg",
    posterUrl: "https://example.com/poster.jpg",
    blurDataUrl: "data:image/jpeg;base64,abc",
  };

  it("feed surface prefere imageUrl (HQ)", () => {
    expect(MediaLoadingService.getBestMediaUrl(item, "feed")).toBe("https://example.com/hq.jpg");
  });

  it("feed surface fallback pra thumbnailUrl se imageUrl ausente", () => {
    expect(MediaLoadingService.getBestMediaUrl({ ...item, imageUrl: "" }, "feed")).toBe("https://example.com/thumb.jpg");
  });

  it("story surface usa imageUrl + poster fallback", () => {
    expect(MediaLoadingService.getBestMediaUrl(item, "story")).toBe("https://example.com/hq.jpg");
    expect(MediaLoadingService.getBestMediaUrl({ ...item, imageUrl: "" }, "story")).toBe("https://example.com/poster.jpg");
  });

  it("grid surface usa thumbnailUrl primary", () => {
    expect(MediaLoadingService.getBestMediaUrl(item, "grid")).toBe("https://example.com/thumb.jpg");
  });

  it("preview surface usa thumbnailUrl com blur fallback", () => {
    expect(MediaLoadingService.getBestMediaUrl(item, "preview")).toBe("https://example.com/thumb.jpg");
    expect(MediaLoadingService.getBestMediaUrl({ ...item, thumbnailUrl: "" }, "preview")).toBe("data:image/jpeg;base64,abc");
  });

  it("retorna empty string quando nada disponível", () => {
    expect(MediaLoadingService.getBestMediaUrl({ imageUrl: "", thumbnailUrl: "", posterUrl: "", blurDataUrl: "" }, "feed")).toBe("");
  });
});

describe("MediaLoadingService.getBlurPlaceholder", () => {
  it("priority chain: blurDataUrl > thumbnailUrl > solid color", () => {
    expect(MediaLoadingService.getBlurPlaceholder({ blurDataUrl: "data:image/jpeg;base64,xyz", thumbnailUrl: "https://example.com/t.jpg" })).toBe("data:image/jpeg;base64,xyz");
    expect(MediaLoadingService.getBlurPlaceholder({ blurDataUrl: "", thumbnailUrl: "https://example.com/t.jpg" })).toBe("https://example.com/t.jpg");
    expect(MediaLoadingService.getBlurPlaceholder({ blurDataUrl: "", thumbnailUrl: "" })).toBe("#0c0d0e");
  });
});

describe("MediaLoadingService.warmMedia", () => {
  it("delega para preloadImage com a url correta", async () => {
    const { preloadImage } = await import("../design-system/imageCache");
    vi.mocked(preloadImage).mockClear();
    await MediaLoadingService.warmMedia("https://example.com/test.jpg");
    // Fire-and-forget: dá um tick pra microtask resolver
    await new Promise((r) => setTimeout(r, 0));
    expect(preloadImage).toHaveBeenCalledWith("https://example.com/test.jpg");
  });

  it("retorna early em url vazia (NÃO chama preloadImage)", async () => {
    const { preloadImage } = await import("../design-system/imageCache");
    vi.mocked(preloadImage).mockClear();
    await MediaLoadingService.warmMedia("");
    await new Promise((r) => setTimeout(r, 0));
    expect(preloadImage).not.toHaveBeenCalled();
  });

  it("skip se hasImageLoaded retorna true", async () => {
    const { preloadImage, hasImageLoaded } = await import("../design-system/imageCache");
    vi.mocked(preloadImage).mockClear();
    vi.mocked(hasImageLoaded).mockReturnValueOnce(true);
    await MediaLoadingService.warmMedia("https://example.com/cached.jpg");
    await new Promise((r) => setTimeout(r, 0));
    expect(preloadImage).not.toHaveBeenCalled();
  });
});

describe("MediaLoadingService.preloadStorySequence", () => {
  it("chama preloadImages com URLs mapeadas + concurrency 2", async () => {
    const { preloadImages } = await import("../design-system/imageCache");
    vi.mocked(preloadImages).mockClear();
    const items: MediaItem[] = [
      { imageUrl: "https://example.com/s1.jpg" },
      { imageUrl: "https://example.com/s2.jpg" },
    ];
    await MediaLoadingService.preloadStorySequence(items);
    expect(preloadImages).toHaveBeenCalledWith(
      ["https://example.com/s1.jpg", "https://example.com/s2.jpg"],
      2,
    );
  });

  it("ignora items sem imageUrl (não chama preloadImages se array vazio)", async () => {
    const { preloadImages } = await import("../design-system/imageCache");
    vi.mocked(preloadImages).mockClear();
    await MediaLoadingService.preloadStorySequence([
      { imageUrl: "" },
      { imageUrl: undefined },
    ]);
    expect(preloadImages).not.toHaveBeenCalled();
  });
});

describe("MediaLoadingService.cancelPreload", () => {
  it("delega para cancelPreload do imageCache", async () => {
    const { cancelPreload } = await import("../design-system/imageCache");
    vi.mocked(cancelPreload).mockClear();
    MediaLoadingService.cancelPreload("https://example.com/cancel.jpg");
    expect(cancelPreload).toHaveBeenCalledWith("https://example.com/cancel.jpg");
  });

  it("retorna early em url vazia (NÃO chama imageCache.cancelPreload)", async () => {
    const { cancelPreload } = await import("../design-system/imageCache");
    vi.mocked(cancelPreload).mockClear();
    MediaLoadingService.cancelPreload("");
    expect(cancelPreload).not.toHaveBeenCalled();
  });
});

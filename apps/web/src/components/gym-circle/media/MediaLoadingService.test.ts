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

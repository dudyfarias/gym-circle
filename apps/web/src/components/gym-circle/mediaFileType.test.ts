import { describe, expect, it } from "vitest";
import { getMediaFileType, isSupportedMediaFile } from "./mediaFileType";

describe("media file detection", () => {
  it("recognizes iPhone HEIC photos even when the provider omits MIME", () => {
    expect(getMediaFileType({ name: "IMG_0042.HEIC", type: "" })).toBe("image");
  });

  it("recognizes videos by extension when MIME is missing", () => {
    expect(getMediaFileType({ name: "workout.MOV", type: "" })).toBe("video");
  });

  it("rejects unsupported files", () => {
    expect(isSupportedMediaFile({ name: "notes.pdf", type: "application/pdf" })).toBe(false);
  });
});

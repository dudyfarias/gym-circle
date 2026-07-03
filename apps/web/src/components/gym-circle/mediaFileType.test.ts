import { describe, expect, it } from "vitest";
import {
  assertMediaFileCanUpload,
  getMediaFileType,
  isSupportedMediaFile,
  MAX_MEDIA_FILE_BYTES,
} from "./mediaFileType";

describe("media file detection", () => {
  it("recognizes iPhone HEIC photos even when the provider omits MIME", () => {
    expect(getMediaFileType({ name: "IMG_0042.HEIC", type: "" })).toBe("image");
  });

  it("recognizes videos by extension when MIME is missing", () => {
    expect(getMediaFileType({ name: "workout.MOV", type: "" })).toBe("video");
  });

  it("rejects unsupported files", () => {
    expect(isSupportedMediaFile({ name: "notes.pdf", type: "application/pdf" })).toBe(false);
    expect(isSupportedMediaFile({ name: "vector.svg", type: "image/svg+xml" })).toBe(false);
  });

  it("accepts media up to exactly 1 GiB and rejects anything larger", () => {
    expect(() =>
      assertMediaFileCanUpload({
        name: "workout.mp4",
        type: "video/mp4",
        size: MAX_MEDIA_FILE_BYTES,
      }),
    ).not.toThrow();
    expect(() =>
      assertMediaFileCanUpload({
        name: "workout.mp4",
        type: "video/mp4",
        size: MAX_MEDIA_FILE_BYTES + 1,
      }),
    ).toThrow("no máximo 1 GB");
  });
});

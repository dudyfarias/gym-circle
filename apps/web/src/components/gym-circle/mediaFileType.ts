import type { PostMediaType } from "./social/types";

const IMAGE_EXTENSIONS = new Set([
  "avif",
  "heic",
  "heif",
  "jpeg",
  "jpg",
  "png",
  "webp",
]);
const VIDEO_EXTENSIONS = new Set(["m4v", "mov", "mp4", "webm"]);

function extensionOf(file: Pick<File, "name">) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

export function getMediaFileType(
  file: Pick<File, "name" | "type">,
): PostMediaType | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  const extension = extensionOf(file);
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  return null;
}

export function isSupportedMediaFile(file: Pick<File, "name" | "type">) {
  return getMediaFileType(file) !== null;
}

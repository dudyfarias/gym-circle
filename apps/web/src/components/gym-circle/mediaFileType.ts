import type { PostMediaType } from "./social/types";

export const MAX_MEDIA_FILE_BYTES = 1024 * 1024 * 1024;
export const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 6 * 1024 * 1024;

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  mp4: "video/mp4",
  webm: "video/webm",
};

export const ALLOWED_POST_MEDIA_MIME_TYPES = Object.freeze(
  Array.from(new Set(Object.values(MIME_BY_EXTENSION))),
);

const IMAGE_EXTENSIONS = new Set(
  Object.entries(MIME_BY_EXTENSION)
    .filter(([, mime]) => mime.startsWith("image/"))
    .map(([extension]) => extension),
);
const VIDEO_EXTENSIONS = new Set(
  Object.entries(MIME_BY_EXTENSION)
    .filter(([, mime]) => mime.startsWith("video/"))
    .map(([extension]) => extension),
);
const ALLOWED_MIME_TYPES = new Set(ALLOWED_POST_MEDIA_MIME_TYPES);

function extensionOf(file: Pick<File, "name">) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

export function getMediaFileType(
  file: Pick<File, "name" | "type">,
): PostMediaType | null {
  if (ALLOWED_MIME_TYPES.has(file.type)) {
    return file.type.startsWith("image/") ? "image" : "video";
  }
  const extension = extensionOf(file);
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  return null;
}

export function isSupportedMediaFile(file: Pick<File, "name" | "type">) {
  return getMediaFileType(file) !== null;
}

export function getMediaContentType(file: Pick<File, "name" | "type">) {
  if (ALLOWED_MIME_TYPES.has(file.type)) return file.type;
  return MIME_BY_EXTENSION[extensionOf(file)] ?? "application/octet-stream";
}

export function assertMediaFileCanUpload(
  file: Pick<File, "name" | "type" | "size">,
) {
  if (!isSupportedMediaFile(file)) {
    throw new Error(
      "Formato não suportado. Use JPEG, PNG, WebP, AVIF, HEIC, MP4, MOV, M4V ou WebM.",
    );
  }
  if (file.size > MAX_MEDIA_FILE_BYTES) {
    throw new Error("A mídia pode ter no máximo 1 GB.");
  }
  if (file.size <= 0) {
    throw new Error("O arquivo selecionado está vazio.");
  }
}

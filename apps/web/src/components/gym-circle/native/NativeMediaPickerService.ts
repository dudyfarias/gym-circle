"use client";

export type NativeMediaKind = "image" | "video";

export type NativeMediaResult = {
  file: File;
  kind: NativeMediaKind;
  webPath?: string | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
};

function extensionFor(format: string | undefined, kind: NativeMediaKind) {
  const normalized = (format || "").toLowerCase().replace("jpeg", "jpg");
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("mp4")) return "mp4";
  if (normalized.includes("mov") || normalized.includes("quicktime")) return "mov";
  return kind === "video" ? "mp4" : "jpg";
}

function mimeFor(format: string | undefined, kind: NativeMediaKind) {
  const ext = extensionFor(format, kind);
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "mov") return "video/quicktime";
  if (ext === "mp4") return "video/mp4";
  return "image/jpeg";
}

async function isNativeCapacitor() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function mediaResultToFile(
  media: {
    uri?: string;
    webPath?: string;
    metadata?: {
      duration?: number;
      format?: string;
      resolution?: string;
    };
  },
  kind: NativeMediaKind,
): Promise<NativeMediaResult | null> {
  // Sprint 14.1 — resolução robusta do arquivo. No WKWebView (iOS) `fetch` num
  // `file://` é BLOQUEADO; só `webPath` (capacitor://) ou
  // `Capacitor.convertFileSrc(uri)` são fetchables. O multi-select da galeria
  // às vezes devolve o item só com `uri` nativa → sem isso o fetch morria no
  // catch e nenhuma foto subia. Tenta os candidatos em ordem.
  const candidates: string[] = [];
  if (media.webPath) candidates.push(media.webPath);
  if (media.uri) {
    try {
      const { Capacitor } = await import("@capacitor/core");
      const converted = Capacitor.convertFileSrc(media.uri);
      if (converted && converted !== media.uri) candidates.push(converted);
    } catch {
      // sem @capacitor/core (web) — segue só com os que já temos.
    }
    candidates.push(media.uri);
  }
  if (candidates.length === 0) return null;

  let blob: Blob | null = null;
  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      blob = await response.blob();
      if (blob.size > 0) break;
      blob = null;
    } catch {
      // tenta o próximo candidato
    }
  }
  if (!blob) return null;

  try {
    const mimeType = blob.type || mimeFor(media.metadata?.format, kind);
    const ext = extensionFor(media.metadata?.format ?? mimeType, kind);
    const file = new File([blob], `gym-circle-${Date.now()}.${ext}`, {
      type: mimeType,
    });
    const [width, height] = (media.metadata?.resolution ?? "")
      .split("x")
      .map((part) => Number.parseInt(part, 10));
    return {
      file,
      kind,
      webPath: media.webPath ?? null,
      width: Number.isFinite(width) ? width : null,
      height: Number.isFinite(height) ? height : null,
      durationSeconds: media.metadata?.duration ?? null,
    };
  } catch {
    return null;
  }
}

async function runNativePicker(
  mode: "take-photo" | "capture-video" | "pick-photo" | "pick-video" | "pick-any",
): Promise<NativeMediaResult | null> {
  if (!(await isNativeCapacitor())) return null;

  try {
    const camera = await import("@capacitor/camera");
    // takePhoto/recordVideo são determinísticos no kind: o método já decide.
    // Só chooseFromGallery (mode "pick-*") precisa inspecionar media.type
    // contra o enum MediaType pra distinguir foto/vídeo.
    if (mode === "take-photo") {
      const media = await camera.Camera.takePhoto({
        quality: 88,
        saveToGallery: false,
        includeMetadata: true,
      });
      return mediaResultToFile(media, "image");
    }

    if (mode === "capture-video") {
      const media = await camera.Camera.recordVideo({
        saveToGallery: false,
        includeMetadata: true,
        isPersistent: false,
      });
      return mediaResultToFile(media, "video");
    }

    const mediaType =
      mode === "pick-photo"
        ? camera.MediaTypeSelection.Photo
        : mode === "pick-video"
          ? camera.MediaTypeSelection.Video
          : camera.MediaTypeSelection.All;
    const result = await camera.Camera.chooseFromGallery({
      mediaType,
      allowMultipleSelection: false,
      includeMetadata: true,
      quality: 88,
      presentationStyle: "fullscreen",
    });
    const first = result.results[0];
    if (!first) return null;
    // Compara contra o enum simbólico (MediaType.Video === 1 hoje, mas o
    // enum value pode mudar em versões futuras do plugin).
    const kind: NativeMediaKind =
      first.type === camera.MediaType.Video ? "video" : "image";
    return mediaResultToFile(first, kind);
  } catch {
    return null;
  }
}

/**
 * Sprint 13 — seleção MÚLTIPLA da galeria (carrossel). Foto+vídeo misturado.
 * Retorna todos os itens escolhidos (o caller capa em até 10). Web/PWA cai no
 * <input multiple> via fallback do composer.
 */
async function runNativePickerMultiple(): Promise<NativeMediaResult[]> {
  if (!(await isNativeCapacitor())) return [];
  try {
    const camera = await import("@capacitor/camera");
    const result = await camera.Camera.chooseFromGallery({
      mediaType: camera.MediaTypeSelection.All,
      allowMultipleSelection: true,
      includeMetadata: true,
      quality: 88,
      presentationStyle: "fullscreen",
    });
    const out: NativeMediaResult[] = [];
    for (const m of result.results ?? []) {
      const kind: NativeMediaKind =
        m.type === camera.MediaType.Video ? "video" : "image";
      const item = await mediaResultToFile(m, kind);
      if (item) out.push(item);
    }
    return out;
  } catch {
    return [];
  }
}

export const NativeMediaPickerService = {
  pickPhoto: () => runNativePicker("pick-photo"),
  pickVideo: () => runNativePicker("pick-video"),
  pickWorkoutMedia: () => runNativePicker("pick-any"),
  pickWorkoutMediaMultiple: () => runNativePickerMultiple(),
  takePhoto: () => runNativePicker("take-photo"),
  captureVideo: () => runNativePicker("capture-video"),
  normalizeMediaResult: mediaResultToFile,
  // Sprint 12.3 — o caller precisa distinguir "não-nativo" (cai no <input>
  // HTML) de "nativo que retornou null = cancelou/negou" (NÃO deve abrir o
  // input HTML — causa race + deadlock de apresentação no WKWebView iOS).
  isNativePlatform: isNativeCapacitor,
};

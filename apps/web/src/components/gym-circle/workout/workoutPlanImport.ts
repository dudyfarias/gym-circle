"use client";

import {
  parseWorkoutPlanText,
  type ParsedWorkoutPlan,
} from "./workoutPlanParser";

const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
const MAX_PDF_PAGES = 12;
const MAX_IMAGE_EDGE = 2600;

export type WorkoutPlanImportProgress = {
  phase: "reading" | "extracting" | "recognizing" | "parsing";
  progress: number;
};

export class WorkoutPlanImportError extends Error {
  constructor(
    public readonly code:
      | "unsupported"
      | "too_large"
      | "empty"
      | "unreadable",
  ) {
    super(code);
    this.name = "WorkoutPlanImportError";
  }
}

function emit(
  callback: ((progress: WorkoutPlanImportProgress) => void) | undefined,
  phase: WorkoutPlanImportProgress["phase"],
  progress: number,
) {
  callback?.({ phase, progress: Math.max(0, Math.min(1, progress)) });
}

async function canvasBlob(
  canvas: HTMLCanvasElement,
  type = "image/jpeg",
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas_blob_failed"))),
      type,
      type === "image/jpeg" ? 0.9 : undefined,
    );
  });
}

function otsuThreshold(histogram: Uint32Array, pixelCount: number): number {
  let total = 0;
  for (let value = 0; value < 256; value += 1) {
    total += value * histogram[value];
  }
  let backgroundWeight = 0;
  let backgroundTotal = 0;
  let bestVariance = -1;
  let bestThreshold = 160;
  for (let value = 0; value < 256; value += 1) {
    backgroundWeight += histogram[value];
    if (backgroundWeight === 0) continue;
    const foregroundWeight = pixelCount - backgroundWeight;
    if (foregroundWeight === 0) break;
    backgroundTotal += value * histogram[value];
    const backgroundMean = backgroundTotal / backgroundWeight;
    const foregroundMean = (total - backgroundTotal) / foregroundWeight;
    const variance =
      backgroundWeight *
      foregroundWeight *
      (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      bestThreshold = value;
    }
  }
  return Math.max(75, Math.min(220, bestThreshold));
}

function removeTableLines(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const horizontalRows: number[] = [];
  for (let y = 0; y < height; y += 1) {
    let dark = 0;
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4] === 0) dark += 1;
    }
    if (dark / width >= 0.55) horizontalRows.push(y);
  }
  for (const y of horizontalRows) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      pixels[offset] = 255;
      pixels[offset + 1] = 255;
      pixels[offset + 2] = 255;
    }
  }

  const verticalColumns: number[] = [];
  for (let x = 0; x < width; x += 1) {
    let dark = 0;
    for (let y = 0; y < height; y += 1) {
      if (pixels[(y * width + x) * 4] === 0) dark += 1;
    }
    if (dark / height >= 0.55) verticalColumns.push(x);
  }
  for (const x of verticalColumns) {
    for (let y = 0; y < height; y += 1) {
      const offset = (y * width + x) * 4;
      pixels[offset] = 255;
      pixels[offset + 1] = 255;
      pixels[offset + 2] = 255;
    }
  }
}

async function normalizeImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    // Fotos de planilha costumam chegar com glifos muito pequenos. Ampliar
    // antes do OCR preserva "4x12", que era lido como "EXE" nas amostras.
    const scale = Math.min(
      3,
      MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", {
      alpha: false,
      willReadFrequently: true,
    });
    if (!context) throw new Error("canvas_context_failed");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const histogram = new Uint32Array(256);
    let luminanceTotal = 0;
    const pixelCount = canvas.width * canvas.height;
    for (let offset = 0; offset < image.data.length; offset += 4) {
      const luminance = Math.round(
        image.data[offset] * 0.299 +
          image.data[offset + 1] * 0.587 +
          image.data[offset + 2] * 0.114,
      );
      histogram[luminance] += 1;
      luminanceTotal += luminance;
    }

    const invert = luminanceTotal / pixelCount < 145;
    const normalizedHistogram = new Uint32Array(256);
    for (let value = 0; value < 256; value += 1) {
      normalizedHistogram[invert ? 255 - value : value] += histogram[value];
    }
    const threshold = otsuThreshold(normalizedHistogram, pixelCount);
    for (let offset = 0; offset < image.data.length; offset += 4) {
      const luminance = Math.round(
        image.data[offset] * 0.299 +
          image.data[offset + 1] * 0.587 +
          image.data[offset + 2] * 0.114,
      );
      const normalized = invert ? 255 - luminance : luminance;
      const value = normalized <= threshold ? 0 : 255;
      image.data[offset] = value;
      image.data[offset + 1] = value;
      image.data[offset + 2] = value;
      image.data[offset + 3] = 255;
    }
    removeTableLines(image.data, canvas.width, canvas.height);
    context.putImageData(image, 0, 0);
    return await canvasBlob(canvas, "image/png");
  } finally {
    bitmap.close();
  }
}

async function recognizeImages(
  images: Blob[],
  callback?: (progress: WorkoutPlanImportProgress) => void,
): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker(["por", "eng"], undefined, {
    logger(message) {
      if (message.status !== "recognizing text") return;
      emit(callback, "recognizing", message.progress);
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });
    const texts: string[] = [];
    for (let index = 0; index < images.length; index += 1) {
      const result = await worker.recognize(images[index]);
      texts.push(result.data.text);
      emit(callback, "recognizing", (index + 1) / images.length);
    }
    return texts.join("\n");
  } finally {
    await worker.terminate();
  }
}

async function extractPdf(
  file: File,
  callback?: (progress: WorkoutPlanImportProgress) => void,
): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const pdfDocument = await loadingTask.promise;
  const pageCount = Math.min(pdfDocument.numPages, MAX_PDF_PAGES);
  const textPages: string[] = [];
  const scannedPages: Blob[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      emit(callback, "extracting", (pageNumber - 1) / pageCount);
      const page = await pdfDocument.getPage(pageNumber);
      const content = await page.getTextContent();
      // pdf.js entrega tabelas como fragmentos posicionados. Agrupar pelo Y
      // preserva uma linha por exercício; achatar tudo em uma única string
      // faria o parser misturar o nome de uma linha com séries/reps de outra.
      const positionedRows: Array<{
        y: number;
        chunks: Array<{ x: number; text: string }>;
      }> = [];
      const fallbackChunks: string[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const transform =
          "transform" in item && Array.isArray(item.transform)
            ? item.transform
            : null;
        if (!transform || transform.length < 6) {
          fallbackChunks.push(`${item.str}${"hasEOL" in item && item.hasEOL ? "\n" : " "}`);
          continue;
        }
        const x = Number(transform[4]);
        const y = Number(transform[5]);
        let row = positionedRows.find((candidate) => Math.abs(candidate.y - y) <= 3);
        if (!row) {
          row = { y, chunks: [] };
          positionedRows.push(row);
        }
        row.chunks.push({ x, text: item.str });
      }
      const positionedText = positionedRows
        .sort((a, b) => b.y - a.y)
        .map((row) =>
          row.chunks
            .sort((a, b) => a.x - b.x)
            .map((chunk) => chunk.text)
            .join(" "),
        )
        .join("\n");
      const text = `${positionedText}\n${fallbackChunks.join("")}`
        .replace(/[ \t]+/g, " ")
        .replace(/ *\n */g, "\n")
        .trim();

      if (text.length >= 24) {
        textPages.push(text);
        page.cleanup();
        continue;
      }

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(
        2,
        MAX_IMAGE_EDGE / Math.max(baseViewport.width, baseViewport.height),
      );
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("canvas_context_failed");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      scannedPages.push(await canvasBlob(canvas));
      page.cleanup();
    }
  } finally {
    await pdfDocument.cleanup();
    await loadingTask.destroy();
  }

  emit(callback, "extracting", 1);
  if (scannedPages.length > 0) {
    textPages.push(await recognizeImages(scannedPages, callback));
  }
  return textPages.join("\n");
}

export async function importWorkoutPlanFile(
  file: File,
  callback?: (progress: WorkoutPlanImportProgress) => void,
): Promise<ParsedWorkoutPlan> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new WorkoutPlanImportError("too_large");
  }

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage =
    file.type.startsWith("image/") ||
    /\.(png|jpe?g|webp|heic|heif)$/i.test(file.name);
  if (!isPdf && !isImage) {
    throw new WorkoutPlanImportError("unsupported");
  }

  emit(callback, "reading", 0.05);
  let text = "";
  try {
    if (isPdf) {
      text = await extractPdf(file, callback);
    } else {
      const normalized = await normalizeImage(file);
      text = await recognizeImages([normalized], callback);
    }
  } catch (error) {
    if (error instanceof WorkoutPlanImportError) throw error;
    throw new WorkoutPlanImportError("unreadable");
  }

  if (!text.trim()) throw new WorkoutPlanImportError("empty");
  emit(callback, "parsing", 0.95);
  const parsed = parseWorkoutPlanText(text, file.name);
  emit(callback, "parsing", 1);
  if (parsed.exercises.length === 0) {
    throw new WorkoutPlanImportError("unreadable");
  }
  return parsed;
}

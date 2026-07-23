"use client";

import {
  parseRunningPlanImportText,
  type RunningPlanImportDraft,
} from "@gym-circle/core/domain";
import {
  extractWorkoutPlanFileText,
  type WorkoutPlanImportProgress,
} from "./workoutPlanImport";

async function sha256(value: BufferSource) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function importRunningPlanText(
  text: string,
): Promise<RunningPlanImportDraft> {
  return parseRunningPlanImportText(text, {
    sourceName: "pasted-text",
    sourceSha256: await sha256(new TextEncoder().encode(text)),
    sourceType: "text",
  });
}

export async function importRunningPlanFile(
  file: File,
  callback?: (progress: WorkoutPlanImportProgress) => void,
): Promise<RunningPlanImportDraft> {
  const [extracted, sourceImageSha256] = await Promise.all([
    extractWorkoutPlanFileText(file, callback),
    file.arrayBuffer().then(sha256),
  ]);
  return parseRunningPlanImportText(extracted.text, {
    sourceImageSha256:
      extracted.sourceType === "image" ? sourceImageSha256 : undefined,
    sourceName: file.name,
    sourceSha256: sourceImageSha256,
    sourceType: extracted.sourceType,
  });
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { errorMessage } from "./errorMessage";

type MediaTelemetryStatus = "started" | "succeeded" | "failed";

type MediaTelemetryEvent = {
  operation: string;
  stage: string;
  status: MediaTelemetryStatus;
  bucketId?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  durationMs?: number;
  error?: unknown;
  metadata?: Record<string, string | number | boolean | null>;
};

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { code?: unknown; statusCode?: unknown };
  const value = candidate.code ?? candidate.statusCode;
  return typeof value === "string" || typeof value === "number"
    ? String(value).slice(0, 80)
    : null;
}

/**
 * Telemetria operacional sem nome de arquivo, URL ou legenda. Ela nunca pode
 * interromper o fluxo principal: falha de observabilidade não vira falha de
 * publicação.
 */
export async function recordMediaPipelineEvent(
  client: SupabaseClient,
  event: MediaTelemetryEvent,
) {
  try {
    await client.from("media_pipeline_events").insert({
      operation: event.operation,
      stage: event.stage,
      status: event.status,
      bucket_id: event.bucketId ?? null,
      file_size_bytes: event.fileSizeBytes ?? null,
      mime_type: event.mimeType?.slice(0, 120) || null,
      duration_ms:
        typeof event.durationMs === "number"
          ? Math.max(0, Math.round(event.durationMs))
          : null,
      error_code: errorCode(event.error),
      error_message: event.error
        ? errorMessage(event.error, "Falha sem mensagem").slice(0, 500)
        : null,
      metadata: event.metadata ?? {},
    });
  } catch {
    // Best-effort by design.
  }
}

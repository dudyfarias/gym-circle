import type { SupabaseClient } from "@supabase/supabase-js";
import { Upload } from "tus-js-client";
import {
  getMediaContentType,
  MAX_MEDIA_FILE_BYTES,
  RESUMABLE_UPLOAD_THRESHOLD_BYTES,
} from "./mediaFileType";

const TUS_CHUNK_BYTES = 6 * 1024 * 1024;

export type MediaUploadProgress = {
  bytesUploaded: number;
  bytesTotal: number;
  percentage: number;
};

type UploadFileOptions = {
  client: SupabaseClient;
  bucket: string;
  path: string;
  file: File;
  onProgress?: (progress: MediaUploadProgress) => void;
};

function reportProgress(
  callback: UploadFileOptions["onProgress"],
  bytesUploaded: number,
  bytesTotal: number,
) {
  if (!callback) return;
  callback({
    bytesUploaded,
    bytesTotal,
    percentage:
      bytesTotal > 0
        ? Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100))
        : 0,
  });
}

function directStorageUrl(projectUrl: string) {
  try {
    const url = new URL(projectUrl);
    if (url.hostname.endsWith(".supabase.co")) {
      url.hostname = url.hostname.replace(".supabase.co", ".storage.supabase.co");
    }
    return url.origin;
  } catch {
    return projectUrl.replace(/\/+$/, "");
  }
}

async function resumableUpload({
  client,
  bucket,
  path,
  file,
  onProgress,
}: UploadFileOptions) {
  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) {
    throw new Error("Sua sessão expirou. Entre novamente para enviar a mídia.");
  }

  const projectUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    (client as SupabaseClient & { supabaseUrl?: string }).supabaseUrl;
  if (!projectUrl) {
    throw new Error("O endereço do Storage não está configurado.");
  }

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `${directStorageUrl(projectUrl)}/storage/v1/upload/resumable`,
      retryDelays: [0, 1_000, 3_000, 5_000, 10_000, 20_000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: TUS_CHUNK_BYTES,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: getMediaContentType(file),
        cacheControl: "3600",
      },
      onError: reject,
      onProgress: (bytesUploaded, bytesTotal) => {
        reportProgress(onProgress, bytesUploaded, bytesTotal);
      },
      onSuccess: () => {
        reportProgress(onProgress, file.size, file.size);
        resolve();
      },
    });
    upload.start();
  });
}

export async function uploadFileToStorage(options: UploadFileOptions) {
  const { client, bucket, path, file, onProgress } = options;
  if (file.size > MAX_MEDIA_FILE_BYTES) {
    throw new Error("A mídia pode ter no máximo 1 GB.");
  }
  if (file.size <= 0) {
    throw new Error("O arquivo selecionado está vazio.");
  }
  if (file.size > RESUMABLE_UPLOAD_THRESHOLD_BYTES) {
    await resumableUpload(options);
    return;
  }

  reportProgress(onProgress, 0, file.size);
  const { error } = await client.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    contentType: getMediaContentType(file),
    upsert: false,
  });
  if (error) throw error;
  reportProgress(onProgress, file.size, file.size);
}

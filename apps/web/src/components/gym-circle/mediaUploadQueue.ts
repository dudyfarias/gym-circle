export type MediaFileLike = {
  type: string;
};

/**
 * Vídeo mantém decoder + poster canvas + upload do arquivo original em memória.
 * No WKWebView do iPhone, processar vários ao mesmo tempo pode reiniciar o
 * processo inteiro. Fotos ficam limitadas a duas; qualquer lote com vídeo é
 * estritamente sequencial.
 */
export function getMediaUploadConcurrency(
  files: readonly MediaFileLike[],
): number {
  return files.some((file) => file.type.startsWith("video/")) ? 1 : 2;
}

/**
 * Equivalente ordenado de Promise.allSettled, mas com concorrência limitada.
 * Mantém o resultado na mesma posição da seleção original.
 */
export async function allSettledWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  if (items.length === 0) return [];

  const limit = Math.max(1, Math.min(Math.floor(concurrency), items.length));
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = {
          status: "fulfilled",
          value: await worker(items[index], index),
        };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
  return results;
}

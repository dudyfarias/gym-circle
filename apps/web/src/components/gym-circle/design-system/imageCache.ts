/**
 * Image cache & preload helpers — Sprint 2.1 (Native Feel).
 *
 * Estratégia:
 *
 * 1. `Set<string>` em memória global track quais src JÁ foram montados +
 *    decodificados nesta sessão da app. O navegador já cacheia bytes via
 *    HTTP cache; o que falta é marcar "decoded" pra que o GCImage pule
 *    o crossfade em re-mounts (sensação instant ao reabrir feed/stories).
 *
 * 2. `preloadImage(src)` cria um `<img>` off-screen + chama
 *    `Image.decode()`. Decode acontece em paralelo no idle do browser,
 *    então quando o elemento real montar, paint é imediato (zero flash).
 *
 * 3. `getPreloadCount(default)` consulta `navigator.connection`. Em rede
 *    lenta (2g/slow-2g) ou Save Data ON, reduz preload pra economizar
 *    bytes do user. Chrome/Edge/Samsung suportam; Safari ainda não — cai
 *    no default.
 *
 * Sem persistência cross-session (sem localStorage/IndexedDB). O navegador
 * mantém os bytes no HTTP cache; nosso `loadedSources` reset no reload
 * é OK — primeiro mount ainda vai dar fade-in suave (não preto).
 */

import { LruCache } from "../media/lruCache";

const LOADED_CAPACITY = 150;

const loadedSources = new LruCache<string>(LOADED_CAPACITY);
const pendingPreloads = new Map<string, Promise<void>>();

/**
 * Marca o src como já carregado/decodificado nesta sessão. Chamado pelo
 * `GCImage` no callback `onLoad`. Idempotente.
 */
export function markImageLoaded(src: string): void {
  if (!src) return;
  loadedSources.add(src);
}

/**
 * Sprint 1 v1.1.1: protege src de eviction LRU enquanto está visible.
 * Caller deve unpinSource quando o componente desmontar ou trocar src.
 */
export function pinSource(src: string): void {
  if (!src) return;
  loadedSources.pin(src);
}

export function unpinSource(src: string): void {
  if (!src) return;
  loadedSources.unpin(src);
}

/**
 * Retorna true se o src já foi mostrado/decodificado nesta sessão. O
 * `GCImage` usa isso pra inicializar com `loaded=true` (sem fade-in).
 */
export function hasImageLoaded(src: string): boolean {
  return loadedSources.has(src);
}

/**
 * Pre-fetch + pre-decode de uma imagem. Resolve quando o decode termina
 * (ou rejeita silenciosamente em erro — preload nunca quebra a app).
 *
 * Idempotente: chamadas paralelas pro mesmo src compartilham a mesma
 * Promise. Já-loaded skip imediato.
 */
export function preloadImage(src: string): Promise<void> {
  if (!src || typeof window === "undefined") return Promise.resolve();
  if (loadedSources.has(src)) return Promise.resolve();
  const existing = pendingPreloads.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve) => {
    const img = new window.Image();
    img.decoding = "async";
    img.src = src;

    const finish = () => {
      loadedSources.add(src);
      pendingPreloads.delete(src);
      resolve();
    };

    // `img.decode()` resolve quando a bitmap está pronta pra paint.
    // Fallback pro evento `load` se decode rejeitar (acontece em CORS/SVG).
    img
      .decode()
      .then(finish)
      .catch(() => {
        // Se decode falhou mas load funcionou, ainda marca como loaded —
        // o navegador já tem os bytes em cache.
        if (img.complete && img.naturalWidth > 0) {
          finish();
        } else {
          img.onload = finish;
          img.onerror = () => {
            pendingPreloads.delete(src);
            resolve(); // nunca rejeita — preload é best-effort
          };
        }
      });
  });

  pendingPreloads.set(src, promise);
  return promise;
}

/**
 * Pre-fetch de múltiplas imagens em paralelo. Útil pra carregar
 * thumbnails dos primeiros N posts do feed antes do user scrollar.
 *
 * `concurrency` limita quantas em paralelo pra não saturar a rede em
 * conexões fracas. Default 3 — bom equilíbrio em Wi-Fi normal.
 */
export async function preloadImages(
  srcs: ReadonlyArray<string>,
  concurrency = 3,
): Promise<void> {
  const queue = [...srcs].filter(Boolean);
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      await preloadImage(next);
    }
  });
  await Promise.all(workers);
}

type ConnectionLike = {
  effectiveType?: string;
  saveData?: boolean;
};

function getConnection(): ConnectionLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  // `connection` é experimental — não está nos tipos oficiais do DOM.
  const candidate = (navigator as unknown as { connection?: ConnectionLike })
    .connection;
  return candidate ?? undefined;
}

/**
 * Retorna quantos itens devemos pré-carregar baseado na conexão atual.
 * Heurística:
 *  - 2g/slow-2g/Save Data ON → 1 item (só o próximo, mínimo).
 *  - 3g → metade do default.
 *  - 4g/wifi/desconhecido → default completo.
 *
 * Caller passa o `defaultCount` (ex.: 3 pro feed inicial). O retorno
 * nunca é maior que o default.
 */
export function getPreloadCount(defaultCount: number): number {
  if (defaultCount <= 0) return 0;
  const conn = getConnection();
  if (!conn) return defaultCount; // Safari/iOS — default
  if (conn.saveData) return Math.min(1, defaultCount);
  const type = conn.effectiveType;
  if (type === "slow-2g" || type === "2g") return Math.min(1, defaultCount);
  if (type === "3g") return Math.max(1, Math.floor(defaultCount / 2));
  return defaultCount;
}

/**
 * Reset completo do cache. Chamado no logout pra evitar que avatares de
 * um user vazem na próxima sessão de outro user no mesmo device.
 */
export function clearImageCache(): void {
  loadedSources.clear();
  pendingPreloads.clear();
}

/**
 * Tamanho atual do cache (uso debug + métricas).
 */
export function getCacheSize(): number {
  return loadedSources.size();
}

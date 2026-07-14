export const WORKOUT_FINISH_TIMEOUT_MS = 20_000;

/**
 * Impede que uma falha de rede/RPC deixe a tela de treino bloqueada para
 * sempre. A finalização é idempotente por clientSessionId; se a resposta se
 * perder, a sessão local permanece e o usuário pode tentar novamente.
 */
export function finishWithTimeout<T>(
  request: Promise<T>,
  timeoutMs = WORKOUT_FINISH_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error("workout_finish_timeout"));
    }, timeoutMs);

    request.then(
      (value) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

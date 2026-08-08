/**
 * Move uma mídia de posição no carrossel.
 *
 * A ordem do array **é** a ordem do carrossel: a RPC grava `position` a partir
 * da ordinalidade (`entry.ordinality - 1`), então reordenar aqui não precisa de
 * nenhum campo de posição no cliente nem de mudança no banco.
 *
 * Índices inválidos (fora do intervalo) ou iguais são no-op — durante um
 * arrasto o ponteiro passa por fora da tira o tempo todo, e um índice
 * inventado não pode embaralhar as mídias da pessoa.
 *
 * Puro: devolve um array novo, nunca muta a entrada.
 */
export function moveMediaItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return items;
  if (from < 0 || from >= items.length) return items;
  if (to < 0 || to >= items.length) return items;

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

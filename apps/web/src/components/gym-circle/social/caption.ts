/**
 * Helpers de caption pro feed. Sprint 3 — Fase 3.2.
 *
 * Decisão arquitetural: truncamos por contagem de caracteres em vez de usar
 * CSS line-clamp puro. Razões:
 *
 * - line-clamp esconde texto mas não nos diz se cortou — o botão "mais"
 *   precisaria adivinhar via medição de DOM, frágil em iOS WebView.
 * - Contagem de chars é determinística, testável e suficiente em PT-BR.
 * - Cortamos no último espaço antes do limite pra não quebrar palavra nem
 *   `@mention` no meio (a `MentionText` ainda recebe string parsável).
 */
export const CAPTION_TRUNCATE_THRESHOLD = 140;

export function truncateCaptionText(text: string, max: number): string {
  if (text.length <= max) return text;
  const sub = text.slice(0, max);
  const lastSpace = sub.lastIndexOf(" ");
  return (lastSpace > 0 ? sub.slice(0, lastSpace) : sub).trimEnd();
}

export function isCaptionLong(
  text: string,
  threshold: number = CAPTION_TRUNCATE_THRESHOLD,
): boolean {
  return text.length > threshold;
}

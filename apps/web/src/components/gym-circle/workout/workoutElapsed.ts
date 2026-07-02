/**
 * Tempo decorrido do treino (rastreio de treino, Fase 1 — web enxuto).
 *
 * O cronômetro deriva SEMPRE de startedAt (epoch ms) → sobrevive a refresh
 * (startedAt persiste em localStorage) e não acumula drift de setInterval.
 */
export function elapsedSecondsSince(startedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
}

/** 3480 → "58:00" · 3723 → "1:02:03" · 61 → "1:01" */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}

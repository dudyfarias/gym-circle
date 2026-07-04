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

/**
 * Rastreio de treino (Fase 2 — GPS outdoor). Métricas de rota gravadas no
 * app nativo; o web só exibe. 5023 → "5,02 km".
 */
export function formatKm(meters: number): string {
  return `${(meters / 1000).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} km`;
}

/** Ritmo em s/km → "6:12 /km". */
export function formatPace(secPerKm: number): string {
  const s = Math.max(0, Math.round(secPerKm));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} /km`;
}

/**
 * Ritmo médio (s/km) a partir de distância (m) e tempo (s). null com dados
 * insuficientes (< 50 m) — evita ritmo maluco.
 */
export function paceFromDistance(
  meters: number,
  seconds: number,
): number | null {
  if (meters <= 50 || seconds <= 0) return null;
  return Math.round(seconds / (meters / 1000));
}

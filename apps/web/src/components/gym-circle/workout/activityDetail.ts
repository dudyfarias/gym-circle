export type ActivityRouteResolution = {
  route: number[][] | null;
  distanceM: number | null;
  distanceDerivedFromRoute: boolean;
};

export type ActivityTimeResolution = {
  startLabel: string | null;
  endLabel: string | null;
  rangeIsConsistent: boolean;
};

const EARTH_RADIUS_M = 6_371_000;

export function sanitizeActivityRoute(
  route: number[][] | null | undefined,
): number[][] | null {
  if (!Array.isArray(route)) return null;
  const valid = route.filter(
    (point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]) &&
      point[0] >= -90 &&
      point[0] <= 90 &&
      point[1] >= -180 &&
      point[1] <= 180,
  );
  return valid.length >= 2 ? valid : null;
}

function segmentDistanceM(first: number[], second: number[]) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(second[0] - first[0]);
  const longitudeDelta = toRadians(second[1] - first[1]);
  const firstLatitude = toRadians(first[0]);
  const secondLatitude = toRadians(second[0]);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    EARTH_RADIUS_M *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function distanceFromActivityRoute(route: number[][] | null | undefined) {
  const valid = sanitizeActivityRoute(route);
  if (!valid) return null;
  return valid.slice(1).reduce((total, point, index) => {
    const segment = segmentDistanceM(valid[index], point);
    // O detalhe só deriva segmentos plausíveis. Não corrige o banco e não
    // transforma saltos de GPS em distância visível.
    return Number.isFinite(segment) && segment >= 1 && segment <= 2_000
      ? total + segment
      : total;
  }, 0);
}

export function resolveActivityRoute(input: {
  route: number[][] | null | undefined;
  distanceM: number | null | undefined;
}): ActivityRouteResolution {
  const route = sanitizeActivityRoute(input.route);
  const persistedDistance =
    typeof input.distanceM === "number" &&
    Number.isFinite(input.distanceM) &&
    input.distanceM > 0
      ? input.distanceM
      : null;
  if (persistedDistance !== null) {
    return { route, distanceM: persistedDistance, distanceDerivedFromRoute: false };
  }
  const derivedDistance = distanceFromActivityRoute(route);
  return {
    route,
    distanceM:
      derivedDistance !== null && derivedDistance > 0 ? derivedDistance : null,
    distanceDerivedFromRoute: derivedDistance !== null && derivedDistance > 0,
  };
}

function safeDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatClock(date: Date, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

export function resolveActivityTime(input: {
  startedAt: string | null | undefined;
  endedAt: string | null | undefined;
  elapsedS: number;
  locale: string;
  timeZone: string;
}): ActivityTimeResolution {
  const start = safeDate(input.startedAt);
  const end = safeDate(input.endedAt);
  const startLabel = start
    ? formatClock(start, input.locale, input.timeZone)
    : null;
  const endLabel = end ? formatClock(end, input.locale, input.timeZone) : null;
  if (!start || !end || input.elapsedS <= 0) {
    return { startLabel, endLabel: null, rangeIsConsistent: false };
  }

  const wallClockS = Math.max(0, (end.getTime() - start.getTime()) / 1_000);
  // Tolera arredondamento, pequenas pausas e atraso de persistência, mas não
  // exibe um intervalo enganoso como 10:38–11:18 para um treino de 8:37.
  const toleranceS = Math.max(90, input.elapsedS * 0.2);
  const rangeIsConsistent = Math.abs(wallClockS - input.elapsedS) <= toleranceS;
  return {
    startLabel,
    endLabel: rangeIsConsistent ? endLabel : null,
    rangeIsConsistent,
  };
}

export function normalizedMovingSeconds(
  movingS: number | null | undefined,
  elapsedS: number,
) {
  if (typeof movingS !== "number" || !Number.isFinite(movingS) || movingS <= 0) {
    return null;
  }
  return Math.min(Math.max(0, Math.round(elapsedS)), Math.round(movingS));
}

export function normalizeActivitySource(input: {
  origin?: string | null;
  sourceApp?: string | null;
}) {
  const source = input.sourceApp?.trim() ?? "";
  if (input.origin !== "imported") return "gym_circle" as const;
  if (/apple\s*watch/i.test(source)) return "apple_watch" as const;
  if (/health|sa[uú]de/i.test(source)) return "apple_health" as const;
  return source ? ("external_app" as const) : ("imported" as const);
}

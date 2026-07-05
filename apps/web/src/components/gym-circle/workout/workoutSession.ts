import type { WebActivityInput } from "../social/types";

export const WORKOUT_STORAGE_KEY = "gc-web-workout";

export type WorkoutRoutePoint = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracyM?: number | null;
  altitudeAccuracyM?: number | null;
  timestampMs: number;
};

export type StoredWorkoutSession = {
  version: 3;
  startedAtMs: number;
  activityType: WebActivityInput["activityType"];
  pausedAtMs: number | null;
  pausedTotalMs: number;
  distanceM: number;
  movingS: number;
  elevationGainM: number;
  restCount: number;
  routePoints: WorkoutRoutePoint[];
  lastRoutePoint: WorkoutRoutePoint | null;
};

const MAX_ROUTE_POINTS = 1_500;
const ROUTE_POINT_SPACING_M = 10;

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

export function readStoredWorkoutSession(): StoredWorkoutSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WORKOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredWorkoutSession>;
    if (
      typeof parsed.startedAtMs !== "number" ||
      typeof parsed.activityType !== "string"
    ) {
      return null;
    }
    return {
      version: 3,
      startedAtMs: parsed.startedAtMs,
      activityType: parsed.activityType,
      pausedAtMs:
        typeof parsed.pausedAtMs === "number" ? parsed.pausedAtMs : null,
      pausedTotalMs: numberOr(parsed.pausedTotalMs, 0),
      distanceM: numberOr(parsed.distanceM, 0),
      movingS: numberOr(parsed.movingS, 0),
      elevationGainM: numberOr(parsed.elevationGainM, 0),
      restCount: Math.max(0, Math.floor(numberOr(parsed.restCount, 0))),
      routePoints: Array.isArray(parsed.routePoints)
        ? parsed.routePoints.filter(isValidRoutePoint)
        : [],
      lastRoutePoint: parsed.lastRoutePoint ?? null,
    } as StoredWorkoutSession;
  } catch {
    return null;
  }
}

export function writeStoredWorkoutSession(session: StoredWorkoutSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredWorkoutSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(WORKOUT_STORAGE_KEY);
}

export function hasStoredWorkoutSession() {
  return readStoredWorkoutSession() !== null;
}

export function workoutElapsedSeconds(
  session: StoredWorkoutSession,
  nowMs: number,
) {
  const livePauseMs = session.pausedAtMs
    ? Math.max(0, nowMs - session.pausedAtMs)
    : 0;
  return Math.max(
    0,
    Math.floor(
      (nowMs -
        session.startedAtMs -
        session.pausedTotalMs -
        livePauseMs) /
        1000,
    ),
  );
}

export function workoutPausedSeconds(
  session: StoredWorkoutSession,
  nowMs: number,
) {
  const livePauseMs = session.pausedAtMs
    ? Math.max(0, nowMs - session.pausedAtMs)
    : 0;
  return Math.max(
    0,
    Math.floor((session.pausedTotalMs + livePauseMs) / 1000),
  );
}

export function pauseWorkoutSession(
  session: StoredWorkoutSession,
  nowMs: number,
): StoredWorkoutSession {
  if (session.pausedAtMs !== null) return session;
  return { ...session, pausedAtMs: nowMs };
}

export function resumeWorkoutSession(
  session: StoredWorkoutSession,
  nowMs: number,
): StoredWorkoutSession {
  if (session.pausedAtMs === null) return session;
  return {
    ...session,
    pausedAtMs: null,
    // A primeira leitura depois da pausa vira uma nova âncora; o deslocamento
    // feito durante a pausa não entra na distância.
    lastRoutePoint: null,
    pausedTotalMs:
      session.pausedTotalMs + Math.max(0, nowMs - session.pausedAtMs),
  };
}

export function distanceBetweenRoutePoints(
  first: WorkoutRoutePoint,
  second: WorkoutRoutePoint,
) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusM = 6_371_000;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    earthRadiusM *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function isValidRoutePoint(value: unknown): value is WorkoutRoutePoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<WorkoutRoutePoint>;
  return (
    typeof point.latitude === "number" &&
    Number.isFinite(point.latitude) &&
    typeof point.longitude === "number" &&
    Number.isFinite(point.longitude) &&
    typeof point.timestampMs === "number" &&
    Number.isFinite(point.timestampMs)
  );
}

function withKeptRoutePoint(
  points: WorkoutRoutePoint[],
  point: WorkoutRoutePoint,
): WorkoutRoutePoint[] {
  const last = points.at(-1);
  if (last && distanceBetweenRoutePoints(last, point) < ROUTE_POINT_SPACING_M) {
    return points;
  }
  const next = [...points, point];
  if (next.length <= MAX_ROUTE_POINTS) return next;
  return next.filter((_, index) => index % 2 === 0);
}

function maximumSpeedMps(type: StoredWorkoutSession["activityType"]) {
  if (type === "ride") return 45;
  if (type === "run") return 12;
  return 8;
}

/**
 * Adiciona uma leitura GPS à sessão.
 *
 * A âncora só avança quando o deslocamento mínimo é atingido. Isso é
 * importante: atualizar a âncora a cada leitura de 0,5–1,9 m fazia uma
 * caminhada inteira desaparecer quando o GPS entregava pontos frequentes.
 */
export function appendWorkoutRoutePoint(
  session: StoredWorkoutSession,
  point: WorkoutRoutePoint,
): StoredWorkoutSession {
  if (!isValidRoutePoint(point)) return session;
  const accuracy = point.accuracyM;
  if (typeof accuracy === "number" && (accuracy <= 0 || accuracy > 50)) {
    return session;
  }

  const previous = session.lastRoutePoint;
  if (!previous) {
    return {
      ...session,
      routePoints: withKeptRoutePoint(session.routePoints, point),
      lastRoutePoint: point,
    };
  }

  const secondsBetween = (point.timestampMs - previous.timestampMs) / 1_000;
  if (secondsBetween <= 0) return session;
  if (secondsBetween >= 45) {
    return {
      ...session,
      routePoints: withKeptRoutePoint(session.routePoints, point),
      lastRoutePoint: point,
    };
  }

  const segmentM = distanceBetweenRoutePoints(previous, point);
  const averageAccuracy =
    ((previous.accuracyM ?? 8) + (point.accuracyM ?? 8)) / 2;
  const minimumSegmentM = Math.max(2, Math.min(6, averageAccuracy * 0.25));

  // Mantém a âncora anterior para que pequenos passos se acumulem.
  if (segmentM < minimumSegmentM) return session;

  const speedMps = segmentM / secondsBetween;
  if (speedMps > maximumSpeedMps(session.activityType)) {
    return {
      ...session,
      lastRoutePoint: point,
    };
  }

  const previousAltitudeAccuracy = previous.altitudeAccuracyM;
  const altitudeAccuracy = point.altitudeAccuracyM;
  const canUseAltitude =
    previous.altitude !== null &&
    point.altitude !== null &&
    typeof previousAltitudeAccuracy === "number" &&
    typeof altitudeAccuracy === "number" &&
    previousAltitudeAccuracy > 0 &&
    altitudeAccuracy > 0 &&
    previousAltitudeAccuracy <= 12 &&
    altitudeAccuracy <= 12;
  const elevationDelta = canUseAltitude
    ? (point.altitude ?? 0) - (previous.altitude ?? 0)
    : 0;
  const elevationNoiseFloor = canUseAltitude
    ? Math.max(3, ((previousAltitudeAccuracy ?? 0) + (altitudeAccuracy ?? 0)) / 2)
    : Number.POSITIVE_INFINITY;

  return {
    ...session,
    distanceM: session.distanceM + segmentM,
    movingS: session.movingS + (speedMps > 0.5 ? secondsBetween : 0),
    elevationGainM:
      session.elevationGainM +
      (elevationDelta > elevationNoiseFloor && elevationDelta < 30
        ? elevationDelta
        : 0),
    routePoints: withKeptRoutePoint(session.routePoints, point),
    lastRoutePoint: point,
  };
}

/** Polyline compacta para o Supabase, sempre incluindo o ponto final. */
export function workoutRouteCoordinates(
  session: StoredWorkoutSession,
): number[][] | null {
  const points = session.lastRoutePoint
    ? withKeptRoutePoint(session.routePoints, session.lastRoutePoint)
    : session.routePoints;
  if (points.length < 2 || session.distanceM < 30) return null;
  return points.map((point) => [
    Math.round(point.latitude * 100_000) / 100_000,
    Math.round(point.longitude * 100_000) / 100_000,
  ]);
}

export function formatDistance(distanceM: number) {
  return (Math.max(0, distanceM) / 1_000).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatAveragePace(elapsedS: number, distanceM: number) {
  if (distanceM < 50 || elapsedS <= 0) return "--";
  const secondsPerKm = Math.round(elapsedS / (distanceM / 1_000));
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = String(secondsPerKm % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function formatAverageSpeed(elapsedS: number, distanceM: number) {
  if (distanceM < 50 || elapsedS <= 0) return "--";
  return ((distanceM / 1_000) / (elapsedS / 3_600)).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

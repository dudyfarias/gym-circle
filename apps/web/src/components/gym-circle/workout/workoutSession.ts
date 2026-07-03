import type { WebActivityInput } from "../social/types";

export const WORKOUT_STORAGE_KEY = "gc-web-workout";

export type WorkoutRoutePoint = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestampMs: number;
};

export type StoredWorkoutSession = {
  version: 2;
  startedAtMs: number;
  activityType: WebActivityInput["activityType"];
  pausedAtMs: number | null;
  pausedTotalMs: number;
  distanceM: number;
  elevationGainM: number;
  restCount: number;
  lastRoutePoint: WorkoutRoutePoint | null;
};

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
      version: 2,
      startedAtMs: parsed.startedAtMs,
      activityType: parsed.activityType,
      pausedAtMs:
        typeof parsed.pausedAtMs === "number" ? parsed.pausedAtMs : null,
      pausedTotalMs: numberOr(parsed.pausedTotalMs, 0),
      distanceM: numberOr(parsed.distanceM, 0),
      elevationGainM: numberOr(parsed.elevationGainM, 0),
      restCount: Math.max(0, Math.floor(numberOr(parsed.restCount, 0))),
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

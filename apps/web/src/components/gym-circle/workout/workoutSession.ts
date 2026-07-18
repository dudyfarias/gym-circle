import type {
  StrengthSet,
  WebActivityInput,
  WorkoutPlanExercise,
} from "../social/types";
import {
  REST_TIMER_INITIAL,
  type RestTimerState,
} from "./restTimer";

/** Chave global v4, removida por segurança na primeira leitura autenticada. */
export const WORKOUT_STORAGE_KEY = "gc-web-workout";

export function workoutStorageKey(userId: string) {
  return `${WORKOUT_STORAGE_KEY}:${userId}`;
}

export function createWorkoutClientSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (value) => {
    const random = Math.floor(Math.random() * 16);
    const digit = value === "x" ? random : (random & 0x3) | 0x8;
    return digit.toString(16);
  });
}

export type WorkoutRoutePoint = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracyM?: number | null;
  altitudeAccuracyM?: number | null;
  timestampMs: number;
};

export type WorkoutRouteSnapshot = {
  distanceM: number;
  movingS: number;
  elevationGainM: number;
  route?: number[][];
};

/** Estado editável de uma série durante o treino. Campos `planned*` são só UI. */
export type LiveStrengthSet = StrengthSet & {
  clientId: string;
  plannedDurationSeconds?: number | null;
  plannedReps?: number | null;
};

/**
 * Cria a primeira série de um exercício incluído durante a sessão ativa.
 * O catálogo fornece somente metas; RPE, carga e conclusão continuam sendo
 * resultados reais preenchidos pela pessoa durante o treino.
 */
export function createAddedStrengthExerciseSet(input: {
  clientId: string;
  exerciseId: string;
  exerciseName: string;
  loadType: NonNullable<StrengthSet["loadType"]>;
  targetKind: NonNullable<StrengthSet["targetKind"]>;
  plannedReps?: number | null;
  plannedDurationSeconds?: number | null;
  targetRestS?: number | null;
}): LiveStrengthSet {
  return {
    clientId: input.clientId,
    setId: input.clientId,
    setStatus: "added",
    setOrigin: "added",
    loadType: input.loadType,
    reps: 0,
    weightKg: null,
    assistedWeightKg: null,
    exercise: input.exerciseName,
    exerciseId: input.exerciseId,
    targetKind: input.targetKind,
    durationSeconds: null,
    plannedReps: input.plannedReps ?? null,
    plannedRepsMin: input.plannedReps ?? null,
    plannedRepsMax: input.plannedReps ?? null,
    plannedDurationSeconds: input.plannedDurationSeconds ?? null,
    targetRestS: input.targetRestS ?? null,
  };
}

export type WorkoutSessionPlanContext = {
  id: string;
  name: string;
  exercisesSnapshot: WorkoutPlanExercise[];
  version: number;
  startedFrom: "saved_plan" | "suggested" | "duplicate";
};

/**
 * Séries até a falha só concluem pelo check explícito: preencher reps primeiro
 * não pode avançar antes de o usuário informar a carga opcional.
 */
export function shouldAutoCompleteStrengthSet(input: {
  reps: number;
  targetKind: LiveStrengthSet["targetKind"];
  weightKg: number | null;
  wasCompleted: boolean;
}): boolean {
  if (input.reps <= 0) return false;
  if (input.wasCompleted) return true;
  return input.targetKind !== "failure" && input.weightKg !== null;
}

export type StoredWorkoutSession = {
  version: 5;
  ownerUserId: string;
  clientSessionId: string;
  startedAtMs: number;
  activityType: WebActivityInput["activityType"];
  workoutPlan: WorkoutSessionPlanContext | null;
  pausedAtMs: number | null;
  pausedTotalMs: number;
  distanceM: number;
  movingS: number;
  elevationGainM: number;
  restCount: number;
  restTimer: RestTimerState;
  /** Série concluída à qual o descanso em andamento pertence. */
  restSetClientId: string | null;
  workoutNote: string;
  exerciseNotes: Record<string, string>;
  strengthSets: LiveStrengthSet[];
  completedStrengthSetIds: string[];
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

function readStoredStrengthSets(value: unknown): LiveStrengthSet[] {
  if (!Array.isArray(value)) return [];
  const usedClientIds = new Set<string>();
  return value.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const set = raw as Partial<LiveStrengthSet>;
    const targetKind =
      set.targetKind === "duration" || set.targetKind === "failure"
        ? set.targetKind
        : "reps";
    const preferredClientId =
      typeof set.clientId === "string" && set.clientId
        ? set.clientId
        : `restored-set-${index}`;
    const clientId = usedClientIds.has(preferredClientId)
      ? `${preferredClientId}-${index}`
      : preferredClientId;
    usedClientIds.add(clientId);
    return [
      {
        clientId,
        reps: Math.max(0, Math.round(numberOr(set.reps, 0))),
        weightKg:
          typeof set.weightKg === "number" &&
          Number.isFinite(set.weightKg) &&
          set.weightKg > 0
            ? set.weightKg
            : null,
        exercise: typeof set.exercise === "string" ? set.exercise : null,
        exerciseId:
          typeof set.exerciseId === "string" ? set.exerciseId : null,
        targetKind,
        durationSeconds:
          typeof set.durationSeconds === "number" &&
          Number.isFinite(set.durationSeconds) &&
          set.durationSeconds > 0
            ? Math.round(set.durationSeconds)
            : null,
        plannedDurationSeconds:
          typeof set.plannedDurationSeconds === "number" &&
          Number.isFinite(set.plannedDurationSeconds) &&
          set.plannedDurationSeconds > 0
            ? Math.round(set.plannedDurationSeconds)
            : null,
        plannedReps:
          typeof set.plannedReps === "number" &&
          Number.isFinite(set.plannedReps) &&
          set.plannedReps > 0
            ? Math.round(set.plannedReps)
            : null,
        techniqueId:
          typeof set.techniqueId === "string" ? set.techniqueId : null,
        techniqueName:
          typeof set.techniqueName === "string" ? set.techniqueName : null,
        techniqueNotes:
          typeof set.techniqueNotes === "string" ? set.techniqueNotes : null,
        setId: typeof set.setId === "string" ? set.setId : clientId,
        setIndex:
          typeof set.setIndex === "number" && Number.isFinite(set.setIndex)
            ? Math.max(1, Math.round(set.setIndex))
            : index + 1,
        setStatus:
          set.setStatus === "completed" ||
          set.setStatus === "skipped" ||
          set.setStatus === "added"
            ? set.setStatus
            : "planned",
        setOrigin: set.setOrigin === "added" ? "added" : "planned",
        loadType:
          set.loadType === "external" ||
          set.loadType === "bodyweight" ||
          set.loadType === "assisted"
            ? set.loadType
            : "not_provided",
        assistedWeightKg:
          typeof set.assistedWeightKg === "number" &&
          Number.isFinite(set.assistedWeightKg) &&
          set.assistedWeightKg > 0
            ? set.assistedWeightKg
            : null,
        bodyweightKgSnapshot:
          typeof set.bodyweightKgSnapshot === "number" &&
          Number.isFinite(set.bodyweightKgSnapshot) &&
          set.bodyweightKgSnapshot > 0
            ? set.bodyweightKgSnapshot
            : null,
        note: typeof set.note === "string" ? set.note : null,
        rpe:
          typeof set.rpe === "number" && set.rpe >= 1 && set.rpe <= 10
            ? set.rpe
            : null,
        rir:
          typeof set.rir === "number" && set.rir >= 0 && set.rir <= 10
            ? set.rir
            : null,
        targetRestS:
          typeof set.targetRestS === "number" && set.targetRestS >= 0
            ? Math.min(3_600, Math.round(set.targetRestS))
            : null,
        actualRestS:
          typeof set.actualRestS === "number" && set.actualRestS >= 0
            ? Math.min(7_200, Math.round(set.actualRestS))
            : null,
      },
    ];
  });
}

function readExerciseNotes(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, note]) =>
      typeof note === "string" && note.trim()
        ? [[key, note.slice(0, 1_000)]]
        : [],
    ),
  );
}

export function readStoredWorkoutSession(userId: string): StoredWorkoutSession | null {
  if (typeof window === "undefined") return null;
  try {
    // Não reivindica rascunhos v4 sem owner: isso poderia entregar o treino da
    // conta anterior à conta atual no mesmo aparelho.
    window.localStorage.removeItem(WORKOUT_STORAGE_KEY);
    const raw = window.localStorage.getItem(workoutStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredWorkoutSession>;
    if (
      parsed.version !== 5 ||
      parsed.ownerUserId !== userId ||
      typeof parsed.clientSessionId !== "string" ||
      typeof parsed.startedAtMs !== "number" ||
      typeof parsed.activityType !== "string"
    ) {
      window.localStorage.removeItem(workoutStorageKey(userId));
      return null;
    }
    const strengthSets = readStoredStrengthSets(parsed.strengthSets);
    const validStrengthSetIds = new Set(
      strengthSets.map((set) => set.clientId),
    );
    return {
      version: 5,
      ownerUserId: userId,
      clientSessionId: parsed.clientSessionId,
      startedAtMs: parsed.startedAtMs,
      activityType: parsed.activityType,
      workoutPlan: readWorkoutPlanContext(parsed.workoutPlan),
      pausedAtMs:
        typeof parsed.pausedAtMs === "number" ? parsed.pausedAtMs : null,
      pausedTotalMs: numberOr(parsed.pausedTotalMs, 0),
      distanceM: numberOr(parsed.distanceM, 0),
      movingS: numberOr(parsed.movingS, 0),
      elevationGainM: numberOr(parsed.elevationGainM, 0),
      restCount: Math.max(0, Math.floor(numberOr(parsed.restCount, 0))),
      restTimer:
        parsed.restTimer &&
        typeof parsed.restTimer.presetS === "number" &&
        typeof parsed.restTimer.remainingS === "number"
          ? {
              status:
                parsed.restTimer.status === "running" ||
                parsed.restTimer.status === "paused" ||
                parsed.restTimer.status === "done"
                  ? parsed.restTimer.status
                  : "idle",
              presetS: Math.max(5, Math.floor(parsed.restTimer.presetS)),
              remainingS: Math.max(
                0,
                Math.floor(parsed.restTimer.remainingS),
              ),
              endsAtMs:
                typeof parsed.restTimer.endsAtMs === "number"
                  ? parsed.restTimer.endsAtMs
                  : null,
            }
          : REST_TIMER_INITIAL,
      restSetClientId:
        typeof parsed.restSetClientId === "string" &&
        validStrengthSetIds.has(parsed.restSetClientId)
          ? parsed.restSetClientId
          : null,
      workoutNote:
        typeof parsed.workoutNote === "string"
          ? parsed.workoutNote.slice(0, 5_000)
          : "",
      exerciseNotes: readExerciseNotes(parsed.exerciseNotes),
      strengthSets,
      completedStrengthSetIds: Array.isArray(parsed.completedStrengthSetIds)
        ? Array.from(
            new Set(
              parsed.completedStrengthSetIds.filter(
                (value): value is string =>
                  typeof value === "string" && validStrengthSetIds.has(value),
              ),
            ),
          )
        : [],
      routePoints: Array.isArray(parsed.routePoints)
        ? parsed.routePoints.filter(isValidRoutePoint)
        : [],
      lastRoutePoint: parsed.lastRoutePoint ?? null,
    };
  } catch {
    window.localStorage.removeItem(workoutStorageKey(userId));
    return null;
  }
}

function readWorkoutPlanContext(value: unknown): WorkoutSessionPlanContext | null {
  if (!value || typeof value !== "object") return null;
  const plan = value as Partial<WorkoutSessionPlanContext>;
  if (
    typeof plan.id !== "string" ||
    typeof plan.name !== "string" ||
    !Array.isArray(plan.exercisesSnapshot)
  ) {
    return null;
  }
  return {
    id: plan.id,
    name: plan.name,
    exercisesSnapshot: plan.exercisesSnapshot,
    version:
      typeof plan.version === "number" && plan.version >= 1
        ? Math.round(plan.version)
        : 1,
    startedFrom:
      plan.startedFrom === "suggested" || plan.startedFrom === "duplicate"
        ? plan.startedFrom
        : "saved_plan",
  };
}

export function writeStoredWorkoutSession(
  userId: string,
  session: StoredWorkoutSession,
) {
  if (typeof window === "undefined") return;
  if (session.ownerUserId !== userId) return;
  window.localStorage.setItem(
    workoutStorageKey(userId),
    JSON.stringify(session),
  );
}

export function clearStoredWorkoutSession(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(workoutStorageKey(userId));
  window.localStorage.removeItem(WORKOUT_STORAGE_KEY);
}

export function hasStoredWorkoutSession(userId: string) {
  return readStoredWorkoutSession(userId) !== null;
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

/**
 * Tempo efetivamente cumprido no descanso atual. Ajustes de +10/-10 alteram
 * preset e restante juntos, então a diferença continua representando apenas
 * o tempo já transcorrido, inclusive quando o usuário pula o timer.
 */
export function workoutRestElapsedSeconds(rest: RestTimerState) {
  return Math.max(
    0,
    Math.min(7_200, Math.round(rest.presetS - rest.remainingS)),
  );
}

/** Registra o descanso somente na série que iniciou aquele timer. */
export function recordStrengthSetActualRest(
  sets: LiveStrengthSet[],
  clientId: string | null,
  actualRestS: number,
) {
  if (!clientId) return sets;
  const boundedActualRestS = Math.max(
    0,
    Math.min(7_200, Math.round(actualRestS)),
  );
  let changed = false;
  const next = sets.map((set) => {
    if (set.clientId !== clientId) return set;
    changed = true;
    return { ...set, actualRestS: boundedActualRestS };
  });
  return changed ? next : sets;
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
  if (typeof accuracy === "number" && (accuracy <= 0 || accuracy > 100)) {
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
  const minimumSegmentM = Math.max(2, Math.min(15, averageAccuracy * 0.25));

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

/**
 * Combina métricas absolutas de motores independentes sem somar a mesma rota.
 * Distância, movimento e elevação são monotônicos durante uma sessão; por isso
 * o maior valor é o fallback seguro quando o Core Location ou o GPS web atrasa.
 */
export function mergeWorkoutRouteSnapshot(
  session: StoredWorkoutSession,
  snapshot: WorkoutRouteSnapshot,
): StoredWorkoutSession {
  return {
    ...session,
    distanceM: Math.max(session.distanceM, finiteNonNegative(snapshot.distanceM)),
    movingS: Math.max(session.movingS, finiteNonNegative(snapshot.movingS)),
    elevationGainM: Math.max(
      session.elevationGainM,
      finiteNonNegative(snapshot.elevationGainM),
    ),
  };
}

export function bestWorkoutRouteSummary(
  session: StoredWorkoutSession,
  nativeSnapshot?: WorkoutRouteSnapshot,
): WorkoutRouteSnapshot {
  const merged = nativeSnapshot
    ? mergeWorkoutRouteSnapshot(session, nativeSnapshot)
    : session;
  const webRoute = workoutRouteCoordinates(session) ?? [];
  const nativeRoute = validCoordinateRoute(nativeSnapshot?.route);
  const useNativeRoute =
    nativeRoute.length >= 2 &&
    finiteNonNegative(nativeSnapshot?.distanceM) >= session.distanceM;

  return {
    distanceM: merged.distanceM,
    movingS: merged.movingS,
    elevationGainM: merged.elevationGainM,
    route: useNativeRoute ? nativeRoute : webRoute,
  };
}

function finiteNonNegative(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

function validCoordinateRoute(value: number[][] | undefined) {
  if (!Array.isArray(value)) return [];
  return value.filter(
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

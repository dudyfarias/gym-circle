import { getGymCircleDateKey } from "./time";

/**
 * Atividade rastreada (rastreio de treino, spec 2026-07-02).
 *
 * Uma activity é a FONTE de um treino rastreado — ao vivo no app (`live`),
 * cronômetro do web (`web_timer`) ou importada do Apple Saúde (`imported`).
 * Ela marca o dia/streak via trigger e pode virar post (source_activity_id).
 */
export type ActivityType = "strength" | "run" | "walk" | "ride" | "other";
export type ActivityMode = "session" | "route";
export type ActivityOrigin = "live" | "web_timer" | "imported";

/** Uma série de musculação: repetições e carga (kg). weightKg null = peso do corpo. */
export type StrengthSet = {
  reps: number;
  weightKg: number | null;
  /** Exercício da série (quando o treino veio de um treino salvo). */
  exercise?: string | null;
  exerciseId?: string | null;
  targetKind?: "reps" | "failure" | "duration" | null;
  durationSeconds?: number | null;
  techniqueId?: string | null;
  techniqueName?: string | null;
  techniqueNotes?: string | null;
};

/** Shape persistido em activities.strength_sets (snake_case). */
export type StrengthSetRow = {
  reps: number;
  weight_kg: number | null;
  exercise?: string | null;
  exercise_id?: string | null;
  target_kind?: "reps" | "failure" | "duration" | null;
  duration_seconds?: number | null;
  technique_id?: string | null;
  technique_name?: string | null;
  technique_notes?: string | null;
};

function isPersistableStrengthSet(
  set: Pick<StrengthSet, "durationSeconds" | "reps" | "targetKind">,
) {
  if (set.targetKind === "duration") {
    return (
      typeof set.durationSeconds === "number" &&
      Number.isFinite(set.durationSeconds) &&
      set.durationSeconds > 0
    );
  }
  return Number.isFinite(set.reps) && set.reps > 0;
}

function isPersistableStrengthSetRow(
  set: Pick<StrengthSetRow, "duration_seconds" | "reps" | "target_kind">,
) {
  if (set.target_kind === "duration") {
    return (
      typeof set.duration_seconds === "number" &&
      Number.isFinite(set.duration_seconds) &&
      set.duration_seconds > 0
    );
  }
  return Number.isFinite(set.reps) && set.reps > 0;
}

export function strengthSetsFromRow(
  rows: StrengthSetRow[] | null | undefined,
): StrengthSet[] | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows
    .filter(isPersistableStrengthSetRow)
    .map((r) => ({
      reps:
        r.target_kind === "duration"
          ? 0
          : Number.isFinite(r.reps) && r.reps > 0
            ? Math.round(r.reps)
            : 0,
      weightKg:
        r.weight_kg != null &&
        Number.isFinite(r.weight_kg) &&
        r.weight_kg > 0
          ? r.weight_kg
          : null,
      exercise: r.exercise?.trim() || null,
      exerciseId: r.exercise_id?.trim() || null,
      targetKind: r.target_kind ?? null,
      durationSeconds:
        r.duration_seconds != null && Number.isFinite(r.duration_seconds)
          ? Math.max(1, Math.round(r.duration_seconds))
          : null,
      techniqueId: r.technique_id?.trim() || null,
      techniqueName: r.technique_name?.trim() || null,
      techniqueNotes: r.technique_notes?.trim() || null,
    }));
}

export function strengthSetsToRow(
  sets: StrengthSet[] | null | undefined,
): StrengthSetRow[] | null {
  if (!Array.isArray(sets) || sets.length === 0) return null;
  return sets
    .filter(isPersistableStrengthSet)
    .map((s) => ({
      reps:
        s.targetKind === "duration"
          ? 0
          : Number.isFinite(s.reps) && s.reps > 0
            ? Math.round(s.reps)
            : 0,
      weight_kg:
        s.weightKg != null && Number.isFinite(s.weightKg) && s.weightKg > 0
          ? s.weightKg
          : null,
      exercise: s.exercise?.trim() || null,
      exercise_id: s.exerciseId?.trim() || null,
      target_kind: s.targetKind ?? null,
      duration_seconds:
        s.durationSeconds != null && Number.isFinite(s.durationSeconds)
          ? Math.max(1, Math.round(s.durationSeconds))
          : null,
      technique_id: s.techniqueId?.trim() || null,
      technique_name: s.techniqueName?.trim() || null,
      technique_notes: s.techniqueNotes?.trim() || null,
    }));
}

export type Activity = {
  id: string;
  userId: string;
  activityType: ActivityType;
  mode: ActivityMode;
  origin: ActivityOrigin;
  sourceApp: string | null;
  startedAt: string;
  endedAt: string;
  elapsedS: number;
  movingS: number | null;
  distanceM: number | null;
  elevationGainM: number | null;
  route: number[][] | null;
  strengthSets: StrengthSet[] | null;
  avgHr: number | null;
  maxHr: number | null;
  activeCalories: number | null;
  totalCalories: number | null;
  workoutDate: string;
  createdAt: string;
};

export type ActivityInput = {
  /** ID do cliente usado pelo RPC de finalização idempotente. */
  clientSessionId?: string;
  activityType: ActivityType;
  mode: ActivityMode;
  origin: ActivityOrigin;
  startedAt: string;
  endedAt: string;
  elapsedS: number;
  sourceApp?: string | null;
  movingS?: number | null;
  distanceM?: number | null;
  elevationGainM?: number | null;
  /** Polyline reduzida no formato [[latitude, longitude], ...]. */
  route?: number[][] | null;
  /** Séries de musculação (só treino de força). */
  strengthSets?: StrengthSet[] | null;
  avgHr?: number | null;
  maxHr?: number | null;
  activeCalories?: number | null;
  totalCalories?: number | null;
  /** Default: derivado de startedAt em America/Sao_Paulo. */
  workoutDate?: string;
};

export type ActivityRow = {
  id: string;
  user_id: string;
  activity_type: string;
  mode: string;
  origin: string;
  source_app: string | null;
  started_at: string;
  ended_at: string;
  elapsed_s: number;
  moving_s: number | null;
  distance_m: number | null;
  elevation_gain_m: number | null;
  route: number[][] | null;
  strength_sets: StrengthSetRow[] | null;
  avg_hr: number | null;
  max_hr: number | null;
  active_calories: number | null;
  total_calories: number | null;
  workout_date: string;
  created_at: string;
};

export function activityRowToDomain(row: ActivityRow): Activity {
  return {
    id: row.id,
    userId: row.user_id,
    activityType: row.activity_type as ActivityType,
    mode: row.mode as ActivityMode,
    origin: row.origin as ActivityOrigin,
    sourceApp: row.source_app,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    elapsedS: row.elapsed_s,
    movingS: row.moving_s,
    distanceM: row.distance_m,
    elevationGainM: row.elevation_gain_m,
    route: row.route,
    strengthSets: strengthSetsFromRow(row.strength_sets),
    avgHr: row.avg_hr,
    maxHr: row.max_hr,
    activeCalories: row.active_calories,
    totalCalories: row.total_calories,
    workoutDate: row.workout_date,
    createdAt: row.created_at,
  };
}

export function activityInputToRow(input: ActivityInput, userId: string) {
  return {
    user_id: userId,
    activity_type: input.activityType,
    mode: input.mode,
    origin: input.origin,
    source_app: input.sourceApp ?? null,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    elapsed_s: input.elapsedS,
    moving_s: input.movingS ?? null,
    distance_m: input.distanceM ?? null,
    elevation_gain_m: input.elevationGainM ?? null,
    route: input.route ?? null,
    strength_sets: strengthSetsToRow(input.strengthSets),
    avg_hr: input.avgHr ?? null,
    max_hr: input.maxHr ?? null,
    active_calories: input.activeCalories ?? null,
    total_calories: input.totalCalories ?? null,
    workout_date:
      input.workoutDate ?? getGymCircleDateKey(new Date(input.startedAt)),
  };
}

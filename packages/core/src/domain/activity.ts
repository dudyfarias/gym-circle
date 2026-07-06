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
};

/** Shape persistido em activities.strength_sets (snake_case). */
export type StrengthSetRow = {
  reps: number;
  weight_kg: number | null;
};

export function strengthSetsFromRow(
  rows: StrengthSetRow[] | null | undefined,
): StrengthSet[] | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows
    .filter((r) => Number.isFinite(r?.reps) && r.reps > 0)
    .map((r) => ({
      reps: Math.round(r.reps),
      weightKg:
        r.weight_kg != null && Number.isFinite(r.weight_kg) ? r.weight_kg : null,
    }));
}

export function strengthSetsToRow(
  sets: StrengthSet[] | null | undefined,
): StrengthSetRow[] | null {
  if (!Array.isArray(sets) || sets.length === 0) return null;
  return sets
    .filter((s) => Number.isFinite(s?.reps) && s.reps > 0)
    .map((s) => ({
      reps: Math.round(s.reps),
      weight_kg:
        s.weightKg != null && Number.isFinite(s.weightKg) ? s.weightKg : null,
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

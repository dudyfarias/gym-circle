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
    avg_hr: input.avgHr ?? null,
    max_hr: input.maxHr ?? null,
    active_calories: input.activeCalories ?? null,
    total_calories: input.totalCalories ?? null,
    workout_date:
      input.workoutDate ?? getGymCircleDateKey(new Date(input.startedAt)),
  };
}

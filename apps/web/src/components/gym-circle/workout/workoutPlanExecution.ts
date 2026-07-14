import type { WorkoutPlanExecution } from "../social/types";

export type WorkoutPlanExecutionRow = {
  id: string;
  workout_plan_id: string | null;
  workout_date: string;
  started_at: string | null;
  elapsed_s: number | null;
  strength_sets: unknown;
};

function positiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

export function workoutPlanExecutionFromRow(
  row: WorkoutPlanExecutionRow,
): WorkoutPlanExecution | null {
  if (!row.workout_plan_id) return null;
  const sets = Array.isArray(row.strength_sets)
    ? (row.strength_sets as Array<Record<string, unknown>>)
    : [];
  const volumeKg = sets.reduce((total, set) => {
    const loadType = set.load_type ?? set.loadType;
    const weightKg = positiveNumber(set.weight_kg ?? set.weightKg);
    const reps = positiveNumber(set.reps ?? set.actual_reps);
    // Sessões legadas sem load_type continuam úteis; 0 e cargas assistidas não.
    const isExternal = loadType == null || loadType === "external";
    return total + (isExternal ? weightKg * reps : 0);
  }, 0);
  const planned = sets.filter((set) => {
    const origin = set.set_origin ?? set.setOrigin;
    return origin !== "added";
  });
  const completed = planned.filter((set) => {
    const status = set.status ?? set.set_status ?? set.setStatus;
    return status === "completed";
  }).length;

  return {
    activityId: row.id,
    workoutPlanId: row.workout_plan_id,
    workoutDate: row.workout_date,
    startedAt: row.started_at,
    elapsedS: Math.max(0, Math.round(row.elapsed_s ?? 0)),
    volumeKg,
    completionRate: planned.length > 0 ? completed / planned.length : null,
  };
}

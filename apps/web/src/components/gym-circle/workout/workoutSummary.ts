import type { StrengthSet } from "../social/types";

export const SHORT_WORKOUT_SECONDS = 2 * 60;

export type WorkoutSummaryMetrics = {
  completedSets: number;
  exerciseCount: number;
  plannedSets: number;
  totalReps: number;
  totalVolumeKg: number;
};

export function parseOptionalWeightKg(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const weight = Number(normalized);
  return Number.isFinite(weight) && weight > 0 ? weight : null;
}

export function normalizeWeightKg(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export function normalizeStrengthSetsForSave(
  sets: StrengthSet[],
): StrengthSet[] {
  return sets.map((set) => ({
    reps:
      set.targetKind === "duration"
        ? 0
        : Number.isFinite(set.reps) && set.reps > 0
          ? Math.round(set.reps)
          : 0,
    weightKg: normalizeWeightKg(set.weightKg),
    exercise: set.exercise?.trim() || null,
    exerciseId: set.exerciseId?.trim() || null,
    targetKind: set.targetKind ?? "reps",
    durationSeconds:
      set.targetKind === "duration" &&
      typeof set.durationSeconds === "number" &&
      Number.isFinite(set.durationSeconds) &&
      set.durationSeconds > 0
        ? Math.round(set.durationSeconds)
        : null,
    techniqueId: set.techniqueId?.trim() || null,
    techniqueName: set.techniqueName?.trim() || null,
    techniqueNotes: set.techniqueNotes?.trim() || null,
  }));
}

export function buildWorkoutSummaryMetrics(
  sets: StrengthSet[],
  plannedSets = sets.length,
): WorkoutSummaryMetrics {
  const completedSets = sets.filter((set) =>
    set.targetKind === "duration"
      ? typeof set.durationSeconds === "number" && set.durationSeconds > 0
      : Number.isFinite(set.reps) && set.reps > 0,
  );
  const exerciseKeys = new Set<string>();
  let totalReps = 0;
  let totalVolumeKg = 0;

  completedSets.forEach((set) => {
    const exerciseKey =
      set.exerciseId?.trim() ||
      set.exercise?.trim().toLocaleLowerCase() ||
      "__untitled__";
    exerciseKeys.add(exerciseKey);

    if (set.targetKind === "duration") return;
    const reps = Number.isFinite(set.reps) && set.reps > 0 ? Math.round(set.reps) : 0;
    const weightKg = normalizeWeightKg(set.weightKg);
    totalReps += reps;
    if (weightKg !== null) totalVolumeKg += reps * weightKg;
  });

  return {
    completedSets: completedSets.length,
    exerciseCount: exerciseKeys.size,
    plannedSets: Math.max(plannedSets, completedSets.length),
    totalReps,
    totalVolumeKg: Math.round(totalVolumeKg * 100) / 100,
  };
}

export function isVeryShortWorkout(elapsedS: number) {
  return elapsedS < SHORT_WORKOUT_SECONDS;
}

export function getWorkoutPlanDisplayName(name: string, fallback: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.toLocaleLowerCase("pt-BR") === "planilha") {
    return fallback;
  }
  return trimmed;
}

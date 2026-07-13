import type { PersonalRecord } from "./usePersonalRecords";
import type { WorkoutExerciseProgress } from "./workoutProgress";

function normalizedName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function personalRecordForExercise(
  exercise: Pick<WorkoutExerciseProgress, "exerciseId" | "exerciseName" | "key">,
  records: PersonalRecord[],
) {
  const nameKey = normalizedName(exercise.exerciseName);
  return (
    records.find(
      (record) =>
        record.metricKey === "strength_weight" &&
        ((exercise.exerciseId && record.exerciseId === exercise.exerciseId) ||
          record.exerciseKey === exercise.key ||
          normalizedName(record.exerciseName || record.exerciseKey) === nameKey),
    ) ?? null
  );
}

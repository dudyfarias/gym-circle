import { describe, expect, it } from "vitest";
import type { PersonalRecord } from "./usePersonalRecords";
import { personalRecordForExercise } from "./personalRecordMatching";

function record(overrides: Partial<PersonalRecord> = {}): PersonalRecord {
  return {
    id: "record-1",
    userId: "user-1",
    activityId: "activity-1",
    metricKey: "strength_weight",
    exerciseKey: "supino reto",
    exerciseId: null,
    exerciseName: "Supino reto",
    value: 80,
    unit: "kg",
    reps: 8,
    isEstimated: false,
    achievedAt: "2026-07-12T12:00:00.000Z",
    ...overrides,
  };
}

describe("personalRecordForExercise", () => {
  it("prioriza exercise_id mesmo quando o nome legado mudou", () => {
    const matched = personalRecordForExercise(
      {
        key: "catalog-exercise-1",
        exerciseId: "catalog-exercise-1",
        exerciseName: "Bench press",
      },
      [
        record({
          exerciseId: "catalog-exercise-1",
          exerciseName: "Supino reto",
        }),
      ],
    );

    expect(matched?.id).toBe("record-1");
  });

  it("mantem fallback por nome para recordes legados sem ID", () => {
    const matched = personalRecordForExercise(
      {
        key: "legacy-key",
        exerciseId: null,
        exerciseName: "Supino Reto",
      },
      [record()],
    );

    expect(matched?.id).toBe("record-1");
  });
});

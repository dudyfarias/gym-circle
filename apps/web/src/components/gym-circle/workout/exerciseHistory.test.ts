import { describe, expect, it } from "vitest";
import {
  buildExerciseHistory,
  buildWorkoutComparison,
  exerciseHistoryKey,
  lastPerformanceLabel,
  type ExerciseHistoryActivityRow,
} from "./exerciseHistory";

const row = (
  id: string,
  startedAt: string,
  sets: ExerciseHistoryActivityRow["strength_sets"],
): ExerciseHistoryActivityRow => ({
  id,
  started_at: startedAt,
  ended_at: null,
  strength_sets: sets,
});

describe("exerciseHistoryKey", () => {
  it("prefere exercise_id e cai pro nome normalizado", () => {
    expect(exerciseHistoryKey("ex-1", "Supino")).toBe("ex-1");
    expect(exerciseHistoryKey(null, "  Supino Reto ")).toBe("name:supino reto");
    expect(exerciseHistoryKey(null, "")).toBeNull();
  });
});

describe("buildExerciseHistory", () => {
  it("agrupa por exercício preservando ordem (mais recente primeiro)", () => {
    const history = buildExerciseHistory([
      row("a2", "2026-07-10T10:00:00Z", [
        { reps: 10, weight_kg: 22.5, exercise: "Supino", exercise_id: "ex-1" },
        { reps: 8, weight_kg: 25, exercise: "Supino", exercise_id: "ex-1" },
      ]),
      row("a1", "2026-07-08T10:00:00Z", [
        { reps: 12, weight_kg: 20, exercise: "Supino", exercise_id: "ex-1" },
        { reps: 15, weight_kg: null, exercise: "Abdominal", exercise_id: null },
      ]),
    ]);

    const supino = history.get("ex-1");
    expect(supino).toHaveLength(2);
    expect(supino?.[0].activityId).toBe("a2");
    expect(supino?.[0].maxWeightKg).toBe(25);
    expect(supino?.[0].bestSet).toEqual({ reps: 8, weightKg: 25 });
    expect(supino?.[0].totalVolumeKg).toBe(10 * 22.5 + 8 * 25);
    expect(supino?.[1].activityId).toBe("a1");

    const abdominal = history.get("name:abdominal");
    expect(abdominal?.[0].bestSet).toEqual({ reps: 15, weightKg: null });
    expect(abdominal?.[0].totalVolumeKg).toBe(0);
  });

  it("ignora sets sem reps e carga zero vira null", () => {
    const history = buildExerciseHistory([
      row("a1", "2026-07-08T10:00:00Z", [
        { reps: 0, weight_kg: 50, exercise: "Supino", exercise_id: "ex-1" },
        { reps: 10, weight_kg: 0, exercise: "Supino", exercise_id: "ex-1" },
      ]),
    ]);
    const supino = history.get("ex-1");
    expect(supino?.[0].sets).toEqual([{ reps: 10, weightKg: null }]);
    expect(supino?.[0].maxWeightKg).toBeNull();
  });
});

describe("lastPerformanceLabel", () => {
  it("formata séries×reps · carga", () => {
    const history = buildExerciseHistory([
      row("a1", "2026-07-08T10:00:00Z", [
        { reps: 10, weight_kg: 20, exercise: "Supino", exercise_id: "ex-1" },
        { reps: 10, weight_kg: 20, exercise: "Supino", exercise_id: "ex-1" },
        { reps: 8, weight_kg: 22.5, exercise: "Supino", exercise_id: "ex-1" },
      ]),
    ]);
    expect(lastPerformanceLabel(history.get("ex-1")![0])).toBe("3×8 · 22.5 kg");
  });

  it("sem carga mostra só séries×reps", () => {
    const history = buildExerciseHistory([
      row("a1", "2026-07-08T10:00:00Z", [
        { reps: 15, weight_kg: null, exercise: "Prancha", exercise_id: null },
      ]),
    ]);
    expect(lastPerformanceLabel(history.get("name:prancha")![0])).toBe("1×15");
  });
});

describe("buildWorkoutComparison", () => {
  const previous = row("prev", "2026-07-08T10:00:00Z", [
    { reps: 10, weight_kg: 20, exercise: "Supino", exercise_id: "ex-1" },
    { reps: 10, weight_kg: 20, exercise: "Supino", exercise_id: "ex-1" },
    { reps: 12, weight_kg: 30, exercise: "Agachamento", exercise_id: "ex-2" },
  ]);

  it("calcula deltas e exercícios que evoluíram", () => {
    const comparison = buildWorkoutComparison(
      [
        { reps: 10, weightKg: 22.5, exercise: "Supino", exerciseId: "ex-1" },
        { reps: 10, weightKg: 22.5, exercise: "Supino", exerciseId: "ex-1" },
        { reps: 12, weightKg: 30, exercise: "Agachamento", exerciseId: "ex-2" },
      ],
      previous,
    );
    expect(comparison).not.toBeNull();
    expect(comparison?.previousDate).toBe("2026-07-08T10:00:00Z");
    expect(comparison?.deltaReps).toBe(0);
    // atual: 20*22.5 + 12*30 = 810; anterior: 20*20 + 12*30 = 760
    expect(comparison?.deltaVolumeKg).toBe(50);
    expect(comparison?.improvedExercises).toEqual(["Supino"]);
  });

  it("null sem treino anterior ou sem reps atuais", () => {
    expect(buildWorkoutComparison([{ reps: 10, weightKg: 20 }], null)).toBeNull();
    expect(buildWorkoutComparison([], previous)).toBeNull();
    expect(
      buildWorkoutComparison([{ reps: 0, weightKg: 20 }], previous),
    ).toBeNull();
  });
});

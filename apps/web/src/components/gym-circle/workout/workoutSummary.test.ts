import { describe, expect, it } from "vitest";
import type { StrengthSet } from "../social/types";
import {
  buildWorkoutSummaryMetrics,
  getWorkoutPlanDisplayName,
  isVeryShortWorkout,
  normalizeStrengthSetsForSave,
  parseOptionalWeightKg,
} from "./workoutSummary";

describe("workout summary helpers", () => {
  it("trata carga vazia, zero e negativa como ausência", () => {
    expect(parseOptionalWeightKg("")).toBeNull();
    expect(parseOptionalWeightKg("0")).toBeNull();
    expect(parseOptionalWeightKg("-5")).toBeNull();
    expect(parseOptionalWeightKg("32,5")).toBe(32.5);
  });

  it("ignora carga zero e séries por duração no volume", () => {
    const sets: StrengthSet[] = [
      { reps: 10, weightKg: 20, exercise: "Supino" },
      { reps: 8, weightKg: 0, exercise: "Supino" },
      {
        reps: 0,
        weightKg: null,
        exercise: "Prancha",
        targetKind: "duration",
        durationSeconds: 30,
      },
      { reps: 0, weightKg: null, exercise: "Agachamento" },
    ];

    expect(buildWorkoutSummaryMetrics(sets, 4)).toEqual({
      completedSets: 3,
      exerciseCount: 2,
      plannedSets: 4,
      totalReps: 18,
      totalVolumeKg: 200,
    });
  });

  it("normaliza carga zero para null sem inventar reps em duração", () => {
    expect(
      normalizeStrengthSetsForSave([
        {
          reps: 0,
          weightKg: 0,
          targetKind: "duration",
          durationSeconds: 45,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        reps: 0,
        weightKg: null,
        targetKind: "duration",
        durationSeconds: 45,
      }),
    ]);
  });

  it("agrupa séries sem nome como um único exercício", () => {
    const sets: StrengthSet[] = [
      { reps: 10, weightKg: null },
      { reps: 8, weightKg: null },
    ];

    const result = buildWorkoutSummaryMetrics(sets);
    expect(result.exerciseCount).toBe(1);
    expect(result.completedSets).toBe(2);
  });

  it("detecta treino abaixo de dois minutos", () => {
    expect(isVeryShortWorkout(119)).toBe(true);
    expect(isVeryShortWorkout(120)).toBe(false);
  });

  it("apresenta o nome legado Planilha como treino sem nome", () => {
    expect(getWorkoutPlanDisplayName("Planilha", "Treino sem nome")).toBe(
      "Treino sem nome",
    );
    expect(getWorkoutPlanDisplayName("  ", "Treino sem nome")).toBe(
      "Treino sem nome",
    );
    expect(getWorkoutPlanDisplayName("Peito A", "Treino sem nome")).toBe(
      "Peito A",
    );
  });
});

import { describe, expect, it } from "vitest";
import type {
  WorkoutExerciseProgress,
  WorkoutProgressPoint,
  WorkoutProgressSnapshot,
  WorkoutWeekProgress,
} from "./workoutProgress";
import {
  buildMuscleGapInsights,
  buildProgressionInsights,
  buildWeeklyInsight,
  buildWorkoutInsights,
} from "./workoutInsights";

function point(
  activityId: string,
  workoutDate: string,
  overrides: Partial<WorkoutProgressPoint> = {},
): WorkoutProgressPoint {
  return {
    activityId,
    performedAt: `${workoutDate}T12:00:00.000Z`,
    workoutDate,
    setCount: 2,
    weightedSetCount: 2,
    failureSetCount: 0,
    durationSetCount: 0,
    maxWeightKg: 20,
    totalVolumeKg: 400,
    totalReps: 20,
    totalDurationSeconds: 0,
    ...overrides,
  };
}

function exercise(
  key: string,
  points: WorkoutProgressPoint[],
  overrides: Partial<WorkoutExerciseProgress> = {},
): WorkoutExerciseProgress {
  return {
    key,
    exerciseId: key,
    exerciseName: key,
    primaryMuscleGroupSlug: "chest",
    sessionCount: points.length,
    setCount: points.reduce((sum, item) => sum + item.setCount, 0),
    weightedSetCount: points.reduce(
      (sum, item) => sum + item.weightedSetCount,
      0,
    ),
    maxWeightKg: points.reduce<number | null>(
      (maximum, item) =>
        item.maxWeightKg === null
          ? maximum
          : Math.max(maximum ?? 0, item.maxWeightKg),
      null,
    ),
    totalVolumeKg: points.reduce(
      (sum, item) => sum + item.totalVolumeKg,
      0,
    ),
    totalReps: points.reduce((sum, item) => sum + item.totalReps, 0),
    totalDurationSeconds: points.reduce(
      (sum, item) => sum + item.totalDurationSeconds,
      0,
    ),
    lastPerformedAt: points.at(-1)?.performedAt ?? "",
    points,
    ...overrides,
  };
}

function week(
  weekStart: string,
  weekEnd: string,
  overrides: Partial<WorkoutWeekProgress> = {},
): WorkoutWeekProgress {
  return {
    weekStart,
    weekEnd,
    sessionCount: 0,
    strengthSessionCount: 0,
    activeDays: 0,
    totalDurationSeconds: 0,
    totalSets: 0,
    totalReps: 0,
    totalVolumeKg: 0,
    totalTimedExerciseSeconds: 0,
    ...overrides,
  };
}

function snapshot(
  exercises: WorkoutExerciseProgress[] = [],
  weeks: WorkoutWeekProgress[] = [],
  to = "2026-07-10",
): WorkoutProgressSnapshot {
  return {
    range: { from: "2026-04-18", to, days: 84 },
    overview: {
      sessionCount: weeks.reduce((sum, item) => sum + item.sessionCount, 0),
      strengthSessionCount: weeks.reduce(
        (sum, item) => sum + item.strengthSessionCount,
        0,
      ),
      activeDays: 0,
      exerciseCount: exercises.length,
      totalDurationSeconds: 0,
      totalSets: 0,
      totalReps: 0,
      totalVolumeKg: 0,
      totalTimedExerciseSeconds: 0,
    },
    weeks,
    exercises,
    muscleGroups: [],
  };
}

describe("buildProgressionInsights", () => {
  it("sugere considerar carga apenas para duas sessões comparáveis", () => {
    const previous = point("previous", "2026-07-01", {
      totalReps: 20,
      totalVolumeKg: 400,
    });
    const current = point("current", "2026-07-08", {
      totalReps: 22,
      totalVolumeKg: 440,
    });
    const result = buildProgressionInsights(
      snapshot([exercise("supino", [previous, current])]),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "progression:supino",
      reason: "same-load-reps-maintained",
      action: "consider-next-load",
      data: {
        currentActivityId: "current",
        deltaReps: 2,
        deltaVolumeKg: 40,
        maxWeightKg: 20,
        previousActivityId: "previous",
        weightedSetCount: 2,
      },
    });
  });

  it.each([
    ["menos de dois sets ponderados", { weightedSetCount: 1 }, {}],
    ["quantidade de sets diferente", {}, { weightedSetCount: 3 }],
    ["carga máxima diferente", {}, { maxWeightKg: 22.5 }],
    ["repetições caíram", {}, { totalReps: 19 }],
    ["volume caiu", {}, { totalVolumeKg: 399 }],
    ["carga ausente", { maxWeightKg: null }, { maxWeightKg: null }],
  ])("não sugere quando %s", (_label, previousPatch, currentPatch) => {
    const result = buildProgressionInsights(
      snapshot([
        exercise("supino", [
          point("previous", "2026-07-01", previousPatch),
          point("current", "2026-07-08", currentPatch),
        ]),
      ]),
    );
    expect(result).toEqual([]);
  });

  it("considera somente as duas sessões mais recentes", () => {
    const result = buildProgressionInsights(
      snapshot([
        exercise("supino", [
          point("old", "2026-06-20", { maxWeightKg: 10 }),
          point("previous", "2026-07-01", { maxWeightKg: 20 }),
          point("current", "2026-07-08", { maxWeightKg: 20 }),
        ]),
      ]),
    );
    expect(result).toHaveLength(1);
    expect(result[0].data.previousActivityId).toBe("previous");
  });
});

describe("learning insights", () => {
  it("expõe estado de aprendizado quando não há exercícios", () => {
    const insights = buildWorkoutInsights(snapshot());
    expect(insights).toContainEqual(
      expect.objectContaining({
        id: "learning:workout-history",
        type: "learning",
        reason: "no-exercises",
      }),
    );
  });

  it("diferencia ausência de peso de histórico ainda não comparável", () => {
    const noWeight = buildWorkoutInsights(
      snapshot([
        exercise("flexao", [
          point("one", "2026-07-08", {
            maxWeightKg: null,
            weightedSetCount: 0,
          }),
        ]),
      ]),
    );
    expect(noWeight.at(-1)).toMatchObject({
      type: "learning",
      reason: "insufficient-weighted-history",
    });

    const collecting = buildWorkoutInsights(
      snapshot([
        exercise("supino", [point("one", "2026-07-08")]),
      ]),
    );
    expect(collecting.at(-1)).toMatchObject({
      type: "learning",
      reason: "collecting-comparable-sessions",
    });
  });

  it("não adiciona learning quando já existe progressão segura", () => {
    const insights = buildWorkoutInsights(
      snapshot([
        exercise("supino", [
          point("previous", "2026-07-01"),
          point("current", "2026-07-08"),
        ]),
      ]),
    );
    expect(insights.some((insight) => insight.type === "progression")).toBe(true);
    expect(insights.some((insight) => insight.type === "learning")).toBe(false);
  });
});

describe("buildMuscleGapInsights", () => {
  const weeks = [
    week("2026-06-29", "2026-07-05"),
    week("2026-07-06", "2026-07-12"),
  ];

  it("marca grupo ausente agora que esteve presente antes", () => {
    const insights = buildMuscleGapInsights(
      snapshot(
        [
          exercise("supino", [point("chest-old", "2026-07-03")], {
            primaryMuscleGroupSlug: "chest",
          }),
          exercise(
            "remada",
            [
              point("back-old", "2026-07-04"),
              point("back-current", "2026-07-09"),
            ],
            { primaryMuscleGroupSlug: "back" },
          ),
          exercise("unknown", [point("other-old", "2026-07-02")], {
            primaryMuscleGroupSlug: "other",
          }),
        ],
        weeks,
      ),
    );

    expect(insights).toEqual([
      expect.objectContaining({
        id: "muscle-gap:chest:2026-07-06",
        type: "muscle-gap",
        data: expect.objectContaining({
          lastWorkoutDate: "2026-07-03",
          muscleGroupSlug: "chest",
          previousSessionCount: 1,
          previousSetCount: 2,
        }),
      }),
    ]);
  });

  it("não cria gap sem semana anterior ou sem presença anterior", () => {
    expect(
      buildMuscleGapInsights(snapshot([], [weeks[1]])),
    ).toEqual([]);
    expect(
      buildMuscleGapInsights(
        snapshot(
          [
            exercise("supino", [point("current", "2026-07-09")], {
              primaryMuscleGroupSlug: "chest",
            }),
          ],
          weeks,
        ),
      ),
    ).toEqual([]);
  });
});

describe("buildWeeklyInsight", () => {
  it("não compara semana parcial com uma semana anterior inteira", () => {
    const insight = buildWeeklyInsight(
      snapshot(
        [],
        [
          week("2026-06-29", "2026-07-05", {
            sessionCount: 2,
            strengthSessionCount: 2,
            activeDays: 2,
            totalDurationSeconds: 5_000,
            totalSets: 12,
            totalReps: 100,
            totalVolumeKg: 2_000,
          }),
          week("2026-07-06", "2026-07-12", {
            sessionCount: 3,
            strengthSessionCount: 2,
            activeDays: 3,
            totalDurationSeconds: 6_000,
            totalSets: 14,
            totalReps: 112,
            totalVolumeKg: 2_250.5,
          }),
        ],
      ),
    );

    expect(insight).toBeNull();
  });

  it("marca steady e semana completa quando termina no domingo", () => {
    const weeks = [
      week("2026-06-29", "2026-07-05", { sessionCount: 2 }),
      week("2026-07-06", "2026-07-12", { sessionCount: 2 }),
    ];
    const insight = buildWeeklyInsight(snapshot([], weeks, "2026-07-12"));
    expect(insight?.trend).toBe("steady");
    expect(insight?.data.currentWeekComplete).toBe(true);
  });

  it("retorna deltas quando a semana está completa", () => {
    const insight = buildWeeklyInsight(
      snapshot(
        [],
        [
          week("2026-06-29", "2026-07-05", {
            sessionCount: 2,
            totalVolumeKg: 2_000,
          }),
          week("2026-07-06", "2026-07-12", {
            sessionCount: 3,
            totalVolumeKg: 2_250.5,
          }),
        ],
        "2026-07-12",
      ),
    );
    expect(insight).toMatchObject({
      trend: "up",
      data: {
        currentWeekComplete: true,
        delta: { sessionCount: 1, totalVolumeKg: 250.5 },
      },
    });
  });

  it("retorna null quando não há duas semanas", () => {
    expect(
      buildWeeklyInsight(
        snapshot([], [week("2026-07-06", "2026-07-12")]),
      ),
    ).toBeNull();
  });
});

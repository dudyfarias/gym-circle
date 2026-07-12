import { describe, expect, it } from "vitest";
import {
  addWorkoutProgressDays,
  buildWorkoutProgress,
  UNKNOWN_MUSCLE_GROUP_SLUG,
  workoutProgressExerciseKey,
  workoutProgressRange,
  type WorkoutProgressActivityRow,
  type WorkoutProgressStrengthSetRow,
} from "./workoutProgress";

function activity(
  id: string,
  workoutDate: string,
  strengthSets: WorkoutProgressStrengthSetRow[] | null,
  overrides: Partial<WorkoutProgressActivityRow> = {},
): WorkoutProgressActivityRow {
  return {
    id,
    activity_type: "strength",
    workout_date: workoutDate,
    started_at: `${workoutDate}T12:00:00.000Z`,
    ended_at: `${workoutDate}T13:00:00.000Z`,
    elapsed_s: 3_600,
    strength_sets: strengthSets,
    ...overrides,
  };
}

describe("workout progress dates", () => {
  it("calcula o recorte inclusivo de 84 dias sem depender do timezone local", () => {
    expect(workoutProgressRange("2026-07-12")).toEqual({
      from: "2026-04-20",
      to: "2026-07-12",
      days: 84,
    });
    expect(addWorkoutProgressDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("prefere exercise_id e mantém fallback por nome", () => {
    expect(workoutProgressExerciseKey("exercise-1", "Supino")).toBe(
      "exercise-1",
    );
    expect(workoutProgressExerciseKey(null, " Supino Reto ")).toBe(
      "name:supino reto",
    );
    expect(workoutProgressExerciseKey(null, "")).toBeNull();
  });
});

describe("buildWorkoutProgress", () => {
  it("trata carga zero/null como ausência e ignora séries sem reps", () => {
    const progress = buildWorkoutProgress(
      [
        activity("a1", "2026-07-10", [
          {
            exercise_id: "supino",
            exercise: "Supino",
            reps: 10,
            weight_kg: 0,
          },
          {
            exercise_id: "supino",
            exercise: "Supino",
            reps: 8,
            weight_kg: null,
          },
          {
            exercise_id: "supino",
            exercise: "Supino",
            reps: 0,
            weight_kg: 50,
          },
          { exercise: null, reps: 12, weight_kg: 20 },
        ]),
      ],
      [],
      { today: "2026-07-12" },
    );

    expect(progress.overview.totalSets).toBe(2);
    expect(progress.overview.totalReps).toBe(18);
    expect(progress.overview.totalVolumeKg).toBe(0);
    expect(progress.exercises).toHaveLength(1);
    expect(progress.exercises[0]).toMatchObject({
      key: "supino",
      maxWeightKg: null,
      setCount: 2,
      totalReps: 18,
      totalVolumeKg: 0,
      weightedSetCount: 0,
    });
  });

  it("contabiliza falha com peso e mantém falha sem peso válida", () => {
    const progress = buildWorkoutProgress(
      [
        activity("failure", "2026-07-10", [
          {
            exercise_id: "mergulho",
            exercise: "Mergulho",
            target_kind: "failure",
            reps: 12,
            weight_kg: 40,
          },
          {
            exercise_id: "mergulho",
            exercise: "Mergulho",
            target_kind: "failure",
            reps: 10,
            weight_kg: null,
          },
        ]),
      ],
      [],
      { today: "2026-07-12" },
    );

    const exercise = progress.exercises[0];
    expect(exercise.totalReps).toBe(22);
    expect(exercise.totalVolumeKg).toBe(480);
    expect(exercise.maxWeightKg).toBe(40);
    expect(exercise.points[0]).toMatchObject({
      failureSetCount: 2,
      setCount: 2,
      weightedSetCount: 1,
    });
  });

  it("usa duração como métrica própria e nunca inventa reps, peso ou volume", () => {
    const progress = buildWorkoutProgress(
      [
        activity("duration", "2026-07-10", [
          {
            exercise_id: "prancha",
            exercise: "Prancha",
            target_kind: "duration",
            duration_seconds: 45,
            reps: 0,
            weight_kg: 50,
          },
          {
            exercise_id: "prancha",
            exercise: "Prancha",
            target_kind: "duration",
            duration_seconds: 0,
          },
        ]),
      ],
      [],
      { today: "2026-07-12" },
    );

    expect(progress.overview).toMatchObject({
      totalSets: 1,
      totalReps: 0,
      totalVolumeKg: 0,
      totalTimedExerciseSeconds: 45,
    });
    expect(progress.exercises[0]).toMatchObject({
      maxWeightKg: null,
      totalDurationSeconds: 45,
      totalReps: 0,
      totalVolumeKg: 0,
    });
    expect(progress.exercises[0].points[0].durationSetCount).toBe(1);
  });

  it("cria semanas em ordem cronológica, mantém gaps e ignora fora do recorte", () => {
    const progress = buildWorkoutProgress(
      [
        activity("current-1", "2026-07-12", null),
        activity("current-2", "2026-07-10", null, {
          activity_type: "run",
          elapsed_s: 1_200,
        }),
        activity("previous", "2026-07-05", null),
        activity("outside", "2026-04-19", null),
      ],
      [],
      { today: "2026-07-12", weekCount: 3 },
    );

    expect(progress.weeks.map((week) => week.weekStart)).toEqual([
      "2026-06-22",
      "2026-06-29",
      "2026-07-06",
    ]);
    expect(progress.weeks[0].sessionCount).toBe(0);
    expect(progress.weeks[1]).toMatchObject({
      activeDays: 1,
      sessionCount: 1,
      strengthSessionCount: 1,
    });
    expect(progress.weeks[2]).toMatchObject({
      activeDays: 2,
      sessionCount: 2,
      strengthSessionCount: 1,
      totalDurationSeconds: 4_800,
    });
    expect(progress.overview.sessionCount).toBe(3);
    expect(progress.overview.activeDays).toBe(3);
  });

  it("atribui o grupo primário do catálogo e cai em other quando desconhecido", () => {
    const progress = buildWorkoutProgress(
      [
        activity("groups", "2026-07-10", [
          {
            exercise_id: "supino",
            exercise: "Supino",
            reps: 10,
            weight_kg: 20,
          },
          {
            exercise_id: "misterio",
            exercise: "Exercício novo",
            reps: 15,
            weight_kg: null,
          },
        ]),
      ],
      [{ id: "supino", primary_muscle_group_slug: "chest" }],
      { today: "2026-07-12" },
    );

    expect(progress.muscleGroups.find((group) => group.slug === "chest"))
      .toMatchObject({
        exerciseCount: 1,
        sessionCount: 1,
        setCount: 1,
        totalReps: 10,
        totalVolumeKg: 200,
      });
    expect(
      progress.muscleGroups.find(
        (group) => group.slug === UNKNOWN_MUSCLE_GROUP_SLUG,
      ),
    ).toMatchObject({
      exerciseCount: 1,
      sessionCount: 1,
      setCount: 1,
      totalReps: 15,
      totalVolumeKg: 0,
    });
  });

  it("agrega uma execução por atividade e ordena pontos do antigo ao recente", () => {
    const progress = buildWorkoutProgress(
      [
        activity("new", "2026-07-11", [
          {
            exercise_id: "supino",
            exercise: "Supino",
            reps: 8,
            weight_kg: 25,
          },
        ]),
        activity("old", "2026-07-01", [
          {
            exercise_id: "supino",
            exercise: "Supino",
            reps: "10",
            weight_kg: "20",
          },
          {
            exercise_id: "supino",
            exercise: "Supino",
            reps: 10,
            weight_kg: 22.5,
          },
        ]),
      ],
      [{ id: "supino", primary_muscle_group_slug: "chest" }],
      { today: "2026-07-12" },
    );

    const exercise = progress.exercises[0];
    expect(exercise.sessionCount).toBe(2);
    expect(exercise.maxWeightKg).toBe(25);
    expect(exercise.points.map((point) => point.activityId)).toEqual([
      "old",
      "new",
    ]);
    expect(exercise.points[0]).toMatchObject({
      maxWeightKg: 22.5,
      setCount: 2,
      totalReps: 20,
      totalVolumeKg: 425,
    });
  });
});

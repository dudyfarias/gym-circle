import { describe, expect, it } from "vitest";
import {
  activityInputToRow,
  activityHealthMetadataFromRow,
  activityRowToDomain,
  strengthSetsFromRow,
  strengthSetsToRow,
  type ActivityRow,
} from "./activity";

describe("activityInputToRow", () => {
  it("sanitiza metadata do Saúde e limita a série de FC", () => {
    const metadata = activityHealthMetadataFromRow({
      heart_rate_samples: [
        { timestamp: "2026-07-16T19:47:00.000Z", bpm: 117.4 },
        { timestamp: "inválido", bpm: 999 },
      ],
      workout_effort: 3,
      total_calories_estimated: true,
    });
    expect(metadata).toMatchObject({
      heartRateSamples: [
        { timestamp: "2026-07-16T19:47:00.000Z", bpm: 117 },
      ],
      workoutEffort: 3,
      totalCaloriesEstimated: true,
    });
  });

  it("sessão web_timer: só tempo, sem gps/hr", () => {
    const row = activityInputToRow(
      {
        activityType: "strength",
        mode: "session",
        origin: "web_timer",
        startedAt: "2026-07-02T21:00:00Z",
        endedAt: "2026-07-02T21:58:00Z",
        elapsedS: 3480,
      },
      "u1",
    );
    expect(row.user_id).toBe("u1");
    expect(row.origin).toBe("web_timer");
    expect(row.distance_m).toBeNull();
    expect(row.avg_hr).toBeNull();
    expect(row.source_app).toBeNull();
    // 21:00Z = 18:00 em São Paulo → mesmo dia
    expect(row.workout_date).toBe("2026-07-02");
  });

  it("workout_date usa o fuso de São Paulo (madrugada UTC = dia anterior SP)", () => {
    const row = activityInputToRow(
      {
        activityType: "run",
        mode: "route",
        origin: "live",
        startedAt: "2026-07-03T01:30:00Z", // 22:30 de 2/jul em SP
        endedAt: "2026-07-03T02:10:00Z",
        elapsedS: 2400,
      },
      "u1",
    );
    expect(row.workout_date).toBe("2026-07-02");
  });

  it("workoutDate explícito vence o derivado", () => {
    const row = activityInputToRow(
      {
        activityType: "other",
        mode: "session",
        origin: "imported",
        sourceApp: "Strava",
        externalId: "hk-workout-1",
        startedAt: "2026-07-01T10:00:00Z",
        endedAt: "2026-07-01T11:00:00Z",
        elapsedS: 3600,
        workoutDate: "2026-06-30",
        distanceM: 8400,
        avgHr: 154,
      },
      "u2",
    );
    expect(row.workout_date).toBe("2026-06-30");
    expect(row.source_app).toBe("Strava");
    expect(row.external_id).toBe("hk-workout-1");
    expect(row.distance_m).toBe(8400);
    expect(row.avg_hr).toBe(154);
  });

  it("limita tempo em movimento à duração da atividade", () => {
    const row = activityInputToRow(
      {
        activityType: "run",
        mode: "route",
        origin: "web_timer",
        startedAt: "2026-07-15T13:50:00Z",
        endedAt: "2026-07-15T13:57:08Z",
        elapsedS: 428,
        movingS: 443,
      },
      "u1",
    );

    expect(row.elapsed_s).toBe(428);
    expect(row.moving_s).toBe(428);
  });
});

describe("activityRowToDomain", () => {
  it("mapeia snake_case → camelCase 1:1", () => {
    const row: ActivityRow = {
      id: "a1",
      user_id: "u1",
      activity_type: "strength",
      mode: "session",
      origin: "web_timer",
      source_app: null,
      external_id: null,
      started_at: "2026-07-02T21:00:00Z",
      ended_at: "2026-07-02T21:58:00Z",
      elapsed_s: 3480,
      moving_s: null,
      distance_m: null,
      elevation_gain_m: null,
      route: null,
      strength_sets: null,
      avg_hr: 132,
      max_hr: 168,
      active_calories: 480,
      total_calories: 512,
      workout_date: "2026-07-02",
      created_at: "2026-07-02T21:58:01Z",
    };
    const activity = activityRowToDomain(row);
    expect(activity).toEqual({
      id: "a1",
      userId: "u1",
      activityType: "strength",
      mode: "session",
      origin: "web_timer",
      sourceApp: null,
      externalId: null,
      startedAt: "2026-07-02T21:00:00Z",
      endedAt: "2026-07-02T21:58:00Z",
      elapsedS: 3480,
      movingS: null,
      distanceM: null,
      elevationGainM: null,
      route: null,
      strengthSets: null,
      avgHr: 132,
      maxHr: 168,
      activeCalories: 480,
      totalCalories: 512,
      healthMetadata: {
        heartRateSamples: [],
        minHr: null,
        workoutEffort: null,
        temperatureC: null,
        humidityPercent: null,
        weatherCondition: null,
        averageMets: null,
        isIndoor: null,
        sourceDevice: null,
        workoutBrandName: null,
        totalCaloriesEstimated: false,
      },
      workoutDate: "2026-07-02",
      createdAt: "2026-07-02T21:58:01Z",
      workoutPlanId: null,
      workoutPlanNameSnapshot: null,
      workoutPlanExercisesSnapshot: null,
      workoutPlanVersionSnapshot: null,
      workoutPlanStartedFrom: null,
      workoutNote: null,
      workoutExerciseContext: [],
    });
  });
});

describe("strength set catalog metadata", () => {
  it("preserva exercício, alvo e técnica no JSONB da atividade", () => {
    const sets = [
      {
        reps: 8,
        weightKg: 40,
        exercise: "Mergulho",
        exerciseId: "exercise-1",
        targetKind: "failure" as const,
        durationSeconds: null,
        techniqueId: "technique-1",
        techniqueName: "Até a falha",
        techniqueNotes: "Pare ao perder a técnica",
      },
    ];

    expect(strengthSetsFromRow(strengthSetsToRow(sets))).toEqual([
      expect.objectContaining(sets[0]),
    ]);
  });

  it("preserva série por duração sem inventar repetições", () => {
    const sets = [
      {
        reps: 0,
        weightKg: 0,
        exercise: "Prancha",
        exerciseId: "plank",
        targetKind: "duration" as const,
        durationSeconds: 45,
      },
    ];

    expect(strengthSetsToRow(sets)).toEqual([
      expect.objectContaining({
        reps: 0,
        weight_kg: null,
        target_kind: "duration",
        duration_seconds: 45,
      }),
    ]);
    expect(strengthSetsFromRow(strengthSetsToRow(sets))).toEqual([
      expect.objectContaining({
        reps: 0,
        weightKg: null,
        targetKind: "duration",
        durationSeconds: 45,
      }),
    ]);
  });

  it("preserva falha sem carga e descarta duração vazia", () => {
    expect(
      strengthSetsToRow([
        {
          reps: 12,
          weightKg: null,
          exercise: "Flexão",
          targetKind: "failure",
        },
        {
          reps: 0,
          weightKg: null,
          exercise: "Prancha",
          targetKind: "duration",
          durationSeconds: null,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        reps: 12,
        weight_kg: null,
        target_kind: "failure",
      }),
    ]);
  });

  it("normaliza cargas legadas menores ou iguais a zero", () => {
    expect(
      strengthSetsFromRow([
        { reps: 10, weight_kg: 0 },
        { reps: 8, weight_kg: -5 },
      ]),
    ).toEqual([
      expect.objectContaining({ reps: 10, weightKg: null }),
      expect.objectContaining({ reps: 8, weightKg: null }),
    ]);
  });

  it("preserva status, origem, tipo de carga e esforço opcionais", () => {
    const rows = strengthSetsToRow([
      {
        reps: 10,
        weightKg: null,
        assistedWeightKg: 25,
        exercise: "Barra assistida",
        setId: "set-1",
        setIndex: 2,
        setStatus: "completed",
        setOrigin: "planned",
        loadType: "assisted",
        rpe: 8.5,
        rir: 2,
        targetRestS: 90,
        actualRestS: 84,
        note: "Boa execução",
      },
      {
        reps: 0,
        weightKg: null,
        exercise: "Supino",
        setStatus: "skipped",
        setOrigin: "planned",
        loadType: "not_provided",
        plannedRepsMin: 8,
        plannedRepsMax: 12,
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        assisted_weight_kg: 25,
        load_type: "assisted",
        set_status: "completed",
        rpe: 8.5,
        actual_rest_s: 84,
      }),
      expect.objectContaining({
        set_status: "skipped",
        planned_reps_min: 8,
        planned_reps_max: 12,
      }),
    ]);
    expect(strengthSetsFromRow(rows)).toEqual([
      expect.objectContaining({
        assistedWeightKg: 25,
        loadType: "assisted",
        setStatus: "completed",
        rpe: 8.5,
        actualRestS: 84,
      }),
      expect.objectContaining({
        setStatus: "skipped",
        plannedRepsMin: 8,
        plannedRepsMax: 12,
      }),
    ]);
  });
});

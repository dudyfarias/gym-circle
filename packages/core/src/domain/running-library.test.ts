import { describe, expect, it } from "vitest";
import type { RunningWorkoutPlanStepDraft } from "./running";
import {
  runningProgramEnrollmentFromRow,
  runningProgramFromRow,
  runningProgramSessionCompletionFromRow,
  runningProgramSessionFromRow,
  runningSessionTemplateFromRow,
  runningSessionTemplateStepFromRow,
  type RunningProgramEnrollmentRow,
  type RunningProgramRow,
  type RunningProgramSessionCompletionRow,
  type RunningProgramSessionRow,
  type RunningSessionTemplateRow,
  type RunningSessionTemplateStepRow,
} from "./running-library";

describe("runningSessionTemplateStepFromRow", () => {
  it("mapeia o step (espelho de workout_plan_steps) para o shape do engine", () => {
    const row: RunningSessionTemplateStepRow = {
      id: "step-1",
      session_template_id: "template-1",
      position: 0,
      step_type: "interval",
      title: "6 × 400 m",
      instructions: "Forte, mas controlado",
      repetitions: 6,
      repetitions_min: null,
      repetitions_max: null,
      target_basis: "distance",
      distance_m: "400", // numeric volta como string do postgres
      distance_min_m: null,
      distance_max_m: null,
      duration_s: null,
      duration_min_s: null,
      duration_max_s: null,
      pace_min_s_per_km: 200,
      pace_max_s_per_km: 210,
      heart_rate_zone: 4,
      recovery_type: "duration",
      recovery_duration_s: 60,
      recovery_distance_m: null,
      target_effort: "8",
      metadata: { note: "pista" },
    };

    // O mapper reutiliza RunningWorkoutPlanStepDraft (o mesmo shape do engine).
    const step: RunningWorkoutPlanStepDraft =
      runningSessionTemplateStepFromRow(row);

    expect(step).toEqual({
      id: "step-1",
      position: 0,
      stepType: "interval",
      title: "6 × 400 m",
      instructions: "Forte, mas controlado",
      repetitions: 6,
      repetitionsMin: null,
      repetitionsMax: null,
      targetBasis: "distance",
      distanceM: 400,
      distanceMinM: null,
      distanceMaxM: null,
      durationS: null,
      durationMinS: null,
      durationMaxS: null,
      paceMinSPerKm: 200,
      paceMaxSPerKm: 210,
      heartRateZone: 4,
      recoveryType: "duration",
      recoveryDurationS: 60,
      recoveryDistanceM: null,
      targetEffort: 8,
      metadata: { note: "pista" },
    });
  });
});

describe("runningSessionTemplateFromRow", () => {
  it("mapeia o template oficial com seus steps aninhados", () => {
    const row: RunningSessionTemplateRow = {
      id: "template-1",
      slug: "intervalado-400",
      owner_user_id: null,
      origin: "official",
      visibility: "public",
      title: "Intervalado 6 × 400 m",
      description: "Sessão de velocidade",
      estimated_duration_s: 2700,
      estimated_distance_m: "6000",
      primary_step_type: "interval",
      is_published: true,
      created_at: "2026-07-24T12:00:00Z",
      updated_at: "2026-07-24T12:00:00Z",
    };
    const stepRows: RunningSessionTemplateStepRow[] = [
      {
        id: "step-1",
        session_template_id: "template-1",
        position: 0,
        step_type: "warmup",
        title: "Aquecimento",
        instructions: null,
        repetitions: 1,
        repetitions_min: null,
        repetitions_max: null,
        target_basis: "duration",
        distance_m: null,
        distance_min_m: null,
        distance_max_m: null,
        duration_s: 600,
        duration_min_s: null,
        duration_max_s: null,
        pace_min_s_per_km: null,
        pace_max_s_per_km: null,
        heart_rate_zone: null,
        recovery_type: "none",
        recovery_duration_s: null,
        recovery_distance_m: null,
        target_effort: null,
        metadata: {},
      },
    ];

    const template = runningSessionTemplateFromRow(row, stepRows);

    expect(template).toEqual({
      id: "template-1",
      slug: "intervalado-400",
      ownerUserId: null,
      origin: "official",
      visibility: "public",
      title: "Intervalado 6 × 400 m",
      description: "Sessão de velocidade",
      estimatedDurationS: 2700,
      estimatedDistanceM: 6000,
      primaryStepType: "interval",
      isPublished: true,
      createdAt: "2026-07-24T12:00:00Z",
      updatedAt: "2026-07-24T12:00:00Z",
      steps: [
        {
          id: "step-1",
          position: 0,
          stepType: "warmup",
          title: "Aquecimento",
          instructions: null,
          repetitions: 1,
          repetitionsMin: null,
          repetitionsMax: null,
          targetBasis: "duration",
          distanceM: null,
          distanceMinM: null,
          distanceMaxM: null,
          durationS: 600,
          durationMinS: null,
          durationMaxS: null,
          paceMinSPerKm: null,
          paceMaxSPerKm: null,
          heartRateZone: null,
          recoveryType: "none",
          recoveryDurationS: null,
          recoveryDistanceM: null,
          targetEffort: null,
          metadata: {},
        },
      ],
    });
  });

  it("assume lista de steps vazia quando não informada", () => {
    const row: RunningSessionTemplateRow = {
      id: "template-2",
      slug: "corrida-leve",
      owner_user_id: "user-1",
      origin: "professional",
      visibility: "assigned",
      title: "Corrida leve",
      description: null,
      estimated_duration_s: null,
      estimated_distance_m: null,
      primary_step_type: null,
      is_published: false,
      created_at: "2026-07-24T12:00:00Z",
      updated_at: "2026-07-24T12:00:00Z",
    };

    const template = runningSessionTemplateFromRow(row);

    expect(template).toMatchObject({
      id: "template-2",
      ownerUserId: "user-1",
      origin: "professional",
      visibility: "assigned",
      estimatedDurationS: null,
      estimatedDistanceM: null,
      primaryStepType: null,
      isPublished: false,
      steps: [],
    });
  });
});

describe("runningProgramFromRow", () => {
  it("mapeia o programa multi-semana com facetas", () => {
    const row: RunningProgramRow = {
      id: "program-1",
      slug: "5k-iniciante",
      owner_user_id: null,
      origin: "official",
      visibility: "public",
      title: "Primeiro 5 km",
      description: "8 semanas para o primeiro 5 km",
      level: "beginner",
      goal: "first_5k",
      weeks: 8,
      sessions_per_week: 3,
      time_bucket: 30,
      suggested_spacing: "seg/qua/sex",
      is_published: true,
      created_at: "2026-07-24T12:00:00Z",
      updated_at: "2026-07-24T12:00:00Z",
    };

    expect(runningProgramFromRow(row)).toEqual({
      id: "program-1",
      slug: "5k-iniciante",
      ownerUserId: null,
      origin: "official",
      visibility: "public",
      title: "Primeiro 5 km",
      description: "8 semanas para o primeiro 5 km",
      level: "beginner",
      goal: "first_5k",
      weeks: 8,
      sessionsPerWeek: 3,
      timeBucket: 30,
      suggestedSpacing: "seg/qua/sex",
      isPublished: true,
      createdAt: "2026-07-24T12:00:00Z",
      updatedAt: "2026-07-24T12:00:00Z",
    });
  });
});

describe("runningProgramSessionFromRow", () => {
  it("mapeia o slot semana × ordem → template", () => {
    const row: RunningProgramSessionRow = {
      id: "slot-1",
      program_id: "program-1",
      week_index: 1,
      order_in_week: 2,
      session_template_id: "template-1",
      notes: "Faça no fim de semana",
    };

    expect(runningProgramSessionFromRow(row)).toEqual({
      id: "slot-1",
      programId: "program-1",
      weekIndex: 1,
      orderInWeek: 2,
      sessionTemplateId: "template-1",
      notes: "Faça no fim de semana",
    });
  });
});

describe("runningProgramEnrollmentFromRow", () => {
  it("mapeia o estado de matrícula do usuário", () => {
    const row: RunningProgramEnrollmentRow = {
      id: "enrollment-1",
      user_id: "user-1",
      program_id: "program-1",
      status: "active",
      started_at: "2026-07-24T12:00:00Z",
      completed_at: null,
    };

    expect(runningProgramEnrollmentFromRow(row)).toEqual({
      id: "enrollment-1",
      userId: "user-1",
      programId: "program-1",
      status: "active",
      startedAt: "2026-07-24T12:00:00Z",
      completedAt: null,
    });
  });
});

describe("runningProgramSessionCompletionFromRow", () => {
  it("mapeia a conclusão idempotente de uma sessão via atividade", () => {
    const row: RunningProgramSessionCompletionRow = {
      id: "completion-1",
      enrollment_id: "enrollment-1",
      program_session_id: "slot-1",
      activity_id: "activity-1",
      completed_at: "2026-07-24T13:00:00Z",
    };

    expect(runningProgramSessionCompletionFromRow(row)).toEqual({
      id: "completion-1",
      enrollmentId: "enrollment-1",
      programSessionId: "slot-1",
      activityId: "activity-1",
      completedAt: "2026-07-24T13:00:00Z",
    });
  });
});

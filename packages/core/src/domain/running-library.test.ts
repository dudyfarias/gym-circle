import { describe, expect, it } from "vitest";
import type { RunningWorkoutPlanStepDraft } from "./running";
import { createRunningSessionState } from "./running-session";
import {
  buildRunningTimeline,
  computeProgramProgress,
  resolveNextProgramSession,
  runningProgramEnrollmentFromRow,
  runningProgramFromRow,
  runningProgramSessionCompletionFromRow,
  runningProgramSessionFromRow,
  runningSessionTemplateFromRow,
  runningSessionTemplateStepFromRow,
  sessionTemplateToEngineBlocks,
  sessionTemplateToRunningPlan,
  type RunningProgramEnrollmentRow,
  type RunningProgramRow,
  type RunningProgramSession,
  type RunningProgramSessionCompletionRow,
  type RunningProgramSessionRow,
  type RunningSessionTemplate,
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

describe("resolveNextProgramSession", () => {
  const sessions = [
    { id: "a", weekIndex: 1, orderInWeek: 1 } as RunningProgramSession,
    { id: "b", weekIndex: 1, orderInWeek: 2 } as RunningProgramSession,
    { id: "c", weekIndex: 2, orderInWeek: 1 } as RunningProgramSession,
  ];

  it("próxima sessão = menor semana/ordem não concluída", () => {
    expect(resolveNextProgramSession(sessions, new Set(["a"]))?.id).toBe("b");
    expect(
      resolveNextProgramSession(sessions, new Set(["a", "b", "c"])),
    ).toBeNull();
  });

  it("acha o mínimo real independente da ordem do array", () => {
    const outOfOrder = [
      { id: "c", weekIndex: 2, orderInWeek: 1 } as RunningProgramSession,
      { id: "b", weekIndex: 1, orderInWeek: 2 } as RunningProgramSession,
      { id: "a", weekIndex: 1, orderInWeek: 1 } as RunningProgramSession,
    ];
    expect(resolveNextProgramSession(outOfOrder, new Set())?.id).toBe("a");
    expect(resolveNextProgramSession(outOfOrder, new Set(["a"]))?.id).toBe("b");
    expect(resolveNextProgramSession(outOfOrder, new Set(["a", "b"]))?.id).toBe(
      "c",
    );
  });

  it("retorna null quando a lista está vazia", () => {
    expect(resolveNextProgramSession([], new Set())).toBeNull();
  });
});

describe("computeProgramProgress", () => {
  it("progresso", () => {
    expect(computeProgramProgress(3, 1)).toEqual({
      done: 1,
      total: 3,
      pct: 33,
    });
    expect(computeProgramProgress(0, 0)).toEqual({
      done: 0,
      total: 0,
      pct: 0,
    });
  });

  it("arredonda e cobre 0% e 100%", () => {
    expect(computeProgramProgress(4, 1)).toEqual({
      done: 1,
      total: 4,
      pct: 25,
    });
    expect(computeProgramProgress(8, 0)).toEqual({
      done: 0,
      total: 8,
      pct: 0,
    });
    expect(computeProgramProgress(8, 8)).toEqual({
      done: 8,
      total: 8,
      pct: 100,
    });
  });
});

describe("sessionTemplateToEngineBlocks", () => {
  const steps: RunningWorkoutPlanStepDraft[] = [
    {
      position: 0,
      stepType: "warmup",
      title: "Aquecimento",
      repetitions: 1,
      targetBasis: "duration",
      durationS: 600,
      recoveryType: "none",
    },
    {
      position: 1,
      stepType: "interval",
      title: "6 × 400 m",
      repetitions: 6,
      targetBasis: "distance",
      distanceM: 400,
      recoveryType: "duration",
      recoveryDurationS: 60,
    },
  ];

  it("adaptador projeta steps no shape da engine", () => {
    const blocks = sessionTemplateToEngineBlocks({ steps });
    expect(blocks).toHaveLength(2);
    expect(blocks[0].targetBasis).toBe("duration");
    expect(blocks[1].targetBasis).toBe("distance");
    expect(blocks[1].repetitions).toBe(6);
  });

  it("os blocos alimentam o engine guiado sem transformação extra", () => {
    const blocks = sessionTemplateToEngineBlocks({ steps });
    const state = createRunningSessionState({
      id: "plan-1",
      userId: "user-1",
      sportType: "run",
      name: "Sessão avulsa",
      description: null,
      level: "beginner",
      goal: "improve_5k",
      source: "professional",
      sourceMetadata: {},
      planVersion: 1,
      isFavorite: false,
      estimatedDurationS: null,
      estimatedDistanceM: null,
      createdAt: "2026-07-24T12:00:00Z",
      updatedAt: "2026-07-24T12:00:00Z",
      steps: blocks,
    });
    // 1 warmup + 6 intervalos + 5 recuperações = 12 segmentos.
    expect(state.segments).toHaveLength(12);
    expect(state.status).toBe("idle");
  });
});

describe("sessionTemplateToRunningPlan", () => {
  const template: RunningSessionTemplate = {
    id: "template-1",
    slug: "intervalado-leve",
    ownerUserId: null,
    origin: "official",
    visibility: "public",
    title: "Intervalado leve",
    description: "Sessão-farol",
    estimatedDurationS: null,
    estimatedDistanceM: null,
    primaryStepType: "interval",
    isPublished: true,
    createdAt: "2026-07-24T12:00:00Z",
    updatedAt: "2026-07-24T12:00:00Z",
    steps: [
      {
        position: 0,
        stepType: "warmup",
        title: "Aquecimento",
        repetitions: 1,
        targetBasis: "duration",
        durationS: 600,
        recoveryType: "none",
      },
      {
        position: 1,
        stepType: "interval",
        title: "6 × 400 m",
        repetitions: 6,
        targetBasis: "distance",
        distanceM: 400,
        recoveryType: "duration",
        recoveryDurationS: 60,
      },
    ],
  };

  it("empacota o template no shape RunningWorkoutPlan da engine", () => {
    const plan = sessionTemplateToRunningPlan(template);
    expect(plan.id).toBe("template-1");
    expect(plan.name).toBe("Intervalado leve");
    expect(plan.sportType).toBe("run");
    expect(plan.steps).toHaveLength(2);
    // origem oficial → source "manual"; metadado preserva o vínculo à sessão.
    expect(plan.source).toBe("manual");
    expect(plan.sourceMetadata).toMatchObject({
      sessionTemplateId: "template-1",
      origin: "official",
    });
  });

  it("estima duração/distância pelos steps quando a coluna vem nula", () => {
    const plan = sessionTemplateToRunningPlan(template);
    // 600s warmup + 6×recuperações não implicam duração de trabalho conhecida,
    // mas o warmup por duração garante um total > 0.
    expect(plan.estimatedDurationS).not.toBeNull();
    expect(plan.estimatedDistanceM).not.toBeNull();
  });

  it("origem professional → source professional", () => {
    const plan = sessionTemplateToRunningPlan({
      ...template,
      origin: "professional",
    });
    expect(plan.source).toBe("professional");
  });

  it("o plano sintético alimenta o engine guiado (12 segmentos)", () => {
    const plan = sessionTemplateToRunningPlan(template);
    const state = createRunningSessionState(plan);
    expect(state.segments).toHaveLength(12);
    expect(state.status).toBe("idle");
  });
});

describe("buildRunningTimeline", () => {
  it("timeline colapsa 6× num nó só", () => {
    const steps: RunningWorkoutPlanStepDraft[] = [
      {
        position: 0,
        stepType: "warmup",
        title: "Aquecimento",
        repetitions: 1,
        targetBasis: "duration",
        durationS: 600,
        recoveryType: "none",
      },
      {
        position: 1,
        stepType: "interval",
        title: "6 × 400 m",
        repetitions: 6,
        targetBasis: "distance",
        distanceM: 400,
        recoveryType: "duration",
        recoveryDurationS: 60,
        heartRateZone: 4,
        targetEffort: 8,
      },
      {
        position: 2,
        stepType: "cooldown",
        title: "Desaquecimento",
        repetitions: 1,
        targetBasis: "duration",
        durationS: 300,
        recoveryType: "none",
      },
    ];
    const rawStepCount = steps.reduce(
      (sum, step) => sum + step.repetitions,
      0,
    ); // 8 se fosse expandido

    const nodes = buildRunningTimeline(steps);

    expect(nodes).toHaveLength(3);
    expect(nodes.length).toBeLessThan(rawStepCount);
    const interval = nodes[1];
    expect(interval.repetitions).toBe(6);
    expect(interval.effort).toBe(8);
    expect(interval.zone).toBe(4);
    expect(interval.label).toBe("6 × 400 m");
    expect(interval.colorToken).toBe("work");
  });

  it("atribui tokens de cor por step_type", () => {
    const nodes = buildRunningTimeline([
      {
        position: 0,
        stepType: "warmup",
        title: "W",
        repetitions: 1,
        targetBasis: "duration",
        durationS: 600,
        recoveryType: "none",
      },
      {
        position: 1,
        stepType: "recovery",
        title: "R",
        repetitions: 1,
        targetBasis: "duration",
        durationS: 120,
        recoveryType: "none",
      },
      {
        position: 2,
        stepType: "cooldown",
        title: "C",
        repetitions: 1,
        targetBasis: "duration",
        durationS: 300,
        recoveryType: "none",
      },
      {
        position: 3,
        stepType: "easy",
        title: "E",
        repetitions: 1,
        targetBasis: "duration",
        durationS: 900,
        recoveryType: "none",
      },
    ]);
    expect(nodes.map((node) => node.colorToken)).toEqual([
      "start",
      "recovery",
      "end",
      "neutral",
    ]);
  });

  it("passa effort/zone como null quando ausentes e mantém repetitions:1 num nó", () => {
    const nodes = buildRunningTimeline([
      {
        position: 0,
        stepType: "easy",
        title: "Leve",
        repetitions: 1,
        targetBasis: "duration",
        durationS: 1200,
        recoveryType: "none",
      },
    ]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({
      stepType: "easy",
      label: "Leve",
      repetitions: 1,
      effort: null,
      zone: null,
      colorToken: "neutral",
    });
  });
});

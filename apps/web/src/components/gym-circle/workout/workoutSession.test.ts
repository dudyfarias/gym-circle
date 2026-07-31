import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRunningSessionState,
  startRunningSession,
  type RunningWorkoutPlan,
} from "@gym-circle/core/domain";
import {
  appendWorkoutRoutePoint,
  bestWorkoutRouteSummary,
  createAddedStrengthExerciseSet,
  distanceBetweenRoutePoints,
  formatAveragePace,
  mergeWorkoutRouteSnapshot,
  pauseWorkoutSession,
  readStoredWorkoutSession,
  recordStrengthSetActualRest,
  resumeWorkoutSession,
  shouldAutoCompleteStrengthSet,
  type StoredWorkoutSession,
  workoutElapsedSeconds,
  workoutPausedSeconds,
  workoutRestElapsedSeconds,
  workoutRouteCoordinates,
  writeStoredWorkoutSession,
  workoutStorageKey,
} from "./workoutSession";

afterEach(() => {
  vi.unstubAllGlobals();
});

const base: StoredWorkoutSession = {
  version: 5,
  ownerUserId: "user-a",
  clientSessionId: "00000000-0000-4000-8000-000000000001",
  startedAtMs: 1_000,
  activityType: "run",
  workoutPlan: null,
  pausedAtMs: null,
  pausedTotalMs: 0,
  distanceM: 0,
  movingS: 0,
  elevationGainM: 0,
  restCount: 0,
  restTimer: {
    status: "idle",
    presetS: 60,
    remainingS: 60,
    endsAtMs: null,
  },
  restSetClientId: null,
  workoutNote: "",
  exerciseNotes: {},
  strengthSets: [],
  completedStrengthSetIds: [],
  routePoints: [],
  lastRoutePoint: null,
};

function installStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  return values;
}

describe("workout session clock", () => {
  it("excludes completed and current pauses from elapsed time", () => {
    const paused = pauseWorkoutSession(base, 11_000);
    expect(workoutElapsedSeconds(paused, 16_000)).toBe(10);
    expect(workoutPausedSeconds(paused, 16_000)).toBe(5);
    const resumed = resumeWorkoutSession(paused, 16_000);
    expect(workoutElapsedSeconds(resumed, 21_000)).toBe(15);
    expect(workoutPausedSeconds(resumed, 21_000)).toBe(5);
  });
});

describe("strength set completion", () => {
  it("cria série adicionada durante o treino com os padrões do catálogo", () => {
    expect(
      createAddedStrengthExerciseSet({
        clientId: "set-added-1",
        exerciseId: "exercise-supino",
        exerciseName: "Supino reto com barra",
        loadType: "external",
        targetKind: "reps",
        plannedReps: 10,
        targetRestS: 90,
      }),
    ).toEqual(
      expect.objectContaining({
        clientId: "set-added-1",
        exerciseId: "exercise-supino",
        exercise: "Supino reto com barra",
        setStatus: "added",
        setOrigin: "added",
        loadType: "external",
        reps: 0,
        weightKg: null,
        plannedReps: 10,
        targetRestS: 90,
      }),
    );
  });

  it("mantém série até a falha pendente até o check explícito", () => {
    expect(
      shouldAutoCompleteStrengthSet({
        reps: 10,
        targetKind: "failure",
        weightKg: null,
        wasCompleted: false,
      }),
    ).toBe(false);
    expect(
      shouldAutoCompleteStrengthSet({
        reps: 10,
        targetKind: "failure",
        weightKg: 20,
        wasCompleted: false,
      }),
    ).toBe(false);
  });

  it("preserva conclusão existente ao editar carga e reps", () => {
    expect(
      shouldAutoCompleteStrengthSet({
        reps: 8,
        targetKind: "failure",
        weightKg: 25,
        wasCompleted: true,
      }),
    ).toBe(true);
  });

  it("mantém o preenchimento rápido para série normal ponderada", () => {
    expect(
      shouldAutoCompleteStrengthSet({
        reps: 12,
        targetKind: "reps",
        weightKg: 30,
        wasCompleted: false,
      }),
    ).toBe(true);
  });
});

describe("strength set rest tracking", () => {
  it("calcula o descanso cumprido mesmo quando o usuário pula o timer", () => {
    expect(
      workoutRestElapsedSeconds({
        status: "running",
        presetS: 60,
        remainingS: 38,
        endsAtMs: 40_000,
      }),
    ).toBe(22);
  });

  it("associa o descanso somente à série que iniciou o timer", () => {
    const sets = [
      { clientId: "set-1", reps: 10, weightKg: 20 },
      { clientId: "set-2", reps: 8, weightKg: 25 },
    ];

    const result = recordStrengthSetActualRest(sets, "set-1", 61);
    expect(result[0]).toEqual(
      expect.objectContaining({ clientId: "set-1", actualRestS: 61 }),
    );
    expect(result[1]).toBe(sets[1]);
  });
});

describe("workout session storage", () => {
  it("restaura a máquina de estados de uma corrida guiada", () => {
    installStorage();
    const plan: RunningWorkoutPlan = {
      id: "running-plan-1",
      userId: "user-a",
      name: "Corrida leve",
      description: null,
      level: "beginner",
      goal: "first_5k",
      source: "manual",
      sourceMetadata: {},
      sportType: "run",
      planVersion: 1,
      isFavorite: false,
      estimatedDurationS: 600,
      estimatedDistanceM: null,
      createdAt: "2026-07-24T10:00:00.000Z",
      updatedAt: "2026-07-24T10:00:00.000Z",
      steps: [
        {
          id: "step-1",
          position: 0,
          stepType: "easy",
          title: "Corrida leve",
          repetitions: 1,
          targetBasis: "duration",
          durationS: 600,
          recoveryType: "none",
        },
      ],
    };
    const guidedRunning = startRunningSession(
      createRunningSessionState(plan),
      { atMs: 1_000, elapsedS: 0, distanceM: 0 },
    ).state;

    writeStoredWorkoutSession("user-a", {
      ...base,
      guidedRunning,
    });

    expect(readStoredWorkoutSession("user-a")?.guidedRunning).toEqual(
      expect.objectContaining({
        status: "running",
        activeSegmentIndex: 0,
        plan: expect.objectContaining({ id: "running-plan-1" }),
      }),
    );
  });

  it("restaura séries e conclusões de uma sessão de musculação", () => {
    installStorage();
    const strengthSession: StoredWorkoutSession = {
      ...base,
      activityType: "strength",
      restSetClientId: "set-1",
      strengthSets: [
        {
          clientId: "set-1",
          reps: 10,
          weightKg: 20,
          exercise: "Supino",
          targetKind: "reps",
          plannedReps: 10,
        },
      ],
      completedStrengthSetIds: ["set-1"],
    };

    writeStoredWorkoutSession("user-a", strengthSession);

    expect(readStoredWorkoutSession("user-a")).toEqual(
      expect.objectContaining({
        activityType: "strength",
        completedStrengthSetIds: ["set-1"],
        restSetClientId: "set-1",
        strengthSets: [
          expect.objectContaining({
            clientId: "set-1",
            exercise: "Supino",
            plannedReps: 10,
            reps: 10,
            weightKg: 20,
          }),
        ],
      }),
    );
  });

  it("não reivindica sessão global legada sem dono", () => {
    const legacy = JSON.stringify({
      ...base,
      version: 4,
      startedAtMs: 42_000,
      distanceM: 850,
    });
    const values = installStorage({ "gc-web-workout": legacy });

    expect(readStoredWorkoutSession("user-a")).toBeNull();
    expect(values.has("gc-web-workout")).toBe(false);
  });

  it("isola rascunhos entre contas no mesmo aparelho", () => {
    installStorage();
    writeStoredWorkoutSession("user-a", base);

    expect(readStoredWorkoutSession("user-a")?.clientSessionId).toBe(
      base.clientSessionId,
    );
    expect(readStoredWorkoutSession("user-b")).toBeNull();
  });

  it("remove conclusões órfãs e normaliza carga inválida no restore", () => {
    const storedValue = JSON.stringify({
      ...base,
      activityType: "strength",
      strengthSets: [
        {
          clientId: "duration-1",
          reps: 0,
          weightKg: 0,
          targetKind: "duration",
          durationSeconds: 30,
          plannedDurationSeconds: 30,
        },
      ],
      completedStrengthSetIds: ["duration-1", "duration-1", "missing"],
    });
    installStorage({
      [workoutStorageKey("user-a")]: storedValue,
    });

    expect(readStoredWorkoutSession("user-a")).toEqual(
      expect.objectContaining({
        completedStrengthSetIds: ["duration-1"],
        strengthSets: [
          expect.objectContaining({
            clientId: "duration-1",
            durationSeconds: 30,
            plannedDurationSeconds: 30,
            weightKg: null,
          }),
        ],
      }),
    );
  });
});

describe("workout route metrics", () => {
  it("calculates distance and average pace from real coordinates", () => {
    const distance = distanceBetweenRoutePoints(
      {
        latitude: -23.536,
        longitude: -46.675,
        altitude: null,
        timestampMs: 1_000,
      },
      {
        latitude: -23.527,
        longitude: -46.675,
        altitude: null,
        timestampMs: 361_000,
      },
    );
    expect(distance).toBeGreaterThan(990);
    expect(distance).toBeLessThan(1_010);
    expect(formatAveragePace(360, distance)).toBe("6:00");
  });

  it("acumula passos menores que 2 m em vez de perder uma caminhada", () => {
    let session = base;
    for (let index = 0; index <= 10; index += 1) {
      session = appendWorkoutRoutePoint(session, {
        latitude: -23.536 + index * 0.00001,
        longitude: -46.675,
        altitude: null,
        accuracyM: 5,
        timestampMs: 1_000 + index * 1_000,
      });
    }
    expect(session.distanceM).toBeGreaterThan(9);
    expect(session.movingS).toBeGreaterThan(0);
  });

  it("mantém o fallback web compatível quando a velocidade não está disponível", () => {
    const first = appendWorkoutRoutePoint(base, {
      latitude: -23.536,
      longitude: -46.675,
      altitude: null,
      accuracyM: 80,
      timestampMs: 1_000,
    });
    const second = appendWorkoutRoutePoint(first, {
      latitude: -23.5358,
      longitude: -46.675,
      altitude: null,
      accuracyM: 80,
      timestampMs: 11_000,
    });

    expect(second.distanceM).toBeGreaterThan(20);
    expect(second.movingS).toBe(10);
  });

  it("ignora deriva quando o sensor confirma que o aparelho está parado", () => {
    const first = appendWorkoutRoutePoint(base, {
      latitude: -23.536,
      longitude: -46.675,
      altitude: null,
      accuracyM: 12,
      speedMps: 0,
      timestampMs: 1_000,
    });
    const drift = appendWorkoutRoutePoint(first, {
      latitude: -23.5358,
      longitude: -46.675,
      altitude: null,
      accuracyM: 12,
      speedMps: 0.12,
      timestampMs: 11_000,
    });

    expect(drift.distanceM).toBe(0);
    expect(drift.movingS).toBe(0);
    expect(drift.lastRoutePoint).toEqual(
      expect.objectContaining({ timestampMs: 1_000 }),
    );
  });

  it("não conta o retorno à origem depois de uma deriva rejeitada", () => {
    const first = appendWorkoutRoutePoint(base, {
      latitude: -23.536,
      longitude: -46.675,
      altitude: null,
      accuracyM: 12,
      speedMps: 0,
      timestampMs: 1_000,
    });
    const drift = appendWorkoutRoutePoint(first, {
      latitude: -23.5358,
      longitude: -46.675,
      altitude: null,
      accuracyM: 12,
      speedMps: 0.12,
      timestampMs: 11_000,
    });
    const returned = appendWorkoutRoutePoint(drift, {
      latitude: -23.536,
      longitude: -46.675,
      altitude: null,
      accuracyM: 12,
      speedMps: 0.08,
      timestampMs: 21_000,
    });

    expect(returned.distanceM).toBe(0);
    expect(returned.movingS).toBe(0);
  });

  it("preserva caminhada lenta quando deslocamento e sensor são coerentes", () => {
    const first = appendWorkoutRoutePoint(base, {
      latitude: -23.536,
      longitude: -46.675,
      altitude: null,
      accuracyM: 8,
      speedMps: 0.3,
      timestampMs: 1_000,
    });
    const moving = appendWorkoutRoutePoint(first, {
      latitude: -23.53597,
      longitude: -46.675,
      altitude: null,
      accuracyM: 8,
      speedMps: 0.3,
      timestampMs: 11_000,
    });

    expect(moving.distanceM).toBeGreaterThan(3);
    expect(moving.movingS).toBe(0);
  });

  it("não infla moving time após um período parado", () => {
    const first = appendWorkoutRoutePoint(base, {
      latitude: -23.536,
      longitude: -46.675,
      altitude: null,
      accuracyM: 6,
      speedMps: 0,
      timestampMs: 1_000,
    });
    const moving = appendWorkoutRoutePoint(first, {
      latitude: -23.5359,
      longitude: -46.675,
      altitude: null,
      accuracyM: 6,
      speedMps: 1.2,
      timestampMs: 61_000,
    });

    expect(moving.distanceM).toBeGreaterThan(10);
    expect(moving.movingS).toBe(0);
  });

  it("aceita caminhada real mesmo com precisão urbana fraca", () => {
    const first = appendWorkoutRoutePoint(base, {
      latitude: -23.536,
      longitude: -46.675,
      altitude: null,
      accuracyM: 60,
      speedMps: 1.2,
      timestampMs: 1_000,
    });
    const moving = appendWorkoutRoutePoint(first, {
      latitude: -23.5357,
      longitude: -46.675,
      altitude: null,
      accuracyM: 60,
      speedMps: 1.2,
      timestampMs: 31_000,
    });

    expect(moving.distanceM).toBeGreaterThan(30);
    expect(moving.movingS).toBe(30);
  });

  it("rejeita salto impossível mesmo com precisão fraca e speed plausível", () => {
    const first = appendWorkoutRoutePoint(base, {
      latitude: -23.536,
      longitude: -46.675,
      altitude: null,
      accuracyM: 80,
      speedMps: 1,
      timestampMs: 1_000,
    });
    const jumped = appendWorkoutRoutePoint(first, {
      latitude: -23.53465,
      longitude: -46.675,
      altitude: null,
      accuracyM: 80,
      speedMps: 1,
      timestampMs: 11_000,
    });

    expect(jumped.distanceM).toBe(0);
    expect(jumped.movingS).toBe(0);
    expect(jumped.lastRoutePoint).toEqual(
      expect.objectContaining({ timestampMs: 1_000 }),
    );
  });

  it("rejeita salto abaixo do teto da corrida quando diverge do sensor", () => {
    const first = appendWorkoutRoutePoint(base, {
      latitude: -23.536,
      longitude: -46.675,
      altitude: null,
      accuracyM: 80,
      speedMps: 1,
      timestampMs: 1_000,
    });
    const jumped = appendWorkoutRoutePoint(first, {
      latitude: -23.5351,
      longitude: -46.675,
      altitude: null,
      accuracyM: 80,
      speedMps: 1,
      timestampMs: 11_000,
    });

    expect(jumped.distanceM).toBe(0);
    expect(jumped.movingS).toBe(0);
  });

  it("rejeita salto de bike que o teto modal isolado aceitaria", () => {
    const rideSession = { ...base, activityType: "ride" as const };
    const first = appendWorkoutRoutePoint(rideSession, {
      latitude: -23.536,
      longitude: -46.675,
      altitude: null,
      accuracyM: 80,
      speedMps: 1,
      timestampMs: 1_000,
    });
    const jumped = appendWorkoutRoutePoint(first, {
      latitude: -23.53465,
      longitude: -46.675,
      altitude: null,
      accuracyM: 80,
      speedMps: 1,
      timestampMs: 11_000,
    });

    expect(jumped.distanceM).toBe(0);
    expect(jumped.movingS).toBe(0);
  });

  it("mantém deslocamento real quando a velocidade do sensor é plausível", () => {
    const first = appendWorkoutRoutePoint(base, {
      latitude: -23.536,
      longitude: -46.675,
      altitude: null,
      accuracyM: 6,
      speedMps: 1.2,
      timestampMs: 1_000,
    });
    const moving = appendWorkoutRoutePoint(first, {
      latitude: -23.5359,
      longitude: -46.675,
      altitude: null,
      accuracyM: 6,
      speedMps: 1.2,
      timestampMs: 11_000,
    });

    expect(moving.distanceM).toBeGreaterThan(10);
    expect(moving.movingS).toBe(10);
  });

  it("contabiliza pontos atrasados enquanto o iPhone está bloqueado", () => {
    const first = appendWorkoutRoutePoint(base, {
      latitude: -23.536,
      longitude: -46.675,
      altitude: null,
      accuracyM: 12,
      timestampMs: 1_000,
    });
    const second = appendWorkoutRoutePoint(first, {
      latitude: -23.535,
      longitude: -46.675,
      altitude: null,
      accuracyM: 12,
      timestampMs: 91_000,
    });

    expect(second.distanceM).toBeGreaterThan(100);
    expect(second.movingS).toBe(90);
  });

  it("não liga automaticamente trechos separados por mais de dez minutos", () => {
    const first = appendWorkoutRoutePoint(base, {
      latitude: -23.536,
      longitude: -46.675,
      altitude: null,
      accuracyM: 12,
      timestampMs: 1_000,
    });
    const second = appendWorkoutRoutePoint(first, {
      latitude: -23.526,
      longitude: -46.675,
      altitude: null,
      accuracyM: 12,
      timestampMs: 602_000,
    });

    expect(second.distanceM).toBe(0);
    expect(second.movingS).toBe(0);
    expect(second.lastRoutePoint).toEqual(
      expect.objectContaining({ timestampMs: 602_000 }),
    );
  });

  it("contabiliza ida e volta pelo mesmo caminho e gera a polyline", () => {
    const latitudes = [-23.536, -23.5358, -23.536];
    const session = latitudes.reduce(
      (current, latitude, index) =>
        appendWorkoutRoutePoint(current, {
          latitude,
          longitude: -46.675,
          altitude: null,
          accuracyM: 5,
          timestampMs: 1_000 + index * 10_000,
        }),
      base,
    );
    expect(session.distanceM).toBeGreaterThan(40);
    expect(workoutRouteCoordinates(session)?.length).toBeGreaterThanOrEqual(3);
  });

  it("mantém a medição web quando o snapshot nativo chega zerado", () => {
    const webSession = {
      ...base,
      distanceM: 651,
      movingS: 521,
      elevationGainM: 16,
    };

    expect(
      mergeWorkoutRouteSnapshot(webSession, {
        distanceM: 0,
        movingS: 0,
        elevationGainM: 0,
        route: [],
      }),
    ).toEqual(
      expect.objectContaining({
        distanceM: 651,
        movingS: 521,
        elevationGainM: 16,
      }),
    );
  });

  it("usa a melhor fonte sem somar distância nativa e web", () => {
    const webSession = {
      ...base,
      distanceM: 640,
      movingS: 500,
      elevationGainM: 10,
    };

    expect(
      bestWorkoutRouteSummary(webSession, {
        distanceM: 651,
        movingS: 521,
        elevationGainM: 16,
        route: [
          [-23.53, -46.67],
          [-23.52, -46.66],
        ],
      }),
    ).toEqual({
      distanceM: 651,
      movingS: 521,
      elevationGainM: 16,
      route: [
        [-23.53, -46.67],
        [-23.52, -46.66],
      ],
    });
  });
});

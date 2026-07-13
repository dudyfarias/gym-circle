import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendWorkoutRoutePoint,
  distanceBetweenRoutePoints,
  formatAveragePace,
  pauseWorkoutSession,
  readStoredWorkoutSession,
  resumeWorkoutSession,
  shouldAutoCompleteStrengthSet,
  type StoredWorkoutSession,
  workoutElapsedSeconds,
  workoutPausedSeconds,
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

describe("workout session storage", () => {
  it("restaura séries e conclusões de uma sessão de musculação", () => {
    installStorage();
    const strengthSession: StoredWorkoutSession = {
      ...base,
      activityType: "strength",
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
});

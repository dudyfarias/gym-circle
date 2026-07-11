import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendWorkoutRoutePoint,
  distanceBetweenRoutePoints,
  formatAveragePace,
  pauseWorkoutSession,
  readStoredWorkoutSession,
  resumeWorkoutSession,
  type StoredWorkoutSession,
  workoutElapsedSeconds,
  workoutPausedSeconds,
  workoutRouteCoordinates,
  writeStoredWorkoutSession,
} from "./workoutSession";

afterEach(() => {
  vi.unstubAllGlobals();
});

const base: StoredWorkoutSession = {
  version: 4,
  startedAtMs: 1_000,
  activityType: "run",
  pausedAtMs: null,
  pausedTotalMs: 0,
  distanceM: 0,
  movingS: 0,
  elevationGainM: 0,
  restCount: 0,
  strengthSets: [],
  completedStrengthSetIds: [],
  routePoints: [],
  lastRoutePoint: null,
};

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

describe("workout session storage", () => {
  it("restaura séries e conclusões de uma sessão de musculação", () => {
    let storedValue: string | null = null;
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => storedValue,
        removeItem: () => {
          storedValue = null;
        },
        setItem: (_key: string, value: string) => {
          storedValue = value;
        },
      },
    });
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

    writeStoredWorkoutSession(strengthSession);

    expect(readStoredWorkoutSession()).toEqual(
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

  it("migra uma sessão v3 mantendo relógio e rota", () => {
    const storedValue = JSON.stringify({
      ...base,
      version: 3,
      startedAtMs: 42_000,
      distanceM: 850,
      strengthSets: undefined,
      completedStrengthSetIds: undefined,
    });
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => storedValue,
      },
    });

    expect(readStoredWorkoutSession()).toEqual(
      expect.objectContaining({
        version: 4,
        startedAtMs: 42_000,
        distanceM: 850,
        strengthSets: [],
        completedStrengthSetIds: [],
      }),
    );
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
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => storedValue,
      },
    });

    expect(readStoredWorkoutSession()).toEqual(
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

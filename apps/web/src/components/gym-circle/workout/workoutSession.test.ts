import { describe, expect, it } from "vitest";
import {
  appendWorkoutRoutePoint,
  distanceBetweenRoutePoints,
  formatAveragePace,
  pauseWorkoutSession,
  resumeWorkoutSession,
  type StoredWorkoutSession,
  workoutElapsedSeconds,
  workoutPausedSeconds,
  workoutRouteCoordinates,
} from "./workoutSession";

const base: StoredWorkoutSession = {
  version: 3,
  startedAtMs: 1_000,
  activityType: "run",
  pausedAtMs: null,
  pausedTotalMs: 0,
  distanceM: 0,
  movingS: 0,
  elevationGainM: 0,
  restCount: 0,
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

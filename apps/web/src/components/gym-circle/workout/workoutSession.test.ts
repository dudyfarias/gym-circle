import { describe, expect, it } from "vitest";
import {
  distanceBetweenRoutePoints,
  formatAveragePace,
  pauseWorkoutSession,
  resumeWorkoutSession,
  type StoredWorkoutSession,
  workoutElapsedSeconds,
  workoutPausedSeconds,
} from "./workoutSession";

const base: StoredWorkoutSession = {
  version: 2,
  startedAtMs: 1_000,
  activityType: "run",
  pausedAtMs: null,
  pausedTotalMs: 0,
  distanceM: 0,
  elevationGainM: 0,
  restCount: 0,
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
});

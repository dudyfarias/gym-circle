import { describe, expect, it } from "vitest";
import {
  distanceFromActivityRoute,
  normalizeActivitySource,
  mergeHydratedWorkoutDetail,
  normalizedMovingSeconds,
  resolveActivityRoute,
  resolveActivityTime,
  sanitizeActivityRoute,
} from "./activityDetail";
import type { WorkoutDetail } from "../social/types";

describe("activity detail outdoor metrics", () => {
  it("sanitizes a real route and derives its distance without changing storage", () => {
    const route = [
      [-23.55052, -46.633308],
      [-23.55052, -46.632308],
    ];
    expect(sanitizeActivityRoute(route)).toEqual(route);
    expect(distanceFromActivityRoute(route)).toBeGreaterThan(100);
    expect(resolveActivityRoute({ route, distanceM: 0 })).toMatchObject({
      route,
      distanceDerivedFromRoute: true,
    });
  });

  it("does not create a map or distance from an invalid route", () => {
    expect(
      resolveActivityRoute({
        route: [[999, -46.6]],
        distanceM: 0,
      }),
    ).toEqual({
      route: null,
      distanceM: null,
      distanceDerivedFromRoute: false,
    });
  });

  it("keeps a persisted distance even when there is no route", () => {
    expect(resolveActivityRoute({ route: null, distanceM: 651 })).toEqual({
      route: null,
      distanceM: 651,
      distanceDerivedFromRoute: false,
    });
  });

  it("shows a coherent range in the Sao Paulo timezone", () => {
    expect(
      resolveActivityTime({
        startedAt: "2026-07-15T13:38:24.788Z",
        endedAt: "2026-07-15T13:47:05.788Z",
        elapsedS: 521,
        locale: "pt-BR",
        timeZone: "America/Sao_Paulo",
      }),
    ).toEqual({
      startLabel: "10:38",
      endLabel: "10:47",
      rangeIsConsistent: true,
    });
  });

  it("does not expose an inconsistent end time", () => {
    expect(
      resolveActivityTime({
        startedAt: "2026-07-15T13:38:24.788Z",
        endedAt: "2026-07-15T14:18:57.028Z",
        elapsedS: 517,
        locale: "pt-BR",
        timeZone: "America/Sao_Paulo",
      }),
    ).toEqual({
      startLabel: "10:38",
      endLabel: null,
      rangeIsConsistent: false,
    });
  });

  it("clamps legacy moving time and labels imported sources honestly", () => {
    expect(normalizedMovingSeconds(443, 428)).toBe(428);
    expect(
      normalizeActivitySource({
        origin: "imported",
        sourceApp: "Apple Watch de Eduardo",
      }),
    ).toBe("apple_watch");
    expect(normalizeActivitySource({ origin: "web_timer" })).toBe("gym_circle");
  });

  it("usa métricas do Saúde sem sobrescrever o local do Gym Circle", () => {
    const current = workoutDetail({
      gymName: "Saint Thomas",
      locationName: "Saint Thomas",
      locationLatitude: -23.55,
      locationLongitude: -46.63,
      activeCalories: 100,
      origin: null,
    });
    const hydrated = workoutDetail({
      gymName: null,
      locationName: null,
      locationLatitude: null,
      locationLongitude: null,
      activeCalories: 176,
      origin: "imported",
      sourceApp: "Apple Watch",
    });

    expect(mergeHydratedWorkoutDetail(current, hydrated)).toMatchObject({
      gymName: "Saint Thomas",
      locationName: "Saint Thomas",
      locationLatitude: -23.55,
      locationLongitude: -46.63,
      activeCalories: 176,
      origin: "imported",
      sourceApp: "Apple Watch",
    });
  });
});

function workoutDetail(patch: Partial<WorkoutDetail>): WorkoutDetail {
  return {
    activityType: "other",
    startedAt: "2026-07-16T19:47:00.000Z",
    endedAt: "2026-07-16T20:13:00.000Z",
    elapsedS: 1_560,
    movingS: null,
    distanceM: null,
    elevationGainM: null,
    avgHr: 117,
    maxHr: 161,
    activeCalories: 175,
    totalCalories: 222,
    route: null,
    origin: "imported",
    sourceApp: "Apple Watch",
    strengthSets: null,
    gymName: null,
    locationName: null,
    caption: null,
    ...patch,
  };
}

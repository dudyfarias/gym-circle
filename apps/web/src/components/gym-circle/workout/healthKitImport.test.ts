import { describe, expect, it } from "vitest";
import type { HealthKitWorkout } from "../native/HealthKitBridge";
import {
  healthKitWorkoutActivityType,
  healthKitWorkoutToActivityInput,
  sanitizeHeartRateSamples,
  sanitizeHealthKitRoute,
} from "./healthKitImport";

const walkingWorkout: HealthKitWorkout = {
  provider: "apple-healthkit",
  externalId: "F1B20B85-01AA-4A27-B1C5-38FB576230D1",
  sourceApp: "Apple Watch",
  sourceBundleId: "com.apple.health",
  workoutType: "walking",
  startedAt: "2026-07-15T13:38:24.000Z",
  endedAt: "2026-07-15T13:47:05.000Z",
  elapsedS: 521,
  distanceM: 651,
  activeCalories: 42.5,
  avgHr: 112.4,
  maxHr: 138.2,
  minHr: 88,
  heartRateSamples: [
    { timestamp: "2026-07-15T13:38:30.000Z", bpm: 92.4 },
    { timestamp: "2026-07-15T13:39:30.000Z", bpm: 108.8 },
  ],
  workoutEffort: 3,
  temperatureC: 14,
  humidityPercent: 68,
  isIndoor: false,
  sourceDevice: "Apple Watch",
  totalCalories: 60,
  totalCaloriesEstimated: true,
  route: [
    [-23.5, -46.6],
    [-23.5002, -46.6003],
  ],
};

describe("healthKitWorkoutToActivityInput", () => {
  it("importa caminhada do Apple Watch com distância, FC e deduplicação", () => {
    expect(healthKitWorkoutToActivityInput(walkingWorkout)).toEqual({
      activityType: "walk",
      origin: "imported",
      externalId: walkingWorkout.externalId,
      sourceApp: "Apple Watch",
      startedAt: walkingWorkout.startedAt,
      endedAt: walkingWorkout.endedAt,
      elapsedS: 521,
      movingS: 521,
      distanceM: 651,
      elevationGainM: null,
      route: walkingWorkout.route,
      avgHr: 112,
      maxHr: 138,
      activeCalories: 42.5,
      totalCalories: 60,
      healthMetadata: {
        heartRateSamples: [
          { timestamp: "2026-07-15T13:38:30.000Z", bpm: 92 },
          { timestamp: "2026-07-15T13:39:30.000Z", bpm: 109 },
        ],
        minHr: 88,
        workoutEffort: 3,
        temperatureC: 14,
        humidityPercent: 68,
        weatherCondition: null,
        averageMets: null,
        isIndoor: false,
        sourceDevice: "Apple Watch",
        workoutBrandName: null,
        totalCaloriesEstimated: true,
      },
    });
  });

  it("descarta amostras de FC inválidas sem inventar gráfico", () => {
    expect(
      sanitizeHeartRateSamples([
        { timestamp: "inválido", bpm: 100 },
        { timestamp: "2026-07-15T13:38:30.000Z", bpm: 500 },
        { timestamp: "2026-07-15T13:39:30.000Z", bpm: 117.4 },
      ]),
    ).toEqual([{ timestamp: "2026-07-15T13:39:30.000Z", bpm: 117 }]);
  });

  it("mapeia modalidades suportadas e degrada as demais para outro", () => {
    expect(healthKitWorkoutActivityType("strength")).toBe("strength");
    expect(healthKitWorkoutActivityType("running")).toBe("run");
    expect(healthKitWorkoutActivityType("cycling")).toBe("ride");
    expect(healthKitWorkoutActivityType("hiit")).toBe("other");
  });

  it("descarta rota insuficiente ou inválida", () => {
    expect(sanitizeHealthKitRoute([[999, -46], [-23, -46]])).toBeNull();
    expect(
      sanitizeHealthKitRoute([
        [-23, -46],
        [-23.1, -46.1],
      ]),
    ).toHaveLength(2);
  });
});

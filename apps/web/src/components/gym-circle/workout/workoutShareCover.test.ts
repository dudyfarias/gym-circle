import { describe, expect, it } from "vitest";
import { buildWorkoutShareCoverSummary } from "./workoutShareCover";

describe("buildWorkoutShareCoverSummary", () => {
  it("uses distance and pace for route workouts", () => {
    const summary = buildWorkoutShareCoverSummary({
      activityType: "walk",
      distanceM: 1470,
      elapsedS: 733,
      movingS: 733,
      workoutDate: "2026-07-04",
      workoutTypeLabel: "Caminhada",
    });

    expect(summary.primaryLabel).toBe("Distância");
    expect(summary.primaryValue).toBe("1,47 km");
    expect(summary.secondary).toContain("12:13");
    expect(summary.secondary).toContain("8:19 /km");
  });

  it("falls back to elapsed time when route metrics are missing", () => {
    const summary = buildWorkoutShareCoverSummary({
      activityType: "strength",
      elapsedS: 1480,
      workoutTypeLabel: "Musculação",
    });

    expect(summary.primaryLabel).toBe("Tempo");
    expect(summary.primaryValue).toBe("24:40");
    expect(summary.secondary).toEqual([]);
  });
});

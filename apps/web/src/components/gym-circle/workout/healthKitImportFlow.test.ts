import { describe, expect, it, vi } from "vitest";
import type { HealthKitWorkout } from "../native/HealthKitBridge";
import {
  HealthKitPostIntegrationError,
  importHealthKitWorkout,
} from "./healthKitImportFlow";

const workout: HealthKitWorkout = {
  provider: "apple-healthkit",
  externalId: "apple-workout-1",
  sourceApp: "Apple Watch",
  sourceBundleId: "com.apple.health",
  startedAt: "2026-07-16T19:47:00.000Z",
  endedAt: "2026-07-16T20:13:00.000Z",
  workoutType: "other",
  elapsedS: 1_560,
  activeCalories: 175,
  avgHr: 117,
};

describe("importHealthKitWorkout", () => {
  it("importa antes de vincular e usa o id persistido", async () => {
    const steps: string[] = [];
    const importActivity = vi.fn(async () => {
      steps.push("import");
      return { id: "activity-1", workoutDate: "2026-07-16", elapsedS: 1_560 };
    });
    const afterImport = vi.fn(async (activity: { id: string }) => {
      steps.push(`integrate:${activity.id}`);
    });

    const result = await importHealthKitWorkout({
      workout,
      importActivity,
      afterImport,
    });

    expect(steps).toEqual(["import", "integrate:activity-1"]);
    expect(result.activity.id).toBe("activity-1");
    expect(importActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: "apple-workout-1",
        origin: "imported",
      }),
    );
  });

  it("não tenta vincular quando a importação falha", async () => {
    const afterImport = vi.fn();

    await expect(
      importHealthKitWorkout({
        workout,
        importActivity: async () => {
          throw new Error("insert failed");
        },
        afterImport,
      }),
    ).rejects.toThrow("insert failed");
    expect(afterImport).not.toHaveBeenCalled();
  });

  it("preserva a atividade quando apenas o vínculo falha", async () => {
    const promise = importHealthKitWorkout({
      workout,
      importActivity: async () => ({
        id: "activity-2",
        workoutDate: "2026-07-16",
        elapsedS: 1_560,
      }),
      afterImport: async () => {
        throw new Error("merge failed");
      },
    });

    await expect(promise).rejects.toMatchObject({
      name: "HealthKitPostIntegrationError",
      imported: { activity: { id: "activity-2" } },
    });
    await promise.catch((error: unknown) => {
      expect(error).toBeInstanceOf(HealthKitPostIntegrationError);
    });
  });
});

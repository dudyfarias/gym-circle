import { describe, expect, it } from "vitest";
import { createUnsupportedTrainingHealthAdapter } from "../domain/health";
import { healthService } from "./health";

describe("healthService", () => {
  it("ships as a safe no-permission adapter until native Health is enabled", async () => {
    const service = healthService(createUnsupportedTrainingHealthAdapter("apple-healthkit"));

    await expect(service.getPermissionState()).resolves.toBe("unsupported");
    await expect(service.requestPermissions()).resolves.toBe("unsupported");
    await expect(
      service.listWorkoutSummaries({
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z",
      }),
    ).resolves.toEqual([]);
  });
});

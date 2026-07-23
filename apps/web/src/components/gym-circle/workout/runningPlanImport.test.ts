import { describe, expect, it } from "vitest";
import { importRunningPlanText } from "./runningPlanImport";

describe("importRunningPlanText", () => {
  it("uses the deterministic parser and never persists automatically", async () => {
    const result = await importRunningPlanText(
      "INTERVALADO\n6 x 400 m pace 4:30 a 4:45/km recuperação 1 min trote",
    );
    expect(result.sourceType).toBe("text");
    expect(result.reviewRequired).toBe(true);
    expect(result.parsedPlan.source).toBe("text");
    expect(result.parsedPlan.sourceMetadata?.sourceSha256).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(result.parsedPlan.steps[0]).toMatchObject({
      repetitions: 6,
      distanceM: 400,
      recoveryDurationS: 60,
    });
  });
});

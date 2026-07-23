import { describe, expect, it } from "vitest";
import {
  describeRunningStep,
  formatRunningDistance,
  formatRunningDuration,
  formatRunningPace,
} from "./RunningPlanPreview";

describe("RunningPlanPreview formatters", () => {
  it("formats canonical duration, distance, and pace units", () => {
    expect(formatRunningDuration(3720)).toBe("1h 02min");
    expect(formatRunningDistance(5000)).toContain("5");
    expect(formatRunningPace(290)).toBe("4:50/km");
  });

  it("renders repetition, target, pace, zone, and effort", () => {
    expect(
      describeRunningStep({
        position: 0,
        stepType: "interval",
        title: "6 × 400 m",
        repetitions: 6,
        targetBasis: "distance",
        distanceM: 400,
        paceMinSPerKm: 290,
        paceMaxSPerKm: 300,
        heartRateZone: 4,
        recoveryType: "duration",
        recoveryDurationS: 60,
        targetEffort: 8,
      }),
    ).toContain("6 × 400 m · pace 4:50–5:00/km · Z4 · RPE 8");
  });

  it("renders ranges from an imported-style running block", () => {
    expect(
      describeRunningStep({
        position: 0,
        stepType: "drill",
        title: "Educativo",
        repetitions: 3,
        targetBasis: "duration",
        durationMinS: 30,
        durationMaxS: 40,
        recoveryType: "duration",
        recoveryDurationS: 20,
      }),
    ).toBe("3 × 0:30–0:40");
  });
});

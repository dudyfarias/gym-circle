import { describe, expect, it } from "vitest";
import { validateRunningPlan } from "./running";
import { parseRunningPlanImportText } from "./running-import";
import { RUNNING_PLAN_IMAGE_FIXTURE } from "./fixtures/running-plan-image-2026-07-23.fixture";
import { RUNNING_PLAN_IMPORT_CASES } from "./fixtures/running-plan-import-cases.fixture";

describe("parseRunningPlanImportText", () => {
  const parsed = parseRunningPlanImportText(
    RUNNING_PLAN_IMAGE_FIXTURE.rawText,
    {
      sourceType: "image",
      sourceName: RUNNING_PLAN_IMAGE_FIXTURE.sourceImageName,
      sourceImageSha256: RUNNING_PLAN_IMAGE_FIXTURE.sourceImageSha256,
    },
  );

  it("uses the supplied image transcription as a review-only import", () => {
    expect(parsed.sourceType).toBe("image");
    expect(parsed.reviewRequired).toBe(true);
    expect(parsed.warnings).toContain("review_required");
    expect(parsed.parsedPlan.source).toBe("image");
    expect(parsed.parsedPlan.sourceMetadata).toMatchObject({
      sourceImageSha256: RUNNING_PLAN_IMAGE_FIXTURE.sourceImageSha256,
      parserVersion: 2,
      reviewRequired: true,
    });
  });

  it("extracts the warmup duration range and its structured notes", () => {
    const warmup = parsed.parsedPlan.steps[0];
    expect(warmup).toMatchObject({
      stepType: "warmup",
      durationMinS: 180,
      durationMaxS: 300,
      repetitions: 1,
    });
    expect(warmup.metadata).toMatchObject({
      dynamicStretchExerciseCountMin: 3,
      dynamicStretchExerciseCountMax: 4,
      dynamicStretchSets: 3,
      movementsPerExerciseMin: 10,
      movementsPerExerciseMax: 20,
    });
  });

  it("extracts both distance blocks with canonical pace ranges and zones", () => {
    expect(parsed.parsedPlan.name).toBe("Corrida · 7 km · Z1–Z2");
    expect(parsed.parsedPlan.steps[1]).toMatchObject({
      stepType: "easy",
      distanceM: 4000,
      paceMinSPerKm: 326,
      paceMaxSPerKm: 370,
      heartRateZone: 1,
    });
    expect(parsed.parsedPlan.steps[2]).toMatchObject({
      stepType: "steady",
      distanceM: 3000,
      paceMinSPerKm: 286,
      paceMaxSPerKm: 325,
      heartRateZone: 2,
    });
  });

  it("extracts the drill as three repetitions of a 30-40 second range", () => {
    expect(parsed.parsedPlan.steps[3]).toMatchObject({
      stepType: "drill",
      repetitions: 3,
      durationMinS: 30,
      durationMaxS: 40,
    });
  });

  it("produces a valid Sprint B plan without silently saving it", () => {
    expect(parsed.parsedPlan.steps).toHaveLength(4);
    expect(validateRunningPlan(parsed.parsedPlan)).toEqual([]);
    expect(parsed.unparsedLines).toEqual([]);
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("parses the real browser OCR output from the supplied image", () => {
    const result = parseRunningPlanImportText(
      RUNNING_PLAN_IMAGE_FIXTURE.browserOcrText,
      { sourceType: "image" },
    );
    expect(result.parsedPlan.name).toBe("Corrida · 7 km · Z1–Z2");
    expect(result.parsedPlan.steps).toHaveLength(4);
    expect(result.parsedPlan.steps[1]).toMatchObject({
      distanceM: 4000,
      heartRateZone: 1,
    });
    expect(result.parsedPlan.steps[2]).toMatchObject({
      distanceM: 3000,
      heartRateZone: 2,
    });
    expect(validateRunningPlan(result.parsedPlan)).toEqual([]);
  });

  it("parses an interval workout and attaches standalone recovery", () => {
    const result = parseRunningPlanImportText(
      RUNNING_PLAN_IMPORT_CASES.interval,
    );
    expect(result.parsedPlan.name).toBe("INTERVALADO 5K");
    expect(result.parsedPlan.steps[1]).toMatchObject({
      stepType: "interval",
      repetitions: 6,
      distanceM: 400,
      paceMinSPerKm: 270,
      paceMaxSPerKm: 285,
      recoveryType: "easy_jog",
      recoveryDurationS: 60,
    });
    expect(validateRunningPlan(result.parsedPlan)).toEqual([]);
  });

  it("parses fartlek repetitions by time without inventing distance", () => {
    const result = parseRunningPlanImportText(RUNNING_PLAN_IMPORT_CASES.fartlek);
    const interval = result.parsedPlan.steps.find(
      (step) => step.stepType === "interval",
    );
    expect(result.parsedPlan.name).toBe("FARTLEK 40 MIN");
    expect(interval).toMatchObject({
      repetitions: 8,
      durationS: 60,
      recoveryType: "easy_jog",
      recoveryDurationS: 60,
      metadata: expect.objectContaining({ workoutStyle: "fartlek" }),
    });
    expect(interval?.distanceM).toBeNull();
  });

  it("keeps unrecognized long-run instructions visible for review", () => {
    const result = parseRunningPlanImportText(
      RUNNING_PLAN_IMPORT_CASES.longRun,
    );
    expect(result.parsedPlan.name).toBe("LONGÃO DOMINGO");
    expect(result.parsedPlan.steps[0]).toMatchObject({
      stepType: "long_run",
      distanceM: 12000,
      heartRateZone: 2,
      paceMinSPerKm: 350,
      paceMaxSPerKm: 380,
    });
    expect(result.unparsedLines).toEqual([
      "Hidratar na metade do percurso",
    ]);
    expect(result.warnings).toContain("unparsed_lines");
  });

  it("parses a time-based plan with recovery and a tempo block", () => {
    const result = parseRunningPlanImportText(
      RUNNING_PLAN_IMPORT_CASES.timeBased,
    );
    expect(result.parsedPlan.name).toBe("CORRIDA POR TEMPO");
    expect(result.parsedPlan.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stepType: "tempo",
          durationS: 1200,
          paceMinSPerKm: 300,
          paceMaxSPerKm: 315,
        }),
        expect.objectContaining({
          stepType: "interval",
          repetitions: 3,
          durationS: 120,
          recoveryType: "standing",
          recoveryDurationS: 60,
        }),
      ]),
    );
    expect(validateRunningPlan(result.parsedPlan)).toEqual([]);
  });

  it("repairs common OCR substitutions while preserving review mode", () => {
    const result = parseRunningPlanImportText(
      RUNNING_PLAN_IMPORT_CASES.imperfectOcr,
      { sourceType: "image" },
    );
    const interval = result.parsedPlan.steps.find(
      (step) => step.stepType === "interval",
    );
    expect(interval).toMatchObject({
      repetitions: 6,
      distanceM: 400,
      paceMinSPerKm: 270,
      paceMaxSPerKm: 285,
      recoveryType: "easy_jog",
      recoveryDurationS: 60,
    });
    expect(result.reviewRequired).toBe(true);
    expect(result.rawText).toBe(RUNNING_PLAN_IMPORT_CASES.imperfectOcr);
  });
});

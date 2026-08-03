import { describe, expect, it } from "vitest";
import { estimateRunningPlanTotals, validateRunningPlan } from "./running";
import { parseRunningPlanImportText } from "./running-import";
import { expandRunningPlanSegments } from "./running-session";
import { RUNNING_PLAN_IMAGE_FIXTURE } from "./fixtures/running-plan-image-2026-07-23.fixture";
import { RUNNING_PLAN_IMAGE_2026_08_03_FIXTURE } from "./fixtures/running-plan-image-2026-08-03.fixture";
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
      parserVersion: 3,
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

  it("parses a repeated work/recovery group from the real IMG_8507 prescription", () => {
    const result = parseRunningPlanImportText(
      RUNNING_PLAN_IMAGE_2026_08_03_FIXTURE.rawText,
      {
        sourceType: "image",
        sourceName: RUNNING_PLAN_IMAGE_2026_08_03_FIXTURE.sourceImageName,
        sourceImageSha256:
          RUNNING_PLAN_IMAGE_2026_08_03_FIXTURE.sourceImageSha256,
      },
    );

    expect(result.parsedPlan.steps).toHaveLength(3);
    expect(result.parsedPlan.steps[0]).toMatchObject({
      stepType: "easy",
      targetBasis: "duration",
      durationS: 900,
      paceMinSPerKm: 275,
      paceMaxSPerKm: 305,
      heartRateZone: 2,
      metadata: expect.objectContaining({
        sourceCompletionDistanceMinM: 2950,
        sourceCompletionDistanceMaxM: 3270,
      }),
    });
    expect(result.parsedPlan.steps[1]).toMatchObject({
      stepType: "interval",
      targetBasis: "distance",
      repetitions: 6,
      distanceM: 800,
      paceMinSPerKm: 235,
      paceMaxSPerKm: 255,
      heartRateZone: 4,
      recoveryType: "easy_jog",
      recoveryDurationS: 120,
      metadata: expect.objectContaining({
        sourceCompletionDurationMinS: 188,
        sourceCompletionDurationMaxS: 204,
        recoveryAfterFinalRepetition: true,
        recoveryPaceMinSPerKm: 275,
        recoveryPaceMaxSPerKm: 305,
        recoveryHeartRateZone: 2,
        recoveryDistanceMinM: 393,
        recoveryDistanceMaxM: 436,
      }),
    });
    expect(result.parsedPlan.steps[2]).toMatchObject({
      stepType: "cooldown",
      targetBasis: "duration",
      durationS: 300,
    });
    expect(result.parsedPlan.sourceMetadata).toMatchObject({
      sourcePrescribedDistanceMinM: 10110,
      sourcePrescribedDistanceMaxM: 10690,
      sourcePrescribedDurationMinS: 3048,
      sourcePrescribedDurationMaxS: 3144,
      parserVersion: 3,
    });
    expect(result.warnings).toContain("pace_speed_inconsistent");
    expect(result.unparsedLines).toEqual([]);
    expect(validateRunningPlan(result.parsedPlan)).toEqual([]);

    const estimate = estimateRunningPlanTotals(result.parsedPlan);
    expect(estimate.distanceMinM).toBe(10108);
    expect(estimate.distanceMaxM).toBe(10686);
    expect(estimate.durationMinS).toBe(3048);
    expect(estimate.durationMaxS).toBe(3144);

    const segments = expandRunningPlanSegments({
      steps: result.parsedPlan.steps,
    });
    expect(
      segments.filter((segment) => segment.kind === "recovery"),
    ).toHaveLength(6);
  });

  it("repairs the actual browser OCR text without turning plan totals into steps", () => {
    const result = parseRunningPlanImportText(
      RUNNING_PLAN_IMAGE_2026_08_03_FIXTURE.browserOcrText,
      { sourceType: "image" },
    );
    expect(result.parsedPlan.steps).toHaveLength(3);
    expect(result.parsedPlan.steps[1]).toMatchObject({
      repetitions: 6,
      distanceM: 800,
      heartRateZone: 4,
      recoveryDurationS: 120,
    });
    expect(result.parsedPlan.steps[0].distanceMinM).toBeNull();
    expect(result.parsedPlan.steps[0].durationS).toBe(900);
    expect(result.unparsedLines).toEqual([]);
  });

  it.each(["Repetir 6 vezes", "6 séries de"])(
    "accepts trainer repetition wording: %s",
    (repeatLabel) => {
      const result = parseRunningPlanImportText(`Corrida intervalada
1. ${repeatLabel}
• Correr 800 m no pace 03:55 a 04:15 min/km
• Trotar durante 2 min em Z2
2. Desaquecer por 5 min`);
      expect(result.parsedPlan.steps[0]).toMatchObject({
        stepType: "interval",
        repetitions: 6,
        distanceM: 800,
        recoveryType: "easy_jog",
        recoveryDurationS: 120,
      });
      expect(result.parsedPlan.steps[1]).toMatchObject({
        stepType: "cooldown",
        durationS: 300,
      });
    },
  );
});

import { describe, expect, it } from "vitest";
import {
  estimateRunningPlanTotals,
  normalizeRunningPlan,
  RUNNING_STEP_PRESETS,
  type RunningWorkoutPlanDraft,
  validateRunningPlan,
} from "./running";

function plan(
  overrides: Partial<RunningWorkoutPlanDraft> = {},
): RunningWorkoutPlanDraft {
  return {
    name: "Intervalado",
    description: null,
    level: "intermediate",
    goal: "improve_5k",
    source: "manual",
    steps: [
      {
        position: 0,
        stepType: "interval",
        title: "6 × 400 m",
        repetitions: 6,
        targetBasis: "distance",
        distanceM: 400,
        paceMinSPerKm: 290,
        paceMaxSPerKm: 300,
        recoveryType: "duration",
        recoveryDurationS: 60,
      },
    ],
    ...overrides,
  };
}

describe("running workout plan domain", () => {
  it("rejects an empty plan", () => {
    expect(validateRunningPlan(plan({ steps: [] }))).toContainEqual({
      path: "steps",
      code: "required",
    });
  });

  it("validates distance, duration, repetitions, zones and effort", () => {
    const issues = validateRunningPlan(
      plan({
        steps: [
          {
            position: 0,
            stepType: "easy",
            title: "Inválido",
            repetitions: 0,
            targetBasis: "distance",
            distanceM: -100,
            durationS: Number.NaN,
            heartRateZone: 6,
            targetEffort: 11,
            recoveryType: "none",
          },
        ],
      }),
    );
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "invalid_repetitions",
        "invalid_distance",
        "invalid_duration",
        "invalid_heart_rate_zone",
        "invalid_effort",
        "missing_target",
      ]),
    );
  });

  it("normalizes inverted pace without ambiguous units", () => {
    const normalized = normalizeRunningPlan(
      plan({
        steps: [
          {
            ...plan().steps[0],
            paceMinSPerKm: 330,
            paceMaxSPerKm: 300,
          },
        ],
      }),
    );
    expect(normalized.steps[0].paceMinSPerKm).toBe(300);
    expect(normalized.steps[0].paceMaxSPerKm).toBe(330);
    expect(validateRunningPlan(plan({
      steps: [{
        ...plan().steps[0],
        paceMinSPerKm: 330,
        paceMaxSPerKm: 300,
      }],
    }))).toContainEqual({
      path: "steps.0.pace",
      code: "inverted_pace",
    });
  });

  it("rejects duplicate source positions before normalization", () => {
    expect(
      validateRunningPlan(
        plan({
          steps: [
            plan().steps[0],
            { ...plan().steps[0], title: "Segundo bloco" },
          ],
        }),
      ),
    ).toContainEqual({
      path: "steps.1.position",
      code: "duplicate_position",
    });
  });

  it("estimates repeated distance, pace duration and recovery", () => {
    const result = estimateRunningPlanTotals(plan());
    expect(result.distanceM).toBe(2400);
    expect(result.durationS).toBe(1008);
    expect(result.recoveryDurationS).toBe(300);
    expect(result.repetitionCount).toBe(6);
    expect(result.derivedDuration).toBe(true);
  });

  it("derives distance from duration and target pace", () => {
    const result = estimateRunningPlanTotals(
      plan({
        steps: [
          {
            position: 0,
            stepType: "tempo",
            title: "Tempo",
            repetitions: 1,
            targetBasis: "duration",
            durationS: 1200,
            paceMinSPerKm: 300,
            paceMaxSPerKm: 300,
            recoveryType: "none",
          },
        ],
      }),
    );
    expect(result.distanceM).toBe(4000);
    expect(result.durationS).toBe(1200);
    expect(result.derivedDistance).toBe(true);
  });

  it("preserves and estimates duration ranges without false precision", () => {
    const ranged = plan({
      steps: [
        {
          position: 0,
          stepType: "drill",
          title: "Educativos",
          repetitions: 3,
          targetBasis: "duration",
          durationMinS: 30,
          durationMaxS: 40,
          recoveryType: "duration",
          recoveryDurationS: 20,
        },
      ],
    });
    expect(validateRunningPlan(ranged)).toEqual([]);
    const result = estimateRunningPlanTotals(ranged);
    expect(result.durationMinS).toBe(130);
    expect(result.durationMaxS).toBe(160);
    expect(result.durationS).toBe(145);
    expect(result.hasRanges).toBe(true);
  });

  it("rejects incomplete, inverted, or conflicting target ranges", () => {
    const issues = validateRunningPlan(
      plan({
        steps: [
          {
            position: 0,
            stepType: "warmup",
            title: "Aquecimento",
            repetitions: 1,
            repetitionsMin: 4,
            repetitionsMax: 3,
            targetBasis: "duration",
            durationS: 240,
            durationMinS: 180,
            durationMaxS: 300,
            recoveryType: "none",
          },
        ],
      }),
    );
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "invalid_repetition_range",
        "invalid_duration_range",
      ]),
    );
  });

  it("ships the nine requested local block presets", () => {
    expect(RUNNING_STEP_PRESETS).toHaveLength(9);
    expect(RUNNING_STEP_PRESETS.some((item) => item.stepType === "warmup")).toBe(
      true,
    );
    expect(
      RUNNING_STEP_PRESETS.some(
        (item) => item.stepType === "interval" && item.repetitions === 6,
      ),
    ).toBe(true);
  });
});

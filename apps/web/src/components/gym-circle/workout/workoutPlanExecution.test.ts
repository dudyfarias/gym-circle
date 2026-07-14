import { describe, expect, it } from "vitest";
import { workoutPlanExecutionFromRow } from "./workoutPlanExecution";

describe("workoutPlanExecutionFromRow", () => {
  it("calcula volume externo e ignora assistência", () => {
    const result = workoutPlanExecutionFromRow({
      id: "activity-1",
      workout_plan_id: "plan-1",
      workout_date: "2026-07-14",
      started_at: "2026-07-14T10:00:00Z",
      elapsed_s: 3_000,
      strength_sets: [
        {
          load_type: "external",
          weight_kg: 20,
          reps: 10,
          set_origin: "planned",
          status: "completed",
        },
        {
          load_type: "assisted",
          assisted_weight_kg: 25,
          reps: 10,
          set_origin: "planned",
          status: "skipped",
        },
      ],
    });

    expect(result).toMatchObject({
      volumeKg: 200,
      completionRate: 0.5,
    });
  });

  it("ignora activity livre sem plano", () => {
    expect(
      workoutPlanExecutionFromRow({
        id: "activity-2",
        workout_plan_id: null,
        workout_date: "2026-07-14",
        started_at: null,
        elapsed_s: 0,
        strength_sets: [],
      }),
    ).toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";
import type { RunningWorkoutPlanDraft } from "../domain/running";
import type { GymCircleClient } from "./supabase";
import { runningPlanService } from "./runningPlans";

const validDraft = (): RunningWorkoutPlanDraft => ({
  name: "Intervalado",
  description: "Qualidade",
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
});

const planRow = {
  id: "plan-1",
  user_id: "user-1",
  name: "Intervalado",
  sport_type: "run",
  level: "intermediate",
  goal: "improve_5k",
  description: "Qualidade",
  estimated_duration_s: 1008,
  estimated_distance_m: 2400,
  source: "manual",
  source_metadata: {},
  plan_version: 1,
  is_favorite: false,
  created_at: "2026-07-23T12:00:00Z",
  updated_at: "2026-07-23T12:00:00Z",
};

const stepRow = {
  id: "step-1",
  workout_plan_id: "plan-1",
  position: 0,
  step_type: "interval",
  title: "6 × 400 m",
  instructions: null,
  repetitions: 6,
  target_basis: "distance",
  distance_m: 400,
  duration_s: null,
  pace_min_s_per_km: 290,
  pace_max_s_per_km: 300,
  heart_rate_zone: null,
  recovery_type: "duration",
  recovery_duration_s: 60,
  recovery_distance_m: null,
  target_effort: null,
  metadata: {},
};

describe("runningPlanService", () => {
  it("rejects an invalid plan before making a request", async () => {
    const rpc = vi.fn();
    const service = runningPlanService({
      rpc,
    } as unknown as GymCircleClient);
    await expect(
      service.createRunningPlan({ ...validDraft(), steps: [] }),
    ).rejects.toThrow("running_plan_invalid:required");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("saves canonical units and returns the persisted plan", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "plan-1", error: null });
    const from = vi.fn((table: string) => {
      if (table === "workout_plans") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: planRow, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          in: () => ({
            order: () =>
              Promise.resolve({ data: [stepRow], error: null }),
          }),
        }),
      };
    });
    const service = runningPlanService({
      from,
      rpc,
    } as unknown as GymCircleClient);

    const result = await service.createRunningPlan(validDraft());

    expect(rpc).toHaveBeenCalledWith(
      "save_running_workout_plan",
      expect.objectContaining({
        p_plan_id: null,
        p_plan: expect.objectContaining({
          estimated_distance_m: 2400,
          steps: [
            expect.objectContaining({
              distance_m: 400,
              distance_min_m: null,
              distance_max_m: null,
              duration_min_s: null,
              duration_max_s: null,
              pace_min_s_per_km: 290,
              recovery_duration_s: 60,
            }),
          ],
        }),
      }),
    );
    expect(result.id).toBe("plan-1");
    expect(result.steps[0]).toMatchObject({
      stepType: "interval",
      repetitions: 6,
      distanceM: 400,
    });
  });

  it("lists plans without an N+1 steps query", async () => {
    const from = vi.fn((table: string) => {
      if (table === "workout_plans") {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({ data: [planRow], error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          in: () => ({
            order: () =>
              Promise.resolve({ data: [stepRow], error: null }),
          }),
        }),
      };
    });
    const service = runningPlanService({
      from,
    } as unknown as GymCircleClient);

    const result = await service.listRunningPlans();

    expect(result).toHaveLength(1);
    expect(result[0]?.steps).toHaveLength(1);
    expect(from.mock.calls.filter(([table]) => table === "workout_plan_steps"))
      .toHaveLength(1);
  });

  it("deletes only running plans", async () => {
    const final = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({
      delete: () => ({
        eq: () => ({
          eq: final,
        }),
      }),
    }));
    const service = runningPlanService({
      from,
    } as unknown as GymCircleClient);

    await service.deleteRunningPlan("plan-1");

    expect(final).toHaveBeenCalledWith("sport_type", "run");
  });
});

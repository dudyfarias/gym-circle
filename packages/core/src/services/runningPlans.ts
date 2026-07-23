import type { SupabaseClient } from "@supabase/supabase-js";
import {
  estimateRunningPlanTotals,
  normalizeRunningPlan,
  validateRunningPlan,
  type RunningPlanGoal,
  type RunningPlanLevel,
  type RunningPlanSource,
  type RunningRecoveryType,
  type RunningStepType,
  type RunningTargetBasis,
  type RunningWorkoutPlan,
  type RunningWorkoutPlanDraft,
  type RunningWorkoutPlanStepDraft,
} from "../domain/running";
import type { GymCircleClient } from "./supabase";

type RunningPlanRow = {
  id: string;
  user_id: string;
  name: string;
  sport_type: string;
  level: RunningPlanLevel | null;
  goal: RunningPlanGoal | null;
  description: string | null;
  estimated_duration_s: number | null;
  estimated_distance_m: number | string | null;
  source: RunningPlanSource;
  source_metadata: Record<string, unknown> | null;
  plan_version: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
};

type RunningStepRow = {
  id: string;
  workout_plan_id: string;
  position: number;
  step_type: RunningStepType;
  title: string;
  instructions: string | null;
  repetitions: number;
  repetitions_min: number | null;
  repetitions_max: number | null;
  target_basis: RunningTargetBasis;
  distance_m: number | string | null;
  distance_min_m: number | string | null;
  distance_max_m: number | string | null;
  duration_s: number | null;
  duration_min_s: number | null;
  duration_max_s: number | null;
  pace_min_s_per_km: number | null;
  pace_max_s_per_km: number | null;
  heart_rate_zone: number | null;
  recovery_type: RunningRecoveryType;
  recovery_duration_s: number | null;
  recovery_distance_m: number | string | null;
  target_effort: number | string | null;
  metadata: Record<string, unknown> | null;
};

const PLAN_FIELDS = [
  "id",
  "user_id",
  "name",
  "sport_type",
  "level",
  "goal",
  "description",
  "estimated_duration_s",
  "estimated_distance_m",
  "source",
  "source_metadata",
  "plan_version",
  "is_favorite",
  "created_at",
  "updated_at",
].join(",");

const STEP_FIELDS = [
  "id",
  "workout_plan_id",
  "position",
  "step_type",
  "title",
  "instructions",
  "repetitions",
  "repetitions_min",
  "repetitions_max",
  "target_basis",
  "distance_m",
  "distance_min_m",
  "distance_max_m",
  "duration_s",
  "duration_min_s",
  "duration_max_s",
  "pace_min_s_per_km",
  "pace_max_s_per_km",
  "heart_rate_zone",
  "recovery_type",
  "recovery_duration_s",
  "recovery_distance_m",
  "target_effort",
  "metadata",
].join(",");

function numberOrNull(value: number | string | null) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapStep(row: RunningStepRow): RunningWorkoutPlanStepDraft {
  return {
    id: row.id,
    position: row.position,
    stepType: row.step_type,
    title: row.title,
    instructions: row.instructions,
    repetitions: row.repetitions,
    repetitionsMin: row.repetitions_min,
    repetitionsMax: row.repetitions_max,
    targetBasis: row.target_basis,
    distanceM: numberOrNull(row.distance_m),
    distanceMinM: numberOrNull(row.distance_min_m),
    distanceMaxM: numberOrNull(row.distance_max_m),
    durationS: row.duration_s,
    durationMinS: row.duration_min_s,
    durationMaxS: row.duration_max_s,
    paceMinSPerKm: row.pace_min_s_per_km,
    paceMaxSPerKm: row.pace_max_s_per_km,
    heartRateZone: row.heart_rate_zone,
    recoveryType: row.recovery_type,
    recoveryDurationS: row.recovery_duration_s,
    recoveryDistanceM: numberOrNull(row.recovery_distance_m),
    targetEffort: numberOrNull(row.target_effort),
    metadata: row.metadata ?? {},
  };
}

function mapPlan(
  row: RunningPlanRow,
  steps: RunningWorkoutPlanStepDraft[],
): RunningWorkoutPlan {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    level: row.level ?? "beginner",
    goal: row.goal ?? "general",
    source: row.source,
    sourceMetadata: row.source_metadata ?? {},
    sportType: "run",
    planVersion: row.plan_version,
    isFavorite: row.is_favorite,
    estimatedDurationS: row.estimated_duration_s,
    estimatedDistanceM: numberOrNull(row.estimated_distance_m),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    steps,
  };
}

function serializePlan(input: RunningWorkoutPlanDraft) {
  const plan = normalizeRunningPlan(input);
  const estimates = estimateRunningPlanTotals(plan);
  return {
    name: plan.name,
    description: plan.description,
    level: plan.level,
    goal: plan.goal,
    estimated_duration_s: estimates.durationS,
    estimated_distance_m: estimates.distanceM,
    source: plan.source,
    source_metadata: plan.sourceMetadata ?? {},
    steps: plan.steps.map((step) => ({
      step_type: step.stepType,
      title: step.title,
      instructions: step.instructions,
      repetitions: step.repetitions,
      repetitions_min: step.repetitionsMin,
      repetitions_max: step.repetitionsMax,
      target_basis: step.targetBasis,
      distance_m: step.distanceM,
      distance_min_m: step.distanceMinM,
      distance_max_m: step.distanceMaxM,
      duration_s: step.durationS,
      duration_min_s: step.durationMinS,
      duration_max_s: step.durationMaxS,
      pace_min_s_per_km: step.paceMinSPerKm,
      pace_max_s_per_km: step.paceMaxSPerKm,
      heart_rate_zone: step.heartRateZone,
      recovery_type: step.recoveryType,
      recovery_duration_s: step.recoveryDurationS,
      recovery_distance_m: step.recoveryDistanceM,
      target_effort: step.targetEffort,
      metadata: step.metadata ?? {},
    })),
  };
}

function assertValidPlan(input: RunningWorkoutPlanDraft) {
  const issues = validateRunningPlan(input);
  if (issues.length === 0) return;
  const error = new Error(
    `running_plan_invalid:${issues.map((issue) => issue.code).join(",")}`,
  );
  Object.assign(error, { issues });
  throw error;
}

export function runningPlanService(client: GymCircleClient) {
  const untyped = client as unknown as SupabaseClient;

  async function stepsForPlans(planIds: string[]) {
    if (planIds.length === 0) {
      return new Map<string, RunningWorkoutPlanStepDraft[]>();
    }
    const { data, error } = await untyped
      .from("workout_plan_steps")
      .select(STEP_FIELDS)
      .in("workout_plan_id", planIds)
      .order("position", { ascending: true });
    if (error) throw error;
    const grouped = new Map<string, RunningWorkoutPlanStepDraft[]>();
    for (const row of (data ?? []) as unknown as RunningStepRow[]) {
      const current = grouped.get(row.workout_plan_id) ?? [];
      current.push(mapStep(row));
      grouped.set(row.workout_plan_id, current);
    }
    return grouped;
  }

  async function getRunningPlan(planId: string) {
    const { data, error } = await untyped
      .from("workout_plans")
      .select(PLAN_FIELDS)
      .eq("id", planId)
      .eq("sport_type", "run")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const grouped = await stepsForPlans([planId]);
    return mapPlan(
      data as unknown as RunningPlanRow,
      grouped.get(planId) ?? [],
    );
  }

  async function saveRunningPlan(
    planId: string | null,
    input: RunningWorkoutPlanDraft,
  ) {
    assertValidPlan(input);
    const { data, error } = await untyped.rpc("save_running_workout_plan", {
      p_plan_id: planId,
      p_plan: serializePlan(input),
    });
    if (error) throw error;
    const saved = await getRunningPlan(String(data));
    if (!saved) throw new Error("running_plan_save_missing");
    return saved;
  }

  return {
    async listRunningPlans(): Promise<RunningWorkoutPlan[]> {
      const { data, error } = await untyped
        .from("workout_plans")
        .select(PLAN_FIELDS)
        .eq("sport_type", "run")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as RunningPlanRow[];
      const grouped = await stepsForPlans(rows.map((row) => row.id));
      return rows.map((row) => mapPlan(row, grouped.get(row.id) ?? []));
    },

    getRunningPlan,

    createRunningPlan(input: RunningWorkoutPlanDraft) {
      return saveRunningPlan(null, input);
    },

    updateRunningPlan(planId: string, input: RunningWorkoutPlanDraft) {
      return saveRunningPlan(planId, input);
    },

    async duplicateRunningPlan(planId: string, name?: string) {
      const { data, error } = await untyped.rpc(
        "duplicate_running_workout_plan",
        {
          p_plan_id: planId,
          p_name: name?.trim() || null,
        },
      );
      if (error) throw error;
      const duplicated = await getRunningPlan(String(data));
      if (!duplicated) throw new Error("running_plan_duplicate_missing");
      return duplicated;
    },

    async deleteRunningPlan(planId: string) {
      const { error } = await untyped
        .from("workout_plans")
        .delete()
        .eq("id", planId)
        .eq("sport_type", "run");
      if (error) throw error;
    },

    async reorderRunningPlanSteps(planId: string, stepIds: string[]) {
      const { error } = await untyped.rpc(
        "reorder_running_workout_plan_steps",
        {
          p_plan_id: planId,
          p_step_ids: stepIds,
        },
      );
      if (error) throw error;
    },

    validateRunningPlan,
    estimateRunningPlanTotals,
  };
}

export type RunningPlanService = ReturnType<typeof runningPlanService>;

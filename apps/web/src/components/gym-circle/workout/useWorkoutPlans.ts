"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth, useGymCircleClient } from "@gym-circle/core/hooks";
import type {
  WorkoutPlan,
  WorkoutPlanExercise,
  WorkoutPlanStats,
} from "../social/types";
import {
  buildWorkoutRecommendation,
  type WorkoutRecommendationHistoryItem,
} from "./workoutRecommendation";

type PlanRow = {
  id: string;
  name: string;
  exercises: unknown;
  updated_at: string;
  plan_version?: number | null;
  is_favorite?: boolean | null;
};

type PlanStatsRow = {
  workout_plan_id: string;
  execution_count: number | string | null;
  last_executed_at: string | null;
  average_duration_s: number | string | null;
  average_volume_kg: number | string | null;
  max_volume_kg: number | string | null;
  average_completion_rate: number | string | null;
};

type PlanHistoryRow = {
  id: string;
  workout_plan_id: string | null;
  workout_date: string;
  started_at: string | null;
};

function toInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numeric(value: number | string | null | undefined) {
  const result = typeof value === "string" ? Number(value) : value;
  return typeof result === "number" && Number.isFinite(result) ? result : 0;
}

function rowToPlan(row: PlanRow, stats?: WorkoutPlanStats): WorkoutPlan {
  const raw = Array.isArray(row.exercises)
    ? (row.exercises as Array<Record<string, unknown>>)
    : [];
  const exercises: WorkoutPlanExercise[] = raw
    .map((e) => ({
      name: String(e?.name ?? "").trim(),
      sets: toInt(e?.sets),
      reps: toInt(e?.reps),
      exerciseId: toStringOrNull(e?.exercise_id ?? e?.exerciseId),
      muscleGroupSlug: toStringOrNull(
        e?.muscle_group_slug ?? e?.muscleGroupSlug,
      ),
      targetKind:
        e?.target_kind === "failure" || e?.targetKind === "failure"
          ? ("failure" as const)
          : e?.target_kind === "duration" || e?.targetKind === "duration"
            ? ("duration" as const)
            : ("reps" as const),
      durationSeconds: toInt(e?.duration_seconds ?? e?.durationSeconds),
      techniqueId: toStringOrNull(e?.technique_id ?? e?.techniqueId),
      techniqueName: toStringOrNull(e?.technique_name ?? e?.techniqueName),
      techniqueNotes: toStringOrNull(e?.technique_notes ?? e?.techniqueNotes),
    }))
    .filter((e) => e.name.length > 0);
  return {
    id: row.id,
    name: row.name,
    exercises,
    updatedAt: row.updated_at,
    planVersion: row.plan_version ?? 1,
    isFavorite: Boolean(row.is_favorite),
    stats,
  };
}

function localDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * CRUD dos treinos salvos (workout_plans). Dados próprios — o RLS garante
 * dono. Usa o cast de client (tabela não gerada nos types).
 */
export function useWorkoutPlans(enabled = true) {
  const client = useGymCircleClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const db = client as unknown as SupabaseClient;
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<WorkoutRecommendationHistoryItem[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setError(null);
      setLoading(false);
      return;
    }
    if (!userId) {
      setPlans([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [plansResult, statsResult, historyResult] = await Promise.all([
        db
          .from("workout_plans")
          .select(
            "id, name, exercises, updated_at, plan_version, is_favorite",
          )
          .order("updated_at", { ascending: false }),
        db.rpc("get_my_workout_plan_stats"),
        db
          .from("activities")
          .select("id, workout_plan_id, workout_date, started_at")
          .not("workout_plan_id", "is", null)
          .order("started_at", { ascending: false })
          .limit(180),
      ]);
      if (plansResult.error) throw plansResult.error;
      if (statsResult.error) throw statsResult.error;
      if (historyResult.error) throw historyResult.error;
      const statsByPlan = new Map<string, WorkoutPlanStats>();
      for (const row of (statsResult.data ?? []) as PlanStatsRow[]) {
        statsByPlan.set(row.workout_plan_id, {
          workoutPlanId: row.workout_plan_id,
          timesUsed: numeric(row.execution_count),
          lastUsedAt: row.last_executed_at,
          averageDurationS: numeric(row.average_duration_s),
          averageVolumeKg: numeric(row.average_volume_kg),
          maxVolumeKg: numeric(row.max_volume_kg),
          averageCompletionRate: numeric(row.average_completion_rate),
        });
      }
      setPlans(
        ((plansResult.data ?? []) as PlanRow[]).map((row) =>
          rowToPlan(row, statsByPlan.get(row.id)),
        ),
      );
      setHistory(
        ((historyResult.data ?? []) as PlanHistoryRow[]).map((row) => ({
          activityId: row.id,
          workoutPlanId: row.workout_plan_id,
          workoutDate: row.workout_date,
          startedAt: row.started_at,
        })),
      );
    } catch (queryError) {
      setError(
        queryError instanceof Error ? queryError.message : "plans_load_failed",
      );
    } finally {
      setLoading(false);
    }
  }, [db, enabled, userId]);

  useEffect(() => {
    // Carga inicial/quando o user muda; refresh só faz setState async.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const savePlan = useCallback(
    async (input: {
      id?: string;
      name: string;
      exercises: WorkoutPlanExercise[];
    }) => {
      if (!userId) throw new Error("auth_required");
      const payload = {
        name: input.name.trim() || "Treino",
        exercises: input.exercises
          .map((e) => ({
            name: e.name.trim(),
            sets: e.sets ?? null,
            reps: e.reps ?? null,
            exercise_id: e.exerciseId ?? null,
            muscle_group_slug: e.muscleGroupSlug ?? null,
            target_kind: e.targetKind ?? "reps",
            duration_seconds: e.durationSeconds ?? null,
            technique_id: e.techniqueId ?? null,
            technique_name: e.techniqueName ?? null,
            technique_notes: e.techniqueNotes ?? null,
          }))
          .filter((e) => e.name.length > 0),
      };
      if (input.id) {
        const { error: updateError } = await db
          .from("workout_plans")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", input.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await db
          .from("workout_plans")
          .insert({ user_id: userId, ...payload });
        if (insertError) throw insertError;
      }
      await refresh();
    },
    [db, userId, refresh],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      if (!userId) throw new Error("auth_required");
      const current = plans.find((plan) => plan.id === id);
      if (!current) return;
      const nextFavorite = !current.isFavorite;
      setPlans((items) =>
        items.map((plan) =>
          plan.id === id ? { ...plan, isFavorite: nextFavorite } : plan,
        ),
      );
      const { error: updateError } = await db
        .from("workout_plans")
        .update({ is_favorite: nextFavorite })
        .eq("id", id);
      if (updateError) {
        setPlans((items) =>
          items.map((plan) =>
            plan.id === id ? { ...plan, isFavorite: !nextFavorite } : plan,
          ),
        );
        throw updateError;
      }
    },
    [db, plans, userId],
  );

  const deletePlan = useCallback(
    async (id: string) => {
      if (!userId) throw new Error("auth_required");
      const { error: deleteError } = await db
        .from("workout_plans")
        .delete()
        .eq("id", id);
      if (deleteError) throw deleteError;
      await refresh();
    },
    [db, userId, refresh],
  );

  const recommendation = useMemo(
    () =>
      buildWorkoutRecommendation({
        plans: plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          updatedAt: plan.updatedAt,
          isFavorite: plan.isFavorite,
        })),
        history,
        today: localDateKey(),
      }),
    [history, plans],
  );

  return {
    plans,
    loading,
    error,
    refresh,
    savePlan,
    toggleFavorite,
    deletePlan,
    recommendation,
  };
}

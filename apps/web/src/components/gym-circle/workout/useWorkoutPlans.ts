"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth, useGymCircleClient } from "@gym-circle/core/hooks";
import type { WorkoutPlan, WorkoutPlanExercise } from "../social/types";

type PlanRow = {
  id: string;
  name: string;
  exercises: unknown;
  updated_at: string;
};

function toInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function rowToPlan(row: PlanRow): WorkoutPlan {
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
  return { id: row.id, name: row.name, exercises, updatedAt: row.updated_at };
}

/**
 * CRUD dos treinos salvos (workout_plans). Dados próprios — o RLS garante
 * dono. Usa o cast de client (tabela não gerada nos types).
 */
export function useWorkoutPlans(enabled = true) {
  const client = useGymCircleClient();
  const { user } = useAuth();
  const db = client as unknown as SupabaseClient;
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setError(null);
      setLoading(false);
      return;
    }
    if (!user) {
      setPlans([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await db
        .from("workout_plans")
        .select("id, name, exercises, updated_at")
        .order("updated_at", { ascending: false });
      if (queryError) throw queryError;
      setPlans(((data ?? []) as PlanRow[]).map(rowToPlan));
    } catch (queryError) {
      setError(
        queryError instanceof Error ? queryError.message : "plans_load_failed",
      );
    } finally {
      setLoading(false);
    }
  }, [db, enabled, user]);

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
      if (!user) throw new Error("auth_required");
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
          .insert({ user_id: user.id, ...payload });
        if (insertError) throw insertError;
      }
      await refresh();
    },
    [db, user, refresh],
  );

  const touchPlan = useCallback(
    async (id: string) => {
      if (!user) return;
      const updatedAt = new Date().toISOString();
      setPlans((current) =>
        current
          .map((plan) =>
            plan.id === id ? { ...plan, updatedAt } : plan,
          )
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      );
      const { error: updateError } = await db
        .from("workout_plans")
        .update({ updated_at: updatedAt })
        .eq("id", id);
      if (updateError) throw updateError;
    },
    [db, user],
  );

  const deletePlan = useCallback(
    async (id: string) => {
      if (!user) throw new Error("auth_required");
      const { error: deleteError } = await db
        .from("workout_plans")
        .delete()
        .eq("id", id);
      if (deleteError) throw deleteError;
      await refresh();
    },
    [db, user, refresh],
  );

  return { plans, loading, error, refresh, savePlan, touchPlan, deletePlan };
}

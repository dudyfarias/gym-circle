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

function rowToPlan(row: PlanRow): WorkoutPlan {
  const raw = Array.isArray(row.exercises)
    ? (row.exercises as Array<Record<string, unknown>>)
    : [];
  const exercises: WorkoutPlanExercise[] = raw
    .map((e) => ({
      name: String(e?.name ?? "").trim(),
      sets: toInt(e?.sets),
      reps: toInt(e?.reps),
    }))
    .filter((e) => e.name.length > 0);
  return { id: row.id, name: row.name, exercises, updatedAt: row.updated_at };
}

/**
 * CRUD das planilhas de treino (workout_plans). Dados próprios — o RLS garante
 * dono. Usa o cast de client (tabela não gerada nos types).
 */
export function useWorkoutPlans() {
  const client = useGymCircleClient();
  const { user } = useAuth();
  const db = client as unknown as SupabaseClient;
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
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
  }, [db, user]);

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
        name: input.name.trim() || "Planilha",
        exercises: input.exercises
          .map((e) => ({
            name: e.name.trim(),
            sets: e.sets ?? null,
            reps: e.reps ?? null,
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

  return { plans, loading, error, refresh, savePlan, deletePlan };
}

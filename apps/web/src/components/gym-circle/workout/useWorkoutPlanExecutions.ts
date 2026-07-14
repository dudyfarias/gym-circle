"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth, useGymCircleClient } from "@gym-circle/core/hooks";
import type { WorkoutPlanExecution } from "../social/types";
import {
  workoutPlanExecutionFromRow,
  type WorkoutPlanExecutionRow,
} from "./workoutPlanExecution";

/** Busca sob demanda apenas as últimas execuções do treino aberto no sheet. */
export function useWorkoutPlanExecutions(workoutPlanId: string | null) {
  const client = useGymCircleClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const db = client as unknown as SupabaseClient;
  const [executions, setExecutions] = useState<WorkoutPlanExecution[]>([]);
  const [dataPlanId, setDataPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workoutPlanId || !userId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data, error } = await db
        .from("activities")
        .select(
          "id, workout_plan_id, workout_date, started_at, elapsed_s, strength_sets",
        )
        .eq("user_id", userId)
        .eq("workout_plan_id", workoutPlanId)
        .order("started_at", { ascending: false })
        .limit(6);
      if (!cancelled) {
        setExecutions(
          error
            ? []
            : ((data ?? []) as WorkoutPlanExecutionRow[]).flatMap((row) => {
                const execution = workoutPlanExecutionFromRow(row);
                return execution ? [execution] : [];
              }),
        );
        setDataPlanId(workoutPlanId);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId, workoutPlanId]);

  const visible =
    workoutPlanId && dataPlanId === workoutPlanId ? executions : [];
  return {
    executions: visible,
    loading: Boolean(workoutPlanId && (loading || dataPlanId !== workoutPlanId)),
  };
}

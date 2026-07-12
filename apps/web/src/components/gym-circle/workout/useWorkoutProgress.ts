"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getGymCircleDateKey } from "@gym-circle/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth, useGymCircleClient } from "@gym-circle/core/hooks";
import {
  buildWorkoutProgress,
  workoutProgressRange,
  WORKOUT_PROGRESS_ACTIVITY_LIMIT,
  WORKOUT_PROGRESS_DAYS,
  type WorkoutProgressActivityRow,
  type WorkoutProgressCatalogRow,
} from "./workoutProgress";

function errorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }
  return "workout_progress_load_failed";
}

/**
 * Carrega o recorte analítico do próprio usuário.
 *
 * Contrato de segurança/performance:
 * - filtro explícito por `user_id` (activities também expõe quem o viewer segue);
 * - somente os últimos 84 dias;
 * - no máximo 200 activities;
 * - select mínimo e catálogo carregado em paralelo;
 * - resposta de request antiga/desmontada nunca atualiza estado.
 */
export function useWorkoutProgress(enabled = true) {
  const client = useGymCircleClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const db = client as unknown as SupabaseClient;
  const requestSequence = useRef(0);
  const [activities, setActivities] = useState<WorkoutProgressActivityRow[]>([]);
  const [catalog, setCatalog] = useState<WorkoutProgressCatalogRow[]>([]);
  const [dataUserId, setDataUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !userId) return;
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const today = getGymCircleDateKey();
      const range = workoutProgressRange(today, WORKOUT_PROGRESS_DAYS);
      const [activitiesResult, catalogResult] = await Promise.all([
        db
          .from("activities")
          .select(
            "id, activity_type, workout_date, started_at, ended_at, elapsed_s, strength_sets",
          )
          .eq("user_id", userId)
          .gte("workout_date", range.from)
          .lte("workout_date", range.to)
          .order("workout_date", { ascending: false })
          .order("started_at", { ascending: false })
          .limit(WORKOUT_PROGRESS_ACTIVITY_LIMIT),
        db
          .from("workout_exercise_catalog")
          .select("id, primary_muscle_group_slug")
          .limit(1_000),
      ]);
      if (activitiesResult.error) throw activitiesResult.error;
      if (catalogResult.error) throw catalogResult.error;
      if (requestSequence.current !== requestId) return;
      setActivities(
        (activitiesResult.data ?? []) as WorkoutProgressActivityRow[],
      );
      setCatalog((catalogResult.data ?? []) as WorkoutProgressCatalogRow[]);
      setDataUserId(userId);
      setUpdatedAt(new Date().toISOString());
    } catch (queryError) {
      if (requestSequence.current !== requestId) return;
      setError(errorMessage(queryError));
    } finally {
      if (requestSequence.current === requestId) setLoading(false);
    }
  }, [db, enabled, userId]);

  useEffect(() => {
    if (!enabled || !userId) return;
    // A carga inicial sincroniza o estado local com o banco; o refresh só
    // atualiza após as promises resolverem e é invalidado no cleanup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    return () => {
      requestSequence.current += 1;
    };
  }, [enabled, refresh, userId]);

  const visibleActivities = useMemo(
    () =>
      enabled && userId && dataUserId === userId ? activities : [],
    [activities, dataUserId, enabled, userId],
  );
  const visibleCatalog = useMemo(
    () => (enabled && userId ? catalog : []),
    [catalog, enabled, userId],
  );
  const progress = useMemo(
    () =>
      buildWorkoutProgress(
        visibleActivities,
        visibleCatalog,
      ),
    [visibleActivities, visibleCatalog],
  );

  return {
    ...progress,
    activities: visibleActivities,
    catalog: visibleCatalog,
    loading: Boolean(enabled && userId && loading),
    error: enabled && userId ? error : null,
    updatedAt: dataUserId === userId ? updatedAt : null,
    refresh,
    retry: refresh,
  };
}

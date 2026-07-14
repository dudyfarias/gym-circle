"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth, useGymCircleClient } from "@gym-circle/core/hooks";
import {
  buildExerciseHistory,
  type ExerciseHistoryActivityRow,
} from "./exerciseHistory";

/**
 * Sprint 2 (Treinos) — últimas sessões de força do PRÓPRIO usuário, indexadas
 * por exercício. Client-side (dataset pequeno); RPC entra na Sprint 3.
 * O `.eq("user_id", ...)` é obrigatório: o RLS de activities também expõe
 * treinos de quem o usuário segue.
 */
export function useExerciseHistory(enabled: boolean) {
  const client = useGymCircleClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const db = client as unknown as SupabaseClient;
  const [activities, setActivities] = useState<ExerciseHistoryActivityRow[]>(
    [],
  );
  const [dataUserId, setDataUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const refresh = useCallback(() => {
    setRefreshVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !userId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: queryError } = await db
          .from("activities")
          .select("id, started_at, ended_at, strength_sets")
          .eq("user_id", userId)
          .eq("activity_type", "strength")
          .not("strength_sets", "is", null)
          .order("started_at", { ascending: false })
          .limit(60);
        if (queryError) throw queryError;
        if (!cancelled) {
          setActivities((data ?? []) as ExerciseHistoryActivityRow[]);
          setDataUserId(userId);
        }
      } catch (queryError) {
        if (!cancelled) {
          setActivities([]);
          setDataUserId(userId);
          setError(
            queryError instanceof Error
              ? queryError.message
              : "exercise_history_load_failed",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, enabled, refreshVersion, userId]);

  const visibleActivities = useMemo(
    () => (enabled && userId && dataUserId === userId ? activities : []),
    [activities, dataUserId, enabled, userId],
  );

  const historyByKey = useMemo(
    () => buildExerciseHistory(visibleActivities),
    [visibleActivities],
  );

  return {
    activities: visibleActivities,
    historyByKey,
    /** Última sessão de força salva ANTES da atual (base da comparação). */
    latestActivity: visibleActivities[0] ?? null,
    loading: Boolean(enabled && userId && loading),
    error: enabled && userId ? error : null,
    refresh,
  };
}

"use client";

import { useEffect, useMemo, useState } from "react";
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
  const db = client as unknown as SupabaseClient;
  const [activities, setActivities] = useState<ExerciseHistoryActivityRow[]>(
    [],
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !user) return;
    let cancelled = false;
    // Carga inicial/quando habilita; o effect só dispara fetch assíncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void db
      .from("activities")
      .select("id, started_at, ended_at, strength_sets")
      .eq("user_id", user.id)
      .eq("activity_type", "strength")
      .not("strength_sets", "is", null)
      .order("started_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (cancelled) return;
        setActivities((data ?? []) as ExerciseHistoryActivityRow[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [db, enabled, user]);

  const historyByKey = useMemo(
    () => buildExerciseHistory(activities),
    [activities],
  );

  return {
    activities,
    historyByKey,
    /** Última sessão de força salva ANTES da atual (base da comparação). */
    latestActivity: activities[0] ?? null,
    loading,
  };
}

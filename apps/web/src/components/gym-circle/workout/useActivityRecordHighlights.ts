"use client";

import { useEffect, useState } from "react";
import { useGymCircleClient } from "@gym-circle/core/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkoutRecordHighlight } from "../social/types";

type HighlightRow = {
  highlight_id: string;
  metric_key: string;
  exercise_id: string | null;
  exercise_name: string | null;
  value: number | string;
  unit: string;
  reps: number | null;
  is_estimated: boolean | null;
  achieved_at: string | null;
};

export function useActivityRecordHighlights(activityId: string | null) {
  const client = useGymCircleClient();
  const [highlights, setHighlights] = useState<WorkoutRecordHighlight[]>([]);

  useEffect(() => {
    let active = true;
    if (!activityId) {
      return () => {
        active = false;
      };
    }

    void (async () => {
      const result = await (client as unknown as SupabaseClient).rpc(
        "get_activity_record_highlights",
        { p_activity_id: activityId },
      );
      if (!active || result.error) return;
      setHighlights(
        ((result.data ?? []) as HighlightRow[]).map((row) => ({
          id: row.highlight_id,
          metricKey: row.metric_key,
          exerciseId: row.exercise_id,
          exerciseName: row.exercise_name,
          value: Number(row.value),
          unit: row.unit,
          reps: row.reps,
          isEstimated: Boolean(row.is_estimated),
          achievedAt: row.achieved_at,
        })),
      );
    })();

    return () => {
      active = false;
    };
  }, [activityId, client]);

  return activityId ? highlights : [];
}

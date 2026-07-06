"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth, useGymCircleClient } from "@gym-circle/core/hooks";

export type PersonalRecordMetric =
  | "strength_weight"
  | "run_5k_time"
  | "run_10k_time";

export type PersonalRecord = {
  id: string;
  userId: string;
  activityId: string;
  metricKey: PersonalRecordMetric;
  exerciseKey: string;
  exerciseName: string | null;
  value: number;
  unit: "kg" | "seconds";
  reps: number | null;
  isEstimated: boolean;
  achievedAt: string;
};

export type PersonalRecordLeaderboardRow = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  value: number;
  unit: "kg" | "seconds";
  reps: number | null;
  isEstimated: boolean;
  achievedAt: string;
  rank: number;
};

type RecordRow = {
  record_id: string;
  user_id: string;
  activity_id: string;
  metric_key: PersonalRecordMetric;
  exercise_key: string;
  exercise_name: string | null;
  value: number | string;
  unit: "kg" | "seconds";
  reps: number | null;
  is_estimated: boolean;
  achieved_at: string;
};

type LeaderboardRow = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  value: number | string;
  unit: "kg" | "seconds";
  reps: number | null;
  is_estimated: boolean;
  achieved_at: string;
  rank: number;
};

function mapRecord(row: RecordRow): PersonalRecord {
  return {
    id: row.record_id,
    userId: row.user_id,
    activityId: row.activity_id,
    metricKey: row.metric_key,
    exerciseKey: row.exercise_key,
    exerciseName: row.exercise_name,
    value: Number(row.value),
    unit: row.unit,
    reps: row.reps,
    isEstimated: row.is_estimated,
    achievedAt: row.achieved_at,
  };
}

function mapLeaderboard(row: LeaderboardRow): PersonalRecordLeaderboardRow {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    value: Number(row.value),
    unit: row.unit,
    reps: row.reps,
    isEstimated: row.is_estimated,
    achievedAt: row.achieved_at,
    rank: row.rank,
  };
}

export function usePersonalRecords() {
  const client = useGymCircleClient();
  const { user } = useAuth();
  const db = client as unknown as SupabaseClient;
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setRecords([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await db.rpc("get_personal_records");
      if (queryError) throw queryError;
      setRecords(((data ?? []) as RecordRow[]).map(mapRecord));
    } catch (queryError) {
      setError(
        queryError instanceof Error ? queryError.message : "records_load_failed",
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

  const loadLeaderboard = useCallback(
    async (
      record: PersonalRecord,
    ): Promise<PersonalRecordLeaderboardRow[]> => {
      const { data, error: queryError } = await db.rpc(
        "get_personal_record_leaderboard",
        {
          p_metric_key: record.metricKey,
          p_exercise_key: record.exerciseKey,
          p_limit: 20,
        },
      );
      if (queryError) throw queryError;
      return ((data ?? []) as LeaderboardRow[]).map(mapLeaderboard);
    },
    [db],
  );

  return { records, loading, error, refresh, loadLeaderboard };
}

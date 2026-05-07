import type { UserActivityDayRow, UserStatsRow } from "../domain/types";
import type { GymCircleClient } from "./supabase";

export function statsService(client: GymCircleClient) {
  return {
    async forUser(userId: string): Promise<UserStatsRow | null> {
      const { data, error } = await client
        .from("user_stats_live")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as UserStatsRow | null;
    },

    async refreshMine(): Promise<void> {
      const { error } = await client.rpc("refresh_my_stats");
      if (error) throw error;
    },

    async activityDaysForUser(userId: string, sinceDays = 365): Promise<UserActivityDayRow[]> {
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - sinceDays);
      const sinceKey = since.toISOString().slice(0, 10);

      const { data, error } = await client
        .from("user_activity_days")
        .select("*")
        .eq("user_id", userId)
        .gte("activity_date", sinceKey)
        .order("activity_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  };
}

export type StatsService = ReturnType<typeof statsService>;

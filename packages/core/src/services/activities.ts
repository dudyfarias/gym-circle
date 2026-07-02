import {
  activityInputToRow,
  activityRowToDomain,
  type Activity,
  type ActivityInput,
  type ActivityRow,
} from "../domain/activity";
import type { GymCircleClient } from "./supabase";

export function activityService(client: GymCircleClient) {
  return {
    /** Grava uma atividade rastreada; o trigger marca o dia/streak. */
    async create(userId: string, input: ActivityInput): Promise<Activity> {
      const { data, error } = await client
        .from("activities")
        .insert(activityInputToRow(input, userId))
        .select("*")
        .single();
      if (error) throw error;
      return activityRowToDomain(data as ActivityRow);
    },

    /** Atividades recentes do próprio user (RLS restringe ao dono). */
    async recentForUser(userId: string, limit = 30): Promise<Activity[]> {
      const { data, error } = await client
        .from("activities")
        .select("*")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as ActivityRow[]).map(activityRowToDomain);
    },
  };
}

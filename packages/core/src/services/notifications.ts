import type { NotificationRow } from "../domain/types";
import type { GymCircleClient } from "./supabase";

export function notificationService(client: GymCircleClient) {
  return {
    async listForUser(userId: string, limit = 50): Promise<NotificationRow[]> {
      const { data, error } = await client
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },

    async markAllRead(userId: string): Promise<void> {
      const { error } = await client
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);
      if (error) throw error;
    },

    async markRead(notificationId: string): Promise<void> {
      const { error } = await client
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId);
      if (error) throw error;
    },
  };
}

export type NotificationService = ReturnType<typeof notificationService>;

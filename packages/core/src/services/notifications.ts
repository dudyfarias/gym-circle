import type { NotificationRow } from "../domain/types";
import type { GymCircleClient } from "./supabase";

export const SOCIAL_BELL_NOTIFICATION_KINDS = [
  "like",
  "comment",
  "comment_like",
  "comment_reply",
  "follow",
  "mention",
  "follow_request",
  "story_like",
  "post_tag",
  "story_tag",
] as const;

export type SocialBellNotificationKind = (typeof SOCIAL_BELL_NOTIFICATION_KINDS)[number];

export function isSocialBellNotificationKind(kind: string): kind is SocialBellNotificationKind {
  return SOCIAL_BELL_NOTIFICATION_KINDS.includes(kind as SocialBellNotificationKind);
}

export function notificationService(client: GymCircleClient) {
  return {
    async listForUser(userId: string, limit = 50): Promise<NotificationRow[]> {
      const { data, error } = await client
        .from("notifications")
        .select("id,user_id,actor_id,kind,post_id,comment_id,story_id,body,read_at,created_at")
        .eq("user_id", userId)
        .in("kind", SOCIAL_BELL_NOTIFICATION_KINDS)
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
        .in("kind", SOCIAL_BELL_NOTIFICATION_KINDS)
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

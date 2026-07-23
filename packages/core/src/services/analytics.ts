import type { Json } from "../database.types";
import type { AnalyticsEventRow } from "../domain/types";
import type { GymCircleClient } from "./supabase";

export type AnalyticsEventName =
  | "signup_completed"
  | "profile_completed"
  | "first_post_created"
  | "post_created"
  | "streak_lit"
  | "follow_created"
  | "like_created"
  | "comment_created"
  | "story_created"
  | "message_sent"
  | "conversation_opened"
  | "checkin_created"
  | "day_1_retention"
  | "app_opened"
  | "streak_restore_used"
  | "streak_restore_earned"
  | "streak_restore_expired"
  | "streak_lost"
  | "streak_saved"
  | "sport_catalog_opened"
  | "sport_searched"
  | "sport_started"
  | "sport_favorite_changed"
  | "sport_start_cancelled";

export function analyticsService(client: GymCircleClient) {
  return {
    async track(
      userId: string,
      eventName: AnalyticsEventName,
      metadata: Json = {},
    ): Promise<AnalyticsEventRow> {
      const { data, error } = await client
        .from("analytics_events")
        .insert({
          user_id: userId,
          event_name: eventName,
          metadata,
          source: "client",
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },

    async trackSafe(
      userId: string,
      eventName: AnalyticsEventName,
      metadata: Json = {},
    ): Promise<void> {
      try {
        await this.track(userId, eventName, metadata);
      } catch {
        // Analytics nunca pode quebrar o loop social principal.
      }
    },

    async trackDay1RetentionIfEligible(userId: string, signupCreatedAt: string): Promise<void> {
      const signupDate = new Date(signupCreatedAt);
      const today = new Date();
      const signupKey = signupDate.toISOString().slice(0, 10);
      const todayKey = today.toISOString().slice(0, 10);
      if (signupKey >= todayKey) return;

      const { data, error } = await client
        .from("analytics_events")
        .select("id")
        .eq("user_id", userId)
        .eq("event_name", "day_1_retention")
        .maybeSingle();
      if (error) throw error;
      if (data) return;

      await this.track(userId, "day_1_retention", { signup_date: signupKey });
    },
  };
}

export type AnalyticsService = ReturnType<typeof analyticsService>;

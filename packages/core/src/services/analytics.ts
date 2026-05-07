import type { Json } from "../database.types";
import type { AnalyticsEventRow } from "../domain/types";
import type { GymCircleClient } from "./supabase";

export type AnalyticsEventName =
  | "signup_completed"
  | "profile_completed"
  | "first_post_created"
  | "streak_lit"
  | "follow_created"
  | "like_created"
  | "comment_created"
  | "story_created"
  | "checkin_created"
  | "day_1_retention"
  | "app_opened";

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

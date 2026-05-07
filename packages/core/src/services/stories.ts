import type { CreateStoryInput, EnrichedStory, StoryRow } from "../domain/types";
import type { GymCircleClient } from "./supabase";

export function storyService(client: GymCircleClient) {
  return {
    async create(userId: string, input: CreateStoryInput): Promise<StoryRow> {
      const { data, error } = await client
        .from("stories")
        .insert({
          user_id: userId,
          media_url: input.mediaUrl,
          gym_id: input.gymId,
          workout_type: input.workoutType,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },

    async remove(storyId: string): Promise<void> {
      const { error } = await client.from("stories").delete().eq("id", storyId);
      if (error) throw error;
    },

    async listActive(limit = 50): Promise<EnrichedStory[]> {
      const { data, error } = await client
        .from("stories")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const rows = (data ?? []) as StoryRow[];
      if (rows.length === 0) return [];

      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const [profilesRes, statsRes] = await Promise.all([
        client
          .from("profiles")
          .select("user_id, username, display_name, avatar_url")
          .in("user_id", userIds),
        client
          .from("user_stats")
          .select("user_id, current_streak, badge_is_active_today")
          .in("user_id", userIds),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (statsRes.error) throw statsRes.error;

      const profilesById = new Map(
        (profilesRes.data ?? []).map((p) => [p.user_id, p]),
      );
      const statsById = new Map(
        (statsRes.data ?? []).map((s) => [s.user_id, s]),
      );

      return rows.map((row) => {
        const profile = profilesById.get(row.user_id);
        const stats = statsById.get(row.user_id);
        return {
          ...row,
          author_username: profile?.username ?? "",
          author_display_name: profile?.display_name ?? "",
          author_avatar_url: profile?.avatar_url ?? null,
          author_current_streak: stats?.current_streak ?? null,
          author_badge_active: stats?.badge_is_active_today ?? null,
        };
      });
    },
  };
}

export type StoryService = ReturnType<typeof storyService>;

import type {
  CreateStoryInput,
  EnrichedStory,
  StoryLikeRow,
  StoryMuteRow,
  StoryRow,
  StoryViewRow,
} from "../domain/types";
import type { GymCircleClient } from "./supabase";

function isOptionalStorySocialTableMissing(
  error: unknown,
  table: "story_likes" | "story_mutes" | "story_views",
) {
  const postgrestError = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  const haystack = [
    postgrestError.code,
    postgrestError.message,
    postgrestError.details,
    postgrestError.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    postgrestError.code === "PGRST205" ||
    postgrestError.code === "42P01" ||
    (haystack.includes("schema cache") && haystack.includes(table)) ||
    haystack.includes(`public.${table}`) ||
    haystack.includes(`relation "${table}" does not exist`)
  );
}

export function storyService(client: GymCircleClient) {
  return {
    async create(userId: string, input: CreateStoryInput): Promise<StoryRow> {
      if (!input.mediaUrl?.trim()) {
        throw new Error("foto ou vídeo obrigatório");
      }
      const { data, error } = await client
        .from("stories")
        .insert({
          user_id: userId,
          media_url: input.mediaUrl,
          media_type: input.mediaType,
          gym_id: input.gymId,
          workout_type: input.workoutType?.trim() || null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as StoryRow;
    },

    async remove(storyId: string): Promise<void> {
      const { error } = await client.from("stories").delete().eq("id", storyId);
      if (error) throw error;
    },

    async like(storyId: string, userId: string): Promise<StoryLikeRow> {
      const { data, error } = await client
        .from("story_likes")
        .upsert(
          { story_id: storyId, user_id: userId },
          { onConflict: "story_id,user_id", ignoreDuplicates: true },
        )
        .select("*")
        .maybeSingle();
      if (error && !isOptionalStorySocialTableMissing(error, "story_likes")) {
        throw error;
      }
      return data ?? {
        story_id: storyId,
        user_id: userId,
        created_at: new Date().toISOString(),
      };
    },

    async unlike(storyId: string, userId: string): Promise<void> {
      const { error } = await client
        .from("story_likes")
        .delete()
        .match({ story_id: storyId, user_id: userId });
      if (error && !isOptionalStorySocialTableMissing(error, "story_likes")) {
        throw error;
      }
    },

    async mute(userId: string, mutedUserId: string): Promise<StoryMuteRow> {
      if (userId === mutedUserId) {
        throw new Error("não dá para silenciar a si mesmo");
      }
      const { data, error } = await client
        .from("story_mutes")
        .upsert(
          { user_id: userId, muted_user_id: mutedUserId },
          { onConflict: "user_id,muted_user_id", ignoreDuplicates: true },
        )
        .select("*")
        .maybeSingle();
      if (error && !isOptionalStorySocialTableMissing(error, "story_mutes")) {
        throw error;
      }
      return data ?? {
        user_id: userId,
        muted_user_id: mutedUserId,
        created_at: new Date().toISOString(),
      };
    },

    async unmute(userId: string, mutedUserId: string): Promise<void> {
      const { error } = await client
        .from("story_mutes")
        .delete()
        .match({ user_id: userId, muted_user_id: mutedUserId });
      if (error && !isOptionalStorySocialTableMissing(error, "story_mutes")) {
        throw error;
      }
    },

    async markViewed(storyId: string, userId: string): Promise<StoryViewRow> {
      const viewedAt = new Date().toISOString();
      const { data, error } = await client
        .from("story_views")
        .upsert(
          { story_id: storyId, user_id: userId, viewed_at: viewedAt },
          { onConflict: "story_id,user_id" },
        )
        .select("*")
        .maybeSingle();
      if (error && !isOptionalStorySocialTableMissing(error, "story_views")) {
        throw error;
      }
      return data ?? {
        story_id: storyId,
        user_id: userId,
        viewed_at: viewedAt,
      };
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
          .from("user_stats_live")
          .select("user_id, current_streak, badge_is_active_today")
          .in("user_id", userIds),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (statsRes.error) throw statsRes.error;

      const profilesById = new Map(
        (profilesRes.data ?? []).map((p) => [p.user_id, p]),
      );
      const statsById = new Map(
        ((statsRes.data ?? []) as Array<{
          user_id: string;
          current_streak: number;
          badge_is_active_today: boolean;
        }>).map((s) => [s.user_id, s]),
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

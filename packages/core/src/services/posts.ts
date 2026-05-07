import type {
  CreatePostInput,
  EnrichedPost,
  FeedPostRow,
  PostCommentRow,
  PostRow,
} from "../domain/types";
import type { GymCircleClient } from "./supabase";

type CommentRow = PostCommentRow & {
  author_username: string;
  author_display_name: string;
  author_badge_active: boolean | null;
  author_current_streak: number | null;
};

export function postService(client: GymCircleClient) {
  return {
    async create(userId: string, input: CreatePostInput): Promise<PostRow> {
      if (!input.imageUrl?.trim()) {
        throw new Error("foto ou vídeo obrigatório");
      }
      const locationSource = input.locationSource ?? "none";
      const { data, error } = await client
        .from("posts")
        .insert({
          user_id: userId,
          image_url: input.imageUrl,
          media_type: input.mediaType,
          caption: input.caption.trim() || null,
          gym_id: input.gymId,
          workout_type: input.workoutType?.trim() || null,
          workout_date: input.workoutDate,
          location_source: locationSource,
          location_name: locationSource === "none" ? null : input.locationName?.trim() || null,
          location_latitude: locationSource === "none" ? null : input.locationLatitude ?? null,
          location_longitude: locationSource === "none" ? null : input.locationLongitude ?? null,
          location_google_maps_url:
            locationSource === "none" ? null : input.locationGoogleMapsUrl?.trim() || null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },

    async remove(postId: string): Promise<void> {
      const { error } = await client.from("posts").delete().eq("id", postId);
      if (error) throw error;
    },

    /**
     * Carrega o feed enriquecido com counts, autor e streak.
     * Usa a view `feed_posts` (security_invoker) e completa em TS com:
     *  - liked_by_me (a partir de post_likes)
     *  - comment_previews (últimos 2 comentários)
     */
    async listFeed(currentUserId: string | null, limit = 30): Promise<EnrichedPost[]> {
      const { data: feedRows, error } = await client
        .from("feed_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const rows = (feedRows ?? []) as FeedPostRow[];
      if (rows.length === 0) return [];

      const ids = rows.map((row) => row.id);

      const likesPromise = currentUserId
        ? client
            .from("post_likes")
            .select("post_id")
            .eq("user_id", currentUserId)
            .in("post_id", ids)
        : Promise.resolve({ data: [] as Array<{ post_id: string }>, error: null });

      const [likesRes, commentsRes] = await Promise.all([
        likesPromise,
        client
          .from("post_comments")
          .select("id, post_id, user_id, body, created_at")
          .in("post_id", ids)
          .order("created_at", { ascending: true }),
      ]);

      if (likesRes.error) throw likesRes.error;
      if (commentsRes.error) throw commentsRes.error;

      const likedSet = new Set((likesRes.data ?? []).map((row) => row.post_id));
      const commentRows = (commentsRes.data ?? []) as PostCommentRow[];

      const authorIds = Array.from(new Set(commentRows.map((c) => c.user_id)));
      let authorsById = new Map<
        string,
        { username: string; display_name: string }
      >();
      let statsById = new Map<
        string,
        { current_streak: number; badge_is_active_today: boolean }
      >();

      if (authorIds.length > 0) {
        const [profilesRes, statsRes] = await Promise.all([
          client
            .from("profiles")
            .select("user_id, username, display_name")
            .in("user_id", authorIds),
          client
            .from("user_stats")
            .select("user_id, current_streak, badge_is_active_today")
            .in("user_id", authorIds),
        ]);
        if (profilesRes.error) throw profilesRes.error;
        if (statsRes.error) throw statsRes.error;
        authorsById = new Map(
          (profilesRes.data ?? []).map((p) => [
            p.user_id,
            { username: p.username, display_name: p.display_name },
          ]),
        );
        statsById = new Map(
          (statsRes.data ?? []).map((s) => [
            s.user_id,
            { current_streak: s.current_streak, badge_is_active_today: s.badge_is_active_today },
          ]),
        );
      }

      const commentsByPost = new Map<string, CommentRow[]>();
      for (const row of commentRows) {
        const list = commentsByPost.get(row.post_id) ?? [];
        const author = authorsById.get(row.user_id);
        const stats = statsById.get(row.user_id);
        list.push({
          ...row,
          author_username: author?.username ?? "",
          author_display_name: author?.display_name ?? "",
          author_current_streak: stats?.current_streak ?? null,
          author_badge_active: stats?.badge_is_active_today ?? null,
        });
        commentsByPost.set(row.post_id, list);
      }

      return rows.map((row) => ({
        ...row,
        liked_by_me: likedSet.has(row.id),
        comment_previews: (commentsByPost.get(row.id) ?? []).slice(-2),
      }));
    },

    async listByUser(userId: string, limit = 30): Promise<PostRow[]> {
      const { data, error } = await client
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },

    async like(postId: string, userId: string): Promise<void> {
      const { error } = await client
        .from("post_likes")
        .insert({ post_id: postId, user_id: userId });
      if (error && error.code !== "23505") throw error;
    },

    async unlike(postId: string, userId: string): Promise<void> {
      const { error } = await client
        .from("post_likes")
        .delete()
        .match({ post_id: postId, user_id: userId });
      if (error) throw error;
    },

    async comment(postId: string, userId: string, body: string): Promise<PostCommentRow> {
      const trimmed = body.trim();
      if (!trimmed) throw new Error("comentário vazio");
      const { data, error } = await client
        .from("post_comments")
        .insert({ post_id: postId, user_id: userId, body: trimmed })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
  };
}

export type PostService = ReturnType<typeof postService>;

import type {
  CreatePostInput,
  EnrichedPost,
  FeedPostRow,
  PostCommentLikeRow,
  PostCommentRow,
  PostMediaInput,
  PostMediaRow,
  PostMuteRow,
  PostRow,
} from "../domain/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GymCircleClient } from "./supabase";

type CommentRow = PostCommentRow & {
  author_username: string;
  author_display_name: string;
  author_badge_active: boolean | null;
  author_current_streak: number | null;
};

function mediaRpcRows(items: PostMediaInput[]) {
  return items.slice(0, 10).map((media) => ({
    media_type: media.mediaType,
    image_url: media.imageUrl,
    thumbnail_url: media.thumbnailUrl?.trim() || null,
    poster_url: media.posterUrl?.trim() || null,
    blur_data_url: media.blurDataUrl?.trim() || null,
    media_width: media.mediaWidth ?? null,
    media_height: media.mediaHeight ?? null,
    media_duration_seconds: media.mediaDurationSeconds ?? null,
  }));
}

export function postService(client: GymCircleClient) {
  // Os RPCs desta entrega são mantidos na migration junto do código. O cast
  // local evita que um type snapshot antigo do Supabase force o app a voltar
  // ao fluxo multi-request não atômico.
  const rpcClient = client as unknown as SupabaseClient;

  return {
    async create(userId: string, input: CreatePostInput): Promise<PostRow> {
      if (!input.imageUrl?.trim()) {
        throw new Error("foto ou vídeo obrigatório");
      }
      const locationSource = input.locationSource ?? "none";
      const completeMedia =
        input.media && input.media.length > 0
          ? input.media
          : [
              {
                mediaType: input.mediaType,
                imageUrl: input.imageUrl,
                thumbnailUrl: input.thumbnailUrl ?? null,
                posterUrl: input.posterUrl ?? null,
                blurDataUrl: input.blurDataUrl ?? null,
                mediaWidth: input.mediaWidth ?? null,
                mediaHeight: input.mediaHeight ?? null,
                mediaDurationSeconds: input.mediaDurationSeconds ?? null,
              },
            ];
      const { data, error } = await rpcClient
        .rpc("create_social_post_with_media", {
          p_post: {
            source_checkin_id: input.sourceCheckinId ?? null,
            source_activity_id: input.sourceActivityId ?? null,
            caption: input.caption.trim() || null,
            gym_id: input.gymId,
            workout_type: input.workoutType?.trim() || null,
            workout_types:
              input.workoutTypes && input.workoutTypes.length > 0
                ? input.workoutTypes
                : null,
            workout_date: input.workoutDate ?? null,
            created_at: input.createdAt ?? null,
            location_source: locationSource,
            location_name:
              locationSource === "none"
                ? null
                : input.locationName?.trim() || null,
            location_latitude:
              locationSource === "none"
                ? null
                : input.locationLatitude ?? null,
            location_longitude:
              locationSource === "none"
                ? null
                : input.locationLongitude ?? null,
            location_google_maps_url:
              locationSource === "none"
                ? null
                : input.locationGoogleMapsUrl?.trim() || null,
          },
          p_media: mediaRpcRows(completeMedia),
        })
        .single();
      if (error) throw error;
      // O RPC usa auth.uid() como fonte da verdade. O parâmetro continua na
      // assinatura pública do service por compatibilidade e é validado aqui.
      if (!userId || (data as PostRow).user_id !== userId) {
        throw new Error("O post criado não pertence à sessão atual.");
      }
      return data as PostRow;
    },

    /**
     * Sprint 13 — busca em lote as mídias do carrossel pros posts visíveis.
     * Ordenado por post + position. Posts sem linhas = single (cai na capa).
     */
    async mediaForPosts(postIds: string[]): Promise<PostMediaRow[]> {
      const ids = Array.from(new Set(postIds.filter(Boolean)));
      if (ids.length === 0) return [];
      const { data, error } = await client
        .from("post_media")
        .select("*")
        .in("post_id", ids)
        .order("post_id", { ascending: true })
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PostMediaRow[];
    },

    /**
     * Sprint 14 — define a lista COMPLETA de mídias de um post (editar:
     * adicionar/remover, até 10). Substitui post_media e mantém a capa (posts.*)
     * = item 0. Único método pra add/remove/reorder. RLS: dono (posts_update_self
     * + post_media_insert/delete).
     */
    async setMedia(postId: string, items: PostMediaInput[]): Promise<void> {
      const { error } = await rpcClient.rpc("replace_social_post_media", {
        p_post_id: postId,
        p_media: mediaRpcRows(items),
      });
      if (error) throw error;
    },

    async remove(postId: string): Promise<void> {
      const { error } = await client.from("posts").delete().eq("id", postId);
      if (error) throw error;
    },

    async update(
      postId: string,
      patch: { caption?: string | null; workout_type?: string | null },
    ): Promise<PostRow> {
      const { data, error } = await client
        .from("posts")
        .update(patch)
        .eq("id", postId)
        .select("*")
        .single();
      if (error) throw error;
      return data as PostRow;
    },

    async updateSocialDetails(
      postId: string,
      input: {
        caption?: string | null;
        workoutTypes?: string[] | null;
        gymId?: string | null;
        media?: PostMediaInput[];
      },
    ): Promise<void> {
      const { error } = await rpcClient.rpc("update_social_post_full", {
        p_post_id: postId,
        p_caption: input.caption ?? null,
        p_workout_types: input.workoutTypes ?? [],
        p_gym_id: input.gymId ?? null,
        p_media: input.media ? mediaRpcRows(input.media) : null,
      });
      if (error) throw error;
    },

    async convertToCheckin(postId: string, gymId: string): Promise<string> {
      const { data, error } = await client.rpc("convert_social_post_to_checkin", {
        p_post_id: postId,
        p_gym_id: gymId,
      });
      if (error) throw error;
      if (typeof data !== "string") {
        throw new Error("O check-in convertido não foi retornado.");
      }
      return data;
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
            .from("user_stats_live")
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
          ((statsRes.data ?? []) as Array<{
            user_id: string;
            current_streak: number;
            badge_is_active_today: boolean;
          }>).map((s) => [
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
      return (data ?? []) as PostRow[];
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

    async comment(
      postId: string,
      userId: string,
      body: string,
      parentCommentId?: string | null,
    ): Promise<PostCommentRow> {
      const trimmed = body.trim();
      if (!trimmed) throw new Error("comentário vazio");
      // parent_comment_id: threading 1 nível (estilo Instagram). O trigger
      // notify_post_comment decide o destino da notificação (autor do
      // comentário-pai pra reply, dono do post pra top-level).
      const { data, error } = await client
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: userId,
          body: trimmed,
          parent_comment_id: parentCommentId ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },

    async deleteComment(commentId: string, _userId: string): Promise<void> {
      // Sprint 12.2 — deleta por id e deixa a RLS decidir
      // (post_comments_delete_author_or_owner): o AUTOR apaga o próprio OU o
      // DONO do post modera qualquer comentário do seu post. Filtrar por
      // user_id no client impediria a moderação do dono.
      const { error } = await client
        .from("post_comments")
        .delete()
        .eq("id", commentId);
      if (error) throw error;
    },

    async likeComment(
      commentId: string,
      userId: string,
    ): Promise<PostCommentLikeRow> {
      const { data, error } = await client
        .from("post_comment_likes")
        .insert({ comment_id: commentId, user_id: userId })
        .select("*")
        .single();
      if (error && error.code !== "23505") throw error;
      return (
        data ?? {
          comment_id: commentId,
          user_id: userId,
          created_at: new Date().toISOString(),
        }
      ) as PostCommentLikeRow;
    },

    async unlikeComment(commentId: string, userId: string): Promise<void> {
      const { error } = await client
        .from("post_comment_likes")
        .delete()
        .match({ comment_id: commentId, user_id: userId });
      if (error) throw error;
    },

    /**
     * Silenciar posts de outro usuário.
     * Não afeta follow nem stories — só esconde posts no feed.
     * Idempotente via upsert + ignoreDuplicates.
     */
    async mute(userId: string, mutedUserId: string): Promise<PostMuteRow> {
      if (userId === mutedUserId) {
        throw new Error("não dá para silenciar a si mesmo");
      }
      const { data, error } = await client
        .from("post_mutes")
        .upsert(
          { user_id: userId, muted_user_id: mutedUserId },
          { onConflict: "user_id,muted_user_id", ignoreDuplicates: true },
        )
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return (
        data ?? {
          user_id: userId,
          muted_user_id: mutedUserId,
          created_at: new Date().toISOString(),
        }
      );
    },

    async unmute(userId: string, mutedUserId: string): Promise<void> {
      const { error } = await client
        .from("post_mutes")
        .delete()
        .match({ user_id: userId, muted_user_id: mutedUserId });
      if (error) throw error;
    },
  };
}

export type PostService = ReturnType<typeof postService>;

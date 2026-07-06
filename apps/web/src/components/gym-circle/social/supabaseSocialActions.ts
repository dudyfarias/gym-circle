import type { Dispatch, SetStateAction } from "react";
import {
  buildGoogleMapsSearchUrl,
  buildGoogleMapsUrlFromCoordinates,
} from "@gym-circle/core";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import type {
  DirectMessageRow,
  FollowRow,
  PostCommentLikeRow,
  PostLikeRow,
  ProfileRow,
  StoryLikeRow,
  StoryRow,
  UserStatsRow,
} from "@gym-circle/core";
import { clearImageCache } from "../design-system/imageCache";
import { recordMediaPipelineEvent } from "../mediaTelemetry";
import { clearNativeFeelCaches } from "../native/LocalAppCache";
import { PushNotificationsService } from "../native/PushNotificationsService";
import { markPerf, measurePerf } from "../performance";
import { buildWorkoutPublishPlan } from "../postPublishPlan";
import { simulateHaptic } from "./haptics";
import { mergeProfileRows } from "./profileRows";
import { buildStoryShareBody } from "./storyInteractions";
import {
  buildReactivationRedirectUrl,
  persistStoredViewedStoryIds,
  writeNativeOwnProfileCache,
} from "./supabaseSocialCache";
import {
  FOLLOW_COLUMNS,
  PROFILE_COLUMNS,
  USER_STATS_COLUMNS,
} from "./supabaseSocialConstants";
import {
  enrichedUserFromDiscovery,
  enrichedUserFromProfileRow,
  findDirectConversationId,
  followRowFromDiscovery,
  mergeRowsByKey,
  mergeStatsArrays,
  profileRowFromDiscovery,
  statsRowFromDiscovery,
} from "./supabaseSocialMappers";
import { querySearchProfilesSurface } from "./supabaseSocialSurfaces";
import type { AggregateState } from "./supabaseSocialTypes";
import type {
  ActivityEntryInput,
  CreateWorkoutPostInput,
  EditPostInput,
  EnrichedPost,
  EnrichedStory,
  EnrichedUser,
  FeedbackTone,
  FinishedWebActivity,
  ProfileEditInput,
  PromoteCheckinInput,
  SendChatMessageInput,
  StoryGroup,
  WebActivityInput,
} from "./types";
import type { SupabaseSocialActions } from "./useSupabaseSocial";

/**
 * Factory das ações sociais do useSupabaseSocial — extraída do hook na
 * Sprint 21.4 Fase 4. É o objeto SupabaseSocialActions (like/comment/follow/
 * post CRUD/story/chat/...), que era um useMemo de ~1.000 linhas. Movido pra
 * cá como factory PURA: o hook chama dentro do mesmo useMemo com o mesmo dep
 * array, então a estabilidade referencial e a captura de closures não mudam.
 * Todas as deps de runtime (setters/refs/services/callbacks/derivados) entram
 * via ctx; os helpers módulo-level são importados aqui.
 */
export type SocialActionsContext = {
  setAgg: Dispatch<SetStateAction<AggregateState>>;
  aggRef: { current: AggregateState };
  mountedRef: { current: boolean };
  currentUserId: string;
  services: ReturnType<typeof useGymCircleServices>;
  refresh: () => Promise<void>;
  refreshChat: () => Promise<void>;
  refreshConversationMessages: (conversationId: string) => Promise<void>;
  refreshPostDetails: (postId: string) => Promise<void>;
  refreshProfilePosts: (userId: string) => Promise<void>;
  ensureProfilePostsForMonth: (userId: string, monthKey: string) => Promise<void>;
  refreshStoryViewerItems: (authorId: string) => Promise<StoryRow[]>;
  loadMoreFeed: () => Promise<void>;
  showFeedback: (tone: FeedbackTone, title: string, detail?: string) => void;
  setSelectedStoryId: Dispatch<SetStateAction<string | null>>;
  setSelectedStoryGroupId: Dispatch<SetStateAction<string | null>>;
  setViewedStoryIds: Dispatch<SetStateAction<Set<string>>>;
  viewedStoryIds: Set<string>;
  profilePosts: EnrichedPost[];
  storyGroups: StoryGroup[];
  storyItems: EnrichedStory[];
  enrichedAll: Map<string, EnrichedUser>;
  agg: AggregateState;
};

export function createSocialActions(
  ctx: SocialActionsContext,
): SupabaseSocialActions {
  const {
    setAgg,
    aggRef,
    mountedRef,
    currentUserId,
    services,
    refresh,
    refreshChat,
    refreshConversationMessages,
    refreshPostDetails,
    refreshProfilePosts,
    ensureProfilePostsForMonth,
    refreshStoryViewerItems,
    loadMoreFeed,
    showFeedback,
    setSelectedStoryId,
    setSelectedStoryGroupId,
    setViewedStoryIds,
    viewedStoryIds,
    profilePosts,
    storyGroups,
    storyItems,
    enrichedAll,
    agg,
  } = ctx;
  const createPostWithTelemetry = async (
    operation: string,
    input: Parameters<typeof services.posts.create>[1],
  ) => {
    const startedAt = performance.now();
    try {
      const post = await services.posts.create(currentUserId, input);
      void recordMediaPipelineEvent(services.client, {
        operation,
        stage: "metadata",
        status: "succeeded",
        durationMs: performance.now() - startedAt,
        metadata: { media_count: input.media?.length ?? 1 },
      });
      return post;
    } catch (error) {
      await recordMediaPipelineEvent(services.client, {
        operation,
        stage: "metadata",
        status: "failed",
        durationMs: performance.now() - startedAt,
        error,
        metadata: { media_count: input.media?.length ?? 1 },
      });
      throw error;
    }
  };
  // Padrão idêntico ao useMemo<SupabaseSocialActions>(() => ({...})) original:
  // a arrow atribuída a um slot `() => T` dá tipagem contextual aos params
  // (catalogPlace/createGroupConversation) E permite a prop extra deleteComment
  // (consumida via tipo mais amplo em types.ts) por atribuibilidade — sem o
  // excess-property-check que um `const x: T = {}` direto imporia.
  const build: () => SupabaseSocialActions = () => ({
      async searchProfiles(query: string) {
        const searchRes = await querySearchProfilesSurface(services.client, query, 30);
        if (searchRes.error) throw searchRes.error;
        const rows = searchRes.data ?? [];
        const profiles = rows.map(profileRowFromDiscovery);
        const stats = rows.map(statsRowFromDiscovery);
        const follows = rows
          .map((row) => followRowFromDiscovery(row, currentUserId))
          .filter((follow): follow is FollowRow => Boolean(follow));

        if (mountedRef.current) {
          setAgg((current) => ({
            ...current,
            profiles: mergeProfileRows(current.profiles, profiles),
            stats: mergeStatsArrays(current.stats, stats),
            follows: mergeRowsByKey(
              current.follows,
              follows,
              (follow) => `${follow.follower_id}:${follow.following_id}`,
            ),
          }));
        }

        return rows.map(enrichedUserFromDiscovery);
      },
      async listFollowUsers(userId: string, kind: "followers" | "following") {
        const edgesQuery =
          kind === "followers"
            ? services.client
                .from("follows")
                .select(FOLLOW_COLUMNS)
                .eq("following_id", userId)
                .eq("status", "accepted")
                .order("created_at", { ascending: false })
            : services.client
                .from("follows")
                .select(FOLLOW_COLUMNS)
                .eq("follower_id", userId)
                .eq("status", "accepted")
                .order("created_at", { ascending: false });

        const edgesRes = await edgesQuery;
        if (edgesRes.error) throw edgesRes.error;
        const edges = (edgesRes.data ?? []) as FollowRow[];
        const orderedIds = edges
          .map((edge) => (kind === "followers" ? edge.follower_id : edge.following_id))
          .filter((id) => id !== currentUserId || userId === currentUserId);
        const uniqueIds = Array.from(new Set(orderedIds));
        if (uniqueIds.length === 0) return [];

        const [profilesRes, statsRes, myFollowsRes] = await Promise.all([
          services.client
            .from("profiles")
            .select(PROFILE_COLUMNS)
            .in("user_id", uniqueIds)
            .or("account_status.is.null,account_status.eq.active"),
          services.client
            .from("user_stats_live")
            .select(USER_STATS_COLUMNS)
            .in("user_id", uniqueIds),
          services.client
            .from("follows")
            .select(FOLLOW_COLUMNS)
            .eq("follower_id", currentUserId)
            .in("following_id", uniqueIds),
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (statsRes.error) throw statsRes.error;
        if (myFollowsRes.error) throw myFollowsRes.error;

        const profiles = (profilesRes.data ?? []) as unknown as ProfileRow[];
        const statsRows = (statsRes.data ?? []) as unknown as UserStatsRow[];
        const myFollowRows = (myFollowsRes.data ?? []) as FollowRow[];
        const statsByUser = new Map(statsRows.map((stats) => [stats.user_id, stats]));
        const myFollowStatusByTarget = new Map<string, "pending" | "accepted">();
        for (const follow of myFollowRows) {
          if (follow.status === "pending" || follow.status === "accepted") {
            myFollowStatusByTarget.set(follow.following_id, follow.status);
          }
        }
        const profileByUser = new Map(profiles.map((profile) => [profile.user_id, profile]));

        if (mountedRef.current) {
          setAgg((current) => ({
            ...current,
            profiles: mergeProfileRows(current.profiles, profiles),
            stats: mergeStatsArrays(current.stats, statsRows),
            follows: mergeRowsByKey(
              current.follows,
              [...edges, ...myFollowRows],
              (follow) => `${follow.follower_id}:${follow.following_id}`,
            ),
          }));
        }

        return uniqueIds
          .map((id) => {
            const profile = profileByUser.get(id);
            if (!profile) return null;
            return enrichedUserFromProfileRow(
              profile,
              statsByUser.get(id),
              myFollowStatusByTarget.get(id) ?? "none",
            );
          })
          .filter((user): user is EnrichedUser => Boolean(user));
      },
      async likePost(postId: string) {
        const post = profilePosts.find((p) => p.id === postId);
        const liked = post?.likedByCurrentUser ?? false;
        const optimisticLike: PostLikeRow = {
          post_id: postId,
          user_id: currentUserId,
          created_at: new Date().toISOString(),
        };

        setAgg((current) => ({
          ...current,
          feedPosts: current.feedPosts.map((row) =>
            row.id === postId
              ? {
                  ...row,
                  likes_count: Math.max(0, (row.likes_count ?? 0) + (liked ? -1 : 1)),
                }
              : row,
          ),
          postLikes: liked
            ? current.postLikes.filter(
                (like) => !(like.post_id === postId && like.user_id === currentUserId),
              )
            : current.postLikes.some(
                  (like) => like.post_id === postId && like.user_id === currentUserId,
                )
              ? current.postLikes
              : [...current.postLikes, optimisticLike],
        }));

        try {
          if (liked) {
            await services.posts.unlike(postId, currentUserId);
          } else {
            await services.posts.like(postId, currentUserId);
          }
        } catch (err) {
          setAgg((current) => ({
            ...current,
            feedPosts: current.feedPosts.map((row) =>
              row.id === postId
                ? {
                    ...row,
                    likes_count: Math.max(0, (row.likes_count ?? 0) + (liked ? 1 : -1)),
                  }
                : row,
            ),
            postLikes: liked
              ? current.postLikes.some(
                    (like) => like.post_id === postId && like.user_id === currentUserId,
                  )
                ? current.postLikes
                : [...current.postLikes, optimisticLike]
              : current.postLikes.filter(
                  (like) => !(like.post_id === postId && like.user_id === currentUserId),
                ),
          }));
          throw err;
        }

        if (!liked) {
          showFeedback("like", "Curtida enviada");
        }
      },
      async commentPost(postId: string, body: string, parentCommentId?: string | null) {
        await services.posts.comment(postId, currentUserId, body, parentCommentId);
        await refreshPostDetails(postId);
        showFeedback("comment", parentCommentId ? "Resposta enviada" : "Comentário publicado");
      },
      async deleteComment(postId: string, commentId: string) {
        const wasMine = agg.postComments.some(
          (comment) => comment.id === commentId && comment.user_id === currentUserId,
        );
        // Sprint 12.2 — dono do post também pode apagar (moderação). Posts
        // próprios estão no feedPosts (get_home_feed inclui os do próprio user),
        // então dá pra detectar a posse localmente. A RLS é o guard real.
        const ownsPost = agg.feedPosts.some(
          (post) => post.id === postId && post.user_id === currentUserId,
        );
        if (!wasMine && !ownsPost) return;

        setAgg((current) => ({
          ...current,
          postComments: current.postComments.filter((comment) => comment.id !== commentId),
          feedPosts: current.feedPosts.map((row) =>
            row.id === postId
              ? {
                  ...row,
                  comments_count: Math.max(0, (row.comments_count ?? 0) - 1),
                }
              : row,
          ),
        }));

        try {
          await services.posts.deleteComment(commentId, currentUserId);
          showFeedback("success", "Comentário apagado");
        } catch (err) {
          await refreshPostDetails(postId).catch(() => undefined);
          throw err;
        }
      },
      async likeComment(postId: string, commentId: string) {
        const comment = agg.postComments.find((item) => item.id === commentId);
        if (!comment || comment.user_id === currentUserId) return;
        const liked = agg.postCommentLikes.some(
          (like) => like.comment_id === commentId && like.user_id === currentUserId,
        );
        const optimisticLike: PostCommentLikeRow = {
          comment_id: commentId,
          user_id: currentUserId,
          created_at: new Date().toISOString(),
        };

        setAgg((current) => ({
          ...current,
          postCommentLikes: liked
            ? current.postCommentLikes.filter(
                (like) =>
                  !(like.comment_id === commentId && like.user_id === currentUserId),
              )
            : current.postCommentLikes.some(
                  (like) =>
                    like.comment_id === commentId && like.user_id === currentUserId,
                )
              ? current.postCommentLikes
              : [...current.postCommentLikes, optimisticLike],
        }));

        try {
          if (liked) {
            await services.posts.unlikeComment(commentId, currentUserId);
          } else {
            await services.posts.likeComment(commentId, currentUserId);
            showFeedback("like", "Comentário curtido");
          }
        } catch (err) {
          await refreshPostDetails(postId).catch(() => undefined);
          throw err;
        }
      },
      async toggleFollow(userId: string) {
        const target = enrichedAll.get(userId);
        const result = await services.follows.toggle(currentUserId, userId);
        let title: string;
        switch (result.followStatus) {
          case "accepted":
            title = "Agora no seu circle";
            break;
          case "pending":
            title = "Solicitação enviada";
            break;
          case "none":
          default:
            title = target?.followStatus === "pending"
              ? "Solicitação cancelada"
              : "Você deixou de seguir";
            break;
        }
        showFeedback("follow", title, target?.name);
        await refresh();
        return result;
      },
      openStory(storyId: string) {
        void (async () => {
          markPerf("stories_open_start");
          const group =
            storyGroups.find((item) => item.id === storyId) ??
            storyGroups.find((item) => item.stories.some((story) => story.id === storyId)) ??
            null;
          // Sprint 2 bug fix: quando TODAS as stories do group já foram
          // vistas, `find(!viewed)` retorna undefined. A chamada do
          // StoryBubbles passa `storyId = group.id` (user_id), que nunca
          // casa com `item.id` (id da story). Resultado: placeholderStory
          // ficava null e o openStory dava return early — user não
          // conseguia rever stories já vistos.
          //
          // Fix: fallback pra `group.stories[0]` (primeira do group, mais
          // antiga). Re-abertura sempre funciona; user pode rever o group
          // completo do início.
          const placeholderStory =
            group?.stories.find((item) => !item.viewed) ??
            group?.stories.find((item) => item.id === storyId) ??
            group?.stories[0] ??
            storyItems.find((item) => item.id === storyId) ??
            null;
          if (!placeholderStory) return;

          let nextStoryId = placeholderStory.id;
          const isHydrated = aggRef.current.stories.some((story) => story.id === nextStoryId);
          if (!isHydrated) {
            const hydratedStories = await refreshStoryViewerItems(placeholderStory.author.id);
            const viewedSet = new Set(viewedStoryIds);
            for (const view of aggRef.current.storyViews) viewedSet.add(view.story_id);
            const hydratedStory =
              hydratedStories.find((item) => !viewedSet.has(item.id)) ??
              hydratedStories.find((item) => item.id === storyId) ??
              hydratedStories[0] ??
              null;
            if (!hydratedStory) return;
            nextStoryId = hydratedStory.id;
          }

          setViewedStoryIds((current) => {
            const next = new Set(current);
            next.add(nextStoryId);
            persistStoredViewedStoryIds(currentUserId, next);
            return next;
          });
          setAgg((current) => {
            const alreadyTracked = current.storyViews.some(
              (view) => view.story_id === nextStoryId && view.user_id === currentUserId,
            );
            if (alreadyTracked) return current;
            return {
              ...current,
              storyViews: [
                ...current.storyViews,
                {
                  story_id: nextStoryId,
                  user_id: currentUserId,
                  viewed_at: new Date().toISOString(),
                },
              ],
            };
          });
          void services.stories.markViewed(nextStoryId, currentUserId).catch(() => undefined);
          setSelectedStoryGroupId(group?.id ?? placeholderStory.author.id);
          setSelectedStoryId(nextStoryId);
          simulateHaptic("brand");
          measurePerf("stories_open_ms", "stories_open_start", "stories_open_end");
        })();
      },
      closeStory() {
        setSelectedStoryId(null);
        setSelectedStoryGroupId(null);
      },
      async replyToStory(storyId: string, body: string) {
        const story = storyItems.find((item) => item.id === storyId);
        const reply = body.trim();
        if (!story || !reply) return;
        await services.messages.sendDirect(currentUserId, {
          receiverId: story.userId,
          body: reply,
          storyId: story.id,
          replyToStory: true,
          storyPreviewUrl: story.imageUrl,
        });
        await refreshChat();
        showFeedback("comment", "Resposta enviada", story.author.name);
      },
      async likeStory(storyId: string) {
        const story = storyItems.find((item) => item.id === storyId);
        if (!story) return;
        if (story.likedByCurrentUser) {
          setAgg((current) => ({
            ...current,
            storyLikes: current.storyLikes.filter(
              (like) => !(like.story_id === storyId && like.user_id === currentUserId),
            ),
          }));
          try {
            await services.stories.unlike(storyId, currentUserId);
          } catch (err) {
            setAgg((current) => {
              const exists = current.storyLikes.some(
                (like) => like.story_id === storyId && like.user_id === currentUserId,
              );
              return exists
                ? current
                : {
                    ...current,
                    storyLikes: [
                      ...current.storyLikes,
                      {
                        story_id: storyId,
                        user_id: currentUserId,
                        created_at: new Date().toISOString(),
                      },
                    ],
                  };
            });
            throw err;
          }
          return;
        }
        const optimisticLike: StoryLikeRow = {
          story_id: storyId,
          user_id: currentUserId,
          created_at: new Date().toISOString(),
        };
        setAgg((current) => {
          const exists = current.storyLikes.some(
            (like) => like.story_id === storyId && like.user_id === currentUserId,
          );
          return exists
            ? current
            : { ...current, storyLikes: [...current.storyLikes, optimisticLike] };
        });
        try {
          await services.stories.like(storyId, currentUserId);
          showFeedback("like", "Story curtido", story.author.name);
        } catch (err) {
          setAgg((current) => ({
            ...current,
            storyLikes: current.storyLikes.filter(
              (like) => !(like.story_id === storyId && like.user_id === currentUserId),
            ),
          }));
          throw err;
        }
      },
      async deleteStory(storyId: string) {
        const story = storyItems.find((item) => item.id === storyId);
        if (!story || story.userId !== currentUserId) return;
        setSelectedStoryId(null);
        setAgg((current) => ({
          ...current,
          stories: current.stories.filter((item) => item.id !== storyId),
          storyLikes: current.storyLikes.filter((like) => like.story_id !== storyId),
        }));
        await services.stories.remove(storyId);
        await services.stats.refreshMine();
        await refresh();
        showFeedback("success", "Story apagado");
      },
      async reportStory(storyId: string, authorId: string, reason = "other") {
        const story = storyItems.find((item) => item.id === storyId);
        await services.safety.report(currentUserId, {
          storyId,
          reportedUserId: authorId,
          reason: reason as "other",
        });
        showFeedback("brand", "Story denunciado", story?.author.name ?? "Vamos revisar.");
      },
      async muteStoryAuthor(authorId: string) {
        const target = enrichedAll.get(authorId);
        if (!target || authorId === currentUserId) return;
        setSelectedStoryId(null);
        setAgg((current) => ({
          ...current,
          stories: current.stories.filter((story) => story.user_id !== authorId),
          storyMutes: [
            ...current.storyMutes.filter((mute) => mute.muted_user_id !== authorId),
            {
              user_id: currentUserId,
              muted_user_id: authorId,
              created_at: new Date().toISOString(),
            },
          ],
        }));
        await services.stories.mute(currentUserId, authorId);
        await refresh();
        showFeedback("brand", "Stories silenciados", target.name);
      },
      async mutePostAuthor(authorId: string) {
        const target = enrichedAll.get(authorId);
        if (!target || authorId === currentUserId) return;
        // Optimistic: tira posts do autor do feed local + grava no
        // mutedPostUserIds. Servidor confirma via realtime e refresh().
        setAgg((current) => ({
          ...current,
          feedPosts: current.feedPosts.filter((row) => row.user_id !== authorId),
          mutedPostUserIds: current.mutedPostUserIds.includes(authorId)
            ? current.mutedPostUserIds
            : [...current.mutedPostUserIds, authorId],
        }));
        await services.posts.mute(currentUserId, authorId);
        await refresh();
        showFeedback("brand", "Posts silenciados", target.name);
      },
      async sharePostToChat(postId: string, receiverId: string) {
        const post = profilePosts.find((item) => item.id === postId);
        const receiver = enrichedAll.get(receiverId);
        if (!post || !receiver || receiverId === currentUserId) return;
        await services.messages.sendDirect(currentUserId, {
          receiverId,
          body:
            post.userId === currentUserId
              ? "Compartilhei meu treino no Gym Circle."
              : `Compartilhei o treino de @${post.author.username} no Gym Circle.`,
          mediaUrl: post.imageUrl,
          mediaType: post.mediaType,
        });
        await refreshChat();
        showFeedback("comment", "Publicação enviada", receiver.name);
      },
      async shareStoryToChat(storyId: string, receiverId: string) {
        const story = storyItems.find((item) => item.id === storyId);
        const receiver = enrichedAll.get(receiverId);
        if (!story || !receiver || receiverId === currentUserId) return;
        await services.messages.sendDirect(currentUserId, {
          receiverId,
          body: buildStoryShareBody(story.author.username),
          storyId,
          replyToStory: false,
          storyPreviewUrl: story.imageUrl,
        });
        await refreshChat();
        showFeedback("comment", "Story enviado", receiver.name);
      },
      // Rastreio de treino (Fase 1): fecha o treino cronometrado no web.
      // A activity marca o dia/streak via trigger; o post é opcional (o
      // resumo oferece "Adicionar foto" → publishWorkout com sourceActivityId).
      async finishWebActivity(input: WebActivityInput): Promise<FinishedWebActivity> {
        const activity = await services.activities.create(currentUserId, {
          activityType: input.activityType,
          mode:
            input.activityType === "run" ||
            input.activityType === "walk" ||
            input.activityType === "ride"
              ? "route"
              : "session",
          origin: "web_timer",
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          elapsedS: input.elapsedS,
          movingS: input.movingS ?? input.elapsedS,
          distanceM: input.distanceM ?? null,
          elevationGainM: input.elevationGainM ?? null,
          route: input.route ?? null,
          strengthSets: input.strengthSets ?? null,
        });
        await services.stats.refreshMine();
        await refresh();
        return {
          id: activity.id,
          workoutDate: activity.workoutDate,
          elapsedS: activity.elapsedS,
        };
      },
      // Salva legenda/local/tags na ENTRADA de atividade (treino sem foto no
      // feed — modelo check-in↔post↔carrossel).
      async saveActivityEntry(activityId: string, input: ActivityEntryInput) {
        await services.activities.updateEntry(activityId, {
          caption: input.caption ?? null,
          workoutTypes: input.workoutTypes ?? null,
          gymId: input.gymId ?? null,
          locationSource: input.locationSource ?? "none",
          locationName: input.locationName ?? null,
          locationLatitude: input.locationLatitude ?? null,
          locationLongitude: input.locationLongitude ?? null,
          locationGoogleMapsUrl: input.locationGoogleMapsUrl ?? null,
        });
        await refresh();
        showFeedback("success", "Treino no feed", "Adicione fotos quando quiser");
      },
      async fetchMergeableActivities(workoutDate: string) {
        return services.activities.mergeableForDate(workoutDate);
      },
      async integrateWorkoutIntoPost(postId: string, activityId: string) {
        await services.activities.mergeIntoPost(postId, activityId);
        await refresh();
        showFeedback(
          "success",
          "Treino integrado",
          "As estatísticas aparecem no post",
        );
      },
      async publishWorkout(input: CreateWorkoutPostInput) {
        // `workoutDate` tem dois sentidos: registro manual retroativo (força
        // feed + created_at antigo) ou dia herdado de sourceActivityId (mantém
        // publicação normal, mas satisfaz o vínculo validado pelo banco).
        const publishPlan = buildWorkoutPublishPlan(input);
        const backdate = publishPlan.workoutDate;
        const destinations = publishPlan.destinations;
        const wantsFeed = destinations.feed;
        const wantsStory = destinations.story;
        if (!wantsFeed && !wantsStory) {
          showFeedback("brand", "Escolha onde postar", "Feed, Story, ou ambos");
          return;
        }

        const taggedUserIds = input.taggedUserIds ?? [];
        const postCommitFollowUps: Promise<unknown>[] = [];
        let feedCommitted = false;
        let storyCommitted = false;
        let partialFailure: unknown = null;

        if (wantsFeed) {
          const post = await createPostWithTelemetry("publish_post", {
            workoutDate: backdate ?? undefined,
            createdAt: publishPlan.createdAt,
            sourceActivityId: input.sourceActivityId ?? null,
            imageUrl: input.imageUrl,
            mediaType: input.mediaType,
            thumbnailUrl: input.thumbnailUrl ?? null,
            posterUrl: input.posterUrl ?? null,
            mediaWidth: input.mediaWidth ?? null,
            mediaHeight: input.mediaHeight ?? null,
            mediaDurationSeconds: input.mediaDurationSeconds ?? null,
            blurDataUrl: input.blurDataUrl ?? null,
            caption: input.caption,
            gymId: input.gymId ?? null,
            workoutType: input.workoutType ?? null,
            // Sprint 13 — carrossel + tags. media[] (>1) vira post_media; o
            // story (abaixo) continua usando input.imageUrl = capa = item 0.
            workoutTypes: input.workoutTypes ?? null,
            media: input.media ?? undefined,
            locationSource: input.locationSource ?? "none",
            locationName: input.locationName ?? null,
            locationLatitude: input.locationLatitude ?? null,
            locationLongitude: input.locationLongitude ?? null,
            locationGoogleMapsUrl: input.locationGoogleMapsUrl ?? null,
          });
          feedCommitted = true;
          if (taggedUserIds.length > 0) {
            postCommitFollowUps.push(
              services.participants.createPostTags(
                post.id,
                currentUserId,
                taggedUserIds,
              ),
            );
          }
        }

        if (wantsStory) {
          try {
            const story = await services.stories.create(currentUserId, {
              mediaUrl: input.imageUrl,
              mediaType: input.mediaType,
              thumbnailUrl: input.thumbnailUrl ?? null,
              posterUrl: input.posterUrl ?? null,
              mediaWidth: input.mediaWidth ?? null,
              mediaHeight: input.mediaHeight ?? null,
              mediaDurationSeconds: input.mediaDurationSeconds ?? null,
              blurDataUrl: input.blurDataUrl ?? null,
              gymId: input.gymId ?? null,
              workoutType: input.workoutType ?? null,
            });
            storyCommitted = true;
            if (taggedUserIds.length > 0) {
              postCommitFollowUps.push(
                services.participants.createStoryTags(
                  story.id,
                  currentUserId,
                  taggedUserIds,
                ),
              );
            }
          } catch (error) {
            // Se o feed já foi commitado, propagar este erro faria o usuário
            // tentar novamente e duplicar o post. Mantemos o sucesso parcial
            // explícito; story-only continua falhando normalmente.
            if (!feedCommitted) throw error;
            partialFailure = error;
          }
        }

        postCommitFollowUps.push(services.stats.refreshMine(), refresh());
        const followUpResults = await Promise.allSettled(postCommitFollowUps);
        const rejectedFollowUp = followUpResults.find(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        );
        if (!partialFailure) {
          partialFailure = rejectedFollowUp?.reason ?? null;
        }

        if (publishPlan.isManualBackdate) {
          showFeedback("success", "Treino registrado", "Foto adicionada ao calendário");
          return;
        }

        const detail = partialFailure
          ? feedCommitted && wantsStory && !storyCommitted
            ? "Feed publicado; o story não pôde ser criado"
            : "Publicado; uma atualização secundária será refeita depois"
          : feedCommitted && storyCommitted
            ? "Feed + story atualizados"
            : feedCommitted
            ? "Postado no feed"
            : "Story publicado";
        showFeedback("success", "Treino publicado", detail);
      },
      async checkIn(gymName: string) {
        const gym = agg.gyms.find((g) => g.name === gymName);
        if (!gym) {
          showFeedback("brand", "Academia não encontrada", gymName);
          return;
        }
        await services.checkins.checkIn(currentUserId, gym.id);
        // Check-in cria um activity_day (trigger no DB) → dia marcado + streak
        // mantido, sem foto. Recarrega stats/calendário igual ao aceite de tag.
        await services.stats.refreshMine();
        await refresh();
        showFeedback("success", "Check-in feito", `${gymName} · dia marcado no calendário`);
      },
      async createCheckin(gymId: string, workoutDate?: string) {
        const gym = aggRef.current.gyms.find((row) => row.id === gymId);
        if (!gym) {
          throw new Error("Selecione um local cadastrado.");
        }
        await services.checkins.checkIn(currentUserId, gymId, workoutDate);
        await services.stats.refreshMine();
        await refresh();
        showFeedback(
          "success",
          "Check-in feito",
          `${gym.name} · dia marcado no calendário`,
        );
      },
      async acceptPostTag(postId: string) {
        await services.participants.respondToPostTag(postId, currentUserId, "accepted");
        await services.stats.refreshMine();
        await refresh();
        showFeedback("success", "Marcação aceita", "Seu círculo acendeu se era treino de hoje.");
      },
      async rejectPostTag(postId: string) {
        await services.participants.respondToPostTag(postId, currentUserId, "rejected");
        await refresh();
        showFeedback("brand", "Marcação recusada");
      },
      async acceptStoryTag(storyId: string) {
        await services.participants.respondToStoryTag(storyId, currentUserId, "accepted");
        await services.stats.refreshMine();
        await refresh();
        showFeedback("success", "Story aceito", "Aparece no seu círculo enquanto estiver ativo.");
      },
      async rejectStoryTag(storyId: string) {
        await services.participants.respondToStoryTag(storyId, currentUserId, "rejected");
        await refresh();
        showFeedback("brand", "Marcação recusada");
      },
      async catalogPlace(place) {
        // 1) Insert no catálogo (ou retorna o existente se outro user já cadastrou)
        const gym = await services.gyms.findOrCreateFromPlace({
          name: place.name,
          address: place.address ?? null,
          city: place.city,
          state: place.state ?? null,
          latitude: place.latitude,
          longitude: place.longitude,
        });
        // 2) Vincula ao perfil do user (idempotente — upsert por (user, gym))
        await services.gyms
          .addUserGym(currentUserId, gym.id, false)
          .catch(() => {
            // Se falhar (RLS, race), não impede usar a gym recém-catalogada;
            // o vínculo é cosmético pra "minhas academias".
          });
        await refresh();
        return {
          id: gym.id,
          name: gym.name,
          address: gym.address,
          city: gym.city,
          state: gym.state,
          latitude: gym.latitude,
          longitude: gym.longitude,
        };
      },
      async editPost(postId: string, input: EditPostInput) {
        const workoutTypes =
          input.workoutTypes ??
          (input.workoutType?.trim() ? [input.workoutType.trim()] : []);
        const startedAt = performance.now();
        try {
          await services.posts.updateSocialDetails(postId, {
            caption: input.caption,
            workoutTypes,
            gymId: input.gymId ?? null,
            media: input.media,
          });
          void recordMediaPipelineEvent(services.client, {
            operation: "edit_post",
            stage: "metadata",
            status: "succeeded",
            durationMs: performance.now() - startedAt,
            metadata: { media_count: input.media?.length ?? 0 },
          });
        } catch (error) {
          await recordMediaPipelineEvent(services.client, {
            operation: "edit_post",
            stage: "metadata",
            status: "failed",
            durationMs: performance.now() - startedAt,
            error,
            metadata: { media_count: input.media?.length ?? 0 },
          });
          throw error;
        }
        const taggedUserIds = input.taggedUserIds ?? [];
        if (taggedUserIds.length > 0) {
          await services.participants.requestPostTags(postId, currentUserId, taggedUserIds);
        }
        await refresh();
        showFeedback(
          "success",
          taggedUserIds.length > 0 ? "Solicitação enviada" : "Post atualizado",
          taggedUserIds.length > 0 ? "Aguardando aceite" : undefined,
        );
      },
      async promoteCheckin(checkinId: string, input: PromoteCheckinInput) {
        const checkin = aggRef.current.feedCheckins.find(
          (row) => row.id === checkinId,
        );
        if (!checkin || checkin.user_id !== currentUserId) {
          throw new Error("Check-in não encontrado ou sem permissão.");
        }
        const cover = input.media[0];
        if (!cover) {
          throw new Error("Adicione pelo menos uma foto ou vídeo.");
        }

        const targetGymId = input.gymId ?? checkin.gym_id;
        const sourceCheckinId =
          targetGymId === checkin.gym_id
            ? checkin.id
            : await services.checkins.updateLocation(checkin.id, targetGymId);
        const gym = aggRef.current.gyms.find(
          (row) => row.id === targetGymId,
        );
        if (!gym) {
          throw new Error("Selecione um local cadastrado.");
        }
        const gymCoordinates =
          typeof gym?.latitude === "number" &&
          typeof gym?.longitude === "number"
            ? { latitude: gym.latitude, longitude: gym.longitude }
            : null;
        const checkinCoordinates =
          typeof checkin.gym_latitude === "number" &&
          typeof checkin.gym_longitude === "number"
            ? {
                latitude: checkin.gym_latitude,
                longitude: checkin.gym_longitude,
              }
            : null;
        const coordinates = gymCoordinates ?? checkinCoordinates;
        const mapsUrl = coordinates
          ? buildGoogleMapsUrlFromCoordinates({
              latitude: coordinates.latitude,
              longitude: coordinates.longitude,
            })
          : buildGoogleMapsSearchUrl(
              [
                checkin.gym_name,
                gym?.address ?? checkin.gym_address,
                checkin.gym_city,
                checkin.gym_state,
              ]
                .filter(Boolean)
                .join(", "),
            );

        const post = await createPostWithTelemetry("promote_checkin", {
          sourceCheckinId,
          imageUrl: cover.imageUrl,
          mediaType: cover.mediaType,
          thumbnailUrl: cover.thumbnailUrl ?? null,
          posterUrl: cover.posterUrl ?? null,
          mediaWidth: cover.mediaWidth ?? null,
          mediaHeight: cover.mediaHeight ?? null,
          mediaDurationSeconds: cover.mediaDurationSeconds ?? null,
          blurDataUrl: cover.blurDataUrl ?? null,
          caption: input.caption ?? "",
          gymId: targetGymId,
          workoutType: input.workoutType ?? null,
          workoutTypes:
            input.workoutTypes ??
            (input.workoutType ? [input.workoutType] : null),
          workoutDate: checkin.checkin_date,
          createdAt: checkin.created_at,
          media: input.media,
          locationSource: "gym",
          locationName: gym.name,
          locationLatitude: coordinates?.latitude ?? null,
          locationLongitude: coordinates?.longitude ?? null,
          locationGoogleMapsUrl: mapsUrl,
        });

        const taggedUserIds = input.taggedUserIds ?? [];
        const followUps: Promise<unknown>[] = [
          services.stats.refreshMine(),
          refresh(),
        ];
        if (taggedUserIds.length > 0) {
          followUps.push(
            services.participants.createPostTags(
              post.id,
              currentUserId,
              taggedUserIds,
            ),
          );
        }
        const followUpResults = await Promise.allSettled(followUps);
        for (const result of followUpResults) {
          if (result.status === "rejected") {
            console.warn(
              "Pós-publicação do check-in falhou; o post já foi criado:",
              result.reason,
            );
          }
        }
        showFeedback(
          "success",
          "Check-in atualizado",
          "Agora ele é uma postagem completa no feed",
        );
      },
      async updateCheckin(checkinId: string, gymId: string) {
        await services.checkins.updateLocation(checkinId, gymId);
        await refresh();
        showFeedback("success", "Check-in atualizado");
      },
      async convertPostToCheckin(postId: string, gymId: string) {
        await services.posts.convertToCheckin(postId, gymId);
        await services.stats.refreshMine();
        await refresh();
        showFeedback(
          "success",
          "Post convertido em check-in",
          "O dia continua contando no seu streak",
        );
      },
      async deletePost(postId: string) {
        await services.posts.remove(postId);
        await refresh();
        showFeedback("success", "Post apagado");
      },
      async deleteCheckin(checkinId: string) {
        await services.checkins.remove(checkinId);
        await services.stats.refreshMine();
        await refresh();
        showFeedback("success", "Check-in apagado");
      },
      async deleteActivity(activityId: string) {
        await services.activities.remove(activityId);
        await services.stats.refreshMine();
        await refresh();
        showFeedback("success", "Treino apagado");
      },
      async sendChatMessage(input: SendChatMessageInput) {
        let conversationIdForMessages = input.conversationId ?? null;
        if (input.conversationId) {
          const sentMessage = await services.messages.sendGroup({
            conversationId: input.conversationId,
            body: input.body,
            mediaUrl: input.mediaUrl,
            mediaType: input.mediaType,
          });
          conversationIdForMessages =
            sentMessage.conversation_id ?? input.conversationId;
        } else if (input.receiverId) {
          const sentMessage = await services.messages.sendDirect(currentUserId, {
            receiverId: input.receiverId,
            body: input.body,
            mediaUrl: input.mediaUrl,
            mediaType: input.mediaType,
            storyId: input.storyId,
            replyToStory: input.replyToStory,
            storyPreviewUrl: input.storyPreviewUrl,
          });
          conversationIdForMessages =
            sentMessage.conversation_id ??
            aggRef.current.conversationParticipants.find(
              (participant) =>
                participant.user_id === input.receiverId &&
                aggRef.current.conversationParticipants.some(
                  (own) =>
                    own.conversation_id === participant.conversation_id &&
                    own.user_id === currentUserId,
                ),
            )?.conversation_id ?? null;
        } else {
          throw new Error("Escolha uma conversa.");
        }
        await refreshChat();
        if (conversationIdForMessages) {
          await refreshConversationMessages(conversationIdForMessages).catch(() => undefined);
        }
        showFeedback("comment", input.mediaUrl ? "Mídia enviada" : "Mensagem enviada");
      },
      async markChatThreadRead(userId: string) {
        void services.analytics.trackSafe(currentUserId, "conversation_opened", {
          other_user_id: userId,
        });
        const conversationId = aggRef.current.conversations.find((conversation) => {
          if (conversation.type === "group") return false;
          const members = aggRef.current.conversationParticipants
            .filter((participant) => participant.conversation_id === conversation.id)
            .map((participant) => participant.user_id);
          return members.includes(currentUserId) && members.includes(userId);
        })?.id;
        if (conversationId) {
          await refreshConversationMessages(conversationId).catch(() => undefined);
        }
        await services.messages.markDirectRead(currentUserId, userId);
        void refreshChat();
      },
      async markChatConversationRead(conversationId: string) {
        void services.analytics.trackSafe(currentUserId, "conversation_opened", {
          conversation_id: conversationId,
        });
        await refreshConversationMessages(conversationId).catch(() => undefined);
        await services.messages.markConversationRead(conversationId);
        void refreshChat();
      },
      async deleteChatConversation(userId: string) {
        const target = enrichedAll.get(userId);
        const isThreadMessage = (message: DirectMessageRow) =>
          (message.sender_id === currentUserId && message.receiver_id === userId) ||
          (message.sender_id === userId && message.receiver_id === currentUserId);
        const conversationId = findDirectConversationId(aggRef.current, currentUserId, userId);

        setAgg((current) => ({
          ...current,
          conversations: conversationId
            ? current.conversations.filter((conversation) => conversation.id !== conversationId)
            : current.conversations,
          chatMessages: current.chatMessages.filter((message) => !isThreadMessage(message)),
          conversationUnreadCounts: conversationId
            ? Object.fromEntries(
                Object.entries(current.conversationUnreadCounts).filter(
                  ([id]) => id !== conversationId,
                ),
              )
            : current.conversationUnreadCounts,
          conversationParticipants: conversationId
            ? current.conversationParticipants.filter(
                (participant) => participant.conversation_id !== conversationId,
              )
            : current.conversationParticipants,
        }));

        try {
          await services.messages.deleteConversationForMe(currentUserId, userId);
          showFeedback("success", "Conversa apagada", target?.name);
          await refreshChat();
        } catch (err) {
          await refreshChat().catch(() => undefined);
          throw err;
        }
      },
      async deleteChatConversationById(conversationId: string) {
        setAgg((current) => ({
          ...current,
          conversations: current.conversations.filter(
            (conversation) => conversation.id !== conversationId,
          ),
          chatMessages: current.chatMessages.filter(
            (message) => message.conversation_id !== conversationId,
          ),
          conversationUnreadCounts: Object.fromEntries(
            Object.entries(current.conversationUnreadCounts).filter(
              ([id]) => id !== conversationId,
            ),
          ),
          conversationParticipants: current.conversationParticipants.filter(
            (participant) => participant.conversation_id !== conversationId,
          ),
        }));
        await services.messages.deleteConversationByIdForMe(conversationId);
        showFeedback("success", "Conversa apagada");
        await refreshChat();
      },
      async createGroupConversation(input) {
        const conversationId = await services.messages.createGroup({
          name: input.name,
          memberIds: input.memberIds,
          imageUrl: input.imageUrl,
        });
        await refreshChat();
        showFeedback("success", "Grupo criado", input.name);
        return conversationId;
      },
      async signOut() {
        await PushNotificationsService.revokeDeviceTokenOnLogout(
          currentUserId,
          services.push,
        );
        clearNativeFeelCaches();
        // Sprint 2.1: limpa o Set de "imagens já carregadas" pra evitar
        // que avatares/posts do user A vazem visualmente no primeiro
        // mount do user B no mesmo device.
        clearImageCache();
        await services.auth.signOut();
      },
      async updateProfile(input: ProfileEditInput) {
        const patch = {
          ...(input.displayName !== undefined ? { display_name: input.displayName } : {}),
          ...(input.username !== undefined ? { username: input.username } : {}),
          ...(input.bio !== undefined ? { bio: input.bio } : {}),
          ...(input.fitnessGoal !== undefined ? { fitness_goal: input.fitnessGoal } : {}),
          ...(input.avatarUrl !== undefined ? { avatar_url: input.avatarUrl } : {}),
          ...(input.isPrivate !== undefined ? { is_private: input.isPrivate } : {}),
          ...(input.instagramUsername !== undefined
            ? { instagram_username: input.instagramUsername }
            : {}),
          ...(input.birthDate !== undefined ? { birth_date: input.birthDate } : {}),
          ...(input.sports !== undefined ? { sports: input.sports } : {}),
          ...(input.mainGymId !== undefined ? { main_gym_id: input.mainGymId } : {}),
          ...(input.preferredTimes !== undefined
            ? { preferred_training_times: input.preferredTimes }
            : {}),
        };
        const updatedProfile = await services.profiles.update(currentUserId, {
          ...patch,
        });
        if (mountedRef.current) {
          setAgg((current) => ({
            ...current,
            profiles: mergeProfileRows(current.profiles, [updatedProfile]),
          }));
        }
        writeNativeOwnProfileCache(currentUserId, updatedProfile);
        if (input.mainGymId) {
          await services.gyms.addUserGym(currentUserId, input.mainGymId, true).catch((err) => {
            if ((err as { code?: string }).code !== "23505") throw err;
          });
        }
        await refresh();
        showFeedback("success", "Perfil atualizado");
      },
      async dismissProfileCompletionNotice() {
        const currentProfile = agg.profiles.find(
          (profile) => profile.user_id === currentUserId,
        );
        if (currentProfile?.profile_completion_notice_dismissed) return;

        if (currentProfile && mountedRef.current) {
          setAgg((current) => ({
            ...current,
            profiles: mergeProfileRows(current.profiles, [
              {
                ...currentProfile,
                profile_completion_notice_dismissed: true,
              },
            ]),
          }));
        }

        try {
          const updatedProfile = await services.profiles.update(currentUserId, {
            profile_completion_notice_dismissed: true,
          });
          if (mountedRef.current) {
            setAgg((current) => ({
              ...current,
              profiles: mergeProfileRows(current.profiles, [updatedProfile]),
            }));
          }
        } catch (err) {
          await refresh();
          throw err;
        }
      },
      async acceptFollowRequest(requesterId: string) {
        const requester = enrichedAll.get(requesterId);
        await services.follows.acceptRequest(currentUserId, requesterId);
        await refresh();
        showFeedback("follow", "Solicitação aceita", requester?.name);
      },
      async rejectFollowRequest(requesterId: string) {
        await services.follows.rejectRequest(currentUserId, requesterId);
        await refresh();
        showFeedback("brand", "Solicitação recusada");
      },
      async blockUser(userId: string) {
        const target = enrichedAll.get(userId);
        await services.safety.blockUser(currentUserId, userId);
        await refresh();
        showFeedback("brand", "Usuário bloqueado", target?.name);
      },
      async reportUser(userId: string, reason = "other") {
        const target = enrichedAll.get(userId);
        await services.safety.report(currentUserId, {
          reportedUserId: userId,
          reason: reason as "other",
        });
        showFeedback("brand", "Denúncia enviada", target?.name);
      },
      async reportPost(postId: string, authorId: string, reason = "other") {
        await services.safety.report(currentUserId, {
          postId,
          reportedUserId: authorId,
          reason: reason as "other",
        });
        showFeedback("brand", "Post denunciado", "Vamos revisar.");
      },
      async requestAccountDeletion(reason?: string) {
        await services.safety.requestAccountDeletion(reason);
        showFeedback("brand", "Conta marcada para exclusão");
        await services.auth.signOut();
      },
      async suspendAccount() {
        const { token } = await services.safety.suspendAccount();
        const user = await services.auth.getUser();
        const email = user?.email;
        if (email) {
          await services.auth.sendMagicLink(
            email,
            buildReactivationRedirectUrl(token),
          );
        }
        showFeedback("brand", "Conta suspensa", "Enviamos o link de reativação.");
        await services.auth.signOut();
      },
      async sendReactivationEmail() {
        const { token } = await services.safety.issueReactivationToken();
        const user = await services.auth.getUser();
        const email = user?.email;
        if (!email) {
          throw new Error("Não encontramos email para enviar reativação.");
        }
        await services.auth.sendMagicLink(
          email,
          buildReactivationRedirectUrl(token),
        );
        showFeedback("brand", "Email de reativação enviado");
      },
      async useStreakRestore() {
        await services.stats.useStreakRestore();
        await refresh();
        showFeedback("success", "Streak restaurado", "Seu círculo continua aceso.");
      },
      async completeOnboarding() {
        await services.onboarding.markComplete();
        await refresh();
        showFeedback("success", "Perfil pronto para alpha");
      },
      /**
       * Sprint 5.5a — salva a foto escolhida como capa do recap mensal.
       * `monthKey` no formato 'YYYY-MM'. `postId` null → remove a escolha
       * (volta pro auto-pick). Refresh full pra rehydrate
       * `currentUser.monthlyRecapCovers` no estado.
       */
      async setMonthlyRecapCover(monthKey: string, postId: string | null) {
        // Symlink quirk: services.profiles type lags behind worktree.
        // Cast pra interface mínima necessária mantém o call seguro
        // (método existe em runtime).
        const profilesExt = services.profiles as typeof services.profiles & {
          setMonthlyRecapCover: (
            userId: string,
            monthKey: string,
            postId: string | null,
          ) => Promise<void>;
        };
        await profilesExt.setMonthlyRecapCover(currentUserId, monthKey, postId);
        await refresh();
      },
      /**
       * Sprint 7C.1 — marca hint contextual como visto cross-device.
       * Best-effort: erro de rede não bloqueia UX (caller já marcou local
       * via localStorage). Refresh opcional pra hydratar UI imediatamente;
       * pulamos aqui porque hint dismiss não precisa re-renderizar tudo —
       * próximo boot puxa o JSONB atualizado.
       */
      async markContextualHintSeen(hintId: string) {
        const profilesExt = services.profiles as typeof services.profiles & {
          markContextualHintSeen?: (
            userId: string,
            hintId: string,
          ) => Promise<void>;
        };
        if (!profilesExt.markContextualHintSeen) return;
        await profilesExt.markContextualHintSeen(currentUserId, hintId);
      },
      /**
       * Sprint 7.5.1 — persiste achievements equipados no perfil.
       * Caller é responsável por validar que cada ID é earned ANTES
       * de chamar (UI confirma cross-ref com user_achievements).
       * Refresh full pra rehydrate `currentUser.featuredAchievements`.
       */
      async setFeaturedAchievements(achievementIds: string[]) {
        // Symlink quirk: services.profiles type lags behind worktree.
        const profilesExt = services.profiles as typeof services.profiles & {
          setFeaturedAchievements?: (
            userId: string,
            achievementIds: string[],
          ) => Promise<void>;
        };
        if (!profilesExt.setFeaturedAchievements) return;
        await profilesExt.setFeaturedAchievements(currentUserId, achievementIds);
        await refresh();
      },
      refreshChat,
      refreshPostDetails,
      refreshProfilePosts,
      ensureProfilePostsForMonth,
      loadMoreFeed,
  });
  return build();
}

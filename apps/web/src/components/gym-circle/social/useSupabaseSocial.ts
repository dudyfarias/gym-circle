"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getGymCircleDateKey,
  SOCIAL_BELL_NOTIFICATION_KINDS,
} from "@gym-circle/core";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import type {
  CheckinRow,
  MergeableActivity,
  ConversationParticipantRow,
  ConversationRow,
  DirectMessageRow,
  FollowRow,
  GymRow,
  NotificationRow,
  PostRow,
  PostCommentLikeRow,
  PostCommentRow,
  PostLikeRow,
  PostParticipantRow,
  ProfileRow,
  StoryLikeRow,
  StoryMuteRow,
  StoryParticipantRow,
  StoryRow,
  StoryViewRow,
  UserActivityDayRow,
  UserGymRow,
  UserStatsRow,
} from "@gym-circle/core";


import { simulateHaptic } from "./haptics";
import { markPerf, measurePerf } from "../performance";
import {
  mergeProfileRows,
  profileRowFromPartial,
  profileRowFromSurface,
} from "./profileRows";
import { groupStoriesByProfile } from "./stories";
import { buildMonthWorkoutDays, calculateWorkoutStats } from "./streak";
import type {
  ChatMessage,
  ChatConversation,
  CreateWorkoutPostInput,
  EditPostInput,
  ActivityEntryInput,
  EnrichedActivity,
  StrengthSet,
  EnrichedCheckin,
  EnrichedPost,
  EnrichedStory,
  EnrichedUser,
  FeedbackMessage,
  FeedbackTone,
  FinishedWebActivity,
  FollowActionResult,
  GymLocationOption,
  GymUser,
  ProfileEditInput,
  PromoteCheckinInput,
  SendChatMessageInput,
  WebActivityInput,
  StoryGroup,
} from "./types";


// Sprint 21.4 — helpers, tipos e constantes extraídos do monólito (ver
// supabaseSocial{Types,Constants,Mappers,Surfaces,Cache}.ts).
import {
  EMPTY,
  FOLLOW_COLUMNS,
  INITIAL_FEED_LIMIT,
  INITIAL_STORY_LIMIT,
  PROFILE_COLUMNS,
  USER_STATS_COLUMNS,
} from "./supabaseSocialConstants";
import {
  directMessageRowFromPartial,
  feedPostRowFromPostRow,
  feedPostRowFromSurface,
  followRowFromDiscovery,
  formatPostClock,
  getSharedGymCount,
  mergeRowsByKey,
  mergeStatsArrays,
  parseJsonValue,
  profileRowFromDiscovery,
  statsRowFromDiscovery,
  statsRowFromSurface,
  storyRowFromSurface,
  storyRowFromViewerItem,
} from "./supabaseSocialMappers";
import {
  loadNativeHomeCache,
  loadStoredViewedStoryIds,
  persistStoredViewedStoryIds,
  writeNativeHomeCache,
  writeNativeOwnProfileCache,
  writeNativeStoryTrayCache,
} from "./supabaseSocialCache";
import {
  logSurfaceFallback,
  optionalStorySocialRows,
  queryCircleRankingClientFallback,
  queryCircleRankingSurface,
  queryHomeActivitiesSurface,
  queryHomeCheckinsSurface,
  queryHomeFeedSurface,
  queryStoryTraySurface,
  queryStoryViewerItemsSurface,
  queryUserSuggestionsSurface,
} from "./supabaseSocialSurfaces";
import {
  buildChatConversations,
  buildChatMessages,
  buildCurrentUser,
  buildEnrichedUsers,
  buildGymOptions,
  buildProfilePosts,
  buildSocialStats,
  buildStoryItems,
  buildSuggestedUsers,
  buildUsersRecord,
} from "./supabaseSocialSelectors";
import { createSocialActions } from "./supabaseSocialActions";
import type {
  AggregateState,
  CircleRankingRow,
  ConversationSummaryParticipant,
  ConversationSummaryRow,
  HomeRefreshSnapshot,
  ProfileExtras,
  RankingPeriod,
  RankingScope,
  RealtimePayload,
  StoryTrayRow,
  SurfaceActivityRow,
  SurfaceCheckinRow,
  SurfacePostRow,
} from "./supabaseSocialTypes";

export type SupabaseSocialActions = {
  likePost: (postId: string) => Promise<void>;
  commentPost: (postId: string, body: string) => Promise<void>;
  likeComment: (postId: string, commentId: string) => Promise<void>;
  toggleFollow: (userId: string) => Promise<FollowActionResult>;
  openStory: (storyId: string) => void;
  closeStory: () => void;
  publishWorkout: (input: CreateWorkoutPostInput) => Promise<void>;
  /** Rastreio de treino (Fase 1): fecha o treino cronometrado do web. */
  finishWebActivity: (input: WebActivityInput) => Promise<FinishedWebActivity>;
  /** Salva legenda/local/tags na ENTRADA de atividade (treino sem foto). */
  saveActivityEntry: (
    activityId: string,
    input: ActivityEntryInput,
  ) => Promise<void>;
  /** "Integrar treino": treinos do dia do post disponíveis pra juntar. */
  fetchMergeableActivities: (
    workoutDate: string,
  ) => Promise<MergeableActivity[]>;
  /** Vincula o treino ao post (source_activity_id); some do feed. */
  integrateWorkoutIntoPost: (
    postId: string,
    activityId: string,
  ) => Promise<void>;
  checkIn: (gymName: string) => Promise<void>;
  createCheckin: (gymId: string, workoutDate?: string) => Promise<void>;
  /**
   * Cataloga um lugar buscado via Maps (Nominatim/etc) no banco e
   * vincula ao perfil do user atual. Retorna a gym row pra que o caller
   * possa usar o id imediatamente. Idempotente — se outro user já
   * catalogou a mesma gym, retorna a existente.
   */
  catalogPlace: (place: {
    name: string;
    address?: string | null;
    neighborhood?: string | null;
    city: string;
    state?: string | null;
    latitude: number;
    longitude: number;
  }) => Promise<GymLocationOption>;
  editPost: (postId: string, input: EditPostInput) => Promise<void>;
  promoteCheckin: (
    checkinId: string,
    input: PromoteCheckinInput,
  ) => Promise<void>;
  updateCheckin: (checkinId: string, gymId: string) => Promise<void>;
  convertPostToCheckin: (postId: string, gymId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  deleteCheckin: (checkinId: string) => Promise<void>;
  deleteActivity: (activityId: string) => Promise<void>;
  sendChatMessage: (input: SendChatMessageInput) => Promise<void>;
  markChatThreadRead: (userId: string) => Promise<void>;
  markChatConversationRead: (conversationId: string) => Promise<void>;
  acceptFollowRequest: (requesterId: string) => Promise<void>;
  rejectFollowRequest: (requesterId: string) => Promise<void>;
  deleteChatConversation: (userId: string) => Promise<void>;
  deleteChatConversationById: (conversationId: string) => Promise<void>;
  createGroupConversation: (input: {
    name: string;
    memberIds: string[];
    imageUrl?: string | null;
  }) => Promise<string>;
  signOut: () => Promise<void>;
  updateProfile: (input: ProfileEditInput) => Promise<void>;
  dismissProfileCompletionNotice: () => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  reportUser: (userId: string, reason?: string) => Promise<void>;
  reportPost: (postId: string, authorId: string, reason?: string) => Promise<void>;
  replyToStory: (storyId: string, body: string) => Promise<void>;
  likeStory: (storyId: string) => Promise<void>;
  deleteStory: (storyId: string) => Promise<void>;
  reportStory: (storyId: string, authorId: string, reason?: string) => Promise<void>;
  muteStoryAuthor: (authorId: string) => Promise<void>;
  /** Silencia posts desse autor no feed. Stories continuam aparecendo. */
  mutePostAuthor: (authorId: string) => Promise<void>;
  sharePostToChat: (postId: string, receiverId: string) => Promise<void>;
  shareStoryToChat: (storyId: string, receiverId: string) => Promise<void>;
  acceptPostTag: (postId: string) => Promise<void>;
  rejectPostTag: (postId: string) => Promise<void>;
  acceptStoryTag: (storyId: string) => Promise<void>;
  rejectStoryTag: (storyId: string) => Promise<void>;
  requestAccountDeletion: (reason?: string) => Promise<void>;
  suspendAccount: () => Promise<void>;
  sendReactivationEmail: () => Promise<void>;
  useStreakRestore?: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  /** Sprint 5.5a — Salva qual post o user escolheu como capa do recap mensal. */
  setMonthlyRecapCover: (monthKey: string, postId: string | null) => Promise<void>;
  refreshChat: () => Promise<void>;
  refreshPostDetails: (postId: string) => Promise<void>;
  refreshProfilePosts: (userId: string) => Promise<void>;
  searchProfiles: (query: string) => Promise<EnrichedUser[]>;
  listFollowUsers: (
    userId: string,
    kind: "followers" | "following",
  ) => Promise<EnrichedUser[]>;
  loadMoreFeed: () => Promise<void>;
};

export type SupabaseSocialResult = {
  currentUser: EnrichedUser;
  users: Record<string, GymUser>;
  gyms: GymLocationOption[];
  feedPosts: EnrichedPost[];
  feedCheckins: EnrichedCheckin[];
  feedActivities: EnrichedActivity[];
  profilePosts: EnrichedPost[];
  storyBubbles: EnrichedStory[];
  storyGroups: StoryGroup[];
  selectedStoryGroup: StoryGroup | null;
  selectedStory: EnrichedStory | null;
  suggestedUsers: EnrichedUser[];
  nearbyUsers: EnrichedUser[];
  chatMessages: ChatMessage[];
  chatConversations: ChatConversation[];
  socialStats: {
    trainedToday: number;
    checkInsToday: number;
    monthDays: ReturnType<typeof buildMonthWorkoutDays>;
  };
  feedback: FeedbackMessage | null;
  formatPostClock: typeof formatPostClock;
  actions: SupabaseSocialActions;
  unreadNotifications: number;
  unreadMessages: number;
  homeLoading: boolean;
  secondaryLoading: boolean;
  chatLoading: boolean;
  chatHydrated: boolean;
  feedLoadingMore: boolean;
  feedHasMore: boolean;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  /** Sprint 19 — Competição: ranking carregado sob demanda (escopo × período). */
  ranking: RankingState;
  loadRanking: (scope: RankingScope, period: RankingPeriod) => Promise<void>;
};

type RankingState = {
  rows: CircleRankingRow[];
  scope: RankingScope;
  period: RankingPeriod;
  loading: boolean;
};

export function useSupabaseSocial(currentUserId: string): SupabaseSocialResult {
  const services = useGymCircleServices();
  const [agg, setAgg] = useState<AggregateState>(() => loadNativeHomeCache(currentUserId));
  const [loading, setLoading] = useState(true);
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [selectedStoryGroupId, setSelectedStoryGroupId] = useState<string | null>(null);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(() =>
    loadStoredViewedStoryIds(currentUserId),
  );
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  // Sprint 19 — Competição: ranking sob demanda (a UI dispara loadRanking ao
  // abrir/trocar escopo×período). Fora do agg porque já vem agregado da RPC.
  const [ranking, setRanking] = useState<RankingState>({
    rows: [],
    scope: "circle",
    period: "week",
    loading: false,
  });
  const mountedRef = useRef(true);
  const rankingRequestRef = useRef(0);
  const aggRef = useRef<AggregateState>(EMPTY);
  const analyticsBootRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);
  const chatRealtimeTimerRef = useRef<number | null>(null);
  const chatHydratedRef = useRef(false);
  // Último post cujos detalhes foram carregados (proxy de "sheet de comentários
  // aberto neste post"). Usado pelo realtime pra refazer a lista do post aberto
  // mesmo quando ele ainda não tinha nenhum comentário (1º comentário ao vivo).
  const lastDetailPostIdRef = useRef<string | null>(null);
  // Fix calendário — cache month-scoped de posts do MyCircle. A chave é
  // `${userId}:${YYYY-MM}`; evita reconsultar ao navegar ← → em meses já vistos.
  const profilePostMonthsLoadedRef = useRef(new Set<string>());
  const profilePostMonthFetchInFlightRef = useRef(new Set<string>());

  useEffect(() => {
    aggRef.current = agg;
  }, [agg]);

  const refreshNotifications = useCallback(async () => {
    const myNotificationsRes = await services.client
      .from("notifications")
      .select("id,user_id,actor_id,kind,body,post_id,story_id,comment_id,read_at,created_at")
      .eq("user_id", currentUserId)
      .in("kind", SOCIAL_BELL_NOTIFICATION_KINDS)
      .order("created_at", { ascending: false })
      .limit(50);
    if (myNotificationsRes.error) throw myNotificationsRes.error;
    if (!mountedRef.current) return;
    setAgg((current) => ({
      ...current,
      myNotifications: (myNotificationsRes.data ?? []) as NotificationRow[],
    }));
  }, [services, currentUserId]);

  const refreshUnreadMessageCount = useCallback(async () => {
    const unreadRes = await services.client.rpc("get_conversation_summaries");
    if (unreadRes.error) throw unreadRes.error;
    const summaries = (unreadRes.data ?? []) as ConversationSummaryRow[];
    if (!mountedRef.current) return;
    setUnreadMessageCount(
      summaries.reduce((sum, summary) => sum + (summary.unread_count ?? 0), 0),
    );
  }, [services]);

  const refreshHomeCritical = useCallback(async (): Promise<HomeRefreshSnapshot> => {
    markPerf("feed_first_posts_start");
    setLoading(true);
    void services.stats.syncStreakRestores().catch(() => undefined);
    try {
      const [
        currentProfileRes,
        currentStatsRes,
        followsRes,
        feedRes,
        checkinsRes,
        activitiesRes,
        storiesRes,
        blocksRes,
        postMutesRes,
      ] = await Promise.all([
        services.client
          .from("profiles")
          .select(PROFILE_COLUMNS)
          .eq("user_id", currentUserId)
          .maybeSingle(),
        services.client
          .from("user_stats_live")
          .select(USER_STATS_COLUMNS)
          .eq("user_id", currentUserId)
          .maybeSingle(),
        services.client
          .from("follows")
          .select(FOLLOW_COLUMNS)
          .or(`follower_id.eq.${currentUserId},following_id.eq.${currentUserId}`),
        queryHomeFeedSurface(services.client, INITIAL_FEED_LIMIT),
        queryHomeCheckinsSurface(services.client, INITIAL_FEED_LIMIT),
        queryHomeActivitiesSurface(services.client, INITIAL_FEED_LIMIT),
        queryStoryTraySurface(services.client, INITIAL_STORY_LIMIT),
        // Apple Guideline 1.2: app de UGC precisa filtrar conteúdo de
        // blocked users de TODOS os surfaces (feed, stories, profiles,
        // comments, search, mensagens). Carrego a lista no refresh
        // e propago via blockedUserIds Set nos derivados abaixo.
        services.client
          .from("user_blocks")
          .select("blocked_id")
          .eq("blocker_id", currentUserId),
        // Post mute — alternativa menos drástica ao bloqueio. Esconde só
        // posts no feed; stories e perfil continuam acessíveis.
        services.client
          .from("post_mutes")
          .select("muted_user_id")
          .eq("user_id", currentUserId),
      ]);

      for (const r of [
        currentProfileRes,
        currentStatsRes,
        followsRes,
        feedRes,
        checkinsRes,
        activitiesRes,
        storiesRes,
        blocksRes,
        postMutesRes,
      ]) {
        if (r.error) throw r.error;
      }

      const feedSurfaceRows = (feedRes.data ?? []) as SurfacePostRow[];
      const checkinSurfaceRows = (checkinsRes.data ?? []) as SurfaceCheckinRow[];
      const activitySurfaceRows = (activitiesRes.data ?? []) as SurfaceActivityRow[];
      const storySurfaceRows = (storiesRes.data ?? []) as StoryTrayRow[];
      const feedPosts = feedSurfaceRows.map(feedPostRowFromSurface);
      const stories = storySurfaceRows
        .map(storyRowFromSurface)
        .filter((story): story is StoryRow => Boolean(story));
      const postIds = feedPosts.map((p) => p.id);
      const storyIds = stories.map((story) => story.id);

      if (!mountedRef.current) return { postIds, storyIds };
      setFeedHasMore(feedPosts.length >= INITIAL_FEED_LIMIT);
      const blockedUserIds = ((blocksRes.data ?? []) as Array<{ blocked_id: string }>)
        .map((row) => row.blocked_id);
      const mutedPostUserIds = (
        (postMutesRes.data ?? []) as Array<{ muted_user_id: string }>
      ).map((row) => row.muted_user_id);

      const surfaceProfiles = [
        currentProfileRes.data
          ? profileRowFromPartial(
              currentProfileRes.data as unknown as Partial<ProfileRow> & { user_id: string },
            )
          : null,
        ...feedSurfaceRows.map(profileRowFromSurface),
        ...checkinSurfaceRows.map(profileRowFromSurface),
        ...activitySurfaceRows.map(profileRowFromSurface),
        ...storySurfaceRows.map(profileRowFromSurface),
      ].filter((profile): profile is ProfileRow => Boolean(profile));
      const surfaceStats = [
        currentStatsRes.data as UserStatsRow | null,
        ...feedSurfaceRows.map(statsRowFromSurface),
        ...checkinSurfaceRows.map(statsRowFromSurface),
        ...activitySurfaceRows.map(statsRowFromSurface),
        ...storySurfaceRows.map(statsRowFromSurface),
      ].filter((stats): stats is UserStatsRow => Boolean(stats));
      const currentProfile = surfaceProfiles.find(
        (profile) => profile.user_id === currentUserId,
      );
      const nextCurrentUserLikes: PostLikeRow[] = feedSurfaceRows
        .filter((row) => row.liked_by_me && row.id)
        .map((row) => ({
          post_id: row.id as string,
          user_id: currentUserId,
          created_at: row.created_at ?? new Date().toISOString(),
        }));
      const nextStoryViews: StoryViewRow[] = storySurfaceRows
        .filter((row) => row.has_unseen === false && (row.id || row.first_story_id))
        .map((row) => ({
          story_id: (row.id ?? row.first_story_id) as string,
          user_id: currentUserId,
          viewed_at: row.created_at ?? new Date().toISOString(),
        }));
      setAgg((current) => ({
        ...current,
        profiles: mergeProfileRows(current.profiles, surfaceProfiles),
        stats: mergeStatsArrays(current.stats, surfaceStats),
        follows: (followsRes.data ?? []) as FollowRow[],
        feedPosts,
        feedCheckins: checkinSurfaceRows,
        feedActivities: activitySurfaceRows,
        storyTrayRows: storySurfaceRows,
        stories,
        postLikes: [
          ...current.postLikes.filter(
            (like) => !(like.user_id === currentUserId && postIds.includes(like.post_id)),
          ),
          ...nextCurrentUserLikes,
        ],
        storyViews: mergeRowsByKey(current.storyViews, nextStoryViews, (view) => `${view.story_id}:${view.user_id}`),
        blockedUserIds,
        mutedPostUserIds,
      }));
      // Sprint 13 — carrossel: busca as mídias extras SEM bloquear o paint do
      // feed (capas já renderizam). Os slides do carrossel entram logo depois.
      if (postIds.length) {
        void services.posts
          .mediaForPosts(postIds)
          .then((rows) => {
            if (mountedRef.current) {
              setAgg((c) => ({ ...c, postMedia: rows }));
            }
          })
          .catch(() => undefined);
      }
      writeNativeHomeCache(currentUserId, {
        profiles: surfaceProfiles,
        stats: surfaceStats,
        feedPosts,
        storyTrayRows: storySurfaceRows,
        stories,
      });
      writeNativeStoryTrayCache(currentUserId, {
        profiles: surfaceProfiles,
        stats: surfaceStats,
        storyTrayRows: storySurfaceRows,
        stories,
      });
      if (currentProfile) writeNativeOwnProfileCache(currentUserId, currentProfile);
      setError(null);
      return { postIds, storyIds };
    } catch (err) {
      if (mountedRef.current) setError(err as Error);
      return { postIds: [], storyIds: [] };
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        measurePerf("feed_first_posts_ms", "feed_first_posts_start", "feed_first_posts_end");
      }
    }
  }, [services, currentUserId]);

  /**
   * Sprint 3.6.4: bulk-hidrata stats/follows/activity de TODOS os users
   * passados (geralmente os visíveis no feed/stories/follows/suggestions
   * do load atual). Faz 4 queries paralelas com `IN (...)` em vez de N
   * queries por user. RLS filtra automaticamente (`user_activity_days`
   * só retorna pra perfis públicos ou que o currentUser segue).
   *
   * Chamada de `refreshHomeSecondary` (background, não bloqueia o paint
   * do feed) e `loadMoreFeed` (quando novos users aparecem). Resultado:
   * todo profile no app — não só o do current user — tem rings reais,
   * MyCircleSheet com dados certos, e counts de seguidores/seguindo
   * corretos.
   *
   * Filtramos o currentUserId fora porque ele já foi hidratado pelo
   * `refreshHomeCritical` (que faz a query individual pra ele).
   */
  const refreshUsersExtras = useCallback(
    async (userIds: string[]) => {
      const uniqueIds = Array.from(
        new Set(userIds.filter((id) => id && id !== currentUserId)),
      );
      if (uniqueIds.length === 0) return;
      // Sprint 3.6.5: 90 dias de lookback cobre o calendário do
      // MyCircleSheet (mês atual + mês anterior + buffer). Antes era 14d
      // só pro workoutsThisWeek — bug do calendário vazio em perfis de
      // outros users. Volume: ~30 rows/user típico * N users — leve.
      const today = new Date();
      const lookbackKey = new Date(
        today.getTime() - 90 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .slice(0, 10);

      const [statsRes, followersRes, followingRes, activityRes] =
        await Promise.all([
          services.client
            .from("user_stats_live")
            .select(USER_STATS_COLUMNS)
            .in("user_id", uniqueIds),
          // Sem GROUP BY nativo no supabase-js, baixamos as rows e
          // agregamos client-side. Pro Gym Circle em alpha (poucos users
          // com followers em massa), volume é trivial; quando virar
          // problema, criar RPC `get_follow_counts(user_ids[])` ou view
          // materializada com counts cacheados.
          services.client
            .from("follows")
            .select("following_id")
            .eq("status", "accepted")
            .in("following_id", uniqueIds),
          services.client
            .from("follows")
            .select("follower_id")
            .eq("status", "accepted")
            .in("follower_id", uniqueIds),
          services.client
            .from("user_activity_days")
            .select("user_id,activity_date")
            .in("user_id", uniqueIds)
            .gte("activity_date", lookbackKey),
        ]);

      // Best-effort: falha em uma query não bloqueia as outras.
      if (statsRes.error) {
        logSurfaceFallback("bulk users stats", statsRes.error);
      }
      if (followersRes.error) {
        logSurfaceFallback("bulk followers count", followersRes.error);
      }
      if (followingRes.error) {
        logSurfaceFallback("bulk following count", followingRes.error);
      }
      if (activityRes.error) {
        logSurfaceFallback("bulk activity days", activityRes.error);
      }

      // Casts via `unknown` necessários: supabase-js v2 com type builder
      // ativo gera uniões com `GenericStringError[]` no error path. Cast
      // direto pra shape inline falha o tsc. Pattern espelhado nos
      // outros casts em `refreshProfilePosts` e linha ~3301.
      const followersByUser = new Map<string, number>();
      for (const row of (followersRes.data ?? []) as unknown as Array<{
        following_id: string;
      }>) {
        followersByUser.set(
          row.following_id,
          (followersByUser.get(row.following_id) ?? 0) + 1,
        );
      }
      const followingByUser = new Map<string, number>();
      for (const row of (followingRes.data ?? []) as unknown as Array<{
        follower_id: string;
      }>) {
        followingByUser.set(
          row.follower_id,
          (followingByUser.get(row.follower_id) ?? 0) + 1,
        );
      }
      const activityByUser = new Map<string, string[]>();
      for (const row of (activityRes.data ?? []) as unknown as Array<{
        user_id: string;
        activity_date: string;
      }>) {
        const list = activityByUser.get(row.user_id) ?? [];
        list.push(row.activity_date);
        activityByUser.set(row.user_id, list);
      }

      const nextProfileExtras: Record<string, ProfileExtras> = {};
      for (const userId of uniqueIds) {
        const userActivityDays = activityByUser.get(userId) ?? [];
        const weekStats =
          userActivityDays.length > 0
            ? calculateWorkoutStats(userActivityDays)
            : null;
        nextProfileExtras[userId] = {
          followersCount: followersByUser.get(userId) ?? 0,
          followingCount: followingByUser.get(userId) ?? 0,
          workoutsThisWeek: weekStats?.workoutsThisWeek ?? 0,
          // Sprint 3.6.5: dates únicos (perfil pode treinar várias vezes
          // por dia, mas o calendário só precisa do dia). Set dedupa
          // automaticamente.
          activityDates: Array.from(new Set(userActivityDays)),
        };
      }
      // Cast através de `unknown` é o pattern correto pra supabase-js
      // queries multi-row (`.in(...)` sem `.maybeSingle()`): o type
      // builder gera uma união com `GenericStringError[]` no caso de
      // erro, e TS recusa cast direto. Mesmo padrão usado em linha ~3292
      // pro stats batch do refresh de profile.
      const completeStats = (statsRes.data ?? []) as unknown as UserStatsRow[];

      if (!mountedRef.current) return;
      setAgg((current) => ({
        ...current,
        // Smart merge — completes from user_stats_live mergeam com as
        // partials do surface preservando Math.max nos contadores.
        stats: mergeStatsArrays(current.stats, completeStats),
        profileExtras: {
          ...current.profileExtras,
          ...nextProfileExtras,
        },
      }));
    },
    [currentUserId, services],
  );

  const refreshHomeSecondary = useCallback(
    async (snapshot?: HomeRefreshSnapshot) => {
      const postIds = snapshot?.postIds ?? aggRef.current.feedPosts.map((post) => post.id);
      const storyIds = snapshot?.storyIds ?? aggRef.current.stories.map((story) => story.id);
      setSecondaryLoading(true);
      try {
        const [
          suggestionsRes,
          gymsRes,
          userGymsRes,
          myActivityRes,
          checkinsTodayRes,
          storyLikesRes,
          storyMutesRes,
          storyViewsRes,
          postParticipants,
          storyParticipants,
        ] = await Promise.all([
          queryUserSuggestionsSurface(services.client, 24),
          services.client
            .from("gyms")
            .select("id,name,address,city,state,latitude,longitude,created_at"),
          services.client
            .from("user_gyms")
            .select("id,user_id,gym_id,is_main,preferred_days,preferred_times,created_at"),
          services.client
            .from("user_activity_days")
            .select("id,user_id,activity_date,source_type,source_id,has_photo,created_at")
            .eq("user_id", currentUserId)
            .order("activity_date", { ascending: true }),
          services.client
            .from("checkins")
            .select("id,user_id,gym_id,checkin_date,created_at")
            .eq("checkin_date", getGymCircleDateKey()),
          storyIds.length > 0
            ? services.client
                .from("story_likes")
                .select("story_id,user_id,created_at")
                .eq("user_id", currentUserId)
                .in("story_id", storyIds)
            : Promise.resolve({ data: [] as StoryLikeRow[], error: null }),
          services.client
            .from("story_mutes")
            .select("user_id,muted_user_id,created_at")
            .eq("user_id", currentUserId),
          storyIds.length > 0
            ? services.client
                .from("story_views")
                .select("story_id,user_id,viewed_at")
                .eq("user_id", currentUserId)
                .in("story_id", storyIds)
            : Promise.resolve({ data: [] as StoryViewRow[], error: null }),
          postIds.length > 0
            ? services.participants.listPostParticipants(postIds)
            : Promise.resolve([] as PostParticipantRow[]),
          storyIds.length > 0
            ? services.participants.listStoryParticipants(storyIds)
            : Promise.resolve([] as StoryParticipantRow[]),
        ]);

        for (const r of [
          suggestionsRes,
          gymsRes,
          userGymsRes,
          myActivityRes,
          checkinsTodayRes,
        ]) {
          if (r.error) throw r.error;
        }

        const storyLikes = optionalStorySocialRows(
          storyLikesRes as { data: StoryLikeRow[] | null; error: unknown },
          "story_likes",
        );
        const storyMutes = optionalStorySocialRows(
          storyMutesRes as { data: StoryMuteRow[] | null; error: unknown },
          "story_mutes",
        );
        const storyViews = optionalStorySocialRows(
          storyViewsRes as { data: StoryViewRow[] | null; error: unknown },
          "story_views",
        );
        const suggestionRows = suggestionsRes.data ?? [];
        const suggestionProfiles = suggestionRows.map(profileRowFromDiscovery);
        const suggestionStats = suggestionRows.map(statsRowFromDiscovery);
        const suggestionFollows = suggestionRows
          .map((row) => followRowFromDiscovery(row, currentUserId))
          .filter((follow): follow is FollowRow => Boolean(follow));

        if (!mountedRef.current) return;
        const nextViewedStoryIds = loadStoredViewedStoryIds(currentUserId);
        for (const view of storyViews) nextViewedStoryIds.add(view.story_id);
        persistStoredViewedStoryIds(currentUserId, nextViewedStoryIds);
        setViewedStoryIds(nextViewedStoryIds);

        setAgg((current) => ({
          ...current,
          profiles: mergeProfileRows(current.profiles, suggestionProfiles),
          stats: mergeStatsArrays(current.stats, suggestionStats),
          follows: mergeRowsByKey(
            current.follows,
            suggestionFollows,
            (follow) => `${follow.follower_id}:${follow.following_id}`,
          ),
          suggestedUserIds: suggestionRows.map((row) => row.user_id),
          gyms: (gymsRes.data ?? []) as unknown as GymRow[],
          userGyms: (userGymsRes.data ?? []) as unknown as UserGymRow[],
          storyLikes: [
            ...current.storyLikes.filter(
              (like) =>
                !(like.user_id === currentUserId && storyIds.includes(like.story_id)),
            ),
            ...storyLikes,
          ],
          storyMutes,
          storyViews,
          postParticipants: [
            ...current.postParticipants.filter(
              (participant) => !postIds.includes(participant.post_id),
            ),
            ...postParticipants,
          ],
          storyParticipants: [
            ...current.storyParticipants.filter(
              (participant) => !storyIds.includes(participant.story_id),
            ),
            ...storyParticipants,
          ],
          checkinsToday: (checkinsTodayRes.data ?? []) as unknown as CheckinRow[],
          myActivityDays: (myActivityRes.data ?? []) as unknown as UserActivityDayRow[],
        }));

        // Sprint 3.6.4: bulk-hidrata stats/follows/activity de TODOS os
        // users visíveis no feed/stories/suggestions/follows. Sem await
        // — roda em paralelo com refreshNotifications/refreshUnreadCount
        // porque é "nice to have" pro paint de cards já corretos no
        // próximo render, mas não bloqueante.
        const visibleUserIds = new Set<string>();
        for (const post of aggRef.current.feedPosts) {
          visibleUserIds.add(post.user_id);
        }
        for (const story of aggRef.current.stories) {
          visibleUserIds.add(story.user_id);
        }
        for (const follow of aggRef.current.follows) {
          visibleUserIds.add(follow.follower_id);
          visibleUserIds.add(follow.following_id);
        }
        for (const row of suggestionRows) {
          visibleUserIds.add(row.user_id);
        }
        void refreshUsersExtras(Array.from(visibleUserIds));

        await refreshNotifications();
        await refreshUnreadMessageCount();
      } catch (err) {
        if (process.env.NEXT_PUBLIC_PERF_DEBUG === "true") {
          console.warn("[GymCirclePerf] secondary refresh failed", err);
        }
      } finally {
        if (mountedRef.current) setSecondaryLoading(false);
      }
    },
    [
      services,
      currentUserId,
      refreshNotifications,
      refreshUnreadMessageCount,
      refreshUsersExtras,
    ],
  );

  const refreshStoryViewerItems = useCallback(
    async (authorId: string): Promise<StoryRow[]> => {
      markPerf("story_viewer_items_start");
      try {
        const viewerRes = await queryStoryViewerItemsSurface(services.client, authorId);
        if (viewerRes.error) throw viewerRes.error;
        const storyRows = (viewerRes.data ?? []).map(storyRowFromViewerItem);
        const storyIds = storyRows.map((story) => story.id);
        const storyParticipants =
          storyIds.length > 0
            ? await services.participants.listStoryParticipants(storyIds)
            : [];
        const nextCurrentUserLikes: StoryLikeRow[] = (viewerRes.data ?? [])
          .filter((row) => row.viewer_has_liked)
          .map((row) => ({
            story_id: row.story_id,
            user_id: currentUserId,
            created_at: row.created_at,
          }));
        const nextViewedRows: StoryViewRow[] = (viewerRes.data ?? [])
          .filter((row) => row.viewer_has_seen)
          .map((row) => ({
            story_id: row.story_id,
            user_id: currentUserId,
            viewed_at: new Date().toISOString(),
          }));

        if (!mountedRef.current) return storyRows;
        setAgg((current) => ({
          ...current,
          stories: mergeRowsByKey(current.stories, storyRows, (story) => story.id),
          storyLikes: [
            ...current.storyLikes.filter(
              (like) =>
                !(
                  like.user_id === currentUserId &&
                  storyIds.includes(like.story_id)
                ),
            ),
            ...nextCurrentUserLikes,
          ],
          storyViews: mergeRowsByKey(
            current.storyViews,
            nextViewedRows,
            (view) => `${view.story_id}:${view.user_id}`,
          ),
          storyParticipants: [
            ...current.storyParticipants.filter(
              (participant) => !storyIds.includes(participant.story_id),
            ),
            ...storyParticipants,
          ],
        }));
        return storyRows;
      } catch (err) {
        if (process.env.NEXT_PUBLIC_PERF_DEBUG === "true") {
          console.warn("[GymCirclePerf] story viewer hydration failed", err);
        }
        return [];
      } finally {
        measurePerf(
          "story_viewer_items_ms",
          "story_viewer_items_start",
          "story_viewer_items_end",
        );
      }
    },
    [currentUserId, services],
  );

  const refreshChat = useCallback(async () => {
    markPerf("chat_open_start");
    setChatLoading(true);
    try {
      const summariesRes = await services.client.rpc("get_conversation_summaries");
      if (summariesRes.error) {
        logSurfaceFallback("chat summaries", summariesRes.error);
        if (!mountedRef.current) return;
        chatHydratedRef.current = true;
        setChatHydrated(true);
        setAgg((current) => ({
          ...current,
          conversationParticipants: [],
          conversations: [],
          conversationUnreadCounts: {},
        }));
        return;
      }

      const summaries = (summariesRes.data ?? []) as ConversationSummaryRow[];
      const conversations = summaries.map<ConversationRow>((summary) => ({
        id: summary.conversation_id,
        type: summary.type === "group" ? "group" : "direct",
        name: summary.name,
        image_url: summary.image_url,
        last_message_at: summary.last_message_at,
        created_at: summary.last_message_at ?? new Date().toISOString(),
        updated_at: summary.last_message_at ?? new Date().toISOString(),
        created_by: null,
        direct_key: null,
      }));
      const conversationUnreadCounts = Object.fromEntries(
        summaries.map((summary) => [
          summary.conversation_id,
          summary.unread_count ?? 0,
        ]),
      );
      const allConversationParticipants = summaries.flatMap((summary) => {
        const participants = parseJsonValue<ConversationSummaryParticipant[]>(
          summary.participants,
          [],
        );
        return participants
          .filter((participant) => Boolean(participant.user_id))
          .map<ConversationParticipantRow>((participant) => ({
            conversation_id: participant.conversation_id ?? summary.conversation_id,
            user_id: participant.user_id as string,
            role: participant.role ?? "member",
            joined_at:
              participant.joined_at ??
              participant.created_at ??
              summary.last_message_at ??
              new Date().toISOString(),
            created_at:
              participant.created_at ??
              participant.joined_at ??
              summary.last_message_at ??
              new Date().toISOString(),
            last_read_at:
              participant.user_id === currentUserId
                ? summary.last_read_at
                : participant.last_read_at ?? null,
            deleted_at:
              participant.user_id === currentUserId
                ? summary.deleted_at
                : participant.deleted_at ?? null,
          }));
      });
      const summaryProfiles = summaries.flatMap((summary) => {
        const participants = parseJsonValue<ConversationSummaryParticipant[]>(
          summary.participants,
          [],
        );
        return participants
          .map((participant) =>
            participant.user_id
              ? profileRowFromPartial({
                  user_id: participant.user_id,
                  username: participant.username ?? undefined,
                  display_name:
                    participant.display_name ??
                    participant.username ??
                    "Gym Circle",
                  avatar_url: participant.avatar_url ?? null,
                  account_status: participant.account_status ?? "active",
                })
              : null,
          )
          .filter((profile): profile is ProfileRow => Boolean(profile));
      });
      const lastMessages = summaries
        .map((summary) =>
          directMessageRowFromPartial(
            parseJsonValue<Partial<DirectMessageRow> | null>(summary.last_message, null) ?? {},
          ),
        )
        .filter((message): message is DirectMessageRow => Boolean(message));
      const visibleConversationIds = new Set(
        conversations.map((conversation) => conversation.id),
      );

      if (!mountedRef.current) return;
      chatHydratedRef.current = true;
      setChatHydrated(true);
      setUnreadMessageCount(
        summaries.reduce((sum, summary) => sum + (summary.unread_count ?? 0), 0),
      );
      setAgg((current) => ({
        ...current,
        profiles: mergeProfileRows(current.profiles, summaryProfiles),
        conversationParticipants: allConversationParticipants,
        conversations,
        conversationUnreadCounts,
        chatMessages: mergeRowsByKey(
          current.chatMessages.filter(
            (message) =>
              message.conversation_id !== null &&
              visibleConversationIds.has(message.conversation_id),
          ),
          lastMessages,
          (message) => message.id,
        ),
      }));
    } finally {
      if (mountedRef.current) {
        setChatLoading(false);
        measurePerf("chat_open_ms", "chat_open_start", "chat_open_end");
      }
    }
  }, [services, currentUserId]);

  const refreshConversationMessages = useCallback(
    async (conversationId: string) => {
      markPerf("conversation_open_start");
      try {
        const messagesRes = await services.client.rpc("get_conversation_messages", {
          p_conversation_id: conversationId,
          p_cursor_created_at: null,
          p_limit: 30,
        });
        if (messagesRes.error) {
          logSurfaceFallback("conversation messages", messagesRes.error);
          return;
        }
        const messages = ((messagesRes.data ?? []) as Partial<DirectMessageRow>[])
          .map(directMessageRowFromPartial)
          .filter((message): message is DirectMessageRow => Boolean(message));
        if (!mountedRef.current) return;
        setAgg((current) => ({
          ...current,
          chatMessages: [
            ...current.chatMessages.filter(
              (message) => message.conversation_id !== conversationId,
            ),
            ...messages,
          ],
        }));
      } finally {
        measurePerf(
          "conversation_open_ms",
          "conversation_open_start",
          "conversation_open_end",
        );
      }
    },
    [services],
  );

  const refreshProfilePosts = useCallback(
    async (userId: string) => {
      markPerf("profile_posts_start");
      // Sprint 3.6.3: 5 queries paralelas pra trazer TODOS os dados ricos
      // do profile visitado. Antes só pegávamos posts; stats/follows/
      // activity_days do user-alvo nunca eram buscados, então o
      // `ProfileSheet` mostrava 0 em maior streak, treinos no mês, dias
      // no ano, seguidores e seguindo — refletindo só conexões com o
      // currentUser ou hardcoded zeros do `statsRowFromSurface`.
      const [
        profilePostsRes,
        profileStatsRes,
        followersCountRes,
        followingCountRes,
        profileActivityRes,
        profileRowRes,
      ] = await Promise.all([
        // p_limit 50 = teto da RPC (least(...,50)). Alimenta grid do
        // perfil + mini-fotos do calendário; meses mais antigos que a
        // janela ficam sem foto (dia ainda marca via activity_days) —
        // fetch por mês na navegação do calendário fica como follow-up
        // (paridade com o MyCircleService nativo, que já consulta
        // posts por mês).
        services.client.rpc("get_profile_posts", {
          p_user_id: userId,
          p_cursor_created_at: null,
          p_limit: 50,
        }),
        services.client
          .from("user_stats_live")
          .select(USER_STATS_COLUMNS)
          .eq("user_id", userId)
          .maybeSingle(),
        // `head: true, count: 'exact'` pede só o count, sem retornar rows
        // — leve mesmo pra usuários com milhares de followers.
        services.client
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", userId)
          .eq("status", "accepted"),
        services.client
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", userId)
          .eq("status", "accepted"),
        services.client
          .from("user_activity_days")
          .select("activity_date")
          .eq("user_id", userId)
          .order("activity_date", { ascending: false })
          .limit(400),
        // Sprint 11.2 — fetch direto do profile row. Antes o profile só
        // era hidratado a partir dos posts (profileRowFromSurface), então
        // users com ZERO posts (ex: alguém que só te seguiu) nunca
        // entravam em `usersById` e a ProfileSheet abria vazia (user=null).
        // RLS profiles_select_visible já filtra blocked/deactivated.
        services.client
          .from("profiles")
          // Sprint 21.1 — PROFILE_COLUMNS exclui reactivation_token_hash
          // (server-only) e blinda contra coluna sensível futura descer
          // automaticamente pro cliente.
          .select(PROFILE_COLUMNS)
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
      if (profilePostsRes.error) {
        logSurfaceFallback("profile posts", profilePostsRes.error);
        measurePerf("profile_posts_ms", "profile_posts_start", "profile_posts_end");
        return;
      }
      // Os auxiliares não bloqueiam — se falhar (RLS, network), mantemos
      // o que já estava em agg/profileExtras. Logamos via fallback helper.
      if (profileStatsRes.error) {
        logSurfaceFallback("profile stats", profileStatsRes.error);
      }
      if (followersCountRes.error) {
        logSurfaceFallback("profile followers count", followersCountRes.error);
      }
      if (followingCountRes.error) {
        logSurfaceFallback("profile following count", followingCountRes.error);
      }
      if (profileActivityRes.error) {
        logSurfaceFallback("profile activity days", profileActivityRes.error);
      }

      if (profileRowRes.error) {
        logSurfaceFallback("profile row", profileRowRes.error);
      }

      const profileSurfaceRows = (profilePostsRes.data ?? []) as SurfacePostRow[];
      const profileFeedPosts = profileSurfaceRows.map(feedPostRowFromSurface);
      // Sprint 11.2 — profile row direto entra PRIMEIRO (fonte canônica),
      // depois os parciais extraídos dos posts. mergeProfileRows resolve
      // conflitos preferindo campos não-nulos, então o row direto garante
      // que o user é hidratado mesmo sem nenhum post.
      const directProfileRow =
        (profileRowRes.data as unknown as ProfileRow | null) ?? null;
      const profileSurfaceProfiles = [
        directProfileRow,
        ...profileSurfaceRows.map(profileRowFromSurface),
      ].filter((profile): profile is ProfileRow => Boolean(profile));
      // Cast defensivo: supabase-js .maybeSingle() retorna tipo unionado
      // com PostgrestError. Mesmo que TS consiga inferir em alguns casos,
      // ir via `unknown` evita brechas em mudanças futuras da lib.
      const completeProfileStats =
        profileStatsRes.data as unknown as UserStatsRow | null;
      // A row completa do user_stats_live (se veio) entra ANTES das
      // partials do surface — `mergeStatsArrays` faz Math.max nos
      // conflitos, então mesmo se vier depois o complete ganha.
      const profileSurfaceStats: UserStatsRow[] = [
        completeProfileStats,
        ...profileSurfaceRows.map(statsRowFromSurface),
      ].filter((stats): stats is UserStatsRow => Boolean(stats));
      const profileCurrentUserLikes: PostLikeRow[] = profileSurfaceRows
        .filter((row) => row.liked_by_me && row.id)
        .map((row) => ({
          post_id: row.id as string,
          user_id: currentUserId,
          created_at: row.created_at ?? new Date().toISOString(),
        }));

      // Calcula workoutsThisWeek do user-alvo a partir do user_activity_days
      // dele (já filtrado por RLS — só vem se é o próprio user OU se o
      // currentUser pode ver os posts dele, ver policy
      // user_activity_days_select_visible). Se a query falhou ou retornou
      // vazio (perfil privado sem follow), cai pra 0.
      const profileActivityDays = (
        (profileActivityRes.data ?? []) as unknown as Array<{
          activity_date: string;
        }>
      ).map((row) => row.activity_date);
      const profileWeekStats =
        profileActivityDays.length > 0
          ? calculateWorkoutStats(profileActivityDays)
          : null;

      const nextProfileExtras: ProfileExtras = {
        followersCount: followersCountRes.count ?? 0,
        followingCount: followingCountRes.count ?? 0,
        workoutsThisWeek: profileWeekStats?.workoutsThisWeek ?? 0,
        // Sprint 3.6.5: dates únicos pra alimentar o calendário do
        // MyCircleSheet. profileActivityDays já é uma lista de
        // activity_date strings via limit 400.
        activityDates: Array.from(new Set(profileActivityDays)),
      };

      if (!mountedRef.current) return;
      setAgg((current) => ({
        ...current,
        profiles: mergeProfileRows(current.profiles, profileSurfaceProfiles),
        stats: mergeStatsArrays(current.stats, profileSurfaceStats),
        profileFeedPosts: mergeRowsByKey(
          current.profileFeedPosts,
          profileFeedPosts,
          (post) => post.id,
        ),
        postLikes: [
          ...current.postLikes.filter(
            (like) =>
              !(
                like.user_id === currentUserId &&
                profileFeedPosts.some((post) => post.id === like.post_id)
              ),
          ),
          ...profileCurrentUserLikes,
        ],
        profileExtras: {
          ...current.profileExtras,
          [userId]: nextProfileExtras,
        },
      }));
      measurePerf("profile_posts_ms", "profile_posts_start", "profile_posts_end");
    },
    [currentUserId, services],
  );

  /**
   * Fix calendário — paridade com o MyCircleService nativo. A navegação do
   * calendário hidrata os posts do mês visível diretamente por workout_date,
   * sem depender do teto de 50 rows da RPC get_profile_posts.
   */
  const ensureProfilePostsForMonth = useCallback(
    async (userId: string, monthKey: string) => {
      if (!/^\d{4}-\d{2}$/.test(monthKey)) return;
      const cacheKey = `${userId}:${monthKey}`;
      if (
        profilePostMonthsLoadedRef.current.has(cacheKey) ||
        profilePostMonthFetchInFlightRef.current.has(cacheKey)
      ) {
        return;
      }

      const [year, month] = monthKey.split("-").map(Number);
      const nextMonth = new Date(year, month, 1);
      const monthStart = `${monthKey}-01`;
      const monthEnd = `${nextMonth.getFullYear()}-${String(
        nextMonth.getMonth() + 1,
      ).padStart(2, "0")}-01`;

      profilePostMonthFetchInFlightRef.current.add(cacheKey);
      try {
        const res = await services.client
          .from("posts")
          .select(
            [
              "id",
              "user_id",
              "image_url",
              "thumbnail_url",
              "poster_url",
              "media_width",
              "media_height",
              "media_duration_seconds",
              "blur_data_url",
              "media_type",
              "caption",
              "gym_id",
              "workout_type",
              "workout_types",
              "workout_date",
              "created_at",
              "location_source",
              "location_name",
              "location_latitude",
              "location_longitude",
              "location_google_maps_url",
            ].join(","),
          )
          .eq("user_id", userId)
          .gte("workout_date", monthStart)
          .lt("workout_date", monthEnd)
          .order("workout_date", { ascending: false })
          .order("created_at", { ascending: false });

        if (res.error) {
          logSurfaceFallback("profile posts month", res.error);
          return;
        }

        const feedRows = ((res.data ?? []) as unknown as PostRow[]).map(
          feedPostRowFromPostRow,
        );
        if (!mountedRef.current) return;
        setAgg((current) => ({
          ...current,
          profileFeedPosts: mergeRowsByKey(
            current.profileFeedPosts,
            feedRows,
            (post) => post.id,
          ),
        }));
        profilePostMonthsLoadedRef.current.add(cacheKey);
      } finally {
        profilePostMonthFetchInFlightRef.current.delete(cacheKey);
      }
    },
    [services],
  );

  const refreshPostDetails = useCallback(
    async (postId: string) => {
      lastDetailPostIdRef.current = postId;
      const [likesRes, commentsRes, postParticipants] = await Promise.all([
        services.client
          .from("post_likes")
          .select("post_id,user_id,created_at")
          .eq("post_id", postId),
        services.client
          .from("post_comments")
          .select("id,post_id,user_id,parent_comment_id,body,created_at")
          .eq("post_id", postId)
          .order("created_at", { ascending: true }),
        services.participants.listPostParticipants([postId]),
      ]);
      if (likesRes.error) throw likesRes.error;
      if (commentsRes.error) throw commentsRes.error;

      const postComments = (commentsRes.data ?? []) as PostCommentRow[];
      const commentIds = postComments.map((comment) => comment.id);
      const postCommentLikesRes =
        commentIds.length > 0
          ? await services.client
              .from("post_comment_likes")
              .select("comment_id,user_id,created_at")
              .in("comment_id", commentIds)
          : { data: [] as PostCommentLikeRow[], error: null };
      const postCommentLikes = optionalStorySocialRows(
        postCommentLikesRes as { data: PostCommentLikeRow[] | null; error: unknown },
        "post_comment_likes",
      );

      // #5 — busca os perfis dos comentaristas ainda não carregados, pra o autor
      // do comentário não cair no fallback (antes herdava o dono do post).
      const commentUserIds = Array.from(new Set(postComments.map((c) => c.user_id)));
      const knownProfileIds = new Set(aggRef.current.profiles.map((p) => p.user_id));
      const missingProfileIds = commentUserIds.filter((id) => !knownProfileIds.has(id));
      let fetchedCommentProfiles: ProfileRow[] = [];
      if (missingProfileIds.length > 0) {
        const commentProfilesRes = await services.client
          .from("profiles")
          .select(PROFILE_COLUMNS)
          .in("user_id", missingProfileIds);
        fetchedCommentProfiles = (commentProfilesRes.data ?? []) as unknown as ProfileRow[];
      }

      if (!mountedRef.current) return;
      setAgg((current) => {
        const previousCommentIds = current.postComments
          .filter((comment) => comment.post_id === postId)
          .map((comment) => comment.id);
        const nextCommentIds = new Set(commentIds);
        const staleCommentIds = new Set(
          previousCommentIds.filter((commentId) => !nextCommentIds.has(commentId)),
        );

        return {
          ...current,
          profiles: mergeProfileRows(current.profiles, fetchedCommentProfiles),
          feedPosts: current.feedPosts.map((row) =>
            row.id === postId ? { ...row, comments_count: postComments.length } : row,
          ),
          postLikes: [
            ...current.postLikes.filter((like) => like.post_id !== postId),
            ...((likesRes.data ?? []) as PostLikeRow[]),
          ],
          postComments: [
            ...current.postComments.filter((comment) => comment.post_id !== postId),
            ...postComments,
          ],
          postCommentLikes: [
            ...current.postCommentLikes.filter(
              (like) =>
                !staleCommentIds.has(like.comment_id) && !commentIds.includes(like.comment_id),
            ),
            ...postCommentLikes,
          ],
          postParticipants: [
            ...current.postParticipants.filter(
              (participant) => participant.post_id !== postId,
            ),
            ...postParticipants,
          ],
        };
      });
    },
    [services],
  );

  const refresh = useCallback(async () => {
    const snapshot = await refreshHomeCritical();
    void refreshHomeSecondary(snapshot);
  }, [refreshHomeCritical, refreshHomeSecondary]);

  const loadMoreFeed = useCallback(async () => {
    if (feedLoadingMore || !feedHasMore) return;
    const currentPosts = aggRef.current.feedPosts;
    const cursor = currentPosts
      .map((post) => post.created_at)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
    if (!cursor) {
      setFeedHasMore(false);
      return;
    }

    markPerf("load_more_feed_start");
    setFeedLoadingMore(true);
    try {
      const feedRes = await queryHomeFeedSurface(
        services.client,
        INITIAL_FEED_LIMIT,
        cursor,
      );
      if (feedRes.error) throw feedRes.error;
      const feedSurfaceRows = (feedRes.data ?? []) as SurfacePostRow[];
      const feedPosts = feedSurfaceRows.map(feedPostRowFromSurface);
      const postIds = feedPosts.map((post) => post.id);
      const surfaceProfiles = feedSurfaceRows
        .map(profileRowFromSurface)
        .filter((profile): profile is ProfileRow => Boolean(profile));
      const surfaceStats = feedSurfaceRows
        .map(statsRowFromSurface)
        .filter((stats): stats is UserStatsRow => Boolean(stats));
      const nextCurrentUserLikes: PostLikeRow[] = feedSurfaceRows
        .filter((row) => row.liked_by_me && row.id)
        .map((row) => ({
          post_id: row.id as string,
          user_id: currentUserId,
          created_at: row.created_at ?? new Date().toISOString(),
        }));

      if (!mountedRef.current) return;
      setFeedHasMore(feedPosts.length >= INITIAL_FEED_LIMIT);
      setAgg((current) => ({
        ...current,
        profiles: mergeProfileRows(current.profiles, surfaceProfiles),
        stats: mergeStatsArrays(current.stats, surfaceStats),
        feedPosts: mergeRowsByKey(current.feedPosts, feedPosts, (post) => post.id),
        postLikes: [
          ...current.postLikes.filter(
            (like) =>
              !(like.user_id === currentUserId && postIds.includes(like.post_id)),
          ),
          ...nextCurrentUserLikes,
        ],
      }));

      // Sprint 13 — carrossel: mídias dos posts paginados (append, sem bloquear).
      if (postIds.length) {
        void services.posts
          .mediaForPosts(postIds)
          .then((rows) => {
            if (mountedRef.current) {
              setAgg((c) => ({ ...c, postMedia: [...c.postMedia, ...rows] }));
            }
          })
          .catch(() => undefined);
      }

      // Sprint 3.6.4: hidrata profileExtras dos novos users que apareceram
      // no batch atual. Sem await — em background.
      const newUserIds = feedPosts
        .map((post) => post.user_id)
        .filter((id): id is string => Boolean(id));
      if (newUserIds.length > 0) {
        void refreshUsersExtras(newUserIds);
      }
    } catch (err) {
      if (process.env.NEXT_PUBLIC_PERF_DEBUG === "true") {
        console.warn("[GymCirclePerf] load more feed failed", err);
      }
    } finally {
      if (mountedRef.current) setFeedLoadingMore(false);
      measurePerf("load_more_feed_ms", "load_more_feed_start", "load_more_feed_end");
    }
  }, [
    currentUserId,
    feedHasMore,
    feedLoadingMore,
    refreshUsersExtras,
    services.client,
    services.posts,
  ]);

  // Sprint 19 — carrega o ranking da Competição (escopo × período) sob demanda.
  const loadRanking = useCallback(
    async (scope: RankingScope, period: RankingPeriod) => {
      const requestId = rankingRequestRef.current + 1;
      rankingRequestRef.current = requestId;
      setRanking((prev) => ({ ...prev, scope, period, loading: true }));
      const res = await queryCircleRankingSurface(services.client, scope, period);
      let rows = res.error ? [] : res.data;
      const shouldUseClientFallback =
        rows.length === 0 || (scope === "circle" && rows.length <= 1);
      if (shouldUseClientFallback) {
        const fallbackRows = await queryCircleRankingClientFallback(
          services.client,
          scope,
          period,
          currentUserId,
          scope === "global" ? 50 : 200,
        );
        if (fallbackRows.length > 0 || rows.length === 0) {
          rows = fallbackRows;
        }
      }
      if (!mountedRef.current || requestId !== rankingRequestRef.current) return;
      setRanking({
        rows,
        scope,
        period,
        loading: false,
      });
    },
    [currentUserId, services.client],
  );

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refresh();
    }, 220);
  }, [refresh]);

  const handlePostLikeRealtime = useCallback(
    (payload: RealtimePayload) => {
      const row = (payload.new ?? payload.old) as Partial<PostLikeRow> | undefined;
      if (!row?.post_id || row.user_id === currentUserId) return;
      const delta = payload.eventType === "DELETE" ? -1 : payload.eventType === "INSERT" ? 1 : 0;
      if (!delta) return;
      setAgg((current) => ({
        ...current,
        feedPosts: current.feedPosts.map((post) =>
          post.id === row.post_id
            ? { ...post, likes_count: Math.max(0, (post.likes_count ?? 0) + delta) }
            : post,
        ),
      }));
    },
    [currentUserId],
  );

  const handlePostCommentRealtime = useCallback(
    (payload: RealtimePayload) => {
      const row = (payload.new ?? payload.old) as Partial<PostCommentRow> | undefined;
      if (!row?.post_id) return;
      const delta = payload.eventType === "DELETE" ? -1 : payload.eventType === "INSERT" ? 1 : 0;
      if (delta) {
        setAgg((current) => ({
          ...current,
          feedPosts: current.feedPosts.map((post) =>
            post.id === row.post_id
              ? {
                  ...post,
                  comments_count: Math.max(0, (post.comments_count ?? 0) + delta),
                }
              : post,
          ),
        }));
      }
      // Refaz a lista quando o post já tem comentários carregados OU é o post
      // aberto agora (cobre o 1º comentário ao vivo num post que estava vazio —
      // antes só `detailsLoaded` e a lista vazia nunca atualizava).
      const isOpenPost = row.post_id === lastDetailPostIdRef.current;
      const detailsLoaded = aggRef.current.postComments.some(
        (comment) => comment.post_id === row.post_id,
      );
      if (isOpenPost || detailsLoaded) void refreshPostDetails(row.post_id);
    },
    [refreshPostDetails],
  );

  // #3b — curtidas em comentários: antes era callback vazio (não atualizava ao
  // vivo). Agora refaz os detalhes do post dono do comentário curtido, se ele
  // estiver carregado.
  const handleCommentLikeRealtime = useCallback(
    (payload: RealtimePayload) => {
      const row = (payload.new ?? payload.old) as { comment_id?: string } | undefined;
      const commentId = row?.comment_id;
      if (!commentId) return;
      const owningPostId = aggRef.current.postComments.find(
        (comment) => comment.id === commentId,
      )?.post_id;
      if (owningPostId) void refreshPostDetails(owningPostId);
    },
    [refreshPostDetails],
  );

  const handleStoryLikeRealtime = useCallback(
    (payload: RealtimePayload) => {
      const row = (payload.new ?? payload.old) as Partial<StoryLikeRow> | undefined;
      if (!row?.story_id || !row.user_id || row.user_id === currentUserId) return;
      const storyId = row.story_id;
      const userId = row.user_id;
      setAgg((current) => ({
        ...current,
        storyLikes:
          payload.eventType === "DELETE"
            ? current.storyLikes.filter(
                (like) => !(like.story_id === storyId && like.user_id === userId),
              )
            : current.storyLikes.some(
                  (like) => like.story_id === storyId && like.user_id === userId,
                )
              ? current.storyLikes
              : [
                  ...current.storyLikes,
                  {
                    story_id: storyId,
                    user_id: userId,
                    created_at: (row.created_at as string | undefined) ?? new Date().toISOString(),
                  },
                ],
      }));
    },
    [currentUserId],
  );

  const handleChatRealtime = useCallback(() => {
    if (chatRealtimeTimerRef.current !== null) {
      window.clearTimeout(chatRealtimeTimerRef.current);
    }
    chatRealtimeTimerRef.current = window.setTimeout(() => {
      chatRealtimeTimerRef.current = null;
      if (chatHydratedRef.current) {
        void refreshChat();
        return;
      }
      void refreshUnreadMessageCount().catch(() => undefined);
    }, 260);
  }, [refreshChat, refreshUnreadMessageCount]);

  useEffect(() => {
    mountedRef.current = true;
    const refreshId = window.setTimeout(() => {
      void refreshHomeCritical().then((snapshot) => {
        void refreshHomeSecondary(snapshot);
      });
    }, 0);
    const channel = services.client
      .channel("supabase-social")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "story_likes" }, handleStoryLikeRealtime)
      .on("postgres_changes", { event: "*", schema: "public", table: "story_mutes" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_participants" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "story_participants" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_mutes" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, handlePostLikeRealtime)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comment_likes" }, handleCommentLikeRealtime)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, handlePostCommentRealtime)
      .on("postgres_changes", { event: "*", schema: "public", table: "follows" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "checkins" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_stats" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, handleChatRealtime)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, handleChatRealtime)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants" }, handleChatRealtime)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        () => {
          void refreshNotifications().catch(() => undefined);
        },
      )
      .subscribe();
    return () => {
      window.clearTimeout(refreshId);
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (chatRealtimeTimerRef.current !== null) {
        window.clearTimeout(chatRealtimeTimerRef.current);
        chatRealtimeTimerRef.current = null;
      }
      mountedRef.current = false;
      services.client.removeChannel(channel);
    };
  }, [
    services,
    refreshHomeCritical,
    refreshHomeSecondary,
    scheduleRefresh,
    currentUserId,
    handleStoryLikeRealtime,
    handlePostLikeRealtime,
    handlePostCommentRealtime,
    handleCommentLikeRealtime,
    handleChatRealtime,
    refreshNotifications,
  ]);

  const showFeedback = useCallback(
    (tone: FeedbackTone, title: string, detail?: string) => {
      simulateHaptic(tone);
      const id = Date.now();
      setFeedback({ id, tone, title, detail });
      window.setTimeout(() => {
        setFeedback((curr) => (curr?.id === id ? null : curr));
      }, 2200);
    },
    [],
  );

  // ---- Derivações memoizadas ----
  // Set de IDs que bloqueei. Usado para filtrar tudo que vai pra UI.
  const blockedSet = useMemo(
    () => new Set(agg.blockedUserIds),
    [agg.blockedUserIds],
  );

  // Set de IDs cujos posts no feed eu silenciei. Diferente de blockedSet:
  // mute só esconde feed posts; stories, perfil e busca continuam normais.
  const mutedPostAuthorsSet = useMemo(
    () => new Set(agg.mutedPostUserIds),
    [agg.mutedPostUserIds],
  );

  const enrichedAll = useMemo(
    () => buildEnrichedUsers(agg, currentUserId, blockedSet),
    [agg, currentUserId, blockedSet],
  );

  const currentUser = useMemo<EnrichedUser>(
    () => buildCurrentUser(enrichedAll, currentUserId),
    [enrichedAll, currentUserId],
  );

  const usersRecord = useMemo<Record<string, GymUser>>(
    () => buildUsersRecord(enrichedAll),
    [enrichedAll],
  );

  const gymOptions = useMemo<GymLocationOption[]>(
    () => buildGymOptions(agg.gyms),
    [agg.gyms],
  );

  const postParticipantsByPost = useMemo(() => {
    const map = new Map<string, PostParticipantRow[]>();
    for (const participant of agg.postParticipants) {
      const list = map.get(participant.post_id) ?? [];
      list.push(participant);
      map.set(participant.post_id, list);
    }
    return map;
  }, [agg.postParticipants]);

  const storyParticipantsByStory = useMemo(() => {
    const map = new Map<string, StoryParticipantRow[]>();
    for (const participant of agg.storyParticipants) {
      const list = map.get(participant.story_id) ?? [];
      list.push(participant);
      map.set(participant.story_id, list);
    }
    return map;
  }, [agg.storyParticipants]);

  const profilePosts = useMemo<EnrichedPost[]>(
    () =>
      buildProfilePosts({
        agg,
        enrichedAll,
        currentUser,
        currentUserId,
        blockedSet,
        postParticipantsByPost,
      }),
    [agg, enrichedAll, currentUser, currentUserId, blockedSet, postParticipantsByPost],
  );

  const feedPosts = useMemo<EnrichedPost[]>(
    () =>
      profilePosts.filter((post) => {
        if (post.userId === currentUserId) return true;
        if (mutedPostAuthorsSet.has(post.userId)) return false;
        if (
          post.acceptedParticipants?.some((participant) => {
            if (participant.id === currentUserId) return true;
            return participant.followStatus === "accepted";
          })
        ) {
          return true;
        }
        return post.author.followStatus === "accepted";
      }),
    [currentUserId, mutedPostAuthorsSet, profilePosts],
  );

  const feedCheckins = useMemo<EnrichedCheckin[]>(
    () =>
      agg.feedCheckins
        .map((row) => {
          const author = enrichedAll.get(row.user_id);
          if (!author) return null;
          return {
            id: row.id,
            userId: row.user_id,
            gymId: row.gym_id,
            gymName: row.gym_name,
            gymAddress: row.gym_address ?? null,
            gymCity: row.gym_city ?? null,
            gymState: row.gym_state ?? null,
            gymLatitude: row.gym_latitude ?? null,
            gymLongitude: row.gym_longitude ?? null,
            checkinDate: row.checkin_date,
            createdAt: row.created_at,
            author,
          };
        })
        .filter((item): item is EnrichedCheckin => Boolean(item)),
    [agg.feedCheckins, enrichedAll],
  );

  // Rastreio de treino — entradas de atividade no feed (mirror do check-in).
  const feedActivities = useMemo<EnrichedActivity[]>(
    () =>
      agg.feedActivities
        .map((row) => {
          const author = enrichedAll.get(row.user_id);
          if (!author) return null;
          return {
            id: row.id,
            userId: row.user_id,
            activityType: row.activity_type,
            startedAt: row.started_at ?? null,
            endedAt: row.ended_at ?? null,
            elapsedS: row.elapsed_s,
            avgHr: row.avg_hr ?? null,
            totalCalories: row.total_calories ?? null,
            distanceM: row.distance_m ?? null,
            movingS: row.moving_s ?? null,
            elevationGainM: row.elevation_gain_m ?? null,
            route: row.route ?? null,
            strengthSets:
              (
                row.strength_sets as
                  | {
                      reps: number;
                      weight_kg: number | null;
                      exercise?: string | null;
                      exercise_id?: string | null;
                      target_kind?: "reps" | "failure" | "duration" | null;
                      duration_seconds?: number | null;
                      technique_id?: string | null;
                      technique_name?: string | null;
                      technique_notes?: string | null;
                    }[]
                  | null
                  | undefined
              )?.map(
                (s): StrengthSet => ({
                  reps: s.reps,
                  weightKg: s.weight_kg ?? null,
                  exercise: s.exercise ?? null,
                  exerciseId: s.exercise_id ?? null,
                  targetKind: s.target_kind ?? null,
                  durationSeconds: s.duration_seconds ?? null,
                  techniqueId: s.technique_id ?? null,
                  techniqueName: s.technique_name ?? null,
                  techniqueNotes: s.technique_notes ?? null,
                }),
              ) ?? null,
            workoutDate: row.workout_date,
            createdAt: row.created_at,
            caption: row.caption ?? null,
            workoutTypes: row.workout_types ?? null,
            gymId: row.gym_id ?? null,
            gymName: row.gym_name ?? null,
            locationName: row.location_name ?? null,
            locationLatitude: row.location_latitude ?? null,
            locationLongitude: row.location_longitude ?? null,
            locationGoogleMapsUrl: row.location_google_maps_url ?? null,
            author,
          };
        })
        .filter((item): item is EnrichedActivity => Boolean(item)),
    [agg.feedActivities, enrichedAll],
  );

  const storyItems = useMemo<EnrichedStory[]>(
    () =>
      buildStoryItems({
        agg,
        enrichedAll,
        currentUserId,
        storyParticipantsByStory,
        viewedStoryIds,
      }),
    // enrichedAll já muda a cada mudança de agg, então `agg` aqui é equivalente
    // às deps granulares antigas (agg.stories/storyTrayRows/...) — sem recomputo
    // extra. Mantido `agg` pra o eslint enxergar a dep que o builder lê inteira.
    [agg, currentUserId, enrichedAll, storyParticipantsByStory, viewedStoryIds],
  );

  const storyGroups = useMemo<StoryGroup[]>(
    () => groupStoriesByProfile(storyItems, currentUserId),
    [currentUserId, storyItems],
  );

  const storyBubbles = useMemo<EnrichedStory[]>(
    () =>
      storyGroups
        .map((group) => group.stories.find((story) => !story.viewed) ?? group.stories.at(-1))
        .filter((story): story is EnrichedStory => Boolean(story)),
    [storyGroups],
  );

  const selectedStoryGroup = useMemo(
    () =>
      selectedStoryGroupId
        ? storyGroups.find((group) => group.id === selectedStoryGroupId) ?? null
        : null,
    [selectedStoryGroupId, storyGroups],
  );

  const selectedStory = useMemo(
    () =>
      selectedStoryId
        ? selectedStoryGroup?.stories.find((s) => s.id === selectedStoryId) ??
          storyItems.find((s) => s.id === selectedStoryId) ??
          null
        : null,
    [selectedStoryGroup, selectedStoryId, storyItems],
  );

  const suggestedUsers = useMemo<EnrichedUser[]>(
    () =>
      buildSuggestedUsers({
        suggestedUserIds: agg.suggestedUserIds,
        enrichedAll,
        currentUser,
        currentUserId,
      }),
    [agg.suggestedUserIds, enrichedAll, currentUser, currentUserId],
  );

  const nearbyUsers = useMemo<EnrichedUser[]>(
    () => suggestedUsers.filter((u) => getSharedGymCount(currentUser, u) > 0),
    [suggestedUsers, currentUser],
  );

  const socialStats = useMemo(
    () =>
      buildSocialStats({
        feedPosts: agg.feedPosts,
        stories: agg.stories,
        checkinsToday: agg.checkinsToday,
        currentUser,
      }),
    // `currentUser` muda na mesma cadência de `currentUser.workoutDays` (a
    // memo recria o array a cada mudança), então a dep é equivalente à antiga.
    [agg.feedPosts, agg.stories, agg.checkinsToday, currentUser],
  );

  const chatMessages = useMemo<ChatMessage[]>(
    () =>
      buildChatMessages({
        chatMessages: agg.chatMessages,
        conversationParticipants: agg.conversationParticipants,
        blockedSet,
        currentUserId,
      }),
    [agg.chatMessages, agg.conversationParticipants, blockedSet, currentUserId],
  );

  const chatConversations = useMemo<ChatConversation[]>(
    () =>
      buildChatConversations({
        conversations: agg.conversations,
        conversationParticipants: agg.conversationParticipants,
        conversationUnreadCounts: agg.conversationUnreadCounts,
        chatMessages,
        currentUserId,
      }),
    [
      agg.conversations,
      agg.conversationParticipants,
      agg.conversationUnreadCounts,
      chatMessages,
      currentUserId,
    ],
  );

  // react-hooks/refs: o factory recebe aggRef/mountedRef mas NÃO lê `.current`
  // durante o render — só dentro dos handlers async das ações (igual ao
  // useMemo original, que capturava os refs por closure). Suprimido com escopo.
  /* eslint-disable react-hooks/refs */
  const actions = useMemo<SupabaseSocialActions>(
    () =>
      createSocialActions({
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
      }),
    // Deps granulares MANTIDAS do original (estabilidade referencial do
    // actions). O factory recebe `agg` inteiro mas só estas fatias devem
    // re-memoizar — as closures capturam o mesmo agg que o original capturava.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      services,
      currentUserId,
      profilePosts,
      storyGroups,
      storyItems,
      enrichedAll,
      agg.gyms,
      agg.postComments,
      agg.postCommentLikes,
      agg.profiles,
      refresh,
      refreshChat,
      refreshConversationMessages,
      refreshPostDetails,
      refreshProfilePosts,
      ensureProfilePostsForMonth,
      refreshStoryViewerItems,
      loadMoreFeed,
      showFeedback,
      viewedStoryIds,
    ],
  );
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    if (analyticsBootRef.current || loading || !currentUser.createdAt) return;
    analyticsBootRef.current = true;
    void services.analytics.trackSafe(currentUserId, "app_opened");
    void services.analytics
      .trackDay1RetentionIfEligible(currentUserId, currentUser.createdAt)
      .catch(() => undefined);
  }, [currentUser.createdAt, currentUserId, loading, services.analytics]);

  // Sprint 7 Fase B — bridge de aceite legal pós-signup.
  // LiveAuthGate salva `gc-pending-legal-accept` no localStorage quando
  // o user marca o checkbox e completa signup. Aqui chamamos a RPC
  // accept_alpha_legal() assim que houver session autenticada (o RPC
  // requer auth.uid()). Funciona em ambos os caminhos:
  // 1. Signup → session imediata (próximo render dispara o effect)
  // 2. Signup → email confirm → login (effect dispara depois do confirm)
  // Se a RPC falhar, mantemos a flag pra tentar de novo no próximo boot.
  useEffect(() => {
    if (loading || !currentUser.createdAt) return;
    if (currentUser.alphaTermsAcceptedAt) return;
    if (typeof window === "undefined") return;
    let pending: string | null = null;
    try {
      pending = window.localStorage.getItem("gc-pending-legal-accept");
    } catch {
      return; // localStorage indisponível
    }
    if (pending !== "true") return;
    void services.onboarding
      .acceptAlphaLegal()
      .then(() => {
        try {
          window.localStorage.removeItem("gc-pending-legal-accept");
        } catch {
          // ignore
        }
        void refresh();
      })
      .catch(() => {
        // Mantém flag — retry no próximo boot.
      });
  }, [
    currentUser.alphaTermsAcceptedAt,
    currentUser.createdAt,
    loading,
    refresh,
    services.onboarding,
  ]);

  const unreadNotifications = useMemo(
    () => agg.myNotifications.filter((n) => !n.read_at).length,
    [agg.myNotifications],
  );

  const unreadMessages = useMemo(
    () => {
      if (!chatHydrated) return unreadMessageCount;
      const summaryUnread = Object.values(agg.conversationUnreadCounts).reduce(
        (total, count) => total + count,
        0,
      );
      if (summaryUnread > 0) return summaryUnread;
      const directUnread = chatMessages.filter(
        (message) => message.receiverId === currentUserId && !message.readAt,
      ).length;
      const groupUnread = chatConversations.reduce((total, conversation) => {
        if (conversation.type !== "group") return total;
        const lastRead = conversation.lastReadAt
          ? new Date(conversation.lastReadAt).getTime()
          : 0;
        const unread = chatMessages.filter(
          (message) =>
            message.conversationId === conversation.id &&
            message.senderId !== currentUserId &&
            new Date(message.createdAt).getTime() > lastRead,
        ).length;
        return total + unread;
      }, 0);
      return directUnread + groupUnread;
    },
    [
      agg.conversationUnreadCounts,
      chatConversations,
      chatHydrated,
      chatMessages,
      currentUserId,
      unreadMessageCount,
    ],
  );

  return {
    currentUser,
    users: usersRecord,
    gyms: gymOptions,
    feedPosts,
    feedCheckins,
    feedActivities,
    profilePosts,
    storyBubbles,
    storyGroups,
    selectedStoryGroup,
    selectedStory,
    suggestedUsers,
    nearbyUsers,
    chatMessages,
    chatConversations,
    socialStats,
    feedback,
    formatPostClock,
    actions,
    unreadNotifications,
    unreadMessages,
    homeLoading: loading,
    secondaryLoading,
    chatLoading,
    chatHydrated,
    feedLoadingMore,
    feedHasMore,
    loading,
    error,
    refresh,
    ranking,
    loadRanking,
  };
}

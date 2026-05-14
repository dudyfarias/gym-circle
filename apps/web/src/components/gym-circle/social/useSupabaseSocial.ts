"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import type {
  CheckinRow,
  ConversationParticipantRow,
  DirectMessageRow,
  FeedPostRow,
  FollowRow,
  GymRow,
  NotificationRow,
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
import {
  calculateAgeFromBirthDate,
  isBirthdayFromBirthDate,
} from "./profile";
import { groupStoriesByProfile, sortStoriesNewestFirst } from "./stories";
import {
  buildStoryShareBody,
  countStoryLikes,
  filterMutedStories,
  hasUserLikedStory,
} from "./storyInteractions";
import { buildMonthWorkoutDays } from "./streak";
import type {
  ChatMessage,
  CreateWorkoutPostInput,
  EditPostInput,
  EnrichedPost,
  EnrichedStory,
  EnrichedUser,
  FeedbackMessage,
  FeedbackTone,
  GymLocationOption,
  GymUser,
  ProfileEditInput,
  SendChatMessageInput,
  StoryGroup,
  StreakPresence,
} from "./types";

const ACCENT_PALETTE = [
  "var(--gc-brand)",
  "var(--gc-consistency-month)",
  "var(--gc-blue)",
  "var(--gc-consistency-year)",
  "var(--gc-consistency-daily)",
  "var(--gc-consistency-mid)",
];

function accentForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ACCENT_PALETTE[Math.abs(hash) % ACCENT_PALETTE.length];
}

function deriveAchievements(stats: UserStatsRow | undefined): string[] {
  if (!stats) return [];
  const out: string[] = [];
  if (stats.best_streak >= 30) out.push(`${stats.best_streak}d lendário`);
  else if (stats.best_streak >= 14) out.push(`${stats.best_streak}d elite`);
  else if (stats.best_streak >= 4) out.push(`${stats.best_streak}d consistente`);
  else if (stats.best_streak > 0) out.push(`${stats.best_streak}d`);
  if (stats.workouts_this_month >= 10) out.push("Mês forte");
  if (stats.active_days_this_year >= 30) out.push("Ano ativo");
  if (stats.badge_is_active_today) out.push("Aceso hoje");
  return out.slice(0, 3);
}

function formatPostClock(createdAt: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function getDailyPresenceFromStats(stats: UserStatsRow | undefined): StreakPresence {
  return {
    streakLitToday: stats?.badge_is_active_today ?? false,
    streakPresenceSource: stats?.badge_is_active_today ? "feed-photo" : "none",
  };
}

function getSharedGymCount(a: EnrichedUser, b: EnrichedUser): number {
  return b.gyms.filter((gym) => a.gyms.includes(gym)).length;
}

function getSmartReason(post: FeedPostRow, author: EnrichedUser, currentUser: EnrichedUser): string {
  if (post.user_id === currentUser.id) return "Seu treino";
  if (author.isFollowing) return "Seguindo";
  if (getSharedGymCount(currentUser, author) > 0) return "Mesma academia";
  if ((post.author_current_streak ?? 0) >= 10) return "Streak em alta";
  return "Descoberta";
}

function getSmartScore(
  post: FeedPostRow,
  likesCount: number,
  commentsCount: number,
  author: EnrichedUser,
  currentUser: EnrichedUser,
): number {
  const createdAt = new Date(post.created_at).getTime();
  const recency = createdAt / 100000000000;
  const freshBoost = Date.now() - createdAt < 60000 ? 600 : 0;
  const ownPost = post.user_id === currentUser.id ? 160 : 0;
  const socialAffinity = author.isFollowing ? 80 : 0;
  const sharedGym = getSharedGymCount(currentUser, author) * 26;
  const streak = Math.min((post.author_current_streak ?? 0) * 3, 60);
  const engagement = Math.min(likesCount / 18 + commentsCount * 5, 80);
  return recency + freshBoost + ownPost + socialAffinity + sharedGym + streak + engagement;
}

type AggregateState = {
  profiles: ProfileRow[];
  stats: UserStatsRow[];
  gyms: GymRow[];
  userGyms: UserGymRow[];
  follows: FollowRow[];
  feedPosts: FeedPostRow[];
  stories: StoryRow[];
  storyLikes: StoryLikeRow[];
  storyMutes: StoryMuteRow[];
  storyViews: StoryViewRow[];
  postParticipants: PostParticipantRow[];
  storyParticipants: StoryParticipantRow[];
  postLikes: PostLikeRow[];
  postComments: PostCommentRow[];
  checkinsToday: CheckinRow[];
  myActivityDays: UserActivityDayRow[];
  myNotifications: NotificationRow[];
  conversationParticipants: ConversationParticipantRow[];
  chatMessages: DirectMessageRow[];
  /** IDs que EU bloqueei. Filtramos feed/stories/profiles/comments/messages. */
  blockedUserIds: string[];
  /** IDs cujos posts no feed eu silenciei. Stories continuam aparecendo. */
  mutedPostUserIds: string[];
};

const EMPTY: AggregateState = {
  profiles: [],
  stats: [],
  gyms: [],
  userGyms: [],
  follows: [],
  feedPosts: [],
  stories: [],
  storyLikes: [],
  storyMutes: [],
  storyViews: [],
  postParticipants: [],
  storyParticipants: [],
  postLikes: [],
  postComments: [],
  checkinsToday: [],
  myActivityDays: [],
  myNotifications: [],
  conversationParticipants: [],
  chatMessages: [],
  blockedUserIds: [],
  mutedPostUserIds: [],
};

type OptionalStorySocialTable = "story_likes" | "story_mutes" | "story_views";

function isMissingOptionalStorySocialTable(
  error: unknown,
  table: OptionalStorySocialTable,
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

function optionalStorySocialRows<T>(
  response: { data: T[] | null; error: unknown },
  table: OptionalStorySocialTable,
) {
  if (!response.error) return response.data ?? [];
  if (isMissingOptionalStorySocialTable(response.error, table)) return [];
  throw response.error;
}

const VIEWED_STORIES_STORAGE_PREFIX = "gym-circle:viewed-stories:";
const HIDDEN_DIRECT_CONVERSATIONS_STORAGE_PREFIX =
  "gym-circle:hidden-direct-conversations:";
const MAX_STORED_VIEWED_STORIES = 500;

function getViewedStoriesStorageKey(userId: string) {
  return `${VIEWED_STORIES_STORAGE_PREFIX}${userId}`;
}

function loadStoredViewedStoryIds(userId: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(getViewedStoriesStorageKey(userId)) ?? "[]",
    );
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function persistStoredViewedStoryIds(userId: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  const compact = Array.from(ids).slice(-MAX_STORED_VIEWED_STORIES);
  // iOS Safari Private Mode + alguns ad blockers throwam em
  // localStorage.setItem. Não é crítico — perdemos persistência de
  // "stories vistos" entre sessões, mas o app continua funcionando.
  // Servidor já tem story_views como fonte de verdade.
  try {
    window.localStorage.setItem(
      getViewedStoriesStorageKey(userId),
      JSON.stringify(compact),
    );
  } catch {
    // ignorar — fail-soft
  }
}

function getHiddenDirectConversationsStorageKey(userId: string) {
  return `${HIDDEN_DIRECT_CONVERSATIONS_STORAGE_PREFIX}${userId}`;
}

function loadStoredHiddenDirectConversations(userId: string) {
  if (typeof window === "undefined") return {} as Record<string, string>;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(getHiddenDirectConversationsStorageKey(userId)) ??
        "{}",
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} as Record<string, string>;
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([otherUserId, deletedAt]) =>
          typeof otherUserId === "string" && typeof deletedAt === "string",
      ),
    ) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
}

function persistStoredHiddenDirectConversations(
  userId: string,
  value: Record<string, string>,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getHiddenDirectConversationsStorageKey(userId),
      JSON.stringify(value),
    );
  } catch {
    // Fail-soft: se localStorage estiver bloqueado, o servidor ainda cuida
    // do delete-for-me quando a migration já está aplicada.
  }
}

export type SupabaseSocialActions = {
  likePost: (postId: string) => Promise<void>;
  commentPost: (postId: string, body: string) => Promise<void>;
  toggleFollow: (userId: string) => Promise<void>;
  openStory: (storyId: string) => void;
  closeStory: () => void;
  publishWorkout: (input: CreateWorkoutPostInput) => Promise<void>;
  checkIn: (gymName: string) => Promise<void>;
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
  deletePost: (postId: string) => Promise<void>;
  sendChatMessage: (input: SendChatMessageInput) => Promise<void>;
  markChatThreadRead: (userId: string) => Promise<void>;
  acceptFollowRequest: (requesterId: string) => Promise<void>;
  rejectFollowRequest: (requesterId: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (input: ProfileEditInput) => Promise<void>;
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
  shareStoryToChat: (storyId: string, receiverId: string) => Promise<void>;
  acceptPostTag: (postId: string) => Promise<void>;
  rejectPostTag: (postId: string) => Promise<void>;
  acceptStoryTag: (storyId: string) => Promise<void>;
  rejectStoryTag: (storyId: string) => Promise<void>;
  requestAccountDeletion: (reason?: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

export type SupabaseSocialResult = {
  currentUser: EnrichedUser;
  users: Record<string, GymUser>;
  gyms: GymLocationOption[];
  feedPosts: EnrichedPost[];
  profilePosts: EnrichedPost[];
  storyBubbles: EnrichedStory[];
  storyGroups: StoryGroup[];
  selectedStoryGroup: StoryGroup | null;
  selectedStory: EnrichedStory | null;
  suggestedUsers: EnrichedUser[];
  nearbyUsers: EnrichedUser[];
  chatMessages: ChatMessage[];
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
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

export function useSupabaseSocial(currentUserId: string): SupabaseSocialResult {
  const services = useGymCircleServices();
  const [agg, setAgg] = useState<AggregateState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [selectedStoryGroupId, setSelectedStoryGroupId] = useState<string | null>(null);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(() =>
    loadStoredViewedStoryIds(currentUserId),
  );
  const [hiddenDirectConversations, setHiddenDirectConversations] = useState<
    Record<string, string>
  >(() => loadStoredHiddenDirectConversations(currentUserId));
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const mountedRef = useRef(true);
  const analyticsBootRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [
        profilesRes,
        statsRes,
        gymsRes,
        userGymsRes,
        followsRes,
        feedRes,
        storiesRes,
        myActivityRes,
        checkinsTodayRes,
        myNotificationsRes,
        conversationParticipantsRes,
        chatMessagesRes,
        blocksRes,
        postMutesRes,
      ] = await Promise.all([
        services.client.from("profiles").select("*"),
        services.client.from("user_stats_live").select("*"),
        services.client.from("gyms").select("*"),
        services.client.from("user_gyms").select("*"),
        services.client.from("follows").select("*"),
        services.client
          .from("feed_posts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
        services.client
          .from("stories")
          .select("*")
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false }),
        services.client
          .from("user_activity_days")
          .select("*")
          .eq("user_id", currentUserId)
          .order("activity_date", { ascending: true }),
        services.client
          .from("checkins")
          .select("*")
          .eq("checkin_date", new Date().toISOString().slice(0, 10)),
        services.client
          .from("notifications")
          .select("*")
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false })
          .limit(50),
        services.client
          .from("conversation_participants")
          .select("*")
          .eq("user_id", currentUserId),
        services.client
          .from("direct_messages")
          .select("*")
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
          .order("created_at", { ascending: true })
          .limit(200),
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
        profilesRes,
        statsRes,
        gymsRes,
        userGymsRes,
        followsRes,
        feedRes,
        storiesRes,
        myActivityRes,
        checkinsTodayRes,
        myNotificationsRes,
        conversationParticipantsRes,
        chatMessagesRes,
        blocksRes,
        postMutesRes,
      ]) {
        if (r.error) throw r.error;
      }

      const feedPosts = (feedRes.data ?? []) as FeedPostRow[];
      const postIds = feedPosts.map((p) => p.id);
      const stories = (storiesRes.data ?? []) as StoryRow[];
      const storyIds = stories.map((story) => story.id);
      const [
        likesRes,
        commentsRes,
        storyLikesRes,
        storyMutesRes,
        storyViewsRes,
        postParticipants,
        storyParticipants,
      ] = await Promise.all([
        postIds.length > 0
          ? services.client.from("post_likes").select("*").in("post_id", postIds)
          : Promise.resolve({ data: [] as PostLikeRow[], error: null }),
        postIds.length > 0
          ? services.client
              .from("post_comments")
              .select("*")
              .in("post_id", postIds)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [] as PostCommentRow[], error: null }),
        storyIds.length > 0
          ? services.client
              .from("story_likes")
              .select("*")
              .in("story_id", storyIds)
          : Promise.resolve({ data: [] as StoryLikeRow[], error: null }),
        services.client
          .from("story_mutes")
          .select("*")
          .eq("user_id", currentUserId),
        storyIds.length > 0
          ? services.client
              .from("story_views")
              .select("*")
              .eq("user_id", currentUserId)
              .in("story_id", storyIds)
          : Promise.resolve({ data: [] as StoryViewRow[], error: null }),
        services.participants.listPostParticipants(postIds),
        services.participants.listStoryParticipants(storyIds),
      ]);
      if (likesRes.error) throw likesRes.error;
      if (commentsRes.error) throw commentsRes.error;
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

      if (!mountedRef.current) return;
      const nextViewedStoryIds = loadStoredViewedStoryIds(currentUserId);
      for (const view of storyViews) nextViewedStoryIds.add(view.story_id);
      persistStoredViewedStoryIds(currentUserId, nextViewedStoryIds);
      setViewedStoryIds(nextViewedStoryIds);
      const blockedUserIds = ((blocksRes.data ?? []) as Array<{ blocked_id: string }>)
        .map((row) => row.blocked_id);
      const mutedPostUserIds = (
        (postMutesRes.data ?? []) as Array<{ muted_user_id: string }>
      ).map((row) => row.muted_user_id);
      setAgg({
        profiles: (profilesRes.data ?? []) as ProfileRow[],
        stats: (statsRes.data ?? []) as UserStatsRow[],
        gyms: (gymsRes.data ?? []) as GymRow[],
        userGyms: (userGymsRes.data ?? []) as UserGymRow[],
        follows: (followsRes.data ?? []) as FollowRow[],
        feedPosts,
        stories,
        storyLikes,
        storyMutes,
        storyViews,
        postParticipants,
        storyParticipants,
        postLikes: (likesRes.data ?? []) as PostLikeRow[],
        postComments: (commentsRes.data ?? []) as PostCommentRow[],
        checkinsToday: (checkinsTodayRes.data ?? []) as CheckinRow[],
        myActivityDays: (myActivityRes.data ?? []) as UserActivityDayRow[],
        myNotifications: (myNotificationsRes.data ?? []) as NotificationRow[],
        conversationParticipants: (conversationParticipantsRes.data ??
          []) as ConversationParticipantRow[],
        chatMessages: (chatMessagesRes.data ?? []) as DirectMessageRow[],
        blockedUserIds,
        mutedPostUserIds,
      });
      setError(null);
    } catch (err) {
      if (mountedRef.current) setError(err as Error);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [services, currentUserId]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refresh();
    }, 220);
  }, [refresh]);

  useEffect(() => {
    mountedRef.current = true;
    const refreshId = window.setTimeout(() => {
      void refresh();
    }, 0);
    const channel = services.client
      .channel("supabase-social")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "story_likes" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "story_mutes" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_participants" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "story_participants" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_mutes" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "follows" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "checkins" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_stats" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants" }, scheduleRefresh)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        scheduleRefresh,
      )
      .subscribe();
    return () => {
      window.clearTimeout(refreshId);
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      mountedRef.current = false;
      services.client.removeChannel(channel);
    };
  }, [services, refresh, scheduleRefresh, currentUserId]);

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

  const enrichedAll = useMemo(() => {
    const statsByUser = new Map(agg.stats.map((s) => [s.user_id, s]));
    const gymsById = new Map(agg.gyms.map((g) => [g.id, g]));
    const userGymsByUser = new Map<string, UserGymRow[]>();
    for (const ug of agg.userGyms) {
      const list = userGymsByUser.get(ug.user_id) ?? [];
      list.push(ug);
      userGymsByUser.set(ug.user_id, list);
    }
    // Counts só consideram relações aceitas. Pending fica fora.
    const followersCountByUser = new Map<string, number>();
    const followingCountByUser = new Map<string, number>();
    for (const f of agg.follows) {
      if (f.status !== "accepted") continue;
      followersCountByUser.set(f.following_id, (followersCountByUser.get(f.following_id) ?? 0) + 1);
      followingCountByUser.set(f.follower_id, (followingCountByUser.get(f.follower_id) ?? 0) + 1);
    }
    // Para o usuário atual: mapa user_id → status do follow que parto pra esse user.
    const myFollowStatusByTarget = new Map<string, "pending" | "accepted">();
    for (const f of agg.follows) {
      if (f.follower_id === currentUserId) {
        myFollowStatusByTarget.set(f.following_id, f.status);
      }
    }
    const checkinsCountByUser = new Map<string, number>();
    for (const c of agg.checkinsToday) {
      checkinsCountByUser.set(c.user_id, (checkinsCountByUser.get(c.user_id) ?? 0) + 1);
    }
    const myActivityDates = new Set(agg.myActivityDays.map((d) => d.activity_date));

    const map = new Map<string, EnrichedUser>();
    for (const profile of agg.profiles) {
      // Bloqueio mútuo: o app de A não vê B, e o app de B não vê A.
      // Eu mantenho o próprio usuário fora dessa filtragem (preciso me
      // ver pra saber meu badge/streak).
      if (
        profile.user_id !== currentUserId &&
        blockedSet.has(profile.user_id)
      ) {
        continue;
      }
      const stats = statsByUser.get(profile.user_id);
      const birthDate = profile.birth_date ?? null;
      const userGyms = userGymsByUser.get(profile.user_id) ?? [];
      const gymNames = userGyms
        .map((ug) => gymsById.get(ug.gym_id)?.name)
        .filter((n): n is string => Boolean(n));
      const mainUserGym = userGyms.find((ug) => ug.is_main);
      const preferredTimes =
        profile.preferred_training_times?.length
          ? profile.preferred_training_times
          : mainUserGym?.preferred_times ?? [];
      const followStatus =
        myFollowStatusByTarget.get(profile.user_id) ?? "none";
      const enriched: EnrichedUser = {
        id: profile.user_id,
        createdAt: profile.created_at,
        name: profile.display_name,
        username: profile.username,
        accent: accentForId(profile.user_id),
        avatarUrl: profile.avatar_url ?? null,
        bio: profile.bio ?? "",
        goal: profile.fitness_goal ?? "",
        instagramUsername: profile.instagram_username ?? null,
        birthDate,
        age: calculateAgeFromBirthDate(birthDate),
        isBirthday: isBirthdayFromBirthDate(birthDate),
        sports: profile.sports ?? [],
        onboardingCompletedAt: profile.onboarding_completed_at ?? null,
        alphaTermsAcceptedAt: profile.alpha_terms_accepted_at ?? null,
        privacyPolicyAcceptedAt: profile.privacy_policy_accepted_at ?? null,
        accountStatus: profile.account_status ?? "active",
        location: gymsById.get(profile.main_gym_id ?? "")?.city ?? "",
        gyms: gymNames,
        preferredTimes,
        currentStreak: stats?.current_streak ?? 0,
        longestStreak: stats?.best_streak ?? 0,
        lastWorkoutDate: stats?.last_active_date ?? "",
        workoutsThisMonth: stats?.workouts_this_month ?? 0,
        activeDaysCount: stats?.active_days_this_year ?? 0,
        checkInsCount: profile.user_id === currentUserId ? agg.myActivityDays.length : 0,
        achievements: deriveAchievements(stats),
        followersCount: followersCountByUser.get(profile.user_id) ?? 0,
        followingCount: followingCountByUser.get(profile.user_id) ?? 0,
        isFollowing: followStatus === "accepted",
        followStatus,
        isPrivate: profile.is_private ?? false,
        workoutDays: profile.user_id === currentUserId ? Array.from(myActivityDates) : [],
        ...getDailyPresenceFromStats(stats),
      };
      map.set(profile.user_id, enriched);
    }
    return map;
  }, [agg, currentUserId, blockedSet]);

  const currentUser = useMemo<EnrichedUser>(() => {
    return (
      enrichedAll.get(currentUserId) ?? {
        id: currentUserId,
        createdAt: undefined,
        name: "—",
        username: "—",
        accent: "var(--gc-brand)",
        avatarUrl: null,
        bio: "",
        goal: "",
        instagramUsername: null,
        birthDate: null,
        age: null,
        isBirthday: false,
        sports: [],
        onboardingCompletedAt: null,
        alphaTermsAcceptedAt: null,
        privacyPolicyAcceptedAt: null,
        accountStatus: "active",
        location: "",
        gyms: [],
        preferredTimes: [],
        currentStreak: 0,
        longestStreak: 0,
        lastWorkoutDate: "",
        workoutsThisMonth: 0,
        activeDaysCount: 0,
        checkInsCount: 0,
        achievements: [],
        followersCount: 0,
        followingCount: 0,
        isFollowing: false,
        followStatus: "none",
        isPrivate: false,
        workoutDays: [],
        streakLitToday: false,
        streakPresenceSource: "none",
      }
    );
  }, [enrichedAll, currentUserId]);

  const usersRecord = useMemo<Record<string, GymUser>>(() => {
    const record: Record<string, GymUser> = {};
    enrichedAll.forEach((user, id) => {
      record[id] = user;
    });
    return record;
  }, [enrichedAll]);

  const gymOptions = useMemo<GymLocationOption[]>(
    () =>
      agg.gyms.map((gym) => ({
        id: gym.id,
        name: gym.name,
        address: gym.address,
        city: gym.city,
        state: gym.state,
        latitude: gym.latitude,
        longitude: gym.longitude,
      })),
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

  const profilePosts = useMemo<EnrichedPost[]>(() => {
    if (!agg.feedPosts.length) return [];
    const myLikedSet = new Set(
      agg.postLikes.filter((l) => l.user_id === currentUserId).map((l) => l.post_id),
    );
    const commentsByPost = new Map<string, PostCommentRow[]>();
    for (const c of agg.postComments) {
      const list = commentsByPost.get(c.post_id) ?? [];
      list.push(c);
      commentsByPost.set(c.post_id, list);
    }
    const likesByPost = new Map<string, PostLikeRow[]>();
    for (const l of agg.postLikes) {
      const list = likesByPost.get(l.post_id) ?? [];
      list.push(l);
      likesByPost.set(l.post_id, list);
    }

    return agg.feedPosts
      // Histórico de perfil usa tudo que a RLS/view deixa o usuário ver.
      // O home feed continua filtrado abaixo para seguir-only.
      .filter((row) => {
        if (row.user_id === currentUserId) return true;
        if (blockedSet.has(row.user_id)) return false;
        return Boolean(enrichedAll.get(row.user_id));
      })
      .map((row) => {
        const author = enrichedAll.get(row.user_id) ?? currentUser;
        const likesCount = row.likes_count ?? 0;
        const postComments = commentsByPost.get(row.id) ?? [];
        const latestCommentPreviews = postComments.slice(-2);
        const ownOlderPreview = [...postComments]
          .reverse()
          .find(
            (comment) =>
              comment.user_id === currentUserId &&
              !latestCommentPreviews.some((preview) => preview.id === comment.id),
          );
        const commentPreviews = (ownOlderPreview
          ? [ownOlderPreview, ...latestCommentPreviews]
          : latestCommentPreviews
        ).map((c) => ({
          id: c.id,
          postId: c.post_id,
          userId: c.user_id,
          body: c.body,
          createdAt: c.created_at,
          author: enrichedAll.get(c.user_id) ?? author,
        }));
        const likedByPreview = (likesByPost.get(row.id) ?? [])
          .map((l) => enrichedAll.get(l.user_id))
          .filter((u): u is EnrichedUser => Boolean(u))
          .slice(0, row.user_id === currentUserId ? 3 : 0);
        const participantRows = postParticipantsByPost.get(row.id) ?? [];
        const participants = participantRows.map((participant) => ({
          id: participant.id,
          targetId: participant.post_id,
          taggedUserId: participant.tagged_user_id,
          taggedByUserId: participant.tagged_by_user_id,
          status: participant.status as "pending" | "accepted" | "rejected",
          acceptedAt: participant.accepted_at,
          rejectedAt: participant.rejected_at,
          createdAt: participant.created_at,
        }));
        const acceptedParticipants = participantRows
          .filter((participant) => participant.status === "accepted")
          .map((participant) => enrichedAll.get(participant.tagged_user_id))
          .filter((user): user is EnrichedUser => Boolean(user));
        const pendingParticipants =
          row.user_id === currentUserId
            ? participantRows
                .filter((participant) => participant.status === "pending")
                .map((participant) => enrichedAll.get(participant.tagged_user_id))
                .filter((user): user is EnrichedUser => Boolean(user))
            : [];
        const smartScore = getSmartScore(
          row,
          likesCount,
          row.comments_count ?? 0,
          author,
          currentUser,
        );
        return {
          id: row.id,
          userId: row.user_id,
          imageUrl: row.image_url,
          mediaType: row.media_type ?? "image",
          caption: row.caption ?? "",
          workoutType: row.workout_type ?? null,
          gymName: row.location_name ?? agg.gyms.find((g) => g.id === row.gym_id)?.name ?? "",
          gymId: row.gym_id ?? "",
          locationSource: row.location_source ?? "none",
          locationName: row.location_name ?? null,
          locationLatitude: row.location_latitude ?? null,
          locationLongitude: row.location_longitude ?? null,
          locationGoogleMapsUrl: row.location_google_maps_url ?? null,
          createdAt: row.created_at,
          workoutDate: row.workout_date,
          isWorkoutPost: true as const,
          streakAtPost: row.author_current_streak ?? 0,
          likesCount,
          likedByCurrentUser: myLikedSet.has(row.id),
          comments: postComments.map((c) => ({
            id: c.id,
            postId: c.post_id,
            userId: c.user_id,
            body: c.body,
            createdAt: c.created_at,
          })),
          author,
          commentPreviews,
          likedByPreview,
          participants,
          acceptedParticipants,
          pendingParticipants,
          smartScore,
          smartReason: getSmartReason(row, author, currentUser),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [agg, enrichedAll, currentUser, currentUserId, blockedSet, postParticipantsByPost]);

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

  const storyItems = useMemo<EnrichedStory[]>(() => {
    const out: EnrichedStory[] = [];
    const viewedSet = new Set(viewedStoryIds);
    for (const view of agg.storyViews) viewedSet.add(view.story_id);
    const visibleStories = filterMutedStories(
      agg.stories.map((story) => ({ ...story, userId: story.user_id })),
      agg.storyMutes.map((mute) => ({ mutedUserId: mute.muted_user_id })),
    );
    for (const row of visibleStories) {
      const author = enrichedAll.get(row.user_id);
      if (!author) continue;
      const participantRows = storyParticipantsByStory.get(row.id) ?? [];
      const acceptedForCurrentUser = participantRows.some(
        (participant) =>
          participant.status === "accepted" && participant.tagged_user_id === currentUserId,
      );
      if (
        row.user_id !== currentUserId &&
        author.followStatus !== "accepted" &&
        !acceptedForCurrentUser
      ) {
        continue;
      }
      const participants = participantRows.map((participant) => ({
        id: participant.id,
        targetId: participant.story_id,
        taggedUserId: participant.tagged_user_id,
        taggedByUserId: participant.tagged_by_user_id,
        status: participant.status as "pending" | "accepted" | "rejected",
        acceptedAt: participant.accepted_at,
        rejectedAt: participant.rejected_at,
        createdAt: participant.created_at,
      }));
      const acceptedParticipants = participantRows
        .filter((participant) => participant.status === "accepted")
        .map((participant) => enrichedAll.get(participant.tagged_user_id))
        .filter((user): user is EnrichedUser => Boolean(user));
      const pendingParticipants =
        row.user_id === currentUserId
          ? participantRows
              .filter((participant) => participant.status === "pending")
              .map((participant) => enrichedAll.get(participant.tagged_user_id))
              .filter((user): user is EnrichedUser => Boolean(user))
          : [];
      out.push({
        id: row.id,
        userId: row.user_id,
        imageUrl: row.media_url,
        mediaType: row.media_type ?? "image",
        title: row.workout_type ?? "Treino",
        caption: `${author.currentStreak}d · ${author.gyms[0] ?? ""}`,
        createdAt: row.created_at,
        viewed: viewedSet.has(row.id),
        likedByCurrentUser: hasUserLikedStory(
          agg.storyLikes.map((like) => ({
            storyId: like.story_id,
            userId: like.user_id,
          })),
          row.id,
          currentUserId,
        ),
        likesCount: countStoryLikes(
          agg.storyLikes.map((like) => ({
            storyId: like.story_id,
            userId: like.user_id,
          })),
          row.id,
        ),
        kind: "workout",
        participants,
        acceptedParticipants,
        pendingParticipants,
        author,
      });
    }
    return sortStoriesNewestFirst(out);
  }, [
    agg.stories,
    agg.storyLikes,
    agg.storyMutes,
    agg.storyViews,
    currentUserId,
    enrichedAll,
    storyParticipantsByStory,
    viewedStoryIds,
  ]);

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

  const suggestedUsers = useMemo<EnrichedUser[]>(() => {
    const list: EnrichedUser[] = [];
    enrichedAll.forEach((u) => {
      if (u.id !== currentUserId) list.push(u);
    });
    return list.sort((a, b) => {
      const aScore =
        getSharedGymCount(currentUser, a) * 10 +
        (a.streakLitToday ? 5 : 0) +
        a.currentStreak;
      const bScore =
        getSharedGymCount(currentUser, b) * 10 +
        (b.streakLitToday ? 5 : 0) +
        b.currentStreak;
      return bScore - aScore;
    });
  }, [enrichedAll, currentUser, currentUserId]);

  const nearbyUsers = useMemo<EnrichedUser[]>(
    () => suggestedUsers.filter((u) => getSharedGymCount(currentUser, u) > 0),
    [suggestedUsers, currentUser],
  );

  const socialStats = useMemo(
    () => ({
      trainedToday: new Set(
        [
          ...agg.feedPosts
            .filter((p) => p.workout_date === new Date().toISOString().slice(0, 10))
            .map((p) => p.user_id),
          ...agg.stories
            .filter((story) => story.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10))
            .map((story) => story.user_id),
        ],
      ).size,
      checkInsToday: agg.checkinsToday.length,
      monthDays: buildMonthWorkoutDays(currentUser.workoutDays),
    }),
    [agg.feedPosts, agg.stories, agg.checkinsToday, currentUser.workoutDays],
  );

  const chatMessages = useMemo<ChatMessage[]>(() => {
    const deletedByConversation = new Map(
      agg.conversationParticipants
        .filter((participant) => Boolean(participant.deleted_at))
        .map((participant) => [
          participant.conversation_id,
          new Date(participant.deleted_at as string).getTime(),
        ]),
    );

    return agg.chatMessages
      // Mensagens de/para usuários bloqueados não aparecem no chat.
      // Eu também não consigo enviar — RPC do server bloqueia (já tratado
      // em outros lugares por RLS de safety/messages). Aqui só hide UI.
      .filter((message) => {
        if (blockedSet.has(message.sender_id) || blockedSet.has(message.receiver_id)) {
          return false;
        }
        const deletedAt = message.conversation_id
          ? deletedByConversation.get(message.conversation_id)
          : null;
        const otherUserId =
          message.sender_id === currentUserId ? message.receiver_id : message.sender_id;
        const locallyDeletedAt = hiddenDirectConversations[otherUserId]
          ? new Date(hiddenDirectConversations[otherUserId]).getTime()
          : null;
        const effectiveDeletedAt = Math.max(deletedAt ?? 0, locallyDeletedAt ?? 0);
        return !effectiveDeletedAt || new Date(message.created_at).getTime() > effectiveDeletedAt;
      })
      .map((message) => ({
          id: message.id,
          conversationId: message.conversation_id,
          senderId: message.sender_id,
          receiverId: message.receiver_id,
          body: message.body,
          mediaUrl: message.media_url,
          mediaType: message.media_type,
          storyId: message.story_id,
          replyToStory: message.reply_to_story,
          storyPreviewUrl: message.story_preview_url,
          createdAt: message.created_at,
          readAt: message.read_at,
        }));
  }, [
    agg.chatMessages,
    agg.conversationParticipants,
    blockedSet,
    currentUserId,
    hiddenDirectConversations,
  ]);

  const actions = useMemo<SupabaseSocialActions>(
    () => ({
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
      async commentPost(postId: string, body: string) {
        await services.posts.comment(postId, currentUserId, body);
        showFeedback("comment", "Comentário publicado");
      },
      async deleteComment(postId: string, commentId: string) {
        const wasMine = agg.postComments.some(
          (comment) => comment.id === commentId && comment.user_id === currentUserId,
        );
        if (!wasMine) return;

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
          await refresh();
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
      },
      openStory(storyId: string) {
        const group =
          storyGroups.find((item) => item.id === storyId) ??
          storyGroups.find((item) => item.stories.some((story) => story.id === storyId)) ??
          null;
        const story =
          group?.stories.find((item) => !item.viewed) ??
          group?.stories.find((item) => item.id === storyId) ??
          storyItems.find((item) => item.id === storyId) ??
          null;
        if (!story) return;
        const nextStoryId = story.id;
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
        setSelectedStoryGroupId(group?.id ?? story.author.id);
        setSelectedStoryId(nextStoryId);
        simulateHaptic("brand");
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
        await refresh();
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
            await refresh();
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
          await refresh();
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
        await refresh();
        showFeedback("comment", "Story enviado", receiver.name);
      },
      async publishWorkout(input: CreateWorkoutPostInput) {
        const destinations = input.destinations ?? { feed: true, story: true };
        const wantsFeed = destinations.feed;
        const wantsStory = destinations.story;
        if (!wantsFeed && !wantsStory) {
          showFeedback("brand", "Escolha onde postar", "Feed, Story, ou ambos");
          return;
        }

        const taggedUserIds = input.taggedUserIds ?? [];

        if (wantsFeed) {
          const post = await services.posts.create(currentUserId, {
            imageUrl: input.imageUrl,
            mediaType: input.mediaType,
            caption: input.caption,
            gymId: input.gymId ?? null,
            workoutType: input.workoutType ?? null,
            locationSource: input.locationSource ?? "none",
            locationName: input.locationName ?? null,
            locationLatitude: input.locationLatitude ?? null,
            locationLongitude: input.locationLongitude ?? null,
            locationGoogleMapsUrl: input.locationGoogleMapsUrl ?? null,
          });
          await services.participants.createPostTags(post.id, currentUserId, taggedUserIds);
        }

        if (wantsStory) {
          const story = await services.stories.create(currentUserId, {
            mediaUrl: input.imageUrl,
            mediaType: input.mediaType,
            gymId: input.gymId ?? null,
            workoutType: input.workoutType ?? null,
          });
          await services.participants.createStoryTags(story.id, currentUserId, taggedUserIds);
        }

        await services.stats.refreshMine();
        await refresh();

        const detail = wantsFeed && wantsStory
          ? "Feed + story atualizados"
          : wantsFeed
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
        showFeedback("brand", "Check-in ativo", gymName);
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
        const patch: { caption?: string | null; workout_type?: string | null } = {};
        if (input.caption !== undefined) patch.caption = input.caption;
        if (input.workoutType !== undefined) patch.workout_type = input.workoutType;
        await services.posts.update(postId, patch);
        await refresh();
        showFeedback("success", "Post atualizado");
      },
      async deletePost(postId: string) {
        await services.posts.remove(postId);
        await refresh();
        showFeedback("success", "Post apagado");
      },
      async sendChatMessage(input: SendChatMessageInput) {
        await services.messages.sendDirect(currentUserId, {
          receiverId: input.receiverId,
          body: input.body,
          mediaUrl: input.mediaUrl,
          mediaType: input.mediaType,
          storyId: input.storyId,
          replyToStory: input.replyToStory,
          storyPreviewUrl: input.storyPreviewUrl,
        });
        await refresh();
        showFeedback("comment", input.mediaUrl ? "Mídia enviada" : "Mensagem enviada");
      },
      async markChatThreadRead(userId: string) {
        void services.analytics.trackSafe(currentUserId, "conversation_opened", {
          other_user_id: userId,
        });
        await services.messages.markDirectRead(currentUserId, userId);
        await refresh();
      },
      async deleteChatConversation(userId: string) {
        const target = enrichedAll.get(userId);
        const now = new Date().toISOString();
        const isThreadMessage = (message: DirectMessageRow) =>
          (message.sender_id === currentUserId && message.receiver_id === userId) ||
          (message.sender_id === userId && message.receiver_id === currentUserId);
        const conversationId = agg.chatMessages.find(isThreadMessage)?.conversation_id ?? null;

        setHiddenDirectConversations((current) => {
          const next = { ...current, [userId]: now };
          persistStoredHiddenDirectConversations(currentUserId, next);
          return next;
        });
        setAgg((current) => ({
          ...current,
          chatMessages: current.chatMessages.filter((message) => !isThreadMessage(message)),
          conversationParticipants: conversationId
            ? current.conversationParticipants.map((participant) =>
                participant.conversation_id === conversationId &&
                participant.user_id === currentUserId
                  ? { ...participant, deleted_at: now, last_read_at: now }
                  : participant,
              )
            : current.conversationParticipants,
        }));

        try {
          await services.messages.deleteConversationForMe(currentUserId, userId);
          showFeedback("success", "Conversa apagada", target?.name);
          await refresh();
        } catch {
          showFeedback("success", "Conversa apagada", target?.name);
        }
      },
      async signOut() {
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
        await services.profiles.update(currentUserId, {
          ...patch,
        });
        if (input.mainGymId) {
          await services.gyms.addUserGym(currentUserId, input.mainGymId, true).catch((err) => {
            if ((err as { code?: string }).code !== "23505") throw err;
          });
        }
        await refresh();
        showFeedback("success", "Perfil atualizado");
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
      async completeOnboarding() {
        await services.onboarding.markComplete();
        await refresh();
        showFeedback("success", "Perfil pronto para alpha");
      },
    }),
    [
      services,
      currentUserId,
      profilePosts,
      storyGroups,
      storyItems,
      enrichedAll,
      agg.gyms,
      agg.postComments,
      agg.chatMessages,
      refresh,
      showFeedback,
    ],
  );

  useEffect(() => {
    if (analyticsBootRef.current || loading || !currentUser.createdAt) return;
    analyticsBootRef.current = true;
    void services.analytics.trackSafe(currentUserId, "app_opened");
    void services.analytics
      .trackDay1RetentionIfEligible(currentUserId, currentUser.createdAt)
      .catch(() => undefined);
  }, [currentUser.createdAt, currentUserId, loading, services.analytics]);

  const unreadNotifications = useMemo(
    () => agg.myNotifications.filter((n) => !n.read_at).length,
    [agg.myNotifications],
  );

  const unreadMessages = useMemo(
    () => chatMessages.filter((message) => message.receiverId === currentUserId && !message.readAt).length,
    [chatMessages, currentUserId],
  );

  return {
    currentUser,
    users: usersRecord,
    gyms: gymOptions,
    feedPosts,
    profilePosts,
    storyBubbles,
    storyGroups,
    selectedStoryGroup,
    selectedStory,
    suggestedUsers,
    nearbyUsers,
    chatMessages,
    socialStats,
    feedback,
    formatPostClock,
    actions,
    unreadNotifications,
    unreadMessages,
    loading,
    error,
    refresh,
  };
}

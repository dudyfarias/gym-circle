"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SOCIAL_BELL_NOTIFICATION_KINDS } from "@gym-circle/core";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import type {
  CheckinRow,
  ConversationParticipantRow,
  ConversationRow,
  DirectMessageRow,
  FeedPostRow,
  FollowRow,
  GymRow,
  NotificationRow,
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
import { clearImageCache } from "../design-system/imageCache";
import {
  clearNativeFeelCaches,
  nativeCacheKeys,
  nativeCacheTtl,
  readNativeCache,
  writeNativeCache,
} from "../native/LocalAppCache";
import { PushNotificationsService } from "../native/PushNotificationsService";
import { markPerf, measurePerf } from "../performance";
import {
  calculateAgeFromBirthDate,
  isBirthdayFromBirthDate,
} from "./profile";
import {
  mergeProfileRows,
  profileRowFromPartial,
  profileRowFromSurface,
} from "./profileRows";
import { groupStoriesByProfile, sortStoriesNewestFirst } from "./stories";
import {
  buildStoryShareBody,
  countStoryLikes,
  filterMutedStories,
  hasUserLikedStory,
} from "./storyInteractions";
import { buildMonthWorkoutDays, calculateWorkoutStats } from "./streak";
import type {
  ChatMessage,
  ChatConversation,
  CreateWorkoutPostInput,
  EditPostInput,
  EnrichedPost,
  EnrichedStory,
  EnrichedUser,
  FeedbackMessage,
  FeedbackTone,
  FollowActionResult,
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
  // Sprint 3 — Fase 3.2: removida razão visual "Mesma academia" (feed mais
  // social). O sinal continua existindo no `getSmartScore` abaixo via
  // `getSharedGymCount * 26`, então quem treina na mesma academia continua
  // sendo melhor candidato a aparecer no topo do feed.
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
  profileFeedPosts: FeedPostRow[];
  storyTrayRows: StoryTrayRow[];
  stories: StoryRow[];
  storyLikes: StoryLikeRow[];
  storyMutes: StoryMuteRow[];
  storyViews: StoryViewRow[];
  postParticipants: PostParticipantRow[];
  storyParticipants: StoryParticipantRow[];
  postLikes: PostLikeRow[];
  postCommentLikes: PostCommentLikeRow[];
  postComments: PostCommentRow[];
  checkinsToday: CheckinRow[];
  myActivityDays: UserActivityDayRow[];
  myNotifications: NotificationRow[];
  conversationParticipants: ConversationParticipantRow[];
  conversations: ConversationRow[];
  conversationUnreadCounts: Record<string, number>;
  chatMessages: DirectMessageRow[];
  suggestedUserIds: string[];
  /** IDs que EU bloqueei. Filtramos feed/stories/profiles/comments/messages. */
  blockedUserIds: string[];
  /** IDs cujos posts no feed eu silenciei. Stories continuam aparecendo. */
  mutedPostUserIds: string[];
  /**
   * Sprint 3.6.3: dados "ricos" de profiles que foram VISITADOS via
   * ProfileSheet. O carregamento inicial (`refreshHomeCritical`) só
   * consulta `user_stats_live`/`user_activity_days` pro currentUserId e
   * `follows` envolvendo o currentUserId — então outros users do feed só
   * têm partial stats (`workouts_this_month=0`/`active_days_this_year=0`
   * hardcoded em `statsRowFromSurface`) e seus `followersCount` /
   * `followingCount` derivados do `agg.follows` ficam errados (refletem
   * apenas conexões com o currentUser). Quando o user abre o
   * `ProfileSheet` de outro user, `refreshProfilePosts` faz queries
   * dedicadas e popula este map com os números reais. O `enrichedAll`
   * prefere esses valores quando existem.
   */
  profileExtras: Record<string, ProfileExtras>;
};

type ProfileExtras = {
  /** Total real de followers (count em follows WHERE following_id=user). */
  followersCount: number;
  /** Total real de following (count em follows WHERE follower_id=user). */
  followingCount: number;
  /** Derivado de user_activity_days desse user (Mon→Sun ISO). */
  workoutsThisWeek: number;
};

const EMPTY: AggregateState = {
  profiles: [],
  stats: [],
  gyms: [],
  userGyms: [],
  follows: [],
  feedPosts: [],
  profileFeedPosts: [],
  storyTrayRows: [],
  stories: [],
  storyLikes: [],
  storyMutes: [],
  storyViews: [],
  postParticipants: [],
  storyParticipants: [],
  postLikes: [],
  postCommentLikes: [],
  postComments: [],
  checkinsToday: [],
  myActivityDays: [],
  myNotifications: [],
  conversationParticipants: [],
  conversations: [],
  conversationUnreadCounts: {},
  chatMessages: [],
  suggestedUserIds: [],
  blockedUserIds: [],
  mutedPostUserIds: [],
  profileExtras: {},
};

type HomeNativeCache = Pick<
  AggregateState,
  "feedPosts" | "profiles" | "stats" | "stories" | "storyTrayRows"
>;

type StoryTrayNativeCache = Pick<
  AggregateState,
  "profiles" | "stats" | "stories" | "storyTrayRows"
>;

function loadNativeHomeCache(userId: string): AggregateState {
  const cachedHome = readNativeCache<HomeNativeCache>(nativeCacheKeys.home(userId));
  const cachedStoryTray = readNativeCache<StoryTrayNativeCache>(
    nativeCacheKeys.storyTray(userId),
  );
  const cachedOwnProfile = readNativeCache<ProfileRow>(
    nativeCacheKeys.ownProfile(userId),
  );
  if (!cachedHome && !cachedStoryTray && !cachedOwnProfile) return EMPTY;
  return {
    ...EMPTY,
    ...(cachedHome ?? {}),
    ...(cachedStoryTray ?? {}),
    profiles: mergeProfileRows(
      mergeProfileRows(cachedHome?.profiles ?? [], cachedStoryTray?.profiles ?? []),
      cachedOwnProfile ? [cachedOwnProfile] : [],
    ),
    stats: mergeRowsByKey(
      cachedHome?.stats ?? [],
      cachedStoryTray?.stats ?? [],
      (stats) => stats.user_id,
    ),
  };
}

function writeNativeHomeCache(userId: string, state: HomeNativeCache) {
  writeNativeCache(nativeCacheKeys.home(userId), state, nativeCacheTtl.feedMs);
}

function writeNativeStoryTrayCache(userId: string, state: StoryTrayNativeCache) {
  writeNativeCache(nativeCacheKeys.storyTray(userId), state, nativeCacheTtl.storyTrayMs);
}

function writeNativeOwnProfileCache(userId: string, profile: ProfileRow) {
  writeNativeCache(
    nativeCacheKeys.ownProfile(userId),
    profile,
    nativeCacheTtl.ownProfileMs,
  );
}

function findDirectConversationId(
  state: AggregateState,
  currentUserId: string,
  otherUserId: string,
) {
  const directConversation = state.conversations.find((conversation) => {
    if (conversation.type === "group") return false;
    const memberIds = state.conversationParticipants
      .filter((participant) => participant.conversation_id === conversation.id)
      .map((participant) => participant.user_id);
    return memberIds.includes(currentUserId) && memberIds.includes(otherUserId);
  });
  if (directConversation) return directConversation.id;

  return state.chatMessages.find(
    (message) =>
      (message.sender_id === currentUserId && message.receiver_id === otherUserId) ||
      (message.sender_id === otherUserId && message.receiver_id === currentUserId),
  )?.conversation_id ?? null;
}

type OptionalStorySocialTable =
  | "story_likes"
  | "story_mutes"
  | "story_views"
  | "post_comment_likes";

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
const MAX_STORED_VIEWED_STORIES = 500;
const INITIAL_FEED_LIMIT = 30;
const INITIAL_STORY_LIMIT = 40;
type GymCircleSupabaseClient = ReturnType<typeof useGymCircleServices>["client"];

const PROFILE_COLUMNS = [
  "id",
  "user_id",
  "username",
  "display_name",
  "avatar_url",
  "bio",
  "fitness_goal",
  "main_gym_id",
  "preferred_training_times",
  "is_private",
  "created_at",
  "instagram_username",
  "birth_date",
  "sports",
  "onboarding_completed_at",
  "profile_completion_notice_dismissed",
  "alpha_terms_accepted_at",
  "privacy_policy_accepted_at",
  "account_status",
  "suspended_at",
  "reactivation_sent_at",
  "reactivation_expires_at",
  "deleted_at",
].join(",");

const USER_STATS_COLUMNS = [
  "user_id",
  "current_streak",
  "best_streak",
  "workouts_this_month",
  "active_days_this_year",
  "last_active_date",
  "badge_is_active_today",
  "streak_restores_available",
  "last_streak_restore_used_at",
  "last_streak_restore_earned_at",
  "streak_restore_deadline_at",
  "streak_restore_missed_date",
  "streak_restore_status",
  "updated_at",
].join(",");

const FOLLOW_COLUMNS = "follower_id,following_id,status,created_at";

type MediaMetadata = {
  thumbnail_url?: string | null;
  poster_url?: string | null;
  media_width?: number | null;
  media_height?: number | null;
  media_duration_seconds?: number | null;
  blur_data_url?: string | null;
};

type SurfacePostRow = FeedPostRow & MediaMetadata & {
  liked_by_me?: boolean | null;
  is_following_author?: boolean | null;
  visibility?: string | null;
};

type StoryTrayRow = MediaMetadata & {
  author_id?: string | null;
  user_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  current_streak?: number | null;
  badge_is_active_today?: boolean | null;
  author_current_streak?: number | null;
  author_badge_active?: boolean | null;
  has_unseen?: boolean | null;
  latest_story_at?: string | null;
  story_count?: number | null;
  first_unseen_story_id?: string | null;
  first_story_id?: string | null;
  id?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  gym_id?: string | null;
  workout_type?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
};

type StoryViewerItemRow = MediaMetadata & {
  story_id: string;
  user_id: string;
  media_url: string;
  media_type?: string | null;
  caption?: string | null;
  gym_id?: string | null;
  workout_type?: string | null;
  location_name?: string | null;
  created_at: string;
  expires_at: string;
  viewer_has_liked?: boolean | null;
  viewer_has_seen?: boolean | null;
};

type DiscoveryProfileRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_private?: boolean | null;
  follow_status?: string | null;
  current_streak?: number | null;
  badge_is_active_today?: boolean | null;
  primary_reason?: string | null;
  mutual_friends_count?: number | null;
  distance_km?: number | null;
  shared_gym_name?: string | null;
};

type ConversationSummaryParticipant = {
  conversation_id?: string | null;
  user_id?: string | null;
  role?: string | null;
  joined_at?: string | null;
  created_at?: string | null;
  last_read_at?: string | null;
  deleted_at?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  account_status?: string | null;
};

type ConversationSummaryRow = {
  conversation_id: string;
  type: string | null;
  name: string | null;
  image_url: string | null;
  last_message_at: string | null;
  role: string | null;
  last_read_at: string | null;
  deleted_at: string | null;
  unread_count: number | null;
  participants: ConversationSummaryParticipant[] | string | null;
  last_message: Partial<DirectMessageRow> | string | null;
};

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value ?? fallback) as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mergeRowsByKey<T>(rows: T[], nextRows: T[], getKey: (row: T) => string): T[] {
  const map = new Map<string, T>();
  for (const row of rows) map.set(getKey(row), row);
  for (const row of nextRows) map.set(getKey(row), row);
  return Array.from(map.values());
}

/**
 * Sprint 3.6.1 bug fix — Merge inteligente entre duas `UserStatsRow` do mesmo
 * `user_id`.
 *
 * Contexto: `statsRowFromSurface` e `statsRowFromDiscovery` retornam stats
 * PARCIAIS com `workouts_this_month: 0` e `active_days_this_year: 0` HARDCODED
 * — a view de surface não traz esses contadores. O `user_stats_live` retorna
 * a row COMPLETA. Quando ambos coexistem (ex: o currentUser aparece tanto no
 * feed surface quanto na query `user_stats_live`), o merge precisa preservar
 * os MAIORES valores e os timestamps mais recentes — nunca deixar um parcial
 * com 0 sobrescrever um valor real positivo.
 *
 * Esta função era inline dentro do `useMemo enrichedAll`. Movida pra
 * top-level pra reuso pelo `mergeStatsArrays` (que aplica isso em todos os
 * 6 `setAgg` que tocam `current.stats`).
 */
function mergeUserStatsRow(
  existing: UserStatsRow,
  incoming: UserStatsRow,
): UserStatsRow {
  return {
    ...existing,
    ...incoming,
    user_id: existing.user_id,
    // Math.max — partials nunca derrubam um contador real pra 0.
    current_streak: Math.max(
      existing.current_streak ?? 0,
      incoming.current_streak ?? 0,
    ),
    best_streak: Math.max(
      existing.best_streak ?? 0,
      incoming.best_streak ?? 0,
    ),
    workouts_this_month: Math.max(
      existing.workouts_this_month ?? 0,
      incoming.workouts_this_month ?? 0,
    ),
    active_days_this_year: Math.max(
      existing.active_days_this_year ?? 0,
      incoming.active_days_this_year ?? 0,
    ),
    // Timestamps/datas: prefere valor não-null. Como partials zeram esses
    // como null, o existing real sobrevive.
    last_active_date:
      incoming.last_active_date ?? existing.last_active_date,
    badge_is_active_today:
      existing.badge_is_active_today || incoming.badge_is_active_today,
    streak_restores_available:
      incoming.streak_restores_available ??
      existing.streak_restores_available,
    last_streak_restore_used_at:
      incoming.last_streak_restore_used_at ??
      existing.last_streak_restore_used_at,
    last_streak_restore_earned_at:
      incoming.last_streak_restore_earned_at ??
      existing.last_streak_restore_earned_at,
    streak_restore_deadline_at:
      incoming.streak_restore_deadline_at ??
      existing.streak_restore_deadline_at,
    streak_restore_missed_date:
      incoming.streak_restore_missed_date ??
      existing.streak_restore_missed_date,
    streak_restore_status:
      incoming.streak_restore_status ?? existing.streak_restore_status,
    updated_at: incoming.updated_at ?? existing.updated_at,
  };
}

/**
 * Sprint 3.6.1 bug fix — versão de `mergeRowsByKey` específica pra
 * `UserStatsRow` que usa `mergeUserStatsRow` no conflito em vez de "last wins".
 *
 * Por que isso é crítico: o `mergeRowsByKey` genérico faz Map.set(key, row),
 * onde o último row sobrescreve o anterior. Pra stats, isso permitia que um
 * row PARCIAL (vindo de `statsRowFromSurface`, com `workouts_this_month: 0`
 * hardcoded) sobrescrevesse o row COMPLETO do `user_stats_live`. Resultado
 * visual: `MyCircleSheet` zerado mesmo com DB tendo `workouts_this_month=11`.
 *
 * O fix anterior em `ec6c931` tentou aplicar o merge inteligente dentro do
 * `useMemo enrichedAll`, mas como `agg.stats` já chega DEDUPLICADO por causa
 * dos 6 `mergeRowsByKey` espalhados, o merge no useMemo nunca encontra
 * duplicatas pra mergear — opera em vão. A fix definitivo é trocar
 * `mergeRowsByKey` por `mergeStatsArrays` em todos os 6 lugares que escrevem
 * `agg.stats`. Bug confirmado via Supabase MCP: DB tem
 * `best_streak=5/workouts=11/active_days=11` pro dudy, e o frontend mostrava
 * 0/0/0 pq o partial do feed surface vinha depois no array.
 */
function mergeStatsArrays(
  current: UserStatsRow[],
  next: UserStatsRow[],
): UserStatsRow[] {
  const map = new Map<string, UserStatsRow>();
  const upsert = (row: UserStatsRow) => {
    const existing = map.get(row.user_id);
    map.set(row.user_id, existing ? mergeUserStatsRow(existing, row) : row);
  };
  for (const row of current) upsert(row);
  for (const row of next) upsert(row);
  return Array.from(map.values());
}

function statsRowFromSurface(input: {
  user_id?: string | null;
  author_id?: string | null;
  author_current_streak?: number | null;
  author_best_streak?: number | null;
  author_badge_active?: boolean | null;
  current_streak?: number | null;
  badge_is_active_today?: boolean | null;
}): UserStatsRow | null {
  const userId = input.user_id ?? input.author_id;
  if (!userId) return null;
  return {
    user_id: userId,
    current_streak: input.author_current_streak ?? input.current_streak ?? 0,
    best_streak: input.author_best_streak ?? 0,
    workouts_this_month: 0,
    active_days_this_year: 0,
    last_active_date: null,
    badge_is_active_today: input.author_badge_active ?? input.badge_is_active_today ?? false,
    streak_restores_available: null,
    last_streak_restore_used_at: null,
    last_streak_restore_earned_at: null,
    streak_restore_deadline_at: null,
    streak_restore_missed_date: null,
    streak_restore_status: null,
    updated_at: new Date().toISOString(),
  };
}

function profileRowFromDiscovery(row: DiscoveryProfileRow): ProfileRow {
  return profileRowFromPartial({
    user_id: row.user_id,
    username: row.username ?? "usuario",
    display_name: row.display_name ?? row.username ?? "Gym Circle",
    avatar_url: row.avatar_url ?? null,
    is_private: row.is_private ?? false,
  });
}

function statsRowFromDiscovery(row: DiscoveryProfileRow): UserStatsRow {
  return {
    user_id: row.user_id,
    current_streak: row.current_streak ?? 0,
    best_streak: row.current_streak ?? 0,
    workouts_this_month: 0,
    active_days_this_year: 0,
    last_active_date: null,
    badge_is_active_today: row.badge_is_active_today ?? false,
    streak_restores_available: null,
    last_streak_restore_used_at: null,
    last_streak_restore_earned_at: null,
    streak_restore_deadline_at: null,
    streak_restore_missed_date: null,
    streak_restore_status: null,
    updated_at: new Date().toISOString(),
  };
}

function followRowFromDiscovery(
  row: DiscoveryProfileRow,
  currentUserId: string,
): FollowRow | null {
  if (row.follow_status !== "accepted" && row.follow_status !== "pending") return null;
  return {
    follower_id: currentUserId,
    following_id: row.user_id,
    status: row.follow_status,
    created_at: new Date().toISOString(),
  };
}

function enrichedUserFromDiscovery(row: DiscoveryProfileRow): EnrichedUser {
  const followStatus =
    row.follow_status === "accepted" || row.follow_status === "pending"
      ? row.follow_status
      : "none";
  return {
    id: row.user_id,
    createdAt: undefined,
    name: row.display_name ?? row.username ?? "Gym Circle",
    username: row.username ?? "usuario",
    accent: accentForId(row.user_id),
    avatarUrl: row.avatar_url ?? null,
    bio: row.primary_reason ?? "",
    goal: row.primary_reason ?? "",
    instagramUsername: null,
    birthDate: null,
    age: null,
    isBirthday: false,
    sports: [],
    onboardingCompletedAt: null,
    profileCompletionNoticeDismissed: false,
    alphaTermsAcceptedAt: null,
    privacyPolicyAcceptedAt: null,
    accountStatus: "active",
    suspendedAt: null,
    reactivationSentAt: null,
    reactivationExpiresAt: null,
    mainGymId: null,
    location: row.shared_gym_name ?? "",
    gyms: row.shared_gym_name ? [row.shared_gym_name] : [],
    preferredTimes: [],
    currentStreak: row.current_streak ?? 0,
    longestStreak: row.current_streak ?? 0,
    lastWorkoutDate: "",
    workoutsThisWeek: 0,
    workoutsThisMonth: 0,
    activeDaysCount: 0,
    streakRestoresAvailable: 0,
    lastStreakRestoreUsedAt: null,
    lastStreakRestoreEarnedAt: null,
    streakRestoreDeadlineAt: null,
    streakRestoreMissedDate: null,
    streakRestoreStatus: null,
    checkInsCount: 0,
    achievements: deriveAchievements(statsRowFromDiscovery(row)),
    followersCount: row.mutual_friends_count ?? 0,
    followingCount: 0,
    isFollowing: followStatus === "accepted",
    followStatus,
    isPrivate: row.is_private ?? false,
    workoutDays: [],
    streakLitToday: row.badge_is_active_today ?? false,
    streakPresenceSource: row.badge_is_active_today ? "feed-photo" : "none",
  };
}

function enrichedUserFromProfileRow(
  profile: ProfileRow,
  stats: UserStatsRow | undefined,
  followStatus: "none" | "pending" | "accepted",
): EnrichedUser {
  const birthDate = profile.birth_date ?? null;
  return {
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
    profileCompletionNoticeDismissed:
      profile.profile_completion_notice_dismissed ?? false,
    alphaTermsAcceptedAt: profile.alpha_terms_accepted_at ?? null,
    privacyPolicyAcceptedAt: profile.privacy_policy_accepted_at ?? null,
    accountStatus: profile.account_status ?? "active",
    suspendedAt: profile.suspended_at ?? null,
    reactivationSentAt: profile.reactivation_sent_at ?? null,
    reactivationExpiresAt: profile.reactivation_expires_at ?? null,
    mainGymId: profile.main_gym_id ?? null,
    location: "",
    gyms: [],
    preferredTimes: profile.preferred_training_times ?? [],
    currentStreak: stats?.current_streak ?? 0,
    longestStreak: stats?.best_streak ?? 0,
    lastWorkoutDate: stats?.last_active_date ?? "",
    // Sprint 3.5: `workoutsThisWeek` derivado client-side via
    // `calculateWorkoutStats(workoutDays, todayKey)` quando workoutDays
    // estiver populado. Sem isso, fallback 0 (ring de semana vazio até
    // hidratação real). Sem RPC novo nesta sprint.
    workoutsThisWeek: 0,
    workoutsThisMonth: stats?.workouts_this_month ?? 0,
    activeDaysCount: stats?.active_days_this_year ?? 0,
    streakRestoresAvailable: 0,
    lastStreakRestoreUsedAt: null,
    lastStreakRestoreEarnedAt: null,
    streakRestoreDeadlineAt: null,
    streakRestoreMissedDate: null,
    streakRestoreStatus: null,
    checkInsCount: 0,
    achievements: deriveAchievements(stats),
    followersCount: 0,
    followingCount: 0,
    isFollowing: followStatus === "accepted",
    followStatus,
    isPrivate: profile.is_private ?? false,
    workoutDays: [],
    ...getDailyPresenceFromStats(stats),
  };
}

function feedPostRowFromSurface(row: SurfacePostRow): FeedPostRow {
  return {
    id: row.id,
    user_id: row.user_id,
    image_url: row.image_url,
    thumbnail_url: row.thumbnail_url ?? null,
    poster_url: row.poster_url ?? null,
    media_width: row.media_width ?? null,
    media_height: row.media_height ?? null,
    media_duration_seconds: row.media_duration_seconds ?? null,
    blur_data_url: row.blur_data_url ?? null,
    media_type: row.media_type === "video" ? "video" : "image",
    caption: row.caption ?? null,
    gym_id: row.gym_id ?? null,
    workout_type: row.workout_type ?? null,
    workout_date: row.workout_date,
    created_at: row.created_at,
    location_source: row.location_source ?? "none",
    location_name: row.location_name ?? null,
    location_latitude: row.location_latitude ?? null,
    location_longitude: row.location_longitude ?? null,
    location_google_maps_url: row.location_google_maps_url ?? null,
    likes_count: row.likes_count ?? 0,
    comments_count: row.comments_count ?? 0,
    username: row.username ?? null,
    display_name: row.display_name ?? null,
    avatar_url: row.avatar_url ?? null,
    author_current_streak: row.author_current_streak ?? 0,
    author_best_streak: row.author_best_streak ?? 0,
    author_badge_active: row.author_badge_active ?? false,
  };
}

function storyRowFromSurface(row: StoryTrayRow): StoryRow | null {
  const id = row.id ?? row.first_story_id ?? row.first_unseen_story_id;
  const userId = row.user_id ?? row.author_id;
  if (!id || !userId || !row.media_url || !row.expires_at || !row.created_at) return null;
  return {
    id,
    user_id: userId,
    media_url: row.media_url,
    media_type: row.media_type === "video" ? "video" : "image",
    gym_id: row.gym_id ?? null,
    workout_type: row.workout_type ?? null,
    expires_at: row.expires_at,
    created_at: row.created_at,
    thumbnail_url: row.thumbnail_url ?? null,
    poster_url: row.poster_url ?? null,
    media_width: row.media_width ?? null,
    media_height: row.media_height ?? null,
    media_duration_seconds: row.media_duration_seconds ?? null,
    blur_data_url: row.blur_data_url ?? null,
  };
}

function storyRowFromViewerItem(row: StoryViewerItemRow): StoryRow {
  return {
    id: row.story_id,
    user_id: row.user_id,
    media_url: row.media_url,
    media_type: row.media_type === "video" ? "video" : "image",
    gym_id: row.gym_id ?? null,
    workout_type: row.workout_type ?? null,
    expires_at: row.expires_at,
    created_at: row.created_at,
    thumbnail_url: row.thumbnail_url ?? null,
    poster_url: row.poster_url ?? null,
    media_width: row.media_width ?? null,
    media_height: row.media_height ?? null,
    media_duration_seconds: row.media_duration_seconds ?? null,
    blur_data_url: row.blur_data_url ?? null,
  };
}

function directMessageRowFromPartial(row: Partial<DirectMessageRow>): DirectMessageRow | null {
  if (!row.id || !row.sender_id || !row.created_at) return null;
  return {
    id: row.id,
    conversation_id: row.conversation_id ?? null,
    sender_id: row.sender_id,
    receiver_id: row.receiver_id ?? null,
    body: row.body ?? null,
    media_url: row.media_url ?? null,
    thumbnail_url: row.thumbnail_url ?? null,
    poster_url: row.poster_url ?? null,
    media_width: row.media_width ?? null,
    media_height: row.media_height ?? null,
    media_duration_seconds: row.media_duration_seconds ?? null,
    blur_data_url: row.blur_data_url ?? null,
    media_type: row.media_type ?? null,
    story_id: row.story_id ?? null,
    reply_to_story: row.reply_to_story ?? false,
    story_preview_url: row.story_preview_url ?? null,
    created_at: row.created_at,
    read_at: row.read_at ?? null,
  };
}

function logSurfaceFallback(surface: string, error: unknown) {
  if (process.env.NEXT_PUBLIC_PERF_DEBUG === "true") {
    console.warn(`[GymCirclePerf] ${surface} RPC failed, using safe fallback`, error);
  }
}

async function queryHomeFeedSurface(
  client: GymCircleSupabaseClient,
  limit: number,
  cursorCreatedAt: string | null = null,
): Promise<{ data: SurfacePostRow[]; error: unknown }> {
  const rpcRes = await client.rpc("get_home_feed", {
    p_cursor_created_at: cursorCreatedAt,
    p_limit: limit,
  });
  if (!rpcRes.error) {
    return { data: (rpcRes.data ?? []) as SurfacePostRow[], error: null };
  }

  logSurfaceFallback("home feed", rpcRes.error);
  const fallbackRes = await client
    .from("feed_posts")
    .select(
      [
        "id",
        "user_id",
        "image_url",
        "media_type",
        "caption",
        "gym_id",
        "workout_type",
        "workout_date",
        "created_at",
        "location_source",
        "location_name",
        "location_latitude",
        "location_longitude",
        "location_google_maps_url",
        "likes_count",
        "comments_count",
        "username",
        "display_name",
        "avatar_url",
        "author_current_streak",
        "author_best_streak",
        "author_badge_active",
      ].join(","),
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  return {
    data: (fallbackRes.data ?? []) as unknown as SurfacePostRow[],
    error: fallbackRes.error,
  };
}

async function queryStoryTraySurface(
  client: GymCircleSupabaseClient,
  limit: number,
): Promise<{ data: StoryTrayRow[]; error: unknown }> {
  const lightweightRes = await client.rpc("get_story_tray_lightweight", {
    p_limit: limit,
  });
  if (!lightweightRes.error) {
    return { data: (lightweightRes.data ?? []) as StoryTrayRow[], error: null };
  }

  logSurfaceFallback("lightweight story tray", lightweightRes.error);
  const legacyRes = await client.rpc("get_story_tray", {
    p_limit: limit,
  });
  if (!legacyRes.error) {
    return { data: (legacyRes.data ?? []) as unknown as StoryTrayRow[], error: null };
  }

  logSurfaceFallback("story tray", legacyRes.error);
  const fallbackRes = await client
    .from("stories")
    .select("id,user_id,media_url,media_type,gym_id,workout_type,expires_at,created_at")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);

  return {
    data: (fallbackRes.data ?? []) as unknown as StoryTrayRow[],
    error: fallbackRes.error,
  };
}

async function queryStoryViewerItemsSurface(
  client: GymCircleSupabaseClient,
  authorId: string,
): Promise<{ data: StoryViewerItemRow[]; error: unknown }> {
  const rpcRes = await client.rpc("get_story_viewer_items", {
    p_author_id: authorId,
  });
  if (!rpcRes.error) {
    return { data: (rpcRes.data ?? []) as StoryViewerItemRow[], error: null };
  }

  logSurfaceFallback("story viewer items", rpcRes.error);
  const fallbackRes = await client
    .from("stories")
    .select("id,user_id,media_url,media_type,gym_id,workout_type,expires_at,created_at")
    .eq("user_id", authorId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  return {
    data: ((fallbackRes.data ?? []) as unknown as Array<StoryRow & MediaMetadata>).map((row) => ({
      story_id: row.id,
      user_id: row.user_id,
      media_url: row.media_url,
      media_type: row.media_type,
      gym_id: row.gym_id,
      workout_type: row.workout_type,
      created_at: row.created_at,
      expires_at: row.expires_at,
      thumbnail_url: row.thumbnail_url,
      poster_url: row.poster_url,
      media_width: row.media_width,
      media_height: row.media_height,
      media_duration_seconds: row.media_duration_seconds,
      blur_data_url: row.blur_data_url,
      viewer_has_liked: null,
      viewer_has_seen: null,
    })),
    error: fallbackRes.error,
  };
}

async function queryUserSuggestionsSurface(
  client: GymCircleSupabaseClient,
  limit: number,
): Promise<{ data: DiscoveryProfileRow[]; error: unknown }> {
  const rpcRes = await client.rpc("get_user_suggestions", {
    p_current_lat: null,
    p_current_lng: null,
    p_limit: limit,
  });
  if (!rpcRes.error) {
    return { data: (rpcRes.data ?? []) as DiscoveryProfileRow[], error: null };
  }

  logSurfaceFallback("user suggestions", rpcRes.error);
  return { data: [], error: null };
}

async function querySearchProfilesSurface(
  client: GymCircleSupabaseClient,
  query: string,
  limit: number,
): Promise<{ data: DiscoveryProfileRow[]; error: unknown }> {
  const rpcRes = await client.rpc("search_profiles", {
    p_query: query,
    p_limit: limit,
  });
  if (!rpcRes.error) {
    return { data: (rpcRes.data ?? []) as DiscoveryProfileRow[], error: null };
  }

  logSurfaceFallback("profile search", rpcRes.error);
  return { data: [], error: rpcRes.error };
}

type HomeRefreshSnapshot = {
  postIds: string[];
  storyIds: string[];
};

type RealtimePayload = {
  eventType?: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
};

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

function buildReactivationRedirectUrl(token: string) {
  if (typeof window === "undefined") return undefined;
  const url = new URL("/reactivate-account", window.location.origin);
  url.searchParams.set("token", token);
  return url.toString();
}

export type SupabaseSocialActions = {
  likePost: (postId: string) => Promise<void>;
  commentPost: (postId: string, body: string) => Promise<void>;
  likeComment: (postId: string, commentId: string) => Promise<void>;
  toggleFollow: (userId: string) => Promise<FollowActionResult>;
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
  const mountedRef = useRef(true);
  const aggRef = useRef<AggregateState>(EMPTY);
  const analyticsBootRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);
  const chatRealtimeTimerRef = useRef<number | null>(null);
  const chatHydratedRef = useRef(false);

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
        storiesRes,
        blocksRes,
        postMutesRes,
      ]) {
        if (r.error) throw r.error;
      }

      const feedSurfaceRows = (feedRes.data ?? []) as SurfacePostRow[];
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
        ...storySurfaceRows.map(profileRowFromSurface),
      ].filter((profile): profile is ProfileRow => Boolean(profile));
      const surfaceStats = [
        currentStatsRes.data as UserStatsRow | null,
        ...feedSurfaceRows.map(statsRowFromSurface),
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
      // 14 dias é o suficiente pra cobrir "esta semana" (Mon→Sun ISO) +
      // buffer pro caso de TZ shift. Limita o volume de rows retornadas.
      const today = new Date();
      const lookbackKey = new Date(
        today.getTime() - 14 * 24 * 60 * 60 * 1000,
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

      const followersByUser = new Map<string, number>();
      for (const row of (followersRes.data ??
        []) as Array<{ following_id: string }>) {
        followersByUser.set(
          row.following_id,
          (followersByUser.get(row.following_id) ?? 0) + 1,
        );
      }
      const followingByUser = new Map<string, number>();
      for (const row of (followingRes.data ??
        []) as Array<{ follower_id: string }>) {
        followingByUser.set(
          row.follower_id,
          (followingByUser.get(row.follower_id) ?? 0) + 1,
        );
      }
      const activityByUser = new Map<string, string[]>();
      for (const row of (activityRes.data ?? []) as Array<{
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
        };
      }
      const completeStats = (statsRes.data ?? []) as UserStatsRow[];

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
            .eq("checkin_date", new Date().toISOString().slice(0, 10)),
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
      ] = await Promise.all([
        services.client.rpc("get_profile_posts", {
          p_user_id: userId,
          p_cursor_created_at: null,
          p_limit: 30,
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

      const profileSurfaceRows = (profilePostsRes.data ?? []) as SurfacePostRow[];
      const profileFeedPosts = profileSurfaceRows.map(feedPostRowFromSurface);
      const profileSurfaceProfiles = profileSurfaceRows
        .map(profileRowFromSurface)
        .filter((profile): profile is ProfileRow => Boolean(profile));
      const completeProfileStats = profileStatsRes.data as UserStatsRow | null;
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
        (profileActivityRes.data ?? []) as Array<{ activity_date: string }>
      ).map((row) => row.activity_date);
      const profileWeekStats =
        profileActivityDays.length > 0
          ? calculateWorkoutStats(profileActivityDays)
          : null;

      const nextProfileExtras: ProfileExtras = {
        followersCount: followersCountRes.count ?? 0,
        followingCount: followingCountRes.count ?? 0,
        workoutsThisWeek: profileWeekStats?.workoutsThisWeek ?? 0,
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

  const refreshPostDetails = useCallback(
    async (postId: string) => {
      const [likesRes, commentsRes, postParticipants] = await Promise.all([
        services.client.from("post_likes").select("*").eq("post_id", postId),
        services.client
          .from("post_comments")
          .select("*")
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
              .select("*")
              .in("comment_id", commentIds)
          : { data: [] as PostCommentLikeRow[], error: null };
      const postCommentLikes = optionalStorySocialRows(
        postCommentLikesRes as { data: PostCommentLikeRow[] | null; error: unknown },
        "post_comment_likes",
      );

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
  ]);

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
      const detailsLoaded = aggRef.current.postComments.some(
        (comment) => comment.post_id === row.post_id,
      );
      if (detailsLoaded) void refreshPostDetails(row.post_id);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comment_likes" }, () => undefined)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, handlePostCommentRealtime)
      .on("postgres_changes", { event: "*", schema: "public", table: "follows" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "checkins" }, scheduleRefresh)
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

  const enrichedAll = useMemo(() => {
    // Sprint 3.6.1 bug fix: defense in depth. `agg.stats` chega
    // DEDUPLICADO via `mergeStatsArrays` em todos os `setAgg` que tocam
    // stats, então este loop normalmente não vê conflitos. Mas se algum
    // call site no futuro voltar a usar `mergeRowsByKey` genérico (last
    // wins) por engano, o smart merge aqui ainda recupera. O Map manda
    // (chave única = user_id) e `mergeUserStatsRow` resolve conflitos
    // com Math.max nos contadores, preservando valores reais sobre
    // partials zerados.
    const statsByUser = new Map<string, UserStatsRow>();
    for (const incoming of agg.stats) {
      const existing = statsByUser.get(incoming.user_id);
      statsByUser.set(
        incoming.user_id,
        existing ? mergeUserStatsRow(existing, incoming) : incoming,
      );
    }
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
    // Sprint 3.6.2: deriva `workoutsThisWeek` do current user diretamente
    // de `user_activity_days` (Set `myActivityDates`). Sem essa derivação o
    // ring de Semana do `AvatarConsistencyRings` ficava sempre vazio
    // (`workoutsThisWeek: 0` hardcoded antes), e o usuário via apenas 2 dos
    // 3 rings (mês + ano stub). Outros users do feed continuam com 0
    // porque não temos `user_activity_days` deles sem RPC adicional —
    // limitação conhecida da Sprint 3.5 pendente pra GamificationService.
    const myWorkoutStats =
      myActivityDates.size > 0
        ? calculateWorkoutStats(Array.from(myActivityDates))
        : null;

    const map = new Map<string, EnrichedUser>();
    for (const profile of agg.profiles) {
      const accountStatus = profile.account_status ?? "active";
      // Bloqueio mútuo: o app de A não vê B, e o app de B não vê A.
      // Eu mantenho o próprio usuário fora dessa filtragem (preciso me
      // ver pra saber meu badge/streak).
      if (
        profile.user_id !== currentUserId &&
        (blockedSet.has(profile.user_id) || accountStatus !== "active")
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
        profileCompletionNoticeDismissed:
          profile.profile_completion_notice_dismissed ?? false,
        alphaTermsAcceptedAt: profile.alpha_terms_accepted_at ?? null,
        privacyPolicyAcceptedAt: profile.privacy_policy_accepted_at ?? null,
        accountStatus,
        suspendedAt: profile.suspended_at ?? null,
        reactivationSentAt: profile.reactivation_sent_at ?? null,
        reactivationExpiresAt: profile.reactivation_expires_at ?? null,
        mainGymId: profile.main_gym_id ?? null,
        location: gymsById.get(profile.main_gym_id ?? "")?.city ?? "",
        gyms: gymNames,
        preferredTimes,
        currentStreak: stats?.current_streak ?? 0,
        longestStreak: stats?.best_streak ?? 0,
        lastWorkoutDate: stats?.last_active_date ?? "",
        // Sprint 3.6.2 + 3.6.3:
        // - current user → derivado de myActivityDates (já carregado em
        //   refreshHomeCritical).
        // - outro user já visitado via ProfileSheet → vem de
        //   profileExtras[user_id] (carregado em refreshProfilePosts).
        // - outro user nunca visitado → 0 (ring vazio até abrir o perfil).
        workoutsThisWeek:
          profile.user_id === currentUserId
            ? myWorkoutStats?.workoutsThisWeek ?? 0
            : agg.profileExtras[profile.user_id]?.workoutsThisWeek ?? 0,
        workoutsThisMonth: stats?.workouts_this_month ?? 0,
        activeDaysCount: stats?.active_days_this_year ?? 0,
        streakRestoresAvailable:
          profile.user_id === currentUserId ? stats?.streak_restores_available ?? 3 : 0,
        lastStreakRestoreUsedAt:
          profile.user_id === currentUserId ? stats?.last_streak_restore_used_at ?? null : null,
        lastStreakRestoreEarnedAt:
          profile.user_id === currentUserId ? stats?.last_streak_restore_earned_at ?? null : null,
        streakRestoreDeadlineAt:
          profile.user_id === currentUserId ? stats?.streak_restore_deadline_at ?? null : null,
        streakRestoreMissedDate:
          profile.user_id === currentUserId ? stats?.streak_restore_missed_date ?? null : null,
        streakRestoreStatus:
          profile.user_id === currentUserId ? stats?.streak_restore_status ?? null : null,
        checkInsCount: profile.user_id === currentUserId ? agg.myActivityDays.length : 0,
        achievements: deriveAchievements(stats),
        // Sprint 3.6.3: pra current user, derivamos de agg.follows (que
        // está completo — refreshHomeCritical busca todas as relações
        // do currentUser). Pra outros users, agg.follows não tem dado
        // representativo (só conexões com currentUser), então pegamos
        // de profileExtras quando disponível (= o user visitou o
        // ProfileSheet desse user). Fallback 0 enquanto perfil não foi
        // aberto — momento em que refreshProfilePosts hidrata.
        followersCount:
          profile.user_id === currentUserId
            ? followersCountByUser.get(profile.user_id) ?? 0
            : agg.profileExtras[profile.user_id]?.followersCount ??
              (followersCountByUser.get(profile.user_id) ?? 0),
        followingCount:
          profile.user_id === currentUserId
            ? followingCountByUser.get(profile.user_id) ?? 0
            : agg.profileExtras[profile.user_id]?.followingCount ??
              (followingCountByUser.get(profile.user_id) ?? 0),
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
        profileCompletionNoticeDismissed: false,
        alphaTermsAcceptedAt: null,
        privacyPolicyAcceptedAt: null,
        accountStatus: "active",
        suspendedAt: null,
        reactivationSentAt: null,
        reactivationExpiresAt: null,
        mainGymId: null,
        location: "",
        gyms: [],
        preferredTimes: [],
        currentStreak: 0,
        longestStreak: 0,
        lastWorkoutDate: "",
        workoutsThisWeek: 0,
        workoutsThisMonth: 0,
        activeDaysCount: 0,
        streakRestoresAvailable: 3,
        lastStreakRestoreUsedAt: null,
        lastStreakRestoreEarnedAt: null,
        streakRestoreDeadlineAt: null,
        streakRestoreMissedDate: null,
        streakRestoreStatus: null,
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
    const visibleRows = mergeRowsByKey(
      agg.feedPosts,
      agg.profileFeedPosts,
      (post) => post.id,
    );
    if (!visibleRows.length) return [];
    const myLikedSet = new Set(
      agg.postLikes.filter((l) => l.user_id === currentUserId).map((l) => l.post_id),
    );
    const commentsByPost = new Map<string, PostCommentRow[]>();
    for (const c of agg.postComments) {
      const list = commentsByPost.get(c.post_id) ?? [];
      list.push(c);
      commentsByPost.set(c.post_id, list);
    }
    const commentLikesByComment = new Map<string, PostCommentLikeRow[]>();
    for (const like of agg.postCommentLikes) {
      const list = commentLikesByComment.get(like.comment_id) ?? [];
      list.push(like);
      commentLikesByComment.set(like.comment_id, list);
    }
    const enrichComment = (c: PostCommentRow, fallbackAuthor: EnrichedUser) => {
      const commentLikes = commentLikesByComment.get(c.id) ?? [];
      return {
        id: c.id,
        postId: c.post_id,
        userId: c.user_id,
        body: c.body,
        createdAt: c.created_at,
        likesCount: commentLikes.length,
        likedByCurrentUser: commentLikes.some((like) => like.user_id === currentUserId),
        author: enrichedAll.get(c.user_id) ?? fallbackAuthor,
      };
    };
    const likesByPost = new Map<string, PostLikeRow[]>();
    for (const l of agg.postLikes) {
      const list = likesByPost.get(l.post_id) ?? [];
      list.push(l);
      likesByPost.set(l.post_id, list);
    }

    return visibleRows
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
        ).map((c) => enrichComment(c, author));
        const likedByPreview = (likesByPost.get(row.id) ?? [])
          .map((l) => enrichedAll.get(l.user_id))
          .filter((u): u is EnrichedUser => Boolean(u))
          .slice(0, row.user_id === currentUserId ? 3 : 0);
        const likedByUsers =
          row.user_id === currentUserId
            ? (likesByPost.get(row.id) ?? [])
                .map((l) => enrichedAll.get(l.user_id))
                .filter((u): u is EnrichedUser => Boolean(u))
            : [];
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
          thumbnailUrl: row.thumbnail_url ?? null,
          posterUrl: row.poster_url ?? null,
          mediaWidth: row.media_width ?? null,
          mediaHeight: row.media_height ?? null,
          mediaDurationSeconds: row.media_duration_seconds ?? null,
          blurDataUrl: row.blur_data_url ?? null,
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
          commentsCount: row.comments_count ?? postComments.length,
          comments: postComments.map((c) => ({
            ...enrichComment(c, author),
          })),
          author,
          commentPreviews,
          likedByPreview,
          likedByUsers,
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
    const hydratedAuthors = new Set(agg.stories.map((story) => story.user_id));
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
        thumbnailUrl: row.thumbnail_url ?? null,
        posterUrl: row.poster_url ?? null,
        mediaWidth: row.media_width ?? null,
        mediaHeight: row.media_height ?? null,
        mediaDurationSeconds: row.media_duration_seconds ?? null,
        blurDataUrl: row.blur_data_url ?? null,
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
    for (const trayRow of agg.storyTrayRows) {
      const authorId = trayRow.author_id ?? trayRow.user_id;
      const storyId = trayRow.first_unseen_story_id ?? trayRow.first_story_id ?? trayRow.id;
      if (!authorId || !storyId || hydratedAuthors.has(authorId)) continue;
      if (agg.storyMutes.some((mute) => mute.muted_user_id === authorId)) continue;
      const author = enrichedAll.get(authorId);
      if (!author) continue;
      const viewed = trayRow.has_unseen === false || viewedSet.has(storyId);
      out.push({
        id: storyId,
        userId: authorId,
        imageUrl: trayRow.avatar_url ?? "",
        thumbnailUrl: trayRow.avatar_url ?? null,
        posterUrl: null,
        mediaWidth: null,
        mediaHeight: null,
        mediaDurationSeconds: null,
        blurDataUrl: null,
        mediaType: "image",
        title: "Treino",
        caption: `${author.currentStreak}d · ${author.gyms[0] ?? ""}`,
        createdAt: trayRow.latest_story_at ?? new Date().toISOString(),
        viewed,
        likedByCurrentUser: false,
        likesCount: 0,
        kind: "workout",
        participants: [],
        acceptedParticipants: [],
        pendingParticipants: [],
        author,
      });
    }
    return sortStoriesNewestFirst(out);
  }, [
    agg.stories,
    agg.storyTrayRows,
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
    if (agg.suggestedUserIds.length > 0) {
      return agg.suggestedUserIds
        .map((userId) => enrichedAll.get(userId))
        .filter((user): user is EnrichedUser => Boolean(user));
    }
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
  }, [agg.suggestedUserIds, enrichedAll, currentUser, currentUserId]);

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
        .filter(
          (participant) =>
            participant.user_id === currentUserId && Boolean(participant.deleted_at),
        )
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
        if (
          blockedSet.has(message.sender_id) ||
          (message.receiver_id ? blockedSet.has(message.receiver_id) : false)
        ) {
          return false;
        }
        const deletedAt = message.conversation_id
          ? deletedByConversation.get(message.conversation_id)
          : null;
        return !deletedAt || new Date(message.created_at).getTime() > deletedAt;
      })
      .map((message) => ({
          id: message.id,
          conversationId: message.conversation_id,
          senderId: message.sender_id,
          receiverId: message.receiver_id,
          body: message.body,
          mediaUrl: message.media_url,
          thumbnailUrl: message.thumbnail_url ?? null,
          posterUrl: message.poster_url ?? null,
          mediaWidth: message.media_width ?? null,
          mediaHeight: message.media_height ?? null,
          mediaDurationSeconds: message.media_duration_seconds ?? null,
          blurDataUrl: message.blur_data_url ?? null,
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
  ]);

  const chatConversations = useMemo<ChatConversation[]>(() => {
    const participantsByConversation = new Map<string, ConversationParticipantRow[]>();
    for (const participant of agg.conversationParticipants) {
      const list = participantsByConversation.get(participant.conversation_id) ?? [];
      list.push(participant);
      participantsByConversation.set(participant.conversation_id, list);
    }
    const messagesByConversation = new Map<string, ChatMessage[]>();
    for (const message of chatMessages) {
      if (!message.conversationId) continue;
      const list = messagesByConversation.get(message.conversationId) ?? [];
      list.push(message);
      messagesByConversation.set(message.conversationId, list);
    }

    return agg.conversations
      .map<ChatConversation | null>((conversation) => {
        const participants = participantsByConversation.get(conversation.id) ?? [];
        const currentParticipant = participants.find((p) => p.user_id === currentUserId);
        if (!currentParticipant) return null;
        if (currentParticipant.deleted_at) {
          const lastVisibleMessage = messagesByConversation.get(conversation.id)?.at(-1);
          if (
            !lastVisibleMessage ||
            new Date(lastVisibleMessage.createdAt).getTime() <=
              new Date(currentParticipant.deleted_at).getTime()
          ) {
            return null;
          }
        }
        return {
          id: conversation.id,
          type: conversation.type === "group" ? "group" : "direct",
          name: conversation.name,
          imageUrl: conversation.image_url,
          memberIds: participants.map((participant) => participant.user_id),
          role: currentParticipant.role,
          lastReadAt: currentParticipant.last_read_at,
          deletedAt: currentParticipant.deleted_at,
          lastMessageAt: conversation.last_message_at,
          unreadCount: agg.conversationUnreadCounts[conversation.id] ?? 0,
        } satisfies ChatConversation;
      })
      .filter((conversation): conversation is ChatConversation => Boolean(conversation));
  }, [
    agg.conversations,
    agg.conversationParticipants,
    agg.conversationUnreadCounts,
    chatMessages,
    currentUserId,
  ]);

  const actions = useMemo<SupabaseSocialActions>(
    () => ({
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
      async commentPost(postId: string, body: string) {
        await services.posts.comment(postId, currentUserId, body);
        await refreshPostDetails(postId);
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
            thumbnailUrl: input.thumbnailUrl ?? null,
            posterUrl: input.posterUrl ?? null,
            mediaWidth: input.mediaWidth ?? null,
            mediaHeight: input.mediaHeight ?? null,
            mediaDurationSeconds: input.mediaDurationSeconds ?? null,
            blurDataUrl: input.blurDataUrl ?? null,
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
            thumbnailUrl: input.thumbnailUrl ?? null,
            posterUrl: input.posterUrl ?? null,
            mediaWidth: input.mediaWidth ?? null,
            mediaHeight: input.mediaHeight ?? null,
            mediaDurationSeconds: input.mediaDurationSeconds ?? null,
            blurDataUrl: input.blurDataUrl ?? null,
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
      async deletePost(postId: string) {
        await services.posts.remove(postId);
        await refresh();
        showFeedback("success", "Post apagado");
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
        await PushNotificationsService.unregisterPushToken(services.push);
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
      refreshChat,
      refreshPostDetails,
      refreshProfilePosts,
      loadMoreFeed,
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
      agg.postCommentLikes,
      agg.profiles,
      refresh,
      refreshChat,
      refreshConversationMessages,
      refreshPostDetails,
      refreshProfilePosts,
      refreshStoryViewerItems,
      loadMoreFeed,
      showFeedback,
      viewedStoryIds,
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
  };
}

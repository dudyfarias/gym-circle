import type {
  DirectMessageRow,
  FeedPostRow,
  FollowRow,
  PostRow,
  ProfileRow,
  StoryRow,
  UserStatsRow,
} from "@gym-circle/core";
import { GYM_CIRCLE_TIME_ZONE } from "@gym-circle/core";
import {
  calculateAgeFromBirthDate,
  isBirthdayFromBirthDate,
} from "./profile";
import { profileRowFromPartial } from "./profileRows";
import type {
  AggregateState,
  DiscoveryProfileRow,
  ProfileRowWithContextualHints,
  ProfileRowWithFeaturedAchievements,
  ProfileRowWithRecapCovers,
  SurfacePostRow,
  StoryTrayRow,
  StoryViewerItemRow,
} from "./supabaseSocialTypes";
import type { EnrichedUser, StreakPresence } from "./types";

/**
 * Mappers puros do useSupabaseSocial — extraídos do hook na Sprint 21.4.
 *
 * São os adapters row→domínio (RPC surface / discovery / partial → EnrichedUser
 * / FeedPostRow / StoryRow / etc.), os merges de dedup e os scorers do feed.
 * Tudo PURO e determinístico — coberto por supabaseSocialMappers.test.ts.
 */

const ACCENT_PALETTE = [
  "var(--gc-brand)",
  "var(--gc-consistency-month)",
  "var(--gc-blue)",
  "var(--gc-consistency-year)",
  "var(--gc-consistency-daily)",
  "var(--gc-consistency-mid)",
];

export function accentForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ACCENT_PALETTE[Math.abs(hash) % ACCENT_PALETTE.length];
}

export function deriveAchievements(stats: UserStatsRow | undefined): string[] {
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

export function formatPostClock(createdAt: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: GYM_CIRCLE_TIME_ZONE,
  }).format(new Date(createdAt));
}

export function getDailyPresenceFromStats(
  stats: UserStatsRow | undefined,
): StreakPresence {
  return {
    streakLitToday: stats?.badge_is_active_today ?? false,
    streakPresenceSource: stats?.badge_is_active_today ? "feed-photo" : "none",
  };
}

export function getSharedGymCount(a: EnrichedUser, b: EnrichedUser): number {
  return b.gyms.filter((gym) => a.gyms.includes(gym)).length;
}

export function getSmartReason(
  post: FeedPostRow,
  author: EnrichedUser,
  currentUser: EnrichedUser,
): string {
  if (post.user_id === currentUser.id) return "Seu treino";
  if (author.isFollowing) return "Seguindo";
  // Sprint 3 — Fase 3.2: removida razão visual "Mesma academia" (feed mais
  // social). O sinal continua existindo no `getSmartScore` abaixo via
  // `getSharedGymCount * 26`, então quem treina na mesma academia continua
  // sendo melhor candidato a aparecer no topo do feed.
  if ((post.author_current_streak ?? 0) >= 10) return "Streak em alta";
  return "Descoberta";
}

export function getSmartScore(
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

export function findDirectConversationId(
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

  return (
    state.chatMessages.find(
      (message) =>
        (message.sender_id === currentUserId &&
          message.receiver_id === otherUserId) ||
        (message.sender_id === otherUserId &&
          message.receiver_id === currentUserId),
    )?.conversation_id ?? null
  );
}

export function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value ?? fallback) as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function mergeRowsByKey<T>(
  rows: T[],
  nextRows: T[],
  getKey: (row: T) => string,
): T[] {
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
export function mergeUserStatsRow(
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
export function mergeStatsArrays(
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

export function statsRowFromSurface(input: {
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

export function profileRowFromDiscovery(row: DiscoveryProfileRow): ProfileRow {
  return profileRowFromPartial({
    user_id: row.user_id,
    username: row.username ?? "usuario",
    display_name: row.display_name ?? row.username ?? "Gym Circle",
    avatar_url: row.avatar_url ?? null,
    is_private: row.is_private ?? false,
  });
}

export function statsRowFromDiscovery(row: DiscoveryProfileRow): UserStatsRow {
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

export function followRowFromDiscovery(
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

export function enrichedUserFromDiscovery(row: DiscoveryProfileRow): EnrichedUser {
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

export function enrichedUserFromProfileRow(
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
    monthlyRecapCovers:
      (profile as ProfileRowWithRecapCovers).monthly_recap_covers ?? undefined,
    contextualHintsSeen:
      (profile as ProfileRowWithContextualHints).contextual_hints_seen ?? undefined,
    featuredAchievements:
      (profile as ProfileRowWithFeaturedAchievements).featured_achievements ?? undefined,
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

export function feedPostRowFromSurface(row: SurfacePostRow): FeedPostRow {
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
    workout_activity_type: row.workout_activity_type ?? null,
    workout_elapsed_s: row.workout_elapsed_s ?? null,
    workout_moving_s: row.workout_moving_s ?? null,
    workout_distance_m: row.workout_distance_m ?? null,
    workout_elevation_gain_m: row.workout_elevation_gain_m ?? null,
    workout_avg_hr: row.workout_avg_hr ?? null,
    workout_active_calories: row.workout_active_calories ?? null,
    workout_total_calories: row.workout_total_calories ?? null,
    workout_route: row.workout_route ?? null,
    workout_strength_sets: row.workout_strength_sets ?? null,
    workout_started_at: row.workout_started_at ?? null,
    workout_ended_at: row.workout_ended_at ?? null,
  };
}

export function feedPostRowFromPostRow(row: PostRow): FeedPostRow {
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
    location_source:
      row.location_source === "gym" ||
      row.location_source === "current" ||
      row.location_source === "custom"
        ? row.location_source
        : "none",
    location_name: row.location_name ?? null,
    location_latitude: row.location_latitude ?? null,
    location_longitude: row.location_longitude ?? null,
    location_google_maps_url: row.location_google_maps_url ?? null,
    likes_count: 0,
    comments_count: 0,
    username: null,
    display_name: null,
    avatar_url: null,
    author_current_streak: 0,
    author_best_streak: 0,
    author_badge_active: false,
    workout_types: row.workout_types ?? null,
  } as FeedPostRow;
}

export function storyRowFromSurface(row: StoryTrayRow): StoryRow | null {
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

export function storyRowFromViewerItem(row: StoryViewerItemRow): StoryRow {
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

export function directMessageRowFromPartial(
  row: Partial<DirectMessageRow>,
): DirectMessageRow | null {
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

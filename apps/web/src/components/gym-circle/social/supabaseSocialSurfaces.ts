import type { StoryRow } from "@gym-circle/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FULL_MONTH_BONUS,
  FULL_WEEK_BONUS,
  WORKOUT_DAY_POINTS,
  pointsForDifficulty,
  pointsForStaticAchievement,
} from "./rankingPoints";
import type {
  CircleRankingRow,
  DiscoveryProfileRow,
  GymCircleSupabaseClient,
  MediaMetadata,
  OptionalStorySocialTable,
  RankingPeriod,
  RankingScope,
  StoryTrayRow,
  StoryViewerItemRow,
  SurfacePostRow,
} from "./supabaseSocialTypes";

/**
 * Queries de "surface" do useSupabaseSocial — extraídas do hook na Sprint 21.4.
 *
 * Cada uma tenta o RPC otimizado e cai num fallback direto na tabela quando o
 * RPC não existe/falha (deploys parciais). Também os helpers de tabela social
 * OPCIONAL (story_likes/mutes/views, post_comment_likes), que podem não existir
 * ainda em ambientes atrasados — tratados como vazio em vez de erro.
 */

export function isMissingOptionalStorySocialTable(
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

export function optionalStorySocialRows<T>(
  response: { data: T[] | null; error: unknown },
  table: OptionalStorySocialTable,
) {
  if (!response.error) return response.data ?? [];
  if (isMissingOptionalStorySocialTable(response.error, table)) return [];
  throw response.error;
}

export function logSurfaceFallback(surface: string, error: unknown) {
  if (process.env.NEXT_PUBLIC_PERF_DEBUG === "true") {
    console.warn(`[GymCirclePerf] ${surface} RPC failed, using safe fallback`, error);
  }
}

export async function queryHomeFeedSurface(
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

export async function queryStoryTraySurface(
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

export async function queryStoryViewerItemsSurface(
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

export async function queryUserSuggestionsSurface(
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

export async function querySearchProfilesSurface(
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

/** Sprint 19 — ranking da Competição (escopo × período). Fail-soft em []. */
export async function queryCircleRankingSurface(
  client: GymCircleSupabaseClient,
  scope: RankingScope,
  period: RankingPeriod,
  limit = 50,
): Promise<{ data: CircleRankingRow[]; error: unknown }> {
  // RPC nova ainda não está nos tipos gerados do Supabase (symlink quirk do
  // core lag-a a worktree) — cast loose até o próximo generate de tipos.
  const rpc = client.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
  try {
    const rpcRes = await rpc("get_circle_ranking", {
      p_scope: scope,
      p_period: period,
      p_limit: limit,
    });
    if (!rpcRes.error) {
      return { data: normalizeCircleRankingRows(rpcRes.data), error: null };
    }

    logSurfaceFallback("circle ranking", rpcRes.error);
    return { data: [], error: rpcRes.error };
  } catch (error) {
    logSurfaceFallback("circle ranking", error);
    return { data: [], error };
  }
}

type RankingProfileSnapshot = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  account_status?: string | null;
  deleted_at?: string | null;
};

type RankingStatsSnapshot = {
  user_id: string;
  current_streak?: number | null;
  badge_is_active_today?: boolean | null;
};

type RankingActivitySnapshot = {
  user_id: string;
  activity_date: string;
};

type RankingAchievementSnapshot = {
  user_id: string;
  achievement_id: string;
  earned_at?: string | null;
};

type RankingChallengeSnapshot = {
  id: string;
  difficulty?: string | null;
};

type RankingPeriodBounds = {
  startDate: string;
  endDate: string;
  startIso: string;
  endIso: string;
};

const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";
const MAX_RANKING_FALLBACK_USERS = 500;

/**
 * Browser-safe fallback para a Competição. Ele existe porque alguns clients
 * podem ficar sem linhas da RPC por cache/schema/RLS transitório; a tela não
 * deve ficar vazia se as tabelas base estão acessíveis.
 */
export async function queryCircleRankingClientFallback(
  client: GymCircleSupabaseClient,
  scope: RankingScope,
  period: RankingPeriod,
  currentUserId: string,
  limit = 50,
): Promise<CircleRankingRow[]> {
  try {
    const looseClient = client as unknown as SupabaseClient;
    const followingIds = new Set<string>();
    if (scope === "circle") {
      const followsRes = await client
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId)
        .eq("status", "accepted");
      if (followsRes.error) throw followsRes.error;
      for (const row of (followsRes.data ?? []) as Array<{ following_id: string }>) {
        if (row.following_id) followingIds.add(row.following_id);
      }
    }

    let profileQuery = client
      .from("profiles")
      .select("user_id,username,display_name,avatar_url,account_status,deleted_at")
      .eq("account_status", "active")
      .is("deleted_at", null)
      .limit(MAX_RANKING_FALLBACK_USERS);
    if (scope === "circle") {
      profileQuery = profileQuery.in("user_id", [currentUserId, ...followingIds]);
    }

    const profilesRes = await profileQuery;
    if (profilesRes.error) throw profilesRes.error;
    const profiles = (profilesRes.data ?? []) as RankingProfileSnapshot[];
    const userIds = profiles
      .map((profile) => profile.user_id)
      .filter((id): id is string => Boolean(id));
    if (userIds.length === 0) return [];

    const bounds = getRankingPeriodBounds(period);
    const [statsRes, activityRes, achievementsRes] = await Promise.all([
      client
        .from("user_stats_live")
        .select("user_id,current_streak,badge_is_active_today")
        .in("user_id", userIds),
      client
        .from("user_activity_days")
        .select("user_id,activity_date")
        .in("user_id", userIds)
        .gte("activity_date", bounds.startDate)
        .lt("activity_date", bounds.endDate),
      looseClient
        .from("user_achievements")
        .select("user_id,achievement_id,earned_at")
        .in("user_id", userIds)
        .gte("earned_at", bounds.startIso)
        .lt("earned_at", bounds.endIso),
    ]);

    if (statsRes.error) throw statsRes.error;
    if (activityRes.error) throw activityRes.error;
    if (achievementsRes.error) throw achievementsRes.error;

    const achievements = (achievementsRes.data ?? []) as RankingAchievementSnapshot[];
    const challengeIds = Array.from(
      new Set(
        achievements
          .map((row) => parseChallengeId(row.achievement_id))
          .filter((id): id is string => Boolean(id)),
      ),
    );
    let challenges: RankingChallengeSnapshot[] = [];
    if (challengeIds.length > 0) {
      const challengesRes = await looseClient
        .from("monthly_challenges")
        .select("id,difficulty")
        .in("id", challengeIds);
      if (!challengesRes.error) {
        challenges = (challengesRes.data ?? []) as RankingChallengeSnapshot[];
      }
    }

    return buildCircleRankingRowsFromSnapshots({
      profiles,
      stats: (statsRes.data ?? []) as RankingStatsSnapshot[],
      activityDays: (activityRes.data ?? []) as RankingActivitySnapshot[],
      achievements,
      challenges,
      scope,
      period,
      currentUserId,
      followingIds,
      limit,
    });
  } catch (error) {
    logSurfaceFallback("circle ranking client fallback", error);
    return [];
  }
}

export function buildCircleRankingRowsFromSnapshots(input: {
  profiles: readonly RankingProfileSnapshot[];
  stats: readonly RankingStatsSnapshot[];
  activityDays: readonly RankingActivitySnapshot[];
  achievements: readonly RankingAchievementSnapshot[];
  challenges?: readonly RankingChallengeSnapshot[];
  scope: RankingScope;
  period: RankingPeriod;
  currentUserId: string;
  followingIds?: Iterable<string>;
  limit?: number;
  now?: Date;
}): CircleRankingRow[] {
  const bounds = getRankingPeriodBounds(input.period, input.now);
  const allowedIds =
    input.scope === "circle"
      ? new Set<string>([input.currentUserId, ...(input.followingIds ?? [])])
      : null;
  const statsByUser = new Map(input.stats.map((row) => [row.user_id, row]));
  const challengeDifficultyById = new Map(
    (input.challenges ?? []).map((row) => [row.id, row.difficulty ?? null]),
  );
  const activityDatesByUser = new Map<string, Set<string>>();
  const achievementPointsByUser = new Map<string, number>();

  for (const row of input.activityDays) {
    if (!row.user_id || !isDateKeyInRange(row.activity_date, bounds)) continue;
    const dates = activityDatesByUser.get(row.user_id) ?? new Set<string>();
    dates.add(row.activity_date.slice(0, 10));
    activityDatesByUser.set(row.user_id, dates);
  }

  for (const row of input.achievements) {
    if (!row.user_id || !isIsoInRange(row.earned_at, bounds)) continue;
    const challengeId = parseChallengeId(row.achievement_id);
    const difficulty = challengeId ? challengeDifficultyById.get(challengeId) : null;
    const points = difficulty
      ? pointsForChallengeDifficulty(difficulty)
      : pointsForStaticAchievement(row.achievement_id);
    achievementPointsByUser.set(
      row.user_id,
      (achievementPointsByUser.get(row.user_id) ?? 0) + points,
    );
  }

  return rerankCircleRows(
    input.profiles
      .filter((profile) => {
        if (!profile.user_id) return false;
        if (allowedIds && !allowedIds.has(profile.user_id)) return false;
        if (profile.account_status && profile.account_status !== "active") return false;
        return !profile.deleted_at;
      })
      .map((profile) => {
        const dates = Array.from(activityDatesByUser.get(profile.user_id) ?? []);
        const workoutDays = dates.length;
        const fullWeeks = countFullWeeks(dates);
        const fullMonths = countFullMonths(dates);
        const achievementPoints = achievementPointsByUser.get(profile.user_id) ?? 0;
        const stats = statsByUser.get(profile.user_id);
        const totalPoints =
          workoutDays * WORKOUT_DAY_POINTS +
          fullWeeks * FULL_WEEK_BONUS +
          fullMonths * FULL_MONTH_BONUS +
          achievementPoints;
        return {
          user_id: profile.user_id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          current_streak: numberValue(stats?.current_streak) ?? 0,
          badge_is_active_today: booleanValue(stats?.badge_is_active_today) ?? false,
          workout_days: workoutDays,
          achievement_points: achievementPoints,
          total_points: totalPoints,
          rank: null,
        };
      })
      .filter((row) => (row.total_points ?? 0) > 0),
  ).slice(0, input.limit ?? 50);
}

export function normalizeCircleRankingRows(data: unknown): CircleRankingRow[] {
  if (!Array.isArray(data)) return [];

  return data.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const userId = stringValue(row.user_id ?? row.userId);
    if (!userId) return [];

    return [
      {
        user_id: userId,
        username: stringValue(row.username),
        display_name: stringValue(row.display_name ?? row.displayName),
        avatar_url: stringValue(row.avatar_url ?? row.avatarUrl),
        current_streak: numberValue(row.current_streak ?? row.currentStreak),
        badge_is_active_today: booleanValue(
          row.badge_is_active_today ?? row.badgeIsActiveToday,
        ),
        workout_days: numberValue(row.workout_days ?? row.workoutDays),
        achievement_points: numberValue(
          row.achievement_points ?? row.achievementPoints,
        ),
        total_points: numberValue(row.total_points ?? row.totalPoints),
        rank: numberValue(row.rank),
      },
    ];
  });
}

export function filterCircleRankingRows(
  globalRows: readonly CircleRankingRow[],
  currentUserId: string,
  followingIds: Iterable<string>,
): CircleRankingRow[] {
  const allowedIds = new Set<string>([currentUserId]);
  for (const id of followingIds) {
    if (id && id !== currentUserId) allowedIds.add(id);
  }

  return rerankCircleRows(
    globalRows.filter((row) => Boolean(row.user_id) && allowedIds.has(row.user_id)),
  );
}

function rerankCircleRows(rows: readonly CircleRankingRow[]): CircleRankingRow[] {
  return [...rows]
    .sort((a, b) => {
      const pointsDiff = (b.total_points ?? 0) - (a.total_points ?? 0);
      if (pointsDiff !== 0) return pointsDiff;
      const streakDiff = (b.current_streak ?? 0) - (a.current_streak ?? 0);
      if (streakDiff !== 0) return streakDiff;
      return (a.username ?? a.display_name ?? a.user_id).localeCompare(
        b.username ?? b.display_name ?? b.user_id,
      );
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function getRankingPeriodBounds(
  period: RankingPeriod,
  now = new Date(),
): RankingPeriodBounds {
  const today = getSaoPauloDateKey(now);
  const startDate =
    period === "week"
      ? startOfWeekDateKey(today)
      : period === "month"
        ? `${today.slice(0, 8)}01`
        : `${today.slice(0, 4)}-01-01`;
  const endDate =
    period === "week"
      ? addDaysDateKey(startDate, 7)
      : period === "month"
        ? addMonthsDateKey(startDate, 1)
        : `${Number(today.slice(0, 4)) + 1}-01-01`;

  return {
    startDate,
    endDate,
    startIso: saoPauloDateStartIso(startDate),
    endIso: saoPauloDateStartIso(endDate),
  };
}

function getSaoPauloDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function saoPauloDateStartIso(dateKey: string): string {
  return `${dateKey}T03:00:00.000Z`;
}

function isDateKeyInRange(value: string | null | undefined, bounds: RankingPeriodBounds) {
  if (!value) return false;
  const dateKey = value.slice(0, 10);
  return dateKey >= bounds.startDate && dateKey < bounds.endDate;
}

function isIsoInRange(value: string | null | undefined, bounds: RankingPeriodBounds) {
  if (!value) return false;
  return value >= bounds.startIso && value < bounds.endIso;
}

function startOfWeekDateKey(dateKey: string): string {
  const date = parseDateKeyAsUtcNoon(dateKey);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + mondayOffset);
  return toDateKey(date);
}

function addDaysDateKey(dateKey: string, days: number): string {
  const date = parseDateKeyAsUtcNoon(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

function addMonthsDateKey(dateKey: string, months: number): string {
  const date = parseDateKeyAsUtcNoon(dateKey);
  date.setUTCMonth(date.getUTCMonth() + months);
  return toDateKey(date);
}

function parseDateKeyAsUtcNoon(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function countFullWeeks(dateKeys: readonly string[]): number {
  const byWeek = new Map<string, Set<string>>();
  for (const dateKey of dateKeys) {
    const weekStart = startOfWeekDateKey(dateKey);
    const dates = byWeek.get(weekStart) ?? new Set<string>();
    dates.add(dateKey);
    byWeek.set(weekStart, dates);
  }
  return Array.from(byWeek.values()).filter((dates) => dates.size >= 7).length;
}

function countFullMonths(dateKeys: readonly string[]): number {
  const byMonth = new Map<string, Set<string>>();
  for (const dateKey of dateKeys) {
    const monthKey = dateKey.slice(0, 7);
    const dates = byMonth.get(monthKey) ?? new Set<string>();
    dates.add(dateKey);
    byMonth.set(monthKey, dates);
  }
  return Array.from(byMonth.entries()).filter(([monthKey, dates]) => {
    const [year, month] = monthKey.split("-").map(Number);
    return dates.size >= new Date(Date.UTC(year, month, 0)).getUTCDate();
  }).length;
}

function parseChallengeId(achievementId: string): string | null {
  const [kind, , id] = achievementId.split(":");
  return kind === "challenge" && id ? id : null;
}

function pointsForChallengeDifficulty(difficulty: string): number {
  return difficulty === "easy" ||
    difficulty === "medium" ||
    difficulty === "hard" ||
    difficulty === "legendary"
    ? pointsForDifficulty(difficulty)
    : pointsForStaticAchievement("");
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

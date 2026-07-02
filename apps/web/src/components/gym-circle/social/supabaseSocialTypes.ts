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
  PostMediaRow,
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

/**
 * Tipos internos do useSupabaseSocial — extraídos do hook na Sprint 21.4.
 *
 * São os shapes das rows cruas (RPC surfaces, discovery, conversation
 * summaries), o AggregateState que o hook acumula, e o tipo do client do
 * Supabase. Tudo PURO (sem runtime) — os mappers, surfaces e cache importam
 * destes; o hook também.
 */

/**
 * Sprint 5.5a — Type assertion local pra coluna nova `monthly_recap_covers`
 * em profiles. O `ProfileRow` resolvido via @gym-circle/core (symlink pra
 * pacote do repo principal) pode estar atrasado em relação à worktree.
 * Quando o repo principal eventualmente puxar essa migration, o cast
 * vira redundante mas continua válido.
 */
export type ProfileRowWithRecapCovers = ProfileRow & {
  monthly_recap_covers?: Record<string, string> | null;
};

// Sprint 7C.1 — mesmo workaround do symlink quirk pra contextual_hints_seen.
export type ProfileRowWithContextualHints = ProfileRow & {
  contextual_hints_seen?: Record<string, string> | null;
};

// Sprint 7.5.1 — symlink quirk pra featured_achievements.
export type ProfileRowWithFeaturedAchievements = ProfileRow & {
  featured_achievements?: string[] | null;
};

export type GymCircleSupabaseClient = ReturnType<
  typeof useGymCircleServices
>["client"];

export type ProfileExtras = {
  /** Total real de followers (count em follows WHERE following_id=user). */
  followersCount: number;
  /** Total real de following (count em follows WHERE follower_id=user). */
  followingCount: number;
  /** Derivado de user_activity_days desse user (Mon→Sun ISO). */
  workoutsThisWeek: number;
  /**
   * Sprint 3.6.5: lista de datas treinadas desse user (formato `YYYY-MM-DD`).
   * Usada como `workoutDays` no `EnrichedUser` pra alimentar o calendário
   * mensal do `MyCircleSheet`. Antes era só do current user (`myActivityDates`);
   * outros users ficavam com `[]` e o calendário deles aparecia vazio.
   *
   * Cobertura: últimos ~90 dias no bulk fetch (`refreshUsersExtras`) ou
   * últimas ~400 entradas no profile dedicado (`refreshProfilePosts`).
   * Suficiente pro calendário do mês atual + mês anterior; pra navegação
   * mais antiga, precisaria expandir o lookback (próxima sprint).
   */
  activityDates: string[];
};

export type AggregateState = {
  profiles: ProfileRow[];
  stats: UserStatsRow[];
  gyms: GymRow[];
  userGyms: UserGymRow[];
  follows: FollowRow[];
  feedPosts: FeedPostRow[];
  feedCheckins: SurfaceCheckinRow[];
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
  /** Sprint 13 — mídias do carrossel por post (vazio = post single, cai na capa). */
  postMedia: PostMediaRow[];
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

export type HomeNativeCache = Pick<
  AggregateState,
  "feedPosts" | "profiles" | "stats" | "stories" | "storyTrayRows"
>;

export type StoryTrayNativeCache = Pick<
  AggregateState,
  "profiles" | "stats" | "stories" | "storyTrayRows"
>;

export type OptionalStorySocialTable =
  | "story_likes"
  | "story_mutes"
  | "story_views"
  | "post_comment_likes";

export type MediaMetadata = {
  thumbnail_url?: string | null;
  poster_url?: string | null;
  media_width?: number | null;
  media_height?: number | null;
  media_duration_seconds?: number | null;
  blur_data_url?: string | null;
};

export type SurfacePostRow = FeedPostRow &
  MediaMetadata & {
    liked_by_me?: boolean | null;
    is_following_author?: boolean | null;
    visibility?: string | null;
  };

export type SurfaceCheckinRow = {
  id: string;
  user_id: string;
  gym_id: string;
  gym_name: string;
  gym_address?: string | null;
  gym_city?: string | null;
  gym_state?: string | null;
  gym_latitude?: number | null;
  gym_longitude?: number | null;
  checkin_date: string;
  created_at: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  author_current_streak?: number | null;
  author_best_streak?: number | null;
  author_badge_active?: boolean | null;
  is_following_author?: boolean | null;
  visibility?: string | null;
};

export type StoryTrayRow = MediaMetadata & {
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

export type StoryViewerItemRow = MediaMetadata & {
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

export type DiscoveryProfileRow = {
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

export type ConversationSummaryParticipant = {
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

export type ConversationSummaryRow = {
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

export type HomeRefreshSnapshot = {
  postIds: string[];
  storyIds: string[];
};

export type RealtimePayload = {
  eventType?: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
};

/** Sprint 19 — Competição. */
export type RankingScope = "circle" | "global";
export type RankingPeriod = "week" | "month" | "year";

/** Linha agregada da RPC get_circle_ranking (já pronta pra render). */
export type CircleRankingRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  current_streak: number | null;
  badge_is_active_today: boolean | null;
  workout_days: number | null;
  achievement_points: number | null;
  total_points: number | null;
  rank: number | null;
};

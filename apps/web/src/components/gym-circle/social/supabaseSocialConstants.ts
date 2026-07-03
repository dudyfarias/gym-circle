import type { AggregateState } from "./supabaseSocialTypes";

/**
 * Constantes do useSupabaseSocial — extraídas do hook na Sprint 21.4.
 * Estado vazio inicial + listas de colunas dos selects + limites de página.
 */

export const INITIAL_FEED_LIMIT = 30;
export const INITIAL_STORY_LIMIT = 40;

export const EMPTY: AggregateState = {
  profiles: [],
  stats: [],
  gyms: [],
  userGyms: [],
  follows: [],
  feedPosts: [],
  feedCheckins: [],
  feedActivities: [],
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
  postMedia: [],
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

export const PROFILE_COLUMNS = [
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
  "monthly_recap_covers",
  "contextual_hints_seen",
  "featured_achievements",
  "alpha_terms_accepted_at",
  "privacy_policy_accepted_at",
  "account_status",
  "suspended_at",
  "reactivation_sent_at",
  "reactivation_expires_at",
  "deleted_at",
].join(",");

export const USER_STATS_COLUMNS = [
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

export const FOLLOW_COLUMNS = "follower_id,following_id,status,created_at";

import type { Database } from "../database.types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type GymRow = Database["public"]["Tables"]["gyms"]["Row"];
export type UserGymRow = Database["public"]["Tables"]["user_gyms"]["Row"];
export type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
export type ConversationParticipantRow =
  Database["public"]["Tables"]["conversation_participants"]["Row"];
export type PostLikeRow = Database["public"]["Tables"]["post_likes"]["Row"];
export type PostCommentLikeRow =
  Database["public"]["Tables"]["post_comment_likes"]["Row"];
export type PostParticipantRow =
  Database["public"]["Tables"]["post_participants"]["Row"];
export type StoryLikeRow = Database["public"]["Tables"]["story_likes"]["Row"];
export type StoryMuteRow = Database["public"]["Tables"]["story_mutes"]["Row"];
export type StoryParticipantRow =
  Database["public"]["Tables"]["story_participants"]["Row"];
export type StoryViewRow = Database["public"]["Tables"]["story_views"]["Row"];
export type PostMuteRow = Database["public"]["Tables"]["post_mutes"]["Row"];
export type PostCommentRow = Database["public"]["Tables"]["post_comments"]["Row"];
export type CheckinRow = Database["public"]["Tables"]["checkins"]["Row"];
export type UserActivityDayRow =
  Database["public"]["Tables"]["user_activity_days"]["Row"];
export type StreakRestoreEventRow =
  Database["public"]["Tables"]["streak_restore_events"]["Row"];
export type StreakRestoredDayRow =
  Database["public"]["Tables"]["streak_restored_days"]["Row"];
export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type PushSubscriptionRow =
  Database["public"]["Tables"]["push_subscriptions"]["Row"];
export type AnalyticsEventRow =
  Database["public"]["Tables"]["analytics_events"]["Row"];
export type UserBlockRow = Database["public"]["Tables"]["user_blocks"]["Row"];
export type ReportRow = Database["public"]["Tables"]["reports"]["Row"];
export type AccountDeletionRequestRow =
  Database["public"]["Tables"]["account_deletion_requests"]["Row"];
export type LegalAcceptanceRow =
  Database["public"]["Tables"]["legal_acceptances"]["Row"];
export type AlphaAdminDailyMetricRow =
  Database["public"]["Views"]["alpha_admin_daily_metrics"]["Row"];
export type AlphaAdminSummaryRow =
  Database["public"]["Views"]["alpha_admin_summary"]["Row"];

export type PostMediaType = "image" | "video";
export type PostLocationSource = "none" | "gym" | "current" | "custom";
export type StoredFollowStatus = "pending" | "accepted";

export type PostRow = Database["public"]["Tables"]["posts"]["Row"] & {
  media_type: PostMediaType;
  location_source: PostLocationSource;
};

export type StoryRow = Database["public"]["Tables"]["stories"]["Row"] & {
  media_type: PostMediaType;
};

export type FollowRow = Database["public"]["Tables"]["follows"]["Row"] & {
  status: StoredFollowStatus;
};

export type DirectMessageRow =
  Omit<Database["public"]["Tables"]["direct_messages"]["Row"], "media_type"> & {
    media_type: PostMediaType | null;
  };

export type UserStatsRow =
  Omit<
    Database["public"]["Views"]["user_stats_live"]["Row"],
    | "user_id"
    | "current_streak"
    | "best_streak"
    | "workouts_this_month"
    | "active_days_this_year"
    | "badge_is_active_today"
  > & {
    user_id: string;
    current_streak: number;
    best_streak: number;
    workouts_this_month: number;
    active_days_this_year: number;
    badge_is_active_today: boolean;
  };

export type FeedPostRow =
  Omit<
    Database["public"]["Views"]["feed_posts"]["Row"],
    | "id"
    | "user_id"
    | "image_url"
    | "media_type"
    | "location_source"
    | "created_at"
    | "workout_date"
    | "likes_count"
    | "comments_count"
  > & {
    id: string;
    user_id: string;
    image_url: string;
    media_type: PostMediaType;
    location_source: PostLocationSource;
    created_at: string;
    workout_date: string;
    likes_count: number;
    comments_count: number;
    thumbnail_url?: string | null;
    poster_url?: string | null;
    media_width?: number | null;
    media_height?: number | null;
    media_duration_seconds?: number | null;
    blur_data_url?: string | null;
  };

export type CreatePostInput = {
  imageUrl: string;
  mediaType: PostMediaType;
  thumbnailUrl?: string | null;
  posterUrl?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  mediaDurationSeconds?: number | null;
  blurDataUrl?: string | null;
  caption: string;
  workoutType?: string | null;
  gymId: string | null;
  workoutDate?: string;
  locationSource?: PostLocationSource;
  locationName?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  locationGoogleMapsUrl?: string | null;
};

export type CreateStoryInput = {
  mediaUrl: string;
  mediaType: PostMediaType;
  thumbnailUrl?: string | null;
  posterUrl?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  mediaDurationSeconds?: number | null;
  blurDataUrl?: string | null;
  gymId: string | null;
  workoutType: string | null;
};

export type EnrichedPost = FeedPostRow & {
  liked_by_me: boolean;
  comment_previews: Array<
    PostCommentRow & {
      author_username: string;
      author_display_name: string;
      author_badge_active: boolean | null;
      author_current_streak: number | null;
    }
  >;
};

export type EnrichedStory = StoryRow & {
  author_username: string;
  author_display_name: string;
  author_avatar_url: string | null;
  author_current_streak: number | null;
  author_badge_active: boolean | null;
};

export type StreakLevelId = "iniciante" | "consistente" | "elite" | "lendario";

export type StreakLevel = {
  id: StreakLevelId;
  label: string;
  shortLabel: string;
  minDays: number;
  nextLevelAt: number | null;
  tone: "cyan" | "electric" | "blue" | "deep";
};

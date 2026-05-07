import type { Database } from "../database.types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type GymRow = Database["public"]["Tables"]["gyms"]["Row"];
export type UserGymRow = Database["public"]["Tables"]["user_gyms"]["Row"];
export type PostRow = Database["public"]["Tables"]["posts"]["Row"];
export type StoryRow = Database["public"]["Tables"]["stories"]["Row"];
export type PostLikeRow = Database["public"]["Tables"]["post_likes"]["Row"];
export type PostCommentRow = Database["public"]["Tables"]["post_comments"]["Row"];
export type FollowRow = Database["public"]["Tables"]["follows"]["Row"];
export type CheckinRow = Database["public"]["Tables"]["checkins"]["Row"];
export type UserActivityDayRow =
  Database["public"]["Tables"]["user_activity_days"]["Row"];
export type UserStatsRow = Database["public"]["Tables"]["user_stats"]["Row"];
export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type DirectMessageRow = Database["public"]["Tables"]["direct_messages"]["Row"];
export type FeedPostRow = Database["public"]["Views"]["feed_posts"]["Row"];

export type PostMediaType = "image" | "video";

export type PostLocationSource = "none" | "gym" | "current" | "custom";

export type CreatePostInput = {
  imageUrl: string;
  mediaType: PostMediaType;
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

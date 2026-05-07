// Hand-authored types matching supabase/migrations/20260506184118_gym_circle_backend_core.sql.
// Regenerate via `supabase gen types typescript --project-id <ref> --schema public`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      gyms: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          city: string | null;
          state: string | null;
          latitude: number | null;
          longitude: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["gyms"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          bio: string | null;
          fitness_goal: string | null;
          main_gym_id: string | null;
          preferred_training_times: string[];
          is_private: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          username: string;
          display_name: string;
          avatar_url?: string | null;
          bio?: string | null;
          fitness_goal?: string | null;
          main_gym_id?: string | null;
          preferred_training_times?: string[];
          is_private?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      user_gyms: {
        Row: {
          id: string;
          user_id: string;
          gym_id: string;
          is_main: boolean;
          preferred_days: string[];
          preferred_times: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          gym_id: string;
          is_main?: boolean;
          preferred_days?: string[];
          preferred_times?: string[];
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_gyms"]["Insert"]>;
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          image_url: string;
          media_type: "image" | "video";
          caption: string | null;
          gym_id: string | null;
          workout_type: string | null;
          workout_date: string;
          location_source: "none" | "gym" | "current" | "custom";
          location_name: string | null;
          location_latitude: number | null;
          location_longitude: number | null;
          location_google_maps_url: string | null;
          is_story_source: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          image_url: string;
          media_type?: "image" | "video";
          caption?: string | null;
          gym_id?: string | null;
          workout_type?: string | null;
          workout_date?: string;
          location_source?: "none" | "gym" | "current" | "custom";
          location_name?: string | null;
          location_latitude?: number | null;
          location_longitude?: number | null;
          location_google_maps_url?: string | null;
          is_story_source?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Insert"]>;
        Relationships: [];
      };
      stories: {
        Row: {
          id: string;
          user_id: string;
          media_url: string;
          media_type: "image" | "video";
          gym_id: string | null;
          workout_type: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          media_url: string;
          media_type?: "image" | "video";
          gym_id?: string | null;
          workout_type?: string | null;
          expires_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stories"]["Insert"]>;
        Relationships: [];
      };
      post_likes: {
        Row: { post_id: string; user_id: string; created_at: string };
        Insert: { post_id: string; user_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["post_likes"]["Insert"]>;
        Relationships: [];
      };
      post_comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_comments"]["Insert"]>;
        Relationships: [];
      };
      follows: {
        Row: {
          follower_id: string;
          following_id: string;
          created_at: string;
          status: "pending" | "accepted";
        };
        Insert: {
          follower_id: string;
          following_id: string;
          created_at?: string;
          status?: "pending" | "accepted";
        };
        Update: Partial<Database["public"]["Tables"]["follows"]["Insert"]>;
        Relationships: [];
      };
      checkins: {
        Row: {
          id: string;
          user_id: string;
          gym_id: string;
          checkin_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          gym_id: string;
          checkin_date?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["checkins"]["Insert"]>;
        Relationships: [];
      };
      user_activity_days: {
        Row: {
          id: string;
          user_id: string;
          activity_date: string;
          source_type: "post" | "story";
          source_id: string;
          has_photo: boolean;
          created_at: string;
        };
        // Gravação acontece exclusivamente via triggers SECURITY DEFINER.
        Insert: {
          id?: string;
          user_id: string;
          activity_date: string;
          source_type: "post" | "story";
          source_id: string;
          has_photo?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_activity_days"]["Insert"]>;
        Relationships: [];
      };
      user_stats: {
        Row: {
          user_id: string;
          current_streak: number;
          best_streak: number;
          workouts_this_month: number;
          active_days_this_year: number;
          last_active_date: string | null;
          badge_is_active_today: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          current_streak?: number;
          best_streak?: number;
          workouts_this_month?: number;
          active_days_this_year?: number;
          last_active_date?: string | null;
          badge_is_active_today?: boolean;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_stats"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          actor_id: string;
          kind: "like" | "comment" | "follow" | "mention" | "follow_request";
          post_id: string | null;
          comment_id: string | null;
          body: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          actor_id: string;
          kind: "like" | "comment" | "follow" | "mention" | "follow_request";
          post_id?: string | null;
          comment_id?: string | null;
          body?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      feed_posts: {
        Row: {
          id: string;
          user_id: string;
          image_url: string;
          media_type: "image" | "video";
          caption: string | null;
          gym_id: string | null;
          workout_type: string | null;
          workout_date: string;
          created_at: string;
          location_source: "none" | "gym" | "current" | "custom";
          location_name: string | null;
          location_latitude: number | null;
          location_longitude: number | null;
          location_google_maps_url: string | null;
          likes_count: number;
          comments_count: number;
          username: string;
          display_name: string;
          avatar_url: string | null;
          author_current_streak: number | null;
          author_best_streak: number | null;
          author_badge_active: boolean | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      refresh_my_stats: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

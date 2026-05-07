export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      checkins: {
        Row: {
          checkin_date: string
          created_at: string
          gym_id: string
          id: string
          user_id: string
        }
        Insert: {
          checkin_date?: string
          created_at?: string
          gym_id: string
          id?: string
          user_id: string
        }
        Update: {
          checkin_date?: string
          created_at?: string
          gym_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          status: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          status?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          status?: string
        }
        Relationships: []
      }
      gyms: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          state: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          state?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          state?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string
          body: string | null
          comment_id: string | null
          created_at: string
          id: string
          kind: string
          post_id: string | null
          read_at: string | null
          user_id: string
        }
        Insert: {
          actor_id: string
          body?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          kind: string
          post_id?: string | null
          read_at?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string
          body?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          post_id?: string | null
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string | null
          created_at: string
          gym_id: string | null
          id: string
          image_url: string
          is_story_source: boolean
          location_google_maps_url: string | null
          location_latitude: number | null
          location_longitude: number | null
          location_name: string | null
          location_source: string
          media_type: string
          user_id: string
          workout_date: string
          workout_type: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          gym_id?: string | null
          id?: string
          image_url: string
          is_story_source?: boolean
          location_google_maps_url?: string | null
          location_latitude?: number | null
          location_longitude?: number | null
          location_name?: string | null
          location_source?: string
          media_type?: string
          user_id: string
          workout_date?: string
          workout_type?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          gym_id?: string | null
          id?: string
          image_url?: string
          is_story_source?: boolean
          location_google_maps_url?: string | null
          location_latitude?: number | null
          location_longitude?: number | null
          location_name?: string | null
          location_source?: string
          media_type?: string
          user_id?: string
          workout_date?: string
          workout_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          created_at: string
          display_name: string
          fitness_goal: string | null
          id: string
          instagram_username: string | null
          is_private: boolean
          main_gym_id: string | null
          preferred_training_times: string[]
          sports: string[]
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          display_name: string
          fitness_goal?: string | null
          id?: string
          instagram_username?: string | null
          is_private?: boolean
          main_gym_id?: string | null
          preferred_training_times?: string[]
          sports?: string[]
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string
          fitness_goal?: string | null
          id?: string
          instagram_username?: string | null
          is_private?: boolean
          main_gym_id?: string | null
          preferred_training_times?: string[]
          sports?: string[]
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_main_gym_id_fkey"
            columns: ["main_gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          created_at: string
          expires_at: string
          gym_id: string | null
          id: string
          media_type: string
          media_url: string
          user_id: string
          workout_type: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          gym_id?: string | null
          id?: string
          media_type?: string
          media_url: string
          user_id: string
          workout_type?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          gym_id?: string | null
          id?: string
          media_type?: string
          media_url?: string
          user_id?: string
          workout_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stories_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_days: {
        Row: {
          activity_date: string
          created_at: string
          has_photo: boolean
          id: string
          source_id: string
          source_type: string
          user_id: string
        }
        Insert: {
          activity_date: string
          created_at?: string
          has_photo?: boolean
          id?: string
          source_id: string
          source_type: string
          user_id: string
        }
        Update: {
          activity_date?: string
          created_at?: string
          has_photo?: boolean
          id?: string
          source_id?: string
          source_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_gyms: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          is_main: boolean
          preferred_days: string[]
          preferred_times: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          is_main?: boolean
          preferred_days?: string[]
          preferred_times?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          is_main?: boolean
          preferred_days?: string[]
          preferred_times?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_gyms_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stats: {
        Row: {
          active_days_this_year: number
          badge_is_active_today: boolean
          best_streak: number
          current_streak: number
          last_active_date: string | null
          updated_at: string
          user_id: string
          workouts_this_month: number
        }
        Insert: {
          active_days_this_year?: number
          badge_is_active_today?: boolean
          best_streak?: number
          current_streak?: number
          last_active_date?: string | null
          updated_at?: string
          user_id: string
          workouts_this_month?: number
        }
        Update: {
          active_days_this_year?: number
          badge_is_active_today?: boolean
          best_streak?: number
          current_streak?: number
          last_active_date?: string | null
          updated_at?: string
          user_id?: string
          workouts_this_month?: number
        }
        Relationships: []
      }
    }
    Views: {
      feed_posts: {
        Row: {
          author_badge_active: boolean | null
          author_best_streak: number | null
          author_current_streak: number | null
          avatar_url: string | null
          caption: string | null
          comments_count: number | null
          created_at: string | null
          display_name: string | null
          gym_id: string | null
          id: string | null
          image_url: string | null
          likes_count: number | null
          location_google_maps_url: string | null
          location_latitude: number | null
          location_longitude: number | null
          location_name: string | null
          location_source: string | null
          media_type: string | null
          user_id: string | null
          username: string | null
          workout_date: string | null
          workout_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stats_live: {
        Row: {
          active_days_this_year: number | null
          badge_is_active_today: boolean | null
          best_streak: number | null
          current_streak: number | null
          last_active_date: string | null
          updated_at: string | null
          user_id: string | null
          workouts_this_month: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      refresh_my_stats: { Args: never; Returns: undefined }
      resolve_email_for_username: {
        Args: { p_username: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

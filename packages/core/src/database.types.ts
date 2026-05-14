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
      account_deletion_requests: {
        Row: {
          created_at: string
          id: string
          processed_at: string | null
          reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          processed_at?: string | null
          reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          processed_at?: string | null
          reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_date: string
          event_name: string
          id: string
          metadata: Json
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_date?: string
          event_name: string
          id?: string
          metadata?: Json
          source?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_date?: string
          event_name?: string
          id?: string
          metadata?: Json
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
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
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          deleted_at: string | null
          joined_at: string
          last_read_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          direct_key: string | null
          id: string
          image_url: string | null
          last_message_at: string | null
          name: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          direct_key?: string | null
          id?: string
          image_url?: string | null
          last_message_at?: string | null
          name?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          direct_key?: string | null
          id?: string
          image_url?: string | null
          last_message_at?: string | null
          name?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          body: string | null
          conversation_id: string | null
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          read_at: string | null
          receiver_id: string | null
          reply_to_story: boolean
          sender_id: string
          story_id: string | null
          story_preview_url: string | null
        }
        Insert: {
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          receiver_id?: string | null
          reply_to_story?: boolean
          sender_id: string
          story_id?: string | null
          story_preview_url?: string | null
        }
        Update: {
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          receiver_id?: string | null
          reply_to_story?: boolean
          sender_id?: string
          story_id?: string | null
          story_preview_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
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
      legal_acceptances: {
        Row: {
          accepted_at: string
          document_type: string
          id: string
          metadata: Json
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          document_type: string
          id?: string
          metadata?: Json
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          document_type?: string
          id?: string
          metadata?: Json
          user_id?: string
          version?: string
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
          story_id: string | null
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
          story_id?: string | null
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
          story_id?: string | null
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
          {
            foreignKeyName: "notifications_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
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
      post_mutes: {
        Row: {
          created_at: string
          muted_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          muted_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          muted_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      post_participants: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          post_id: string
          rejected_at: string | null
          status: string
          tagged_by_user_id: string
          tagged_user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          post_id: string
          rejected_at?: string | null
          status?: string
          tagged_by_user_id: string
          tagged_user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          post_id?: string
          rejected_at?: string | null
          status?: string
          tagged_by_user_id?: string
          tagged_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_participants_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_participants_post_id_fkey"
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
          account_status: string
          alpha_terms_accepted_at: string | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          fitness_goal: string | null
          id: string
          instagram_username: string | null
          is_private: boolean
          main_gym_id: string | null
          onboarding_completed_at: string | null
          preferred_training_times: string[]
          privacy_policy_accepted_at: string | null
          sports: string[]
          user_id: string
          username: string
        }
        Insert: {
          account_status?: string
          alpha_terms_accepted_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          fitness_goal?: string | null
          id?: string
          instagram_username?: string | null
          is_private?: boolean
          main_gym_id?: string | null
          onboarding_completed_at?: string | null
          preferred_training_times?: string[]
          privacy_policy_accepted_at?: string | null
          sports?: string[]
          user_id: string
          username: string
        }
        Update: {
          account_status?: string
          alpha_terms_accepted_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          fitness_goal?: string | null
          id?: string
          instagram_username?: string | null
          is_private?: boolean
          main_gym_id?: string | null
          onboarding_completed_at?: string | null
          preferred_training_times?: string[]
          privacy_policy_accepted_at?: string | null
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          post_id: string | null
          reason: string
          reported_user_id: string | null
          reporter_id: string
          reviewed_at: string | null
          status: string
          story_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          post_id?: string | null
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          reviewed_at?: string | null
          status?: string
          story_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          post_id?: string | null
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          reviewed_at?: string | null
          status?: string
          story_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_likes: {
        Row: {
          created_at: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_likes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_mutes: {
        Row: {
          created_at: string
          muted_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          muted_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          muted_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      story_participants: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          rejected_at: string | null
          status: string
          story_id: string
          tagged_by_user_id: string
          tagged_user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          rejected_at?: string | null
          status?: string
          story_id: string
          tagged_by_user_id: string
          tagged_user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          rejected_at?: string | null
          status?: string
          story_id?: string
          tagged_by_user_id?: string
          tagged_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_participants_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          story_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          story_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          story_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
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
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          reason?: string | null
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
      alpha_admin_daily_metrics: {
        Row: {
          active_users: number | null
          checkins_created: number | null
          comments_created: number | null
          likes_created: number | null
          metric_date: string | null
          posts_created: number | null
          stories_created: number | null
          streaks_lit: number | null
          users_registered: number | null
        }
        Relationships: []
      }
      alpha_admin_summary: {
        Row: {
          active_users_today: number | null
          blocks_total: number | null
          deletion_requests_open: number | null
          open_reports: number | null
          posts_today: number | null
          stories_today: number | null
          streaks_lit_today: number | null
          users_registered: number | null
        }
        Relationships: []
      }
      conversation_members: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          joined_at: string | null
          last_read_at: string | null
          role: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
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
      accept_alpha_legal: {
        Args: { p_privacy_version?: string; p_terms_version?: string }
        Returns: undefined
      }
      add_group_conversation_members: {
        Args: { p_conversation_id: string; p_member_ids: string[] }
        Returns: undefined
      }
      create_group_conversation: {
        Args: {
          p_image_url?: string | null
          p_member_ids: string[]
          p_name: string
        }
        Returns: string
      }
      delete_conversation_for_me: {
        Args: { p_conversation_id: string }
        Returns: string | null
      }
      delete_direct_conversation_for_me: {
        Args: { p_other_user_id: string }
        Returns: string | null
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      mark_onboarding_complete: { Args: never; Returns: undefined }
      refresh_my_stats: { Args: never; Returns: undefined }
      remove_group_conversation_member: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: undefined
      }
      request_account_deletion: {
        Args: { p_reason?: string }
        Returns: undefined
      }
      resolve_email_for_username: {
        Args: { p_username: string }
        Returns: string
      }
      send_direct_message: {
        Args: {
          p_body?: string | null
          p_media_type?: string | null
          p_media_url?: string | null
          p_receiver_id: string
          p_reply_to_story?: boolean
          p_story_id?: string | null
          p_story_preview_url?: string | null
        }
        Returns: {
          body: string | null
          conversation_id: string | null
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          read_at: string | null
          receiver_id: string | null
          reply_to_story: boolean
          sender_id: string
          story_id: string | null
          story_preview_url: string | null
        }
      }
      send_group_message: {
        Args: {
          p_body?: string | null
          p_conversation_id: string
          p_media_type?: string | null
          p_media_url?: string | null
        }
        Returns: {
          body: string | null
          conversation_id: string | null
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          read_at: string | null
          receiver_id: string | null
          reply_to_story: boolean
          sender_id: string
          story_id: string | null
          story_preview_url: string | null
        }
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

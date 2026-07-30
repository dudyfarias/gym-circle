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
      achievement_points: {
        Row: {
          achievement_id: string
          points: number
        }
        Insert: {
          achievement_id: string
          points: number
        }
        Update: {
          achievement_id?: string
          points?: number
        }
        Relationships: []
      }
      activities: {
        Row: {
          active_calories: number | null
          activity_type: string
          avg_hr: number | null
          caption: string | null
          client_session_id: string | null
          created_at: string
          distance_m: number | null
          elapsed_s: number
          elevation_gain_m: number | null
          ended_at: string
          external_id: string | null
          gym_id: string | null
          health_metadata: Json
          id: string
          location_google_maps_url: string | null
          location_latitude: number | null
          location_longitude: number | null
          location_name: string | null
          location_source: string
          max_hr: number | null
          mode: string
          moving_s: number | null
          origin: string
          publication_state: string
          route: Json | null
          source_app: string | null
          splits: Json | null
          started_at: string
          strength_sets: Json | null
          total_calories: number | null
          user_id: string
          workout_date: string
          workout_exercise_context: Json
          workout_note: string | null
          workout_plan_exercises_snapshot: Json | null
          workout_plan_id: string | null
          workout_plan_name_snapshot: string | null
          workout_plan_started_from: string | null
          workout_plan_version_snapshot: number | null
          workout_types: string[] | null
        }
        Insert: {
          active_calories?: number | null
          activity_type: string
          avg_hr?: number | null
          caption?: string | null
          client_session_id?: string | null
          created_at?: string
          distance_m?: number | null
          elapsed_s?: number
          elevation_gain_m?: number | null
          ended_at: string
          external_id?: string | null
          gym_id?: string | null
          health_metadata?: Json
          id?: string
          location_google_maps_url?: string | null
          location_latitude?: number | null
          location_longitude?: number | null
          location_name?: string | null
          location_source?: string
          max_hr?: number | null
          mode: string
          moving_s?: number | null
          origin: string
          publication_state?: string
          route?: Json | null
          source_app?: string | null
          splits?: Json | null
          started_at: string
          strength_sets?: Json | null
          total_calories?: number | null
          user_id: string
          workout_date: string
          workout_exercise_context?: Json
          workout_note?: string | null
          workout_plan_exercises_snapshot?: Json | null
          workout_plan_id?: string | null
          workout_plan_name_snapshot?: string | null
          workout_plan_started_from?: string | null
          workout_plan_version_snapshot?: number | null
          workout_types?: string[] | null
        }
        Update: {
          active_calories?: number | null
          activity_type?: string
          avg_hr?: number | null
          caption?: string | null
          client_session_id?: string | null
          created_at?: string
          distance_m?: number | null
          elapsed_s?: number
          elevation_gain_m?: number | null
          ended_at?: string
          external_id?: string | null
          gym_id?: string | null
          health_metadata?: Json
          id?: string
          location_google_maps_url?: string | null
          location_latitude?: number | null
          location_longitude?: number | null
          location_name?: string | null
          location_source?: string
          max_hr?: number | null
          mode?: string
          moving_s?: number | null
          origin?: string
          publication_state?: string
          route?: Json | null
          source_app?: string | null
          splits?: Json | null
          started_at?: string
          strength_sets?: Json | null
          total_calories?: number | null
          user_id?: string
          workout_date?: string
          workout_exercise_context?: Json
          workout_note?: string | null
          workout_plan_exercises_snapshot?: Json | null
          workout_plan_id?: string | null
          workout_plan_name_snapshot?: string | null
          workout_plan_started_from?: string | null
          workout_plan_version_snapshot?: number | null
          workout_types?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "visible_profile_main_gyms"
            referencedColumns: ["gym_id"]
          },
          {
            foreignKeyName: "activities_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_record_highlights: {
        Row: {
          achieved_at: string
          activity_id: string
          created_at: string
          exercise_id: string | null
          exercise_key: string
          exercise_name: string | null
          id: string
          is_estimated: boolean
          metric_key: string
          reps: number | null
          unit: string
          user_id: string
          value: number
        }
        Insert: {
          achieved_at: string
          activity_id: string
          created_at?: string
          exercise_id?: string | null
          exercise_key?: string
          exercise_name?: string | null
          id?: string
          is_estimated?: boolean
          metric_key: string
          reps?: number | null
          unit: string
          user_id: string
          value: number
        }
        Update: {
          achieved_at?: string
          activity_id?: string
          created_at?: string
          exercise_id?: string | null
          exercise_key?: string
          exercise_name?: string | null
          id?: string
          is_estimated?: boolean
          metric_key?: string
          reps?: number | null
          unit?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_record_highlights_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_record_highlights_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercise_catalog"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "checkins_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "visible_profile_main_gyms"
            referencedColumns: ["gym_id"]
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
      device_push_tokens: {
        Row: {
          app_version: string | null
          created_at: string
          device_id: string | null
          id: string
          last_seen_at: string
          platform: string
          revoked_at: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          last_seen_at?: string
          platform: string
          revoked_at?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          last_seen_at?: string
          platform?: string
          revoked_at?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          blur_data_url: string | null
          body: string | null
          conversation_id: string | null
          created_at: string
          id: string
          media_duration_seconds: number | null
          media_height: number | null
          media_type: string | null
          media_url: string | null
          media_width: number | null
          poster_url: string | null
          read_at: string | null
          receiver_id: string | null
          reply_to_story: boolean
          sender_id: string
          story_id: string | null
          story_preview_url: string | null
          thumbnail_url: string | null
        }
        Insert: {
          blur_data_url?: string | null
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          media_duration_seconds?: number | null
          media_height?: number | null
          media_type?: string | null
          media_url?: string | null
          media_width?: number | null
          poster_url?: string | null
          read_at?: string | null
          receiver_id?: string | null
          reply_to_story?: boolean
          sender_id: string
          story_id?: string | null
          story_preview_url?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          blur_data_url?: string | null
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          media_duration_seconds?: number | null
          media_height?: number | null
          media_type?: string | null
          media_url?: string | null
          media_width?: number | null
          poster_url?: string | null
          read_at?: string | null
          receiver_id?: string | null
          reply_to_story?: boolean
          sender_id?: string
          story_id?: string | null
          story_preview_url?: string | null
          thumbnail_url?: string | null
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
      gym_place_external_refs: {
        Row: {
          cache_expires_at: string | null
          created_at: string
          created_by: string | null
          external_id: string
          gym_id: string
          id: string
          last_verified_at: string | null
          provider: string
          provider_category: string | null
          source_service: string | null
        }
        Insert: {
          cache_expires_at?: string | null
          created_at?: string
          created_by?: string | null
          external_id: string
          gym_id: string
          id?: string
          last_verified_at?: string | null
          provider: string
          provider_category?: string | null
          source_service?: string | null
        }
        Update: {
          cache_expires_at?: string | null
          created_at?: string
          created_by?: string | null
          external_id?: string
          gym_id?: string
          id?: string
          last_verified_at?: string | null
          provider?: string
          provider_category?: string | null
          source_service?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gym_place_external_refs_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_place_external_refs_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "visible_profile_main_gyms"
            referencedColumns: ["gym_id"]
          },
        ]
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
      media_cleanup_runs: {
        Row: {
          candidate_count: number
          deleted_bytes: number
          deleted_count: number
          error_message: string | null
          finished_at: string | null
          id: string
          metadata: Json
          scanned_count: number
          started_at: string
          status: string
        }
        Insert: {
          candidate_count?: number
          deleted_bytes?: number
          deleted_count?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json
          scanned_count?: number
          started_at?: string
          status: string
        }
        Update: {
          candidate_count?: number
          deleted_bytes?: number
          deleted_count?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json
          scanned_count?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      media_pipeline_events: {
        Row: {
          bucket_id: string | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          file_size_bytes: number | null
          id: string
          metadata: Json
          mime_type: string | null
          operation: string
          stage: string
          status: string
          user_id: string
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          operation: string
          stage: string
          status: string
          user_id?: string
        }
        Update: {
          bucket_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          operation?: string
          stage?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_challenges: {
        Row: {
          created_at: string
          description_en: string
          description_pt: string
          difficulty: string
          end_date: string
          goal_config: Json
          goal_kind: string
          goal_target: number
          id: string
          is_secret: boolean
          period_key: string
          rarity: string
          start_date: string
          title_en: string
          title_pt: string
          trophy_id: string
        }
        Insert: {
          created_at?: string
          description_en: string
          description_pt: string
          difficulty: string
          end_date: string
          goal_config?: Json
          goal_kind: string
          goal_target: number
          id?: string
          is_secret?: boolean
          period_key: string
          rarity: string
          start_date: string
          title_en: string
          title_pt: string
          trophy_id: string
        }
        Update: {
          created_at?: string
          description_en?: string
          description_pt?: string
          difficulty?: string
          end_date?: string
          goal_config?: Json
          goal_kind?: string
          goal_target?: number
          id?: string
          is_secret?: boolean
          period_key?: string
          rarity?: string
          start_date?: string
          title_en?: string
          title_pt?: string
          trophy_id?: string
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
      personal_record_results: {
        Row: {
          achieved_at: string
          activity_id: string
          created_at: string
          exercise_id: string | null
          exercise_key: string
          exercise_name: string | null
          id: string
          is_estimated: boolean
          metric_key: string
          reps: number | null
          unit: string
          user_id: string
          value: number
        }
        Insert: {
          achieved_at: string
          activity_id: string
          created_at?: string
          exercise_id?: string | null
          exercise_key?: string
          exercise_name?: string | null
          id?: string
          is_estimated?: boolean
          metric_key: string
          reps?: number | null
          unit: string
          user_id: string
          value: number
        }
        Update: {
          achieved_at?: string
          activity_id?: string
          created_at?: string
          exercise_id?: string | null
          exercise_key?: string
          exercise_name?: string | null
          id?: string
          is_estimated?: boolean
          metric_key?: string
          reps?: number | null
          unit?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "personal_record_results_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_record_results_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercise_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      post_activities: {
        Row: {
          activity_id: string
          created_at: string
          linked_by: string
          position: number
          post_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          linked_by: string
          position?: number
          post_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          linked_by?: string
          position?: number
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: true
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_activities_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_activities_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          parent_comment_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
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
      post_media: {
        Row: {
          blur_data_url: string | null
          created_at: string
          id: string
          image_url: string
          media_duration_seconds: number | null
          media_height: number | null
          media_type: string
          media_width: number | null
          position: number
          post_id: string
          poster_url: string | null
          thumbnail_url: string | null
        }
        Insert: {
          blur_data_url?: string | null
          created_at?: string
          id?: string
          image_url: string
          media_duration_seconds?: number | null
          media_height?: number | null
          media_type?: string
          media_width?: number | null
          position: number
          post_id: string
          poster_url?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          blur_data_url?: string | null
          created_at?: string
          id?: string
          image_url?: string
          media_duration_seconds?: number | null
          media_height?: number | null
          media_type?: string
          media_width?: number | null
          position?: number
          post_id?: string
          poster_url?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_media_post_id_fkey"
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
          blur_data_url: string | null
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
          media_duration_seconds: number | null
          media_height: number | null
          media_type: string
          media_width: number | null
          poster_url: string | null
          source_activity_id: string | null
          source_checkin_id: string | null
          thumbnail_url: string | null
          user_id: string
          workout_date: string
          workout_type: string | null
          workout_types: string[] | null
        }
        Insert: {
          blur_data_url?: string | null
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
          media_duration_seconds?: number | null
          media_height?: number | null
          media_type?: string
          media_width?: number | null
          poster_url?: string | null
          source_activity_id?: string | null
          source_checkin_id?: string | null
          thumbnail_url?: string | null
          user_id: string
          workout_date?: string
          workout_type?: string | null
          workout_types?: string[] | null
        }
        Update: {
          blur_data_url?: string | null
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
          media_duration_seconds?: number | null
          media_height?: number | null
          media_type?: string
          media_width?: number | null
          poster_url?: string | null
          source_activity_id?: string | null
          source_checkin_id?: string | null
          thumbnail_url?: string | null
          user_id?: string
          workout_date?: string
          workout_type?: string | null
          workout_types?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "visible_profile_main_gyms"
            referencedColumns: ["gym_id"]
          },
          {
            foreignKeyName: "posts_source_activity_id_fkey"
            columns: ["source_activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_source_checkin_id_fkey"
            columns: ["source_checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          account_type: string
          alpha_terms_accepted_at: string | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          contextual_hints_seen: Json
          created_at: string
          deleted_at: string | null
          display_name: string
          featured_achievements: Json
          fitness_goal: string | null
          id: string
          instagram_username: string | null
          is_private: boolean
          main_gym_id: string | null
          monthly_recap_covers: Json
          onboarding_completed_at: string | null
          preferred_training_times: string[]
          privacy_policy_accepted_at: string | null
          profile_completion_notice_dismissed: boolean
          reactivation_expires_at: string | null
          reactivation_sent_at: string | null
          reactivation_token_hash: string | null
          sports: string[]
          suspended_at: string | null
          user_id: string
          username: string
        }
        Insert: {
          account_status?: string
          account_type?: string
          alpha_terms_accepted_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          contextual_hints_seen?: Json
          created_at?: string
          deleted_at?: string | null
          display_name: string
          featured_achievements?: Json
          fitness_goal?: string | null
          id?: string
          instagram_username?: string | null
          is_private?: boolean
          main_gym_id?: string | null
          monthly_recap_covers?: Json
          onboarding_completed_at?: string | null
          preferred_training_times?: string[]
          privacy_policy_accepted_at?: string | null
          profile_completion_notice_dismissed?: boolean
          reactivation_expires_at?: string | null
          reactivation_sent_at?: string | null
          reactivation_token_hash?: string | null
          sports?: string[]
          suspended_at?: string | null
          user_id: string
          username: string
        }
        Update: {
          account_status?: string
          account_type?: string
          alpha_terms_accepted_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          contextual_hints_seen?: Json
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          featured_achievements?: Json
          fitness_goal?: string | null
          id?: string
          instagram_username?: string | null
          is_private?: boolean
          main_gym_id?: string | null
          monthly_recap_covers?: Json
          onboarding_completed_at?: string | null
          preferred_training_times?: string[]
          privacy_policy_accepted_at?: string | null
          profile_completion_notice_dismissed?: boolean
          reactivation_expires_at?: string | null
          reactivation_sent_at?: string | null
          reactivation_token_hash?: string | null
          sports?: string[]
          suspended_at?: string | null
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
          {
            foreignKeyName: "profiles_main_gym_id_fkey"
            columns: ["main_gym_id"]
            isOneToOne: false
            referencedRelation: "visible_profile_main_gyms"
            referencedColumns: ["gym_id"]
          },
        ]
      }
      push_delivery_attempts: {
        Row: {
          created_at: string
          id: number
          notification_id: string | null
          provider: string
          provider_code: number | null
          provider_reason: string | null
          status: string
          target_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          notification_id?: string | null
          provider: string
          provider_code?: number | null
          provider_reason?: string | null
          status: string
          target_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          notification_id?: string | null
          provider?: string
          provider_code?: number | null
          provider_reason?: string | null
          status?: string
          target_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_delivery_attempts_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      push_delivery_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: number
          sent_at: string | null
          status: string
          target_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: number
          sent_at?: string | null
          status: string
          target_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: number
          sent_at?: string | null
          status?: string
          target_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
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
      running_program: {
        Row: {
          created_at: string
          description: string | null
          goal: string | null
          id: string
          is_published: boolean
          level: string | null
          origin: string
          owner_user_id: string | null
          sessions_per_week: number
          slug: string
          suggested_spacing: string | null
          time_bucket: number | null
          title: string
          updated_at: string
          visibility: string
          weeks: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          goal?: string | null
          id?: string
          is_published?: boolean
          level?: string | null
          origin?: string
          owner_user_id?: string | null
          sessions_per_week: number
          slug: string
          suggested_spacing?: string | null
          time_bucket?: number | null
          title: string
          updated_at?: string
          visibility?: string
          weeks: number
        }
        Update: {
          created_at?: string
          description?: string | null
          goal?: string | null
          id?: string
          is_published?: boolean
          level?: string | null
          origin?: string
          owner_user_id?: string | null
          sessions_per_week?: number
          slug?: string
          suggested_spacing?: string | null
          time_bucket?: number | null
          title?: string
          updated_at?: string
          visibility?: string
          weeks?: number
        }
        Relationships: []
      }
      running_program_enrollment: {
        Row: {
          completed_at: string | null
          id: string
          program_id: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          program_id: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          program_id?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "running_program_enrollment_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "running_program"
            referencedColumns: ["id"]
          },
        ]
      }
      running_program_session: {
        Row: {
          id: string
          notes: string | null
          order_in_week: number
          program_id: string
          session_template_id: string
          week_index: number
        }
        Insert: {
          id?: string
          notes?: string | null
          order_in_week: number
          program_id: string
          session_template_id: string
          week_index: number
        }
        Update: {
          id?: string
          notes?: string | null
          order_in_week?: number
          program_id?: string
          session_template_id?: string
          week_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "running_program_session_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "running_program"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "running_program_session_session_template_id_fkey"
            columns: ["session_template_id"]
            isOneToOne: false
            referencedRelation: "running_session_template"
            referencedColumns: ["id"]
          },
        ]
      }
      running_program_session_completion: {
        Row: {
          activity_id: string
          completed_at: string
          enrollment_id: string
          id: string
          program_session_id: string
        }
        Insert: {
          activity_id: string
          completed_at?: string
          enrollment_id: string
          id?: string
          program_session_id: string
        }
        Update: {
          activity_id?: string
          completed_at?: string
          enrollment_id?: string
          id?: string
          program_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "running_program_session_completion_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "running_program_session_completion_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "running_program_enrollment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "running_program_session_completion_program_session_id_fkey"
            columns: ["program_session_id"]
            isOneToOne: false
            referencedRelation: "running_program_session"
            referencedColumns: ["id"]
          },
        ]
      }
      running_session_template: {
        Row: {
          created_at: string
          description: string | null
          estimated_distance_m: number | null
          estimated_duration_s: number | null
          id: string
          is_published: boolean
          origin: string
          owner_user_id: string | null
          primary_step_type: string | null
          slug: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_distance_m?: number | null
          estimated_duration_s?: number | null
          id?: string
          is_published?: boolean
          origin?: string
          owner_user_id?: string | null
          primary_step_type?: string | null
          slug: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_distance_m?: number | null
          estimated_duration_s?: number | null
          id?: string
          is_published?: boolean
          origin?: string
          owner_user_id?: string | null
          primary_step_type?: string | null
          slug?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      running_session_template_step: {
        Row: {
          created_at: string
          distance_m: number | null
          distance_max_m: number | null
          distance_min_m: number | null
          duration_max_s: number | null
          duration_min_s: number | null
          duration_s: number | null
          heart_rate_zone: number | null
          id: string
          instructions: string | null
          metadata: Json
          pace_max_s_per_km: number | null
          pace_min_s_per_km: number | null
          position: number
          recovery_distance_m: number | null
          recovery_duration_s: number | null
          recovery_type: string
          repetitions: number
          repetitions_max: number | null
          repetitions_min: number | null
          session_template_id: string
          step_type: string
          target_basis: string
          target_effort: number | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          distance_m?: number | null
          distance_max_m?: number | null
          distance_min_m?: number | null
          duration_max_s?: number | null
          duration_min_s?: number | null
          duration_s?: number | null
          heart_rate_zone?: number | null
          id?: string
          instructions?: string | null
          metadata?: Json
          pace_max_s_per_km?: number | null
          pace_min_s_per_km?: number | null
          position: number
          recovery_distance_m?: number | null
          recovery_duration_s?: number | null
          recovery_type?: string
          repetitions?: number
          repetitions_max?: number | null
          repetitions_min?: number | null
          session_template_id: string
          step_type: string
          target_basis: string
          target_effort?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          distance_m?: number | null
          distance_max_m?: number | null
          distance_min_m?: number | null
          duration_max_s?: number | null
          duration_min_s?: number | null
          duration_s?: number | null
          heart_rate_zone?: number | null
          id?: string
          instructions?: string | null
          metadata?: Json
          pace_max_s_per_km?: number | null
          pace_min_s_per_km?: number | null
          position?: number
          recovery_distance_m?: number | null
          recovery_duration_s?: number | null
          recovery_type?: string
          repetitions?: number
          repetitions_max?: number | null
          repetitions_min?: number | null
          session_template_id?: string
          step_type?: string
          target_basis?: string
          target_effort?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "running_session_template_step_session_template_id_fkey"
            columns: ["session_template_id"]
            isOneToOne: false
            referencedRelation: "running_session_template"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          blur_data_url: string | null
          created_at: string
          expires_at: string
          gym_id: string | null
          id: string
          media_duration_seconds: number | null
          media_height: number | null
          media_type: string
          media_url: string
          media_width: number | null
          poster_url: string | null
          thumbnail_url: string | null
          user_id: string
          workout_type: string | null
        }
        Insert: {
          blur_data_url?: string | null
          created_at?: string
          expires_at?: string
          gym_id?: string | null
          id?: string
          media_duration_seconds?: number | null
          media_height?: number | null
          media_type?: string
          media_url: string
          media_width?: number | null
          poster_url?: string | null
          thumbnail_url?: string | null
          user_id: string
          workout_type?: string | null
        }
        Update: {
          blur_data_url?: string | null
          created_at?: string
          expires_at?: string
          gym_id?: string | null
          id?: string
          media_duration_seconds?: number | null
          media_height?: number | null
          media_type?: string
          media_url?: string
          media_width?: number | null
          poster_url?: string | null
          thumbnail_url?: string | null
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
          {
            foreignKeyName: "stories_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "visible_profile_main_gyms"
            referencedColumns: ["gym_id"]
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
      streak_restore_events: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string | null
          related_week: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason?: string | null
          related_week?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string | null
          related_week?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      streak_restored_days: {
        Row: {
          created_at: string
          restore_event_id: string
          restored_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          restore_event_id: string
          restored_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          restore_event_id?: string
          restored_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_restored_days_restore_event_id_fkey"
            columns: ["restore_event_id"]
            isOneToOne: false
            referencedRelation: "streak_restore_events"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_profiles: {
        Row: {
          accepts_new_clients: boolean
          city: string | null
          contact_cta_enabled: boolean
          created_at: string
          headline: string
          in_person_service: boolean | null
          online_service: boolean | null
          professional_bio: string
          professional_name: string
          profile_visibility: string
          service_modes: string[]
          specialties: string[]
          state: string | null
          updated_at: string
          user_id: string
          verification_status: string
          years_experience: number | null
        }
        Insert: {
          accepts_new_clients?: boolean
          city?: string | null
          contact_cta_enabled?: boolean
          created_at?: string
          headline: string
          in_person_service?: boolean | null
          online_service?: boolean | null
          professional_bio: string
          professional_name: string
          profile_visibility?: string
          service_modes: string[]
          specialties: string[]
          state?: string | null
          updated_at?: string
          user_id: string
          verification_status?: string
          years_experience?: number | null
        }
        Update: {
          accepts_new_clients?: boolean
          city?: string | null
          contact_cta_enabled?: boolean
          created_at?: string
          headline?: string
          in_person_service?: boolean | null
          online_service?: boolean | null
          professional_bio?: string
          professional_name?: string
          profile_visibility?: string
          service_modes?: string[]
          specialties?: string[]
          state?: string | null
          updated_at?: string
          user_id?: string
          verification_status?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trainer_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trainer_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "visible_profile_main_gyms"
            referencedColumns: ["user_id"]
          },
        ]
      }
      trainer_verification_requests: {
        Row: {
          created_at: string
          id: string
          registration_number: string
          registration_region: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          registration_number: string
          registration_region: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          registration_number?: string
          registration_region?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_verification_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      trainer_workspace_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          role: string
          status?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_workspace_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trainer_workspace_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "visible_profile_main_gyms"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trainer_workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trainer_workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "visible_profile_main_gyms"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trainer_workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "trainer_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_workspaces: {
        Row: {
          city: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          owner_user_id: string
          slug: string | null
          state: string | null
          status: string
          updated_at: string
          workspace_type: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_user_id: string
          slug?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          workspace_type?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_user_id?: string
          slug?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          workspace_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_workspaces_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trainer_workspaces_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "visible_profile_main_gyms"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          celebrated_at: string | null
          count: number
          earned_at: string
          last_earned_at: string
          metadata: Json
          user_id: string
        }
        Insert: {
          achievement_id: string
          celebrated_at?: string | null
          count?: number
          earned_at?: string
          last_earned_at?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          achievement_id?: string
          celebrated_at?: string | null
          count?: number
          earned_at?: string
          last_earned_at?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "user_gyms_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "visible_profile_main_gyms"
            referencedColumns: ["gym_id"]
          },
        ]
      }
      user_monthly_challenge_progress: {
        Row: {
          challenge_id: string
          completed_at: string | null
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_monthly_challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "monthly_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sport_preferences: {
        Row: {
          created_at: string
          is_favorite: boolean
          sport_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_favorite?: boolean
          sport_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_favorite?: boolean
          sport_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          active_days_this_year: number
          badge_is_active_today: boolean
          best_streak: number
          current_streak: number
          last_active_date: string | null
          last_streak_restore_earned_at: string | null
          last_streak_restore_used_at: string | null
          streak_restore_deadline_at: string | null
          streak_restore_missed_date: string | null
          streak_restore_status: string | null
          streak_restores_available: number
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
          last_streak_restore_earned_at?: string | null
          last_streak_restore_used_at?: string | null
          streak_restore_deadline_at?: string | null
          streak_restore_missed_date?: string | null
          streak_restore_status?: string | null
          streak_restores_available?: number
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
          last_streak_restore_earned_at?: string | null
          last_streak_restore_used_at?: string | null
          streak_restore_deadline_at?: string | null
          streak_restore_missed_date?: string | null
          streak_restore_status?: string | null
          streak_restores_available?: number
          updated_at?: string
          user_id?: string
          workouts_this_month?: number
        }
        Relationships: []
      }
      user_workout_exercise_preferences: {
        Row: {
          created_at: string
          exercise_id: string
          is_favorite: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          is_favorite?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          is_favorite?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_workout_exercise_preferences_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercise_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_equipment_catalog: {
        Row: {
          aliases_en: string[]
          aliases_pt: string[]
          created_at: string
          id: string
          kind: string
          manufacturer: string | null
          model: string | null
          name_en: string
          name_pt: string
          parent_equipment_id: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          aliases_en?: string[]
          aliases_pt?: string[]
          created_at?: string
          id?: string
          kind?: string
          manufacturer?: string | null
          model?: string | null
          name_en: string
          name_pt: string
          parent_equipment_id?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          aliases_en?: string[]
          aliases_pt?: string[]
          created_at?: string
          id?: string
          kind?: string
          manufacturer?: string | null
          model?: string | null
          name_en?: string
          name_pt?: string
          parent_equipment_id?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_equipment_catalog_parent_equipment_id_fkey"
            columns: ["parent_equipment_id"]
            isOneToOne: false
            referencedRelation: "workout_equipment_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_exercise_catalog: {
        Row: {
          aliases: string[]
          aliases_en: string[]
          aliases_pt: string[]
          asset_license: string | null
          asset_source_url: string | null
          common_mistakes_en: string[]
          common_mistakes_pt: string[]
          compatible_equipments: string[]
          created_at: string
          created_by: string | null
          default_distance_m: number | null
          default_duration_s: number | null
          default_load_type: string | null
          default_reps: number | null
          default_rest_s: number | null
          default_rpe: number | null
          default_target_kind: string | null
          description_en: string
          description_pt: string
          difficulty: string | null
          editorial_review_version: string | null
          equipment: string[]
          execution_steps_en: string[]
          execution_steps_pt: string[]
          exercise_priority_score: number
          exercise_type: string | null
          id: string
          instructions_en: string[]
          instructions_pt: string[]
          movement_pattern: string | null
          name_en: string
          name_pt: string
          optional_equipment: string[]
          parent_exercise_id: string | null
          primary_equipment: string | null
          primary_muscle_group_slug: string
          required_equipment: string[]
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          secondary_muscle_group_slugs: string[]
          slug: string
          status: string
          updated_at: string
          video_search_query: string | null
          video_url: string | null
        }
        Insert: {
          aliases?: string[]
          aliases_en?: string[]
          aliases_pt?: string[]
          asset_license?: string | null
          asset_source_url?: string | null
          common_mistakes_en?: string[]
          common_mistakes_pt?: string[]
          compatible_equipments?: string[]
          created_at?: string
          created_by?: string | null
          default_distance_m?: number | null
          default_duration_s?: number | null
          default_load_type?: string | null
          default_reps?: number | null
          default_rest_s?: number | null
          default_rpe?: number | null
          default_target_kind?: string | null
          description_en: string
          description_pt: string
          difficulty?: string | null
          editorial_review_version?: string | null
          equipment?: string[]
          execution_steps_en?: string[]
          execution_steps_pt?: string[]
          exercise_priority_score?: number
          exercise_type?: string | null
          id?: string
          instructions_en?: string[]
          instructions_pt?: string[]
          movement_pattern?: string | null
          name_en: string
          name_pt: string
          optional_equipment?: string[]
          parent_exercise_id?: string | null
          primary_equipment?: string | null
          primary_muscle_group_slug: string
          required_equipment?: string[]
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          secondary_muscle_group_slugs?: string[]
          slug: string
          status?: string
          updated_at?: string
          video_search_query?: string | null
          video_url?: string | null
        }
        Update: {
          aliases?: string[]
          aliases_en?: string[]
          aliases_pt?: string[]
          asset_license?: string | null
          asset_source_url?: string | null
          common_mistakes_en?: string[]
          common_mistakes_pt?: string[]
          compatible_equipments?: string[]
          created_at?: string
          created_by?: string | null
          default_distance_m?: number | null
          default_duration_s?: number | null
          default_load_type?: string | null
          default_reps?: number | null
          default_rest_s?: number | null
          default_rpe?: number | null
          default_target_kind?: string | null
          description_en?: string
          description_pt?: string
          difficulty?: string | null
          editorial_review_version?: string | null
          equipment?: string[]
          execution_steps_en?: string[]
          execution_steps_pt?: string[]
          exercise_priority_score?: number
          exercise_type?: string | null
          id?: string
          instructions_en?: string[]
          instructions_pt?: string[]
          movement_pattern?: string | null
          name_en?: string
          name_pt?: string
          optional_equipment?: string[]
          parent_exercise_id?: string | null
          primary_equipment?: string | null
          primary_muscle_group_slug?: string
          required_equipment?: string[]
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          secondary_muscle_group_slugs?: string[]
          slug?: string
          status?: string
          updated_at?: string
          video_search_query?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercise_catalog_parent_exercise_id_fkey"
            columns: ["parent_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercise_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercise_catalog_primary_muscle_group_slug_fkey"
            columns: ["primary_muscle_group_slug"]
            isOneToOne: false
            referencedRelation: "workout_muscle_groups"
            referencedColumns: ["slug"]
          },
        ]
      }
      workout_exercise_equipment_compatibility: {
        Row: {
          compatibility_role: string
          created_at: string
          equipment_id: string
          exercise_id: string
          sort_order: number
        }
        Insert: {
          compatibility_role: string
          created_at?: string
          equipment_id: string
          exercise_id: string
          sort_order?: number
        }
        Update: {
          compatibility_role?: string
          created_at?: string
          equipment_id?: string
          exercise_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercise_equipment_compatibility_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "workout_equipment_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercise_equipment_compatibility_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercise_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_exercise_relations: {
        Row: {
          created_at: string
          rationale_en: string | null
          rationale_pt: string | null
          relation_type: string
          review_status: string
          sort_order: number
          source_exercise_id: string
          target_exercise_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          rationale_en?: string | null
          rationale_pt?: string | null
          relation_type: string
          review_status?: string
          sort_order?: number
          source_exercise_id: string
          target_exercise_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          rationale_en?: string | null
          rationale_pt?: string | null
          relation_type?: string
          review_status?: string
          sort_order?: number
          source_exercise_id?: string
          target_exercise_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercise_relations_source_exercise_id_fkey"
            columns: ["source_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercise_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercise_relations_target_exercise_id_fkey"
            columns: ["target_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercise_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_muscle_groups: {
        Row: {
          created_at: string
          icon_key: string
          name_en: string
          name_pt: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon_key?: string
          name_en: string
          name_pt: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon_key?: string
          name_en?: string
          name_pt?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      workout_plan_steps: {
        Row: {
          created_at: string
          distance_m: number | null
          distance_max_m: number | null
          distance_min_m: number | null
          duration_max_s: number | null
          duration_min_s: number | null
          duration_s: number | null
          heart_rate_zone: number | null
          id: string
          instructions: string | null
          metadata: Json
          pace_max_s_per_km: number | null
          pace_min_s_per_km: number | null
          position: number
          recovery_distance_m: number | null
          recovery_duration_s: number | null
          recovery_type: string
          repetitions: number
          repetitions_max: number | null
          repetitions_min: number | null
          step_type: string
          target_basis: string
          target_effort: number | null
          title: string
          updated_at: string
          workout_plan_id: string
        }
        Insert: {
          created_at?: string
          distance_m?: number | null
          distance_max_m?: number | null
          distance_min_m?: number | null
          duration_max_s?: number | null
          duration_min_s?: number | null
          duration_s?: number | null
          heart_rate_zone?: number | null
          id?: string
          instructions?: string | null
          metadata?: Json
          pace_max_s_per_km?: number | null
          pace_min_s_per_km?: number | null
          position: number
          recovery_distance_m?: number | null
          recovery_duration_s?: number | null
          recovery_type?: string
          repetitions?: number
          repetitions_max?: number | null
          repetitions_min?: number | null
          step_type: string
          target_basis: string
          target_effort?: number | null
          title: string
          updated_at?: string
          workout_plan_id: string
        }
        Update: {
          created_at?: string
          distance_m?: number | null
          distance_max_m?: number | null
          distance_min_m?: number | null
          duration_max_s?: number | null
          duration_min_s?: number | null
          duration_s?: number | null
          heart_rate_zone?: number | null
          id?: string
          instructions?: string | null
          metadata?: Json
          pace_max_s_per_km?: number | null
          pace_min_s_per_km?: number | null
          position?: number
          recovery_distance_m?: number | null
          recovery_duration_s?: number | null
          recovery_type?: string
          repetitions?: number
          repetitions_max?: number | null
          repetitions_min?: number | null
          step_type?: string
          target_basis?: string
          target_effort?: number | null
          title?: string
          updated_at?: string
          workout_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plan_steps_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          created_at: string
          description: string | null
          estimated_distance_m: number | null
          estimated_duration_s: number | null
          exercises: Json
          goal: string | null
          id: string
          is_favorite: boolean
          level: string | null
          name: string
          plan_version: number
          source: string
          source_metadata: Json
          sport_type: string
          structure_revision: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_distance_m?: number | null
          estimated_duration_s?: number | null
          exercises?: Json
          goal?: string | null
          id?: string
          is_favorite?: boolean
          level?: string | null
          name: string
          plan_version?: number
          source?: string
          source_metadata?: Json
          sport_type?: string
          structure_revision?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_distance_m?: number | null
          estimated_duration_s?: number | null
          exercises?: Json
          goal?: string | null
          id?: string
          is_favorite?: boolean
          level?: string | null
          name?: string
          plan_version?: number
          source?: string
          source_metadata?: Json
          sport_type?: string
          structure_revision?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_technique_catalog: {
        Row: {
          aliases: string[]
          asset_license: string | null
          asset_source_url: string | null
          created_at: string
          created_by: string | null
          id: string
          instructions_en: string[]
          instructions_pt: string[]
          name_en: string
          name_pt: string
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          status: string
          summary_en: string
          summary_pt: string
          updated_at: string
          video_search_query: string | null
          video_url: string | null
        }
        Insert: {
          aliases?: string[]
          asset_license?: string | null
          asset_source_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          instructions_en?: string[]
          instructions_pt?: string[]
          name_en: string
          name_pt: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          status?: string
          summary_en: string
          summary_pt: string
          updated_at?: string
          video_search_query?: string | null
          video_url?: string | null
        }
        Update: {
          aliases?: string[]
          asset_license?: string | null
          asset_source_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          instructions_en?: string[]
          instructions_pt?: string[]
          name_en?: string
          name_pt?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          status?: string
          summary_en?: string
          summary_pt?: string
          updated_at?: string
          video_search_query?: string | null
          video_url?: string | null
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
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          joined_at?: string | null
          last_read_at?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          joined_at?: string | null
          last_read_at?: string | null
          role?: string | null
          user_id?: string | null
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
          {
            foreignKeyName: "posts_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "visible_profile_main_gyms"
            referencedColumns: ["gym_id"]
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
          last_streak_restore_earned_at: string | null
          last_streak_restore_used_at: string | null
          streak_restore_deadline_at: string | null
          streak_restore_missed_date: string | null
          streak_restore_status: string | null
          streak_restores_available: number | null
          updated_at: string | null
          user_id: string | null
          workouts_this_month: number | null
        }
        Relationships: []
      }
      visible_profile_main_gyms: {
        Row: {
          city: string | null
          gym_id: string | null
          name: string | null
          state: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      abandon_running_program: {
        Args: { p_enrollment_id: string }
        Returns: undefined
      }
      accept_alpha_legal: {
        Args: { p_privacy_version?: string; p_terms_version?: string }
        Returns: undefined
      }
      add_group_conversation_members: {
        Args: { p_conversation_id: string; p_member_ids: string[] }
        Returns: undefined
      }
      backfill_user_achievements_server_side: { Args: never; Returns: number }
      complete_program_session: {
        Args: {
          p_activity_id: string
          p_enrollment_id: string
          p_program_session_id: string
        }
        Returns: undefined
      }
      convert_social_post_to_checkin: {
        Args: { p_gym_id: string; p_post_id: string }
        Returns: string
      }
      create_group_conversation: {
        Args: { p_image_url?: string; p_member_ids: string[]; p_name: string }
        Returns: string
      }
      create_social_post_with_media: {
        Args: { p_media: Json; p_post: Json }
        Returns: {
          blur_data_url: string | null
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
          media_duration_seconds: number | null
          media_height: number | null
          media_type: string
          media_width: number | null
          poster_url: string | null
          source_activity_id: string | null
          source_checkin_id: string | null
          thumbnail_url: string | null
          user_id: string
          workout_date: string
          workout_type: string | null
          workout_types: string[] | null
        }
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_trainer_workspace: {
        Args: { p_name: string; p_workspace_type?: string }
        Returns: {
          city: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          owner_user_id: string
          slug: string | null
          state: string | null
          status: string
          updated_at: string
          workspace_type: string
        }
        SetofOptions: {
          from: "*"
          to: "trainer_workspaces"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_conversation_for_me: {
        Args: { p_conversation_id: string }
        Returns: string
      }
      delete_direct_conversation_for_me: {
        Args: { p_other_user_id: string }
        Returns: string
      }
      delete_my_account: { Args: never; Returns: undefined }
      duplicate_running_workout_plan: {
        Args: { p_name?: string; p_plan_id: string }
        Returns: string
      }
      edge_push_dispatch_secret: { Args: never; Returns: string }
      edge_push_vapid_keys: { Args: never; Returns: string }
      edge_store_push_vapid_keys: { Args: { p_keys: string }; Returns: string }
      enroll_in_running_program: {
        Args: { p_program_id: string }
        Returns: string
      }
      finalize_workout_activity: {
        Args: { p_client_session_id: string; p_payload: Json }
        Returns: {
          active_calories: number | null
          activity_type: string
          avg_hr: number | null
          caption: string | null
          client_session_id: string | null
          created_at: string
          distance_m: number | null
          elapsed_s: number
          elevation_gain_m: number | null
          ended_at: string
          external_id: string | null
          gym_id: string | null
          health_metadata: Json
          id: string
          location_google_maps_url: string | null
          location_latitude: number | null
          location_longitude: number | null
          location_name: string | null
          location_source: string
          max_hr: number | null
          mode: string
          moving_s: number | null
          origin: string
          publication_state: string
          route: Json | null
          source_app: string | null
          splits: Json | null
          started_at: string
          strength_sets: Json | null
          total_calories: number | null
          user_id: string
          workout_date: string
          workout_exercise_context: Json
          workout_note: string | null
          workout_plan_exercises_snapshot: Json | null
          workout_plan_id: string | null
          workout_plan_name_snapshot: string | null
          workout_plan_started_from: string | null
          workout_plan_version_snapshot: number | null
          workout_types: string[] | null
        }
        SetofOptions: {
          from: "*"
          to: "activities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_achievement_global_stats: {
        Args: { p_achievement_id: string }
        Returns: {
          earned_count: number
          total_users: number
        }[]
      }
      get_achievement_rarity_summary: {
        Args: never
        Returns: {
          achievement_id: string
          owned_percent: number
          owners_count: number
          total_users: number
        }[]
      }
      get_activity_detail_v2: {
        Args: { p_activity_id?: string; p_post_id?: string }
        Returns: {
          active_calories: number | null
          activity_type: string
          avg_hr: number | null
          caption: string | null
          client_session_id: string | null
          created_at: string
          distance_m: number | null
          elapsed_s: number
          elevation_gain_m: number | null
          ended_at: string
          external_id: string | null
          gym_id: string | null
          health_metadata: Json
          id: string
          location_google_maps_url: string | null
          location_latitude: number | null
          location_longitude: number | null
          location_name: string | null
          location_source: string
          max_hr: number | null
          mode: string
          moving_s: number | null
          origin: string
          publication_state: string
          route: Json | null
          source_app: string | null
          splits: Json | null
          started_at: string
          strength_sets: Json | null
          total_calories: number | null
          user_id: string
          workout_date: string
          workout_exercise_context: Json
          workout_note: string | null
          workout_plan_exercises_snapshot: Json | null
          workout_plan_id: string | null
          workout_plan_name_snapshot: string | null
          workout_plan_started_from: string | null
          workout_plan_version_snapshot: number | null
          workout_types: string[] | null
        }
        SetofOptions: {
          from: "*"
          to: "activities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_activity_record_highlights: {
        Args: { p_activity_id: string }
        Returns: {
          achieved_at: string
          activity_id: string
          exercise_id: string
          exercise_key: string
          exercise_name: string
          highlight_id: string
          is_estimated: boolean
          metric_key: string
          reps: number
          unit: string
          value: number
        }[]
      }
      get_circle_ranking: {
        Args: { p_limit?: number; p_period?: string; p_scope?: string }
        Returns: {
          achievement_points: number
          avatar_url: string
          badge_is_active_today: boolean
          current_streak: number
          display_name: string
          rank: number
          total_points: number
          user_id: string
          username: string
          workout_days: number
        }[]
      }
      get_conversation_messages: {
        Args: {
          p_conversation_id: string
          p_cursor_created_at?: string
          p_limit?: number
        }
        Returns: {
          blur_data_url: string
          body: string
          conversation_id: string
          created_at: string
          id: string
          media_duration_seconds: number
          media_height: number
          media_type: string
          media_url: string
          media_width: number
          poster_url: string
          read_at: string
          receiver_id: string
          reply_to_story: boolean
          sender_id: string
          story_id: string
          story_preview_url: string
          thumbnail_url: string
        }[]
      }
      get_conversation_summaries: {
        Args: never
        Returns: {
          conversation_id: string
          deleted_at: string
          image_url: string
          last_message: Json
          last_message_at: string
          last_read_at: string
          name: string
          participants: Json
          role: string
          type: string
          unread_count: number
        }[]
      }
      get_founder_status: {
        Args: { p_user_ids?: string[] }
        Returns: {
          founder_rank: number
          is_founder: boolean
          user_id: string
        }[]
      }
      get_home_activities: {
        Args: { p_limit?: number }
        Returns: {
          active_calories: number
          activity_type: string
          author_badge_active: boolean
          author_best_streak: number
          author_current_streak: number
          avatar_url: string
          avg_hr: number
          caption: string
          created_at: string
          display_name: string
          distance_m: number
          elapsed_s: number
          elevation_gain_m: number
          ended_at: string
          gym_id: string
          gym_name: string
          id: string
          is_following_author: boolean
          location_google_maps_url: string
          location_latitude: number
          location_longitude: number
          location_name: string
          max_hr: number
          mode: string
          moving_s: number
          origin: string
          route: Json
          source_app: string
          started_at: string
          strength_sets: Json
          total_calories: number
          user_id: string
          username: string
          visibility: string
          workout_date: string
          workout_types: string[]
        }[]
      }
      get_home_checkins: {
        Args: { p_limit?: number }
        Returns: {
          author_badge_active: boolean
          author_best_streak: number
          author_current_streak: number
          avatar_url: string
          checkin_date: string
          created_at: string
          display_name: string
          gym_address: string
          gym_city: string
          gym_id: string
          gym_latitude: number
          gym_longitude: number
          gym_name: string
          gym_state: string
          id: string
          is_following_author: boolean
          user_id: string
          username: string
          visibility: string
        }[]
      }
      get_home_feed: {
        Args: { p_cursor_created_at?: string; p_limit?: number }
        Returns: {
          author_badge_active: boolean
          author_best_streak: number
          author_current_streak: number
          avatar_url: string
          blur_data_url: string
          caption: string
          comment_previews: Json
          comments_count: number
          created_at: string
          display_name: string
          gym_id: string
          id: string
          image_url: string
          is_following_author: boolean
          liked_by_me: boolean
          liked_by_preview: Json
          likes_count: number
          location_google_maps_url: string
          location_latitude: number
          location_longitude: number
          location_name: string
          location_source: string
          media_duration_seconds: number
          media_height: number
          media_type: string
          media_width: number
          poster_url: string
          thumbnail_url: string
          user_id: string
          username: string
          visibility: string
          workout_active_calories: number
          workout_activity_type: string
          workout_avg_hr: number
          workout_date: string
          workout_distance_m: number
          workout_elapsed_s: number
          workout_elevation_gain_m: number
          workout_ended_at: string
          workout_moving_s: number
          workout_route: Json
          workout_started_at: string
          workout_strength_sets: Json
          workout_total_calories: number
          workout_type: string
        }[]
      }
      get_mergeable_activities: {
        Args: { p_workout_date: string }
        Returns: {
          activity_type: string
          avg_hr: number
          distance_m: number
          elapsed_s: number
          elevation_gain_m: number
          ended_at: string
          id: string
          moving_s: number
          started_at: string
          total_calories: number
        }[]
      }
      get_my_workout_plan_stats: {
        Args: never
        Returns: {
          average_completion_rate: number
          average_duration_s: number
          average_volume_kg: number
          completed_planned_sets: number
          execution_count: number
          last_executed_at: string
          max_volume_kg: number
          planned_sets: number
          workout_plan_id: string
        }[]
      }
      get_personal_record_leaderboard: {
        Args: {
          p_exercise_key?: string
          p_limit?: number
          p_metric_key: string
        }
        Returns: {
          achieved_at: string
          avatar_url: string
          display_name: string
          is_estimated: boolean
          rank: number
          reps: number
          unit: string
          user_id: string
          username: string
          value: number
        }[]
      }
      get_personal_records: {
        Args: { p_user_id?: string }
        Returns: {
          achieved_at: string
          activity_id: string
          exercise_key: string
          exercise_name: string
          is_estimated: boolean
          metric_key: string
          record_id: string
          reps: number
          unit: string
          user_id: string
          value: number
        }[]
      }
      get_personal_records_v2: {
        Args: { p_user_id?: string }
        Returns: {
          achieved_at: string
          activity_id: string
          exercise_id: string
          exercise_key: string
          exercise_name: string
          is_estimated: boolean
          metric_key: string
          record_id: string
          reps: number
          unit: string
          user_id: string
          value: number
        }[]
      }
      get_post_activities: {
        Args: { p_post_id: string }
        Returns: {
          activity_type: string
          avg_hr: number
          distance_m: number
          elapsed_s: number
          elevation_gain_m: number
          ended_at: string
          id: string
          moving_s: number
          started_at: string
          total_calories: number
        }[]
      }
      get_post_activity_details: {
        Args: { p_post_id: string }
        Returns: {
          active_calories: number | null
          activity_type: string
          avg_hr: number | null
          caption: string | null
          client_session_id: string | null
          created_at: string
          distance_m: number | null
          elapsed_s: number
          elevation_gain_m: number | null
          ended_at: string
          external_id: string | null
          gym_id: string | null
          health_metadata: Json
          id: string
          location_google_maps_url: string | null
          location_latitude: number | null
          location_longitude: number | null
          location_name: string | null
          location_source: string
          max_hr: number | null
          mode: string
          moving_s: number | null
          origin: string
          publication_state: string
          route: Json | null
          source_app: string | null
          splits: Json | null
          started_at: string
          strength_sets: Json | null
          total_calories: number | null
          user_id: string
          workout_date: string
          workout_exercise_context: Json
          workout_note: string | null
          workout_plan_exercises_snapshot: Json | null
          workout_plan_id: string | null
          workout_plan_name_snapshot: string | null
          workout_plan_started_from: string | null
          workout_plan_version_snapshot: number | null
          workout_types: string[] | null
        }[]
        SetofOptions: {
          from: "*"
          to: "activities"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_post_workout_record_highlights: {
        Args: { p_post_ids: string[] }
        Returns: {
          highlights: Json
          post_id: string
        }[]
      }
      get_profile_posts: {
        Args: {
          p_cursor_created_at?: string
          p_limit?: number
          p_user_id: string
        }
        Returns: {
          author_badge_active: boolean
          author_best_streak: number
          author_current_streak: number
          avatar_url: string
          blur_data_url: string
          caption: string
          comments_count: number
          created_at: string
          display_name: string
          gym_id: string
          id: string
          image_url: string
          is_following_author: boolean
          liked_by_me: boolean
          likes_count: number
          location_google_maps_url: string
          location_latitude: number
          location_longitude: number
          location_name: string
          location_source: string
          media_duration_seconds: number
          media_height: number
          media_type: string
          media_width: number
          poster_url: string
          thumbnail_url: string
          user_id: string
          username: string
          visibility: string
          workout_active_calories: number
          workout_activity_type: string
          workout_avg_hr: number
          workout_date: string
          workout_distance_m: number
          workout_elapsed_s: number
          workout_elevation_gain_m: number
          workout_ended_at: string
          workout_moving_s: number
          workout_route: Json
          workout_started_at: string
          workout_total_calories: number
          workout_type: string
          workout_types: string[]
        }[]
      }
      get_story_tray: {
        Args: { p_limit?: number }
        Returns: {
          author_badge_active: boolean
          author_current_streak: number
          avatar_url: string
          created_at: string
          display_name: string
          expires_at: string
          gym_id: string
          has_unseen: boolean
          id: string
          latest_story_at: string
          media_type: string
          media_url: string
          user_id: string
          username: string
          workout_type: string
        }[]
      }
      get_story_tray_lightweight: {
        Args: { p_limit?: number }
        Returns: {
          author_id: string
          avatar_url: string
          badge_is_active_today: boolean
          current_streak: number
          display_name: string
          first_story_id: string
          first_unseen_story_id: string
          has_unseen: boolean
          latest_story_at: string
          story_count: number
          username: string
        }[]
      }
      get_story_viewer_items: {
        Args: { p_author_id: string }
        Returns: {
          blur_data_url: string
          caption: string
          created_at: string
          expires_at: string
          gym_id: string
          likes_count: number
          location_name: string
          media_duration_seconds: number
          media_height: number
          media_type: string
          media_url: string
          media_width: number
          poster_url: string
          story_id: string
          thumbnail_url: string
          user_id: string
          viewer_has_liked: boolean
          viewer_has_seen: boolean
          workout_type: string
        }[]
      }
      get_user_suggestions: {
        Args: {
          p_current_lat?: number
          p_current_lng?: number
          p_limit?: number
        }
        Returns: {
          avatar_url: string
          badge_is_active_today: boolean
          current_streak: number
          display_name: string
          distance_km: number
          follow_status: string
          mutual_friends_count: number
          primary_reason: string
          shared_gym_name: string
          user_id: string
          username: string
        }[]
      }
      get_visible_profile_gym: {
        Args: { p_user_id: string }
        Returns: {
          city: string
          gym_id: string
          name: string
          state: string
        }[]
      }
      issue_account_reactivation_token: {
        Args: never
        Returns: {
          reactivation_expires_at: string
          reactivation_token: string
        }[]
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      mark_onboarding_complete: { Args: never; Returns: undefined }
      merge_activity_into_post: {
        Args: { p_activity_id: string; p_post_id: string }
        Returns: undefined
      }
      reactivate_suspended_account: {
        Args: { p_token: string }
        Returns: undefined
      }
      refresh_my_stats: { Args: never; Returns: undefined }
      register_external_gym: {
        Args: {
          p_address?: string
          p_city: string
          p_external_id: string
          p_latitude: number
          p_longitude: number
          p_name: string
          p_provider: string
          p_provider_category?: string
          p_source_service?: string
          p_state?: string
        }
        Returns: string
      }
      remove_group_conversation_member: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: undefined
      }
      reorder_running_workout_plan_steps: {
        Args: { p_plan_id: string; p_step_ids: string[] }
        Returns: undefined
      }
      replace_social_post_media: {
        Args: { p_media: Json; p_post_id: string }
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
      save_running_workout_plan: {
        Args: { p_plan: Json; p_plan_id: string }
        Returns: string
      }
      search_profiles: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          avatar_url: string
          badge_is_active_today: boolean
          current_streak: number
          display_name: string
          follow_status: string
          is_private: boolean
          user_id: string
          username: string
        }[]
      }
      send_direct_message: {
        Args: {
          p_body?: string
          p_media_type?: string
          p_media_url?: string
          p_receiver_id: string
          p_reply_to_story?: boolean
          p_story_id?: string
          p_story_preview_url?: string
        }
        Returns: {
          blur_data_url: string | null
          body: string | null
          conversation_id: string | null
          created_at: string
          id: string
          media_duration_seconds: number | null
          media_height: number | null
          media_type: string | null
          media_url: string | null
          media_width: number | null
          poster_url: string | null
          read_at: string | null
          receiver_id: string | null
          reply_to_story: boolean
          sender_id: string
          story_id: string | null
          story_preview_url: string | null
          thumbnail_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "direct_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_group_message: {
        Args: {
          p_body?: string
          p_conversation_id: string
          p_media_type?: string
          p_media_url?: string
        }
        Returns: {
          blur_data_url: string | null
          body: string | null
          conversation_id: string | null
          created_at: string
          id: string
          media_duration_seconds: number | null
          media_height: number | null
          media_type: string | null
          media_url: string | null
          media_width: number | null
          poster_url: string | null
          read_at: string | null
          receiver_id: string | null
          reply_to_story: boolean
          sender_id: string
          story_id: string | null
          story_preview_url: string | null
          thumbnail_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "direct_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_workout_exercise: {
        Args: {
          p_description?: string
          p_name: string
          p_primary_muscle_group_slug?: string
        }
        Returns: {
          aliases: string[]
          aliases_en: string[]
          aliases_pt: string[]
          asset_license: string | null
          asset_source_url: string | null
          common_mistakes_en: string[]
          common_mistakes_pt: string[]
          compatible_equipments: string[]
          created_at: string
          created_by: string | null
          default_distance_m: number | null
          default_duration_s: number | null
          default_load_type: string | null
          default_reps: number | null
          default_rest_s: number | null
          default_rpe: number | null
          default_target_kind: string | null
          description_en: string
          description_pt: string
          difficulty: string | null
          editorial_review_version: string | null
          equipment: string[]
          execution_steps_en: string[]
          execution_steps_pt: string[]
          exercise_priority_score: number
          exercise_type: string | null
          id: string
          instructions_en: string[]
          instructions_pt: string[]
          movement_pattern: string | null
          name_en: string
          name_pt: string
          optional_equipment: string[]
          parent_exercise_id: string | null
          primary_equipment: string | null
          primary_muscle_group_slug: string
          required_equipment: string[]
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          secondary_muscle_group_slugs: string[]
          slug: string
          status: string
          updated_at: string
          video_search_query: string | null
          video_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "workout_exercise_catalog"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_workout_technique: {
        Args: { p_name: string; p_summary?: string }
        Returns: {
          aliases: string[]
          asset_license: string | null
          asset_source_url: string | null
          created_at: string
          created_by: string | null
          id: string
          instructions_en: string[]
          instructions_pt: string[]
          name_en: string
          name_pt: string
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          status: string
          summary_en: string
          summary_pt: string
          updated_at: string
          video_search_query: string | null
          video_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "workout_technique_catalog"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      suspend_own_account: {
        Args: never
        Returns: {
          reactivation_expires_at: string
          reactivation_token: string
        }[]
      }
      sync_my_streak_restores: { Args: never; Returns: undefined }
      update_social_checkin: {
        Args: { p_checkin_id: string; p_gym_id: string }
        Returns: string
      }
      update_social_post: {
        Args: {
          p_caption?: string
          p_gym_id?: string
          p_post_id: string
          p_workout_types?: string[]
        }
        Returns: undefined
      }
      update_social_post_full: {
        Args: {
          p_caption?: string
          p_gym_id?: string
          p_media?: Json
          p_post_id: string
          p_workout_types?: string[]
        }
        Returns: undefined
      }
      use_streak_restore: { Args: never; Returns: undefined }
      workout_catalog_equipment_slug: {
        Args: { value: string }
        Returns: string
      }
      workout_catalog_slug: { Args: { value: string }; Returns: string }
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

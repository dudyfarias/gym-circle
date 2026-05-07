import type { ProfileRow } from "../domain/types";
import type { GymCircleClient } from "./supabase";

export type ProfileUpdate = Partial<{
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  fitness_goal: string | null;
  main_gym_id: string | null;
  preferred_training_times: string[];
  is_private: boolean;
}>;

export function profileService(client: GymCircleClient) {
  return {
    async byUserId(userId: string): Promise<ProfileRow | null> {
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async byUsername(username: string): Promise<ProfileRow | null> {
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("username", username.toLowerCase())
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async update(userId: string, patch: ProfileUpdate): Promise<ProfileRow> {
      const { data, error } = await client
        .from("profiles")
        .update(patch)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },

    async listSuggested(currentUserId: string, limit = 10): Promise<ProfileRow[]> {
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .neq("user_id", currentUserId)
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  };
}

export type ProfileService = ReturnType<typeof profileService>;

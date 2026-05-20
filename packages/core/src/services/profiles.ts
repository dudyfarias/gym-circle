import type { ProfileRow } from "../domain/types";
import type { GymCircleClient } from "./supabase";

export type ProfileUpdate = Partial<{
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  fitness_goal: string | null;
  instagram_username: string | null;
  birth_date: string | null;
  sports: string[];
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
      const cleanPatch = Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      ) as ProfileUpdate;

      if (Object.keys(cleanPatch).length === 0) {
        const { data: current, error: currentError } = await client
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (currentError) throw currentError;
        if (!current) throw new Error("Perfil não encontrado.");
        return current;
      }

      const { data, error } = await client
        .from("profiles")
        .update(cleanPatch)
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

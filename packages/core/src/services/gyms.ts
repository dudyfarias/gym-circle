import type { GymRow, UserGymRow } from "../domain/types";
import type { GymCircleClient } from "./supabase";

export function gymService(client: GymCircleClient) {
  return {
    async list(limit = 50): Promise<GymRow[]> {
      const { data, error } = await client
        .from("gyms")
        .select("*")
        .order("name", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },

    async byId(id: string): Promise<GymRow | null> {
      const { data, error } = await client.from("gyms").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },

    async listForUser(userId: string): Promise<UserGymRow[]> {
      const { data, error } = await client
        .from("user_gyms")
        .select("*")
        .eq("user_id", userId)
        .order("is_main", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },

    async addUserGym(userId: string, gymId: string, isMain = false) {
      const { data, error } = await client
        .from("user_gyms")
        .insert({ user_id: userId, gym_id: gymId, is_main: isMain })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },

    async removeUserGym(userId: string, gymId: string) {
      const { error } = await client
        .from("user_gyms")
        .delete()
        .match({ user_id: userId, gym_id: gymId });
      if (error) throw error;
    },
  };
}

export type GymService = ReturnType<typeof gymService>;

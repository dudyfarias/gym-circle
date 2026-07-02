import type { CheckinRow } from "../domain/types";
import { getGymCircleDateKey } from "../domain/time";
import type { GymCircleClient } from "./supabase";

export function checkinService(client: GymCircleClient) {
  return {
    async checkIn(
      userId: string,
      gymId: string,
      checkinDate = getGymCircleDateKey(),
    ): Promise<CheckinRow> {
      const { data: existing, error: existingError } = await client
        .from("checkins")
        .select("*")
        .eq("user_id", userId)
        .eq("gym_id", gymId)
        .eq("checkin_date", checkinDate)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) return existing;

      const { data, error } = await client
        .from("checkins")
        .insert({
          user_id: userId,
          gym_id: gymId,
          checkin_date: checkinDate,
          ...(checkinDate === getGymCircleDateKey()
            ? {}
            : { created_at: `${checkinDate}T12:00:00-03:00` }),
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },

    async updateLocation(checkinId: string, gymId: string): Promise<string> {
      const { data, error } = await client.rpc("update_social_checkin", {
        p_checkin_id: checkinId,
        p_gym_id: gymId,
      });
      if (error) throw error;
      if (typeof data !== "string") {
        throw new Error("O check-in atualizado não foi retornado.");
      }
      return data;
    },

    async listToday(): Promise<CheckinRow[]> {
      const today = getGymCircleDateKey();
      const { data, error } = await client
        .from("checkins")
        .select("*")
        .eq("checkin_date", today)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },

    async listByGym(gymId: string, limit = 50): Promise<CheckinRow[]> {
      const today = getGymCircleDateKey();
      const { data, error } = await client
        .from("checkins")
        .select("*")
        .eq("gym_id", gymId)
        .eq("checkin_date", today)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  };
}

export type CheckinService = ReturnType<typeof checkinService>;

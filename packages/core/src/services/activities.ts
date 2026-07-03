import {
  activityInputToRow,
  activityRowToDomain,
  type Activity,
  type ActivityInput,
  type ActivityRow,
} from "../domain/activity";
import type { GymCircleClient } from "./supabase";

export function activityService(client: GymCircleClient) {
  return {
    /** Grava uma atividade rastreada; o trigger marca o dia/streak. */
    async create(userId: string, input: ActivityInput): Promise<Activity> {
      const { data, error } = await client
        .from("activities")
        .insert(activityInputToRow(input, userId))
        .select("*")
        .single();
      if (error) throw error;
      return activityRowToDomain(data as ActivityRow);
    },

    /**
     * Salva as infos de post na ENTRADA de atividade (treino sem foto no
     * feed): legenda, local e tags — modelo check-in↔post↔carrossel.
     */
    async updateEntry(
      activityId: string,
      patch: {
        caption?: string | null;
        workoutTypes?: string[] | null;
        gymId?: string | null;
        locationSource?: string;
        locationName?: string | null;
        locationLatitude?: number | null;
        locationLongitude?: number | null;
        locationGoogleMapsUrl?: string | null;
      },
    ): Promise<void> {
      const { error } = await client
        .from("activities")
        .update({
          caption: patch.caption?.trim() || null,
          workout_types:
            patch.workoutTypes && patch.workoutTypes.length > 0
              ? patch.workoutTypes
              : null,
          gym_id: patch.gymId ?? null,
          location_source: patch.locationSource ?? "none",
          location_name: patch.locationName ?? null,
          location_latitude: patch.locationLatitude ?? null,
          location_longitude: patch.locationLongitude ?? null,
          location_google_maps_url: patch.locationGoogleMapsUrl ?? null,
        })
        .eq("id", activityId);
      if (error) throw error;
    },

    /** Atividades recentes do próprio user (RLS restringe ao dono). */
    async recentForUser(userId: string, limit = 30): Promise<Activity[]> {
      const { data, error } = await client
        .from("activities")
        .select("*")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as ActivityRow[]).map(activityRowToDomain);
    },
  };
}

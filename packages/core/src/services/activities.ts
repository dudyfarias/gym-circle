import type { SupabaseClient } from "@supabase/supabase-js";
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

    /** Remove uma atividade própria; o trigger recalcula dia/streak. */
    async remove(activityId: string): Promise<void> {
      const { error } = await client
        .from("activities")
        .delete()
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

    /**
     * "Integrar treino": treinos do próprio user num dia (mesma data do post),
     * ainda não vinculados a nenhum post. Alimenta o picker de integração.
     */
    async mergeableForDate(workoutDate: string): Promise<MergeableActivity[]> {
      const { data, error } = await (client as unknown as SupabaseClient).rpc("get_mergeable_activities", {
        p_workout_date: workoutDate,
      });
      if (error) throw error;
      return ((data ?? []) as MergeableActivityRow[]).map((row) => ({
        id: row.id,
        activityType: row.activity_type,
        elapsedS: row.elapsed_s ?? 0,
        movingS: row.moving_s ?? null,
        distanceM: row.distance_m ?? null,
        elevationGainM: row.elevation_gain_m ?? null,
        avgHr: row.avg_hr ?? null,
        totalCalories: row.total_calories ?? null,
        startedAt: row.started_at ?? null,
        endedAt: row.ended_at ?? null,
      }));
    },

    /**
     * Integra o treino no post (post recebe source_activity_id): o post passa
     * a mostrar as estatísticas e o treino some do feed (sem duplicar). O RPC
     * valida dono + mesma data.
     */
    async mergeIntoPost(postId: string, activityId: string): Promise<void> {
      const { error } = await (client as unknown as SupabaseClient).rpc("merge_activity_into_post", {
        p_post_id: postId,
        p_activity_id: activityId,
      });
      if (error) throw error;
    },
  };
}

type MergeableActivityRow = {
  id: string;
  activity_type: string;
  elapsed_s: number | null;
  moving_s: number | null;
  distance_m: number | null;
  elevation_gain_m: number | null;
  avg_hr: number | null;
  total_calories: number | null;
  started_at: string | null;
  ended_at: string | null;
};

/** Treino candidato a integrar num post (mesmo dia, ainda livre). */
export type MergeableActivity = {
  id: string;
  activityType: string;
  elapsedS: number;
  movingS: number | null;
  distanceM: number | null;
  elevationGainM: number | null;
  avgHr: number | null;
  totalCalories: number | null;
  startedAt: string | null;
  endedAt: string | null;
};

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSportDefinition, type SportId } from "../domain/sports";
import type { GymCircleClient } from "./supabase";

type SportPreferenceRow = {
  sport_id: string;
  is_favorite: boolean;
};

type RecentSportActivityRow = {
  activity_type: string;
  started_at: string;
};

export type SportPersonalization = {
  favoriteSportIds: SportId[];
  usageCountBySport: Record<string, number>;
  lastUsedAtBySport: Record<string, string>;
};

export function sportService(client: GymCircleClient) {
  const untyped = client as unknown as SupabaseClient;
  return {
    /**
     * Favoritos vêm da preferência explícita; frequência e recência são
     * derivadas das activities para não manter contadores duplicados.
     */
    async personalization(
      userId: string,
      activityLimit = 250,
    ): Promise<SportPersonalization> {
      const [preferencesResult, activitiesResult] = await Promise.all([
        untyped
          .from("user_sport_preferences")
          .select("sport_id,is_favorite")
          .eq("user_id", userId)
          .eq("is_favorite", true),
        untyped
          .from("activities")
          .select("activity_type,started_at")
          .eq("user_id", userId)
          .order("started_at", { ascending: false })
          .limit(activityLimit),
      ]);
      if (preferencesResult.error) throw preferencesResult.error;
      if (activitiesResult.error) throw activitiesResult.error;

      const favoriteSportIds = (
        (preferencesResult.data ?? []) as SportPreferenceRow[]
      ).flatMap((row) => {
        const sport = getSportDefinition(row.sport_id);
        return row.is_favorite && sport.id === row.sport_id
          ? [sport.id as SportId]
          : [];
      });
      const usageCountBySport: Record<string, number> = {};
      const lastUsedAtBySport: Record<string, string> = {};
      for (const row of (activitiesResult.data ??
        []) as RecentSportActivityRow[]) {
        const sport = getSportDefinition(row.activity_type);
        usageCountBySport[sport.id] =
          (usageCountBySport[sport.id] ?? 0) + 1;
        if (!lastUsedAtBySport[sport.id]) {
          lastUsedAtBySport[sport.id] = row.started_at;
        }
      }

      return {
        favoriteSportIds,
        usageCountBySport,
        lastUsedAtBySport,
      };
    },

    async setFavorite(
      userId: string,
      sportId: SportId,
      favorite: boolean,
    ): Promise<void> {
      if (favorite) {
        const { error } = await untyped
          .from("user_sport_preferences")
          .upsert(
            {
              user_id: userId,
              sport_id: sportId,
              is_favorite: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,sport_id" },
          );
        if (error) throw error;
        return;
      }
      const { error } = await untyped
        .from("user_sport_preferences")
        .delete()
        .eq("user_id", userId)
        .eq("sport_id", sportId);
      if (error) throw error;
    },
  };
}

export type SportService = ReturnType<typeof sportService>;

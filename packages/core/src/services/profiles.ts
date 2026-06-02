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
  profile_completion_notice_dismissed: boolean;
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

    /**
     * Sprint 5.5a — Salva a escolha de capa do recap mensal.
     *
     * Atualiza apenas a key {monthKey} dentro do JSONB `monthly_recap_covers`.
     * Quando `postId` é null, remove a key (volta pro auto-pick).
     * Implementação client-side: lê → mutate → write. Atomic via RPC seria
     * mais correto contra race conditions, mas o user só edita seu próprio
     * profile + raramente — risco é desprezível.
     */
    async setMonthlyRecapCover(
      userId: string,
      monthKey: string,
      postId: string | null,
    ): Promise<void> {
      const { data: current, error: readError } = await client
        .from("profiles")
        .select("monthly_recap_covers")
        .eq("user_id", userId)
        .maybeSingle();
      if (readError) throw readError;

      const currentMap =
        (current?.monthly_recap_covers as Record<string, string> | null) ?? {};
      const nextMap: Record<string, string> = { ...currentMap };
      if (postId) {
        nextMap[monthKey] = postId;
      } else {
        delete nextMap[monthKey];
      }

      const { error: writeError } = await client
        .from("profiles")
        .update({ monthly_recap_covers: nextMap })
        .eq("user_id", userId);
      if (writeError) throw writeError;
    },
  };
}

export type ProfileService = ReturnType<typeof profileService>;

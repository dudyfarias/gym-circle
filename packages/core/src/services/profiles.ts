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

    /**
     * Sprint 10.5 — fetch batch de profiles por user_ids.
     * Usado pra hidratar dinamicamente actors de notificações que não
     * estão no cache `social.users` (paridade Instagram: notifs sempre
     * mostram nome+avatar de quem interagiu, mesmo de users novos).
     * Retorna apenas profiles visíveis (RLS `profiles_select_visible`
     * já filtra blocked / deactivated).
     */
    async byUserIds(userIds: string[]): Promise<ProfileRow[]> {
      const uniqueIds = Array.from(
        new Set(userIds.filter((id): id is string => Boolean(id))),
      );
      if (uniqueIds.length === 0) return [];
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .in("user_id", uniqueIds);
      if (error) throw error;
      return data ?? [];
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

    /**
     * Sprint 7.5.1 — persiste achievements equipados no perfil.
     *
     * Salva o array como veio — caller (frontend) é responsável por:
     *   1. Validar que cada ID está em user_achievements do user
     *   2. Garantir tamanho máximo (recomendado <= 3)
     *
     * Mesmo patter do setMonthlyRecapCover: simple UPDATE, sem RPC.
     */
    async setFeaturedAchievements(
      userId: string,
      achievementIds: string[],
    ): Promise<void> {
      const { error } = await client
        .from("profiles")
        // Triple cast pelo symlink quirk — Sprint 5.5a pattern.
        .update({ featured_achievements: achievementIds } as unknown as {
          featured_achievements: string[];
        })
        .eq("user_id", userId);
      if (error) throw error;
    },

    /**
     * Sprint 7C.1 — Contextual Motion Onboarding.
     *
     * Marca um hint como visto pra que não reapareça em outros devices.
     * Mesma estratégia client-side read→mutate→write do setMonthlyRecapCover.
     * Timestamp ISO guarda quando foi dispensado (útil pra analytics).
     *
     * Best-effort: falha aqui não bloqueia UX — localStorage local já
     * absorveu o dismiss. Caller deve catch e logar mas não interromper.
     */
    async markContextualHintSeen(
      userId: string,
      hintId: string,
    ): Promise<void> {
      const { data: current, error: readError } = await client
        .from("profiles")
        .select("contextual_hints_seen")
        .eq("user_id", userId)
        .maybeSingle();
      if (readError) throw readError;

      const currentMap =
        ((current as { contextual_hints_seen?: Record<string, string> } | null)
          ?.contextual_hints_seen as Record<string, string> | undefined) ?? {};
      // Idempotente: se hint já existe, não sobreescreve timestamp original.
      if (currentMap[hintId]) return;

      const nextMap: Record<string, string> = {
        ...currentMap,
        [hintId]: new Date().toISOString(),
      };

      const { error: writeError } = await client
        .from("profiles")
        // Cast pelo symlink quirk (Sprint 5.5a): ProfileRow do release branch
        // pode não conhecer o campo. Vercel main sim. Triple-cast satisfaz ambos.
        .update({ contextual_hints_seen: nextMap } as unknown as {
          contextual_hints_seen: Record<string, string>;
        })
        .eq("user_id", userId);
      if (writeError) throw writeError;
    },
  };
}

export type ProfileService = ReturnType<typeof profileService>;

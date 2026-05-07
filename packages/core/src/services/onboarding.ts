import type { LegalAcceptanceRow, ProfileRow } from "../domain/types";
import type { GymCircleClient } from "./supabase";

export function onboardingService(client: GymCircleClient) {
  return {
    async acceptAlphaLegal(): Promise<void> {
      const { error } = await client.rpc("accept_alpha_legal", {});
      if (error) throw error;
    },

    async markComplete(): Promise<void> {
      const { error } = await client.rpc("mark_onboarding_complete");
      if (error) throw error;
    },

    async listLegalAcceptances(userId: string): Promise<LegalAcceptanceRow[]> {
      const { data, error } = await client
        .from("legal_acceptances")
        .select("*")
        .eq("user_id", userId)
        .order("accepted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },

    isProfileReady(profile: ProfileRow | null): boolean {
      return Boolean(
        profile?.display_name?.trim() &&
          profile?.username?.trim(),
      );
    },
  };
}

export type OnboardingService = ReturnType<typeof onboardingService>;

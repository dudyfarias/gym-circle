import { describe, expect, it, vi } from "vitest";
import { profileService, type ProfileUpdate } from "./profiles";
import type { ProfileRow } from "../domain/types";
import type { GymCircleClient } from "./supabase";

function profile(input: Partial<ProfileRow> & Pick<ProfileRow, "user_id">): ProfileRow {
  return {
    id: input.id ?? "profile-id",
    user_id: input.user_id,
    username: input.username ?? "dudy",
    display_name: input.display_name ?? "Dudy",
    avatar_url: input.avatar_url ?? null,
    bio: input.bio ?? null,
    fitness_goal: input.fitness_goal ?? null,
    main_gym_id: input.main_gym_id ?? null,
    preferred_training_times: input.preferred_training_times ?? [],
    profile_completion_notice_dismissed:
      input.profile_completion_notice_dismissed ?? false,
    is_private: input.is_private ?? false,
    created_at: input.created_at ?? "2026-05-20T12:00:00.000Z",
    instagram_username: input.instagram_username ?? null,
    birth_date: input.birth_date ?? null,
    sports: input.sports ?? [],
    onboarding_completed_at: input.onboarding_completed_at ?? null,
    alpha_terms_accepted_at: input.alpha_terms_accepted_at ?? null,
    privacy_policy_accepted_at: input.privacy_policy_accepted_at ?? null,
    account_status: input.account_status ?? "active",
    deleted_at: input.deleted_at ?? null,
    suspended_at: input.suspended_at ?? null,
    reactivation_token_hash: input.reactivation_token_hash ?? null,
    reactivation_sent_at: input.reactivation_sent_at ?? null,
    reactivation_expires_at: input.reactivation_expires_at ?? null,
  };
}

describe("profileService.update", () => {
  it("removes undefined values before updating a profile", async () => {
    const updated = profile({
      user_id: "user-1",
      bio: "Bio nova",
      fitness_goal: "Corrida",
    });
    const single = vi.fn().mockResolvedValue({ data: updated, error: null });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    const client = { from } as unknown as GymCircleClient & {
      from: ReturnType<typeof vi.fn>;
    };
    const service = profileService(client);

    await service.update("user-1", {
      bio: "Bio nova",
      fitness_goal: undefined,
      instagram_username: null,
    } as ProfileUpdate);

    expect(update).toHaveBeenCalledWith({
      bio: "Bio nova",
      instagram_username: null,
    });
  });

  it("does not turn untouched fields into null during partial profile updates", async () => {
    const updated = profile({
      user_id: "user-1",
      bio: "Bio nova",
      fitness_goal: "Mantido no banco",
      main_gym_id: "gym-1",
    });
    const single = vi.fn().mockResolvedValue({ data: updated, error: null });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    const client = { from } as unknown as GymCircleClient & {
      from: ReturnType<typeof vi.fn>;
    };
    const service = profileService(client);

    const result = await service.update("user-1", { bio: "Bio nova" });

    expect(update).toHaveBeenCalledWith({ bio: "Bio nova" });
    expect(result.fitness_goal).toBe("Mantido no banco");
    expect(result.main_gym_id).toBe("gym-1");
  });
});

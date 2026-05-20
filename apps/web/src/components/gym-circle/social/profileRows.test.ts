import { describe, expect, it } from "vitest";
import type { ProfileRow } from "@gym-circle/core";
import {
  isProfilePreview,
  mergeProfileRows,
  profileRowFromPartial,
  profileRowFromSurface,
} from "./profileRows";

function fullProfile(input: Partial<ProfileRow> & Pick<ProfileRow, "user_id">): ProfileRow {
  return {
    id: input.id ?? `real-${input.user_id}`,
    user_id: input.user_id,
    username: input.username ?? "dudy",
    display_name: input.display_name ?? "Dudy",
    avatar_url:
      input.avatar_url !== undefined ? input.avatar_url : "https://cdn.example/avatar.jpg",
    bio: input.bio !== undefined ? input.bio : "Treino cedo e corro no fim de semana.",
    fitness_goal: input.fitness_goal !== undefined ? input.fitness_goal : "Consistencia",
    main_gym_id: input.main_gym_id !== undefined ? input.main_gym_id : "gym-1",
    preferred_training_times: input.preferred_training_times ?? ["Manha"],
    is_private: input.is_private ?? true,
    created_at: input.created_at ?? "2026-05-01T10:00:00.000Z",
    instagram_username:
      input.instagram_username !== undefined ? input.instagram_username : "dudy.fit",
    birth_date: input.birth_date !== undefined ? input.birth_date : "1999-05-20",
    sports: input.sports ?? ["Musculacao", "Corrida"],
    onboarding_completed_at: input.onboarding_completed_at ?? "2026-05-01T10:00:00.000Z",
    alpha_terms_accepted_at: input.alpha_terms_accepted_at ?? "2026-05-01T10:00:00.000Z",
    privacy_policy_accepted_at:
      input.privacy_policy_accepted_at ?? "2026-05-01T10:00:00.000Z",
    account_status: input.account_status ?? "active",
    suspended_at: input.suspended_at ?? null,
    reactivation_token_hash: input.reactivation_token_hash ?? null,
    reactivation_sent_at: input.reactivation_sent_at ?? null,
    reactivation_expires_at: input.reactivation_expires_at ?? null,
    deleted_at: input.deleted_at ?? null,
  };
}

describe("profile row merging", () => {
  it("marks feed/search surface rows as preview profiles", () => {
    const preview = profileRowFromSurface({
      user_id: "user-1",
      username: "dudy",
      display_name: "Dudy",
    });

    expect(preview).not.toBeNull();
    expect(isProfilePreview(preview!)).toBe(true);
  });

  it("does not let a ProfilePreview erase a complete current profile", () => {
    const full = fullProfile({ user_id: "user-1" });
    const preview = profileRowFromSurface({
      user_id: "user-1",
      username: "dudy",
      display_name: "Dudy",
      avatar_url: null,
    })!;

    const [merged] = mergeProfileRows([full], [preview]);

    expect(merged.bio).toBe("Treino cedo e corro no fim de semana.");
    expect(merged.fitness_goal).toBe("Consistencia");
    expect(merged.main_gym_id).toBe("gym-1");
    expect(merged.preferred_training_times).toEqual(["Manha"]);
    expect(merged.instagram_username).toBe("dudy.fit");
    expect(merged.birth_date).toBe("1999-05-20");
    expect(merged.sports).toEqual(["Musculacao", "Corrida"]);
    expect(merged.is_private).toBe(true);
    expect(merged.avatar_url).toBe("https://cdn.example/avatar.jpg");
  });

  it("lets a full profile update clear optional fields intentionally", () => {
    const full = fullProfile({ user_id: "user-1" });
    const updated = fullProfile({
      user_id: "user-1",
      bio: null,
      fitness_goal: null,
      instagram_username: null,
      birth_date: null,
      sports: [],
      main_gym_id: null,
      preferred_training_times: [],
      is_private: false,
    });

    const [merged] = mergeProfileRows([full], [updated]);

    expect(merged.bio).toBeNull();
    expect(merged.fitness_goal).toBeNull();
    expect(merged.instagram_username).toBeNull();
    expect(merged.birth_date).toBeNull();
    expect(merged.sports).toEqual([]);
    expect(merged.main_gym_id).toBeNull();
    expect(merged.preferred_training_times).toEqual([]);
    expect(merged.is_private).toBe(false);
  });

  it("keeps preview search results from becoming the source of truth for editing", () => {
    const full = fullProfile({ user_id: "user-1", bio: "Bio completa" });
    const preview = profileRowFromPartial({
      user_id: "user-1",
      username: "dudy",
      display_name: "Dudy Atualizado",
      avatar_url: "https://cdn.example/new-avatar.jpg",
      is_private: false,
    });

    const [merged] = mergeProfileRows([full], [preview]);

    expect(merged.display_name).toBe("Dudy Atualizado");
    expect(merged.avatar_url).toBe("https://cdn.example/new-avatar.jpg");
    expect(merged.bio).toBe("Bio completa");
    expect(merged.is_private).toBe(true);
  });
});

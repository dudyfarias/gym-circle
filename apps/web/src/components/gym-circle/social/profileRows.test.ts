import { describe, expect, it } from "vitest";
import type { GymRow, ProfileRow, UserGymRow } from "@gym-circle/core";
import {
  getOrderedGymNamesForProfile,
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
    profile_completion_notice_dismissed:
      input.profile_completion_notice_dismissed ?? false,
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

function gym(input: Pick<GymRow, "id" | "name"> & Partial<GymRow>): GymRow {
  return {
    id: input.id,
    name: input.name,
    address: input.address ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    created_at: input.created_at ?? "2026-05-01T10:00:00.000Z",
  };
}

function userGym(
  input: Pick<UserGymRow, "user_id" | "gym_id"> & Partial<UserGymRow>,
): UserGymRow {
  return {
    id: input.id ?? `${input.user_id}-${input.gym_id}`,
    user_id: input.user_id,
    gym_id: input.gym_id,
    is_main: input.is_main ?? false,
    preferred_days: input.preferred_days ?? [],
    preferred_times: input.preferred_times ?? [],
    created_at: input.created_at ?? "2026-05-01T10:00:00.000Z",
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
    const full = fullProfile({
      user_id: "user-1",
      bio: "Bio completa",
      profile_completion_notice_dismissed: true,
    });
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
    expect(merged.profile_completion_notice_dismissed).toBe(true);
  });

  it("never lets null or empty preview fields clear full profile data", () => {
    const full = fullProfile({
      user_id: "user-1",
      avatar_url: "https://cdn.example/avatar-full.jpg",
      bio: "Bio historica",
      fitness_goal: "Forca",
      instagram_username: "dudy.fit",
      birth_date: "1998-02-12",
      sports: ["Musculacao"],
      main_gym_id: "gym-old",
      preferred_training_times: ["Noite"],
    });
    const preview = profileRowFromSurface({
      user_id: "user-1",
      username: "dudy",
      display_name: "Dudy",
      avatar_url: null,
    })!;

    const [merged] = mergeProfileRows([full], [preview]);

    expect(merged.avatar_url).toBe("https://cdn.example/avatar-full.jpg");
    expect(merged.bio).toBe("Bio historica");
    expect(merged.fitness_goal).toBe("Forca");
    expect(merged.instagram_username).toBe("dudy.fit");
    expect(merged.birth_date).toBe("1998-02-12");
    expect(merged.sports).toEqual(["Musculacao"]);
    expect(merged.main_gym_id).toBe("gym-old");
    expect(merged.preferred_training_times).toEqual(["Noite"]);
  });

  it("lets a complete profile row hydrate a previously cached preview", () => {
    const preview = profileRowFromSurface({
      user_id: "user-1",
      username: "dudy",
      display_name: "Dudy",
      avatar_url: null,
    })!;
    const full = fullProfile({
      user_id: "user-1",
      bio: "Bio recuperada do profiles",
      fitness_goal: "Hipertrofia",
      instagram_username: "dudy.fit",
      birth_date: "1998-02-12",
      sports: ["Musculacao", "Corrida"],
      main_gym_id: "gym-1",
      preferred_training_times: ["Noite"],
    });

    const [merged] = mergeProfileRows([preview], [full]);

    expect(isProfilePreview(merged)).toBe(false);
    expect(merged.bio).toBe("Bio recuperada do profiles");
    expect(merged.fitness_goal).toBe("Hipertrofia");
    expect(merged.instagram_username).toBe("dudy.fit");
    expect(merged.birth_date).toBe("1998-02-12");
    expect(merged.sports).toEqual(["Musculacao", "Corrida"]);
    expect(merged.main_gym_id).toBe("gym-1");
    expect(merged.preferred_training_times).toEqual(["Noite"]);
  });

  it("orders profile gyms with profiles.main_gym_id first even when user_gyms arrives unordered", () => {
    const profile = fullProfile({
      user_id: "dudy-user",
      main_gym_id: "saint-thomas",
    });
    const gymsById = new Map<string, GymRow>([
      ["mansao-maromba", gym({ id: "mansao-maromba", name: "Mansao maromba" })],
      ["saint-thomas", gym({ id: "saint-thomas", name: "Saint Thomas" })],
    ]);
    const unorderedUserGyms = [
      userGym({
        user_id: "dudy-user",
        gym_id: "mansao-maromba",
        is_main: false,
        created_at: "2026-06-03T15:05:22.411Z",
      }),
      userGym({
        user_id: "dudy-user",
        gym_id: "saint-thomas",
        is_main: true,
        created_at: "2026-05-07T22:57:52.197Z",
      }),
    ];

    expect(getOrderedGymNamesForProfile(profile, unorderedUserGyms, gymsById)).toEqual([
      "Saint Thomas",
      "Mansao maromba",
    ]);
  });
});

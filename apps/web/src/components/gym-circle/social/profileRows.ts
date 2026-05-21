import type { ProfileRow } from "@gym-circle/core";

const PREVIEW_CREATED_AT = new Date(0).toISOString();
const PREVIEW_USERNAME = "usuario";
const PREVIEW_DISPLAY_NAME = "Gym Circle";

export type ProfileSurfaceLike = {
  user_id?: string | null;
  author_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

export function profileRowFromPartial(
  input: Partial<ProfileRow> & { user_id: string },
): ProfileRow {
  return {
    id: input.id ?? `profile-${input.user_id}`,
    user_id: input.user_id,
    username: input.username ?? PREVIEW_USERNAME,
    display_name: input.display_name ?? input.username ?? PREVIEW_DISPLAY_NAME,
    avatar_url: input.avatar_url ?? null,
    bio: input.bio ?? null,
    fitness_goal: input.fitness_goal ?? null,
    main_gym_id: input.main_gym_id ?? null,
    preferred_training_times: input.preferred_training_times ?? [],
    is_private: input.is_private ?? false,
    created_at: input.created_at ?? PREVIEW_CREATED_AT,
    instagram_username: input.instagram_username ?? null,
    birth_date: input.birth_date ?? null,
    sports: input.sports ?? [],
    onboarding_completed_at: input.onboarding_completed_at ?? null,
    profile_completion_notice_dismissed:
      input.profile_completion_notice_dismissed ?? false,
    alpha_terms_accepted_at: input.alpha_terms_accepted_at ?? null,
    privacy_policy_accepted_at: input.privacy_policy_accepted_at ?? null,
    account_status: input.account_status ?? "active",
    suspended_at: input.suspended_at ?? null,
    reactivation_sent_at: input.reactivation_sent_at ?? null,
    reactivation_expires_at: input.reactivation_expires_at ?? null,
    reactivation_token_hash: input.reactivation_token_hash ?? null,
    deleted_at: input.deleted_at ?? null,
  };
}

export function profileRowFromSurface(input: ProfileSurfaceLike): ProfileRow | null {
  const userId = input.user_id ?? input.author_id;
  if (!userId) return null;
  return profileRowFromPartial({
    user_id: userId,
    username: input.username ?? undefined,
    display_name: input.display_name ?? input.username ?? PREVIEW_DISPLAY_NAME,
    avatar_url: input.avatar_url ?? null,
  });
}

export function isProfilePreview(row: ProfileRow): boolean {
  return row.id === `profile-${row.user_id}` || row.created_at === PREVIEW_CREATED_AT;
}

function meaningfulUsername(row: ProfileRow): string | null {
  return row.username && row.username !== PREVIEW_USERNAME ? row.username : null;
}

function meaningfulDisplayName(row: ProfileRow): string | null {
  return row.display_name && row.display_name !== PREVIEW_DISPLAY_NAME
    ? row.display_name
    : null;
}

export function mergeProfileRows(rows: ProfileRow[], nextRows: ProfileRow[]): ProfileRow[] {
  const map = new Map<string, ProfileRow>();
  for (const row of rows) map.set(row.user_id, row);

  for (const next of nextRows) {
    const existing = map.get(next.user_id);
    if (!existing) {
      map.set(next.user_id, next);
      continue;
    }

    const existingIsPreview = isProfilePreview(existing);
    const nextIsPreview = isProfilePreview(next);

    if (!nextIsPreview) {
      map.set(next.user_id, { ...existing, ...next });
      continue;
    }

    if (existingIsPreview) {
      map.set(next.user_id, {
        ...existing,
        username: meaningfulUsername(next) ?? existing.username,
        display_name: meaningfulDisplayName(next) ?? existing.display_name,
        avatar_url: next.avatar_url ?? existing.avatar_url,
        is_private: next.is_private,
        account_status: next.account_status,
        deleted_at: next.deleted_at,
      });
      continue;
    }

    map.set(next.user_id, {
      ...existing,
      username: meaningfulUsername(next) ?? existing.username,
      display_name: meaningfulDisplayName(next) ?? existing.display_name,
      avatar_url: next.avatar_url ?? existing.avatar_url,
    });
  }

  return Array.from(map.values());
}

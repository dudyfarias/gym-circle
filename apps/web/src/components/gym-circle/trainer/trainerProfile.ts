import type { Database, GymCircleClient } from "@gym-circle/core";

export const TRAINER_SPECIALTIES = [
  "hypertrophy",
  "weight_loss",
  "strength",
  "conditioning",
  "running",
  "mobility",
  "seniors",
  "beginners",
  "functional_training",
] as const;

export const TRAINER_SERVICE_MODES = [
  "online",
  "in_person",
  "hybrid",
] as const;

export type TrainerSpecialty = (typeof TRAINER_SPECIALTIES)[number];
export type TrainerServiceMode = (typeof TRAINER_SERVICE_MODES)[number];
export type TrainerVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected"
  | "suspended";
export type TrainerProfileVisibility = "public" | "private";

export type TrainerProfile = Omit<
  Database["public"]["Tables"]["trainer_profiles"]["Row"],
  "service_modes" | "specialties" | "verification_status" | "profile_visibility"
> & {
  service_modes: TrainerServiceMode[];
  specialties: TrainerSpecialty[];
  verification_status: TrainerVerificationStatus;
  profile_visibility: TrainerProfileVisibility;
};

export type TrainerProfileDraft = {
  professionalName: string;
  headline: string;
  professionalBio: string;
  specialties: TrainerSpecialty[];
  serviceMode: TrainerServiceMode;
  city: string;
  state: string;
  yearsExperience: string;
  acceptsNewClients: boolean;
  contactCtaEnabled: boolean;
  profileVisibility: TrainerProfileVisibility;
  registrationNumber: string;
  registrationRegion: string;
};

export type TrainerVerificationRequest = Pick<
  Database["public"]["Tables"]["trainer_verification_requests"]["Row"],
  | "id"
  | "registration_number"
  | "registration_region"
  | "rejection_reason"
  | "status"
  | "submitted_at"
>;

const PUBLIC_TRAINER_COLUMNS =
  "user_id,professional_name,headline,professional_bio,specialties,service_modes,city,state,online_service,in_person_service,years_experience,accepts_new_clients,contact_cta_enabled,profile_visibility,verification_status,created_at,updated_at" as const;

const CACHE_TTL_MS = 60_000;
const trainerProfileCache = new Map<
  string,
  { expiresAt: number; value: TrainerProfile | null }
>();
const inflightTrainerProfiles = new Map<
  string,
  Promise<TrainerProfile | null>
>();

export function emptyTrainerProfileDraft(
  professionalName: string,
): TrainerProfileDraft {
  return {
    professionalName,
    headline: "",
    professionalBio: "",
    specialties: [],
    serviceMode: "online",
    city: "",
    state: "",
    yearsExperience: "",
    acceptsNewClients: false,
    contactCtaEnabled: true,
    profileVisibility: "public",
    registrationNumber: "",
    registrationRegion: "",
  };
}

export function trainerProfileDraftFromRows(
  profile: TrainerProfile | null,
  request: TrainerVerificationRequest | null,
  fallbackName: string,
): TrainerProfileDraft {
  if (!profile) return emptyTrainerProfileDraft(fallbackName);
  return {
    professionalName: profile.professional_name,
    headline: profile.headline,
    professionalBio: profile.professional_bio,
    specialties: profile.specialties,
    serviceMode: profile.service_modes[0] ?? "online",
    city: profile.city ?? "",
    state: profile.state ?? "",
    yearsExperience:
      profile.years_experience === null ? "" : String(profile.years_experience),
    acceptsNewClients: profile.accepts_new_clients,
    contactCtaEnabled: profile.contact_cta_enabled,
    profileVisibility: profile.profile_visibility,
    registrationNumber: request?.registration_number ?? "",
    registrationRegion: request?.registration_region ?? "",
  };
}

export function validateTrainerProfileDraft(
  draft: TrainerProfileDraft,
): string | null {
  if (draft.professionalName.trim().length < 2) return "professionalName";
  if (draft.headline.trim().length < 3) return "headline";
  if (draft.professionalBio.trim().length < 20) return "professionalBio";
  if (draft.specialties.length === 0) return "specialties";
  if (draft.specialties.length > 5) return "specialtiesLimit";
  if (
    !TRAINER_SERVICE_MODES.includes(
      draft.serviceMode as TrainerServiceMode,
    )
  ) {
    return "serviceMode";
  }
  const years = draft.yearsExperience.trim();
  if (years && (!Number.isInteger(Number(years)) || Number(years) < 0 || Number(years) > 80)) {
    return "yearsExperience";
  }
  const registrationNumber = draft.registrationNumber.trim();
  const registrationRegion = draft.registrationRegion.trim();
  if (Boolean(registrationNumber) !== Boolean(registrationRegion)) {
    return "registrationPair";
  }
  return null;
}

export function maskRegistrationNumber(value: string): string {
  const compact = value.trim();
  if (compact.length <= 4) return "••••";
  return `••••${compact.slice(-4)}`;
}

export function buildTrainerProfileUpsert(
  userId: string,
  draft: TrainerProfileDraft,
): Database["public"]["Tables"]["trainer_profiles"]["Insert"] {
  const years = draft.yearsExperience.trim();
  return {
    user_id: userId,
    professional_name: draft.professionalName.trim(),
    headline: draft.headline.trim(),
    professional_bio: draft.professionalBio.trim(),
    specialties: draft.specialties,
    service_modes: [draft.serviceMode],
    city: draft.city.trim() || null,
    state: draft.state.trim() || null,
    years_experience: years ? Number(years) : null,
    accepts_new_clients: draft.acceptsNewClients,
    contact_cta_enabled: draft.contactCtaEnabled,
    profile_visibility: draft.profileVisibility,
  };
}

export function invalidateTrainerProfile(userId?: string) {
  if (userId) {
    trainerProfileCache.delete(userId);
    inflightTrainerProfiles.delete(userId);
    return;
  }
  trainerProfileCache.clear();
  inflightTrainerProfiles.clear();
}

export async function loadTrainerProfile(
  client: GymCircleClient,
  userId: string,
): Promise<TrainerProfile | null> {
  const cached = trainerProfileCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const inflight = inflightTrainerProfiles.get(userId);
  if (inflight) return inflight;

  const request = (async () => {
    try {
      const { data, error } = await client
        .from("trainer_profiles")
        .select(PUBLIC_TRAINER_COLUMNS)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      const value = data as TrainerProfile | null;
      trainerProfileCache.set(userId, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value,
      });
      return value;
    } finally {
      inflightTrainerProfiles.delete(userId);
    }
  })();

  inflightTrainerProfiles.set(userId, request);
  return request;
}

export async function loadLatestTrainerVerificationRequest(
  client: GymCircleClient,
  userId: string,
): Promise<TrainerVerificationRequest | null> {
  const { data, error } = await client
    .from("trainer_verification_requests")
    .select(
      "id,registration_number,registration_region,rejection_reason,status,submitted_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as TrainerVerificationRequest | null;
}

export async function saveTrainerProfile(
  client: GymCircleClient,
  userId: string,
  draft: TrainerProfileDraft,
  options: { submitVerification?: boolean } = {},
): Promise<TrainerProfile> {
  const validationError = validateTrainerProfileDraft(draft);
  if (validationError) throw new Error(`trainer_profile_invalid:${validationError}`);

  const { error: profileError } = await client.from("trainer_profiles").upsert(
    buildTrainerProfileUpsert(userId, draft),
    { onConflict: "user_id" },
  );
  if (profileError) throw profileError;

  const registrationNumber = draft.registrationNumber.trim();
  const registrationRegion = draft.registrationRegion.trim();
  if (
    options.submitVerification !== false &&
    registrationNumber &&
    registrationRegion
  ) {
    const { data: pending, error: pendingError } = await client
      .from("trainer_verification_requests")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle();
    if (pendingError) throw pendingError;

    if (pending) {
      const { error } = await client
        .from("trainer_verification_requests")
        .update({
          registration_number: registrationNumber,
          registration_region: registrationRegion,
        })
        .eq("id", pending.id);
      if (error) throw error;
    } else {
      const { error } = await client
        .from("trainer_verification_requests")
        .insert({
          user_id: userId,
          registration_number: registrationNumber,
          registration_region: registrationRegion,
        });
      if (error) throw error;
    }
  }

  invalidateTrainerProfile(userId);
  const saved = await loadTrainerProfile(client, userId);
  if (!saved) throw new Error("trainer_profile_save_missing");
  return saved;
}

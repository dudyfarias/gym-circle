import { describe, expect, it } from "vitest";
import {
  buildTrainerProfileUpsert,
  emptyTrainerProfileDraft,
  maskRegistrationNumber,
  trainerProfileDraftFromRows,
  validateTrainerProfileDraft,
  type TrainerProfile,
  type TrainerProfileDraft,
} from "./trainerProfile";

function validDraft(): TrainerProfileDraft {
  return {
    ...emptyTrainerProfileDraft("Dudy Trainer"),
    headline: "Hipertrofia simples e consistente",
    professionalBio:
      "Treinos de força e hipertrofia adaptados à rotina de cada aluno.",
    specialties: ["hypertrophy", "strength"],
    serviceMode: "hybrid",
  };
}

describe("trainer profile foundation", () => {
  it("requires professional identity and at least one specialty", () => {
    expect(validateTrainerProfileDraft(emptyTrainerProfileDraft("Dudy"))).toBe(
      "headline",
    );
    expect(validateTrainerProfileDraft(validDraft())).toBeNull();
  });

  it("requires registration number and region together", () => {
    expect(
      validateTrainerProfileDraft({
        ...validDraft(),
        registrationNumber: "12345-G",
      }),
    ).toBe("registrationPair");
  });

  it("never includes verification status in the client upsert payload", () => {
    const payload = buildTrainerProfileUpsert("user-1", validDraft());
    expect(payload).toMatchObject({
      user_id: "user-1",
      professional_name: "Dudy Trainer",
      service_modes: ["hybrid"],
      specialties: ["hypertrophy", "strength"],
    });
    expect("verification_status" in payload).toBe(false);
  });

  it("keeps generated and administrative fields out of the edit draft", () => {
    const profile: TrainerProfile = {
      accepts_new_clients: true,
      city: "São Paulo",
      contact_cta_enabled: true,
      created_at: "2026-07-14T00:00:00.000Z",
      headline: "Força com consistência",
      in_person_service: true,
      online_service: false,
      professional_bio: "Uma descrição profissional longa e válida para o teste.",
      professional_name: "Dudy Trainer",
      profile_visibility: "public",
      service_modes: ["in_person"],
      specialties: ["strength"],
      state: "SP",
      updated_at: "2026-07-14T00:00:00.000Z",
      user_id: "user-1",
      verification_status: "verified",
      years_experience: 8,
    };
    const draft = trainerProfileDraftFromRows(profile, null, "Fallback");
    expect(draft).toMatchObject({
      professionalName: "Dudy Trainer",
      serviceMode: "in_person",
      yearsExperience: "8",
    });
    expect("verificationStatus" in draft).toBe(false);
  });

  it("masks the public registration representation", () => {
    expect(maskRegistrationNumber("123456789")).toBe("••••6789");
    expect(maskRegistrationNumber("123")).toBe("••••");
  });
});

import type { EnrichedUser } from "./types";

export function normalizeInstagramUsername(value: string): string | null {
  const normalized = value
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "");
  return normalized || null;
}

export function splitSportsInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.slice(0, 28)),
    ),
  ).slice(0, 8);
}

export function formatSportsInput(sports: string[] | undefined): string {
  return (sports ?? []).join(", ");
}

function parseBirthDate(birthDate: string | null | undefined) {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

export function calculateAgeFromBirthDate(
  birthDate: string | null | undefined,
  now = new Date(),
): number | null {
  const parsed = parseBirthDate(birthDate);
  if (!parsed) return null;

  let age = now.getFullYear() - parsed.year;
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  if (
    currentMonth < parsed.month ||
    (currentMonth === parsed.month && currentDay < parsed.day)
  ) {
    age -= 1;
  }

  return age >= 0 && age < 120 ? age : null;
}

export function isBirthdayFromBirthDate(
  birthDate: string | null | undefined,
  now = new Date(),
): boolean {
  const parsed = parseBirthDate(birthDate);
  if (!parsed) return false;
  return now.getMonth() + 1 === parsed.month && now.getDate() === parsed.day;
}

export type ProfileCompletionItemId =
  | "identity"
  | "avatar"
  | "gym"
  | "goal"
  | "bio"
  | "preferredTimes";

export type ProfileCompletionItem = {
  id: ProfileCompletionItemId;
  label: string;
  complete: boolean;
  weight: number;
};

export type ProfileCompletion = {
  percentage: number;
  completedWeight: number;
  totalWeight: number;
  items: ProfileCompletionItem[];
  missing: ProfileCompletionItem[];
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function calculateProfileCompletion(user: EnrichedUser): ProfileCompletion {
  const items: ProfileCompletionItem[] = [
    {
      id: "identity",
      label: "Nome e username",
      complete: hasText(user.name) && user.name !== "—" && hasText(user.username) && user.username !== "—",
      weight: 40,
    },
    {
      id: "avatar",
      label: "Foto de perfil",
      complete: Boolean(user.avatarUrl),
      weight: 15,
    },
    {
      id: "gym",
      label: "Academia",
      complete: user.gyms.length > 0 || hasText(user.location),
      weight: 15,
    },
    {
      id: "goal",
      label: "Objetivo fitness",
      complete: hasText(user.goal),
      weight: 10,
    },
    {
      id: "bio",
      label: "Bio",
      complete: hasText(user.bio),
      weight: 10,
    },
    {
      id: "preferredTimes",
      label: "Horários de treino",
      complete: user.preferredTimes.length > 0,
      weight: 10,
    },
  ];
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const completedWeight = items.reduce(
    (sum, item) => sum + (item.complete ? item.weight : 0),
    0,
  );

  return {
    percentage: Math.round((completedWeight / totalWeight) * 100),
    completedWeight,
    totalWeight,
    items,
    missing: items.filter((item) => !item.complete),
  };
}

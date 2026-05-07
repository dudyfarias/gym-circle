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

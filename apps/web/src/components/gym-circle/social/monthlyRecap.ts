import type { EnrichedPost, EnrichedUser } from "./types";

const RECAP_TIME_ZONE = "America/Sao_Paulo";

type SaoPauloDateParts = {
  year: number;
  month: number;
  day: number;
};

export type MonthlyRecap = {
  userId: string;
  monthKey: string;
  monthLabel: string;
  shortMonthLabel: string;
  releaseLabel: string;
  isAvailable: boolean;
  daysUntilRelease: number;
  trainedDays: number;
  trainedDaysLabel: string;
  trainedDaysUnit: "dia" | "dias";
  totalPosts: number;
  topWorkoutType: string;
  topLocation: string;
  coverImageUrl: string | null;
  /** Mantido pra back-compat. Mesmo valor que `monthProgressPercent`. */
  progressPercent: number;
  /** % dos dias da semana atual (últimos 7 dias) que o user treinou. 0–100. */
  weekProgressPercent: number;
  /** % dos dias deste mês até hoje que o user treinou. 0–100. */
  monthProgressPercent: number;
  /** % dos dias deste ano até hoje que o user treinou. 0–100. */
  yearProgressPercent: number;
};

type MonthlyRecapInput = {
  user: EnrichedUser;
  posts: EnrichedPost[];
  now?: Date;
};

function getSaoPauloDateParts(date: Date): SaoPauloDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: RECAP_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);

  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(byType.get("year")),
    month: Number(byType.get("month")),
    day: Number(byType.get("day")),
  };
}

function getMonthKey(parts: SaoPauloDateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatMonthLabel(year: number, month: number, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(Date.UTC(year, month - 1, 15, 12));
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    timeZone: RECAP_TIME_ZONE,
    year: "numeric",
    ...options,
  }).format(date);
}

function formatReleaseLabel(year: number, month: number, lastDay: number): string {
  const date = new Date(Date.UTC(year, month - 1, lastDay, 12));
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    timeZone: RECAP_TIME_ZONE,
  }).format(date);
}

function countTopLabel(items: string[], fallback: string): string {
  const counts = new Map<string, { label: string; count: number }>();
  for (const raw of items) {
    const label = raw.trim();
    if (!label) continue;
    const key = label.toLocaleLowerCase("pt-BR");
    const current = counts.get(key);
    counts.set(key, { label: current?.label ?? label, count: (current?.count ?? 0) + 1 });
  }

  let winner: { label: string; count: number } | null = null;
  for (const item of counts.values()) {
    if (!winner || item.count > winner.count) winner = item;
  }
  return winner?.label ?? fallback;
}

function getPostLocationLabel(post: EnrichedPost): string {
  const explicitLocation = post.locationName?.trim();
  const gymName = post.gymName?.trim();
  if (explicitLocation && explicitLocation !== "Localização atual") return explicitLocation;
  if (gymName) return gymName;
  if (explicitLocation) return explicitLocation;
  return "";
}

function getTrainedDaysUnit(days: number): "dia" | "dias" {
  return days === 1 ? "dia" : "dias";
}

/**
 * Quantos dias do ano já passaram (1..365/366). Usado pra calcular
 * yearProgressPercent: divisor é o que o usuário JÁ teve disponível, não
 * o ano inteiro — senão sempre parece baixo no começo do ano.
 */
function getDayOfYear(parts: SaoPauloDateParts): number {
  let total = parts.day;
  for (let m = 1; m < parts.month; m += 1) {
    total += getDaysInMonth(parts.year, m);
  }
  return total;
}

/**
 * Date keys (YYYY-MM-DD) dos últimos 7 dias (incluindo hoje), em horário SP.
 * Usamos Set membership ao invés de range comparison pra evitar timezone bugs.
 */
function getLastSevenDayKeys(parts: SaoPauloDateParts): Set<string> {
  const keys = new Set<string>();
  // Reconstrói Date no UTC do 12h pra evitar DST jumps na conversão back-and-forth
  const anchor = Date.UTC(parts.year, parts.month - 1, parts.day, 12);
  for (let offset = 0; offset < 7; offset += 1) {
    const ts = new Date(anchor - offset * 24 * 60 * 60 * 1000);
    const sub = getSaoPauloDateParts(ts);
    keys.add(
      `${sub.year}-${String(sub.month).padStart(2, "0")}-${String(sub.day).padStart(2, "0")}`,
    );
  }
  return keys;
}

function clampPercent(value: number): number {
  if (Number.isNaN(value) || value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

export function isMonthlyRecapReleaseDay(date = new Date()): boolean {
  const parts = getSaoPauloDateParts(date);
  return parts.day === getDaysInMonth(parts.year, parts.month);
}

export function buildMonthlyRecap({
  user,
  posts,
  now = new Date(),
}: MonthlyRecapInput): MonthlyRecap {
  const parts = getSaoPauloDateParts(now);
  const monthKey = getMonthKey(parts);
  const daysInMonth = getDaysInMonth(parts.year, parts.month);
  const isAvailable = parts.day === daysInMonth;
  const monthPosts = posts
    .filter((post) => post.userId === user.id && post.workoutDate.startsWith(monthKey))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const trainedDaySet = new Set(monthPosts.map((post) => post.workoutDate));
  for (const dateKey of user.workoutDays) {
    if (dateKey.startsWith(monthKey)) trainedDaySet.add(dateKey);
  }
  const trainedDays = trainedDaySet.size;
  const trainedDaysUnit = getTrainedDaysUnit(trainedDays);
  const coverImageUrl =
    monthPosts.find((post) => post.mediaType === "image")?.imageUrl ??
    monthPosts[0]?.imageUrl ??
    null;

  // Anéis ano/mês/semana — divisor é o que JÁ passou ("dia X de Y do mês"),
  // não o total. Senão começo do ano/mês sempre parece sub-treinado.
  const yearKey = String(parts.year);
  const yearTrainedDays = user.workoutDays.filter((dateKey) =>
    dateKey.startsWith(yearKey),
  ).length;
  const dayOfYear = getDayOfYear(parts);
  const yearProgressPercent = clampPercent((yearTrainedDays / dayOfYear) * 100);

  // Mês: trainedDays / daysInMonth (não dividir por dia atual — divulga
  // "vc treinou X dos Y dias do mês"; ainda capa em 100 se zerar denom).
  const monthProgressPercent = clampPercent((trainedDays / daysInMonth) * 100);

  // Semana: últimos 7 dias / 7. Mais intuitivo que "ISO week" pro user
  // — o ring representa "como tá sua semana até agora".
  const lastSevenKeys = getLastSevenDayKeys(parts);
  const weekTrainedDays = user.workoutDays.filter((dateKey) =>
    lastSevenKeys.has(dateKey),
  ).length;
  const weekProgressPercent = clampPercent((weekTrainedDays / 7) * 100);

  return {
    userId: user.id,
    monthKey,
    monthLabel: formatMonthLabel(parts.year, parts.month),
    shortMonthLabel: formatMonthLabel(parts.year, parts.month, { year: undefined }),
    releaseLabel: formatReleaseLabel(parts.year, parts.month, daysInMonth),
    isAvailable,
    daysUntilRelease: Math.max(0, daysInMonth - parts.day),
    trainedDays,
    trainedDaysLabel: `${trainedDays} ${trainedDaysUnit}`,
    trainedDaysUnit,
    totalPosts: monthPosts.length,
    topWorkoutType: countTopLabel(
      monthPosts.map((post) => post.workoutType ?? "Outro"),
      "Outro",
    ),
    topLocation: countTopLabel(monthPosts.map(getPostLocationLabel), "Sem local"),
    coverImageUrl,
    progressPercent: monthProgressPercent,
    weekProgressPercent,
    monthProgressPercent,
    yearProgressPercent,
  };
}

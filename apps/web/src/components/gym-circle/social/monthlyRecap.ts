import type { EnrichedPost, EnrichedUser } from "./types";

const RECAP_TIME_ZONE = "America/Sao_Paulo";

type SaoPauloDateParts = {
  year: number;
  month: number;
  day: number;
};

/**
 * Sprint 5.10 — Recap multi-período.
 *
 * MonthlyRecap originalmente representava só o mês corrente. Agora a mesma
 * estrutura serve pra QUALQUER mês passado OU ano inteiro:
 *
 *   periodKind: 'month' → labels/dados de um mês específico (Maio 2026)
 *   periodKind: 'year'  → labels/dados de um ano inteiro (2026)
 *
 * `monthKey` mantém o nome legado mas pode carregar "2026" (year) ou
 * "2026-05" (month). Persistência em `profiles.monthly_recap_covers`
 * já suporta keys arbitrárias — sem migration nova.
 */
export type RecapPeriod =
  | { kind: "month"; year: number; month: number } // 1..12
  | { kind: "year"; year: number };

export type MonthlyRecap = {
  userId: string;
  /** Discriminante. */
  periodKind: "month" | "year";
  /** Key usada como índice em `monthly_recap_covers` JSONB. */
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
  /**
   * Sprint 5.10 — quando ausente, usa o mês corrente (period kind=month,
   * derivado de `now`). Quando present, ignora `now` pra filtros mas usa
   * pra checar isAvailable contra hoje.
   */
  period?: RecapPeriod;
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

/** Sprint 5.10 — total de dias do ano (365 ou 366 conforme bissexto). */
function getDaysInYear(year: number): number {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return isLeap ? 366 : 365;
}

function formatYearLabel(year: number): string {
  return String(year);
}

function formatYearReleaseLabel(year: number): string {
  const date = new Date(Date.UTC(year, 11, 31, 12));
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    timeZone: RECAP_TIME_ZONE,
  }).format(date);
}

export function buildMonthlyRecap({
  user,
  posts,
  now = new Date(),
  period,
}: MonthlyRecapInput): MonthlyRecap {
  const nowParts = getSaoPauloDateParts(now);
  // Default period = mês corrente derivado de `now` (back-compat).
  const effectivePeriod: RecapPeriod =
    period ?? { kind: "month", year: nowParts.year, month: nowParts.month };

  if (effectivePeriod.kind === "year") {
    return buildYearRecap({ user, posts, nowParts, year: effectivePeriod.year });
  }
  return buildMonthRecapInner({
    user,
    posts,
    nowParts,
    year: effectivePeriod.year,
    month: effectivePeriod.month,
  });
}

type InnerInput = {
  user: EnrichedUser;
  posts: EnrichedPost[];
  nowParts: SaoPauloDateParts;
  year: number;
};

function buildMonthRecapInner({
  user,
  posts,
  nowParts,
  year,
  month,
}: InnerInput & { month: number }): MonthlyRecap {
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const daysInMonth = getDaysInMonth(year, month);

  // isAvailable: mês corrente → último dia. Mês passado/futuro → passado=true,
  // futuro=false (não há recap pra mês que ainda não terminou).
  const isPast =
    year < nowParts.year ||
    (year === nowParts.year && month < nowParts.month);
  const isCurrent = year === nowParts.year && month === nowParts.month;
  const isAvailable = isPast || (isCurrent && nowParts.day === daysInMonth);
  const daysUntilRelease = isCurrent ? Math.max(0, daysInMonth - nowParts.day) : 0;

  const periodPosts = posts
    .filter((post) => post.userId === user.id && post.workoutDate.startsWith(monthKey))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const trainedDaySet = new Set(periodPosts.map((post) => post.workoutDate));
  for (const dateKey of user.workoutDays) {
    if (dateKey.startsWith(monthKey)) trainedDaySet.add(dateKey);
  }
  const trainedDays = trainedDaySet.size;
  const trainedDaysUnit = getTrainedDaysUnit(trainedDays);

  const coverImageUrl = pickCoverImageUrl(user, monthKey, periodPosts);

  // Rings: divisores expressam progresso REAL contra o tamanho do período.
  // Pra mês corrente: dividir pelo total ainda funciona (denominador estável).
  // Pra mês passado: trainedDays / daysInMonth também é a métrica certa
  // (afinal o mês já terminou — denominador é mesmo o total).
  const monthProgressPercent = clampPercent((trainedDays / daysInMonth) * 100);

  // Year ring: pra mês corrente usa "dia X de Y do ano" pra evitar parecer
  // sub-treinado no começo do ano. Pra mês passado, usa o ano inteiro do
  // mês escolhido — divisor = dias do ano OU dias até hoje (se ano corrente).
  const yearKey = String(year);
  const yearTrainedDays = user.workoutDays.filter((dateKey) =>
    dateKey.startsWith(yearKey),
  ).length;
  const yearDivisor =
    year === nowParts.year ? getDayOfYear(nowParts) : getDaysInYear(year);
  const yearProgressPercent = clampPercent((yearTrainedDays / yearDivisor) * 100);

  // Semana: sempre últimos 7 dias do "now", independente do period escolhido.
  // (semana do mês passado não faz sentido — semana é sempre "agora".)
  const lastSevenKeys = getLastSevenDayKeys(nowParts);
  const weekTrainedDays = user.workoutDays.filter((dateKey) =>
    lastSevenKeys.has(dateKey),
  ).length;
  const weekProgressPercent = clampPercent((weekTrainedDays / 7) * 100);

  return {
    userId: user.id,
    periodKind: "month",
    monthKey,
    monthLabel: formatMonthLabel(year, month),
    shortMonthLabel: formatMonthLabel(year, month, { year: undefined }),
    releaseLabel: formatReleaseLabel(year, month, daysInMonth),
    isAvailable,
    daysUntilRelease,
    trainedDays,
    trainedDaysLabel: `${trainedDays} ${trainedDaysUnit}`,
    trainedDaysUnit,
    totalPosts: periodPosts.length,
    topWorkoutType: countTopLabel(
      periodPosts.map((post) => post.workoutType ?? "Outro"),
      "Outro",
    ),
    topLocation: countTopLabel(periodPosts.map(getPostLocationLabel), "Sem local"),
    coverImageUrl,
    progressPercent: monthProgressPercent,
    weekProgressPercent,
    monthProgressPercent,
    yearProgressPercent,
  };
}

function buildYearRecap({ user, posts, nowParts, year }: InnerInput): MonthlyRecap {
  const yearKey = String(year);
  const daysInYear = getDaysInYear(year);

  // isAvailable: ano passado sempre true. Ano corrente true só em 31 dez.
  const isPast = year < nowParts.year;
  const isCurrent = year === nowParts.year;
  const isLastDayOfYear = nowParts.month === 12 && nowParts.day === 31;
  const isAvailable = isPast || (isCurrent && isLastDayOfYear);
  const daysUntilRelease = isCurrent
    ? Math.max(0, daysInYear - getDayOfYear(nowParts))
    : 0;

  const periodPosts = posts
    .filter((post) => post.userId === user.id && post.workoutDate.startsWith(`${yearKey}-`))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const trainedDaySet = new Set(periodPosts.map((post) => post.workoutDate));
  for (const dateKey of user.workoutDays) {
    if (dateKey.startsWith(`${yearKey}-`)) trainedDaySet.add(dateKey);
  }
  const trainedDays = trainedDaySet.size;
  const trainedDaysUnit = getTrainedDaysUnit(trainedDays);

  const coverImageUrl = pickCoverImageUrl(user, yearKey, periodPosts);

  // Year ring agora é o protagonista: divisor = dias do ano corrente / passado.
  const yearDivisor = isCurrent ? getDayOfYear(nowParts) : daysInYear;
  const yearProgressPercent = clampPercent((trainedDays / yearDivisor) * 100);

  // Month progress não faz sentido total no recap anual; usamos último mês
  // do ano como proxy ("Dez/2026" se ano corrente, "Dez/{year}" se passado).
  // Mas pra simplicidade do widget, pegamos média do ano.
  const monthProgressPercent = yearProgressPercent;

  const lastSevenKeys = getLastSevenDayKeys(nowParts);
  const weekTrainedDays = user.workoutDays.filter((dateKey) =>
    lastSevenKeys.has(dateKey),
  ).length;
  const weekProgressPercent = clampPercent((weekTrainedDays / 7) * 100);

  return {
    userId: user.id,
    periodKind: "year",
    monthKey: yearKey, // usado como key em monthly_recap_covers JSONB
    monthLabel: formatYearLabel(year),
    shortMonthLabel: formatYearLabel(year),
    releaseLabel: formatYearReleaseLabel(year),
    isAvailable,
    daysUntilRelease,
    trainedDays,
    trainedDaysLabel: `${trainedDays} ${trainedDaysUnit}`,
    trainedDaysUnit,
    totalPosts: periodPosts.length,
    topWorkoutType: countTopLabel(
      periodPosts.map((post) => post.workoutType ?? "Outro"),
      "Outro",
    ),
    topLocation: countTopLabel(periodPosts.map(getPostLocationLabel), "Sem local"),
    coverImageUrl,
    progressPercent: yearProgressPercent,
    weekProgressPercent,
    monthProgressPercent,
    yearProgressPercent,
  };
}

/**
 * Sprint 5.5a + 5.10 — Cover priorização (mês ou ano):
 *   1. Override user-picked via monthly_recap_covers[periodKey]
 *   2. Primeiro post de imagem do período (fallback auto)
 *   3. Primeiro post qualquer (fallback final)
 *   4. null (período sem posts)
 *
 * `periodKey` aceita tanto "YYYY-MM" (mês) quanto "YYYY" (ano).
 */
function pickCoverImageUrl(
  user: EnrichedUser,
  periodKey: string,
  periodPosts: EnrichedPost[],
): string | null {
  const userOverridePostId = user.monthlyRecapCovers?.[periodKey] ?? null;
  const userOverridePost = userOverridePostId
    ? periodPosts.find((post) => post.id === userOverridePostId)
    : null;
  return (
    userOverridePost?.imageUrl ??
    periodPosts.find((post) => post.mediaType === "image")?.imageUrl ??
    periodPosts[0]?.imageUrl ??
    null
  );
}

/**
 * Sprint 5.10 — gera lista de períodos selecionáveis pro PeriodPicker.
 *
 * Lista padrão (do mais recente pro mais antigo):
 *   1. Mês corrente
 *   2..N. Últimos N-1 meses (default N=6)
 *   N+1. Ano corrente (sempre por último, visualmente separado)
 *
 * Caller pode customizar `months` (quantos meses passados incluir).
 */
export function getRecapPeriodOptions(
  now: Date = new Date(),
  options: { months?: number } = {},
): RecapPeriod[] {
  const monthsBack = Math.max(1, options.months ?? 6);
  const parts = getSaoPauloDateParts(now);
  const periods: RecapPeriod[] = [];

  for (let offset = 0; offset < monthsBack; offset += 1) {
    const monthIndex = parts.month - 1 - offset; // 0-based
    const yearOffset = Math.floor(monthIndex / 12);
    const normalizedMonth = ((monthIndex % 12) + 12) % 12; // 0..11
    periods.push({
      kind: "month",
      year: parts.year + yearOffset,
      month: normalizedMonth + 1, // 1..12
    });
  }

  periods.push({ kind: "year", year: parts.year });
  return periods;
}

/**
 * Sprint 5.10 — converte um RecapPeriod no key usado em
 * `profiles.monthly_recap_covers` JSONB. Mantém compat com Sprint 5.5a
 * que só conhecia mês ("YYYY-MM").
 */
export function getRecapPeriodKey(period: RecapPeriod): string {
  if (period.kind === "year") return String(period.year);
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

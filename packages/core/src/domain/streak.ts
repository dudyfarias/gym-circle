import type { StreakLevel } from "./types";

export const streakLevels: StreakLevel[] = [
  { id: "iniciante",   label: "Iniciante",   shortLabel: "Novo",        minDays: 0,  nextLevelAt: 4,    tone: "cyan" },
  { id: "consistente", label: "Consistente", shortLabel: "Consistente", minDays: 4,  nextLevelAt: 14,   tone: "electric" },
  { id: "elite",       label: "Elite",       shortLabel: "Elite",       minDays: 14, nextLevelAt: 30,   tone: "blue" },
  { id: "lendario",    label: "Lendário",    shortLabel: "Lenda",       minDays: 30, nextLevelAt: null, tone: "deep" },
];

export function getStreakLevel(days: number): StreakLevel {
  return [...streakLevels].reverse().find((level) => days >= level.minDays) ?? streakLevels[0];
}

export function getAllStreakLevels(): StreakLevel[] {
  return streakLevels;
}

export function getStreakLevelProgress(days: number): number {
  const level = getStreakLevel(days);
  if (!level.nextLevelAt) return 100;
  const span = level.nextLevelAt - level.minDays;
  const progress = ((days - level.minDays) / span) * 100;
  return Math.max(8, Math.min(100, progress));
}

export function formatDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(dateKey: string, offset: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return formatDateKey(date);
}

export type ActivityDay = { date: string; hasPhoto: boolean };
export const INITIAL_STREAK_RESTORES = 3;
export const MAX_STREAK_RESTORES = 3;
export const WEEKLY_RESTORE_ACTIVE_DAYS = 6;

export type StreakSnapshot = {
  currentStreak: number;
  bestStreak: number;
  workoutsThisMonth: number;
  activeDaysThisYear: number;
  lastActiveDate: string | null;
  badgeIsActiveToday: boolean;
};

export type StreakSnapshotOptions = {
  restoredDates?: string[];
  badgeLitByRestoreToday?: boolean;
};

/**
 * Espelha a função SQL `private.calc_user_stats`. Útil para previews otimistas
 * no cliente e para os testes que validam a regra de "uma vez por dia".
 */
export function calcStreakSnapshot(
  rawDays: ActivityDay[],
  todayKey = formatDateKey(new Date()),
  options: StreakSnapshotOptions = {},
): StreakSnapshot {
  const photoDaysSet = new Set<string>();
  for (const day of rawDays) {
    if (day.hasPhoto) photoDaysSet.add(day.date);
  }
  const streakDaysSet = new Set(photoDaysSet);
  for (const date of options.restoredDates ?? []) {
    streakDaysSet.add(date);
  }
  const photoDays = Array.from(photoDaysSet).sort();
  const streakDays = Array.from(streakDaysSet).sort();

  let bestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const date of streakDays) {
    run = prev && addDays(prev, 1) === date ? run + 1 : 1;
    if (run > bestStreak) bestStreak = run;
    prev = date;
  }

  const hasRealActivityToday = photoDaysSet.has(todayKey);
  const badgeIsActiveToday = hasRealActivityToday || Boolean(options.badgeLitByRestoreToday);
  const anchor = hasRealActivityToday ? todayKey : addDays(todayKey, -1);

  let currentStreak = 0;
  let cursor = anchor;
  while (streakDaysSet.has(cursor)) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  const monthPrefix = todayKey.slice(0, 7);
  const yearPrefix = todayKey.slice(0, 4);
  const workoutsThisMonth = photoDays.filter((d) => d.startsWith(monthPrefix)).length;
  const activeDaysThisYear = photoDays.filter((d) => d.startsWith(yearPrefix)).length;
  const lastActiveDate = photoDays.length > 0 ? photoDays[photoDays.length - 1] : null;

  return {
    currentStreak,
    bestStreak: Math.max(bestStreak, currentStreak),
    workoutsThisMonth,
    activeDaysThisYear,
    lastActiveDate,
    badgeIsActiveToday,
  };
}

export function getInitialStreakRestores(): number {
  return INITIAL_STREAK_RESTORES;
}

export function clampStreakRestores(value: number): number {
  return Math.max(0, Math.min(MAX_STREAK_RESTORES, value));
}

export function applyRestoreEarned(current: number): number {
  return clampStreakRestores(current + 1);
}

export function consumeStreakRestore(current: number): number {
  return clampStreakRestores(current - 1);
}

function uniqueDateKeys(dates: string[]): string[] {
  return Array.from(new Set(dates)).sort();
}

function countStreakEndingAt(dateSet: Set<string>, anchor: string): number {
  let count = 0;
  let cursor = anchor;
  while (dateSet.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function weekStartForDateKey(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return formatDateKey(date);
}

function defaultRestoreDeadline(missedDate: string): Date {
  return new Date(`${addDays(missedDate, 2)}T00:00:00.000Z`);
}

export type StreakRestoreOpportunityInput = {
  activityDates: string[];
  restoredDates?: string[];
  restoresAvailable: number;
  todayKey: string;
  now?: Date;
  deadlineAt?: Date | string | null;
};

export type StreakRestoreOpportunity = {
  canRestore: boolean;
  missedDate: string | null;
  deadlineAt: Date | null;
  previousStreak: number;
  reason:
    | "available"
    | "no_balance"
    | "already_active"
    | "already_restored"
    | "chained_restore"
    | "expired"
    | "no_previous_streak";
};

export function getStreakRestoreOpportunity(
  input: StreakRestoreOpportunityInput,
): StreakRestoreOpportunity {
  const now = input.now ?? new Date();
  const missedDate = addDays(input.todayKey, -1);
  const realActivityDates = new Set(uniqueDateKeys(input.activityDates));
  const restoredDates = new Set(uniqueDateKeys(input.restoredDates ?? []));
  const streakDates = new Set([...realActivityDates, ...restoredDates]);
  const deadlineAt = input.deadlineAt
    ? new Date(input.deadlineAt)
    : defaultRestoreDeadline(missedDate);

  if (input.restoresAvailable <= 0) {
    return { canRestore: false, missedDate, deadlineAt, previousStreak: 0, reason: "no_balance" };
  }

  if (realActivityDates.has(missedDate)) {
    return { canRestore: false, missedDate, deadlineAt, previousStreak: 0, reason: "already_active" };
  }

  if (restoredDates.has(missedDate)) {
    return { canRestore: false, missedDate, deadlineAt, previousStreak: 0, reason: "already_restored" };
  }

  if (restoredDates.has(addDays(missedDate, -1))) {
    return { canRestore: false, missedDate, deadlineAt, previousStreak: 0, reason: "chained_restore" };
  }

  const previousStreak = countStreakEndingAt(streakDates, addDays(missedDate, -1));
  if (previousStreak <= 0) {
    return { canRestore: false, missedDate, deadlineAt, previousStreak, reason: "no_previous_streak" };
  }

  if (now.getTime() >= deadlineAt.getTime()) {
    return { canRestore: false, missedDate, deadlineAt, previousStreak, reason: "expired" };
  }

  return { canRestore: true, missedDate, deadlineAt, previousStreak, reason: "available" };
}

export type WeeklyRestoreInput = {
  activityDates: string[];
  todayKey: string;
  restoresAvailable: number;
  lastEarnedWeek?: string | null;
};

export function getWeeklyRestoreWeekKey(todayKey: string): string {
  return weekStartForDateKey(todayKey);
}

export function shouldEarnWeeklyRestore(input: WeeklyRestoreInput) {
  const weekStart = weekStartForDateKey(input.todayKey);
  const weekEnd = addDays(weekStart, 7);
  const activeDays = uniqueDateKeys(input.activityDates).filter(
    (date) => date >= weekStart && date < weekEnd,
  ).length;

  return {
    shouldEarn:
      activeDays >= WEEKLY_RESTORE_ACTIVE_DAYS &&
      input.restoresAvailable < MAX_STREAK_RESTORES &&
      input.lastEarnedWeek !== weekStart,
    activeDays,
    weekStart,
  };
}

export type ConsistencyProgressInput = {
  badgeIsActiveToday: boolean;
  workoutsThisMonth: number;
  activeDaysThisYear: number;
};

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function getDayOfYear(date: Date): number {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  const diff = date.getTime() - start.getTime();
  return Math.max(1, Math.floor(diff / 86400000));
}

export function getConsistencyProgress(
  input: ConsistencyProgressInput,
  today = new Date(),
) {
  const elapsedMonthDays = Math.max(1, today.getUTCDate());
  const elapsedYearDays = getDayOfYear(today);
  return {
    day: input.badgeIsActiveToday ? 100 : 22,
    month: clampPercent((input.workoutsThisMonth / elapsedMonthDays) * 100),
    year: clampPercent((input.activeDaysThisYear / elapsedYearDays) * 100),
  };
}

export function buildConsistencyRings(input: ConsistencyProgressInput) {
  const progress = getConsistencyProgress(input);
  return [
    { id: "year",  label: "Ano", color: "var(--gc-consistency-year)",  glow: "rgba(0,102,255,0.18)",  value: progress.year  },
    { id: "month", label: "Mes", color: "var(--gc-consistency-month)", glow: "rgba(48,213,255,0.24)", value: progress.month },
    {
      id: "day",
      label: "Dia",
      color: input.badgeIsActiveToday ? "var(--gc-consistency-daily)" : "rgba(140,251,255,0.36)",
      glow: input.badgeIsActiveToday ? "rgba(140,251,255,0.28)" : "rgba(48,213,255,0)",
      value: progress.day,
    },
  ];
}

export function buildMonthCalendar(activityDates: string[], todayKey = formatDateKey(new Date())) {
  const monthKey = todayKey.slice(0, 7);
  const [year, month] = monthKey.split("-").map(Number);
  const totalDays = new Date(year, month, 0).getDate();
  const daySet = new Set(activityDates);
  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`;
    return { day, dateKey, trained: daySet.has(dateKey) };
  });
}

import type { GymPost, GymStory } from "./types";

export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export type StreakLevelId = "iniciante" | "consistente" | "elite" | "lendario";

export type StreakLevel = {
  id: StreakLevelId;
  label: string;
  shortLabel: string;
  minDays: number;
  nextLevelAt: number | null;
  tone: "cyan" | "electric" | "blue" | "deep";
};

const streakLevels: StreakLevel[] = [
  {
    id: "iniciante",
    label: "Iniciante",
    shortLabel: "Novo",
    minDays: 0,
    nextLevelAt: 4,
    tone: "cyan",
  },
  {
    id: "consistente",
    label: "Consistente",
    shortLabel: "Consistente",
    minDays: 4,
    nextLevelAt: 14,
    tone: "electric",
  },
  {
    id: "elite",
    label: "Elite",
    shortLabel: "Elite",
    minDays: 14,
    nextLevelAt: 30,
    tone: "blue",
  },
  {
    id: "lendario",
    label: "Lendário",
    shortLabel: "Lenda",
    minDays: 30,
    nextLevelAt: null,
    tone: "deep",
  },
];

export function getStreakLevel(days: number) {
  return [...streakLevels].reverse().find((level) => days >= level.minDays) ?? streakLevels[0];
}

export function getAllStreakLevels() {
  return streakLevels;
}

export function getStreakLevelProgress(days: number) {
  const level = getStreakLevel(days);

  if (!level.nextLevelAt) {
    return 100;
  }

  const span = level.nextLevelAt - level.minDays;
  const progress = ((days - level.minDays) / span) * 100;

  return Math.max(8, Math.min(100, progress));
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getDayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();

  return Math.max(1, Math.floor(diff / 86400000));
}

export type ConsistencyProgressInput = {
  streakLitToday: boolean;
  workoutsThisMonth: number;
  activeDaysCount: number;
};

export function getConsistencyProgress(
  input: ConsistencyProgressInput,
  today = new Date(),
) {
  const elapsedMonthDays = Math.max(1, today.getDate());
  const elapsedYearDays = getDayOfYear(today);

  return {
    day: input.streakLitToday ? 100 : 22,
    month: clampPercent((input.workoutsThisMonth / elapsedMonthDays) * 100),
    year: clampPercent((input.activeDaysCount / elapsedYearDays) * 100),
  };
}

export function buildConsistencyRings(input: ConsistencyProgressInput) {
  const progress = getConsistencyProgress(input);

  return [
    {
      id: "year",
      label: "Ano",
      color: "var(--gc-consistency-year)",
      glow: "rgba(0,102,255,0.18)",
      value: progress.year,
    },
    {
      id: "month",
      label: "Mês",
      color: "var(--gc-consistency-month)",
      glow: "rgba(48,213,255,0.24)",
      value: progress.month,
    },
    {
      id: "day",
      label: "Dia",
      color: input.streakLitToday
        ? "var(--gc-consistency-daily)"
        : "rgba(140,251,255,0.36)",
      glow: input.streakLitToday ? "rgba(140,251,255,0.28)" : "rgba(48,213,255,0)",
      value: progress.day,
    },
  ];
}

export function isFitnessStory(story: Pick<GymStory, "kind">) {
  return story.kind === "workout" || story.kind === "milestone";
}

export function getDailyStreakPresence(
  userId: string,
  posts: GymPost[],
  stories: GymStory[],
  todayKey = formatDateKey(new Date()),
) {
  const hasFeedPhoto = posts.some(
    (post) =>
      post.userId === userId &&
      post.workoutDate === todayKey &&
      post.imageUrl.trim().length > 0,
  );

  const hasFitnessStory = stories.some(
    (story) =>
      story.userId === userId &&
      isFitnessStory(story) &&
      formatDateKey(new Date(story.createdAt)) === todayKey,
  );

  return {
    streakLitToday: hasFeedPhoto || hasFitnessStory,
    streakPresenceSource: hasFeedPhoto
      ? "feed-photo"
      : hasFitnessStory
        ? "fitness-story"
        : "none",
  } as const;
}

export function addDays(dateKey: string, offset: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + offset);

  return formatDateKey(date);
}

export function calculateWorkoutStats(workoutDays: string[], todayKey = formatDateKey(new Date())) {
  const uniqueDays = Array.from(new Set(workoutDays)).sort();
  const daySet = new Set(uniqueDays);
  const anchor = daySet.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let currentStreak = 0;
  let cursor = anchor;

  while (daySet.has(cursor)) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  let longestStreak = 0;
  let run = 0;
  let previous: string | null = null;

  for (const day of uniqueDays) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = day;
  }

  const monthKey = todayKey.slice(0, 7);
  const workoutsThisMonth = uniqueDays.filter((day) => day.startsWith(monthKey)).length;
  const lastWorkoutDate = uniqueDays.at(-1) ?? "";

  return {
    currentStreak,
    longestStreak,
    lastWorkoutDate,
    workoutsThisMonth,
  };
}

export function buildMonthWorkoutDays(workoutDays: string[], todayKey = formatDateKey(new Date())) {
  const monthKey = todayKey.slice(0, 7);
  const [year, month] = monthKey.split("-").map(Number);
  const totalDays = new Date(year, month, 0).getDate();
  const daySet = new Set(workoutDays);

  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`;

    return {
      day,
      dateKey,
      trained: daySet.has(dateKey),
    };
  });
}

export function formatWorkoutDate(dateKey: string) {
  if (!dateKey) {
    return "Ainda hoje";
  }

  const [, month, day] = dateKey.split("-");

  return `${day}/${month}`;
}

import type { GymPost, GymStory } from "./types";

export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatDayUnit(days: number) {
  return days === 1 ? "dia" : "dias";
}

export function formatStreakDays(days: number) {
  return `${days} ${formatDayUnit(days)}`;
}

export function formatTrainingStreakText(name: string, days: number) {
  return `${name} está há ${formatStreakDays(days)} treinando`;
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

/**
 * Início (segunda-feira 00:00 local) da semana ISO 8601 da data dada.
 * Sprint 3.5: usado pra calcular `workoutsThisWeek` (segunda → domingo).
 */
export function getMondayOfWeek(date: Date): Date {
  const day = date.getDay(); // 0=dom, 1=seg, 2=ter, ..., 6=sáb
  const offsetToMonday = day === 0 ? 6 : day - 1;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - offsetToMonday,
  );
}

/**
 * Total de dias do mês da data dada (28/29/30/31 conforme o calendário).
 * Sprint 3.5: denominador do ring de Mês ("X / total de dias do mês").
 */
export function getTotalDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Total de dias do ano (365 ou 366) — bissexto: divisível por 4, exceto
 * múltiplos de 100, exceto múltiplos de 400. Sprint 3.5: denominador do
 * ring de Ano.
 */
export function getTotalDaysInYear(date: Date): number {
  const year = date.getFullYear();
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return isLeap ? 366 : 365;
}

export type ConsistencyProgressInput = {
  workoutsThisWeek: number;
  workoutsThisMonth: number;
  workoutsThisYear: number;
};

/**
 * Sprint 3.5 — os 3 rings do "Gym Circle" representam:
 *   - Semana atual (segunda → domingo): X / 7
 *   - Mês atual: X / total de dias do mês
 *   - Ano atual: X / total de dias do ano
 *
 * Decisão de produto (Eduardo): usar TOTAL do período como denominador,
 * não "dias decorridos". Trade-off conhecido: no início do mês, o ring
 * parece "vazio" mesmo treinando todo dia (4/31 ≈ 13%). Compensa a
 * mensagem de progresso contínuo ao longo do período.
 */
export function getConsistencyProgress(
  input: ConsistencyProgressInput,
  today = new Date(),
) {
  return {
    week: clampPercent((input.workoutsThisWeek / 7) * 100),
    month: clampPercent(
      (input.workoutsThisMonth / getTotalDaysInMonth(today)) * 100,
    ),
    year: clampPercent(
      (input.workoutsThisYear / getTotalDaysInYear(today)) * 100,
    ),
  };
}

/**
 * Sprint 3.5 — ordem fixa: índice 0 = mais externo (maior raio). Como o
 * `ActivityCircle` desenha radius = center − stroke/2 − index * gap, o
 * primeiro elemento é o ring de fora. Aqui:
 *   index 0 → Ano (envolve tudo, raio máximo)
 *   index 1 → Mês (meio)
 *   index 2 → Semana (mais próximo do avatar)
 */
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
      id: "week",
      label: "Semana",
      color: "var(--gc-consistency-week, var(--gc-consistency-daily))",
      glow: "rgba(140,251,255,0.28)",
      value: progress.week,
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

  // Sprint 3.5: derivar contagens dos 3 períodos dos rings do Gym Circle.
  // - Semana corrente (segunda-domingo): set de 7 keys via `getMondayOfWeek`.
  // - Mês corrente: prefix do `monthKey` (YYYY-MM).
  // - Ano corrente: prefix do `yearKey` (YYYY).
  const today = new Date(`${todayKey}T12:00:00`);
  const mondayKey = formatDateKey(getMondayOfWeek(today));
  const weekKeys = new Set<string>();
  for (let i = 0; i < 7; i += 1) {
    weekKeys.add(addDays(mondayKey, i));
  }
  const monthKey = todayKey.slice(0, 7);
  const yearKey = todayKey.slice(0, 4);
  const workoutsThisWeek = uniqueDays.filter((day) => weekKeys.has(day)).length;
  const workoutsThisMonth = uniqueDays.filter((day) => day.startsWith(monthKey)).length;
  const workoutsThisYear = uniqueDays.filter((day) => day.startsWith(`${yearKey}-`)).length;
  const lastWorkoutDate = uniqueDays.at(-1) ?? "";

  return {
    currentStreak,
    longestStreak,
    lastWorkoutDate,
    workoutsThisWeek,
    workoutsThisMonth,
    workoutsThisYear,
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

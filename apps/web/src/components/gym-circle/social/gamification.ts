import type { EnrichedPost, EnrichedUser } from "./types";

/**
 * Gamification helpers — Sprint 3.5.3.
 *
 * Helpers puros pra derivar badges, níveis e progresso da
 * gamificação a partir de dados que JÁ existem no `EnrichedUser` +
 * counts dos arrays do hook social.
 *
 * IMPORTANTE: nenhum badge é fake. Cada um tem regra clara baseada em
 * dado real disponível. Quando o dado não está disponível (ex.: stories
 * do user), o badge é considerado bloqueado em vez de fake.
 *
 * Sprint 3.5.4 vai mover isso pra um `GamificationService` com cache
 * curto + acesso a `user_activity_days` pra calendário e métricas mais
 * ricas. Por enquanto: tudo client-side, sem rede.
 */

export type BadgeId =
  | "first-workout"
  | "streak-3"
  | "streak-7"
  | "streak-14"
  | "streak-30"
  | "month-active"
  | "year-active"
  | "social"
  | "popular"
  | "active-week"
  | "streak-recovered";

export type Badge = {
  id: BadgeId;
  label: string;
  description: string;
  earned: boolean;
};

type GamificationInput = {
  user: EnrichedUser;
  postsCount: number;
  hasUsedStreakRestore?: boolean;
};

export type AchievementCategory = "badge" | "medal" | "trophy" | "relic" | "challenge";
export type AchievementRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type AchievementDifficulty = "easy" | "medium" | "hard" | "legendary";
export type AchievementVisualKind = "badge3d" | "medal3d" | "trophy3d" | "relic3d";

export type AchievementProgress = {
  current: number;
  target: number;
  unit: string;
};

export type AchievementVisual = {
  kind: AchievementVisualKind;
  material: "glass" | "bronze" | "silver" | "gold" | "crystal" | "obsidian" | "sapphire";
  tone: "cyan" | "blue" | "bronze" | "silver" | "gold" | "crystal" | "dark";
  monogram: string;
};

export type AchievementRarityStats = {
  achievementId: string;
  ownersCount: number;
  totalUsers: number;
  ownedPercent: number;
};

export type AchievementV2 = {
  id: string;
  category: AchievementCategory;
  label: string;
  description: string;
  lockedDescription: string;
  earned: boolean;
  rarity: AchievementRarity;
  visual: AchievementVisual;
  progress?: AchievementProgress;
  isSecret?: boolean;
  monthKey?: string;
  repeatable?: boolean;
  legacyBadgeId?: BadgeId;
  rarityStats?: AchievementRarityStats;
  earnedAt?: string | null;
  lastEarnedAt?: string | null;
  timesEarned?: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  rewardLabel?: string | null;
  sortWeight: number;
};

export type MonthlyChallenge = {
  id: string;
  title: string;
  description: string;
  month: number;
  year: number;
  monthKey: string;
  startDate: string;
  endDate: string;
  difficulty: AchievementDifficulty;
  rewardType: "trophy" | "relic";
  rewardId: string;
  goal: AchievementProgress;
  isCompleted: boolean;
  achievement: AchievementV2;
};

type GamificationV2Input = GamificationInput & {
  posts: EnrichedPost[];
  now?: Date;
  rarityStats?: Record<string, AchievementRarityStats>;
};

function clampProgress(current: number, target: number): AchievementProgress {
  return {
    current: Math.max(0, Math.min(current, target)),
    target,
    unit: "dias",
  };
}

function progress(current: number, target: number, unit: string): AchievementProgress {
  return {
    current: Math.max(0, Math.min(current, target)),
    target,
    unit,
  };
}

function formatSaoPauloDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

function getSaoPauloHour(date: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).format(date);
  return Number(hour);
}

function getMonthBounds(now: Date) {
  const monthKey = formatSaoPauloDateKey(now).slice(0, 7);
  const [year, month] = monthKey.split("-").map(Number);
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    year,
    month,
    monthKey,
    startDate: `${monthKey}-01`,
    endDate: `${monthKey}-${String(endDay).padStart(2, "0")}`,
  };
}

function dateKeyToIso(dateKey?: string | null) {
  if (!dateKey) return null;
  return `${dateKey}T12:00:00.000Z`;
}

function sortPostsByCreatedAt(posts: EnrichedPost[]) {
  return [...posts].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function countMatchingDays(posts: EnrichedPost[], minimumPostsInDay: number) {
  const counts = new Map<string, number>();
  for (const post of posts) {
    counts.set(post.workoutDate, (counts.get(post.workoutDate) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count >= minimumPostsInDay)
    .map(([dateKey]) => dateKey)
    .sort();
}

function uniqueWorkoutDays(user: EnrichedUser) {
  return Array.from(new Set(user.workoutDays ?? [])).sort();
}

function maxPostsInSingleDay(posts: EnrichedPost[]): number {
  const counts = new Map<string, number>();
  for (const post of posts) {
    counts.set(post.workoutDate, (counts.get(post.workoutDate) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}

function differentWorkoutTypesThisWeek(posts: EnrichedPost[], now: Date): number {
  const todayKey = formatSaoPauloDateKey(now);
  const anchor = new Date(`${todayKey}T12:00:00`);
  const day = anchor.getDay();
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((day + 6) % 7));
  const weekStart = formatSaoPauloDateKey(monday);
  const types = new Set(
    posts
      .filter((post) => post.workoutDate >= weekStart && post.workoutDate <= todayKey)
      .map((post) => post.workoutType ?? "Outro")
      .filter(Boolean),
  );
  return types.size;
}

function makeAchievement(input: Omit<AchievementV2, "lockedDescription"> & { lockedDescription?: string }): AchievementV2 {
  return {
    lockedDescription: input.description,
    ...input,
  };
}

function withRarityStats(
  achievements: AchievementV2[],
  rarityStats?: Record<string, AchievementRarityStats>,
): AchievementV2[] {
  if (!rarityStats) return achievements;
  return achievements.map((achievement) => ({
    ...achievement,
    rarityStats: rarityStats[achievement.id],
  }));
}

/**
 * Cada badge tem regra puramente derivacional. Ordem é a de exibição
 * (UI mostra grid na mesma ordem).
 */
export function getEarnedBadges({
  user,
  postsCount,
  hasUsedStreakRestore = false,
}: GamificationInput): Badge[] {
  const badges: Badge[] = [
    {
      id: "first-workout",
      label: "Primeiro treino",
      description: "Publicou seu primeiro treino no feed.",
      earned: postsCount >= 1,
    },
    {
      id: "streak-3",
      label: "3 dias seguidos",
      description: "Treinou 3 dias consecutivos.",
      earned: user.longestStreak >= 3,
    },
    {
      id: "streak-7",
      label: "Semana cheia",
      description: "Treinou 7 dias consecutivos.",
      earned: user.longestStreak >= 7,
    },
    {
      id: "streak-14",
      label: "2 semanas seguidas",
      description: "Treinou 14 dias consecutivos.",
      earned: user.longestStreak >= 14,
    },
    {
      id: "streak-30",
      label: "Mês completo",
      description: "Treinou 30 dias consecutivos.",
      earned: user.longestStreak >= 30,
    },
    {
      id: "active-week",
      label: "Consistente na semana",
      description: "Treinou 5+ dias nesta semana.",
      earned: (user.workoutsThisWeek ?? 0) >= 5,
    },
    {
      id: "month-active",
      label: "Mês ativo",
      description: "Treinou 15+ dias neste mês.",
      earned: user.workoutsThisMonth >= 15,
    },
    {
      id: "year-active",
      label: "Ano em alta",
      description: "100+ dias treinados neste ano.",
      earned: user.activeDaysCount >= 100,
    },
    {
      id: "social",
      label: "Social",
      description: "Tem 10+ seguidores no Gym Circle.",
      earned: user.followersCount >= 10,
    },
    {
      id: "popular",
      label: "Popular",
      description: "Tem 50+ seguidores.",
      earned: user.followersCount >= 50,
    },
    {
      id: "streak-recovered",
      label: "Recuperou a streak",
      description: "Usou um restaurador pra salvar o circle.",
      earned: hasUsedStreakRestore,
    },
  ];
  return badges;
}

/**
 * Conta quantos badges foram conquistados (helper UI).
 */
export function countEarnedBadges(badges: Badge[]): number {
  return badges.filter((b) => b.earned).length;
}

/**
 * Encontra o próximo badge mais próximo de ser ganho (ainda não
 * conquistado), com texto curto pro CTA "Falta pouco pra X".
 *
 * Heurística: pega o primeiro badge não-ganho da lista. Como a lista
 * está ordenada visualmente, normalmente é o próximo lógico.
 */
export function getNextBadge(badges: Badge[]): Badge | null {
  return badges.find((b) => !b.earned) ?? null;
}

export function getAchievementsV2({
  user,
  posts,
  postsCount,
  hasUsedStreakRestore = false,
  now = new Date(),
  rarityStats,
}: GamificationV2Input): AchievementV2[] {
  const sortedPosts = sortPostsByCreatedAt(posts);
  const firstPostAt = sortedPosts[0]?.createdAt ?? null;
  const lastPostAt =
    sortedPosts[sortedPosts.length - 1]?.createdAt ??
    dateKeyToIso(user.lastWorkoutDate);
  const activeDayKeys = uniqueWorkoutDays(user);
  const activeDays = Math.max(user.activeDaysCount ?? 0, activeDayKeys.length);
  const storyCount = typeof user.storyCount === "number" ? user.storyCount : null;
  const firstStoryEarned = storyCount !== null && storyCount >= 1;
  const ghostEarned = storyCount !== null && storyCount === 0 && activeDays >= 30;
  const maxPostsDay = maxPostsInSingleDay(posts);
  const workoutTypesThisWeek = differentWorkoutTypesThisWeek(posts, now);
  const lateNightPosts = sortedPosts.filter((post) => getSaoPauloHour(new Date(post.createdAt)) >= 23);
  const earlyPosts = sortedPosts.filter((post) => getSaoPauloHour(new Date(post.createdAt)) < 5);
  const groupWorkoutPosts = sortedPosts.filter(
    (post) => (post.acceptedParticipants?.length ?? 0) > 0,
  );
  const lightningDays = countMatchingDays(posts, 3);
  const hasLateNightPost = lateNightPosts.length > 0;
  const hasEarlyPost = earlyPosts.length > 0;
  const currentMonth = getMonthBounds(now);
  const monthDays = user.workoutDays.filter((day) => day.startsWith(currentMonth.monthKey)).length;

  const legacyBadges = getEarnedBadges({ user, postsCount, hasUsedStreakRestore });
  const legacyById = new Map(legacyBadges.map((badge) => [badge.id, badge]));

  const achievements: AchievementV2[] = [
    makeAchievement({
      id: "first-workout",
      legacyBadgeId: "first-workout",
      category: "badge",
      label: legacyById.get("first-workout")!.label,
      description: legacyById.get("first-workout")!.description,
      earned: postsCount >= 1,
      rarity: "common",
      progress: progress(postsCount, 1, "post"),
      visual: { kind: "badge3d", material: "glass", tone: "cyan", monogram: "1" },
      earnedAt: firstPostAt,
      lastEarnedAt: firstPostAt,
      timesEarned: postsCount >= 1 ? 1 : 0,
      sortWeight: 10,
    }),
    makeAchievement({
      id: "first-checkin",
      category: "badge",
      label: "Primeiro check-in",
      description: "Registrou presença em uma academia ou local.",
      lockedDescription: "Faça seu primeiro check-in.",
      earned: user.checkInsCount >= 1,
      rarity: "common",
      progress: progress(user.checkInsCount, 1, "check-in"),
      visual: { kind: "badge3d", material: "glass", tone: "blue", monogram: "CI" },
      timesEarned: user.checkInsCount >= 1 ? 1 : 0,
      sortWeight: 20,
    }),
    makeAchievement({
      id: "first-story",
      category: "badge",
      label: "Primeiro story",
      description: "Publicou seu primeiro story fitness.",
      lockedDescription: "Publique um story fitness.",
      earned: firstStoryEarned,
      rarity: "common",
      progress: progress(storyCount ?? 0, 1, "story"),
      visual: { kind: "badge3d", material: "glass", tone: "cyan", monogram: "S" },
      timesEarned: firstStoryEarned ? 1 : 0,
      sortWeight: 25,
    }),
    makeAchievement({
      id: "first-comment",
      category: "badge",
      label: "Primeiro comentário",
      description: "Entrou na conversa da comunidade.",
      lockedDescription: "Comente em um treino.",
      earned: false,
      rarity: "common",
      progress: progress(0, 1, "comentário"),
      visual: { kind: "badge3d", material: "glass", tone: "cyan", monogram: "@" },
      sortWeight: 30,
    }),
    makeAchievement({
      id: "first-group-workout",
      category: "badge",
      label: "Treino em equipe",
      description: "Participou de um treino marcado com amigos.",
      lockedDescription: "Aceite ou marque um amigo em um treino.",
      earned: groupWorkoutPosts.length > 0,
      rarity: "uncommon",
      progress: progress(groupWorkoutPosts.length > 0 ? 1 : 0, 1, "treino"),
      visual: { kind: "badge3d", material: "glass", tone: "blue", monogram: "2" },
      earnedAt: groupWorkoutPosts[0]?.createdAt ?? null,
      lastEarnedAt: groupWorkoutPosts[groupWorkoutPosts.length - 1]?.createdAt ?? null,
      timesEarned: groupWorkoutPosts.length,
      sortWeight: 40,
    }),
    makeAchievement({
      id: "streak-3",
      legacyBadgeId: "streak-3",
      category: "medal",
      label: "3 dias seguidos",
      description: "Começou uma sequência real.",
      lockedDescription: "Treine 3 dias consecutivos.",
      earned: user.longestStreak >= 3,
      rarity: "common",
      progress: progress(user.longestStreak, 3, "dias"),
      visual: { kind: "medal3d", material: "bronze", tone: "bronze", monogram: "3" },
      earnedAt: user.longestStreak >= 3 ? lastPostAt : null,
      lastEarnedAt: user.longestStreak >= 3 ? lastPostAt : null,
      timesEarned: user.longestStreak >= 3 ? 1 : 0,
      sortWeight: 110,
    }),
    makeAchievement({
      id: "streak-7",
      legacyBadgeId: "streak-7",
      category: "medal",
      label: "Semana cheia",
      description: "Treinou 7 dias consecutivos.",
      lockedDescription: "Treine 7 dias consecutivos.",
      earned: user.longestStreak >= 7,
      rarity: "uncommon",
      progress: progress(user.longestStreak, 7, "dias"),
      visual: { kind: "medal3d", material: "silver", tone: "silver", monogram: "7" },
      earnedAt: user.longestStreak >= 7 ? lastPostAt : null,
      lastEarnedAt: user.longestStreak >= 7 ? lastPostAt : null,
      timesEarned: user.longestStreak >= 7 ? 1 : 0,
      sortWeight: 120,
    }),
    makeAchievement({
      id: "streak-14",
      legacyBadgeId: "streak-14",
      category: "medal",
      label: "2 semanas seguidas",
      description: "Construiu consistência acima da média.",
      lockedDescription: "Treine 14 dias consecutivos.",
      earned: user.longestStreak >= 14,
      rarity: "rare",
      progress: progress(user.longestStreak, 14, "dias"),
      visual: { kind: "medal3d", material: "gold", tone: "gold", monogram: "14" },
      earnedAt: user.longestStreak >= 14 ? lastPostAt : null,
      lastEarnedAt: user.longestStreak >= 14 ? lastPostAt : null,
      timesEarned: user.longestStreak >= 14 ? 1 : 0,
      sortWeight: 130,
    }),
    makeAchievement({
      id: "streak-30",
      legacyBadgeId: "streak-30",
      category: "trophy",
      label: "Mês completo",
      description: "Treinou 30 dias consecutivos.",
      lockedDescription: "Treine 30 dias consecutivos.",
      earned: user.longestStreak >= 30,
      rarity: "epic",
      progress: progress(user.longestStreak, 30, "dias"),
      visual: { kind: "trophy3d", material: "gold", tone: "gold", monogram: "30" },
      earnedAt: user.longestStreak >= 30 ? lastPostAt : null,
      lastEarnedAt: user.longestStreak >= 30 ? lastPostAt : null,
      timesEarned: user.longestStreak >= 30 ? 1 : 0,
      sortWeight: 210,
    }),
    makeAchievement({
      id: "perfect-week",
      category: "trophy",
      label: "Semana perfeita",
      description: "Acendeu o circle em todos os 7 dias da semana.",
      lockedDescription: "Treine 7 dias na mesma semana.",
      earned: (user.workoutsThisWeek ?? 0) >= 7,
      rarity: "rare",
      progress: progress(user.workoutsThisWeek ?? 0, 7, "dias"),
      visual: { kind: "trophy3d", material: "sapphire", tone: "blue", monogram: "W" },
      earnedAt: (user.workoutsThisWeek ?? 0) >= 7 ? lastPostAt : null,
      lastEarnedAt: (user.workoutsThisWeek ?? 0) >= 7 ? lastPostAt : null,
      timesEarned: (user.workoutsThisWeek ?? 0) >= 7 ? 1 : 0,
      sortWeight: 220,
    }),
    makeAchievement({
      id: "hundred-workouts",
      category: "trophy",
      label: "100 treinos",
      description: "Publicou 100 treinos no Gym Circle.",
      lockedDescription: "Publique 100 treinos.",
      earned: postsCount >= 100,
      rarity: "epic",
      progress: progress(postsCount, 100, "treinos"),
      visual: { kind: "trophy3d", material: "gold", tone: "gold", monogram: "100" },
      earnedAt: postsCount >= 100 ? sortedPosts[99]?.createdAt ?? lastPostAt : null,
      lastEarnedAt: postsCount >= 100 ? lastPostAt : null,
      timesEarned: Math.floor(postsCount / 100),
      sortWeight: 230,
    }),
    makeAchievement({
      id: "active-week",
      legacyBadgeId: "active-week",
      category: "medal",
      label: "Consistente na semana",
      description: "Treinou 5+ dias nesta semana.",
      lockedDescription: "Treine 5 dias na mesma semana.",
      earned: (user.workoutsThisWeek ?? 0) >= 5,
      rarity: "uncommon",
      progress: progress(user.workoutsThisWeek ?? 0, 5, "dias"),
      visual: { kind: "medal3d", material: "silver", tone: "silver", monogram: "5" },
      earnedAt: (user.workoutsThisWeek ?? 0) >= 5 ? lastPostAt : null,
      lastEarnedAt: (user.workoutsThisWeek ?? 0) >= 5 ? lastPostAt : null,
      timesEarned: (user.workoutsThisWeek ?? 0) >= 5 ? 1 : 0,
      sortWeight: 135,
    }),
    makeAchievement({
      id: "month-active",
      legacyBadgeId: "month-active",
      category: "medal",
      label: "Mês ativo",
      description: "Treinou 15+ dias neste mês.",
      lockedDescription: "Treine 15 dias no mês.",
      earned: user.workoutsThisMonth >= 15,
      rarity: "rare",
      progress: progress(user.workoutsThisMonth, 15, "dias"),
      visual: { kind: "medal3d", material: "gold", tone: "gold", monogram: "15" },
      earnedAt: user.workoutsThisMonth >= 15 ? lastPostAt : null,
      lastEarnedAt: user.workoutsThisMonth >= 15 ? lastPostAt : null,
      timesEarned: user.workoutsThisMonth >= 15 ? 1 : 0,
      sortWeight: 136,
    }),
    makeAchievement({
      id: "social",
      legacyBadgeId: "social",
      category: "medal",
      label: "Social",
      description: "Tem 10+ seguidores no Gym Circle.",
      lockedDescription: "Chegue a 10 seguidores.",
      earned: user.followersCount >= 10,
      rarity: "uncommon",
      progress: progress(user.followersCount, 10, "seguidores"),
      visual: { kind: "medal3d", material: "silver", tone: "silver", monogram: "10" },
      timesEarned: user.followersCount >= 10 ? 1 : 0,
      sortWeight: 140,
    }),
    makeAchievement({
      id: "popular",
      legacyBadgeId: "popular",
      category: "trophy",
      label: "Popular",
      description: "Tem 50+ seguidores.",
      lockedDescription: "Chegue a 50 seguidores.",
      earned: user.followersCount >= 50,
      rarity: "rare",
      progress: progress(user.followersCount, 50, "seguidores"),
      visual: { kind: "trophy3d", material: "sapphire", tone: "blue", monogram: "50" },
      timesEarned: user.followersCount >= 50 ? 1 : 0,
      sortWeight: 240,
    }),
    makeAchievement({
      id: "streak-recovered",
      legacyBadgeId: "streak-recovered",
      category: "badge",
      label: "Recuperou a streak",
      description: "Usou um restaurador pra salvar o circle.",
      lockedDescription: "Use um restaurador para salvar seu streak.",
      earned: hasUsedStreakRestore,
      rarity: "rare",
      progress: progress(hasUsedStreakRestore ? 1 : 0, 1, "restaurador"),
      visual: { kind: "badge3d", material: "glass", tone: "blue", monogram: "R" },
      earnedAt: user.lastStreakRestoreUsedAt ?? null,
      lastEarnedAt: user.lastStreakRestoreUsedAt ?? null,
      timesEarned: hasUsedStreakRestore ? 1 : 0,
      sortWeight: 250,
    }),
    makeAchievement({
      id: "year-active",
      legacyBadgeId: "year-active",
      category: "relic",
      label: "Ano em alta",
      description: "100+ dias treinados neste ano.",
      lockedDescription: "Complete 100 dias ativos no ano.",
      earned: user.activeDaysCount >= 100,
      rarity: "epic",
      progress: progress(user.activeDaysCount, 100, "dias"),
      visual: { kind: "relic3d", material: "crystal", tone: "crystal", monogram: "100" },
      earnedAt: user.activeDaysCount >= 100 ? lastPostAt : null,
      lastEarnedAt: user.activeDaysCount >= 100 ? lastPostAt : null,
      timesEarned: user.activeDaysCount >= 100 ? 1 : 0,
      sortWeight: 310,
    }),
    makeAchievement({
      id: "circle-master",
      category: "relic",
      label: "Circle Master",
      description: "300 dias ativos em um único ano.",
      lockedDescription: "Complete 300 dias ativos no ano.",
      earned: user.activeDaysCount >= 300,
      rarity: "legendary",
      progress: progress(user.activeDaysCount, 300, "dias"),
      visual: { kind: "relic3d", material: "crystal", tone: "crystal", monogram: "CM" },
      earnedAt: user.activeDaysCount >= 300 ? lastPostAt : null,
      lastEarnedAt: user.activeDaysCount >= 300 ? lastPostAt : null,
      timesEarned: user.activeDaysCount >= 300 ? 1 : 0,
      sortWeight: 320,
    }),
    makeAchievement({
      id: "unbreakable-100",
      category: "relic",
      label: "Inquebrável",
      description: "100 dias seguidos sem deixar o circle apagar.",
      lockedDescription: "Complete 100 dias consecutivos.",
      earned: user.longestStreak >= 100,
      rarity: "legendary",
      progress: progress(user.longestStreak, 100, "dias"),
      visual: { kind: "relic3d", material: "obsidian", tone: "dark", monogram: "∞" },
      earnedAt: user.longestStreak >= 100 ? lastPostAt : null,
      lastEarnedAt: user.longestStreak >= 100 ? lastPostAt : null,
      timesEarned: user.longestStreak >= 100 ? 1 : 0,
      sortWeight: 330,
    }),
    makeAchievement({
      id: "founder",
      category: "relic",
      label: "Fundador",
      description: "Está entre os 100 primeiros usuários cadastrados no Gym Circle.",
      lockedDescription: "Relíquia exclusiva dos 100 primeiros usuários cadastrados.",
      earned: Boolean(user.isFounder),
      rarity: "legendary",
      progress: user.founderRank
        ? {
            current: Math.min(user.founderRank, 100),
            target: 100,
            unit: "posição",
          }
        : undefined,
      visual: { kind: "relic3d", material: "crystal", tone: "crystal", monogram: "26" },
      earnedAt: user.isFounder ? user.createdAt ?? null : null,
      lastEarnedAt: user.isFounder ? user.createdAt ?? null : null,
      timesEarned: user.isFounder ? 1 : 0,
      sortWeight: 340,
    }),
    makeAchievement({
      id: "owl",
      category: "badge",
      label: "Coruja",
      description: "Postou treino depois das 23h.",
      lockedDescription: "Poste um treino depois das 23h.",
      earned: hasLateNightPost,
      rarity: "rare",
      isSecret: true,
      progress: progress(hasLateNightPost ? 1 : 0, 1, "post"),
      visual: { kind: "badge3d", material: "obsidian", tone: "dark", monogram: "23" },
      earnedAt: lateNightPosts[0]?.createdAt ?? null,
      lastEarnedAt: lateNightPosts[lateNightPosts.length - 1]?.createdAt ?? null,
      timesEarned: lateNightPosts.length,
      sortWeight: 410,
    }),
    makeAchievement({
      id: "early-bird",
      category: "badge",
      label: "Madrugador",
      description: "Postou treino antes das 5h.",
      lockedDescription: "Poste um treino antes das 5h.",
      earned: hasEarlyPost,
      rarity: "rare",
      isSecret: true,
      progress: progress(hasEarlyPost ? 1 : 0, 1, "post"),
      visual: { kind: "badge3d", material: "sapphire", tone: "blue", monogram: "5" },
      earnedAt: earlyPosts[0]?.createdAt ?? null,
      lastEarnedAt: earlyPosts[earlyPosts.length - 1]?.createdAt ?? null,
      timesEarned: earlyPosts.length,
      sortWeight: 420,
    }),
    makeAchievement({
      id: "lightning",
      category: "badge",
      label: "Relâmpago",
      description: "Publicou 3 treinos no mesmo dia.",
      lockedDescription: "Publique 3 treinos no mesmo dia.",
      earned: maxPostsDay >= 3,
      rarity: "epic",
      isSecret: true,
      progress: progress(maxPostsDay, 3, "treinos"),
      visual: { kind: "badge3d", material: "glass", tone: "cyan", monogram: "3x" },
      earnedAt: dateKeyToIso(lightningDays[0]),
      lastEarnedAt: dateKeyToIso(lightningDays[lightningDays.length - 1]),
      timesEarned: lightningDays.length,
      sortWeight: 430,
    }),
    makeAchievement({
      id: "chameleon",
      category: "badge",
      label: "Camaleão",
      description: "Fez 3 modalidades diferentes na mesma semana.",
      lockedDescription: "Faça 3 modalidades diferentes na semana.",
      earned: workoutTypesThisWeek >= 3,
      rarity: "rare",
      isSecret: true,
      progress: progress(workoutTypesThisWeek, 3, "modalidades"),
      visual: { kind: "badge3d", material: "glass", tone: "blue", monogram: "3" },
      earnedAt: workoutTypesThisWeek >= 3 ? lastPostAt : null,
      lastEarnedAt: workoutTypesThisWeek >= 3 ? lastPostAt : null,
      timesEarned: workoutTypesThisWeek >= 3 ? 1 : 0,
      sortWeight: 440,
    }),
    makeAchievement({
      id: "ghost",
      category: "badge",
      label: "Fantasma",
      description: "Treinou em 30 dias diferentes sem publicar stories.",
      lockedDescription: "Treine em 30 dias diferentes sem publicar nenhum story.",
      earned: ghostEarned,
      rarity: "epic",
      isSecret: true,
      progress: progress(activeDays, 30, "dias"),
      visual: { kind: "badge3d", material: "obsidian", tone: "dark", monogram: "0S" },
      earnedAt: ghostEarned ? lastPostAt : null,
      lastEarnedAt: ghostEarned ? lastPostAt : null,
      timesEarned: ghostEarned ? 1 : 0,
      sortWeight: 450,
    }),
  ];

  return withRarityStats([
    ...achievements,
    ...getMonthlyChallenges({ user, monthDays, now, rarityStats }).map((challenge) => challenge.achievement),
  ].sort((a, b) => a.sortWeight - b.sortWeight), rarityStats);
}

export function getFeaturedAchievements(achievements: AchievementV2[], limit = 3) {
  const categoryWeight: Record<AchievementCategory, number> = {
    relic: 5,
    trophy: 4,
    challenge: 3,
    medal: 2,
    badge: 1,
  };
  const rarityWeight: Record<AchievementRarity, number> = {
    legendary: 5,
    epic: 4,
    rare: 3,
    uncommon: 2,
    common: 1,
  };
  return achievements
    .filter((achievement) => achievement.earned)
    .sort(
      (a, b) =>
        categoryWeight[b.category] - categoryWeight[a.category] ||
        rarityWeight[b.rarity] - rarityWeight[a.rarity] ||
        a.sortWeight - b.sortWeight,
    )
    .slice(0, limit);
}

export function equippedAchievementStorageKey(userId: string) {
  return `gym-circle:equipped-achievements:${userId}`;
}

export function getFeaturedAchievementsWithEquipped(
  achievements: AchievementV2[],
  equippedIds: string[],
  limit = 3,
) {
  const equipped = equippedIds
    .map((id) => achievements.find((achievement) => achievement.id === id))
    .filter((achievement): achievement is AchievementV2 =>
      Boolean(achievement?.earned),
    );
  return [
    ...equipped,
    ...getFeaturedAchievements(
      achievements.filter(
        (achievement) => !equipped.some((item) => item.id === achievement.id),
      ),
      limit,
    ),
  ].slice(0, limit);
}

export function countEarnedAchievements(achievements: AchievementV2[]): number {
  return achievements.filter((achievement) => achievement.earned).length;
}

export function getMonthlyChallenges({
  user,
  monthDays,
  now = new Date(),
  rarityStats,
}: {
  user: EnrichedUser;
  monthDays?: number;
  now?: Date;
  rarityStats?: Record<string, AchievementRarityStats>;
}): MonthlyChallenge[] {
  const bounds = getMonthBounds(now);
  const trainedDays = monthDays ?? user.workoutDays.filter((day) => day.startsWith(bounds.monthKey)).length;
  const definitions: Array<{
    key: string;
    title: string;
    description: string;
    difficulty: AchievementDifficulty;
    target: number;
    rarity: AchievementRarity;
    material: AchievementVisual["material"];
    tone: AchievementVisual["tone"];
  }> = [
    {
      key: "easy",
      title: "Ritmo do mês",
      description: "Treine 8 dias neste mês.",
      difficulty: "easy",
      target: 8,
      rarity: "common",
      material: "bronze",
      tone: "bronze",
    },
    {
      key: "medium",
      title: "Mês da Consistência",
      description: "Treine 15 dias neste mês.",
      difficulty: "medium",
      target: 15,
      rarity: "rare",
      material: "silver",
      tone: "silver",
    },
    {
      key: "hard",
      title: "Projeto Verão",
      description: "Treine 20 dias neste mês.",
      difficulty: "hard",
      target: 20,
      rarity: "epic",
      material: "gold",
      tone: "gold",
    },
    {
      key: "legendary",
      title: "Mês Sem Falhas",
      description: "Treine todos os dias do mês.",
      difficulty: "legendary",
      target: Number(bounds.endDate.slice(-2)),
      rarity: "legendary",
      material: "crystal",
      tone: "crystal",
    },
  ];

  return definitions.map((definition, index) => {
    const id = `challenge-${bounds.monthKey}-${definition.key}`;
    const rewardId = `trophy-${bounds.monthKey}-${definition.key}`;
    const isCompleted = trainedDays >= definition.target;
    const achievement = makeAchievement({
      id: rewardId,
      category: "challenge",
      label: `${definition.title} ${bounds.year}`,
      description: `${definition.description} Exclusivo de ${bounds.monthKey}.`,
      lockedDescription: `${definition.description} Este desafio nunca volta.`,
      earned: isCompleted,
      rarity: definition.rarity,
      repeatable: false,
      monthKey: bounds.monthKey,
      progress: clampProgress(trainedDays, definition.target),
      visual: {
        kind: "trophy3d",
        material: definition.material,
        tone: definition.tone,
        monogram: definition.difficulty === "legendary" ? "L" : String(definition.target),
      },
      earnedAt: isCompleted ? dateKeyToIso(bounds.endDate) : null,
      lastEarnedAt: isCompleted ? dateKeyToIso(bounds.endDate) : null,
      timesEarned: isCompleted ? 1 : 0,
      periodStart: bounds.startDate,
      periodEnd: bounds.endDate,
      rewardLabel: `Troféu exclusivo ${definition.title} ${bounds.year}`,
      sortWeight: 500 + index,
      rarityStats: rarityStats?.[rewardId],
    });
    return {
      id,
      title: definition.title,
      description: definition.description,
      month: bounds.month,
      year: bounds.year,
      monthKey: bounds.monthKey,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      difficulty: definition.difficulty,
      rewardType: "trophy",
      rewardId,
      goal: clampProgress(trainedDays, definition.target),
      isCompleted,
      achievement,
    };
  });
}

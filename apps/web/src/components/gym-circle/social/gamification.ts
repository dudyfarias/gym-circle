import type { EnrichedUser } from "./types";

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

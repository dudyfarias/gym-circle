import type { EnrichedUser } from "./types";

/**
 * Gamification helpers — Sprint 3.5.3 + Sprint 5.3 + Sprint 7.5 compat layer.
 *
 * Sprint 7.5 introduziu `social/achievements.ts` com hierarquia rica de 5
 * categorias (badge/medal/trophy/relic/challenge). Este arquivo continua
 * exportando `Badge` e `getEarnedBadges` como ADAPTER pra MyCircleSheet
 * e BadgesSheet existentes — eles consomem o shape antigo enquanto a
 * UI nova não é entregue (sub-fases 7.5.2/7.5.4).
 *
 * `Badge.kind === "badge"` é só uma das 5 categorias. Os 20 badges
 * históricos foram redistribuídos: alguns viraram `medal` (streak-3/7,
 * workouts-50, streak-recovered), outros viraram `trophy` (streak-60,
 * active-week, month-active, year-active, social tiers, prolific-100),
 * outros viraram `relic` (streak-100, streak-365). Mapping completo no
 * `achievements.ts`.
 *
 * IMPORTANTE: nenhum badge é fake. Cada um tem regra clara baseada em
 * dado real disponível. Quando o dado não está disponível, o badge é
 * considerado bloqueado em vez de fake.
 */

export type BadgeId =
  | "first-workout"
  | "streak-3"
  | "streak-7"
  | "streak-14"
  | "streak-30"
  | "streak-60"
  | "streak-100"
  | "month-active"
  | "year-active"
  | "social"
  | "popular"
  | "network"
  | "community"
  | "active-week"
  | "prolific"
  | "streak-recovered"
  // Secret badges — não aparecem por nome até serem desbloqueadas.
  | "early-bird"
  | "night-owl"
  | "cross-trainer"
  | "explorer";

/**
 * Mapping pra ícone visual único por badge. UI usa este key pra
 * resolver Lucide icon + cor de tinta dedicada no `BadgeIcon` component.
 * Manter sync com `design-system/BadgeIcon.tsx`.
 */
export type BadgeIconKey =
  | "trophy"
  | "flame"
  | "calendar"
  | "users"
  | "share"
  | "shield"
  | "sunrise"
  | "moon"
  | "shuffle"
  | "compass";

export type Badge = {
  id: BadgeId;
  label: string;
  description: string;
  earned: boolean;
  /**
   * Secret badges aparecem como cadeado + "???" + hint genérico quando
   * `!earned`. Quando `earned`, viram visíveis com label/description reais.
   */
  secret?: boolean;
  /** Ícone visual único — resolvido em `BadgeIcon` por iconKey. */
  iconKey: BadgeIconKey;
  /**
   * Progresso atual quando aplica (ex: streak counters, follower counts).
   * UI pode mostrar uma barra fina abaixo do badge mostrando current/target.
   */
  progress?: { current: number; target: number };
};

/**
 * Snapshot de um post no formato que o badge logic precisa. Mantemos
 * mínimo pra reduzir acoplamento — qualquer caller que tenha
 * `EnrichedPost[]` pode passar diretamente.
 */
export type GamificationPostSnapshot = {
  createdAt: string;
  workoutType: string | null;
  gymId?: string;
};

type GamificationInput = {
  user: EnrichedUser;
  postsCount: number;
  hasUsedStreakRestore?: boolean;
  /**
   * Posts opcionais pra unlock dos badges secret de timing + variedade.
   * Quando ausente, badges que dependem disso ficam locked (sem fake).
   */
  posts?: ReadonlyArray<GamificationPostSnapshot>;
};

/**
 * Hora local do post (0-23). Usado pra "Madrugador" (5-7h) e "Coruja" (23+).
 * Usa a timezone do dispositivo do user — coerente com como ele vivencia
 * o próprio dia.
 */
function getLocalHour(isoDate: string): number {
  return new Date(isoDate).getHours();
}

/**
 * Posts dos últimos N dias (inclusive hoje). Threshold pra "Versátil"
 * (3+ workout types em 7 dias) e "Explorador" (5+ academias em 30 dias).
 */
function getPostsWithinDays(
  posts: ReadonlyArray<GamificationPostSnapshot>,
  days: number,
  now: Date = new Date(),
): GamificationPostSnapshot[] {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return posts.filter((post) => new Date(post.createdAt).getTime() >= cutoff);
}

/**
 * Cada badge tem regra puramente derivacional. Ordem é a de exibição
 * (UI mostra grid na mesma ordem).
 */
export function getEarnedBadges({
  user,
  postsCount,
  hasUsedStreakRestore = false,
  posts,
}: GamificationInput): Badge[] {
  const followers = user.followersCount;
  const longestStreak = user.longestStreak;
  const workoutsThisMonth = user.workoutsThisMonth;
  const workoutsThisWeek = user.workoutsThisWeek ?? 0;
  const activeDaysCount = user.activeDaysCount;

  // Cálculos pra badges secret (só se posts foi fornecido)
  let earlyBirdEarned = false;
  let nightOwlEarned = false;
  let crossTrainerEarned = false;
  let explorerEarned = false;
  if (posts && posts.length > 0) {
    for (const post of posts) {
      const hour = getLocalHour(post.createdAt);
      if (hour >= 5 && hour < 7) earlyBirdEarned = true;
      if (hour >= 23 || hour < 4) nightOwlEarned = true;
      if (earlyBirdEarned && nightOwlEarned) break;
    }

    // Versátil — 3+ workout types distintos nos últimos 7 dias
    const recentWeek = getPostsWithinDays(posts, 7);
    const recentTypes = new Set<string>();
    for (const post of recentWeek) {
      const type = post.workoutType?.trim();
      if (type) recentTypes.add(type.toLowerCase());
    }
    crossTrainerEarned = recentTypes.size >= 3;

    // Explorador — 5+ academias distintas nos últimos 30 dias
    const recentMonth = getPostsWithinDays(posts, 30);
    const recentGyms = new Set<string>();
    for (const post of recentMonth) {
      if (post.gymId) recentGyms.add(post.gymId);
    }
    explorerEarned = recentGyms.size >= 5;
  }

  const badges: Badge[] = [
    // === Onboarding ===
    {
      id: "first-workout",
      label: "Primeiro treino",
      description: "Publicou seu primeiro treino no feed.",
      earned: postsCount >= 1,
      iconKey: "trophy",
    },

    // === Streak progressivos ===
    {
      id: "streak-3",
      label: "3 dias seguidos",
      description: "Treinou 3 dias consecutivos.",
      earned: longestStreak >= 3,
      iconKey: "flame",
      progress: longestStreak < 3 ? { current: longestStreak, target: 3 } : undefined,
    },
    {
      id: "streak-7",
      label: "Semana cheia",
      description: "Treinou 7 dias consecutivos.",
      earned: longestStreak >= 7,
      iconKey: "flame",
      progress: longestStreak < 7 ? { current: longestStreak, target: 7 } : undefined,
    },
    {
      id: "streak-14",
      label: "2 semanas seguidas",
      description: "Treinou 14 dias consecutivos.",
      earned: longestStreak >= 14,
      iconKey: "flame",
      progress: longestStreak < 14 ? { current: longestStreak, target: 14 } : undefined,
    },
    {
      id: "streak-30",
      label: "Mês completo",
      description: "Treinou 30 dias consecutivos.",
      earned: longestStreak >= 30,
      iconKey: "flame",
      progress: longestStreak < 30 ? { current: longestStreak, target: 30 } : undefined,
    },
    {
      id: "streak-60",
      label: "Streak de aço",
      description: "Treinou 60 dias consecutivos.",
      earned: longestStreak >= 60,
      iconKey: "flame",
      progress: longestStreak < 60 ? { current: longestStreak, target: 60 } : undefined,
    },
    {
      id: "streak-100",
      label: "Centurião",
      description: "Treinou 100 dias consecutivos.",
      earned: longestStreak >= 100,
      iconKey: "flame",
      progress: longestStreak < 100 ? { current: longestStreak, target: 100 } : undefined,
    },

    // === Cadência ===
    {
      id: "active-week",
      label: "Consistente na semana",
      description: "Treinou 5+ dias nesta semana.",
      earned: workoutsThisWeek >= 5,
      iconKey: "calendar",
      progress:
        workoutsThisWeek < 5 ? { current: workoutsThisWeek, target: 5 } : undefined,
    },
    {
      id: "month-active",
      label: "Mês ativo",
      description: "Treinou 15+ dias neste mês.",
      earned: workoutsThisMonth >= 15,
      iconKey: "calendar",
      progress:
        workoutsThisMonth < 15
          ? { current: workoutsThisMonth, target: 15 }
          : undefined,
    },
    {
      id: "year-active",
      label: "Ano em alta",
      description: "100+ dias treinados neste ano.",
      earned: activeDaysCount >= 100,
      iconKey: "calendar",
      progress:
        activeDaysCount < 100
          ? { current: activeDaysCount, target: 100 }
          : undefined,
    },

    // === Volume ===
    {
      id: "prolific",
      label: "Prolífico",
      description: "Publicou 50+ posts de treino.",
      earned: postsCount >= 50,
      iconKey: "share",
      progress: postsCount < 50 ? { current: postsCount, target: 50 } : undefined,
    },

    // === Social ===
    {
      id: "social",
      label: "Social",
      description: "Tem 10+ seguidores no Gym Circle.",
      earned: followers >= 10,
      iconKey: "users",
      progress: followers < 10 ? { current: followers, target: 10 } : undefined,
    },
    {
      id: "popular",
      label: "Popular",
      description: "Tem 50+ seguidores.",
      earned: followers >= 50,
      iconKey: "users",
      progress: followers < 50 ? { current: followers, target: 50 } : undefined,
    },
    {
      id: "network",
      label: "Rede forte",
      description: "Tem 100+ seguidores.",
      earned: followers >= 100,
      iconKey: "users",
      progress: followers < 100 ? { current: followers, target: 100 } : undefined,
    },
    {
      id: "community",
      label: "Comunidade",
      description: "Tem 200+ seguidores.",
      earned: followers >= 200,
      iconKey: "users",
      progress: followers < 200 ? { current: followers, target: 200 } : undefined,
    },

    // === Recovery ===
    {
      id: "streak-recovered",
      label: "Recuperou a streak",
      description: "Usou um restaurador pra salvar o circle.",
      earned: hasUsedStreakRestore,
      iconKey: "shield",
    },

    // === Secret badges — só revelam quando ganhas ===
    {
      id: "early-bird",
      label: "Madrugador",
      description: "Postou um treino entre 5h e 7h da manhã.",
      earned: earlyBirdEarned,
      secret: true,
      iconKey: "sunrise",
    },
    {
      id: "night-owl",
      label: "Coruja",
      description: "Postou um treino depois das 23h.",
      earned: nightOwlEarned,
      secret: true,
      iconKey: "moon",
    },
    {
      id: "cross-trainer",
      label: "Versátil",
      description: "Variou 3+ tipos de treino em 7 dias.",
      earned: crossTrainerEarned,
      secret: true,
      iconKey: "shuffle",
    },
    {
      id: "explorer",
      label: "Explorador",
      description: "Treinou em 5+ academias diferentes em 30 dias.",
      earned: explorerEarned,
      secret: true,
      iconKey: "compass",
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
 * Heurística Sprint 5.3: ignora secret badges (não dá hint do que não
 * está revelado). Entre os públicos não-ganhos, prioriza:
 *   1. Badges com `progress` mais perto da meta (proporcionalmente)
 *   2. Fallback: primeiro não-earned na ordem da lista
 */
export function getNextBadge(badges: Badge[]): Badge | null {
  const publicLocked = badges.filter((b) => !b.earned && !b.secret);
  if (publicLocked.length === 0) return null;

  const withProgress = publicLocked.filter((b) => b.progress);
  if (withProgress.length > 0) {
    withProgress.sort((a, b) => {
      const aPct = (a.progress!.current / a.progress!.target) * 100;
      const bPct = (b.progress!.current / b.progress!.target) * 100;
      return bPct - aPct; // mais próximo de 100% primeiro
    });
    return withProgress[0] ?? null;
  }

  return publicLocked[0] ?? null;
}

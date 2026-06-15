import type { BadgeIconKey } from "./gamification";
import type { EnrichedUser } from "./types";

/**
 * Sprint 7.5 — Achievement system v2.
 *
 * Substitui o sistema flat de 20 badges (`Badge` em `gamification.ts`) por
 * hierarquia rica de 5 categorias com semântica visual + raridade distintas:
 *
 *   Badge      → conquistas básicas (primeiro X). Visual pequeno, pouco brilho.
 *   Medal      → marcos intermediários (3/7/14d, 30/50 counts). Visual metálico.
 *   Trophy     → conquistas importantes (perfect-week, 100 treinos). Visual grande.
 *   Relic      → extremamente raras (300 dias/ano, 365d streak). Cristal/glow.
 *   Challenge  → desafios mensais exclusivos (não voltam). Tempo-limitado.
 *
 * Compatibilidade retroativa: os 20 badges originais (Sprint 5.3) ganham
 * categoria automática via `LEGACY_BADGE_MAPPING`. `gamification.ts`
 * continua exportando `Badge` e `getEarnedBadges` como adapter pra não
 * quebrar BadgesSheet/MyCircleSheet enquanto a UI nova é entregue.
 *
 * Persistência: tudo continua DERIVADO a cada boot. `user_achievements`
 * (Sprint 7.5.1) só guarda timestamps de quando o user GANHOU cada um,
 * pra mostrar "Conquistado em 08/05/2026" no detail overlay (Section 15
 * do brief — Apple Fitness style).
 */

export type AchievementKind = "badge" | "medal" | "trophy" | "relic" | "challenge";

export type AchievementRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

/**
 * Tier visual da medalha. Bronze < Silver < Gold (analogia olímpica).
 * Trophies e Relics não têm tier — visual único por id.
 */
export type MedalTier = "bronze" | "silver" | "gold";

type AchievementBase = {
  /** Identificador único dentro da categoria. */
  id: string;
  /** Categoria — usada pra escolher visual 3D + glow + animação. */
  kind: AchievementKind;
  /** Label localizada (já resolvida no caller). */
  label: string;
  /** Descrição completa (1-2 frases). */
  description: string;
  /** True quando o user já ganhou. */
  earned: boolean;
  /** Icon key pro fallback 2D (`BadgeIcon`) enquanto arte 3D não chega. */
  iconKey: BadgeIconKey;
  /** Raridade estimada. Pode ser computada de stats futuros (Section 15). */
  rarity?: AchievementRarity;
  /** Progresso atual (se aplicável). */
  progress?: { current: number; target: number };
  /**
   * Hidden quando `!earned` (igual ao secret antigo). UI mostra "???" +
   * cadeado. Quando earned, revela label/description reais.
   */
  secret?: boolean;
};

export type BadgeAchievement = AchievementBase & { kind: "badge" };

export type MedalAchievement = AchievementBase & {
  kind: "medal";
  tier: MedalTier;
};

export type TrophyAchievement = AchievementBase & {
  kind: "trophy";
  /** Pra trophies repetíveis (ex: "Mês Perfeito" pode ganhar todo mês). */
  repeatable?: boolean;
};

export type RelicAchievement = AchievementBase & { kind: "relic" };

export type ChallengeAchievement = AchievementBase & {
  kind: "challenge";
  /** "YYYY-MM" — desafio é exclusivo desse período. Não repete. */
  periodKey: string;
  /** Trophy id atribuído ao completar. */
  trophyId?: string;
  // Sprint 22 — o desafio carrega `rarity` (da base) direto, no lugar de
  // `difficulty`. "mais difícil = mais raro" agora é a mesma coisa.
};

export type Achievement =
  | BadgeAchievement
  | MedalAchievement
  | TrophyAchievement
  | RelicAchievement
  | ChallengeAchievement;

/**
 * Composite key pra `user_achievements.achievement_id` no DB. Permite
 * coexistência de IDs entre categorias (ex: "badge:first-workout" vs
 * "trophy:first-year") sem colisão.
 */
export function getAchievementCompositeId(achievement: Achievement): string {
  if (achievement.kind === "challenge") {
    return `challenge:${achievement.periodKey}:${achievement.id}`;
  }
  return `${achievement.kind}:${achievement.id}`;
}

/**
 * Decodifica composite ID de volta em (kind, id). Útil quando lendo do DB
 * pra cross-ref com achievements derivados.
 *
 * Ex: "trophy:perfect-month" → { kind: "trophy", id: "perfect-month" }
 *     "challenge:2026-06:projeto-verao" → { kind: "challenge", periodKey: "2026-06", id: "projeto-verao" }
 */
export function parseAchievementCompositeId(compositeId: string): {
  kind: AchievementKind;
  id: string;
  periodKey?: string;
} | null {
  const parts = compositeId.split(":");
  if (parts.length < 2) return null;
  const kind = parts[0] as AchievementKind;
  if (kind === "challenge" && parts.length === 3) {
    return { kind, periodKey: parts[1], id: parts[2] };
  }
  return { kind, id: parts.slice(1).join(":") };
}

/**
 * Snapshot de um post pro logic de achievements. Mantém shape mínimo —
 * caller pode passar `EnrichedPost[]` diretamente.
 */
export type AchievementPostSnapshot = {
  createdAt: string;
  workoutType: string | null;
  /**
   * Fix pós-Sprint 13 — tags adicionais do post (workout_types array).
   * Cross-trainer conta primária + tags; posts antigos (null) seguem
   * só com a primária.
   */
  workoutTypes?: ReadonlyArray<string> | null;
  gymId?: string;
};

type AchievementsInput = {
  user: EnrichedUser;
  postsCount: number;
  hasUsedStreakRestore?: boolean;
  posts?: ReadonlyArray<AchievementPostSnapshot>;
  /**
   * Sprint 7.5.6 — desafios mensais do período corrente. Quando passado,
   * monta `ChallengeAchievement` entries baseado em progress per user.
   * Opcional pra back-compat enquanto MonthlyChallenge system não está
   * wired no boot.
   */
  monthlyChallenges?: ReadonlyArray<{
    id: string;
    periodKey: string;
    title: string;
    description: string;
    /** Sprint 22 — raridade do desafio (5 níveis), no lugar de difficulty. */
    rarity: AchievementRarity;
    goalTarget: number;
    trophyId?: string;
    progress: number;
    completedAt: string | null;
    /** Sprint 15 — desafio secreto: UI mostra "???" enquanto não completo. */
    isSecret?: boolean;
  }>;
};

/**
 * Builder unificado. Retorna achievements de TODAS as 5 categorias num
 * único array. UI filtra por `kind` quando precisa de tabs separadas.
 *
 * Ordem é estável (categoria + ordem de definição) — UI confia nisso pra
 * priorização visual.
 */
export function getAllAchievements(input: AchievementsInput): Achievement[] {
  const { user, postsCount, hasUsedStreakRestore = false, posts, monthlyChallenges } = input;
  const result: Achievement[] = [];

  result.push(...buildBadges({ user, postsCount, posts }));
  result.push(...buildMedals({ user, postsCount, hasUsedStreakRestore }));
  result.push(...buildTrophies({ user, postsCount }));
  result.push(...buildRelics({ user }));
  if (monthlyChallenges) {
    result.push(...buildChallenges(monthlyChallenges));
  }

  return result;
}

// =============================================================================
// Builders por categoria — cada um devolve achievements daquele tipo.
// =============================================================================

function buildBadges(input: {
  user: EnrichedUser;
  postsCount: number;
  posts?: ReadonlyArray<AchievementPostSnapshot>;
}): BadgeAchievement[] {
  const { user, postsCount, posts } = input;

  // Secret unlock calculations (mesma lógica da Sprint 5.3 mantida)
  let earlyBirdEarned = false;
  let nightOwlEarned = false;
  let crossTrainerEarned = false;
  let explorerEarned = false;
  if (posts && posts.length > 0) {
    for (const post of posts) {
      const hour = new Date(post.createdAt).getHours();
      if (hour >= 5 && hour < 7) earlyBirdEarned = true;
      if (hour >= 23 || hour < 4) nightOwlEarned = true;
      if (earlyBirdEarned && nightOwlEarned) break;
    }
    const recentWeek = filterPostsWithinDays(posts, 7);
    const recentTypes = new Set<string>();
    for (const post of recentWeek) {
      const type = post.workoutType?.trim();
      if (type) recentTypes.add(type.toLowerCase());
      // Fix pós-Sprint 13: tags adicionais também contam pro cross-trainer.
      for (const tag of post.workoutTypes ?? []) {
        const extra = tag?.trim();
        if (extra) recentTypes.add(extra.toLowerCase());
      }
    }
    crossTrainerEarned = recentTypes.size >= 3;

    const recentMonth = filterPostsWithinDays(posts, 30);
    const recentGyms = new Set<string>();
    for (const post of recentMonth) {
      if (post.gymId) recentGyms.add(post.gymId);
    }
    explorerEarned = recentGyms.size >= 5;
  }

  return [
    {
      kind: "badge",
      id: "first-workout",
      label: "Primeiro treino",
      description: "Publicou seu primeiro treino no feed.",
      earned: postsCount >= 1,
      iconKey: "trophy",
      rarity: "common",
    },
    {
      kind: "badge",
      id: "early-bird",
      label: "Madrugador",
      description: "Postou um treino entre 5h e 7h da manhã.",
      earned: earlyBirdEarned,
      iconKey: "sunrise",
      secret: true,
      rarity: "uncommon",
    },
    {
      kind: "badge",
      id: "night-owl",
      label: "Coruja",
      description: "Postou um treino depois das 23h.",
      earned: nightOwlEarned,
      iconKey: "moon",
      secret: true,
      rarity: "uncommon",
    },
    {
      kind: "badge",
      id: "cross-trainer",
      label: "Versátil",
      description: "Variou 3+ tipos de treino em 7 dias.",
      earned: crossTrainerEarned,
      iconKey: "shuffle",
      secret: true,
      rarity: "rare",
    },
    {
      kind: "badge",
      id: "explorer",
      label: "Explorador",
      description: "Treinou em 5+ academias diferentes em 30 dias.",
      earned: explorerEarned,
      iconKey: "compass",
      secret: true,
      rarity: "rare",
    },
  ];

  // Os badges "first-*" extras do brief (Sections 3: first-checkin, first-story,
  // first-follow, first-comment, first-tag-accepted, first-group-workout) precisam
  // de queries DB adicionais (counts de checkins, stories, follows, post_comments,
  // post_participants). Adicionar em sub-fase futura quando hidratarmos esses
  // counts no EnrichedUser. Por enquanto cobertura focada nos que TÊM data.
}

function buildMedals(input: {
  user: EnrichedUser;
  postsCount: number;
  hasUsedStreakRestore: boolean;
}): MedalAchievement[] {
  const { user, postsCount, hasUsedStreakRestore } = input;
  const longestStreak = user.longestStreak;

  return [
    {
      kind: "medal",
      id: "streak-3",
      label: "3 dias seguidos",
      description: "Treinou 3 dias consecutivos.",
      earned: longestStreak >= 3,
      iconKey: "flame",
      tier: "bronze",
      rarity: "common",
      progress: longestStreak < 3 ? { current: longestStreak, target: 3 } : undefined,
    },
    {
      kind: "medal",
      id: "streak-7",
      label: "Semana cheia",
      description: "Treinou 7 dias consecutivos.",
      earned: longestStreak >= 7,
      iconKey: "flame",
      tier: "bronze",
      rarity: "common",
      progress: longestStreak < 7 ? { current: longestStreak, target: 7 } : undefined,
    },
    {
      kind: "medal",
      id: "streak-14",
      label: "Duas semanas",
      description: "Treinou 14 dias consecutivos.",
      earned: longestStreak >= 14,
      iconKey: "flame",
      tier: "silver",
      rarity: "uncommon",
      progress: longestStreak < 14 ? { current: longestStreak, target: 14 } : undefined,
    },
    {
      kind: "medal",
      id: "streak-30",
      label: "Um mês",
      description: "Treinou 30 dias consecutivos.",
      earned: longestStreak >= 30,
      iconKey: "flame",
      tier: "gold",
      rarity: "rare",
      progress: longestStreak < 30 ? { current: longestStreak, target: 30 } : undefined,
    },
    {
      kind: "medal",
      id: "workouts-50",
      label: "50 treinos",
      description: "Publicou 50 treinos no feed.",
      earned: postsCount >= 50,
      iconKey: "share",
      tier: "silver",
      rarity: "uncommon",
      progress: postsCount < 50 ? { current: postsCount, target: 50 } : undefined,
    },
    {
      kind: "medal",
      id: "streak-recovered",
      label: "Recuperou a streak",
      description: "Usou um restaurador pra salvar o circle.",
      earned: hasUsedStreakRestore,
      iconKey: "shield",
      tier: "bronze",
      rarity: "common",
    },
  ];
}

function buildTrophies(input: {
  user: EnrichedUser;
  postsCount: number;
}): TrophyAchievement[] {
  const { user, postsCount } = input;
  const longestStreak = user.longestStreak;
  const workoutsThisMonth = user.workoutsThisMonth;
  const workoutsThisWeek = user.workoutsThisWeek ?? 0;
  const activeDaysCount = user.activeDaysCount;
  const followers = user.followersCount;

  return [
    {
      kind: "trophy",
      id: "streak-60",
      label: "Streak de aço",
      description: "Treinou 60 dias consecutivos.",
      earned: longestStreak >= 60,
      iconKey: "flame",
      rarity: "rare",
      progress: longestStreak < 60 ? { current: longestStreak, target: 60 } : undefined,
    },
    {
      kind: "trophy",
      id: "active-week",
      label: "Semana cheia ativa",
      description: "Treinou 5+ dias nesta semana.",
      earned: workoutsThisWeek >= 5,
      iconKey: "calendar",
      rarity: "uncommon",
      repeatable: true,
      progress:
        workoutsThisWeek < 5 ? { current: workoutsThisWeek, target: 5 } : undefined,
    },
    {
      kind: "trophy",
      id: "month-active",
      label: "Mês ativo",
      description: "Treinou 15+ dias neste mês.",
      earned: workoutsThisMonth >= 15,
      iconKey: "calendar",
      rarity: "uncommon",
      repeatable: true,
      progress:
        workoutsThisMonth < 15
          ? { current: workoutsThisMonth, target: 15 }
          : undefined,
    },
    {
      kind: "trophy",
      id: "year-active",
      label: "Ano em alta",
      description: "100+ dias treinados neste ano.",
      earned: activeDaysCount >= 100,
      iconKey: "calendar",
      rarity: "rare",
      progress:
        activeDaysCount < 100 ? { current: activeDaysCount, target: 100 } : undefined,
    },
    {
      kind: "trophy",
      id: "friends-50",
      label: "50 amigos",
      description: "Tem 50+ seguidores no Gym Circle.",
      earned: followers >= 50,
      iconKey: "users",
      rarity: "uncommon",
      progress: followers < 50 ? { current: followers, target: 50 } : undefined,
    },
    {
      kind: "trophy",
      id: "network-100",
      label: "Rede forte",
      description: "Tem 100+ seguidores.",
      earned: followers >= 100,
      iconKey: "users",
      rarity: "rare",
      progress: followers < 100 ? { current: followers, target: 100 } : undefined,
    },
    {
      kind: "trophy",
      id: "community-200",
      label: "Comunidade",
      description: "Tem 200+ seguidores.",
      earned: followers >= 200,
      iconKey: "users",
      rarity: "rare",
      progress: followers < 200 ? { current: followers, target: 200 } : undefined,
    },
    {
      kind: "trophy",
      id: "social-10",
      label: "Primeiros amigos",
      description: "Tem 10+ seguidores.",
      earned: followers >= 10,
      iconKey: "users",
      rarity: "common",
      progress: followers < 10 ? { current: followers, target: 10 } : undefined,
    },
    {
      kind: "trophy",
      id: "prolific-100",
      label: "Centurião do feed",
      description: "Publicou 100+ posts de treino.",
      earned: postsCount >= 100,
      iconKey: "share",
      rarity: "epic",
      progress: postsCount < 100 ? { current: postsCount, target: 100 } : undefined,
    },
  ];
}

function buildRelics(input: { user: EnrichedUser }): RelicAchievement[] {
  const { user } = input;
  const longestStreak = user.longestStreak;
  const activeDaysCount = user.activeDaysCount;

  return [
    {
      kind: "relic",
      id: "unbreakable",
      label: "Inquebrável",
      description: "Treinou 100 dias consecutivos.",
      earned: longestStreak >= 100,
      iconKey: "flame",
      rarity: "epic",
      progress: longestStreak < 100 ? { current: longestStreak, target: 100 } : undefined,
    },
    {
      kind: "relic",
      id: "circle-master",
      label: "Mestre do Circle",
      description: "300 dias treinados num único ano.",
      earned: activeDaysCount >= 300,
      iconKey: "trophy",
      rarity: "legendary",
      progress: activeDaysCount < 300 ? { current: activeDaysCount, target: 300 } : undefined,
    },
    {
      kind: "relic",
      id: "streak-365",
      label: "Ano inteiro",
      description: "Treinou 365 dias consecutivos.",
      earned: longestStreak >= 365,
      iconKey: "flame",
      rarity: "legendary",
      progress: longestStreak < 365 ? { current: longestStreak, target: 365 } : undefined,
    },
    {
      kind: "relic",
      id: "founder-2026",
      label: "Fundador 2026",
      description: "Esteve no Gym Circle nos primeiros meses.",
      earned: isFounder2026(user),
      iconKey: "shield",
      rarity: "legendary",
    },
  ];
}

function buildChallenges(
  monthlyChallenges: NonNullable<AchievementsInput["monthlyChallenges"]>,
): ChallengeAchievement[] {
  return monthlyChallenges.map((c) => ({
    kind: "challenge",
    id: c.id,
    periodKey: c.periodKey,
    label: c.title,
    description: c.description,
    earned: c.completedAt !== null,
    iconKey: "trophy",
    trophyId: c.trophyId,
    // Sprint 15 — propaga secret: sem isso o título de desafio secreto vazava
    // no Hall da Fama (UI mostra "???" pra secret não-conquistado).
    secret: c.isSecret,
    // Sprint 22 — raridade direta (sem mapping de difficulty).
    rarity: c.rarity,
    progress:
      c.completedAt === null
        ? { current: c.progress, target: c.goalTarget }
        : undefined,
  }));
}

// =============================================================================
// Helpers internos
// =============================================================================

function filterPostsWithinDays(
  posts: ReadonlyArray<AchievementPostSnapshot>,
  days: number,
  now: Date = new Date(),
): AchievementPostSnapshot[] {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return posts.filter((p) => new Date(p.createdAt).getTime() >= cutoff);
}

function isFounder2026(user: EnrichedUser): boolean {
  // Reusa createdAt do user. Threshold: até final de 2026 (alpha closed).
  if (!user.createdAt) return false;
  const created = new Date(user.createdAt);
  return created < new Date("2027-01-01T00:00:00Z");
}

// =============================================================================
// Utilidades pra UI
// =============================================================================

/**
 * Conta quantos achievements foram conquistados (helper UI).
 */
export function countEarnedAchievements(achievements: Achievement[]): number {
  return achievements.filter((a) => a.earned).length;
}

/**
 * Próximo achievement mais próximo de ser ganho. Mesma heurística do
 * `getNextBadge` antigo (Sprint 5.3): ignora secret (não dá hint do que
 * não foi revelado), prioriza por proporção de progresso.
 *
 * Cross-categoria: pega o mais próximo INDEPENDENTE de categoria. UI
 * decide se quer filtrar por kind (ex: "próxima medalha" vs "próximo geral").
 */
export function getNextAchievement(
  achievements: Achievement[],
  options: { kind?: AchievementKind } = {},
): Achievement | null {
  let candidates = achievements.filter((a) => !a.earned && !a.secret);
  if (options.kind) {
    candidates = candidates.filter((a) => a.kind === options.kind);
  }
  if (candidates.length === 0) return null;

  const withProgress = candidates.filter((a) => a.progress);
  if (withProgress.length > 0) {
    withProgress.sort((a, b) => {
      const aPct = (a.progress!.current / a.progress!.target) * 100;
      const bPct = (b.progress!.current / b.progress!.target) * 100;
      return bPct - aPct;
    });
    return withProgress[0] ?? null;
  }
  return candidates[0] ?? null;
}

/**
 * Prioridade visual pra "Conquistas em Destaque" no perfil (Section 13):
 *   Relic > Trophy > Medal > Badge > Challenge
 *
 * Sugere top N pra equipar quando user não escolheu manualmente.
 */
export function suggestFeaturedAchievements(
  achievements: Achievement[],
  count: number = 3,
): Achievement[] {
  const earned = achievements.filter((a) => a.earned);
  // Sprint 22 — ranqueia só por RARIDADE (a distinção de categoria saiu). Em
  // empate de raridade, a ordem estável de definição decide (sort estável).
  const priorityScore = (a: Achievement): number => {
    const rarityRank: Record<AchievementRarity, number> = {
      legendary: 5,
      epic: 4,
      rare: 3,
      uncommon: 2,
      common: 1,
    };
    return a.rarity ? rarityRank[a.rarity] : 0;
  };
  return [...earned]
    .sort((a, b) => priorityScore(b) - priorityScore(a))
    .slice(0, count);
}

/**
 * Sprint 15.5 — resolve as "Conquistas em destaque" de um user na MESMA
 * regra em todas as superfícies (ProfileScreen, MyCircleSheet):
 *   (a) user equipou manualmente (profile.featuredAchievements, composite
 *       ids) → lookup + filtra só earned;
 *   (b) fallback → suggestFeaturedAchievements (top N por raridade).
 */
export function resolveFeaturedAchievements(
  achievements: Achievement[],
  equippedCompositeIds: ReadonlyArray<string> | null | undefined,
  count: number = 3,
): Achievement[] {
  const equipped = equippedCompositeIds ?? [];
  if (equipped.length > 0) {
    const resolved: Achievement[] = [];
    for (const compositeId of equipped) {
      const parsed = parseAchievementCompositeId(compositeId);
      if (!parsed) continue;
      const match = achievements.find(
        (a) => a.kind === parsed.kind && a.id === parsed.id,
      );
      if (match && match.earned) resolved.push(match);
    }
    if (resolved.length > 0) return resolved.slice(0, count);
  }
  return suggestFeaturedAchievements(achievements, count);
}

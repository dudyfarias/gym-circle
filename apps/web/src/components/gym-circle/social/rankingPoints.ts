import type { AchievementRarity } from "./achievements";

/**
 * Sprint 19 — fonte ÚNICA da pontuação da Competição.
 *
 * O ranking é computado server-side (RPC get_circle_ranking), mas as regras
 * vivem aqui pra: (1) gerar/conferir o seed da tabela `achievement_points`,
 * (2) o breakdown "seus pontos" na UI, (3) testes. A migration SQL espelha
 * estes valores exatamente.
 *
 * Pontos:
 *   - treinar num dia                      = 10
 *   - semana ISO completa (7/7 dias)       = +20 bônus
 *   - mês-calendário completo (todos dias) = +50 bônus
 *   - conquista/desafio desbloqueado (na data) por raridade:
 *       comum 1 · incomum 2 · raro 3 · épico 5 · lendário 10
 */

export const WORKOUT_DAY_POINTS = 10;
export const FULL_WEEK_BONUS = 20;
export const FULL_MONTH_BONUS = 50;

export const RARITY_POINTS: Record<AchievementRarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 5,
  legendary: 10,
};

/**
 * Dificuldade de desafio → raridade equivalente. Espelha exatamente o mapa
 * em achievements.ts `buildChallenges` (não divergir — é a mesma semântica de
 * tier visual e de pontos).
 */
export const DIFFICULTY_RARITY: Record<
  "easy" | "medium" | "hard" | "legendary",
  AchievementRarity
> = {
  easy: "common",
  medium: "uncommon",
  hard: "epic",
  legendary: "legendary",
};

export function pointsForRarity(rarity: AchievementRarity): number {
  return RARITY_POINTS[rarity];
}

export function pointsForDifficulty(
  difficulty: "easy" | "medium" | "hard" | "legendary",
): number {
  return RARITY_POINTS[DIFFICULTY_RARITY[difficulty]];
}

/**
 * Raridade dos achievements ESTÁTICOS por composite id (`kind:id`).
 * Espelha as definições em achievements.ts. Ao adicionar/alterar um
 * achievement estático, atualize aqui — o seed da migration é gerado disto.
 * (Challenges NÃO entram aqui: são resolvidos via monthly_challenges.difficulty.)
 */
export const STATIC_ACHIEVEMENT_RARITY: Record<string, AchievementRarity> = {
  // Badges
  "badge:first-workout": "common",
  "badge:early-bird": "uncommon",
  "badge:night-owl": "uncommon",
  "badge:cross-trainer": "rare",
  "badge:explorer": "rare",
  // Medals
  "medal:streak-3": "common",
  "medal:streak-7": "common",
  "medal:streak-14": "uncommon",
  "medal:streak-30": "rare",
  "medal:workouts-50": "uncommon",
  "medal:streak-recovered": "common",
  // Trophies
  "trophy:streak-60": "rare",
  "trophy:active-week": "uncommon",
  "trophy:month-active": "uncommon",
  "trophy:year-active": "rare",
  "trophy:friends-50": "uncommon",
  "trophy:network-100": "rare",
  "trophy:community-200": "rare",
  "trophy:social-10": "common",
  "trophy:prolific-100": "epic",
  // Relics
  "relic:unbreakable": "epic",
  "relic:circle-master": "legendary",
  "relic:streak-365": "legendary",
  "relic:founder-2026": "legendary",
};

/** Pontos de um achievement estático por composite id (fallback comum=1). */
export function pointsForStaticAchievement(compositeId: string): number {
  const rarity = STATIC_ACHIEVEMENT_RARITY[compositeId];
  return rarity ? RARITY_POINTS[rarity] : RARITY_POINTS.common;
}

export type ScoreBreakdown = {
  workoutPoints: number;
  bonusPoints: number;
  achievementPoints: number;
  total: number;
};

/**
 * Breakdown a partir dos componentes já agregados (ex.: os campos que a RPC
 * retorna). Usado no card "seus pontos". `bonusPoints` é derivado (total das
 * fontes conhecidas), então a UI sempre fecha a conta com o total da RPC.
 */
export function buildScoreBreakdown(input: {
  workoutDays: number;
  fullWeeks: number;
  fullMonths: number;
  achievementPoints: number;
}): ScoreBreakdown {
  const workoutPoints = input.workoutDays * WORKOUT_DAY_POINTS;
  const bonusPoints =
    input.fullWeeks * FULL_WEEK_BONUS + input.fullMonths * FULL_MONTH_BONUS;
  const achievementPoints = input.achievementPoints;
  return {
    workoutPoints,
    bonusPoints,
    achievementPoints,
    total: workoutPoints + bonusPoints + achievementPoints,
  };
}

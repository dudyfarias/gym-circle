import type { Achievement, AchievementRarity } from "./achievements";

/**
 * Sprint 15 — adapter visual pro `AchievementArtifact3D` (port da release).
 *
 * O componente 3D espera `{ shape, tone, monogram }`, mas o modelo do main não
 * tem campo `visual`. Este adapter deriva o visual de cada conquista de forma
 * PURA e determinística, sem mexer no modelo base (espelhado pelo nativo
 * SwiftUI — não quebra o bridge).
 *
 * Sprint 22 — "tudo é desafio, agrupado por raridade": a FORMA passa a
 * codificar a RARIDADE (não mais a categoria). disco→quadrado→hexágono→
 * escudo→estrela conforme sobe a raridade. A cor já vinha da raridade
 * (Sprint 19). A distinção de categoria (badge/medal/trophy/relic) some do
 * visual — `kind` continua só como chave interna do banco.
 */

export type AchievementVisualShape = "disc" | "square" | "hex" | "shield" | "star";

export type AchievementVisualTone =
  // Sprint 19 — palette de raridade (mais difícil = mais raro):
  | "stone" // comum (cinza, sem brilho)
  | "emerald" // incomum (verde)
  | "sapphire" // raro (azul)
  | "amethyst" // épico (roxo)
  | "amber" // lendário (laranja)
  | "dark" // secret não-conquistado ("???")
  // Tons legados (Sprint 15) — mantidos pro CSS não quebrar; não mais
  // produzidos pelo mapa de raridade.
  | "cyan"
  | "blue"
  | "bronze"
  | "silver"
  | "gold"
  | "crystal";

export type AchievementVisual = {
  shape: AchievementVisualShape;
  tone: AchievementVisualTone;
  monogram: string;
};

/**
 * Sprint 22 — FORMA por raridade (a silhueta fica mais "especial" conforme
 * sobe a raridade). Vale pra TODOS (inclusive desafios mensais, que agora
 * carregam rarity direto).
 */
const RARITY_SHAPE: Record<AchievementRarity, AchievementVisualShape> = {
  common: "disc",
  uncommon: "square",
  rare: "hex",
  epic: "shield",
  legendary: "star",
};

/**
 * Sprint 19 — COR por raridade (esquema clássico, mais difícil = mais raro).
 */
const RARITY_TONE: Record<AchievementRarity, AchievementVisualTone> = {
  common: "stone",
  uncommon: "emerald",
  rare: "sapphire",
  epic: "amethyst",
  legendary: "amber",
};

/**
 * Monograma por composite id ("kind:id") — o número-alvo quando existe
 * (estilo Apple Fitness: a medalha de 5K mostra "5K"), senão uma letra
 * mnemônica. Challenges dinâmicos são derivados do periodKey (mês).
 */
const MONOGRAM_MAP: Record<string, string> = {
  // Badges
  "badge:first-workout": "1",
  "badge:early-bird": "M", // Madrugador
  "badge:night-owl": "C", // Coruja
  "badge:cross-trainer": "3",
  "badge:explorer": "5",
  // Medalhas (streaks + volume)
  "medal:streak-3": "3",
  "medal:streak-7": "7",
  "medal:streak-14": "14",
  "medal:streak-30": "30",
  "medal:workouts-50": "50",
  "medal:streak-recovered": "R",
  // Troféus
  "trophy:streak-60": "60",
  "trophy:active-week": "5",
  "trophy:month-active": "15",
  "trophy:year-active": "100",
  "trophy:friends-50": "50",
  "trophy:network-100": "100",
  "trophy:community-200": "200",
  "trophy:social-10": "10",
  "trophy:prolific-100": "100",
  // Relíquias
  "relic:unbreakable": "∞",
  "relic:circle-master": "300",
  "relic:streak-365": "365",
  "relic:founder-2026": "26",
};

function deriveMonogram(achievement: Achievement): string {
  const mapped = MONOGRAM_MAP[`${achievement.kind}:${achievement.id}`];
  if (mapped) return mapped;
  if (achievement.kind === "challenge") {
    // "2026-06" → "6" (número do mês, sem zero à esquerda)
    const month = Number.parseInt(achievement.periodKey.split("-")[1] ?? "", 10);
    if (Number.isFinite(month) && month >= 1 && month <= 12) return String(month);
    return "★";
  }
  // Fallback: alvo do progresso, senão 1ª letra do label.
  if (achievement.progress?.target) return String(achievement.progress.target);
  return (achievement.label.trim()[0] ?? "•").toUpperCase();
}

export function getAchievementVisual(achievement: Achievement): AchievementVisual {
  // Secret não-conquistado: NUNCA vaza forma/tom/monograma reais — artefato
  // "mistério" neutro (disco escuro), sem entregar a raridade pela silhueta.
  if (achievement.secret && !achievement.earned) {
    return { shape: "disc", tone: "dark", monogram: "?" };
  }

  // Sprint 22 — forma E cor por raridade, pra TODOS. Sem rarity (não deveria
  // acontecer) cai no disco/stone neutro.
  const rarity = achievement.rarity;
  return {
    shape: rarity ? RARITY_SHAPE[rarity] : "disc",
    tone: rarity ? RARITY_TONE[rarity] : "stone",
    monogram: deriveMonogram(achievement),
  };
}

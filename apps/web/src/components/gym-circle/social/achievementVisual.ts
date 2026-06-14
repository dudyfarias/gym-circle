import type { Achievement } from "./achievements";

/**
 * Sprint 15 — adapter visual pro `AchievementArtifact3D` (port da release).
 *
 * O componente 3D espera `{ kind, tone, monogram }`, mas o modelo do main não
 * tem campo `visual` (o comentário em `achievements.ts` previa: "fallback 2D
 * enquanto arte 3D não chega" — chegou). Este adapter deriva o visual de cada
 * conquista de forma PURA e determinística, sem mexer no modelo base (que é
 * espelhado pelo nativo SwiftUI — não quebra o bridge).
 */

export type AchievementVisualKind = "badge3d" | "medal3d" | "trophy3d" | "relic3d";

export type AchievementVisualTone =
  // Sprint 19 — palette de raridade (mais difícil = mais raro):
  | "stone" // comum (cinza, sem brilho)
  | "emerald" // incomum (verde)
  | "sapphire" // raro (azul)
  | "amethyst" // épico (roxo)
  | "amber" // lendário (laranja)
  | "dark" // secret não-conquistado ("???")
  // Tons legados (Sprint 15) — mantidos pro CSS não quebrar; não mais
  // produzidos pelo mapa de raridade/dificuldade.
  | "cyan"
  | "blue"
  | "bronze"
  | "silver"
  | "gold"
  | "crystal";

export type AchievementVisual = {
  kind: AchievementVisualKind;
  tone: AchievementVisualTone;
  monogram: string;
};

/** Shape 3D por categoria. Challenge usa o quadrado arredondado do badge. */
const KIND_SHAPE: Record<Achievement["kind"], AchievementVisualKind> = {
  badge: "badge3d",
  medal: "medal3d",
  trophy: "trophy3d",
  relic: "relic3d",
  challenge: "badge3d",
};

/**
 * Sprint 19 — cor por RARIDADE (esquema clássico, mais difícil = mais raro).
 * Vale pra TODOS os tipos, inclusive medalhas (bronze/prata/ouro aposentados).
 */
const RARITY_TONE: Record<NonNullable<Achievement["rarity"]>, AchievementVisualTone> = {
  common: "stone",
  uncommon: "emerald",
  rare: "sapphire",
  epic: "amethyst",
  legendary: "amber",
};

/**
 * Dificuldade de desafio → tom, alinhado ao mapa difficulty→rarity de
 * achievements.ts buildChallenges (easy=common, medium=uncommon, hard=epic,
 * legendary=legendary).
 */
const DIFFICULTY_TONE: Record<string, AchievementVisualTone> = {
  easy: "stone",
  medium: "emerald",
  hard: "amethyst",
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
  // Secret não-conquistado: NUNCA vaza tom/monograma real — artefato "mistério".
  if (achievement.secret && !achievement.earned) {
    return { kind: KIND_SHAPE[achievement.kind], tone: "dark", monogram: "?" };
  }

  // Sprint 19 — TODOS coloridos por raridade (medalhas perderam bronze/prata/
  // ouro; agora "mais difícil = mais raro"). Desafio deriva da dificuldade.
  let tone: AchievementVisualTone;
  if (achievement.kind === "challenge") {
    tone = DIFFICULTY_TONE[achievement.difficulty] ?? "stone";
  } else {
    tone = achievement.rarity ? RARITY_TONE[achievement.rarity] : "stone";
  }

  return {
    kind: KIND_SHAPE[achievement.kind],
    tone,
    monogram: deriveMonogram(achievement),
  };
}

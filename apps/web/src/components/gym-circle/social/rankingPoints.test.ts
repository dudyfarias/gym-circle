import { describe, expect, it } from "vitest";
import {
  buildScoreBreakdown,
  pointsForDifficulty,
  pointsForRarity,
  pointsForStaticAchievement,
  RARITY_POINTS,
  STATIC_ACHIEVEMENT_RARITY,
} from "./rankingPoints";

describe("pontos por raridade", () => {
  it("comum 1, incomum 2, raro 3, épico 5, lendário 10", () => {
    expect(pointsForRarity("common")).toBe(1);
    expect(pointsForRarity("uncommon")).toBe(2);
    expect(pointsForRarity("rare")).toBe(3);
    expect(pointsForRarity("epic")).toBe(5);
    expect(pointsForRarity("legendary")).toBe(10);
  });
});

describe("pontos por dificuldade de desafio (espelha buildChallenges)", () => {
  it("easy=1, medium=2, hard=5, legendary=10", () => {
    expect(pointsForDifficulty("easy")).toBe(1);
    expect(pointsForDifficulty("medium")).toBe(2);
    expect(pointsForDifficulty("hard")).toBe(5);
    expect(pointsForDifficulty("legendary")).toBe(10);
  });
});

describe("pontos de achievements estáticos", () => {
  it("resolve por composite id", () => {
    expect(pointsForStaticAchievement("badge:first-workout")).toBe(1); // common
    expect(pointsForStaticAchievement("trophy:prolific-100")).toBe(5); // epic
    expect(pointsForStaticAchievement("relic:streak-365")).toBe(10); // legendary
    expect(pointsForStaticAchievement("medal:streak-30")).toBe(3); // rare
  });
  it("fallback comum=1 pra id desconhecido", () => {
    expect(pointsForStaticAchievement("badge:nope")).toBe(1);
  });
  it("todo composite id mapeado é uma raridade válida", () => {
    for (const [id, rarity] of Object.entries(STATIC_ACHIEVEMENT_RARITY)) {
      expect(id).toMatch(/^(badge|medal|trophy|relic):/);
      expect(RARITY_POINTS[rarity]).toBeGreaterThan(0);
    }
  });
});

describe("buildScoreBreakdown", () => {
  it("treino 10/dia + bônus + conquistas fecham o total", () => {
    const b = buildScoreBreakdown({
      workoutDays: 5,
      fullWeeks: 1,
      fullMonths: 0,
      achievementPoints: 8,
    });
    expect(b.workoutPoints).toBe(50);
    expect(b.bonusPoints).toBe(20);
    expect(b.achievementPoints).toBe(8);
    expect(b.total).toBe(78);
  });
  it("mês completo soma +50 e semanas acumulam", () => {
    const b = buildScoreBreakdown({
      workoutDays: 30,
      fullWeeks: 4,
      fullMonths: 1,
      achievementPoints: 0,
    });
    expect(b.bonusPoints).toBe(4 * 20 + 50);
    expect(b.total).toBe(300 + 130);
  });
});

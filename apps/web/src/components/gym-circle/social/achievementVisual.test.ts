import { describe, expect, it } from "vitest";
import type { Achievement } from "./achievements";
import { getAchievementVisual } from "./achievementVisual";

function makeBase(overrides: Partial<Achievement>): Achievement {
  return {
    id: "first-workout",
    kind: "badge",
    label: "Primeiro treino",
    description: "x",
    earned: true,
    iconKey: "trophy",
    rarity: "common",
    ...overrides,
  } as Achievement;
}

describe("getAchievementVisual", () => {
  it("Sprint 22 — FORMA vem da raridade (não da categoria)", () => {
    const cases = [
      ["common", "disc"],
      ["uncommon", "square"],
      ["rare", "hex"],
      ["epic", "shield"],
      ["legendary", "star"],
    ] as const;
    for (const [rarity, shape] of cases) {
      expect(getAchievementVisual(makeBase({ rarity })).shape).toBe(shape);
    }
    expect(getAchievementVisual(makeBase({ rarity: undefined })).shape).toBe("disc");
  });

  it("o tom vem da raridade (palette da Sprint 19)", () => {
    const cases = [
      ["common", "stone"],
      ["uncommon", "emerald"],
      ["rare", "sapphire"],
      ["epic", "amethyst"],
      ["legendary", "amber"],
    ] as const;
    for (const [rarity, tone] of cases) {
      expect(getAchievementVisual(makeBase({ rarity })).tone).toBe(tone);
    }
    expect(getAchievementVisual(makeBase({ rarity: undefined })).tone).toBe("stone");
  });

  it("desafio mensal usa rarity igual a todo o resto (forma + cor)", () => {
    const visual = getAchievementVisual(
      makeBase({
        kind: "challenge",
        id: "x",
        periodKey: "2026-06",
        rarity: "epic",
      } as Partial<Achievement>),
    );
    expect(visual.shape).toBe("shield");
    expect(visual.tone).toBe("amethyst");
  });

  it("monogramas do mapa estático", () => {
    expect(getAchievementVisual(makeBase({})).monogram).toBe("1"); // badge:first-workout
    expect(
      getAchievementVisual(
        makeBase({ kind: "medal", id: "streak-30", rarity: "rare" } as Partial<Achievement>),
      ).monogram,
    ).toBe("30");
    expect(
      getAchievementVisual(
        makeBase({ kind: "relic", id: "unbreakable", rarity: "epic" }),
      ).monogram,
    ).toBe("∞");
    expect(
      getAchievementVisual(
        makeBase({ kind: "relic", id: "founder-2026", rarity: "legendary" }),
      ).monogram,
    ).toBe("26");
  });

  it("challenge dinâmico deriva o mês do periodKey (fallback ★)", () => {
    const june = getAchievementVisual(
      makeBase({
        kind: "challenge",
        id: "novo",
        periodKey: "2026-06",
        rarity: "common",
      } as Partial<Achievement>),
    );
    expect(june.monogram).toBe("6");
    const broken = getAchievementVisual(
      makeBase({
        kind: "challenge",
        id: "novo",
        periodKey: "????",
        rarity: "common",
      } as Partial<Achievement>),
    );
    expect(broken.monogram).toBe("★");
  });

  it("fallback de monogram: target do progresso, senão 1ª letra do label", () => {
    const withProgress = getAchievementVisual(
      makeBase({ id: "inedito", progress: { current: 2, target: 42 } }),
    );
    expect(withProgress.monogram).toBe("42");
    const noProgress = getAchievementVisual(
      makeBase({ id: "inedito", label: "zen total", progress: undefined }),
    );
    expect(noProgress.monogram).toBe("Z");
  });

  it("secret não-conquistado vira mistério (disco escuro + ?) — sem leak", () => {
    const mystery = getAchievementVisual(
      makeBase({ id: "early-bird", secret: true, earned: false, rarity: "uncommon" }),
    );
    expect(mystery).toEqual({ shape: "disc", tone: "dark", monogram: "?" });
    // Conquistado revela o visual real (incomum → quadrado verde, "M").
    const revealed = getAchievementVisual(
      makeBase({ id: "early-bird", secret: true, earned: true, rarity: "uncommon" }),
    );
    expect(revealed.shape).toBe("square");
    expect(revealed.tone).toBe("emerald");
    expect(revealed.monogram).toBe("M");
  });
});

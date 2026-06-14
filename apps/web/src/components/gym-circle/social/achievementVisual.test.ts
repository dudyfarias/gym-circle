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
    ...overrides,
  } as Achievement;
}

describe("getAchievementVisual", () => {
  it("mapeia shape por kind (challenge usa badge3d)", () => {
    expect(getAchievementVisual(makeBase({ kind: "badge" })).kind).toBe("badge3d");
    expect(
      getAchievementVisual(
        makeBase({ kind: "medal", id: "streak-7", tier: "bronze" } as Partial<Achievement>),
      ).kind,
    ).toBe("medal3d");
    expect(
      getAchievementVisual(makeBase({ kind: "trophy", id: "streak-60" })).kind,
    ).toBe("trophy3d");
    expect(
      getAchievementVisual(makeBase({ kind: "relic", id: "unbreakable" })).kind,
    ).toBe("relic3d");
    expect(
      getAchievementVisual(
        makeBase({
          kind: "challenge",
          id: "projeto-verao",
          periodKey: "2026-06",
          difficulty: "easy",
        } as Partial<Achievement>),
      ).kind,
    ).toBe("badge3d");
  });

  it("Sprint 19 — medalha usa RARIDADE como tone (bronze/prata/ouro aposentados)", () => {
    expect(
      getAchievementVisual(
        makeBase({ kind: "medal", id: "streak-7", tier: "bronze", rarity: "common" } as Partial<Achievement>),
      ).tone,
    ).toBe("stone");
    expect(
      getAchievementVisual(
        makeBase({ kind: "medal", id: "streak-30", tier: "gold", rarity: "rare" } as Partial<Achievement>),
      ).tone,
    ).toBe("sapphire");
  });

  it("challenge usa difficulty como tone (palette de raridade)", () => {
    const cases = [
      ["easy", "stone"],
      ["medium", "emerald"],
      ["hard", "amethyst"],
      ["legendary", "amber"],
    ] as const;
    for (const [difficulty, tone] of cases) {
      const visual = getAchievementVisual(
        makeBase({
          kind: "challenge",
          id: "x",
          periodKey: "2026-06",
          difficulty,
        } as Partial<Achievement>),
      );
      expect(visual.tone).toBe(tone);
    }
  });

  it("demais kinds usam rarity como tone (fallback stone)", () => {
    expect(getAchievementVisual(makeBase({ rarity: "common" })).tone).toBe("stone");
    expect(getAchievementVisual(makeBase({ rarity: "uncommon" })).tone).toBe("emerald");
    expect(getAchievementVisual(makeBase({ rarity: "rare" })).tone).toBe("sapphire");
    expect(getAchievementVisual(makeBase({ rarity: "epic" })).tone).toBe("amethyst");
    expect(getAchievementVisual(makeBase({ rarity: "legendary" })).tone).toBe("amber");
    expect(getAchievementVisual(makeBase({ rarity: undefined })).tone).toBe("stone");
  });

  it("monogramas do mapa estático", () => {
    expect(getAchievementVisual(makeBase({})).monogram).toBe("1"); // badge:first-workout
    expect(
      getAchievementVisual(
        makeBase({ kind: "medal", id: "streak-30", tier: "gold" } as Partial<Achievement>),
      ).monogram,
    ).toBe("30");
    expect(
      getAchievementVisual(makeBase({ kind: "relic", id: "unbreakable" })).monogram,
    ).toBe("∞");
    expect(
      getAchievementVisual(makeBase({ kind: "relic", id: "founder-2026" })).monogram,
    ).toBe("26");
  });

  it("challenge dinâmico deriva o mês do periodKey (fallback ★)", () => {
    const june = getAchievementVisual(
      makeBase({
        kind: "challenge",
        id: "novo",
        periodKey: "2026-06",
        difficulty: "easy",
      } as Partial<Achievement>),
    );
    expect(june.monogram).toBe("6");
    const broken = getAchievementVisual(
      makeBase({
        kind: "challenge",
        id: "novo",
        periodKey: "????",
        difficulty: "easy",
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

  it("secret não-conquistado vira mistério (dark + ?) — sem leak", () => {
    const mystery = getAchievementVisual(
      makeBase({ id: "early-bird", secret: true, earned: false, rarity: "uncommon" }),
    );
    expect(mystery).toEqual({ kind: "badge3d", tone: "dark", monogram: "?" });
    // Conquistado revela o visual real.
    const revealed = getAchievementVisual(
      makeBase({ id: "early-bird", secret: true, earned: true, rarity: "uncommon" }),
    );
    expect(revealed.tone).toBe("emerald");
    expect(revealed.monogram).toBe("M");
  });
});

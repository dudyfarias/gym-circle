import { describe, expect, it } from "vitest";
import { formatStreakDays, formatTrainingStreakText } from "./streak";

describe("streak copy helpers", () => {
  it("usa singular para 1 dia", () => {
    expect(formatStreakDays(1)).toBe("1 dia");
    expect(formatTrainingStreakText("Dudy", 1)).toBe("Dudy está há 1 dia treinando");
  });

  it("usa plural para 0 ou 2+ dias", () => {
    expect(formatStreakDays(0)).toBe("0 dias");
    expect(formatStreakDays(2)).toBe("2 dias");
    expect(formatTrainingStreakText("Dudy", 7)).toBe("Dudy está há 7 dias treinando");
  });
});

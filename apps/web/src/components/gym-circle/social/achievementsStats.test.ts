import { describe, expect, it } from "vitest";
import { formatRarityPercent } from "./achievementsStats";

describe("Sprint 7.5.8 — formatRarityPercent", () => {
  it("null/zero retorna null (sem dados)", () => {
    expect(formatRarityPercent(null, "en")).toBe(null);
    expect(formatRarityPercent(0, "en")).toBe(null);
    expect(formatRarityPercent(-5, "en")).toBe(null);
  });

  it("relíquias raríssimas: < 0.1% → 2 casas decimais", () => {
    expect(formatRarityPercent(0.01, "en")).toBe("0.01%");
    expect(formatRarityPercent(0.05, "en")).toBe("0.05%");
    expect(formatRarityPercent(0.09, "en")).toBe("0.09%");
  });

  it("relíquias raras: 0.1-1% → 2 decimal", () => {
    expect(formatRarityPercent(0.5, "en")).toBe("0.50%");
    expect(formatRarityPercent(0.99, "en")).toBe("0.99%");
  });

  it("alta raridade: 1-10% → 1 decimal", () => {
    expect(formatRarityPercent(1.5, "en")).toBe("1.5%");
    expect(formatRarityPercent(9.9, "en")).toBe("9.9%");
  });

  it("comum: 10-100% → integer", () => {
    expect(formatRarityPercent(23, "en")).toBe("23%");
    expect(formatRarityPercent(50, "en")).toBe("50%");
    expect(formatRarityPercent(100, "en")).toBe("100%");
  });

  it("cap em 0.01% pra valores menores (não mostra 0.001%)", () => {
    expect(formatRarityPercent(0.001, "en")).toBe("0.01%");
    expect(formatRarityPercent(0.005, "en")).toBe("0.01%");
  });

  it("locale pt-BR usa vírgula como separador", () => {
    expect(formatRarityPercent(0.5, "pt-BR")).toBe("0,50%");
    expect(formatRarityPercent(1.5, "pt-BR")).toBe("1,5%");
    expect(formatRarityPercent(23, "pt-BR")).toBe("23%");
  });

  it("locale en usa ponto", () => {
    expect(formatRarityPercent(0.5, "en")).toBe("0.50%");
    expect(formatRarityPercent(1.5, "en")).toBe("1.5%");
  });
});

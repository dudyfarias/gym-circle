import { describe, expect, it } from "vitest";
import {
  CAPTION_TRUNCATE_THRESHOLD,
  isCaptionLong,
  truncateCaptionText,
} from "./caption";

describe("truncateCaptionText", () => {
  it("returns the text unchanged when under the limit", () => {
    expect(truncateCaptionText("Treino leve hoje", 140)).toBe(
      "Treino leve hoje",
    );
  });

  it("returns the text unchanged when exactly at the limit", () => {
    const text = "a".repeat(140);
    expect(truncateCaptionText(text, 140)).toBe(text);
  });

  it("cuts at the last space before the limit to avoid breaking words", () => {
    const text =
      "Treino pesado hoje, peito e costas, com 6 séries de supino reto e mais 4 séries de remada curvada com barra livre";
    const truncated = truncateCaptionText(text, 60);

    // Não deve cortar no meio de palavra
    expect(truncated.endsWith(" ")).toBe(false);
    expect(truncated.length).toBeLessThanOrEqual(60);
    // Confirma que o último char é o fim de uma palavra inteira
    expect(text.startsWith(truncated)).toBe(true);
  });

  it("falls back to hard cut when there's no space within the window", () => {
    // String contínua sem espaço — sem opção melhor
    const text = "abcdefghijklmnopqrstuvwxyz".repeat(10);
    const truncated = truncateCaptionText(text, 20);
    expect(truncated).toBe(text.slice(0, 20));
  });

  it("preserves @mention prefix when truncating after the mention", () => {
    const text =
      "Mandou bem @ana.fit no treino de pernas hoje, tu tá monstro mesmo, vamos junto amanhã que eu preciso de motivação";
    const truncated = truncateCaptionText(text, 40);
    // Deve preservar a mention completa
    expect(truncated).toContain("@ana.fit");
  });

  it("removes trailing whitespace from the truncated tail", () => {
    const text = "palavra   ".padEnd(50, " ") + "outra";
    const truncated = truncateCaptionText(text, 20);
    expect(truncated.endsWith(" ")).toBe(false);
  });
});

describe("isCaptionLong", () => {
  it("returns false for short captions", () => {
    expect(isCaptionLong("Treino leve")).toBe(false);
  });

  it("returns true when the caption exceeds the default threshold", () => {
    const longCaption = "a".repeat(CAPTION_TRUNCATE_THRESHOLD + 1);
    expect(isCaptionLong(longCaption)).toBe(true);
  });

  it("respects a custom threshold", () => {
    expect(isCaptionLong("Treino leve", 5)).toBe(true);
    expect(isCaptionLong("Treino leve", 50)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { shouldShowViewerLocationPrompt } from "./useViewerLocation";

describe("shouldShowViewerLocationPrompt", () => {
  it("não pede localização novamente após granted/denied/dismissed", () => {
    expect(shouldShowViewerLocationPrompt("granted", true)).toBe(false);
    expect(shouldShowViewerLocationPrompt("denied", true)).toBe(false);
    expect(shouldShowViewerLocationPrompt("dismissed", true)).toBe(false);
  });

  it("mostra o prompt discreto quando ainda não houve resposta e há posts com distância", () => {
    expect(shouldShowViewerLocationPrompt("idle", true)).toBe(true);
  });

  it("não mostra se não existe contexto de distância", () => {
    expect(shouldShowViewerLocationPrompt("idle", false)).toBe(false);
  });
});

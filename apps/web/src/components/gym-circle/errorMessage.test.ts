import { describe, expect, it } from "vitest";
import { errorMessage } from "./errorMessage";

describe("errorMessage", () => {
  it("lê Error nativo", () => {
    expect(errorMessage(new Error("falhou"), "fallback")).toBe("falhou");
  });

  it("lê PostgrestError e outros erros plain-object", () => {
    expect(
      errorMessage(
        {
          code: "23514",
          message: "post e atividade de origem não pertencem ao mesmo treino",
        },
        "fallback",
      ),
    ).toBe("post e atividade de origem não pertencem ao mesmo treino");
  });

  it("usa fallback quando não há mensagem", () => {
    expect(errorMessage({ code: "unknown" }, "fallback")).toBe("fallback");
  });
});

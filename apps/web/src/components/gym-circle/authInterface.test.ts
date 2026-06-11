import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ptBR from "../../i18n/locales/pt-BR.json";

const authGateSource = readFileSync(
  new URL("./LiveAuthGate.tsx", import.meta.url),
  "utf8",
);

describe("Gym Circle auth interface", () => {
  it("keeps Apple and Google OAuth buttons out of the login UI", () => {
    expect(authGateSource).not.toContain("signInWithProvider");
    expect(authGateSource).not.toContain('provider: "google"');
    expect(authGateSource).not.toContain('provider: "apple"');
    expect(authGateSource).not.toMatch(/Entrar com (Google|Apple)/);
  });

  it("keeps email/password and password reset visible", () => {
    // Sprint 16 — pós-9.9.1 as strings vivem no i18n: o fonte referencia
    // as CHAVES (estáveis) e o locale garante o texto que o usuário vê.
    // Antes o teste grepava o PT literal no componente e quebrou no
    // sweep de L10n — era parte do baseline de 7 testes vermelhos.
    expect(authGateSource).toContain("auth.field.emailOrUsername");
    expect(authGateSource).toContain("auth.field.password");
    expect(authGateSource).toContain('"forgot-password"');
    expect(authGateSource).toContain("resetPassword(");

    expect(ptBR.auth.field.emailOrUsername).toBe("email ou username");
    expect(ptBR.auth.field.password).toBe("senha");
    expect(ptBR.auth.toggle.forgotPassword).toBe("Esqueci minha senha");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
    expect(authGateSource).toContain("auth.field.emailOrUsername");
    expect(authGateSource).toContain("auth.field.password");
    expect(authGateSource).toContain("auth.toggle.forgotPassword");
  });
});

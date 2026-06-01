import { describe, expect, it } from "vitest";
import {
  getPasswordRecoveryErrorMessage,
  parsePasswordRecoveryUrl,
} from "./passwordRecovery";

describe("password recovery helpers", () => {
  it("parses PKCE recovery links with code", () => {
    expect(
      parsePasswordRecoveryUrl("https://gym-circle-rust.vercel.app/reset-password?code=abc"),
    ).toMatchObject({
      code: "abc",
      hasRecoveryHint: true,
    });
  });

  it("parses token_hash recovery links", () => {
    expect(
      parsePasswordRecoveryUrl(
        "https://gym-circle-rust.vercel.app/reset-password?token_hash=hash&type=recovery",
      ),
    ).toMatchObject({
      hasRecoveryHint: true,
      tokenHash: "hash",
      type: "recovery",
    });
  });

  it("parses implicit recovery links with access and refresh tokens", () => {
    expect(
      parsePasswordRecoveryUrl(
        "https://gym-circle-rust.vercel.app/reset-password#access_token=access&refresh_token=refresh&type=recovery",
      ),
    ).toMatchObject({
      accessToken: "access",
      hasRecoveryHint: true,
      refreshToken: "refresh",
      type: "recovery",
    });
  });

  it("uses a friendly message for expired or invalid links", () => {
    expect(getPasswordRecoveryErrorMessage(new Error("invalid token"))).toBe(
      "Esse link expirou ou já foi usado. Peça um novo email para alterar sua senha.",
    );
  });

  it("does not expose raw JSON errors", () => {
    expect(getPasswordRecoveryErrorMessage('{"error":"server_error"}')).toBe(
      "Não conseguimos validar o link de recuperação. Peça um novo email e tente novamente.",
    );
  });
});

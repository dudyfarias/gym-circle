import { describe, expect, it } from "vitest";
import { parseAuthCallbackUrl } from "./socialAuth";

describe("parseAuthCallbackUrl", () => {
  it("ignores URLs that are not the auth callback", () => {
    expect(parseAuthCallbackUrl("com.gymcircle.app://other").kind).toBe(
      "ignore",
    );
    expect(parseAuthCallbackUrl("https://gym-circle-rust.vercel.app/").kind).toBe(
      "ignore",
    );
  });

  it("extracts the PKCE authorization code from the query string", () => {
    const result = parseAuthCallbackUrl(
      "com.gymcircle.app://auth-callback?code=abc123",
    );
    expect(result).toEqual({ kind: "code", code: "abc123" });
  });

  it("extracts implicit-flow tokens from the URL fragment", () => {
    const result = parseAuthCallbackUrl(
      "com.gymcircle.app://auth-callback#access_token=tok&refresh_token=ref",
    );
    expect(result).toEqual({
      kind: "tokens",
      accessToken: "tok",
      refreshToken: "ref",
    });
  });

  it("surfaces an OAuth error carried on the callback", () => {
    const result = parseAuthCallbackUrl(
      "com.gymcircle.app://auth-callback?error=access_denied&error_description=User%20cancelled",
    );
    expect(result).toEqual({ kind: "error", message: "User cancelled" });
  });

  it("treats a callback with no code/tokens/error as ignore", () => {
    expect(
      parseAuthCallbackUrl("com.gymcircle.app://auth-callback").kind,
    ).toBe("ignore");
  });

  it("does not throw on a malformed callback URL", () => {
    expect(() => parseAuthCallbackUrl("auth-callback:::not a url")).not.toThrow();
  });
});

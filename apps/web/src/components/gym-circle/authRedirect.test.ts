import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthErrorMessage, getAuthRedirectTo } from "./authRedirect";

describe("auth redirect helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the current web origin for Safari/browser OAuth", () => {
    vi.stubGlobal("window", {
      location: { origin: "https://gym-circle-rust.vercel.app" },
    });

    expect(getAuthRedirectTo()).toBe("https://gym-circle-rust.vercel.app");
  });

  it("uses production URL inside Capacitor native shells", () => {
    vi.stubGlobal("window", {
      Capacitor: { isNativePlatform: () => true },
      location: { origin: "capacitor://localhost" },
    });

    expect(getAuthRedirectTo()).toBe("https://gym-circle-rust.vercel.app");
    expect(getAuthRedirectTo("/reset-password")).toBe(
      "https://gym-circle-rust.vercel.app/reset-password",
    );
  });

  it("does not show raw JSON auth errors", () => {
    expect(
      getAuthErrorMessage(
        new Error('{"error":"server_error","message":"bad provider"}'),
        "Falha amigável",
      ),
    ).toBe("Falha amigável");
  });

  it("maps OAuth/redirect errors to a friendly message", () => {
    expect(
      getAuthErrorMessage(new Error("OAuth redirect_to mismatch"), "fallback"),
    ).toBe("Não conseguimos abrir o login social. Tente novamente ou use email e senha.");
  });
});

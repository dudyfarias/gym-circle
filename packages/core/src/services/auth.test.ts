import { describe, expect, it, vi } from "vitest";
import { authService } from "./auth";
import type { GymCircleClient } from "./supabase";

describe("authService.signInWithOAuth", () => {
  it("starts Supabase OAuth for Google with the provided redirect", async () => {
    const client = {
      auth: {
        signInWithOAuth: vi.fn().mockResolvedValue({
          data: { provider: "google", url: "https://auth.example/google" },
          error: null,
        }),
      },
    } as unknown as GymCircleClient & {
      auth: { signInWithOAuth: ReturnType<typeof vi.fn> };
    };
    const service = authService(client);

    const result = await service.signInWithOAuth(
      "google",
      "https://gym-circle-rust.vercel.app",
    );

    expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://gym-circle-rust.vercel.app",
      },
    });
    expect(result.provider).toBe("google");
  });

  it("starts Supabase OAuth for Apple without changing email/password auth", async () => {
    const client = {
      auth: {
        signInWithOAuth: vi.fn().mockResolvedValue({
          data: { provider: "apple", url: "https://auth.example/apple" },
          error: null,
        }),
      },
    } as unknown as GymCircleClient & {
      auth: { signInWithOAuth: ReturnType<typeof vi.fn> };
    };
    const service = authService(client);

    await service.signInWithOAuth("apple");

    expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "apple",
      options: {
        redirectTo: undefined,
      },
    });
  });

  it("sends magic links with emailRedirectTo for account reactivation", async () => {
    const client = {
      auth: {
        signInWithOtp: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: null,
        }),
      },
    } as unknown as GymCircleClient & {
      auth: { signInWithOtp: ReturnType<typeof vi.fn> };
    };
    const service = authService(client);

    await service.sendMagicLink(
      " dudy@gymcircle.app ",
      "https://gym-circle-rust.vercel.app/reactivate-account?token=abc",
    );

    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
      email: "dudy@gymcircle.app",
      options: {
        emailRedirectTo:
          "https://gym-circle-rust.vercel.app/reactivate-account?token=abc",
      },
    });
  });
});

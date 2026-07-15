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

  it("username sem @ loga via Edge Function e seta a sessão (Sprint 21.2)", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { session: { access_token: "at-1", refresh_token: "rt-1" } },
      error: null,
    });
    const setSession = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" }, session: { access_token: "at-1" } },
      error: null,
    });
    const client = {
      auth: { setSession },
      functions: { invoke },
    } as unknown as GymCircleClient;
    const service = authService(client);

    await service.signInWithPassword("@Dudy.Farias", "senha123");

    expect(invoke).toHaveBeenCalledWith("login-with-username", {
      body: { username: "dudy.farias", password: "senha123" },
    });
    expect(setSession).toHaveBeenCalledWith({
      access_token: "at-1",
      refresh_token: "rt-1",
    });
  });

  it.each(["dudy", "Dudy", "DUDY", "@DuDy"])(
    "envia %s ao backend sempre como username minúsculo",
    async (identifier) => {
      const invoke = vi.fn().mockResolvedValue({
        data: { session: { access_token: "at-1", refresh_token: "rt-1" } },
        error: null,
      });
      const client = {
        auth: {
          setSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
        },
        functions: { invoke },
      } as unknown as GymCircleClient;

      await authService(client).signInWithPassword(identifier, "senha123");

      expect(invoke).toHaveBeenCalledWith("login-with-username", {
        body: { username: "dudy", password: "senha123" },
      });
    },
  );

  it("falha de username/senha vira erro genérico (anti-enumeração)", async () => {
    const client = {
      auth: { setSession: vi.fn() },
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: { error: "invalid_credentials" },
          error: new Error("Edge Function returned a non-2xx status code"),
        }),
      },
    } as unknown as GymCircleClient;
    const service = authService(client);

    await expect(
      service.signInWithPassword("naoexiste", "qualquer"),
    ).rejects.toThrow("Username ou senha inválidos.");
  });

  it("email com @ continua no signInWithPassword direto do Supabase", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" }, session: {} },
      error: null,
    });
    const invoke = vi.fn();
    const client = {
      auth: { signInWithPassword },
      functions: { invoke },
    } as unknown as GymCircleClient;
    const service = authService(client);

    await service.signInWithPassword(" dudy@gymcircle.app ", "senha123");

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "dudy@gymcircle.app",
      password: "senha123",
    });
    expect(invoke).not.toHaveBeenCalled();
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

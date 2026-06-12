import type { GymCircleClient } from "./supabase";

export type SignUpInput = {
  email: string;
  password: string;
  username: string;
};

export type SocialAuthProvider = "google" | "apple";

export function authService(client: GymCircleClient) {
  function cleanUsername(value: string): string {
    return value.trim().toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_.]/g, "");
  }

  // Sprint 21.2 — login por username via Edge Function. O e-mail é
  // resolvido server-side e nunca volta pro cliente (o RPC antigo
  // resolve_email_for_username deixava qualquer anon colher e-mails).
  async function signInWithUsername(username: string, password: string) {
    const normalized = cleanUsername(username);
    if (normalized.length < 3) {
      throw new Error("Informe um username ou email válido.");
    }
    const { data, error } = await client.functions.invoke("login-with-username", {
      body: { username: normalized, password },
    });
    // Erro genérico proposital: a função não diferencia username
    // inexistente de senha errada (anti-enumeração).
    const session = (data as { session?: { access_token?: string; refresh_token?: string } } | null)
      ?.session;
    if (error || !session?.access_token || !session?.refresh_token) {
      throw new Error("Username ou senha inválidos.");
    }
    const { data: sessionData, error: sessionError } = await client.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (sessionError) throw sessionError;
    return sessionData;
  }

  return {
    async signInWithPassword(identifier: string, password: string) {
      const cleanedIdentifier = identifier.trim();
      // "@dudy" é handle, não e-mail — o @ só indica e-mail quando vem
      // depois da parte local (fix de quirk: antes "@user" caía no fluxo
      // de e-mail e falhava sempre).
      const isEmail = cleanedIdentifier.replace(/^@/, "").includes("@");
      if (!isEmail) {
        return signInWithUsername(cleanedIdentifier, password);
      }
      const { data, error } = await client.auth.signInWithPassword({
        email: cleanedIdentifier,
        password,
      });
      if (error) throw error;
      return data;
    },

    async signInWithOAuth(provider: SocialAuthProvider, redirectTo?: string) {
      const { data, error } = await client.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      });
      if (error) throw error;
      return data;
    },

    async signUp({ email, password, username }: SignUpInput) {
      const cleanedUsername = cleanUsername(username);
      if (cleanedUsername.length < 3) {
        throw new Error("Username precisa ter pelo menos 3 caracteres.");
      }
      const { data: existingProfile, error: existingError } = await client
        .from("profiles")
        .select("user_id")
        .eq("username", cleanedUsername)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existingProfile) throw new Error("Esse username já está em uso.");

      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: cleanedUsername,
          },
        },
      });
      if (error) throw error;
      return data;
    },

    async resetPasswordForEmail(email: string, redirectTo?: string) {
      const { data, error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (error) throw error;
      return data;
    },

    async sendMagicLink(email: string, redirectTo?: string) {
      const { data, error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectTo,
        },
      });
      if (error) throw error;
      return data;
    },

    async updatePassword(password: string) {
      const { data, error } = await client.auth.updateUser({ password });
      if (error) throw error;
      return data;
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },

    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },

    async getUser() {
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      return data.user;
    },

    onAuthStateChange(
      handler: Parameters<GymCircleClient["auth"]["onAuthStateChange"]>[0],
    ) {
      return client.auth.onAuthStateChange(handler);
    },
  };
}

export type AuthService = ReturnType<typeof authService>;

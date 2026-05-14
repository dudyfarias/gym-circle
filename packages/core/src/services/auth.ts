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

  async function resolveEmailForUsername(username: string) {
    const normalized = cleanUsername(username);
    if (normalized.length < 3) {
      throw new Error("Informe um username ou email válido.");
    }
    const { data, error } = await client.rpc("resolve_email_for_username", {
      p_username: normalized,
    });
    if (error) throw error;
    if (!data) {
      throw new Error("Username não encontrado.");
    }
    return data;
  }

  return {
    async signInWithPassword(identifier: string, password: string) {
      const cleanedIdentifier = identifier.trim();
      const email = cleanedIdentifier.includes("@")
        ? cleanedIdentifier
        : await resolveEmailForUsername(cleanedIdentifier);
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },

    resolveEmailForUsername,

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

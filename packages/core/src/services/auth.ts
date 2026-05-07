import type { GymCircleClient } from "./supabase";

export type SignUpInput = {
  email: string;
  password: string;
  username?: string;
  displayName?: string;
};

export function authService(client: GymCircleClient) {
  return {
    async signInWithPassword(email: string, password: string) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },

    async signUp({ email, password, username, displayName }: SignUpInput) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username ?? null,
            display_name: displayName ?? null,
          },
        },
      });
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

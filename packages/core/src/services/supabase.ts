import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

export type GymCircleClient = SupabaseClient<Database>;

export type CreateClientOptions = {
  url: string;
  anonKey: string;
  /**
   * Storage adapter para a sessão. No browser/PWA usar `window.localStorage`.
   * No Expo passar `AsyncStorage`. Em SSR passar `undefined`.
   */
  storage?: {
    getItem: (key: string) => string | null | Promise<string | null>;
    setItem: (key: string, value: string) => void | Promise<void>;
    removeItem: (key: string) => void | Promise<void>;
  };
  storageKey?: string;
};

export function createGymCircleClient(options: CreateClientOptions): GymCircleClient {
  return createClient<Database>(options.url, options.anonKey, {
    auth: {
      persistSession: Boolean(options.storage),
      detectSessionInUrl: Boolean(options.storage),
      autoRefreshToken: true,
      storage: options.storage,
      storageKey: options.storageKey ?? "gym-circle.auth",
    },
  });
}

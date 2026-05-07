"use client";

import {
  createGymCircleClient,
  type GymCircleClient,
} from "@gym-circle/core/services";
import type { SupabaseEnv } from "./env";

let cachedClient: GymCircleClient | null = null;

export function getBrowserClient(env: SupabaseEnv): GymCircleClient {
  if (cachedClient) return cachedClient;
  cachedClient = createGymCircleClient({
    url: env.url,
    anonKey: env.anonKey,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  });
  return cachedClient;
}

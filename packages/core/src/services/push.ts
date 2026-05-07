import type { GymCircleClient } from "./supabase";

export type SavePushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
};

export function pushService(client: GymCircleClient) {
  return {
    async save(userId: string, input: SavePushSubscriptionInput): Promise<void> {
      const { error } = await client
        .from("push_subscriptions")
        .upsert(
          {
            user_id: userId,
            endpoint: input.endpoint,
            p256dh: input.p256dh,
            auth: input.auth,
            user_agent: input.userAgent ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "endpoint" },
        );
      if (error) throw error;
    },

    async removeByEndpoint(endpoint: string): Promise<void> {
      const { error } = await client
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", endpoint);
      if (error) throw error;
    },
  };
}

export type PushService = ReturnType<typeof pushService>;

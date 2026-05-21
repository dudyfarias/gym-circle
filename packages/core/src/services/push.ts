import type { GymCircleClient } from "./supabase";

export type SavePushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
};

export type SaveDevicePushTokenInput = {
  platform: "ios" | "android" | "web";
  token: string;
  deviceId?: string | null;
  appVersion?: string | null;
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

    async saveDeviceToken(
      userId: string,
      input: SaveDevicePushTokenInput,
    ): Promise<void> {
      const now = new Date().toISOString();
      const { error } = await client
        .from("device_push_tokens")
        .upsert(
          {
            user_id: userId,
            platform: input.platform,
            token: input.token,
            device_id: input.deviceId ?? null,
            app_version: input.appVersion ?? null,
            updated_at: now,
            last_seen_at: now,
            revoked_at: null,
          },
          { onConflict: "token" },
        );
      if (error) throw error;
    },

    async revokeDeviceToken(token: string): Promise<void> {
      const { error } = await client
        .from("device_push_tokens")
        .update({
          revoked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("token", token);
      if (error) throw error;
    },
  };
}

export type PushService = ReturnType<typeof pushService>;

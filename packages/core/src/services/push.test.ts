import { describe, expect, it, vi } from "vitest";
import { pushService } from "./push";
import type { GymCircleClient } from "./supabase";

function createUpsertClientMock() {
  const query = {
    upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const from = vi.fn(() => query);
  return {
    client: { from } as unknown as GymCircleClient,
    from,
    query,
  };
}

function createUpdateClientMock() {
  const query = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const from = vi.fn(() => query);
  return {
    client: { from } as unknown as GymCircleClient,
    from,
    query,
  };
}

describe("pushService native device tokens", () => {
  it("upserts a native device token without duplicating by token", async () => {
    const { client, from, query } = createUpsertClientMock();

    await pushService(client).saveDeviceToken("user-1", {
      platform: "ios",
      token: "apns-token",
      deviceId: "iphone-1",
      appVersion: "1.0.0",
    });

    expect(from).toHaveBeenCalledWith("device_push_tokens");
    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        platform: "ios",
        token: "apns-token",
        device_id: "iphone-1",
        app_version: "1.0.0",
        revoked_at: null,
      }),
      { onConflict: "token" },
    );
  });

  it("marks a native device token as revoked on logout", async () => {
    const { client, from, query } = createUpdateClientMock();

    await pushService(client).revokeDeviceToken("apns-token");

    expect(from).toHaveBeenCalledWith("device_push_tokens");
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({
        revoked_at: expect.any(String),
        updated_at: expect.any(String),
      }),
    );
    expect(query.eq).toHaveBeenCalledWith("token", "apns-token");
  });
});

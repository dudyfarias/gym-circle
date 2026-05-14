import { describe, expect, it, vi } from "vitest";
import {
  SOCIAL_BELL_NOTIFICATION_KINDS,
  isSocialBellNotificationKind,
  notificationService,
} from "./notifications";
import type { GymCircleClient } from "./supabase";

function createListClientMock() {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  const from = vi.fn(() => query);
  return {
    client: { from } as unknown as GymCircleClient,
    from,
    query,
  };
}

function createMarkAllReadClientMock() {
  const query = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const from = vi.fn(() => query);
  return {
    client: { from } as unknown as GymCircleClient,
    from,
    query,
  };
}

describe("notificationService", () => {
  it("lista apenas notificações sociais do sino", async () => {
    const { client, query } = createListClientMock();

    await notificationService(client).listForUser("user-1");

    expect(query.in).toHaveBeenCalledWith("kind", SOCIAL_BELL_NOTIFICATION_KINDS);
    expect(SOCIAL_BELL_NOTIFICATION_KINDS).not.toContain("training_today");
    expect(SOCIAL_BELL_NOTIFICATION_KINDS).not.toContain("new_story");
    expect(SOCIAL_BELL_NOTIFICATION_KINDS).not.toContain("new_message");
  });

  it("marca como lidas apenas as notificações que aparecem no sino", async () => {
    const { client, query } = createMarkAllReadClientMock();

    await notificationService(client).markAllRead("user-1");

    expect(query.in).toHaveBeenCalledWith("kind", SOCIAL_BELL_NOTIFICATION_KINDS);
  });

  it("mantém menções e marcações como notificações válidas", () => {
    expect(isSocialBellNotificationKind("mention")).toBe(true);
    expect(isSocialBellNotificationKind("post_tag")).toBe(true);
    expect(isSocialBellNotificationKind("story_tag")).toBe(true);
    expect(isSocialBellNotificationKind("training_today")).toBe(false);
  });
});

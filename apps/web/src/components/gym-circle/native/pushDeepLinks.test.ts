import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractPushNotificationData,
  normalizePushNavigationTarget,
} from "./pushDeepLinks";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("push deep links", () => {
  it("opens post comments from gymcircle deep links", () => {
    expect(
      normalizePushNavigationTarget("gymcircle://post/post-1?comments=true"),
    ).toEqual({ postId: "post-1", comments: true });
  });

  it("opens chat from message payloads", () => {
    expect(
      normalizePushNavigationTarget({
        type: "message",
        deep_link: "gymcircle://chat/conversation-1",
      }),
    ).toEqual({ screen: "chat" });
  });

  it("parses web fallback URLs from APNs data", () => {
    vi.stubGlobal("window", {
      location: { origin: "https://gym-circle-rust.vercel.app" },
    });

    expect(normalizePushNavigationTarget("/?post=post-2&comments=1")).toEqual({
      postId: "post-2",
      comments: true,
    });
    expect(normalizePushNavigationTarget("/?tab=chat")).toEqual({
      screen: "chat",
    });
  });

  it("extracts Capacitor action notification data safely", () => {
    expect(
      extractPushNotificationData({
        notification: {
          data: {
            deep_link: "gymcircle://workout",
          },
        },
      }),
    ).toEqual({ deep_link: "gymcircle://workout" });
  });

  it("does not treat reminder target dates as post ids", () => {
    expect(
      normalizePushNavigationTarget({
        type: "daily_activity_reminder",
        target_id: "2026-07-08",
      }),
    ).toEqual({ openWorkout: true });
  });
});

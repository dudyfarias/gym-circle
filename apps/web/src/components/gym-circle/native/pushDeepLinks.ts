"use client";

import type { ScreenKey } from "../BottomNav";

export type PushNavigationTarget = {
  screen?: ScreenKey;
  postId?: string;
  comments?: boolean;
  notifications?: boolean;
  openCreate?: boolean;
  openWorkout?: boolean;
};

type MaybeRecord = Record<string, unknown>;

function asRecord(value: unknown): MaybeRecord | null {
  return value && typeof value === "object"
    ? (value as MaybeRecord)
    : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function boolParam(value: string | null): boolean {
  return value === "1" || value === "true" || value === "yes";
}

export function extractPushNotificationData(action: unknown): MaybeRecord {
  const root = asRecord(action) ?? {};
  const notification = asRecord(root.notification);
  const data = asRecord(root.data) ?? asRecord(notification?.data);
  return data ?? {};
}

export function normalizePushNavigationTarget(
  input: string | MaybeRecord | null | undefined,
): PushNavigationTarget | null {
  if (!input) return null;
  if (typeof input !== "string") {
    const deepLink = firstString(input.deep_link, input.deepLink, input.url);
    const fromLink = normalizePushNavigationTarget(deepLink);
    if (fromLink) return fromLink;

    const type = firstString(input.type, input.kind, input.gymcircle_kind);
    if (type === "message" || type === "new_message") return { screen: "chat" };
    if (type === "daily_activity_reminder") return { openWorkout: true };

    const postId = firstString(
      input.post_id,
      input.postId,
      type?.startsWith("post_") ? input.target_id : null,
    );
    if (postId) {
      return {
        postId,
        comments:
          type === "post_comment" ||
          type === "comment" ||
          type === "comment_reply" ||
          input.comments === true,
      };
    }
    return null;
  }

  const raw = input.trim();
  if (!raw) return null;

  try {
    const url = new URL(
      raw,
      raw.startsWith("/") ? window.location.origin : undefined,
    );
    const protocol = url.protocol.replace(":", "");
    const host = url.hostname;
    const path = url.pathname.replace(/^\/+/, "");
    const firstPath = path.split("/")[0] ?? "";
    const secondPath = path.split("/")[1] ?? "";

    if (protocol === "gymcircle") {
      if (host === "chat" || firstPath === "chat") return { screen: "chat" };
      if (host === "post" || firstPath === "post") {
        const postId = host === "post" ? firstPath : secondPath;
        return {
          postId,
          comments: boolParam(url.searchParams.get("comments")),
        };
      }
      if (host === "create" || firstPath === "create") return { openCreate: true };
      if (host === "workout" || firstPath === "workout") return { openWorkout: true };
      if (host === "notifications" || firstPath === "notifications") {
        return { notifications: true };
      }
      return { screen: "feed" };
    }

    const postId = firstString(
      url.searchParams.get("post"),
      path.startsWith("post/") ? path.split("/")[1] : null,
    );
    if (postId) {
      return {
        postId,
        comments:
          boolParam(url.searchParams.get("comments")) ||
          boolParam(url.searchParams.get("commentsOpen")),
      };
    }
    if (url.searchParams.get("tab") === "chat") return { screen: "chat" };
    if (boolParam(url.searchParams.get("notifications"))) {
      return { notifications: true };
    }
    if (url.searchParams.get("tab") === "post") return { screen: "post" };
    if (url.searchParams.get("tab") === "checkin") return { screen: "checkin" };
  } catch {
    return null;
  }

  return null;
}

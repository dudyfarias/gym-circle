import { describe, expect, it } from "vitest";
import type { NotificationRow } from "@gym-circle/core";
import { collectNotificationActorIds } from "./notificationPresentation";

function notification(id: string, actorId: string | null): NotificationRow {
  return {
    id,
    user_id: "receiver",
    actor_id: actorId ?? "",
    kind: "follow",
    post_id: null,
    comment_id: null,
    story_id: null,
    body: null,
    read_at: null,
    created_at: "2026-08-03T20:00:00.000Z",
  };
}

describe("collectNotificationActorIds", () => {
  it("hidrata todos os autores da primeira carga sem duplicar requests", () => {
    expect(
      collectNotificationActorIds([
        notification("n1", "johnny"),
        notification("n2", "roberto"),
        notification("n3", "johnny"),
        notification("n4", null),
      ]),
    ).toEqual(["johnny", "roberto"]);
  });
});

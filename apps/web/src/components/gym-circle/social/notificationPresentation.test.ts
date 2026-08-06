import { describe, expect, it } from "vitest";
import type { NotificationRow } from "@gym-circle/core";
import { collectNotificationActorIds,
  mergeNotificationActors,
} from "./notificationPresentation";

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

describe("mergeNotificationActors", () => {
  it("o social conhecido vence o esqueleto hidratado", () => {
    const users = { a: { followStatus: "accepted" } };
    const hydrated = { a: { followStatus: "none" } };
    expect(mergeNotificationActors(users, hydrated).a).toEqual({
      followStatus: "accepted",
    });
  });

  it("o hidratado preenche quem o social não conhece", () => {
    const users = { a: { followStatus: "accepted" } };
    const hydrated = { b: { followStatus: "none" } };
    const merged = mergeNotificationActors(users, hydrated);
    expect(Object.keys(merged).sort()).toEqual(["a", "b"]);
    expect(merged.b).toEqual({ followStatus: "none" });
  });
});

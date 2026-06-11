import { describe, expect, it } from "vitest";
import {
  filterKnownChatUsers,
  mergeChatUsers,
  normalizeChatSearchQuery,
} from "./chatSearch";
import { makeEnrichedUser } from "./testFixtures";
import type { EnrichedUser } from "./types";

// Sprint 16 — delega pro fixture compartilhado (testFixtures.ts).
function user(input: Partial<EnrichedUser> & Pick<EnrichedUser, "id" | "username">) {
  return makeEnrichedUser(input);
}

describe("chat search helpers", () => {
  it("normalizes @username searches", () => {
    expect(normalizeChatSearchQuery("  @@Johnny ")).toBe("johnny");
  });

  it("merges users without duplicates, keeping the latest copy", () => {
    const merged = mergeChatUsers(
      [user({ id: "u1", username: "old" })],
      [user({ id: "u1", username: "new" }), user({ id: "u2", username: "dudy" })],
    );

    expect(merged.map((item) => item.username)).toEqual(["new", "dudy"]);
  });

  it("finds chat users from known users by username or display name", () => {
    const results = filterKnownChatUsers(
      [
        user({ id: "me", username: "dudy" }),
        user({ id: "u1", username: "johnny", currentStreak: 11 }),
        user({ id: "u2", username: "runner", name: "Johnny Run", currentStreak: 2 }),
      ],
      "me",
      "john",
    );

    expect(results.map((item) => item.username)).toEqual(["johnny", "runner"]);
  });
});

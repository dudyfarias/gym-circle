import { describe, expect, it } from "vitest";
import {
  filterClientSuggestedFeedPosts,
  interleaveSuggestedFeedPosts,
  SUGGESTED_POST_MAX_AGE_MS,
} from "./suggestedFeed";

const NOW = Date.parse("2026-08-03T18:00:00.000Z");
const recent = (minutesAgo: number) =>
  new Date(NOW - minutesAgo * 60_000).toISOString();
const post = (id: string, minutesAgo: number, userId = `user-${id}`) => ({
  id,
  userId,
  createdAt: recent(minutesAgo),
  label: id,
});

describe("interleaveSuggestedFeedPosts", () => {
  it("places a suggestion as the 11th post", () => {
    const organic = Array.from({ length: 20 }, (_, index) => ({
      kind: "post" as const,
      id: `organic-${index + 1}`,
      createdAt: recent(index),
      post: post(`organic-${index + 1}`, index),
    }));
    const result = interleaveSuggestedFeedPosts(
      organic,
      [post("suggested-1", 2), post("suggested-2", 3)],
      { nowMs: NOW },
    );

    expect(result[10]).toMatchObject({
      kind: "suggested_post",
      id: "suggested-1",
    });
    expect(result[21]).toMatchObject({
      kind: "suggested_post",
      id: "suggested-2",
    });
  });

  it("puts one suggestion after a short recent organic block", () => {
    const organic = Array.from({ length: 4 }, (_, index) => ({
      kind: "post" as const,
      id: `organic-${index}`,
      createdAt: recent(index),
      post: post(`organic-${index}`, index),
    }));
    const result = interleaveSuggestedFeedPosts(
      organic,
      [post("suggested", 1)],
      { nowMs: NOW },
    );
    expect(result.at(-1)).toMatchObject({ kind: "suggested_post" });
  });

  it("builds a small discovery feed when there are no organic posts", () => {
    const suggestions = Array.from({ length: 8 }, (_, index) =>
      post(`suggested-${index}`, index),
    );
    const result = interleaveSuggestedFeedPosts([], suggestions, {
      isNewUser: true,
      nowMs: NOW,
    });
    expect(result).toHaveLength(6);
    expect(result.every((item) => item.kind === "suggested_post")).toBe(true);
  });

  it("rejects posts older than 48 hours and duplicate authors", () => {
    const result = interleaveSuggestedFeedPosts(
      [],
      [
        post("fresh", 1, "same-author"),
        post("duplicate-author", 2, "same-author"),
        {
          ...post("old", 1),
          createdAt: new Date(NOW - SUGGESTED_POST_MAX_AGE_MS - 1).toISOString(),
        },
      ],
      { nowMs: NOW },
    );
    expect(result.map((item) => item.id)).toEqual(["fresh"]);
  });

  it("does not count check-ins or activities toward the 10-post cadence", () => {
    const organic = [
      ...Array.from({ length: 9 }, (_, index) => ({
        kind: "post" as const,
        id: `post-${index}`,
        createdAt: recent(index),
        post: post(`post-${index}`, index),
      })),
      { kind: "checkin" as const, id: "checkin", createdAt: recent(9) },
      { kind: "activity" as const, id: "activity", createdAt: recent(10) },
      {
        kind: "post" as const,
        id: "post-10",
        createdAt: recent(11),
        post: post("post-10", 11),
      },
    ];
    const result = interleaveSuggestedFeedPosts(
      organic,
      [post("suggested", 1)],
      { nowMs: NOW },
    );
    expect(result.at(-1)).toMatchObject({ kind: "suggested_post" });
  });

  it("shows one discovery post for an established user with no recent posts", () => {
    const oldOrganic = [
      {
        kind: "post" as const,
        id: "old-organic",
        createdAt: new Date(
          NOW - SUGGESTED_POST_MAX_AGE_MS - 1,
        ).toISOString(),
        post: post("old-organic", 1),
      },
    ];
    const result = interleaveSuggestedFeedPosts(
      oldOrganic,
      [post("suggested", 1), post("unused", 2)],
      { nowMs: NOW },
    );

    expect(result.map((item) => item.id)).toEqual([
      "suggested",
      "old-organic",
    ]);
  });

  it("removes private, followed, own and stale candidates on the client", () => {
    const candidate = (
      id: string,
      options: {
        isPrivate?: boolean;
        followStatus?: string | null;
        userId?: string;
        createdAt?: string;
      } = {},
    ) => ({
      ...post(id, 1, options.userId),
      createdAt: options.createdAt ?? recent(1),
      author: {
        isPrivate: options.isPrivate ?? false,
        followStatus: options.followStatus ?? "none",
      },
    });

    const result = filterClientSuggestedFeedPosts(
      [
        candidate("allowed"),
        candidate("private", { isPrivate: true }),
        candidate("followed", { followStatus: "accepted" }),
        candidate("own", { userId: "viewer" }),
        candidate("old", {
          createdAt: new Date(
            NOW - SUGGESTED_POST_MAX_AGE_MS - 1,
          ).toISOString(),
        }),
      ],
      "viewer",
      NOW,
    );

    expect(result.map((item) => item.id)).toEqual(["allowed"]);
  });
});

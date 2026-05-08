import { describe, expect, it } from "vitest";
import { getAdjacentStoryId, getStoryForUser, sortStoriesNewestFirst } from "./stories";

const stories = [
  { id: "old", userId: "ana", createdAt: "2026-05-07T12:00:00.000Z" },
  { id: "new", userId: "bia", createdAt: "2026-05-07T18:30:00.000Z" },
  { id: "mid", userId: "caio", createdAt: "2026-05-07T15:00:00.000Z" },
];

describe("story ordering and navigation", () => {
  it("keeps newest stories first", () => {
    expect(sortStoriesNewestFirst(stories).map((story) => story.id)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("returns next and previous stories in the visible order", () => {
    const ordered = sortStoriesNewestFirst(stories);

    expect(getAdjacentStoryId(ordered, "new", 1)).toBe("mid");
    expect(getAdjacentStoryId(ordered, "mid", -1)).toBe("new");
    expect(getAdjacentStoryId(ordered, "old", 1)).toBeNull();
  });

  it("returns the newest visible story for a user", () => {
    const ordered = sortStoriesNewestFirst(stories);

    expect(getStoryForUser(ordered, "bia")?.id).toBe("new");
    expect(getStoryForUser(ordered, "dudy")).toBeNull();
  });
});

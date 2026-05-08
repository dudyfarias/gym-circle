import { describe, expect, it } from "vitest";
import {
  appendStoryLikeOnce,
  buildStoryReplyBody,
  countStoryLikes,
  filterMutedStories,
  formatStoryAge,
  hasUserLikedStory,
} from "./storyInteractions";

describe("story social interactions", () => {
  it("formats story age like Instagram", () => {
    const now = new Date("2026-05-07T21:44:00.000Z");

    expect(formatStoryAge("2026-05-07T21:42:00.000Z", now)).toBe("2 min");
    expect(formatStoryAge("2026-05-07T20:43:00.000Z", now)).toBe("1 h");
    expect(formatStoryAge("2026-05-07T18:00:00.000Z", now)).toBe("3 h");
  });

  it("prevents duplicate story likes by the same user", () => {
    const likes = [{ storyId: "story-1", userId: "user-1" }];

    expect(hasUserLikedStory(likes, "story-1", "user-1")).toBe(true);
    expect(appendStoryLikeOnce(likes, { storyId: "story-1", userId: "user-1" })).toBe(likes);
    expect(countStoryLikes(likes, "story-1")).toBe(1);
  });

  it("filters muted authors from stories", () => {
    expect(
      filterMutedStories(
        [
          { id: "story-1", userId: "maya" },
          { id: "story-2", userId: "rafa" },
        ],
        [{ mutedUserId: "maya" }],
      ).map((story) => story.id),
    ).toEqual(["story-2"]);
  });

  it("trims story replies before sending to direct", () => {
    expect(buildStoryReplyBody("  bora treinar?  ")).toBe("bora treinar?");
  });
});

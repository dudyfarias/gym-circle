import { describe, expect, it } from "vitest";
import {
  getAdjacentStoryId,
  getStoryForUser,
  groupStoriesByProfile,
  sortStoriesNewestFirst,
} from "./stories";
import { makeEnrichedUser } from "./testFixtures";
import type { EnrichedStory, EnrichedUser } from "./types";

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

// Sprint 16 — delega pro fixture compartilhado (testFixtures.ts); o cast
// `as EnrichedUser` antigo escondia campos faltando e gerava o baseline
// de erros de tsc.
function user(id: string, followStatus: EnrichedUser["followStatus"] = "accepted") {
  return makeEnrichedUser({
    id,
    username: id,
    accent: "cyan",
    currentStreak: 1,
    longestStreak: 1,
    lastWorkoutDate: "2026-05-07",
    workoutsThisMonth: 1,
    activeDaysCount: 1,
    isFollowing: followStatus === "accepted",
    followStatus,
    streakLitToday: true,
    streakPresenceSource: "feed-photo",
  });
}

function story(
  id: string,
  author: EnrichedUser,
  createdAt: string,
  viewed = false,
  acceptedParticipants: EnrichedUser[] = [],
) {
  return {
    id,
    userId: author.id,
    imageUrl: `/story-${id}.jpg`,
    mediaType: "image",
    title: "Treino",
    caption: "",
    createdAt,
    viewed,
    likedByCurrentUser: false,
    likesCount: 0,
    kind: "workout",
    author,
    acceptedParticipants,
  } as EnrichedStory;
}

describe("groupStoriesByProfile", () => {
  it("agrupa múltiplos stories do mesmo usuário em uma bolinha", () => {
    const ana = user("ana");
    const groups = groupStoriesByProfile(
      [
        story("ana-2", ana, "2026-05-07T18:00:00.000Z"),
        story("ana-1", ana, "2026-05-07T12:00:00.000Z"),
      ],
      "viewer",
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe("ana");
    expect(groups[0].stories.map((item) => item.id)).toEqual(["ana-1", "ana-2"]);
  });

  it("deixa bolinha ativa quando existe story não visto", () => {
    const ana = user("ana");
    const groups = groupStoriesByProfile(
      [
        story("seen", ana, "2026-05-07T12:00:00.000Z", true),
        story("new", ana, "2026-05-07T18:00:00.000Z", false),
      ],
      "viewer",
    );

    expect(groups[0].viewed).toBe(false);
  });

  it("ordena grupos não vistos antes dos vistos e depois por mais recente", () => {
    const ana = user("ana");
    const bia = user("bia");
    const caio = user("caio");

    const groups = groupStoriesByProfile(
      [
        story("ana", ana, "2026-05-07T20:00:00.000Z", true),
        story("bia", bia, "2026-05-07T10:00:00.000Z", false),
        story("caio", caio, "2026-05-07T18:00:00.000Z", false),
      ],
      "viewer",
    );

    expect(groups.map((group) => group.id)).toEqual(["caio", "bia", "ana"]);
  });

  it("cria grupo para participante aceito", () => {
    const author = user("dudy");
    const tagged = user("edu");

    const groups = groupStoriesByProfile(
      [story("collab", author, "2026-05-07T18:00:00.000Z", false, [tagged])],
      "edu",
    );

    expect(groups.map((group) => group.id)).toContain("edu");
    expect(groups.find((group) => group.id === "edu")?.stories[0].id).toBe("collab");
  });
});

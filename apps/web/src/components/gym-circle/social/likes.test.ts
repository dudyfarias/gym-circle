import { describe, expect, it } from "vitest";
import {
  formatStoryLikesCount,
  getLikesOverlayUsers,
  getPostLikeSummary,
} from "./likes";
import type { EnrichedUser } from "./types";

function createUser(input: Partial<EnrichedUser> & Pick<EnrichedUser, "id" | "username">) {
  return {
    id: input.id,
    name: input.name ?? input.username,
    username: input.username,
    accent: "#30D5FF",
    avatarUrl: null,
    bio: "",
    goal: "",
    location: "",
    gyms: [],
    preferredTimes: [],
    currentStreak: 4,
    longestStreak: 7,
    lastWorkoutDate: "2026-05-13",
    workoutsThisMonth: 5,
    activeDaysCount: 18,
    checkInsCount: 2,
    achievements: [],
    followersCount: 0,
    followingCount: 0,
    isFollowing: false,
    followStatus: "none",
    isPrivate: false,
    workoutDays: [],
    streakLitToday: true,
    streakPresenceSource: "feed-photo",
    ...input,
  } satisfies EnrichedUser;
}

const likedUser = createUser({
  id: "user-like",
  name: "Ana",
  username: "ana.fit",
});
const secondLikedUser = createUser({ id: "user-two", username: "bia.run", name: "Bia" });
const currentUser = createUser({ id: "viewer", username: "dudy", name: "Dudy" });

describe("getLikesOverlayUsers", () => {
  it("shows the full like list only to the post owner", () => {
    expect(
      getLikesOverlayUsers({
        currentUserId: "owner",
        postOwnerId: "owner",
        likedByPreview: [],
        likedByUsers: [likedUser],
      }),
    ).toEqual([likedUser]);

    expect(
      getLikesOverlayUsers({
        currentUserId: "viewer",
        postOwnerId: "owner",
        likedByPreview: [likedUser],
        likedByUsers: [likedUser],
      }),
    ).toEqual([]);
  });
});

describe("getPostLikeSummary", () => {
  it("returns null for 0 likes", () => {
    expect(
      getPostLikeSummary({
        currentUserId: "owner",
        likedByCurrentUser: false,
        likedByPreview: [],
        likesCount: 0,
      }),
    ).toBeNull();
  });

  it("formats 1 like without extra people", () => {
    expect(
      getPostLikeSummary({
        currentUserId: "owner",
        likedByCurrentUser: false,
        likedByPreview: [likedUser],
        likesCount: 1,
      }),
    ).toBe("Curtido por @ana.fit");
  });

  it("formats 2 likes with singular remaining person", () => {
    expect(
      getPostLikeSummary({
        currentUserId: "owner",
        likedByCurrentUser: false,
        likedByPreview: [likedUser, secondLikedUser],
        likesCount: 2,
      }),
    ).toBe("Curtido por @ana.fit e mais 1 pessoa");
  });

  it("formats 3+ likes with plural remaining people", () => {
    expect(
      getPostLikeSummary({
        currentUserId: "owner",
        likedByCurrentUser: false,
        likedByPreview: [likedUser, secondLikedUser],
        likesCount: 3,
      }),
    ).toBe("Curtido por @ana.fit e mais 2 pessoas");
  });

  it("can show current user without changing total count", () => {
    expect(
      getPostLikeSummary({
        currentUserId: currentUser.id,
        likedByCurrentUser: true,
        likedByPreview: [likedUser, currentUser],
        likesCount: 2,
      }),
    ).toBe("Curtido por você e mais 1 pessoa");
  });

  it("does not invent a first liker when preview is empty", () => {
    expect(
      getPostLikeSummary({
        currentUserId: "owner",
        likedByCurrentUser: false,
        likedByPreview: [],
        likesCount: 1,
      }),
    ).toBeNull();
  });
});

describe("formatStoryLikesCount", () => {
  it("formats singular and plural story likes", () => {
    expect(formatStoryLikesCount(0)).toBe("0 curtidas");
    expect(formatStoryLikesCount(1)).toBe("1 curtida");
    expect(formatStoryLikesCount(2)).toBe("2 curtidas");
  });
});

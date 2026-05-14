import { describe, expect, it } from "vitest";
import { getLikesOverlayUsers } from "./likes";
import type { EnrichedUser } from "./types";

const likedUser = {
  id: "user-like",
  name: "Ana",
  username: "ana.fit",
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
} satisfies EnrichedUser;

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

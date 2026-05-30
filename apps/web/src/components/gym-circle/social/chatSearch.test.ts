import { describe, expect, it } from "vitest";
import {
  filterKnownChatUsers,
  mergeChatUsers,
  normalizeChatSearchQuery,
} from "./chatSearch";
import type { EnrichedUser } from "./types";

function user(input: Partial<EnrichedUser> & Pick<EnrichedUser, "id" | "username">) {
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
    currentStreak: input.currentStreak ?? 0,
    longestStreak: 0,
    lastWorkoutDate: "",
    workoutsThisWeek: 0,
    workoutsThisMonth: 0,
    activeDaysCount: 0,
    streakRestoresAvailable: 0,
    checkInsCount: 0,
    achievements: [],
    followersCount: 0,
    followingCount: 0,
    isFollowing: input.isFollowing ?? false,
    followStatus: input.followStatus ?? "none",
    isPrivate: false,
    workoutDays: [],
    streakLitToday: false,
    streakPresenceSource: "none",
  } satisfies EnrichedUser;
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

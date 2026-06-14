import { describe, expect, it } from "vitest";
import type { ProfileRow, StoryRow } from "@gym-circle/core";
import { EMPTY } from "./supabaseSocialConstants";
import {
  buildEnrichedUsers,
  buildStoryItems,
} from "./supabaseSocialSelectors";
import type { AggregateState } from "./supabaseSocialTypes";
import type { EnrichedUser } from "./types";

function makeProfile(overrides: Partial<ProfileRow> & { user_id: string }): ProfileRow {
  return {
    username: overrides.user_id,
    display_name: overrides.user_id,
    avatar_url: null,
    bio: null,
    fitness_goal: null,
    main_gym_id: null,
    preferred_training_times: [],
    is_private: false,
    created_at: "2026-01-01T00:00:00.000Z",
    instagram_username: null,
    birth_date: null,
    sports: [],
    onboarding_completed_at: null,
    profile_completion_notice_dismissed: false,
    alpha_terms_accepted_at: null,
    privacy_policy_accepted_at: null,
    account_status: "active",
    suspended_at: null,
    reactivation_sent_at: null,
    reactivation_expires_at: null,
    deleted_at: null,
    ...overrides,
  } as ProfileRow;
}

function aggWith(overrides: Partial<AggregateState>): AggregateState {
  return { ...EMPTY, ...overrides };
}

describe("buildEnrichedUsers", () => {
  it("exclui usuário bloqueado, mas nunca o próprio", () => {
    const agg = aggWith({
      profiles: [makeProfile({ user_id: "me" }), makeProfile({ user_id: "blocked" })],
    });
    const map = buildEnrichedUsers(agg, "me", new Set(["blocked", "me"]));
    expect(map.has("me")).toBe(true); // self sempre presente
    expect(map.has("blocked")).toBe(false);
  });

  it("exclui conta não-ativa (suspended/deleted) de terceiro", () => {
    const agg = aggWith({
      profiles: [
        makeProfile({ user_id: "me" }),
        makeProfile({ user_id: "susp", account_status: "suspended" }),
      ],
    });
    const map = buildEnrichedUsers(agg, "me", new Set());
    expect(map.has("susp")).toBe(false);
  });

  it("followersCount de terceiro vem do profileExtras quando existe", () => {
    const agg = aggWith({
      profiles: [makeProfile({ user_id: "me" }), makeProfile({ user_id: "other" })],
      profileExtras: {
        other: {
          followersCount: 42,
          followingCount: 7,
          workoutsThisWeek: 3,
          activityDates: ["2026-06-01"],
        },
      },
    });
    const other = buildEnrichedUsers(agg, "me", new Set()).get("other");
    expect(other?.followersCount).toBe(42);
    expect(other?.followingCount).toBe(7);
    expect(other?.workoutsThisWeek).toBe(3);
    expect(other?.workoutDays).toEqual(["2026-06-01"]);
  });

  it("workoutDays do próprio user vem de myActivityDays", () => {
    const agg = aggWith({
      profiles: [makeProfile({ user_id: "me" })],
      myActivityDays: [
        { user_id: "me", activity_date: "2026-06-10" },
        { user_id: "me", activity_date: "2026-06-11" },
      ] as AggregateState["myActivityDays"],
    });
    const me = buildEnrichedUsers(agg, "me", new Set()).get("me");
    expect(me?.workoutDays).toEqual(["2026-06-10", "2026-06-11"]);
    expect(me?.checkInsCount).toBe(2);
  });

  it("followStatus accepted vira isFollowing", () => {
    const agg = aggWith({
      profiles: [makeProfile({ user_id: "me" }), makeProfile({ user_id: "friend" })],
      follows: [
        { follower_id: "me", following_id: "friend", status: "accepted", created_at: "x" },
      ] as AggregateState["follows"],
    });
    const friend = buildEnrichedUsers(agg, "me", new Set()).get("friend");
    expect(friend?.isFollowing).toBe(true);
    expect(friend?.followStatus).toBe("accepted");
  });
});

function makeStory(overrides: Partial<StoryRow> & { id: string; user_id: string }): StoryRow {
  return {
    media_url: "m.jpg",
    media_type: "image",
    gym_id: null,
    workout_type: null,
    expires_at: "2026-06-14T00:00:00.000Z",
    created_at: "2026-06-13T00:00:00.000Z",
    thumbnail_url: null,
    poster_url: null,
    media_width: null,
    media_height: null,
    media_duration_seconds: null,
    blur_data_url: null,
    ...overrides,
  } as StoryRow;
}

function followedAuthor(id: string): EnrichedUser {
  return {
    id,
    name: id,
    username: id,
    currentStreak: 5,
    gyms: ["Gym X"],
    followStatus: "accepted",
    isFollowing: true,
  } as unknown as EnrichedUser;
}

describe("buildStoryItems", () => {
  const enrichedAll = new Map<string, EnrichedUser>([
    ["me", followedAuthor("me")],
    ["friend", followedAuthor("friend")],
  ]);

  it("marca viewed cruzando viewedStoryIds + agg.storyViews", () => {
    const agg = aggWith({
      stories: [
        makeStory({ id: "s1", user_id: "friend" }),
        makeStory({ id: "s2", user_id: "friend" }),
      ],
      storyViews: [
        { story_id: "s2", user_id: "me", viewed_at: "x" },
      ] as AggregateState["storyViews"],
    });
    const items = buildStoryItems({
      agg,
      enrichedAll,
      currentUserId: "me",
      storyParticipantsByStory: new Map(),
      viewedStoryIds: new Set(["s1"]),
    });
    const byId = new Map(items.map((s) => [s.id, s]));
    expect(byId.get("s1")?.viewed).toBe(true); // via viewedStoryIds
    expect(byId.get("s2")?.viewed).toBe(true); // via storyViews
  });

  it("esconde stories de autor silenciado", () => {
    const agg = aggWith({
      stories: [makeStory({ id: "s1", user_id: "friend" })],
      storyMutes: [
        { user_id: "me", muted_user_id: "friend", created_at: "x" },
      ] as AggregateState["storyMutes"],
    });
    const items = buildStoryItems({
      agg,
      enrichedAll,
      currentUserId: "me",
      storyParticipantsByStory: new Map(),
      viewedStoryIds: new Set(),
    });
    expect(items).toHaveLength(0);
  });

  it("esconde story de quem não sigo e não me marcou", () => {
    const agg = aggWith({
      stories: [makeStory({ id: "s1", user_id: "stranger" })],
    });
    const items = buildStoryItems({
      agg,
      enrichedAll: new Map([
        ["me", followedAuthor("me")],
        ["stranger", { ...followedAuthor("stranger"), followStatus: "none", isFollowing: false } as EnrichedUser],
      ]),
      currentUserId: "me",
      storyParticipantsByStory: new Map(),
      viewedStoryIds: new Set(),
    });
    expect(items).toHaveLength(0);
  });
});

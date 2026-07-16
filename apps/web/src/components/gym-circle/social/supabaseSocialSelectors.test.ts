import { describe, expect, it } from "vitest";
import type { ProfileRow, StoryRow } from "@gym-circle/core";
import { EMPTY } from "./supabaseSocialConstants";
import {
  buildChatConversations,
  buildChatMessages,
  buildCurrentUser,
  buildEnrichedUsers,
  buildStoryItems,
  buildSuggestedUsers,
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

  it("não expõe academia principal de perfil privado não seguido", () => {
    const agg = aggWith({
      profiles: [
        makeProfile({ user_id: "me" }),
        makeProfile({ user_id: "private", is_private: true, main_gym_id: "gym-1" }),
      ],
      gyms: [
        {
          id: "gym-1",
          name: "Academia privada",
          address: null,
          city: "São Paulo",
          state: "SP",
          latitude: -23.5,
          longitude: -46.6,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const profile = buildEnrichedUsers(agg, "me", new Set()).get("private");
    expect(profile?.mainGymId).toBeNull();
    expect(profile?.gyms).toEqual([]);
    expect(profile?.location).toBe("");
  });

  it("não usa main_gym_id bruto de terceiros sem a view limitada", () => {
    const agg = aggWith({
      profiles: [
        makeProfile({ user_id: "me" }),
        makeProfile({ user_id: "public", main_gym_id: "gym-1" }),
      ],
      gyms: [
        {
          id: "gym-1",
          name: "Academia sem surface",
          address: null,
          city: "São Paulo",
          state: "SP",
          latitude: -23.5,
          longitude: -46.6,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const profile = buildEnrichedUsers(agg, "me", new Set()).get("public");
    expect(profile?.mainGymId).toBeNull();
    expect(profile?.gyms).toEqual([]);
  });

  it("mostra somente a academia principal quando o perfil é visível", () => {
    const agg = aggWith({
      profiles: [
        makeProfile({ user_id: "me" }),
        makeProfile({ user_id: "public", main_gym_id: "gym-1" }),
      ],
      gyms: [
        {
          id: "gym-1",
          name: "Academia pública",
          address: null,
          city: "São Paulo",
          state: "SP",
          latitude: -23.5,
          longitude: -46.6,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      userGyms: [
        {
          id: "visible:public:gym-1",
          user_id: "public",
          gym_id: "gym-1",
          is_main: true,
          preferred_days: [],
          preferred_times: [],
          created_at: "1970-01-01T00:00:00.000Z",
        },
      ],
    });

    const profile = buildEnrichedUsers(agg, "me", new Set()).get("public");
    expect(profile?.mainGymId).toBe("gym-1");
    expect(profile?.gyms).toEqual(["Academia pública"]);
  });

  it("mostra academia principal de perfil privado para follower aceito", () => {
    const gym = {
      id: "gym-1",
      name: "Academia seguida",
      address: null,
      city: "Osasco",
      state: "SP",
      latitude: -23.5,
      longitude: -46.7,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const agg = aggWith({
      profiles: [
        makeProfile({ user_id: "me" }),
        makeProfile({ user_id: "friend", is_private: true, main_gym_id: gym.id }),
      ],
      follows: [
        { follower_id: "me", following_id: "friend", status: "accepted", created_at: "x" },
      ] as AggregateState["follows"],
      gyms: [gym],
      userGyms: [
        {
          id: `visible:friend:${gym.id}`,
          user_id: "friend",
          gym_id: gym.id,
          is_main: true,
          preferred_days: [],
          preferred_times: [],
          created_at: "1970-01-01T00:00:00.000Z",
        },
      ],
    });

    const profile = buildEnrichedUsers(agg, "me", new Set()).get("friend");
    expect(profile?.mainGymId).toBe(gym.id);
    expect(profile?.gyms).toEqual([gym.name]);
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

describe("buildCurrentUser", () => {
  it("retorna o user do mapa quando existe", () => {
    const me = followedAuthor("me");
    const map = new Map<string, EnrichedUser>([["me", me]]);
    expect(buildCurrentUser(map, "me")).toBe(me);
  });
  it("cai no fallback vazio quando ainda não hidratou", () => {
    const fallback = buildCurrentUser(new Map(), "me");
    expect(fallback.id).toBe("me");
    expect(fallback.name).toBe("—");
    expect(fallback.streakRestoresAvailable).toBe(3);
  });
});

describe("buildSuggestedUsers", () => {
  const enrichedAll = new Map<string, EnrichedUser>([
    ["me", followedAuthor("me")],
    ["a", followedAuthor("a")],
    ["b", followedAuthor("b")],
  ]);

  it("usa os IDs do RPC quando fornecidos (preserva ordem, ignora inexistente)", () => {
    const out = buildSuggestedUsers({
      suggestedUserIds: ["b", "a", "ghost"],
      enrichedAll,
      currentUser: followedAuthor("me"),
      currentUserId: "me",
    });
    expect(out.map((u) => u.id)).toEqual(["b", "a"]);
  });

  it("sem IDs do RPC, ranqueia client-side e exclui o próprio user", () => {
    const out = buildSuggestedUsers({
      suggestedUserIds: [],
      enrichedAll,
      currentUser: followedAuthor("me"),
      currentUserId: "me",
    });
    expect(out.every((u) => u.id !== "me")).toBe(true);
    expect(out).toHaveLength(2);
  });
});

// buildChatMessages recebe a ROW crua (DirectMessageRow, snake_case) e mapeia
// pro modelo de domínio ChatMessage.
function makeDirectRow(
  overrides: { id: string; sender_id: string; created_at?: string },
): AggregateState["chatMessages"][number] {
  return {
    id: overrides.id,
    conversation_id: "c1",
    sender_id: overrides.sender_id,
    receiver_id: null,
    body: "oi",
    media_url: null,
    thumbnail_url: null,
    poster_url: null,
    media_width: null,
    media_height: null,
    media_duration_seconds: null,
    blur_data_url: null,
    media_type: null,
    story_id: null,
    reply_to_story: false,
    story_preview_url: null,
    created_at: overrides.created_at ?? "2026-06-13T10:00:00.000Z",
    read_at: null,
  } as AggregateState["chatMessages"][number];
}

describe("buildChatMessages", () => {
  it("esconde mensagens de/para usuário bloqueado", () => {
    const out = buildChatMessages({
      chatMessages: [
        makeDirectRow({ id: "m1", sender_id: "blocked" }),
        makeDirectRow({ id: "m2", sender_id: "friend" }),
      ],
      conversationParticipants: [],
      blockedSet: new Set(["blocked"]),
      currentUserId: "me",
    });
    expect(out.map((m) => m.id)).toEqual(["m2"]);
  });

  it("esconde mensagens anteriores ao 'apagar pra mim'", () => {
    const out = buildChatMessages({
      chatMessages: [
        makeDirectRow({ id: "old", sender_id: "friend", created_at: "2026-06-13T09:00:00.000Z" }),
        makeDirectRow({ id: "new", sender_id: "friend", created_at: "2026-06-13T11:00:00.000Z" }),
      ],
      conversationParticipants: [
        {
          conversation_id: "c1",
          user_id: "me",
          deleted_at: "2026-06-13T10:00:00.000Z",
          role: "member",
          last_read_at: null,
        },
      ] as AggregateState["conversationParticipants"],
      blockedSet: new Set(),
      currentUserId: "me",
    });
    expect(out.map((m) => m.id)).toEqual(["new"]);
  });
});

describe("buildChatConversations", () => {
  it("exclui conversa apagada sem mensagem nova depois do delete", () => {
    const out = buildChatConversations({
      conversations: [
        { id: "c1", type: "direct", name: null, image_url: null, last_message_at: null },
      ] as AggregateState["conversations"],
      conversationParticipants: [
        {
          conversation_id: "c1",
          user_id: "me",
          deleted_at: "2026-06-13T12:00:00.000Z",
          role: "member",
          last_read_at: null,
        },
      ] as AggregateState["conversationParticipants"],
      conversationUnreadCounts: {},
      chatMessages: [],
      currentUserId: "me",
    });
    expect(out).toHaveLength(0);
  });

  it("inclui conversa viva com unread count", () => {
    const out = buildChatConversations({
      conversations: [
        { id: "c1", type: "group", name: "Grupo", image_url: null, last_message_at: "x" },
      ] as AggregateState["conversations"],
      conversationParticipants: [
        { conversation_id: "c1", user_id: "me", deleted_at: null, role: "member", last_read_at: null },
        { conversation_id: "c1", user_id: "friend", deleted_at: null, role: "member", last_read_at: null },
      ] as AggregateState["conversationParticipants"],
      conversationUnreadCounts: { c1: 4 },
      chatMessages: [],
      currentUserId: "me",
    });
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("group");
    expect(out[0].unreadCount).toBe(4);
    expect(out[0].memberIds).toEqual(["me", "friend"]);
  });
});

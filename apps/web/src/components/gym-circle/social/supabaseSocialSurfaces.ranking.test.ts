import { describe, expect, it, vi } from "vitest";
import {
  filterCircleRankingRows,
  normalizeCircleRankingRows,
  queryCircleRankingSurface,
} from "./supabaseSocialSurfaces";
import type { GymCircleSupabaseClient } from "./supabaseSocialTypes";

describe("circle ranking surface", () => {
  it("normalizes snake_case rows returned by the Supabase RPC", () => {
    expect(
      normalizeCircleRankingRows([
        {
          user_id: "user-1",
          username: "dudy",
          display_name: "Dudy",
          avatar_url: "https://example.com/avatar.jpg",
          current_streak: 2,
          badge_is_active_today: false,
          workout_days: 4,
          achievement_points: 3,
          total_points: 43,
          rank: 1,
        },
      ]),
    ).toEqual([
      {
        user_id: "user-1",
        username: "dudy",
        display_name: "Dudy",
        avatar_url: "https://example.com/avatar.jpg",
        current_streak: 2,
        badge_is_active_today: false,
        workout_days: 4,
        achievement_points: 3,
        total_points: 43,
        rank: 1,
      },
    ]);
  });

  it("normalizes camelCase rows defensively for cross-surface parity", () => {
    expect(
      normalizeCircleRankingRows([
        {
          userId: "user-2",
          username: "johnny",
          displayName: "Johnny",
          avatarUrl: null,
          currentStreak: "166",
          badgeIsActiveToday: "false",
          workoutDays: "1",
          achievementPoints: "2",
          totalPoints: "12",
          rank: "2",
        },
      ]),
    ).toMatchObject([
      {
        user_id: "user-2",
        display_name: "Johnny",
        current_streak: 166,
        badge_is_active_today: false,
        workout_days: 1,
        achievement_points: 2,
        total_points: 12,
        rank: 2,
      },
    ]);
  });

  it("returns an empty ranking instead of throwing when the RPC call rejects", async () => {
    const client = {
      rpc: vi.fn().mockRejectedValue(new Error("network down")),
    } as unknown as GymCircleSupabaseClient;

    const result = await queryCircleRankingSurface(client, "circle", "week");

    expect(result.data).toEqual([]);
    expect(result.error).toBeInstanceOf(Error);
  });

  it("filters and reranks global rows for the circle fallback", () => {
    const rows = filterCircleRankingRows(
      [
        rankingRow({ user_id: "stranger", total_points: 999, rank: 1 }),
        rankingRow({ user_id: "me", username: "dudy", total_points: 10, rank: 2 }),
        rankingRow({
          user_id: "friend",
          username: "johnny",
          total_points: 40,
          current_streak: 4,
          rank: 3,
        }),
      ],
      "me",
      ["friend"],
    );

    expect(rows.map((row) => [row.user_id, row.rank])).toEqual([
      ["friend", 1],
      ["me", 2],
    ]);
  });
});

function rankingRow(
  overrides: Partial<ReturnType<typeof normalizeCircleRankingRows>[number]>,
): ReturnType<typeof normalizeCircleRankingRows>[number] {
  return {
    user_id: "user",
    username: null,
    display_name: null,
    avatar_url: null,
    current_streak: 0,
    badge_is_active_today: false,
    workout_days: 0,
    achievement_points: 0,
    total_points: 0,
    rank: null,
    ...overrides,
  };
}

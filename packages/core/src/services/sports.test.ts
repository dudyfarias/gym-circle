import { describe, expect, it, vi } from "vitest";
import type { GymCircleClient } from "./supabase";
import { sportService } from "./sports";

describe("sportService", () => {
  it("derives usage/recency and loads only valid favorites", async () => {
    const preferencesResult = {
      data: [
        { sport_id: "tennis", is_favorite: true },
        { sport_id: "unknown-provider-type", is_favorite: true },
      ],
      error: null,
    };
    const activitiesResult = {
      data: [
        { activity_type: "run", started_at: "2026-07-22T12:00:00Z" },
        { activity_type: "run", started_at: "2026-07-20T12:00:00Z" },
        { activity_type: "pilates", started_at: "2026-07-21T12:00:00Z" },
        { activity_type: "legacy-value", started_at: "2026-07-19T12:00:00Z" },
      ],
      error: null,
    };
    const from = vi.fn((table: string) => {
      if (table === "user_sport_preferences") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve(preferencesResult),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve(activitiesResult),
            }),
          }),
        }),
      };
    });

    const result = await sportService({
      from,
    } as unknown as GymCircleClient).personalization("user-1");

    expect(result.favoriteSportIds).toEqual(["tennis"]);
    expect(result.usageCountBySport).toEqual({
      run: 2,
      pilates: 1,
      other: 1,
    });
    expect(result.lastUsedAtBySport).toEqual({
      run: "2026-07-22T12:00:00Z",
      pilates: "2026-07-21T12:00:00Z",
      other: "2026-07-19T12:00:00Z",
    });
  });

  it("persists and removes favorites only for the current user", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const deleteResult = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({
      upsert,
      delete: () => ({
        eq: () => ({
          eq: deleteResult,
        }),
      }),
    }));
    const service = sportService({ from } as unknown as GymCircleClient);

    await service.setFavorite("user-1", "tennis", true);
    await service.setFavorite("user-1", "tennis", false);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        sport_id: "tennis",
        is_favorite: true,
      }),
      { onConflict: "user_id,sport_id" },
    );
    expect(deleteResult).toHaveBeenCalledWith("sport_id", "tennis");
  });
});

import { describe, expect, it, vi } from "vitest";
import { storyService } from "./stories";
import type { GymCircleClient } from "./supabase";

describe("storyService social tables", () => {
  it("keeps story likes optimistic when the production schema has not exposed story_likes yet", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST205",
        message: "Could not find the table 'public.story_likes' in the schema cache",
      },
    });
    const client = {
      from: vi.fn(() => ({
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({ maybeSingle })),
        })),
      })),
    } as unknown as GymCircleClient;

    const result = await storyService(client).like("story-1", "user-1");

    expect(result).toMatchObject({
      story_id: "story-1",
      user_id: "user-1",
    });
  });

  it("keeps story mute optimistic when the production schema has not exposed story_mutes yet", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST205",
        message: "Could not find the table 'public.story_mutes' in the schema cache",
      },
    });
    const client = {
      from: vi.fn(() => ({
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({ maybeSingle })),
        })),
      })),
    } as unknown as GymCircleClient;

    const result = await storyService(client).mute("user-1", "user-2");

    expect(result).toMatchObject({
      user_id: "user-1",
      muted_user_id: "user-2",
    });
  });

  it("keeps story viewed optimistic when the production schema has not exposed story_views yet", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST205",
        message: "Could not find the table 'public.story_views' in the schema cache",
      },
    });
    const client = {
      from: vi.fn(() => ({
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({ maybeSingle })),
        })),
      })),
    } as unknown as GymCircleClient;

    const result = await storyService(client).markViewed("story-1", "user-1");

    expect(result).toMatchObject({
      story_id: "story-1",
      user_id: "user-1",
    });
  });
});

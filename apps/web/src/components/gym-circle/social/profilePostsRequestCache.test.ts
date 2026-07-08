import { describe, expect, it, vi } from "vitest";
import {
  createProfilePostsRequestCache,
  profilePostsRequestKey,
} from "./profilePostsRequestCache";

const key = {
  cursorCreatedAt: null,
  limit: 15,
  userId: "user-1",
};

describe("profile posts request cache", () => {
  it("dedupes simultaneous identical requests", async () => {
    let now = 1_000;
    const cache = createProfilePostsRequestCache<string[]>({
      now: () => now,
      ttlMs: 60_000,
    });
    const fetcher = vi.fn(async () => ["post-1"]);

    const first = cache.getOrFetch(key, fetcher);
    const second = cache.getOrFetch(key, fetcher);

    await expect(first).resolves.toEqual(["post-1"]);
    await expect(second).resolves.toEqual(["post-1"]);
    expect(fetcher).toHaveBeenCalledTimes(1);

    now += 10_000;
    await expect(cache.getOrFetch(key, fetcher)).resolves.toEqual(["post-1"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refetches after TTL expires", async () => {
    let now = 1_000;
    const cache = createProfilePostsRequestCache<string[]>({
      now: () => now,
      ttlMs: 60_000,
    });
    const fetcher = vi
      .fn<() => Promise<string[]>>()
      .mockResolvedValueOnce(["post-1"])
      .mockResolvedValueOnce(["post-2"]);

    await expect(cache.getOrFetch(key, fetcher)).resolves.toEqual(["post-1"]);
    now += 60_001;
    await expect(cache.getOrFetch(key, fetcher)).resolves.toEqual(["post-2"]);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("supports force refresh without reusing an in-flight request", async () => {
    const cache = createProfilePostsRequestCache<string[]>({
      now: () => 1_000,
      ttlMs: 60_000,
    });
    const fetcher = vi
      .fn<() => Promise<string[]>>()
      .mockResolvedValueOnce(["stale"])
      .mockResolvedValueOnce(["fresh"]);

    await expect(cache.getOrFetch(key, fetcher)).resolves.toEqual(["stale"]);
    await expect(cache.getOrFetch(key, fetcher, { force: true })).resolves.toEqual([
      "fresh",
    ]);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("invalidates every cursor page for one user only", async () => {
    const cache = createProfilePostsRequestCache<string[]>({
      now: () => 1_000,
      ttlMs: 60_000,
    });
    const fetcher = vi.fn(async () => ["cached"]);

    await cache.getOrFetch(key, fetcher);
    await cache.getOrFetch({ ...key, cursorCreatedAt: "2026-07-01" }, fetcher);
    await cache.getOrFetch({ ...key, userId: "user-2" }, fetcher);
    expect(cache.size).toBe(3);

    cache.invalidateUser("user-1");

    expect(cache.size).toBe(1);
  });

  it("uses user, cursor and limit as the cache key", () => {
    expect(profilePostsRequestKey(key)).toBe("user-1:initial:15");
    expect(
      profilePostsRequestKey({
        cursorCreatedAt: "2026-07-01T00:00:00Z",
        limit: 30,
        userId: "user-1",
      }),
    ).toBe("user-1:2026-07-01T00:00:00Z:30");
  });
});

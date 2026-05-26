import { describe, expect, it } from "vitest";
import { LruCache } from "./lruCache";

describe("LruCache", () => {
  it("respects capacity", () => {
    const lru = new LruCache<string>(2);
    lru.add("a"); lru.add("b"); lru.add("c");
    expect(lru.has("a")).toBe(false);
    expect(lru.has("b")).toBe(true);
    expect(lru.has("c")).toBe(true);
  });

  it("moves accessed entries to front", () => {
    const lru = new LruCache<string>(2);
    lru.add("a"); lru.add("b"); lru.touch("a"); lru.add("c");
    expect(lru.has("a")).toBe(true);
    expect(lru.has("b")).toBe(false);
    expect(lru.has("c")).toBe(true);
  });

  it("pin-protect: pinned entries never evicted", () => {
    const lru = new LruCache<string>(2);
    lru.add("a"); lru.pin("a"); lru.add("b"); lru.add("c");
    expect(lru.has("a")).toBe(true);
    expect(lru.has("b")).toBe(false);
    expect(lru.has("c")).toBe(true);
  });

  it("unpin permite eviction normal", () => {
    const lru = new LruCache<string>(2);
    lru.add("a"); lru.pin("a"); lru.add("b"); lru.unpin("a"); lru.add("c");
    expect(lru.has("a")).toBe(false);
    expect(lru.has("b")).toBe(true);
    expect(lru.has("c")).toBe(true);
  });

  it("clear remove tudo (incluindo pinned)", () => {
    const lru = new LruCache<string>(2);
    lru.add("a"); lru.pin("a"); lru.clear();
    expect(lru.has("a")).toBe(false);
    expect(lru.size()).toBe(0);
  });
});

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

  it("all-pinned overflow: cache aceita size > capacity temporariamente", () => {
    const lru = new LruCache<string>(2);
    lru.add("a"); lru.pin("a");
    lru.add("b"); lru.pin("b");
    lru.add("c"); // can't evict — all pinned. Overflow OK.
    expect(lru.has("a")).toBe(true);
    expect(lru.has("b")).toBe(true);
    expect(lru.has("c")).toBe(true);
    expect(lru.size()).toBe(3);
  });

  it("delete em entry pinned limpa ambos os maps", () => {
    const lru = new LruCache<string>(2);
    lru.add("a"); lru.pin("a");
    lru.delete("a");
    expect(lru.has("a")).toBe(false);
    // After delete, pin status is also cleared — re-add + check eviction works
    lru.add("a"); lru.add("b"); lru.add("c");
    expect(lru.has("a")).toBe(false); // not pinned anymore, evicted
  });

  it("add de value existente nao dispara eviction (touch behavior)", () => {
    const lru = new LruCache<string>(2);
    lru.add("a"); lru.add("b");
    lru.add("a"); // re-add — should touch, not evict
    expect(lru.size()).toBe(2);
    expect(lru.has("a")).toBe(true);
    expect(lru.has("b")).toBe(true);
  });

  it("pin em value nao-existente eh silent no-op", () => {
    const lru = new LruCache<string>(2);
    lru.pin("never-added"); // should not throw, should not add
    expect(lru.has("never-added")).toBe(false);
    expect(lru.size()).toBe(0);
  });
});

/**
 * LruCache — Sprint 1 v1.1.1.
 * Map-based LRU com pin-protect. Map preserva ordem de inserção;
 * delete+set move pra "mais recente". Pinned nunca evicted.
 */
export class LruCache<T> {
  private readonly capacity: number;
  private readonly order: Map<T, true>;
  private readonly pinned: Set<T>;

  constructor(capacity: number) {
    if (capacity < 1) throw new Error("LruCache capacity must be >= 1");
    this.capacity = capacity;
    this.order = new Map();
    this.pinned = new Set();
  }

  add(value: T): void {
    if (this.order.has(value)) { this.touch(value); return; }
    this.order.set(value, true);
    this.evictIfNeeded();
  }

  touch(value: T): void {
    if (!this.order.has(value)) return;
    this.order.delete(value);
    this.order.set(value, true);
  }

  has(value: T): boolean { return this.order.has(value); }

  pin(value: T): void {
    if (!this.order.has(value)) return;
    this.pinned.add(value);
  }

  unpin(value: T): void { this.pinned.delete(value); }

  delete(value: T): void {
    this.order.delete(value);
    this.pinned.delete(value);
  }

  size(): number { return this.order.size; }

  clear(): void {
    this.order.clear();
    this.pinned.clear();
  }

  private evictIfNeeded(): void {
    while (this.order.size > this.capacity) {
      const oldest = this.findOldestUnpinned();
      if (oldest === undefined) break; // all pinned — overflow temporário
      this.order.delete(oldest);
    }
  }

  private findOldestUnpinned(): T | undefined {
    for (const value of this.order.keys()) {
      if (!this.pinned.has(value)) return value;
    }
    return undefined;
  }
}

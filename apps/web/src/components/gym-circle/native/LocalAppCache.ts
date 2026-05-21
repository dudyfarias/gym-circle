"use client";

export type NativeCacheEnvelope<T> = {
  value: T;
  storedAt: number;
  expiresAt: number;
};

export type StorageLike = Pick<
  Storage,
  "getItem" | "key" | "length" | "removeItem" | "setItem"
>;

export const nativeCacheTtl = {
  feedMs: 5 * 60 * 1000,
  storyTrayMs: 2 * 60 * 1000,
  ownProfileMs: 10 * 60 * 1000,
  mediaReferenceMs: 24 * 60 * 60 * 1000,
};

export const nativeCacheKeys = {
  home: (userId: string) => `gym-circle.native.home.v1.${userId}`,
  storyTray: (userId: string) => `gym-circle.native.story-tray.v1.${userId}`,
  ownProfile: (userId: string) => `gym-circle.native.own-profile.v1.${userId}`,
  mediaReference: (url: string) => `gym-circle.native.media-ref.v1.${url}`,
};

function getDefaultStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readNativeCache<T>(
  key: string,
  options: { now?: number; storage?: StorageLike | null } = {},
): T | null {
  const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
  if (!storage) return null;

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NativeCacheEnvelope<T>;
    const now = options.now ?? Date.now();
    if (!parsed || typeof parsed.expiresAt !== "number" || parsed.expiresAt <= now) {
      storage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function writeNativeCache<T>(
  key: string,
  value: T,
  ttlMs: number,
  options: { now?: number; storage?: StorageLike | null } = {},
) {
  const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
  if (!storage) return;

  try {
    const now = options.now ?? Date.now();
    const envelope: NativeCacheEnvelope<T> = {
      value,
      storedAt: now,
      expiresAt: now + ttlMs,
    };
    storage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Cache é percepção, não fonte de verdade.
  }
}

export function removeNativeCache(
  key: string,
  options: { storage?: StorageLike | null } = {},
) {
  const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
  try {
    storage?.removeItem(key);
  } catch {
    // ignore
  }
}

export function clearNativeFeelCaches(options: { storage?: StorageLike | null } = {}) {
  const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith("gym-circle.native.")) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // ignore
  }
}

export type ProfilePostsRequestKey = {
  cursorCreatedAt: string | null;
  limit: number;
  userId: string;
};

type CacheEntry<T> = {
  expiresAt: number;
  promise?: Promise<T>;
  value?: T;
};

type ProfilePostsRequestCacheOptions = {
  now?: () => number;
  ttlMs: number;
};

type GetOrFetchOptions = {
  force?: boolean;
};

export function profilePostsRequestKey({
  cursorCreatedAt,
  limit,
  userId,
}: ProfilePostsRequestKey) {
  return `${userId}:${cursorCreatedAt ?? "initial"}:${limit}`;
}

export function createProfilePostsRequestCache<T>({
  now = () => Date.now(),
  ttlMs,
}: ProfilePostsRequestCacheOptions) {
  const entries = new Map<string, CacheEntry<T>>();

  return {
    clear() {
      entries.clear();
    },
    get size() {
      return entries.size;
    },
    getOrFetch(
      key: ProfilePostsRequestKey,
      fetcher: () => Promise<T>,
      options: GetOrFetchOptions = {},
    ) {
      const cacheKey = profilePostsRequestKey(key);
      const current = entries.get(cacheKey);
      const timestamp = now();

      if (!options.force && current?.value !== undefined && current.expiresAt > timestamp) {
        return Promise.resolve(current.value);
      }

      if (!options.force && current?.promise) {
        return current.promise;
      }

      const promise = fetcher()
        .then((value) => {
          entries.set(cacheKey, {
            expiresAt: now() + ttlMs,
            value,
          });
          return value;
        })
        .catch((error) => {
          entries.delete(cacheKey);
          throw error;
        });

      entries.set(cacheKey, {
        expiresAt: timestamp + ttlMs,
        promise,
        value: options.force ? undefined : current?.value,
      });

      return promise;
    },
    invalidateUser(userId: string) {
      for (const key of entries.keys()) {
        if (key.startsWith(`${userId}:`)) {
          entries.delete(key);
        }
      }
    },
  };
}

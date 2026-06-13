import type { ProfileRow } from "@gym-circle/core";
import {
  nativeCacheKeys,
  nativeCacheTtl,
  readNativeCache,
  writeNativeCache,
} from "../native/LocalAppCache";
import { mergeProfileRows } from "./profileRows";
import { EMPTY } from "./supabaseSocialConstants";
import { mergeRowsByKey } from "./supabaseSocialMappers";
import type {
  AggregateState,
  HomeNativeCache,
  StoryTrayNativeCache,
} from "./supabaseSocialTypes";

/**
 * Cache nativo + storage de browser do useSupabaseSocial — extraídos do hook
 * na Sprint 21.4. Hidratação instantânea do home/story-tray a partir do cache
 * local (warm start nativo) + persistência de "stories vistas" no localStorage
 * (fail-soft em Safari Private Mode) + util de redirect de reativação.
 */

const VIEWED_STORIES_STORAGE_PREFIX = "gym-circle:viewed-stories:";
const MAX_STORED_VIEWED_STORIES = 500;

export function loadNativeHomeCache(userId: string): AggregateState {
  const cachedHome = readNativeCache<HomeNativeCache>(nativeCacheKeys.home(userId));
  const cachedStoryTray = readNativeCache<StoryTrayNativeCache>(
    nativeCacheKeys.storyTray(userId),
  );
  const cachedOwnProfile = readNativeCache<ProfileRow>(
    nativeCacheKeys.ownProfile(userId),
  );
  if (!cachedHome && !cachedStoryTray && !cachedOwnProfile) return EMPTY;
  return {
    ...EMPTY,
    ...(cachedHome ?? {}),
    ...(cachedStoryTray ?? {}),
    profiles: mergeProfileRows(
      mergeProfileRows(cachedHome?.profiles ?? [], cachedStoryTray?.profiles ?? []),
      cachedOwnProfile ? [cachedOwnProfile] : [],
    ),
    stats: mergeRowsByKey(
      cachedHome?.stats ?? [],
      cachedStoryTray?.stats ?? [],
      (stats) => stats.user_id,
    ),
  };
}

export function writeNativeHomeCache(userId: string, state: HomeNativeCache) {
  writeNativeCache(nativeCacheKeys.home(userId), state, nativeCacheTtl.feedMs);
}

export function writeNativeStoryTrayCache(
  userId: string,
  state: StoryTrayNativeCache,
) {
  writeNativeCache(nativeCacheKeys.storyTray(userId), state, nativeCacheTtl.storyTrayMs);
}

export function writeNativeOwnProfileCache(userId: string, profile: ProfileRow) {
  writeNativeCache(
    nativeCacheKeys.ownProfile(userId),
    profile,
    nativeCacheTtl.ownProfileMs,
  );
}

export function getViewedStoriesStorageKey(userId: string) {
  return `${VIEWED_STORIES_STORAGE_PREFIX}${userId}`;
}

export function loadStoredViewedStoryIds(userId: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(getViewedStoriesStorageKey(userId)) ?? "[]",
    );
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

export function persistStoredViewedStoryIds(userId: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  const compact = Array.from(ids).slice(-MAX_STORED_VIEWED_STORIES);
  // iOS Safari Private Mode + alguns ad blockers throwam em
  // localStorage.setItem. Não é crítico — perdemos persistência de
  // "stories vistos" entre sessões, mas o app continua funcionando.
  // Servidor já tem story_views como fonte de verdade.
  try {
    window.localStorage.setItem(
      getViewedStoriesStorageKey(userId),
      JSON.stringify(compact),
    );
  } catch {
    // ignorar — fail-soft
  }
}

export function buildReactivationRedirectUrl(token: string) {
  if (typeof window === "undefined") return undefined;
  const url = new URL("/reactivate-account", window.location.origin);
  url.searchParams.set("token", token);
  return url.toString();
}

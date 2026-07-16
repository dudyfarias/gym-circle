export const EXTERNAL_PLACE_SEARCH_MIN_LENGTH = 3;
export const EXTERNAL_PLACE_SEARCH_CLIENT_COOLDOWN_MS = 2_000;
export const EXTERNAL_PLACE_SEARCH_CACHE_TTL_MS = 60_000;

export function normalizeExternalPlaceSearchQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function canRunExternalPlaceSearch(query: string): boolean {
  return query.trim().length >= EXTERNAL_PLACE_SEARCH_MIN_LENGTH;
}

export function getExternalPlaceSearchCooldownMs(
  lastRequestAt: number,
  now = Date.now(),
): number {
  return Math.max(
    0,
    EXTERNAL_PLACE_SEARCH_CLIENT_COOLDOWN_MS - (now - lastRequestAt),
  );
}

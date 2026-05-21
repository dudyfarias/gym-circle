import type { EnrichedUser } from "./types";

export function normalizeChatSearchQuery(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function mergeChatUsers(...groups: Array<ReadonlyArray<EnrichedUser | null | undefined>>) {
  const map = new Map<string, EnrichedUser>();
  for (const group of groups) {
    for (const user of group) {
      if (!user) continue;
      map.set(user.id, user);
    }
  }
  return Array.from(map.values());
}

export function filterKnownChatUsers(
  users: ReadonlyArray<EnrichedUser>,
  currentUserId: string,
  query: string,
) {
  if (!query) return [];
  return users
    .filter((user) => user.id !== currentUserId)
    .filter((user) => {
      const username = user.username.toLowerCase();
      const name = user.name.toLowerCase();
      return username.includes(query) || name.includes(query);
    })
    .sort((a, b) => {
      const aUsername = a.username.toLowerCase();
      const bUsername = b.username.toLowerCase();
      const aStarts = aUsername.startsWith(query) ? 1 : 0;
      const bStarts = bUsername.startsWith(query) ? 1 : 0;
      return bStarts - aStarts || b.currentStreak - a.currentStreak;
    })
    .slice(0, 12);
}

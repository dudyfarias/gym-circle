import type { EnrichedUser } from "./types";

export function getLikesOverlayUsers(input: {
  currentUserId: string;
  likedByPreview: EnrichedUser[];
  likedByUsers?: EnrichedUser[];
  postOwnerId: string;
}): EnrichedUser[] {
  if (input.currentUserId !== input.postOwnerId) return [];
  return input.likedByUsers?.length ? input.likedByUsers : input.likedByPreview;
}

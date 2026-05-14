import type { EnrichedUser } from "./types";

type PostLikeSummaryInput = {
  currentUserId: string;
  likedByCurrentUser: boolean;
  likedByPreview: EnrichedUser[];
  likedByUsers?: EnrichedUser[];
  likesCount: number;
};

export function getLikesOverlayUsers(input: {
  currentUserId: string;
  likedByPreview: EnrichedUser[];
  likedByUsers?: EnrichedUser[];
  postOwnerId: string;
}): EnrichedUser[] {
  if (input.currentUserId !== input.postOwnerId) return [];
  return input.likedByUsers?.length ? input.likedByUsers : input.likedByPreview;
}

export function getPostLikeSummary(input: PostLikeSummaryInput): string | null {
  if (input.likesCount <= 0) return null;

  const allKnownLikes = input.likedByUsers?.length
    ? input.likedByUsers
    : input.likedByPreview;
  const firstUser =
    allKnownLikes.find((user) => user.id === input.currentUserId) ??
    allKnownLikes[0] ??
    null;
  const firstLabel =
    firstUser?.id === input.currentUserId && input.likedByCurrentUser
      ? "você"
      : firstUser
        ? `@${firstUser.username}`
        : input.likedByCurrentUser
          ? "você"
          : null;

  if (!firstLabel) return null;

  const remainingLikes = Math.max(0, input.likesCount - 1);
  if (remainingLikes === 0) return `Curtido por ${firstLabel}`;
  return `Curtido por ${firstLabel} e mais ${remainingLikes.toLocaleString("pt-BR")} ${
    remainingLikes === 1 ? "pessoa" : "pessoas"
  }`;
}

export function formatStoryLikesCount(likesCount: number): string {
  const safeLikes = Math.max(0, likesCount);
  return `${safeLikes.toLocaleString("pt-BR")} ${
    safeLikes === 1 ? "curtida" : "curtidas"
  }`;
}

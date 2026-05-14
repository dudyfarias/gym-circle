import type { StoredFollowStatus } from "./types";

export type FollowVisibilityStatus = "none" | StoredFollowStatus;

export type ProfilePostVisibilityInput = {
  ownerId: string;
  viewerId: string | null;
  isPrivate: boolean;
  followStatus?: FollowVisibilityStatus;
};

export function canViewProfilePosts(input: ProfilePostVisibilityInput): boolean {
  if (!input.isPrivate) return true;
  if (input.viewerId && input.viewerId === input.ownerId) return true;
  return input.followStatus === "accepted";
}

export type FollowRequest = {
  followerId: string;
  followingId: string;
  status: "pending" | "accepted";
};

export function acceptFollowRequest(
  request: FollowRequest,
  actorId: string,
): FollowRequest {
  if (actorId !== request.followingId) {
    throw new Error("somente o dono do perfil pode aceitar a solicitação");
  }
  if (request.status !== "pending") {
    return request;
  }
  return { ...request, status: "accepted" };
}

export type ParticipantRequest = {
  status: "pending" | "accepted" | "rejected";
  hasMedia: boolean;
  sourceType: "post" | "story";
  expiresAt?: string | null;
  acceptedAt?: string | null;
};

export function participantCountsForStreak(
  participant: ParticipantRequest,
  nowIso: string,
): boolean {
  if (participant.status !== "accepted") return false;
  if (!participant.hasMedia) return false;

  if (participant.sourceType === "story") {
    if (!participant.expiresAt) return false;
    const acceptedAt = participant.acceptedAt ?? nowIso;
    return new Date(acceptedAt).getTime() <= new Date(participant.expiresAt).getTime();
  }

  return true;
}

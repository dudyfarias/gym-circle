import type { EnrichedUser, FollowStatus } from "./types";

export type FollowCtaState = {
  disabled: boolean;
  label: "Seguir" | "Solicitar" | "Solicitado" | "Seguindo";
  status: FollowStatus;
};

export function getFollowCtaState({
  isFollowBackContext = false,
  overrideStatus,
  user,
}: {
  isFollowBackContext?: boolean;
  overrideStatus?: FollowStatus | null;
  user: Pick<EnrichedUser, "followStatus" | "isFollowing" | "isPrivate">;
}): FollowCtaState {
  const status =
    overrideStatus ?? user.followStatus ?? (user.isFollowing ? "accepted" : "none");

  if (status === "accepted") {
    return { disabled: true, label: "Seguindo", status };
  }

  if (status === "pending") {
    return { disabled: true, label: "Solicitado", status };
  }

  return {
    disabled: false,
    label: user.isPrivate && !isFollowBackContext ? "Solicitar" : "Seguir",
    status,
  };
}

export function normalizeFollowActionResult(
  result: unknown,
): FollowStatus | null {
  if (result === "none" || result === "pending" || result === "accepted") {
    return result;
  }
  if (
    result &&
    typeof result === "object" &&
    "followStatus" in result &&
    (result.followStatus === "none" ||
      result.followStatus === "pending" ||
      result.followStatus === "accepted")
  ) {
    return result.followStatus;
  }
  return null;
}

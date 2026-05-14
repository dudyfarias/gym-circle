import { describe, expect, it } from "vitest";
import { getFollowCtaState, normalizeFollowActionResult } from "./followCta";
import type { EnrichedUser } from "./types";

function user(
  followStatus: EnrichedUser["followStatus"],
  isPrivate = false,
): Pick<EnrichedUser, "followStatus" | "isFollowing" | "isPrivate"> {
  return {
    followStatus,
    isFollowing: followStatus === "accepted",
    isPrivate,
  };
}

describe("follow CTA state", () => {
  it("shows Seguir for a public profile with no relationship", () => {
    expect(getFollowCtaState({ user: user("none") })).toMatchObject({
      disabled: false,
      label: "Seguir",
      status: "none",
    });
  });

  it("shows Solicitar for a private non-reciprocal profile", () => {
    expect(getFollowCtaState({ user: user("none", true) })).toMatchObject({
      disabled: false,
      label: "Solicitar",
      status: "none",
    });
  });

  it("shows Seguir in follow-back context because reciprocal private follows auto-accept server-side", () => {
    expect(
      getFollowCtaState({
        isFollowBackContext: true,
        user: user("none", true),
      }),
    ).toMatchObject({
      disabled: false,
      label: "Seguir",
      status: "none",
    });
  });

  it("shows Solicitado and Seguindo as non-clickable final states", () => {
    expect(getFollowCtaState({ user: user("pending", true) })).toMatchObject({
      disabled: true,
      label: "Solicitado",
    });
    expect(getFollowCtaState({ user: user("accepted", true) })).toMatchObject({
      disabled: true,
      label: "Seguindo",
    });
  });

  it("normalizes service results for optimistic notification updates", () => {
    expect(normalizeFollowActionResult({ followStatus: "accepted" })).toBe(
      "accepted",
    );
    expect(normalizeFollowActionResult("pending")).toBe("pending");
    expect(normalizeFollowActionResult(undefined)).toBeNull();
  });
});

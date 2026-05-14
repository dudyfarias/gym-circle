import { describe, expect, it } from "vitest";
import {
  acceptFollowRequest,
  canViewProfilePosts,
  participantCountsForStreak,
} from "./social-rules";

describe("canViewProfilePosts", () => {
  it("perfil privado bloqueia posts para não seguidores", () => {
    expect(
      canViewProfilePosts({
        ownerId: "owner",
        viewerId: "viewer",
        isPrivate: true,
        followStatus: "none",
      }),
    ).toBe(false);
  });

  it("perfil privado libera posts para seguidores aceitos", () => {
    expect(
      canViewProfilePosts({
        ownerId: "owner",
        viewerId: "viewer",
        isPrivate: true,
        followStatus: "accepted",
      }),
    ).toBe(true);
  });

  it("perfil privado libera posts para o dono", () => {
    expect(
      canViewProfilePosts({
        ownerId: "owner",
        viewerId: "owner",
        isPrivate: true,
        followStatus: "none",
      }),
    ).toBe(true);
  });
});

describe("acceptFollowRequest", () => {
  it("follow request vira accepted após aceite", () => {
    const accepted = acceptFollowRequest(
      { followerId: "viewer", followingId: "owner", status: "pending" },
      "owner",
    );

    expect(accepted.status).toBe("accepted");
  });

  it("bloqueia aceite por quem não é o alvo", () => {
    expect(() =>
      acceptFollowRequest(
        { followerId: "viewer", followingId: "owner", status: "pending" },
        "viewer",
      ),
    ).toThrow("somente o dono do perfil");
  });
});

describe("participantCountsForStreak", () => {
  it("post tag pending não conta streak", () => {
    expect(
      participantCountsForStreak(
        { sourceType: "post", status: "pending", hasMedia: true },
        "2026-05-13T12:00:00.000Z",
      ),
    ).toBe(false);
  });

  it("post tag accepted conta streak", () => {
    expect(
      participantCountsForStreak(
        { sourceType: "post", status: "accepted", hasMedia: true },
        "2026-05-13T12:00:00.000Z",
      ),
    ).toBe(true);
  });

  it("post tag rejected não conta streak", () => {
    expect(
      participantCountsForStreak(
        { sourceType: "post", status: "rejected", hasMedia: true },
        "2026-05-13T12:00:00.000Z",
      ),
    ).toBe(false);
  });

  it("story tag só conta se aceito antes de expirar", () => {
    expect(
      participantCountsForStreak(
        {
          sourceType: "story",
          status: "accepted",
          hasMedia: true,
          acceptedAt: "2026-05-13T12:00:00.000Z",
          expiresAt: "2026-05-13T13:00:00.000Z",
        },
        "2026-05-13T12:00:00.000Z",
      ),
    ).toBe(true);

    expect(
      participantCountsForStreak(
        {
          sourceType: "story",
          status: "accepted",
          hasMedia: true,
          acceptedAt: "2026-05-13T14:00:00.000Z",
          expiresAt: "2026-05-13T13:00:00.000Z",
        },
        "2026-05-13T14:00:00.000Z",
      ),
    ).toBe(false);
  });
});

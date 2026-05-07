import { describe, expect, it } from "vitest";
import { acceptFollowRequest, canViewProfilePosts } from "./social-rules";

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

import { describe, expect, it, vi } from "vitest";
import { followService } from "./follows";
import type { GymCircleClient } from "./supabase";

function mockFollowInsert(status: "accepted" | "pending") {
  const single = vi.fn().mockResolvedValue({ data: { status }, error: null });
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  const client = { from } as unknown as GymCircleClient & {
    from: ReturnType<typeof vi.fn>;
  };
  return { client, insert };
}

describe("followService.follow", () => {
  it("lets the backend decide accepted for public profiles", async () => {
    const { client } = mockFollowInsert("accepted");
    const service = followService(client);

    await expect(service.follow("me", "public-target")).resolves.toBe("accepted");
  });

  it("lets the backend decide pending for private profiles that do not follow me", async () => {
    const { client } = mockFollowInsert("pending");
    const service = followService(client);

    await expect(service.follow("me", "private-target")).resolves.toBe("pending");
  });

  it("lets the backend auto-accept private reciprocal follow-backs", async () => {
    const { client } = mockFollowInsert("accepted");
    const service = followService(client);

    await expect(service.follow("me", "private-follower")).resolves.toBe("accepted");
  });

  it("never sends status from the client, so callers cannot force accepted", async () => {
    const { client, insert } = mockFollowInsert("pending");
    const service = followService(client);

    await service.follow("me", "private-target");

    expect(insert).toHaveBeenCalledWith({
      follower_id: "me",
      following_id: "private-target",
    });
  });
});

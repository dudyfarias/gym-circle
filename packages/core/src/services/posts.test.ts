import { describe, expect, it, vi } from "vitest";
import { postService } from "./posts";
import type { GymCircleClient } from "./supabase";

function createDeleteCommentClientMock() {
  const query = {
    delete: vi.fn().mockReturnThis(),
    match: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const from = vi.fn(() => query);
  return {
    client: { from } as unknown as GymCircleClient,
    from,
    query,
  };
}

describe("postService.deleteComment", () => {
  it("deletes comments through the current user's ownership scope", async () => {
    const { client, from, query } = createDeleteCommentClientMock();
    const service = postService(client);

    await service.deleteComment("comment-1", "user-a");

    expect(from).toHaveBeenCalledWith("post_comments");
    expect(query.delete).toHaveBeenCalled();
    expect(query.match).toHaveBeenCalledWith({
      id: "comment-1",
      user_id: "user-a",
    });
  });
});

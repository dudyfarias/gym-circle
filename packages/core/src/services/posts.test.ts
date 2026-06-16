import { describe, expect, it, vi } from "vitest";
import { postService } from "./posts";
import type { GymCircleClient } from "./supabase";

function createDeleteCommentClientMock() {
  const query = {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const from = vi.fn(() => query);
  return {
    client: { from } as unknown as GymCircleClient,
    from,
    query,
  };
}

function createLikeCommentClientMock() {
  const query = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        comment_id: "comment-1",
        user_id: "user-a",
        created_at: "2026-05-14T12:00:00.000Z",
      },
      error: null,
    }),
  };
  const from = vi.fn(() => query);
  return {
    client: { from } as unknown as GymCircleClient,
    from,
    query,
  };
}

function createUnlikeCommentClientMock() {
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
    expect(query.eq).toHaveBeenCalledWith("id", "comment-1");
  });
});

describe("postService comment likes", () => {
  it("likes a comment as the current user", async () => {
    const { client, from, query } = createLikeCommentClientMock();
    const service = postService(client);

    const row = await service.likeComment("comment-1", "user-a");

    expect(from).toHaveBeenCalledWith("post_comment_likes");
    expect(query.insert).toHaveBeenCalledWith({
      comment_id: "comment-1",
      user_id: "user-a",
    });
    expect(query.select).toHaveBeenCalledWith("*");
    expect(row.comment_id).toBe("comment-1");
  });

  it("unlikes a comment as the current user", async () => {
    const { client, from, query } = createUnlikeCommentClientMock();
    const service = postService(client);

    await service.unlikeComment("comment-1", "user-a");

    expect(from).toHaveBeenCalledWith("post_comment_likes");
    expect(query.delete).toHaveBeenCalled();
    expect(query.match).toHaveBeenCalledWith({
      comment_id: "comment-1",
      user_id: "user-a",
    });
  });
});

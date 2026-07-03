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

function createPostClientMock() {
  const rpcQuery = {
    single: vi.fn().mockResolvedValue({
      data: {
        id: "post-1",
        user_id: "user-a",
        source_checkin_id: "checkin-1",
      },
      error: null,
    }),
  };
  const rpc = vi.fn(() => rpcQuery);
  return {
    client: { rpc } as unknown as GymCircleClient,
    rpc,
    rpcQuery,
  };
}

describe("postService.create", () => {
  it("links a promoted post to its source check-in", async () => {
    const { client, rpc } = createPostClientMock();
    const service = postService(client);

    await service.create("user-a", {
      sourceCheckinId: "checkin-1",
      imageUrl: "https://cdn.gymcircle.test/photo.jpg",
      mediaType: "image",
      caption: "Treino feito.",
      gymId: "gym-1",
      workoutDate: "2026-07-01",
      createdAt: "2026-07-01T12:30:00.000Z",
      locationSource: "gym",
      locationName: "Saint Thomas",
    });

    expect(rpc).toHaveBeenCalledWith("create_social_post_with_media", {
      p_post: expect.objectContaining({
        source_checkin_id: "checkin-1",
        gym_id: "gym-1",
        workout_date: "2026-07-01",
        created_at: "2026-07-01T12:30:00.000Z",
      }),
      p_media: [
        expect.objectContaining({
          media_type: "image",
          image_url: "https://cdn.gymcircle.test/photo.jpg",
        }),
      ],
    });
  });
});

describe("postService unified social editor", () => {
  it("updates metadata and location through the transactional RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const service = postService({ rpc } as unknown as GymCircleClient);

    await service.updateSocialDetails("post-1", {
      caption: "Treino forte",
      workoutTypes: ["Musculação", "Cardio"],
      gymId: "gym-2",
    });

    expect(rpc).toHaveBeenCalledWith("update_social_post_full", {
      p_post_id: "post-1",
      p_caption: "Treino forte",
      p_workout_types: ["Musculação", "Cardio"],
      p_gym_id: "gym-2",
      p_media: null,
    });
  });

  it("updates post metadata and carousel in the same RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const service = postService({ rpc } as unknown as GymCircleClient);

    await service.updateSocialDetails("post-1", {
      caption: "Carrossel",
      workoutTypes: ["Cardio"],
      gymId: null,
      media: [
        { mediaType: "image", imageUrl: "https://cdn.gym/one.jpg" },
        { mediaType: "video", imageUrl: "https://cdn.gym/two.mp4" },
      ],
    });

    expect(rpc).toHaveBeenCalledWith(
      "update_social_post_full",
      expect.objectContaining({
        p_post_id: "post-1",
        p_media: [
          expect.objectContaining({ media_type: "image" }),
          expect.objectContaining({ media_type: "video" }),
        ],
      }),
    );
  });

  it("converts the last-media removal into a check-in", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: "checkin-2",
      error: null,
    });
    const service = postService({ rpc } as unknown as GymCircleClient);

    const checkinId = await service.convertToCheckin("post-1", "gym-2");

    expect(checkinId).toBe("checkin-2");
    expect(rpc).toHaveBeenCalledWith("convert_social_post_to_checkin", {
      p_post_id: "post-1",
      p_gym_id: "gym-2",
    });
  });
});

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

import { describe, expect, it, vi } from "vitest";
import { messageService } from "./messages";
import type { GymCircleClient } from "./supabase";

function createClientMock(result: unknown) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: result, error: null }),
  } as unknown as GymCircleClient & {
    rpc: ReturnType<typeof vi.fn>;
  };
}

const messageRow = {
  id: "message-1",
  conversation_id: "conversation-1",
  sender_id: "user-a",
  receiver_id: "user-b",
  body: "Bora treinar?",
  media_url: null,
  media_type: null,
  read_at: null,
  reply_to_story: false,
  created_at: "2026-05-07T12:00:00.000Z",
  story_id: null,
  story_preview_url: null,
};

describe("messageService.sendDirect", () => {
  it("creates the first direct message through the atomic RPC", async () => {
    const client = createClientMock(messageRow);
    const service = messageService(client);

    const result = await service.sendDirect("user-a", {
      receiverId: "user-b",
      body: "  Bora treinar?  ",
    });

    expect(client.rpc).toHaveBeenCalledWith("send_direct_message", {
      p_receiver_id: "user-b",
      p_body: "Bora treinar?",
      p_media_url: null,
      p_media_type: null,
      p_story_id: null,
      p_reply_to_story: false,
      p_story_preview_url: null,
    });
    expect(result).toEqual(messageRow);
  });

  it("defaults media messages to image when media type is omitted", async () => {
    const client = createClientMock({
      ...messageRow,
      body: null,
      media_url: "https://cdn.gym/post.jpg",
      media_type: "image",
    });
    const service = messageService(client);

    await service.sendDirect("user-a", {
      receiverId: "user-b",
      mediaUrl: " https://cdn.gym/post.jpg ",
    });

    expect(client.rpc).toHaveBeenCalledWith("send_direct_message", {
      p_receiver_id: "user-b",
      p_body: null,
      p_media_url: "https://cdn.gym/post.jpg",
      p_media_type: "image",
      p_story_id: null,
      p_reply_to_story: false,
      p_story_preview_url: null,
    });
  });

  it("sends story replies with preview metadata", async () => {
    const client = createClientMock({
      ...messageRow,
      story_id: "story-1",
      reply_to_story: true,
      story_preview_url: "https://cdn.gym/story.jpg",
    });
    const service = messageService(client);

    await service.sendDirect("user-a", {
      receiverId: "user-b",
      body: "forte demais",
      storyId: "story-1",
      replyToStory: true,
      storyPreviewUrl: " https://cdn.gym/story.jpg ",
    });

    expect(client.rpc).toHaveBeenCalledWith("send_direct_message", {
      p_receiver_id: "user-b",
      p_body: "forte demais",
      p_media_url: null,
      p_media_type: null,
      p_story_id: "story-1",
      p_reply_to_story: true,
      p_story_preview_url: "https://cdn.gym/story.jpg",
    });
  });

  it("rejects empty messages before calling Supabase", async () => {
    const client = createClientMock(null);
    const service = messageService(client);

    await expect(
      service.sendDirect("user-a", { receiverId: "user-b", body: "   " }),
    ).rejects.toThrow("mensagem vazia");
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rejects self messages before calling Supabase", async () => {
    const client = createClientMock(null);
    const service = messageService(client);

    await expect(
      service.sendDirect("user-a", { receiverId: "user-a", body: "oi" }),
    ).rejects.toThrow("não dá para mandar mensagem para si mesmo");
    expect(client.rpc).not.toHaveBeenCalled();
  });
});

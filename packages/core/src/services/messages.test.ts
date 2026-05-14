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

function createClientMockWithRpcSequence(
  sequence: Array<{ data: unknown; error: unknown }>,
) {
  return {
    rpc: vi.fn().mockImplementation(() => Promise.resolve(sequence.shift())),
  } as unknown as GymCircleClient & {
    rpc: ReturnType<typeof vi.fn>;
  };
}

function createDeleteConversationClientMock(conversationId: string | null) {
  const conversationsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: conversationId ? { id: conversationId } : null,
      error: null,
    }),
  };
  const participantsQuery = {
    update: vi.fn().mockReturnThis(),
    match: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const from = vi.fn((table: string) =>
    table === "conversations" ? conversationsQuery : participantsQuery,
  );
  return {
    client: {
      from,
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "PGRST202",
          message:
            "Could not find the function public.delete_direct_conversation_for_me in the schema cache",
        },
      }),
    } as unknown as GymCircleClient,
    conversationsQuery,
    participantsQuery,
    from,
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

  it("falls back to the older direct-message RPC while production migrations catch up", async () => {
    const client = createClientMockWithRpcSequence([
      {
        data: null,
        error: {
          code: "PGRST202",
          message: "Could not find the function public.send_direct_message in the schema cache",
        },
      },
      {
        data: Object.fromEntries(
          Object.entries(messageRow).filter(
            ([key]) => !["story_id", "reply_to_story", "story_preview_url"].includes(key),
          ),
        ),
        error: null,
      },
    ]);
    const service = messageService(client);

    const result = await service.sendDirect("user-a", {
      receiverId: "user-b",
      body: "primeira mensagem",
    });

    expect(client.rpc).toHaveBeenNthCalledWith(2, "send_direct_message", {
      p_receiver_id: "user-b",
      p_body: "primeira mensagem",
      p_media_url: null,
      p_media_type: null,
    });
    expect(result.reply_to_story).toBe(false);
    expect(result.story_id).toBeNull();
    expect(result.story_preview_url).toBeNull();
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

describe("messageService.deleteConversationForMe", () => {
  it("deletes the current participant conversation through the RPC", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: "conversation-1", error: null }),
      from: vi.fn(),
    } as unknown as GymCircleClient & {
      rpc: ReturnType<typeof vi.fn>;
      from: ReturnType<typeof vi.fn>;
    };
    const service = messageService(client);

    await service.deleteConversationForMe("user-a", "user-b");

    expect(client.rpc).toHaveBeenCalledWith("delete_direct_conversation_for_me", {
      p_other_user_id: "user-b",
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("falls back to marking only the current participant while migrations catch up", async () => {
    const { client, conversationsQuery, participantsQuery } =
      createDeleteConversationClientMock("conversation-1");
    const service = messageService(client);

    await service.deleteConversationForMe("user-a", "user-b");

    expect(conversationsQuery.eq).toHaveBeenCalledWith("direct_key", "user-a:user-b");
    expect(participantsQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_at: expect.any(String),
        last_read_at: expect.any(String),
      }),
    );
    expect(participantsQuery.match).toHaveBeenCalledWith({
      conversation_id: "conversation-1",
      user_id: "user-a",
    });
  });

  it("does nothing when the direct conversation does not exist", async () => {
    const { client, participantsQuery } = createDeleteConversationClientMock(null);
    const service = messageService(client);

    await service.deleteConversationForMe("user-a", "user-b");

    expect(participantsQuery.update).not.toHaveBeenCalled();
  });
});

describe("messageService group conversations", () => {
  it("creates a group conversation with distinct members", async () => {
    const client = createClientMock("conversation-group-1");
    const service = messageService(client);

    const result = await service.createGroup({
      name: "Perna de sexta",
      memberIds: ["user-b", "user-c", "user-b"],
    });

    expect(result).toBe("conversation-group-1");
    expect(client.rpc).toHaveBeenCalledWith("create_group_conversation", {
      p_name: "Perna de sexta",
      p_member_ids: ["user-b", "user-c"],
      p_image_url: null,
    });
  });

  it("sends group messages through the group RPC", async () => {
    const client = createClientMock({
      ...messageRow,
      receiver_id: null,
      conversation_id: "conversation-group-1",
      body: "Treino 19h?",
    });
    const service = messageService(client);

    const result = await service.sendGroup({
      conversationId: "conversation-group-1",
      body: "  Treino 19h? ",
    });

    expect(client.rpc).toHaveBeenCalledWith("send_group_message", {
      p_conversation_id: "conversation-group-1",
      p_body: "Treino 19h?",
      p_media_url: null,
      p_media_type: null,
    });
    expect(result.receiver_id).toBeNull();
  });

  it("marks a whole conversation as read", async () => {
    const client = createClientMock(null);
    const service = messageService(client);

    await service.markConversationRead("conversation-group-1");

    expect(client.rpc).toHaveBeenCalledWith("mark_conversation_read", {
      p_conversation_id: "conversation-group-1",
    });
  });
});

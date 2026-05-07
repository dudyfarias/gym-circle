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
  created_at: "2026-05-07T12:00:00.000Z",
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

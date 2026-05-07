import type { DirectMessageRow } from "../domain/types";
import type { GymCircleClient } from "./supabase";

export type SendDirectMessageInput = {
  receiverId: string;
  body?: string | null;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
};

function createDirectKey(userA: string, userB: string): string {
  return [userA, userB].sort().join(":");
}

export function messageService(client: GymCircleClient) {
  async function findDirectConversationId(
    currentUserId: string,
    otherUserId: string,
  ): Promise<string | null> {
    const { data, error } = await client
      .from("conversations")
      .select("id")
      .eq("direct_key", createDirectKey(currentUserId, otherUserId))
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  }

  return {
    createDirectKey,

    async sendDirect(
      senderId: string,
      input: SendDirectMessageInput,
    ): Promise<DirectMessageRow> {
      const body = input.body?.trim() || null;
      const mediaUrl = input.mediaUrl?.trim() || null;
      if (!body && !mediaUrl) throw new Error("mensagem vazia");
      if (senderId === input.receiverId) {
        throw new Error("não dá para mandar mensagem para si mesmo");
      }

      const { data, error } = await client
        .rpc("send_direct_message", {
          p_receiver_id: input.receiverId,
          p_body: body,
          p_media_url: mediaUrl,
          p_media_type: mediaUrl ? (input.mediaType ?? "image") : null,
        });
      if (error) throw error;
      return data as DirectMessageRow;
    },

    async markDirectRead(currentUserId: string, otherUserId: string): Promise<void> {
      const now = new Date().toISOString();
      const conversationId = await findDirectConversationId(currentUserId, otherUserId);

      if (conversationId) {
        const { error: participantError } = await client
          .from("conversation_participants")
          .update({ last_read_at: now })
          .match({ conversation_id: conversationId, user_id: currentUserId });
        if (participantError) throw participantError;
      }

      const { error } = await client
        .from("direct_messages")
        .update({ read_at: now })
        .eq("sender_id", otherUserId)
        .eq("receiver_id", currentUserId)
        .is("read_at", null);
      if (error) throw error;
    },
  };
}

export type MessageService = ReturnType<typeof messageService>;

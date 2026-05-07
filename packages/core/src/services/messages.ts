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

function createUuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) =>
    (
      Number(char) ^
      (Math.random() * 16) >> (Number(char) / 4)
    ).toString(16),
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
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

  async function ensureDirectConversation(
    currentUserId: string,
    otherUserId: string,
  ): Promise<string> {
    if (currentUserId === otherUserId) {
      throw new Error("não dá para mandar mensagem para si mesmo");
    }

    const existingId = await findDirectConversationId(currentUserId, otherUserId);
    if (existingId) return existingId;

    const conversationId = createUuid();
    const directKey = createDirectKey(currentUserId, otherUserId);
    const { error } = await client.from("conversations").insert({
      id: conversationId,
      created_by: currentUserId,
      direct_key: directKey,
      last_message_at: null,
    });

    if (error) {
      if (isUniqueViolation(error)) {
        const createdByRace = await findDirectConversationId(currentUserId, otherUserId);
        if (createdByRace) return createdByRace;
      }
      throw error;
    }

    const { error: participantsError } = await client
      .from("conversation_participants")
      .upsert(
        [
          { conversation_id: conversationId, user_id: currentUserId },
          { conversation_id: conversationId, user_id: otherUserId },
        ],
        {
          ignoreDuplicates: true,
          onConflict: "conversation_id,user_id",
        },
      );
    if (participantsError) throw participantsError;

    return conversationId;
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

      const conversationId = await ensureDirectConversation(senderId, input.receiverId);
      const { data, error } = await client
        .from("direct_messages")
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          receiver_id: input.receiverId,
          body,
          media_url: mediaUrl,
          media_type: mediaUrl ? (input.mediaType ?? "image") : null,
        })
        .select("*")
        .single();
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

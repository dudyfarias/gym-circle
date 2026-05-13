import type { DirectMessageRow } from "../domain/types";
import type { GymCircleClient } from "./supabase";

export type SendDirectMessageInput = {
  receiverId: string;
  body?: string | null;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
  storyId?: string | null;
  replyToStory?: boolean;
  storyPreviewUrl?: string | null;
};

function createDirectKey(userA: string, userB: string): string {
  return [userA, userB].sort().join(":");
}

function isMissingRpc(error: unknown, functionName: string) {
  const postgrestError = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  const haystack = [
    postgrestError.code,
    postgrestError.message,
    postgrestError.details,
    postgrestError.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    postgrestError.code === "PGRST202" ||
    (haystack.includes(functionName) && haystack.includes("schema cache"))
  );
}

function isMissingNewDirectRpcSignature(error: unknown) {
  return isMissingRpc(error, "send_direct_message");
}

function isMissingDeleteConversationRpc(error: unknown) {
  return isMissingRpc(error, "delete_direct_conversation_for_me");
}

function withStoryDefaults(row: unknown): DirectMessageRow {
  const message = row as Partial<DirectMessageRow>;
  return {
    ...message,
    story_id: message.story_id ?? null,
    reply_to_story: message.reply_to_story ?? false,
    story_preview_url: message.story_preview_url ?? null,
  } as DirectMessageRow;
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
      const storyId = input.storyId?.trim() || null;
      const storyPreviewUrl = input.storyPreviewUrl?.trim() || null;
      if (!body && !mediaUrl && !storyId) throw new Error("mensagem vazia");
      if (senderId === input.receiverId) {
        throw new Error("não dá para mandar mensagem para si mesmo");
      }

      const { data, error } = await client.rpc("send_direct_message", {
        p_receiver_id: input.receiverId,
        p_body: body,
        p_media_url: mediaUrl,
        p_media_type: mediaUrl ? (input.mediaType ?? "image") : null,
        p_story_id: storyId,
        p_reply_to_story: Boolean(input.replyToStory),
        p_story_preview_url: storyPreviewUrl,
      });

      if (error && isMissingNewDirectRpcSignature(error)) {
        const fallback = await client.rpc("send_direct_message", {
          p_receiver_id: input.receiverId,
          p_body: body,
          p_media_url: mediaUrl,
          p_media_type: mediaUrl ? (input.mediaType ?? "image") : null,
        });
        if (fallback.error) throw fallback.error;
        return withStoryDefaults(fallback.data);
      }

      if (error) throw error;
      return withStoryDefaults(data);
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

    async deleteConversationForMe(
      currentUserId: string,
      otherUserId: string,
    ): Promise<void> {
      const rpc = await client.rpc("delete_direct_conversation_for_me", {
        p_other_user_id: otherUserId,
      });

      if (!rpc.error) return;
      if (!isMissingDeleteConversationRpc(rpc.error)) throw rpc.error;

      const conversationId = await findDirectConversationId(currentUserId, otherUserId);
      if (!conversationId) return;

      const now = new Date().toISOString();
      const { error } = await client
        .from("conversation_participants")
        .update({ deleted_at: now, last_read_at: now })
        .match({ conversation_id: conversationId, user_id: currentUserId });
      if (error) throw error;
    },
  };
}

export type MessageService = ReturnType<typeof messageService>;

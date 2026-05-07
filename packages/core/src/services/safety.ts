import type {
  AccountDeletionRequestRow,
  ReportRow,
  UserBlockRow,
} from "../domain/types";
import type { GymCircleClient } from "./supabase";

export type ReportReason =
  | "spam"
  | "harassment"
  | "nudity"
  | "violence"
  | "hate"
  | "fake_profile"
  | "other";

export type CreateReportInput = {
  reportedUserId?: string | null;
  postId?: string | null;
  storyId?: string | null;
  reason: ReportReason;
  details?: string | null;
};

export function safetyService(client: GymCircleClient) {
  return {
    async blockUser(
      blockerId: string,
      blockedId: string,
      reason?: string | null,
    ): Promise<UserBlockRow> {
      if (blockerId === blockedId) throw new Error("não dá para bloquear a si mesmo");
      const { data, error } = await client
        .from("user_blocks")
        .upsert(
          {
            blocker_id: blockerId,
            blocked_id: blockedId,
            reason: reason?.trim() || null,
          },
          { onConflict: "blocker_id,blocked_id" },
        )
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },

    async unblockUser(blockerId: string, blockedId: string): Promise<void> {
      const { error } = await client
        .from("user_blocks")
        .delete()
        .match({ blocker_id: blockerId, blocked_id: blockedId });
      if (error) throw error;
    },

    async report(
      reporterId: string,
      input: CreateReportInput,
    ): Promise<ReportRow> {
      if (!input.reportedUserId && !input.postId && !input.storyId) {
        throw new Error("Informe usuário, post ou story para denunciar.");
      }
      const { data, error } = await client
        .from("reports")
        .insert({
          reporter_id: reporterId,
          reported_user_id: input.reportedUserId ?? null,
          post_id: input.postId ?? null,
          story_id: input.storyId ?? null,
          reason: input.reason,
          details: input.details?.trim() || null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },

    async requestAccountDeletion(reason?: string | null): Promise<void> {
      const { error } = await client.rpc("request_account_deletion", {
        p_reason: reason?.trim() || undefined,
      });
      if (error) throw error;
    },

    async myOpenDeletionRequest(userId: string): Promise<AccountDeletionRequestRow | null> {
      const { data, error } = await client
        .from("account_deletion_requests")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["requested", "processing"])
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  };
}

export type SafetyService = ReturnType<typeof safetyService>;

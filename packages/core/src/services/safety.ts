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

export type AccountReactivationToken = {
  token: string;
  expiresAt: string;
};

type AccountReactivationRpcRow = {
  reactivation_token: string;
  reactivation_expires_at: string;
};

function parseReactivationRpcResult(
  data: AccountReactivationRpcRow | AccountReactivationRpcRow[] | null,
): AccountReactivationToken {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.reactivation_token || !row.reactivation_expires_at) {
    throw new Error("Não foi possível gerar o link de reativação.");
  }
  return {
    token: row.reactivation_token,
    expiresAt: row.reactivation_expires_at,
  };
}

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

    async suspendAccount(): Promise<AccountReactivationToken> {
      const { data, error } = await client.rpc("suspend_own_account");
      if (error) throw error;
      return parseReactivationRpcResult(
        data as AccountReactivationRpcRow | AccountReactivationRpcRow[] | null,
      );
    },

    async issueReactivationToken(): Promise<AccountReactivationToken> {
      const { data, error } = await client.rpc("issue_account_reactivation_token");
      if (error) throw error;
      return parseReactivationRpcResult(
        data as AccountReactivationRpcRow | AccountReactivationRpcRow[] | null,
      );
    },

    async reactivateAccount(token: string): Promise<void> {
      const { error } = await client.rpc("reactivate_suspended_account", {
        p_token: token,
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

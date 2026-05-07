import type {
  AccountDeletionRequestRow,
  AlphaAdminDailyMetricRow,
  AlphaAdminSummaryRow,
  ReportRow,
  UserBlockRow,
} from "../domain/types";
import type { GymCircleClient } from "./supabase";

export function adminService(client: GymCircleClient) {
  return {
    async summary(): Promise<AlphaAdminSummaryRow | null> {
      const { data, error } = await client
        .from("alpha_admin_summary")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async dailyMetrics(limit = 14): Promise<AlphaAdminDailyMetricRow[]> {
      const { data, error } = await client
        .from("alpha_admin_daily_metrics")
        .select("*")
        .order("metric_date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },

    async reports(limit = 30): Promise<ReportRow[]> {
      const { data, error } = await client
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },

    async blocks(limit = 30): Promise<UserBlockRow[]> {
      const { data, error } = await client
        .from("user_blocks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },

    async deletionRequests(limit = 30): Promise<AccountDeletionRequestRow[]> {
      const { data, error } = await client
        .from("account_deletion_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  };
}

export type AdminService = ReturnType<typeof adminService>;

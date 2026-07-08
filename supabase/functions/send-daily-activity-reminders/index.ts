import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  filterUsersNeedingReminder,
  uniqueCandidateUserIds,
  type ActivityDayRow,
  type ReminderCandidate,
  type ReminderLogRow,
} from "./reminder-selection.ts";

type AdminClient = SupabaseClient<any, "public", "public", any, any>;

type ReminderRequest = {
  dry_run?: boolean;
  limit?: number;
  activity_date?: string;
  time_zone?: string;
};

const DEFAULT_TIME_ZONE = "America/Sao_Paulo";
const MAX_BATCH_SIZE = 500;
const RECENT_REMINDER_WINDOW_MS = 20 * 60 * 60 * 1000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, apikey, content-type, x-push-dispatch-secret",
  "access-control-allow-methods": "POST, OPTIONS",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
    },
  });
}

function requiredEnvironment() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error("Supabase runtime environment is incomplete");
  }
  return { supabaseUrl, serviceRoleKey, anonKey };
}

function safeEquals(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

async function getDispatchSecret(supabase: AdminClient): Promise<string> {
  const { data, error } = await supabase.rpc("edge_push_dispatch_secret");
  if (error || typeof data !== "string" || !data) {
    throw new Error("Push dispatch secret is unavailable");
  }
  return data;
}

async function assertAuthorized(
  request: Request,
  supabase: AdminClient,
): Promise<string> {
  const expected = await getDispatchSecret(supabase);
  const provided = request.headers.get("x-push-dispatch-secret") ?? "";
  if (!safeEquals(provided, expected)) {
    throw new Error("unauthorized_dispatch");
  }
  return expected;
}

function dateInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function resolveActivityDate(input: ReminderRequest): string {
  if (input.activity_date && ISO_DATE_PATTERN.test(input.activity_date)) {
    return input.activity_date;
  }
  return dateInTimeZone(new Date(), input.time_zone ?? DEFAULT_TIME_ZONE);
}

function clampLimit(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return MAX_BATCH_SIZE;
  return Math.min(MAX_BATCH_SIZE, Math.floor(number));
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  let runtime: ReturnType<typeof requiredEnvironment>;
  try {
    runtime = requiredEnvironment();
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "runtime_error" },
      500,
    );
  }

  const supabase = createClient(runtime.supabaseUrl, runtime.serviceRoleKey);
  let dispatchSecret: string;
  try {
    dispatchSecret = await assertAuthorized(request, supabase);
  } catch {
    return jsonResponse({ error: "unauthorized_dispatch" }, 401);
  }

  let body: ReminderRequest = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const activityDate = resolveActivityDate(body);
  const limit = clampLimit(body.limit);
  const recentSince = new Date(
    Date.now() - RECENT_REMINDER_WINDOW_MS,
  ).toISOString();

  const candidatesResult = await supabase
    .from("device_push_tokens")
    .select("user_id")
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false })
    .limit(limit * 3);
  if (candidatesResult.error) {
    return jsonResponse({ error: candidatesResult.error.message }, 500);
  }

  const candidateUserIds = uniqueCandidateUserIds(
    ((candidatesResult.data ?? []) as ReminderCandidate[]),
  ).slice(0, limit);

  if (candidateUserIds.length === 0) {
    return jsonResponse({
      sent: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      activity_date: activityDate,
    });
  }

  const [activityResult, logsResult] = await Promise.all([
    supabase
      .from("user_activity_days")
      .select("user_id")
      .eq("activity_date", activityDate)
      .in("user_id", candidateUserIds),
    supabase
      .from("push_delivery_logs")
      .select("user_id, target_id, created_at")
      .eq("type", "daily_activity_reminder")
      .gte("created_at", recentSince)
      .in("user_id", candidateUserIds),
  ]);

  if (activityResult.error || logsResult.error) {
    return jsonResponse(
      {
        error:
          activityResult.error?.message ??
          logsResult.error?.message ??
          "eligibility_lookup_failed",
      },
      500,
    );
  }

  const recipientIds = filterUsersNeedingReminder({
    candidateUserIds,
    activityDate,
    activityRows: (activityResult.data ?? []) as ActivityDayRow[],
    recentReminderRows: (logsResult.data ?? []) as ReminderLogRow[],
  });

  if (body.dry_run) {
    const activeToday = new Set(
      ((activityResult.data ?? []) as ActivityDayRow[]).map((row) => row.user_id),
    );
    const remindedToday = new Set(
      ((logsResult.data ?? []) as ReminderLogRow[]).map((row) => row.user_id),
    );
    return jsonResponse({
      dry_run: true,
      candidates: candidateUserIds.length,
      recipients: recipientIds.length,
      suppressed_active_today: activeToday.size,
      suppressed_recent_reminder: remindedToday.size,
      activity_date: activityDate,
    });
  }

  const sendPushUrl = `${runtime.supabaseUrl}/functions/v1/send-push`;
  const results: Array<{
    user_id: string;
    status: "sent" | "failed" | "skipped";
    error_message?: string | null;
  }> = [];

  for (const userId of recipientIds) {
    try {
      const response = await fetch(sendPushUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${runtime.anonKey}`,
          apikey: runtime.anonKey,
          "x-push-dispatch-secret": dispatchSecret,
        },
        body: JSON.stringify({
          user_id: userId,
          kind: "daily_activity_reminder",
          title: "Seu Circle ainda está parado hoje",
          body: "Registre seu treino para manter sua consistência ativa.",
          priority: 5,
          data: {
            type: "daily_activity_reminder",
            activity_date: activityDate,
            target_id: activityDate,
            reminder_category: "training_or_post",
            suppress_if_active_today: "true",
            deep_link: "gymcircle://workout",
            url: "/?tab=checkin",
            collapse_id: `daily_activity_reminder:${userId}:${activityDate}`,
          },
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { sent?: number; failed?: number; noTargets?: boolean; error?: string }
        | null;

      if (!response.ok) {
        results.push({
          user_id: userId,
          status: "failed",
          error_message: payload?.error ?? `send_push_${response.status}`,
        });
      } else if (payload?.noTargets) {
        results.push({ user_id: userId, status: "skipped" });
      } else if ((payload?.sent ?? 0) > 0) {
        results.push({ user_id: userId, status: "sent" });
      } else if ((payload?.failed ?? 0) > 0) {
        results.push({
          user_id: userId,
          status: "failed",
          error_message: "all_targets_failed",
        });
      } else {
        results.push({ user_id: userId, status: "skipped" });
      }
    } catch (error) {
      results.push({
        user_id: userId,
        status: "failed",
        error_message: error instanceof Error ? error.message : "send_failed",
      });
    }
  }

  if (results.length > 0) {
    await supabase.from("push_delivery_logs").insert(
      results.map((result) => ({
        user_id: result.user_id,
        type: "daily_activity_reminder",
        target_id: activityDate,
        status: result.status,
        error_message: result.error_message ?? null,
        sent_at: result.status === "sent" ? new Date().toISOString() : null,
      })),
    );
  }

  return jsonResponse({
    sent: results.filter((result) => result.status === "sent").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    total: results.length,
    activity_date: activityDate,
  });
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SignJWT, importPKCS8 } from "jose";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ApplicationServer,
  PushMessageError,
  Urgency,
  exportApplicationServerKey,
  exportVapidKeys,
  generateVapidKeys,
  importVapidKeys,
  type ExportedVapidKeys,
  type PushSubscription as BrowserPushSubscription,
} from "@negrel/webpush";

type PushData = Record<string, string>;

interface PushRequest {
  user_id: string;
  kind: string;
  title: string;
  body: string;
  data?: PushData;
  priority?: number;
  dry_run?: boolean;
}

interface DeviceTokenRow {
  token: string;
}

interface WebSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface DeliveryResult {
  provider: "apns" | "web_push";
  target: string;
  status: "sent" | "failed" | "skipped";
  code?: number;
  reason?: string;
  dead?: boolean;
}

type AdminClient = SupabaseClient<any, "public", "public", any, any>;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, apikey, content-type, x-push-dispatch-secret",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      connection: "keep-alive",
    },
  });
}

function requiredEnvironment() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase runtime environment is incomplete");
  }
  return { supabaseUrl, serviceRoleKey };
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

async function targetHash(target: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(target),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

let cachedDispatchSecret: string | null = null;

async function getDispatchSecret(
  supabase: AdminClient,
): Promise<string> {
  if (cachedDispatchSecret) return cachedDispatchSecret;
  const { data, error } = await supabase.rpc("edge_push_dispatch_secret");
  if (error || typeof data !== "string" || !data) {
    throw new Error("Push dispatch secret is unavailable");
  }
  cachedDispatchSecret = data;
  return data;
}

let cachedWebPush:
  | {
      server: ApplicationServer;
      publicKey: string;
    }
  | null = null;

async function getWebPushServer(
  supabase: AdminClient,
): Promise<{ server: ApplicationServer; publicKey: string }> {
  if (cachedWebPush) return cachedWebPush;

  const current = await supabase.rpc("edge_push_vapid_keys");
  if (current.error) throw new Error(current.error.message);

  let serializedKeys =
    typeof current.data === "string" && current.data ? current.data : null;

  if (!serializedKeys) {
    const generated = await generateVapidKeys({ extractable: true });
    const exported = await exportVapidKeys(generated);
    const stored = await supabase.rpc("edge_store_push_vapid_keys", {
      p_keys: JSON.stringify(exported),
    });
    if (stored.error || typeof stored.data !== "string" || !stored.data) {
      throw new Error(stored.error?.message ?? "Unable to persist VAPID keys");
    }
    serializedKeys = stored.data;
  }

  let exportedKeys: ExportedVapidKeys;
  try {
    exportedKeys = JSON.parse(serializedKeys) as ExportedVapidKeys;
  } catch {
    throw new Error("Stored VAPID keys are invalid");
  }

  const vapidKeys = await importVapidKeys(exportedKeys, {
    extractable: false,
  });
  const server = await ApplicationServer.new({
    contactInformation:
      Deno.env.get("VAPID_SUBJECT") ?? "https://gym-circle-rust.vercel.app",
    vapidKeys,
  });
  const publicKey = await exportApplicationServerKey(vapidKeys);
  cachedWebPush = { server, publicKey };
  return cachedWebPush;
}

let cachedApnsJwt: { token: string; expiresAt: number } | null = null;

function apnsConfigured(): boolean {
  return Boolean(
    Deno.env.get("APNS_KEY_P8") &&
      Deno.env.get("APNS_KEY_ID") &&
      Deno.env.get("APNS_TEAM_ID"),
  );
}

async function signApnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedApnsJwt && cachedApnsJwt.expiresAt > now + 60) {
    return cachedApnsJwt.token;
  }

  const keyP8 = Deno.env.get("APNS_KEY_P8")?.replace(/\\n/g, "\n");
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  if (!keyP8 || !keyId || !teamId) {
    throw new Error("APNs credentials are incomplete");
  }

  const key = await importPKCS8(keyP8, "ES256");
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .sign(key);

  cachedApnsJwt = { token, expiresAt: now + 50 * 60 };
  return token;
}

async function sendApnsAtEnvironment(args: {
  token: string;
  jwt: string;
  bundleId: string;
  environment: "production" | "sandbox";
  payload: Record<string, unknown>;
  priority: number;
}): Promise<DeliveryResult> {
  const host = args.environment === "production"
    ? "api.push.apple.com"
    : "api.sandbox.push.apple.com";

  try {
    const response = await fetch(
      `https://${host}/3/device/${args.token}`,
      {
        method: "POST",
        headers: {
          authorization: `bearer ${args.jwt}`,
          "apns-topic": args.bundleId,
          "apns-push-type": "alert",
          "apns-priority": String(args.priority),
          "apns-expiration": "0",
          "content-type": "application/json",
        },
        body: JSON.stringify(args.payload),
      },
    );

    if (response.ok) {
      return {
        provider: "apns",
        target: args.token,
        status: "sent",
        code: response.status,
      };
    }

    let reason = response.statusText || "apns_error";
    try {
      const responseBody = await response.json();
      if (typeof responseBody?.reason === "string") {
        reason = responseBody.reason;
      }
    } catch {
      // APNs pode responder sem JSON em falhas de transporte.
    }

    return {
      provider: "apns",
      target: args.token,
      status: "failed",
      code: response.status,
      reason,
      dead: response.status === 410,
    };
  } catch (error) {
    return {
      provider: "apns",
      target: args.token,
      status: "failed",
      code: 0,
      reason: error instanceof Error ? error.message : "network_error",
    };
  }
}

async function sendApns(args: {
  token: string;
  jwt: string;
  bundleId: string;
  environment: "production" | "sandbox";
  payload: Record<string, unknown>;
  priority: number;
}): Promise<DeliveryResult> {
  const first = await sendApnsAtEnvironment(args);
  if (
    first.status === "sent" ||
    !["BadDeviceToken", "DeviceTokenNotForTopic"].includes(first.reason ?? "")
  ) {
    return first;
  }

  // TestFlight/App Store usam production; builds assinadas para desenvolvimento
  // usam sandbox. O fallback permite que ambos convivam na mesma tabela.
  const fallbackEnvironment =
    args.environment === "production" ? "sandbox" : "production";
  const fallback = await sendApnsAtEnvironment({
    ...args,
    environment: fallbackEnvironment,
  });
  if (fallback.status === "sent") return fallback;

  return {
    ...fallback,
    reason: `${first.reason ?? "apns_error"} (${args.environment}) -> ${
      fallback.reason ?? "apns_error"
    } (${fallbackEnvironment})`,
    dead:
      first.reason === "BadDeviceToken" &&
      fallback.reason === "BadDeviceToken",
  };
}

async function sendWebPush(args: {
  server: ApplicationServer;
  row: WebSubscriptionRow;
  payload: PushRequest;
}): Promise<DeliveryResult> {
  const subscription: BrowserPushSubscription = {
    endpoint: args.row.endpoint,
    keys: {
      p256dh: args.row.p256dh,
      auth: args.row.auth,
    },
  };
  const url = args.payload.data?.url ?? "/";
  const notificationId = args.payload.data?.notification_id;

  try {
    await args.server.subscribe(subscription).pushTextMessage(
      JSON.stringify({
        title: args.payload.title,
        body: args.payload.body,
        url,
        tag: notificationId
          ? `gym-circle-${notificationId}`
          : `gym-circle-${args.payload.kind}`,
        kind: args.payload.kind,
        data: args.payload.data ?? {},
      }),
      {
        ttl: 24 * 60 * 60,
        urgency: Urgency.High,
        topic: args.payload.kind.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 32),
      },
    );

    return {
      provider: "web_push",
      target: args.row.endpoint,
      status: "sent",
      code: 201,
    };
  } catch (error) {
    if (error instanceof PushMessageError) {
      return {
        provider: "web_push",
        target: args.row.endpoint,
        status: "failed",
        code: error.response.status,
        reason:
          error.response.statusText || `web_push_${error.response.status}`,
        dead: error.isGone() || error.response.status === 404,
      };
    }
    return {
      provider: "web_push",
      target: args.row.endpoint,
      status: "failed",
      code: 0,
      reason: error instanceof Error ? error.message : "web_push_error",
    };
  }
}

async function writeDeliveryAudit(
  supabase: AdminClient,
  payload: PushRequest,
  results: DeliveryResult[],
): Promise<void> {
  if (results.length === 0) return;
  const notificationId = payload.data?.notification_id ?? null;
  const rows = await Promise.all(
    results.map(async (result) => ({
      notification_id: notificationId,
      user_id: payload.user_id,
      provider: result.provider,
      target_hash: await targetHash(result.target),
      status: result.status,
      provider_code: result.code ?? null,
      provider_reason: result.reason?.slice(0, 300) ?? null,
    })),
  );
  await supabase.from("push_delivery_attempts").insert(rows);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
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

  if (request.method === "GET") {
    try {
      const webPush = await getWebPushServer(supabase);
      return jsonResponse({ publicKey: webPush.publicKey });
    } catch (error) {
      return jsonResponse(
        {
          error:
            error instanceof Error ? error.message : "web_push_unavailable",
        },
        503,
      );
    }
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const expectedSecret = await getDispatchSecret(supabase);
    const providedSecret =
      request.headers.get("x-push-dispatch-secret") ?? "";
    if (!safeEquals(providedSecret, expectedSecret)) {
      return jsonResponse({ error: "unauthorized_dispatch" }, 401);
    }
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "auth_error" },
      500,
    );
  }

  let payload: PushRequest;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  if (
    !payload.user_id ||
    !payload.kind ||
    !payload.title ||
    !payload.body
  ) {
    return jsonResponse(
      { error: "user_id, kind, title and body are required" },
      400,
    );
  }

  const [tokensResult, subscriptionsResult] = await Promise.all([
    supabase
      .from("device_push_tokens")
      .select("token")
      .eq("user_id", payload.user_id)
      .eq("platform", "ios")
      .is("revoked_at", null),
    supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", payload.user_id),
  ]);

  if (tokensResult.error || subscriptionsResult.error) {
    return jsonResponse(
      {
        error:
          tokensResult.error?.message ??
          subscriptionsResult.error?.message ??
          "target_lookup_failed",
      },
      500,
    );
  }

  const tokens = (tokensResult.data ?? []) as DeviceTokenRow[];
  const subscriptions =
    (subscriptionsResult.data ?? []) as WebSubscriptionRow[];

  let webPush:
    | {
        server: ApplicationServer;
        publicKey: string;
      }
    | null = null;
  let webPushConfigError: string | null = null;
  try {
    webPush = await getWebPushServer(supabase);
  } catch (error) {
    webPushConfigError =
      error instanceof Error ? error.message : "web_push_unavailable";
  }

  const configuredEnvironment =
    Deno.env.get("APNS_ENVIRONMENT") === "sandbox"
      ? "sandbox"
      : "production";
  const bundleId = Deno.env.get("APNS_BUNDLE_ID") ?? "com.gymcircle.app";
  let apnsReady = false;
  let apnsConfigError: string | null = null;
  if (apnsConfigured()) {
    try {
      await signApnsJwt();
      apnsReady = true;
    } catch (error) {
      apnsConfigError =
        error instanceof Error ? error.message : "apns_configuration_error";
    }
  } else {
    apnsConfigError = "apns_credentials_missing";
  }

  if (payload.dry_run) {
    return jsonResponse({
      ready: apnsReady && Boolean(webPush),
      apns: {
        configured: apnsReady,
        error: apnsConfigError,
        environment: configuredEnvironment,
        bundleId,
        targets: tokens.length,
      },
      webPush: {
        configured: Boolean(webPush),
        error: webPushConfigError,
        targets: subscriptions.length,
      },
    });
  }

  const results: DeliveryResult[] = [];

  if (tokens.length > 0) {
    if (apnsReady) {
      try {
        const jwt = await signApnsJwt();
        const apnsPayload: Record<string, unknown> = {
          aps: {
            alert: { title: payload.title, body: payload.body },
            sound: "default",
            "thread-id": payload.kind,
            category: payload.kind,
          },
          ...(payload.data ?? {}),
          gymcircle_kind: payload.kind,
        };
        const priority = Math.min(10, Math.max(5, payload.priority ?? 10));
        results.push(
          ...(await Promise.all(
            tokens.map((row) =>
              sendApns({
                token: row.token,
                jwt,
                bundleId,
                environment: configuredEnvironment,
                payload: apnsPayload,
                priority,
              })
            ),
          )),
        );
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "apns_configuration_error";
        results.push(
          ...tokens.map((row) => ({
            provider: "apns" as const,
            target: row.token,
            status: "failed" as const,
            code: 0,
            reason,
          })),
        );
      }
    } else {
      results.push(
        ...tokens.map((row) => ({
          provider: "apns" as const,
          target: row.token,
          status: "failed" as const,
          code: 0,
          reason: apnsConfigError ?? "apns_credentials_missing",
        })),
      );
    }
  }

  if (subscriptions.length > 0) {
    if (webPush) {
      results.push(
        ...(await Promise.all(
          subscriptions.map((row) =>
            sendWebPush({ server: webPush.server, row, payload })
          ),
        )),
      );
    } else {
      results.push(
        ...subscriptions.map((row) => ({
          provider: "web_push" as const,
          target: row.endpoint,
          status: "failed" as const,
          code: 0,
          reason: webPushConfigError ?? "web_push_unavailable",
        })),
      );
    }
  }

  const deadTokens = results
    .filter((result) => result.provider === "apns" && result.dead)
    .map((result) => result.target);
  const deadEndpoints = results
    .filter((result) => result.provider === "web_push" && result.dead)
    .map((result) => result.target);

  await Promise.all([
    deadTokens.length > 0
      ? supabase
        .from("device_push_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .in("token", deadTokens)
      : Promise.resolve(),
    deadEndpoints.length > 0
      ? supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", deadEndpoints)
      : Promise.resolve(),
    writeDeliveryAudit(supabase, payload, results),
  ]);

  const sent = results.filter((result) => result.status === "sent").length;
  const failed = results.filter((result) => result.status === "failed").length;

  return jsonResponse({
    sent,
    failed,
    total: results.length,
    noTargets: results.length === 0,
    providers: {
      apns: {
        sent: results.filter(
          (result) => result.provider === "apns" && result.status === "sent",
        ).length,
        failed: results.filter(
          (result) => result.provider === "apns" && result.status === "failed",
        ).length,
      },
      webPush: {
        sent: results.filter(
          (result) =>
            result.provider === "web_push" && result.status === "sent",
        ).length,
        failed: results.filter(
          (result) =>
            result.provider === "web_push" && result.status === "failed",
        ).length,
      },
    },
    errors: await Promise.all(
      results
        .filter((result) => result.status === "failed")
        .map(async (result) => ({
          provider: result.provider,
          targetHash: await targetHash(result.target),
          code: result.code ?? 0,
          reason: result.reason ?? "unknown_error",
        })),
    ),
  });
});

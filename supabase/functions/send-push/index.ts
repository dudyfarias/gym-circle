// =====================================================================
// send-push — Sprint 10.4 (P0 #5 server-side fechado)
//
// Edge Function que despacha push notifications via APNS pros device
// tokens registrados em `device_push_tokens`. Disparada pelos triggers
// de domínio (achievement unlocked, monthly challenge completed) ou
// chamadas RPC manuais.
//
// Payload de entrada (POST JSON):
//   {
//     user_id: string (uuid)
//     kind:    "achievement_unlock" | "challenge_complete" | "custom"
//     title:   string
//     body:    string
//     data?:   Record<string, string>   // chaves customizadas no aps
//     priority?: number                  // 1-10, default 10 (high)
//   }
//
// Env vars necessárias (set via Supabase Dashboard → Edge Functions → Secrets):
//   APNS_KEY_P8        — corpo da .p8 inteira (inclui BEGIN/END PRIVATE KEY)
//   APNS_KEY_ID        — 10 chars Apple Developer Portal
//   APNS_TEAM_ID       — 10 chars Apple Developer Portal
//   APNS_BUNDLE_ID     — com.gymcircle.app (production) / com.gymcircle.app.dev
//   APNS_ENVIRONMENT   — "production" ou "sandbox" (TestFlight usa sandbox)
//
// Response: { sent: number, failed: number, errors: Array<{ token, code, reason }> }
// =====================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SignJWT, importPKCS8 } from "jose";
import { createClient } from "@supabase/supabase-js";

// ---------- Types ----------

type PushKind = "achievement_unlock" | "challenge_complete" | "custom";

interface PushRequest {
  user_id: string;
  kind: PushKind;
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: number;
}

interface DeviceTokenRow {
  token: string;
  platform: string;
}

interface ApnsResult {
  token: string;
  code: number;
  reason?: string;
}

// ---------- APNS JWT signing ----------

let cachedJwt: { token: string; expiresAt: number } | null = null;

async function signApnsJwt(): Promise<string> {
  // JWT pode ser reutilizado por até 1h. Apple recomenda 20 min - 1h.
  // Cache em memória do isolate; novo cold start = novo JWT (OK).
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.expiresAt > now + 60) {
    return cachedJwt.token;
  }

  const keyP8 = Deno.env.get("APNS_KEY_P8");
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");

  if (!keyP8 || !keyId || !teamId) {
    throw new Error(
      "APNS_KEY_P8 / APNS_KEY_ID / APNS_TEAM_ID precisam estar setadas via Dashboard Secrets",
    );
  }

  const key = await importPKCS8(keyP8, "ES256");
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .sign(key);

  cachedJwt = { token, expiresAt: now + 50 * 60 }; // refresh aos 50min
  return token;
}

// ---------- APNS request ----------

interface SendOneArgs {
  token: string;
  jwt: string;
  bundleId: string;
  environment: "production" | "sandbox";
  payload: Record<string, unknown>;
  priority: number;
}

async function sendOne(args: SendOneArgs): Promise<ApnsResult> {
  const host = args.environment === "production"
    ? "api.push.apple.com"
    : "api.sandbox.push.apple.com";
  const url = `https://${host}/3/device/${args.token}`;

  try {
    const res = await fetch(url, {
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
    });

    if (res.status === 200) {
      return { token: args.token, code: 200 };
    }

    // 410 Gone: device token inválido (uninstall / disable notifs)
    // 4xx outros: payload ou auth errado
    // 5xx: APNS interno — caller retry policy do retorno
    let reason: string | undefined;
    try {
      const body = await res.json();
      reason = typeof body?.reason === "string" ? body.reason : undefined;
    } catch {
      // body vazio (HTTP/2 200 normalmente é)
    }
    return { token: args.token, code: res.status, reason };
  } catch (err) {
    return {
      token: args.token,
      code: 0,
      reason: err instanceof Error ? err.message : "network_error",
    };
  }
}

// ---------- Edge handler ----------

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: PushRequest;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!payload.user_id || !payload.title || !payload.body || !payload.kind) {
    return new Response(
      "user_id, kind, title e body são obrigatórios",
      { status: 400 },
    );
  }

  // Service role: acesso direto a device_push_tokens (bypass RLS) é
  // necessário pra ler tokens de outros users (caso a function seja
  // disparada por trigger server-side).
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response("Supabase env missing", { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: tokens, error: tokensErr } = await supabase
    .from("device_push_tokens")
    .select("token, platform")
    .eq("user_id", payload.user_id)
    .eq("platform", "ios")
    .is("revoked_at", null);

  if (tokensErr) {
    return new Response(
      JSON.stringify({ error: tokensErr.message }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  if (!tokens || tokens.length === 0) {
    return new Response(
      JSON.stringify({ sent: 0, failed: 0, errors: [], reason: "no_active_tokens" }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  // ---------- APNS dispatch ----------

  const bundleId = Deno.env.get("APNS_BUNDLE_ID");
  const environment = (Deno.env.get("APNS_ENVIRONMENT") ?? "sandbox") as
    | "production"
    | "sandbox";
  if (!bundleId) {
    return new Response("APNS_BUNDLE_ID missing", { status: 500 });
  }

  let jwt: string;
  try {
    jwt = await signApnsJwt();
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : "jwt_sign_failed",
      { status: 500 },
    );
  }

  // APNS payload: alert + custom data + categoryId pra UNNotificationCategory
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

  const priority = payload.priority ?? 10;
  const results = await Promise.all(
    (tokens as DeviceTokenRow[]).map((row) =>
      sendOne({
        token: row.token,
        jwt,
        bundleId,
        environment,
        payload: apnsPayload,
        priority,
      })
    ),
  );

  // ---------- Mark dead tokens as revoked ----------

  const dead = results.filter((r) => r.code === 410).map((r) => r.token);
  if (dead.length > 0) {
    await supabase
      .from("device_push_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .in("token", dead);
  }

  const sent = results.filter((r) => r.code === 200).length;
  const failed = results.length - sent;
  const errors = results.filter((r) => r.code !== 200);

  return new Response(
    JSON.stringify({ sent, failed, errors, total: results.length }),
    {
      status: 200,
      headers: { "content-type": "application/json", connection: "keep-alive" },
    },
  );
});

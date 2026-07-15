// Sprint 21.2 — login por username 100% server-side.
//
// Substitui o RPC resolve_email_for_username exposto pro anon (advisor
// 0028): qualquer pessoa sem login conseguia converter username → e-mail
// (colheita pra phishing). Aqui o e-mail é resolvido com service role
// DENTRO da função e nunca volta pro cliente — a resposta é só a sessão.
//
// Anti-enumeração: username inexistente e senha errada devolvem EXATAMENTE
// o mesmo erro genérico.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { cleanUsername, escapeIlikeLiteral } from "./username.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Mesmo erro pra qualquer falha de credencial — sem oráculo de existência.
const invalidCredentials = () => json(400, { error: "invalid_credentials" });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let username = "";
  let password = "";
  try {
    const body = await req.json();
    username = cleanUsername(String(body?.username ?? ""));
    password = String(body?.password ?? "");
  } catch {
    return invalidCredentials();
  }
  if (username.length < 3 || password.length === 0) {
    return invalidCredentials();
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("user_id")
    // Não delega case-sensitivity à resolução implícita de operadores do
    // PostgREST/citext. ILIKE torna Dudy, dudy e DUDY equivalentes. O padrão é
    // escapado para que '_' de um username seja literal, não wildcard SQL.
    .ilike("username", escapeIlikeLiteral(username))
    .maybeSingle();
  if (!profile?.user_id) return invalidCredentials();

  const { data: userData } = await admin.auth.admin.getUserById(
    profile.user_id,
  );
  const email = userData?.user?.email;
  if (!email) return invalidCredentials();

  // Autentica via endpoint de token padrão (anon key) — rate limits do
  // GoTrue continuam valendo.
  const tokenRes = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
  );
  if (!tokenRes.ok) return invalidCredentials();

  const session = await tokenRes.json();
  return json(200, {
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      token_type: session.token_type,
    },
  });
});

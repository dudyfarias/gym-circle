# Sprint 10.4 — APNS Push Setup Guide

Edge Function `send-push` está **deployed e ativa** em prod
(`qajjpjmybmqqwflytcpr`), aguardando 5 secrets configurados via
Supabase Dashboard pra começar a despachar pushes via APNS.

Endpoint: `https://qajjpjmybmqqwflytcpr.functions.supabase.co/send-push`

---

## 1. Gerar APNS Key no Apple Developer Portal

1. Acesse https://developer.apple.com/account → **Certificates, Identifiers & Profiles** → **Keys** (sidebar)
2. Clique **+** pra criar uma key
3. Nome: `Gym Circle APNS Key` (ou qualquer label seu)
4. Marque **Apple Push Notifications service (APNs)**
5. **Configure** → escolha o environment (geralmente "Sandbox & Production")
6. **Continue** → **Register**
7. **DOWNLOAD** o arquivo `.p8` (você só pode baixar uma vez! Guarde em local seguro)
8. Anote os 2 valores que aparecem na tela:
   - **Key ID** (10 chars, ex: `ABC1234DEF`)
   - **Team ID** (10 chars, no canto superior direito ou em Membership)

## 2. Confirmar Bundle ID

O bundle ID precisa bater com `CFBundleIdentifier` do Info.plist:
- **TestFlight/dev**: provavelmente `com.gymcircle.app.dev` ou similar
- **Prod App Store**: `com.gymcircle.app` ou similar

Verifique em `ios/App/App.xcodeproj/project.pbxproj` → procure `PRODUCT_BUNDLE_IDENTIFIER`.

## 3. Setar Secrets no Supabase Dashboard

1. Acesse https://supabase.com/dashboard/project/qajjpjmybmqqwflytcpr
2. **Edge Functions** (sidebar) → **Secrets** (aba)
3. Adicione os 5 secrets:

| Secret | Valor | Notas |
|--------|-------|-------|
| `APNS_KEY_P8` | Conteúdo inteiro do `.p8` (incluir as linhas `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----`) | Multi-linha, paste como está |
| `APNS_KEY_ID` | 10 chars (ex: `ABC1234DEF`) | Apple Portal |
| `APNS_TEAM_ID` | 10 chars (ex: `XYZ9876UVW`) | Apple Portal (Membership) |
| `APNS_BUNDLE_ID` | `com.gymcircle.app.dev` (TestFlight) ou `com.gymcircle.app` (prod) | Bate com Info.plist |
| `APNS_ENVIRONMENT` | `sandbox` (TestFlight) ou `production` (App Store) | Sandbox usa `api.sandbox.push.apple.com` |

## 4. Testar via curl

Pega um token real do `device_push_tokens` (você pode logar no app uma vez,
ele registra automaticamente via NativePushController):

```sql
-- via SQL Editor do Dashboard:
SELECT user_id, token FROM device_push_tokens
WHERE platform = 'ios' AND revoked_at IS NULL
LIMIT 1;
```

Depois dispara um teste:

```bash
SUPABASE_ANON="seu_anon_key_aqui"
USER_ID="uuid_do_user_acima"

curl -X POST \
  "https://qajjpjmybmqqwflytcpr.functions.supabase.co/send-push" \
  -H "Authorization: Bearer $SUPABASE_ANON" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$USER_ID\",
    \"kind\": \"custom\",
    \"title\": \"Gym Circle\",
    \"body\": \"Teste de push notification!\",
    \"data\": { \"deeplink\": \"gymcircle://achievements\" }
  }"
```

Response esperado quando tudo OK:
```json
{ "sent": 1, "failed": 0, "errors": [], "total": 1 }
```

Outros casos:
- `{ "sent": 0, "failed": 0, "reason": "no_active_tokens" }` — user sem tokens
- `{ "sent": 0, "failed": 1, "errors": [{ "code": 410, "reason": "Unregistered" }] }`
  — token foi auto-marcado como `revoked_at = now()` pelo function
- HTTP 500 `APNS_KEY_P8 / APNS_KEY_ID / APNS_TEAM_ID precisam estar setadas`
  — secrets faltando

## 5. Integrar do JS (web/native)

Já existe `PushService` em `packages/core/src/services/push.ts`. Pra
disparar push manualmente do code (ex: backend RPC, edge function de
domínio):

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

await supabase.functions.invoke("send-push", {
  body: {
    user_id: targetUserId,
    kind: "achievement_unlock",
    title: "Você desbloqueou!",
    body: "Vencedor — 30 dias seguidos no Gym Circle",
    data: { achievement_id: "streak_30" },
  },
});
```

## 6. Integrar via trigger SQL (auto-dispatch on event)

Pra disparar automaticamente quando achievement é gravado em prod,
precisa da extension `pg_net` e uma RPC `notify_push`. Setup:

```sql
-- 1. Habilitar pg_net (Dashboard → Database → Extensions → pg_net)
create extension if not exists pg_net with schema extensions;

-- 2. RPC helper que chama a Edge Function:
create or replace function private.dispatch_push(
  p_user_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
as $$
declare
  v_function_url text := 'https://qajjpjmybmqqwflytcpr.functions.supabase.co/send-push';
  v_service_key text := current_setting('app.settings.service_role_key', true);
begin
  perform extensions.http_post(
    v_function_url,
    jsonb_build_object(
      'user_id', p_user_id,
      'kind', p_kind,
      'title', p_title,
      'body', p_body,
      'data', p_data
    )::text,
    'application/json',
    array[
      ('Authorization', 'Bearer ' || v_service_key)::extensions.http_header
    ]
  );
end;
$$;

-- 3. Trigger em user_achievements INSERT:
create or replace function private.notify_achievement_unlock()
returns trigger
language plpgsql
security definer
as $$
begin
  -- só notifica novos (não dispara em re-celebrate)
  if TG_OP = 'INSERT' then
    perform private.dispatch_push(
      NEW.user_id,
      'achievement_unlock',
      'Conquista desbloqueada!',
      'Toque para ver',
      jsonb_build_object('achievement_id', NEW.achievement_id)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists user_achievements_after_insert_notify on public.user_achievements;
create trigger user_achievements_after_insert_notify
  after insert on public.user_achievements
  for each row
  execute function private.notify_achievement_unlock();
```

**Atenção**: triggers síncronos no DB podem atrasar o INSERT original.
Em produção considere fila assíncrona (pg_cron + queue table) ou
deixar o disparo no app callsite (mais previsível).

## 7. Troubleshooting

| Sintoma | Provável causa |
|---------|----------------|
| 401 `Unauthorized` da Edge | Authorization header faltando (verify_jwt=true) |
| 500 `Supabase env missing` | SUPABASE_URL/SERVICE_ROLE_KEY ausentes (Supabase preenche auto, mas confirme) |
| 500 `APNS_*` missing | Secrets do step 3 não foram salvos |
| `failed: N` com `code: 403` `reason: "InvalidProviderToken"` | JWT errado: KEY_ID, TEAM_ID, ou KEY_P8 corrompido |
| `failed: N` com `code: 400` `reason: "BadDeviceToken"` | Token errado pro environment (sandbox vs production mismatch) |
| `failed: N` com `code: 410` `reason: "Unregistered"` | Esperado quando user desinstalou — function já marca `revoked_at` |
| `code: 0 network_error` | APNS unreachable (raríssimo) |

## 8. Roadmap

Esta sprint cobriu o **server-side dispatch**. Próximas:

- **Sprint 10.5 (futuro)**: Trigger automático em user_achievements + 
  user_monthly_challenge_progress.completed_at
- **Sprint 10.6 (futuro)**: Rich notifications (image attachments com
  achievement icon)
- **Sprint 10.7 (futuro)**: UNNotificationServiceExtension iOS pra
  modificar payload antes de mostrar (decryption, image download)

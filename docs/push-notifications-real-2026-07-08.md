# Sprint Push Notifications Real — 2026-07-08

## Estado inicial do repositório

Branch: `main`.

Antes da sprint havia arquivos sujos fora de escopo:

- `ios-native/GymCircleNative/GymCircleNative.xcodeproj/project.pbxproj`
- `android/`
- `ios/App/App/config 2.xml`

Esses arquivos não pertencem à sprint de push do app Capacitor e devem ficar fora do commit, salvo decisão explícita.

## Diagnóstico

O app Capacitor já tinha uma base razoável de push:

- `@capacitor/push-notifications` instalado no root e em `apps/web`.
- `NativePushController` montado no shell autenticado (`LiveHomeWrapper`).
- `PushNotificationsService` com `checkPermissions`, `requestPermissions`, `register`, listeners e persistência de token.
- `ios/App/App/AppDelegate.swift` repassa sucesso/erro APNs para o plugin Capacitor.
- `ios/App/App/App.entitlements` usa `aps-environment = $(APS_ENVIRONMENT)`.
- O target iOS Capacitor possui Push Notifications capability e Background Mode `remote-notification`.
- `device_push_tokens` existe com RLS para o próprio usuário inserir/atualizar/revogar token.
- `send-push` já existia como Edge Function para APNs/Web Push.
- `notifications -> private.dispatch_push -> send-push` já existia para eventos sociais.

O problema principal estava em transformar essa fundação em fluxo robusto de produção:

1. O CTA de permissão precisava permitir retry quando `register()` falhava, em vez de virar uma tela sem saída.
2. O app recebia payload de push, mas não havia navegação centralizada para deep links.
3. O `send-push` esperava `APNS_KEY_P8`; a convenção pedida nesta sprint é `APNS_PRIVATE_KEY`.
4. O payload APNs precisava carregar `type`, `deep_link` e `collapse_id` padronizados.
5. O reminder diário ainda não tinha função dedicada com anti-spam e regra “não lembrar quem já treinou/postou hoje”.
6. A trigger social precisava reforçar no servidor: não enviar para si mesmo, respeitar bloqueios e mutes.

Se o app ainda não aparecer em Ajustes > Notificações no iPhone depois dessas mudanças, as causas mais prováveis fora do repo são:

- build instalado ainda não é o build atualizado;
- App ID/provisioning profile no Apple Developer não tem Push Notifications habilitado;
- `register()` está falhando por entitlement/profile/APNs;
- o app foi instalado por um canal cujo profile não contém o entitlement de push.

## Arquivos alterados

- `apps/web/src/components/gym-circle/NativePushController.tsx`
- `apps/web/src/components/gym-circle/native/PushNotificationsService.ts`
- `apps/web/src/components/gym-circle/native/pushDeepLinks.ts`
- `apps/web/src/components/gym-circle/native/pushDeepLinks.test.ts`
- `apps/web/src/components/gym-circle/GymCirclePreview.tsx`
- `apps/web/src/i18n/locales/pt-BR.json`
- `apps/web/src/i18n/locales/en.json`
- `supabase/functions/send-push/index.ts`
- `supabase/functions/send-daily-activity-reminders/index.ts`
- `supabase/functions/send-daily-activity-reminders/reminder-selection.ts`
- `supabase/functions/send-daily-activity-reminders/reminder-selection.test.ts`
- `supabase/functions/send-daily-activity-reminders/deno.json`
- `supabase/migrations/20260708150908_push_notifications_real.sql`

## Fluxo final no app

1. Usuário faz login.
2. `NativePushController` instala os listeners do Capacitor.
3. Se a permissão já estiver `granted`, o app registra o device em background.
4. Se estiver `prompt`, o app mostra CTA contextual:
   - título: `Ativar notificações`
   - texto: `Receba avisos de mensagens, curtidas, comentários e lembretes para manter seu Circle ativo.`
   - botões: `Agora não` e `Ativar`
5. Ao tocar em `Ativar`, o app chama `PushNotifications.requestPermissions()`.
6. Se o iOS permitir, chama `PushNotifications.register()`.
7. O token recebido é salvo em `public.device_push_tokens` via usuário autenticado.
8. Logout revoga o token salvo localmente e marca `revoked_at` no Supabase.

O CTA não insiste toda hora. Se o usuário recusar, há cooldown local. Se houver falha técnica de registro, o botão `Ativar` continua disponível para retry.

Para a publicação desta sprint, a chave local do CTA foi elevada para
`gym-circle.push-permission-cta.v2`. Isso faz a solicitação aparecer novamente
para todos os usuários elegíveis quando abrirem o app, mesmo que já tenham
fechado a versão anterior do convite. Usuários que já negaram a permissão no
iOS veem uma orientação para reativar manualmente em Ajustes > Notificações,
pois o iOS não permite reabrir o popup nativo depois da negação.

## Token no Supabase

Tabela usada: `public.device_push_tokens`.

Campos relevantes:

- `user_id`
- `platform = ios`
- `token`
- `device_id`
- `app_version`
- `last_seen_at`
- `revoked_at`

SQL de diagnóstico:

```sql
select
  user_id,
  platform,
  left(token, 12) as token_prefix,
  device_id,
  app_version,
  created_at,
  updated_at,
  last_seen_at,
  revoked_at
from public.device_push_tokens
order by created_at desc
limit 20;
```

## Backend APNs

Edge Function principal: `supabase/functions/send-push`.

Ela:

- valida `x-push-dispatch-secret`;
- busca tokens ativos;
- ignora tokens revogados;
- envia APNs;
- grava tentativa em `push_delivery_attempts`;
- marca token inválido como revogado;
- usa `apns-collapse-id` quando disponível.

Secrets necessários fora do repo:

- `APNS_KEY_ID`
- `APNS_TEAM_ID`
- `APNS_BUNDLE_ID` (`com.gymcircle.app`)
- `APNS_PRIVATE_KEY` (também há fallback para o legado `APNS_KEY_P8`)
- `APNS_ENVIRONMENT` (`production` para TestFlight/App Store; `sandbox` para debug)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

Nenhum secret deve ser commitado.

## Eventos sociais

Eventos continuam nas tabelas/fluxos já existentes:

- mensagem cria `public.notifications` com `kind = new_message`;
- curtida cria `kind = like`;
- comentário cria `kind = comment`/`comment_reply`/`mention`.

A migration desta sprint substitui `private.notify_social_push()` para gerar payloads APNs padronizados:

- `message`
- `post_like`
- `post_comment`

Regras no servidor:

- não envia push para o próprio usuário;
- não envia se houver bloqueio entre autor e destinatário;
- não envia se o destinatário silenciou posts do autor;
- não envia se o destinatário silenciou stories do autor;
- usa `collapse_id` por conversa/post para reduzir rajadas.

## Reminder diário

Nova Edge Function: `supabase/functions/send-daily-activity-reminders`.

Critério:

- candidatos vêm de `device_push_tokens` ativos;
- usuários com linha em `user_activity_days` no dia são excluídos;
- usuários que receberam reminder nas últimas 20 horas são excluídos;
- envio máximo por lote: 500;
- timezone padrão: `America/Sao_Paulo`;
- payload abre `gymcircle://workout`.
- agendamento server-side: `cron.job` `gym-circle-daily-activity-reminders`,
  `5 21 * * *` (18:05 America/Sao_Paulo).
- a chamada agendada usa `pg_net` e `push_dispatch_secret` vindo do Vault.

Log dedicado:

- `public.push_delivery_logs`
- `type = daily_activity_reminder`
- `target_id = YYYY-MM-DD`

Dry run sugerido:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/send-daily-activity-reminders" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "x-push-dispatch-secret: $PUSH_DISPATCH_SECRET" \
  -d '{"dry_run":true,"limit":20}'
```

## Deep links suportados

- `gymcircle://chat/{conversation_id}` -> Chat
- `gymcircle://post/{post_id}` -> detalhe do post
- `gymcircle://post/{post_id}?comments=true` -> detalhe + comentários
- `gymcircle://create` -> criação
- `gymcircle://workout` -> tela de treino
- `gymcircle://notifications` -> notificações

Fallback web:

- `/?tab=chat`
- `/?post={post_id}`
- `/?post={post_id}&comments=1`
- `/?tab=checkin`
- `/?notifications=1`

Se o destino falhar, o app cai no feed.

## Migration

Migrations criadas, aditivas e não destrutivas:

- `supabase/migrations/20260708150908_push_notifications_real.sql`
- `supabase/migrations/20260708190741_schedule_daily_activity_reminders.sql`

Elas criam `public.push_delivery_logs`, atualizam
`private.notify_social_push()` e agendam o reminder diário.

Importante: `db push` está bloqueado porque o histórico remoto possui versões
que não existem localmente. Por isso, as migrations foram aplicadas em produção
via `supabase db query --linked --file ...`, mantendo os arquivos versionados no
repo.

## Checklist manual no iPhone físico

1. Gerar build iOS Capacitor atualizado.
2. Instalar em iPhone físico.
3. Fazer login.
4. Ver CTA de notificações.
5. Tocar em `Ativar`.
6. Confirmar popup nativo do iOS.
7. Permitir.
8. Abrir Ajustes > Notificações.
9. Confirmar que Gym Circle aparece.
10. Confirmar token em `device_push_tokens`.
11. Enviar push de teste via `send-push`.
12. Enviar mensagem de outra conta.
13. Curtir post/treino de outra conta.
14. Comentar post/treino de outra conta.
15. Rodar dry-run do reminder.
16. Rodar reminder real em usuário de teste sem atividade no dia.
17. Tocar no push e validar destino.
18. Fazer logout e confirmar `revoked_at`.

## Pendências operacionais

- Configurar/validar secrets APNs no Supabase.
- Deploy das Edge Functions:
  - `send-push`
  - `send-daily-activity-reminders`
- Monitorar o primeiro disparo automático do reminder às 18:05 America/Sao_Paulo.
- Validar App ID/provisioning profile com Push Notifications no Apple Developer.
- Testar no iPhone físico; simulador não valida APNs real.

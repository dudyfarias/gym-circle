# Correção de permissão Push — Capacitor iOS

Data: 06/07/2026
Escopo: `ios/App` + cliente web carregado pelo Capacitor.
Fora do escopo: app SwiftUI paralelo e envio real de payloads via APNs.

## Causa

O plugin, a capability e os callbacks nativos estavam instalados. A falha era
de orquestração:

- o controller pós-login chamava o registro silencioso;
- o registro silencioso só continuava quando `checkPermissions()` retornava
  `granted`;
- no estado inicial `prompt`, nenhum ponto descobrível chamava
  `requestPermissions()`;
- `register()` sozinho não mostra o popup do iOS.

## Arquivos alterados

- `apps/web/src/components/gym-circle/NativePushController.tsx`
- `apps/web/src/components/gym-circle/native/PushNotificationsService.ts`
- `apps/web/src/components/gym-circle/native/PushNotificationsService.test.ts`
- `apps/web/src/components/gym-circle/native/nativeServices.test.ts`
- `apps/web/src/components/gym-circle/social/supabaseSocialActions.ts`
- `apps/web/src/components/gym-circle/GymCirclePreview.tsx`
- `apps/web/src/i18n/locales/pt-BR.json`
- `apps/web/src/i18n/locales/en.json`
- `ios/App/App/Info.plist`
- `docs/push-permission-audit.md`

Nenhum arquivo em `ios-native/` foi alterado.

## API final do serviço

`PushNotificationsService` expõe:

- `isAvailable()`
- `checkPermissions()`
- `requestPermissions()`
- `registerForPushNotifications(userId, push)`
- `unregisterDeviceToken(userId, push)`
- `setupListeners(userId, push)`
- `saveDeviceTokenToSupabase(userId, push, token)`
- `revokeDeviceTokenOnLogout(userId, push)`

Aliases temporários preservam callers antigos durante a transição.

## Fluxo final

1. O usuário autentica e `LiveHomeWrapper` monta `NativePushController`.
2. O controller confirma que está num shell Capacitor com o plugin disponível.
3. Instala os listeners:
   - `registration`
   - `registrationError`
   - `pushNotificationReceived`
   - `pushNotificationActionPerformed`
4. Consulta a permissão atual.
5. Se já for `granted`, aguarda 2,5 s e renova o token silenciosamente.
6. Se for `prompt`, aguarda 4 s e mostra o CTA:
   - “Agora não”: fecha e aplica cooldown de 30 dias por usuário.
   - “Ativar”: chama `requestPermissions()`.
7. Se o iOS devolver `granted`, chama `register()`.
8. O evento `registration` entrega o token APNs.
9. O token é salvo por upsert em `public.device_push_tokens` com:
   - `user_id`
   - `platform`
   - `token`
   - `device_id` estável por instalação
   - `app_version`
   - `last_seen_at`
   - `revoked_at = null`
10. No logout, o token é marcado com `revoked_at` antes do `signOut`.
11. Se a revogação falhar por rede, o token local é preservado para retry; a
    falha não é escondida nos logs de desenvolvimento.

## RLS

A tabela já estava corretamente protegida:

- RLS habilitado.
- `INSERT` exige `auth.uid() = user_id`.
- `SELECT` e `UPDATE` só enxergam a linha do próprio usuário.
- `UPDATE` possui `using` e `with check`.
- O cliente não possui nem usa `service_role`.

O grant de tabela para `anon` não concede leitura prática porque não existe
policy RLS para `anon`; nenhuma linha fica visível sem sessão autenticada.

## Logs

Logs aparecem apenas quando:

- `NODE_ENV !== production`; ou
- `NEXT_PUBLIC_PERF_DEBUG=true`.

Eventos:

- permission checked/requested;
- registration success/error;
- token saved/save failed;
- revoke/unregister success/error.

Tokens são sempre mascarados (`prefixo…sufixo`) e nunca são impressos
integralmente.

## Capability e assinatura

Target correto: `ios/App/App.xcodeproj`, target `App`.

- Push Notifications capability: habilitada.
- `App.entitlements`: `aps-environment = $(APS_ENVIRONMENT)`.
- Debug: `APS_ENVIRONMENT = development`.
- Release/TestFlight: `APS_ENVIRONMENT = production`.
- Background Mode `remote-notification`: presente.
- `AppDelegate.swift`: encaminha sucesso e falha de registro ao Capacitor.
- `cap sync ios`: confirmou `PushNotificationsPlugin`.

Não houve alteração de Team, certificado, provisioning profile ou bundle ID.

## Teste em iPhone físico

Há um iPhone físico conectado, mas o build assinado local foi bloqueado por:

- ausência da conta do Team `DXNPUU3PY8` no Xcode local;
- ausência de provisioning profile de desenvolvimento para
  `com.gymcircle.app`.

O projeto não foi alterado para contornar assinatura. Assim que a conta/team
for autenticada no Xcode:

1. Publicar o cliente web com esta correção, pois o shell aponta para
   `https://gym-circle-rust.vercel.app`.
2. Instalar build atualizado no iPhone.
3. Remover uma instalação antiga ou redefinir a permissão se o popup já tiver
   sido respondido anteriormente.
4. Abrir o app e autenticar.
5. Aguardar o CTA “Ativar notificações”.
6. Tocar em **Ativar**.
7. Confirmar que o popup do iOS aparece.
8. Permitir.
9. Abrir `Ajustes > Notificações` e localizar Gym Circle.
10. Validar o token:

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

## Verificações realizadas

- `npm run lint`
- `npm run build`
- `npm test -- --run`
- `npx cap sync ios`
- TypeScript sem erros
- Xcode Debug para iOS Simulator
- Xcode Release para `generic/platform=iOS`, sem assinatura
- configuração Debug/Release de `APS_ENVIRONMENT`
- RLS e policies consultadas diretamente no Supabase

## Próxima etapa separada

Implementar o envio real via APNs/Edge Function:

- chave APNs `.p8` somente em secret server-side;
- `team_id`, `key_id` e bundle topic fora do cliente;
- templates para mensagem, curtida, comentário e progresso;
- remoção/revogação de tokens inválidos após resposta do APNs;
- métricas de tentativa e entrega.

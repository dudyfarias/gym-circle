# Auditoria de permissão Push — Capacitor iOS

Data: 06/07/2026
Escopo: somente o app Capacitor em `ios/App` e o cliente web carregado por ele.
O app SwiftUI em `ios-native/` não faz parte desta correção.

## Resultado

A infraestrutura nativa estava presente, mas o fluxo pós-login não solicitava
permissão.

O `NativePushController` chamava `registerPushToken()`, cujo caminho interno
usava `requestPermission: false`. Quando o estado do iOS era `prompt`, o serviço
retornava `permission_denied` sem executar `PushNotifications.requestPermissions()`.
Como o usuário normalmente não encontrava o toggle enterrado em Configurações,
o popup do iOS nunca era apresentado e o app não passava a aparecer em
`Ajustes > Notificações`.

## Inventário auditado

| Item | Estado antes da correção |
|---|---|
| `package.json` raiz | `@capacitor/push-notifications@^8.1.1` instalado |
| `apps/web/package.json` | plugin também declarado |
| `capacitor.config.ts` | `presentationOptions` configurado |
| `ios/App/CapApp-SPM/Package.swift` | `CapacitorPushNotifications` integrado |
| `ios/App/App/AppDelegate.swift` | callbacks de sucesso/erro encaminhados ao Capacitor |
| Target Capacitor `App` | capability `com.apple.Push` habilitada |
| `App.entitlements` | `aps-environment = $(APS_ENVIRONMENT)` |
| Debug | `APS_ENVIRONMENT = development` |
| Release/TestFlight | `APS_ENVIRONMENT = production` |
| `Info.plist` | `remote-notification` presente em `UIBackgroundModes` |
| Montagem do controller | montado em `LiveHomeWrapper` após autenticação |
| `checkPermissions()` | existia |
| `requestPermissions()` | existia no serviço, mas só era alcançado pelo toggle manual |
| `register()` | existia e aguardava o evento `registration` |
| listener `registration` | existia apenas como listener temporário |
| listener `registrationError` | existia apenas como listener temporário |
| listener `pushNotificationReceived` | existia no controller |
| listener `pushNotificationActionPerformed` | existia no controller |
| Revogação no logout | existia, mas o erro era engolido e o token local era apagado mesmo assim |

## Banco e RLS

Tabela: `public.device_push_tokens`.

- RLS habilitado.
- `authenticated` pode selecionar, inserir e atualizar.
- Policies `SELECT`, `INSERT`, `UPDATE` e `DELETE` restringem por
  `(select auth.uid()) = user_id`.
- Um usuário autenticado não consegue ler nem alterar tokens de outro usuário.
- O cliente usa apenas a sessão autenticada e a chave pública do Supabase.
- Nenhuma `service_role` é usada no app.

## Causa raiz

1. O controller fazia apenas renovação silenciosa para quem **já** tinha
   permissão.
2. Para estado `prompt`, não existia CTA pós-login.
3. `PushNotifications.register()` não mostra o popup de permissão; no iOS ele
   precisa ser precedido por `requestPermissions()`.
4. O único caminho que chamava `requestPermissions()` era o toggle de
   Configurações, pouco descobrível.

## Riscos encontrados

- O `device_id` salvo era o `navigator.userAgent`, que não identifica de forma
  estável uma instalação.
- Logs de diagnóstico eram insuficientes para distinguir permissão, registro
  APNs e falha de persistência.
- A revogação no logout falhava silenciosamente.
- Os quatro listeners obrigatórios estavam divididos em dois componentes,
  dificultando garantir instalação/remoção consistente.

## Referências

- Capacitor v8: `requestPermissions()` é o método que mostra o popup na
  primeira chamada no iOS; `register()` apenas inicia o registro e emite
  `registration`/`registrationError`.
- Supabase: RLS em tabelas do schema `public`, com policies por usuário
  autenticado.

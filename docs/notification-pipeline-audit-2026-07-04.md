# Auditoria do pipeline de notificações — 2026-07-04

## Diagnóstico confirmado

O banco gerava normalmente os eventos sociais, mas o pipeline parava em
`public.notifications`. Na amostra dos 7 dias anteriores havia 34 curtidas,
18 mensagens e 13 comentários, porém:

- não existia trigger de push em `public.notifications`;
- a Edge Function `send-push` não tinha chamadas nas últimas 24 horas;
- só existia 1 token iOS ativo;
- existiam 0 inscrições Web Push;
- a função enviava somente para APNs, ignorando `push_subscriptions`;
- o ambiente APNs estava em `sandbox`, inadequado como destino primário de
  builds TestFlight/Release;
- o `AppDelegate` do Capacitor não encaminhava o token APNs ao plugin;
- o app Swift esperava apenas 900 ms pelo token e não o renovava no boot/login.

## Correções aplicadas

### Supabase

- Trigger `notifications_after_insert_push` para todos os sinais sociais.
- Textos de lock screen sem expor o conteúdo privado:
  - `X te enviou uma mensagem`;
  - `X curtiu seu treino`;
  - `X comentou no seu treino`.
- Fan-out da Edge Function para APNs e Web Push.
- VAPID gerado no primeiro uso e guardado cifrado no Supabase Vault.
- `APNS_ENVIRONMENT=production`, com fallback automático para `sandbox` em
  tokens de builds de desenvolvimento.
- Autenticação interna entre `pg_net` e a Edge Function; chamadas diretas de
  clientes retornam 401.
- Auditoria em `push_delivery_attempts`, armazenando somente SHA-256 do alvo.
- Tokens/subscrições mortos são revogados/removidos automaticamente.

### Web/PWA e Capacitor

- O PWA busca a chave VAPID pública da Edge Function e reassocia inscrições
  existentes no login/reabertura.
- Service worker atualizado para payload, URL e agrupamento corretos.
- `AppDelegate` encaminha sucesso/erro de registro ao plugin Capacitor 8.
- Registro de token com backoff em falhas transitórias.
- Entitlement APNs separado por configuração:
  `development` no Debug e `production` no Release.

### Swift nativo

- Espera resiliente de até 15 segundos pelo token APNs.
- Renovação automática no boot e após login, sem reabrir o prompt.
- Revogação do token no logout.
- Exibição de banner/lista/som/badge com o app em foreground.
- Entitlement APNs separado por Debug/Release.

## Verificações executadas

- ESLint: sem erros.
- TypeScript: sem erros.
- Vitest: 421/421 testes.
- Deno type-check da Edge Function: aprovado.
- Build iOS Capacitor (simulador): aprovado.
- Build iOS Swift (simulador): aprovado.
- Edge Function `send-push`: versão publicada e JWT obrigatório.
- Dry-run remoto: APNs configurado, JWT `.p8` assinado, bundle
  `com.gymcircle.app`, ambiente `production`, Web Push/VAPID configurado.
- Segurança: chamada direta sem segredo interno retorna HTTP 401.
- RLS: auditoria de entrega inacessível a `anon` e `authenticated`.

## Observação de release

O backend já está ativo. As correções do PWA, Capacitor e Swift passam a valer
para todos depois do próximo deploy web e da próxima build instalada no iPhone.
Após a atualização, o token é sincronizado automaticamente se a permissão já
estiver concedida.

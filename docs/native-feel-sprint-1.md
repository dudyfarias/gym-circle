# Gym Circle Native Feel Sprint 1

## Objetivo

Melhorar a sensação nativa no iPhone mantendo Capacitor + Next.js, sem reescrever o app e sem alterar o fluxo social principal.

## Decisão de autenticação

Nesta sprint, Apple Login e Google Login permanecem ocultos/desativados na interface.

Fluxo ativo: email/senha.

## Escopo

- Haptics
- Push notifications foundation
- Cache local leve
- Câmera/galeria nativa
- Apple Maps/location provider foundation
- Safe areas e keyboard polish
- Documentação da Sprint 2

## Fora do escopo

- Reescrever em Swift
- HealthKit completo
- Stories Viewer nativo completo
- Post Composer 100% nativo
- Mudanças grandes de UI
- Breaking changes
- Login Apple/Google na interface

## Checklist

| Item | Planejado | Implementado | Validado | Pendente |
| --- | --- | --- | --- | --- |
| Apple/Google Login ocultos na UI | Sim | Sim | Sim | Não |
| Email/senha preservado | Sim | Sim | Sim | Não |
| HapticsService com fallback web | Sim | Sim | Sim | Não |
| Haptics em ações sociais principais | Sim | Sim | Sim | Ajustar intensidade em iPhone real |
| Push token foundation | Sim | Sim | Sim | Envio push real |
| Tabela `device_push_tokens` com RLS | Sim | Sim | Sim remoto | Envio push real |
| Cache local leve | Sim | Sim | Sim | Expandir para IndexedDB na Sprint 2/3 |
| Limpar cache/token no logout | Sim | Sim | Sim | Não |
| NativeMediaPickerService | Sim | Sim | Sim | Vídeo avançado |
| Fallback web de câmera/galeria | Sim | Sim | Sim | Não |
| LocationProvider foundation | Sim | Sim | Sim | Apple Maps real |
| Safe area/keyboard polish | Sim | Sim | Parcial | Testar em iPhone real |
| Documentação Sprint 2 | Sim | Sim | Sim | Não |

## Implementação

- `HapticsService` usa `@capacitor/haptics` no iOS/Android e cai para `navigator.vibrate`/no-op na web.
- `NativeMediaPickerService` usa `@capacitor/camera` quando disponível e mantém os inputs web atuais como fallback.
- `PushNotificationsService` registra token nativo apenas com usuário autenticado e permissão concedida; não pede permissão no primeiro segundo do app.
- `device_push_tokens` é uma tabela aditiva para tokens APNs/FCM, separada de `push_subscriptions` PWA.
- Cache local leve usa `localStorage` com TTL curto e renderiza dados stale enquanto o Supabase revalida.
- `LocationProvider` mantém o provider web atual e deixa um placeholder de `AppleMapsProvider` para implementação nativa futura.

## Validações

- `npm run lint` passou
- `npm run build` passou
- `npm test -- --run` passou, 29 arquivos e 155 testes
- `npm run cap:sync:ios` passou
- Teste em iPhone real

## Supabase Remoto

- Migration aplicada no projeto `qajjpjmybmqqwflytcpr`: `20260521203900_native_feel_push_tokens.sql`
- Migration marcada como applied no histórico remoto.
- Validação SQL confirmou 10 colunas em `public.device_push_tokens`.
- Validação SQL confirmou RLS habilitado em `public.device_push_tokens`.

## Notas de Segurança

- Nenhum token secreto é salvo no cliente.
- Tokens nativos só são gravados após autenticação.
- Logout revoga o token salvo localmente e limpa caches nativos leves.
- Cache local não armazena mensagens privadas nem secrets.
- A migration de push é aditiva e usa RLS por `auth.uid()`.

## Hardening pós-Sprint 1 (2026-05-21)

Polish aplicado após code review do Sprint 1. Cinco itens, todos aditivos
e sem mudar comportamento observado em produção.

### 1. PushNotificationsService — listener cleanup

Bug: `addListener("registration"|"registrationError", …)` retorna
`Promise<PluginListenerHandle>`. O código original chamava `void addListener(...)`
e descartava o handle, então listeners ficavam pendurados após resolve/reject.
Em re-registros (ex: troca de usuário sem fechar o app) os listeners velhos
acumulavam.

Fix: `waitForNativeToken` agora `await`a o handle de cada listener, mantém
referência local, e `try/finally` chama `handle.remove()` independente de
sucesso, erro ou timeout. Removido o flag `settled` redundante — Promise é
"settle once" naturalmente.

Bônus: `void PushNotifications.register()` virou `await` — `register()` resolve
quando a chamada nativa foi disparada (rápido); o token chega via listener
depois. Await garante ordem.

### 2. NativeMediaPickerService — `media.type` simbolico

Antes: `const kind = media.type === 1 ? "video" : "image"`. Funciona porque
`MediaType.Video === 1` no `@capacitor/camera` v8, mas é magic number que
quebra silenciosamente se o enum mudar.

Fix: comparação contra `camera.MediaType.Video` (enum value, type-safe). Plus
refactor: `mediaResultToFile(media, kind: NativeMediaKind)` recebe `kind`
explícito porque `takePhoto`/`recordVideo` já sabem o tipo pelo método
chamado — só `chooseFromGallery` precisa inspecionar `media.type`.

### 3. HapticsService — module cache dos dynamic imports

Antes: cada chamada (`HapticsService.light()`, `.success()` etc) fazia 2
dynamic imports. Bundler cacheia internamente mas há overhead de lookup +
criação de Promise no path quente (haptics são chamados em burst, ex:
scrubbing, taps).

Fix: variável `cachedNativeModules: Promise<NativeHapticModules | null>` em
escopo de módulo, populada na primeira chamada. Catch retorna `null` se os
módulos não existirem (path web). Subsequentes chamadas reusam a Promise
resolvida.

### 4. LocationProvider — JSDoc no AppleMapsProvider

Sem mudança funcional. Adicionado JSDoc explícito marcando
`AppleMapsProvider` como **placeholder Sprint 1**, com referência ao Item B
do `native-feel-roadmap.md` para a implementação MapKit real (CoreLocation,
MKLocalSearch, CLGeocoder) que chega na Sprint 2. Sem isso, devs novos
poderiam assumir que o provider já fala com MapKit.

### 5. Tests — cobertura de unregisterPushToken

Adicionados 2 testes no `nativeServices.test.ts`:

- `unregisterPushToken revokes stored token and clears local storage`:
  pre-popula storage, chama unregister, valida que revoke foi com o token
  certo e que storage foi limpa.
- `unregisterPushToken is a no-op when no token was stored`: edge case de
  logout sem ter registrado push antes não pode falhar.

Total: 7/7 tests passam (5 originais + 2 novos).

### Validações pós-hardening

- `npm run lint` em `apps/web`: passou
- `npm run build` em `apps/web`: typecheck pleno em 3.2s, 12/12 páginas
  estáticas geradas
- `npx vitest run apps/web/src/components/gym-circle/native/nativeServices.test.ts`:
  7/7 passed em 252ms

## Estado

Sprint 1 implementada de forma incremental + hardening aplicado. O envio
real de push, Apple Maps nativo e transições nativas profundas ficam para
a Sprint 2.

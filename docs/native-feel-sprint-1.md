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

## Estado

Sprint 1 implementada de forma incremental. O envio real de push, Apple Maps nativo e transições nativas profundas ficam para a Sprint 2.

# Sprint 20 Native P0/P1/P2 — Completion Pass

Data: 2026-06-12

## Objetivo

Avançar o app SwiftUI standalone rumo ao corte 100% nativo, cobrindo os
itens P0/P1/P2 apontados na auditoria, exceto troféus/relíquias 3D.

## Escopo Implementado

### P0 — Release Safety

- `npm run check:main` rodou antes de editar: branch `main` correta.
- Nenhuma alteração em secrets, `.env`, signing team ou provisioning profiles.
- O app nativo continua usando `com.gymcircle.native.dev`; bundle de produção
  segue reservado para o cutover.
- Permissões iOS foram humanizadas no `Info.plist`.

### P1 — Paridade Funcional

- Check-in nativo MVP:
  - nova `CheckInView`;
  - busca academia cadastrada;
  - localização atual via CoreLocation;
  - busca de lugares próximos via Apple Maps/MapKit;
  - catalogação segura de lugar novo com coordenadas obrigatórias;
  - inserção em `checkins`;
  - acesso pela tela `Criar`.
- Chat nativo:
  - envio de foto pelo bucket `chat-media`;
  - renderização de imagem nas bolhas;
  - criação de grupo via RPC `create_group_conversation`;
  - polling leve na conversa aberta enquanto o realtime websocket nativo não
    vira padrão.
- Stories nativos:
  - share via `ShareLink`;
  - silenciar autor via `story_mutes`;
  - composer pode publicar a primeira mídia também como story.
- Push:
  - AppDelegate captura token APNs;
  - `NativePushNotificationsService` registra/revoga token em
    `device_push_tokens`;
  - ação manual em Settings.

### P2 — Native Feel / Infra Futura

- `NativeLocationProvider` com:
  - posição atual;
  - busca Apple Maps;
  - lugares próximos;
  - reverse geocode;
  - distância Haversine via CoreLocation;
  - formatação `m`/`km`.
- `HealthKitService` com:
  - protocolo `HealthKitProviding`;
  - `AppleHealthKitProvider`;
  - leitura futura de workouts, duração e calorias;
  - fallback seguro quando HealthKit não está disponível.
- Entitlements nativos preparados:
  - Push Notifications;
  - Associated Domains;
  - HealthKit.

## Fora do Escopo Desta Rodada

- Troféus/relíquias 3D e Hall 3D premium.
- Realtime websocket nativo completo; por enquanto chat usa polling leve na
  conversa aberta.
- Envio de vídeo no chat.
- Deep link routing visual completo a partir de push/universal link.
- Cutover para `com.gymcircle.app`.
- Upload automático de workouts do HealthKit para o Supabase.

## Observações de App Store / Xcode

Antes de testar em iPhone real com o app standalone:

1. Habilitar no Apple Developer App ID usado pelo target:
   - Push Notifications;
   - Associated Domains;
   - HealthKit.
2. Garantir provisioning profile compatível com
   `Support/GymCircleNative.entitlements`.
3. Para o cutover, trocar bundle id somente na fase 20.8.

## Validação Esperada

- `npm run check:main`
- `xcodegen generate`
- `xcodebuild -project ios-native/GymCircleNative/GymCircleNative.xcodeproj -scheme GymCircleNative -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test`

## Próximo Corte Recomendado

1. Deep link router real: push tap -> post/story/chat/profile.
2. RealtimeService websocket nativo para chat/notificações.
3. MediaLoader/AVPlayer cache nativo.
4. HealthKit recap opt-in.
5. Cutover checklist para `com.gymcircle.app`.

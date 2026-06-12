# Sprint 20 — App 100% Nativo SwiftUI (plano mestre)

> Kickoff: 11/jun/2026 (compromisso do Eduardo). Épico multi-fase: substituir o
> shell Capacitor pelo app SwiftUI standalone, **mantendo o híbrido por tela
> até o cutover** — o deploy remoto (server.url) é a vantagem de iteração do
> projeto e só morre no final.

## Estado de partida (auditado 11/jun)

- `ios-native/GymCircleNative`: app target standalone REAL (`com.gymcircle.native.dev`),
  XcodeGen + SwiftPM, 46 arquivos, 14 telas espelho, 9 services, 4 suítes de teste.
- **Gap fundacional (resolvido na 20.0)**: o RootView criava o AppModel sem
  services → standalone bootava em modo demo; config era env-only (inexistente
  em build de distribuição).
- Drift TS↔Swift conhecido: regras de gamificação duplicadas (multi-tags
  portado na 20.0; recompute de desafios é web-only por design).
- Placeholders herdados da pausa pós-Sprint 9: Composer ("fica para a próxima
  sprint") e Chat ("fase futura") no MainTabView.

## Fases

| Fase | Escopo | Gate de saída |
|------|--------|---------------|
| **20.0 Fundação** ✅ (11/jun) | Config de produção via xcconfig→Info.plist (`AppConfiguration.fromBundle`/`resolve`), RootView conecta no Supabase real (demo só sem Secrets.xcconfig), port multi-tags + normalização no `getDistinctWorkoutTypes` (drift B10), decode defensivo, testes (AppConfigurationTests) | `xcodebuild` simulador verde + login real no standalone |
| **20.1 MyCircle + Hall** | Paridade total das telas já portadas + Hall estilo Apple (réplica da Sprint 15 web): AchievementsView ganha overview hero/destaque/grid de categorias + artefatos 3D (SceneKit ou Canvas/Metal — decidir spike) | Smoke lado a lado web vs nativo sem divergência de dados |
| **20.2 Profile + EditProfile + Settings** ✅ (12/jun) | OtherProfile/follows já existem; faltam Settings nativas (idioma, privacidade, suspender/apagar conta) | Fluxos de conta 100% nativos |
| **20.3 Feed completo (leitura + interações)** ✅ (12/jun — exceto distância→20.7) | FeedView ganha carrossel, likes, comments sheet (replies/likes de comentário), mute, distância | Feed nativo utilizável no dia a dia |
| **20.4 Composer nativo** ✅ (12/jun — mídia-no-edit→cutover) | PHPicker multi (até 10), câmera, upload Storage com thumbnail/poster, tags multi-select (até 5), localização — substitui o placeholder do MainTabView | Publicar carrossel + story pelo nativo |
| **20.5 Stories** ✅ (12/jun — share/mute pendentes; criação junto do post pendente) | Captura + viewer completo (progress, reply, like, share, mute) | Paridade com StoryViewer web |
| **20.6 Chat** ✅ (12/jun — mídia/criar grupo/realtime pendentes) | Conversas 1:1 + grupo via RPCs atômicas existentes; delete-for-me | Paridade ChatScreen |
| **20.7 Push + deep links** 🟡 (20.7a sino/routing ✅ 12/jun; APNs+universal links dependem de entitlement/Sprint 19) | Registro APNs nativo (device_push_tokens), tap de notificação navega; Associated Domains + universal links | Push end-to-end no standalone |
| **20.7b Check-in** | DECISÃO 12/jun (Eduardo): Check-in FICA — portar CheckInScreen + GymSearchSheet (~1.700 linhas web) pro SwiftUI; tabs nativas precisam acomodar a entrada | Check-in nativo com busca de academias |
| **20.8 Cutover** | Bundle id de produção, migração de sessão, remoção do WebView, submissão | App Store review aprovado |

## Pré-requisitos transversais (fazer ANTES das fases que dependem)

1. **Regras de gamificação server-side** (mata o drift na raiz): mover
   recompute de desafios + contagens de conquistas pra RPCs; web e Swift viram
   só renderizadores. Idealmente junto da Sprint 17 (gamificação viva).
2. **Sessão**: AuthService nativo já faz email/senha + Keychain; falta Apple/
   Google nativos (hoje ocultos por decisão) — decidir na 20.2.
3. **Versionamento**: bundle `com.gymcircle.native.dev` é DEV; produção usará
   `com.gymcircle.app` SÓ no cutover (mesmo id do shell — não podem coexistir
   na loja; durante o desenvolvimento o .dev instala lado a lado).

## Setup por máquina (1x)

```bash
cd ios-native/GymCircleNative
cp Config/Secrets.example.xcconfig Config/Secrets.xcconfig
# editar: colar a ANON key (mesma credencial pública do site)
xcodegen generate
open GymCircleNative.xcodeproj   # scheme GymCircleNative → iPhone simulator
```

Sem o `Secrets.xcconfig` o app builda e roda em **modo demo** (claramente
fake) — útil pra UI sem credenciais. CI/testes: env vars continuam valendo
como override.

## Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Perder o deploy remoto (todo fix = review) | Híbrido por tela até a 20.8; features novas continuam nascendo no web antes |
| Drift de regras durante a transição | Pré-requisito 1 (server-side) + testes de paridade (AchievementBuilderTests vs achievements.test.ts com fixtures espelhadas) |
| Decode frágil de RPCs no Swift | Padrão: campos opcionais + compactMap (aplicado na 20.0) |
| Artefatos 3D no SwiftUI (perf) | Spike na 20.1 antes de comprometer abordagem |
| Bundle id de produção é imutável | Cutover usa o `com.gymcircle.app` existente — o app da loja VIRA o nativo (update normal), sem app novo |

## Validação local

- `xcodegen generate` após mudar project.yml.
- Build/testes: `xcodebuild -project GymCircleNative.xcodeproj -scheme GymCircleNative -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build|test`
  (o `swift test` puro NÃO funciona — alvo é iOS/UIKit).

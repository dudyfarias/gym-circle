# Gym Circle Version 1.1 Roadmap

Data: 2026-05-30

## Principio

Nao criar feature nova antes de estabilizar as surfaces sociais existentes. A 1.1 deve parecer mais pronta porque as pecas atuais funcionam melhor, nao porque o app ficou maior.

## Sprint 0 - Audit & Planning

Objetivo: mapear tudo que existe.

Entregas:

- `version-1.1-master-plan.md`
- `version-1.1-audit.md`
- `feature-discovery-audit.md`
- `version-1.1-roadmap.md`
- `version-1.1-known-issues.md`
- `version-1.1-opportunities.md`

Gate de saida:

- Docs revisados.
- Lista de P0/P1 priorizada.
- Nenhuma alteracao de produto misturada.

## Sprint 1 - Stabilization Release

Objetivo: fechar bugs que afetam confianca.

Escopo:

- Chat delete/reopen e criacao de novo chat.
- Comments overlay sem foto/post junto.
- Tag notification accepted/rejected.
- Profile recovery/hardening e separacao FullProfile/ProfilePreview.
- Limpar ambiente local: `node_modules`, package-lock e testes.

Gate:

- `npm run lint`, `npm run build`, `npm test -- --run`, `npx cap sync ios` verdes em ambiente limpo.
- Commit pequeno por escopo.

## Sprint 2 - Social UI Polish

Objetivo: deixar feed/perfil/comentarios mais claros.

Escopo:

- Feed social clean.
- Comments bottom sheet com estado vazio, likes e delete proprio.
- Likes overlay.
- Followers/following overlay no perfil.
- Search abre perfil correto.

Gate:

- Smoke test em iPhone real: feed, comments, likes, profile, follow.

## Sprint 3 - Stories Reliability

Objetivo: stories estilo Instagram sem inconsistencias.

Escopo:

- Tray agrupado e leve.
- Viewer sob demanda.
- Viewed state persistente.
- Tag accepted/rejected sem botoes obsoletos.
- Reply/like/share/report/mute/unfollow.

Gate:

- Ver story, fechar app, reabrir: ring permanece apagado.
- Aceitar/recusar tag muda a UI corretamente.

## Sprint 4 - Chat Reliability

Objetivo: tornar DMs confiaveis.

Escopo:

- Conversation summaries sem duplicatas.
- Delete-for-me nao reabre conversa.
- Nova conversa por busca funciona.
- Mensagens de texto/foto/video.
- Unread count correto.

Gate:

- Testar direct, grupo, apagar, reabrir, enviar midia, responder story.

## Sprint 5 - Progress & Gamification

Objetivo: transformar consistencia em retencao.

Escopo:

- Meu Circle oficial.
- Monthly recap.
- Streak restore UX.
- Badges/conquistas leves.
- Planejamento de ranking.

Gate:

- Usuario entende streak, restorers e progresso sem dashboard tecnico.

## Sprint 6 - Native Feel (infra entregue, RC movido)

Status: **infra concluida ao longo das Sprints 3.x-5.x**. O TestFlight RC
foi movido pra Sprint 9 (pos SwiftUI) — nao faz sentido buildar candidate
com Capacitor se o app vai virar SwiftUI nativo na Sprint 8.

Entregas ja em producao:

- Haptics calibrados — `social/haptics.ts` (`simulateHaptic`).
- Keyboard detection — `keyboardDetection.ts` + test.
- Safe areas — `env(safe-area-inset-*)` + variaveis `--gc-safe-*`.
- Camera/galeria — `native/NativeMediaPickerService.ts`.
- Push token lifecycle — `native/PushNotificationsService.ts`.
- Cache local LRU — `media/MediaLoadingService.ts` (com pin-protect Sprint 1 v1.1.1).
- Smoke iOS recorrente — feito em todas as Sprints (5.7 a mais recente).

## Sprint 7 - Onboarding (P0 App Store)

Objetivo: limpar fluxo de onboarding pra cumprir requisitos App Store
e dar primeira impressao premium.

Escopo:

- Fase A: deletar `OnboardingFlow.tsx` legado + namespace onboarding. CONCLUIDA.
- Fase B: aceite legal no signup form (P0 App Store — terms + privacy policy). CONCLUIDA.
- Fase C: Contextual Motion Onboarding — entregue em 3 sub-fases:
  - 7C.1: ContextualHint foundation (DB JSONB + componente + hook). CONCLUIDA.
  - 7C.2: profile completion prompts inline (chips no ProfileScreen). CONCLUIDA.
  - 7C.3: banner welcome no MyCircle primeira visita. CONCLUIDA.
  - 7C.4: motion polish (badge unlock confetti, streak ignite glow, level-up
    transition, first-post celebration) — ADIADO pra Sprint 8 SwiftUI.
    Animações CSS/JS Capacitor seriam reescritas com `.symbolEffect`,
    `withAnimation`, `.transition(.scale)` nativos — trabalho descartavel.

Status: A, B, C.1, C.2, C.3 concluidas. C.4 absorvida pela Sprint 8.

## Sprint 8 - SwiftUI Migration (app nativo)

Objetivo: migrar surfaces criticas pra SwiftUI nativo, sair do WebView
em zonas onde performance/feel importam mais.

Escopo:

- Foundation: `GymCircleAppModel`, `HKHealthStore` provider, design tokens.
- Migrar feed, stories viewer, chat — ganhar 60fps nativo + HealthKit integration.
- Manter web app pra desktop/admin + zonas de baixa friction.
- ABSORVE Sprint 7C.4: motion polish em SwiftUI nativo. Itens herdados:
  - Badge unlock celebration (`.symbolEffect(.bounce)` + haptic)
  - Streak ignite glow (`.transition(.scale)` + brand color glow)
  - Level-up transition (animation entre StreakLevel chips)
  - First-post celebration (toast + confetti via UIKit overlay)

Gate:

- App roda standalone em SwiftUI nativo no iOS sem WebView fallback no boot.
- HealthKit opt-in funcional (kcal/duracao/BPM no recap mensal).

## Sprint 9 - TestFlight + App Store (era Sprint 6)

Objetivo: levar a 1.1 SwiftUI nativa pra TestFlight e Apple review.

Escopo:

- App Store Connect setup: bundle ID, categorias, URLs, ASO.
- Apple Developer: App ID, Push Notifications, signing.
- Pre-build checklist (`docs/testflight-upload-checklist.md`).
- Xcode Archive + upload TestFlight.
- Internal testing → External testing → Apple Review submission.

Gate:

- TestFlight build aprovado por Apple Review.
- App publicado na App Store.

## Backlog pos-1.1

- Push real com Edge Functions e deep links.
- Apple Maps nativo.
- HealthKit/Health Connect.
- Rankings/desafios sociais.
- Backfill de thumbnails/posters de midia antiga.
- Expo/React Native app real quando WebView virar gargalo medido.

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

## Sprint 6 - Native Feel RC

Objetivo: preparar candidate 1.1 para App Store/TestFlight.

Escopo:

- Haptics calibrados.
- Keyboard/safe areas.
- Camera/galeria.
- Push token lifecycle.
- Cache local com TTL.
- Smoke iOS.

Gate:

- TestFlight build com checklist.
- Sem Apple/Google Login na UI enquanto decisao continuar pausada.

## Backlog pos-1.1

- Push real com Edge Functions e deep links.
- Apple Maps nativo.
- HealthKit/Health Connect.
- Rankings/desafios sociais.
- Backfill de thumbnails/posters de midia antiga.
- Expo/React Native app real quando WebView virar gargalo medido.

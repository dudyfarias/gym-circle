# Gym Circle Version 1.1

Data da auditoria: 2026-05-30

Escopo: Sprint 0 de discovery/auditoria. Nenhuma feature nova foi implementada, nenhuma regra social foi alterada e nenhuma mudanca foi aplicada no Supabase de producao.

## Objetivo

Transformar o Gym Circle 1.1 em uma evolucao segura da alpha/app aprovado, com foco em clareza social, estabilidade, performance percebida e sensacao nativa no iPhone. A Sprint 0 existe para mapear o que ja existe antes de construir qualquer coisa nova.

## Problemas atuais

- Existe muita funcionalidade ja criada, mas algumas partes ainda estao escondidas, parciais ou duplicadas entre web, core services e migrations.
- O historico recente tem varias correcoes simultaneas em chat, comentarios, notificacoes, profile recovery e native feel; isso aumenta risco de regressao se a 1.1 comecar sem mapa.
- Algumas otimizacoes de performance migraram dados para RPCs/surfaces, mas ainda existem fallbacks legados que podem confundir implementacoes futuras.
- O app tem dois caminhos sociais: mock/local antigo e Supabase real. O mock ainda e util para referencia, mas nao deve guiar a 1.1 como fonte de verdade.
- A validacao local esta sensivel: ha mudancas nao commitadas, package/package-lock modificados e `node_modules` local com dependencia corrompida, o que bloqueia lint completo.

## Oportunidades

- Consolidar feed, stories, chat, perfil e Meu Circle como surfaces independentes, mantendo os ganhos das Sprints A-E.
- Reaproveitar componentes ja prontos: `CommentsBottomSheet`, `MyCircleSheet`, `FollowListOverlay`, `StoryViewer`, `LikesOverlay`, `GymSearchSheet`, `LocalAppCache`, `HapticsService`, `NativeMediaPickerService`.
- Usar RPCs existentes antes de criar novas: `get_home_feed`, `get_story_tray_lightweight`, `get_story_viewer_items`, `get_conversation_summaries`, `get_conversation_messages`, `get_profile_posts`, `search_profiles`, `get_user_suggestions`.
- Transformar funcionalidades escondidas em produto visivel: rankings leves, conquistas, calendar/streak, followers/following overlays, monthly recap e configuracoes.
- Reduzir bugs de "estado antigo voltando" com cache bem versionado, invalidacao clara e separacao definitiva entre `ProfilePreview` e `FullProfile`.

## Metas da versao

- Feed mais social e previsivel, com comentarios e likes sem refresh global.
- Stories mais proximos de Instagram, com tray leve, viewer sob demanda e estado visto persistente.
- Perfil como identidade social fitness: bio, esportes, instagram, academia, streak e ultimos posts persistindo corretamente.
- Meu Circle como area de progresso pessoal/social, sem virar dashboard tecnico.
- Chat confiavel: criar, abrir, apagar conversa, mandar texto/midia e responder stories sem reabrir conversas apagadas.
- Notificacoes limpas: apenas eventos sociais relevantes e estados corretos de follow/tag.
- Native feel incremental: haptics, safe area, keyboard, cache leve, camera/media picker e push foundation.

## Roadmap

### Sprint 0 - Feature Discovery Audit

- Criar mapa do produto e docs oficiais da 1.1.
- Identificar features completas, parciais, escondidas e duplicadas.
- Classificar riscos, oportunidades e issues conhecidas.
- Nenhuma implementacao de produto.

### Sprint 1 - Stabilization Release

- Fechar bugs criticos pendentes: chat delete/reopen, comments overlay, tag notifications, profile recovery hardening e validacao local.
- Garantir build/lint/test verdes em ambiente limpo.
- Commitar/pushar apenas escopos claros.

### Sprint 2 - Social Surface Polish

- Consolidar feed, comments, likes overlay, follower/following overlay e search/profile navigation.
- Remover duplicacoes visuais e fluxos escondidos.
- Garantir update otimista e fallback seguro.

### Sprint 3 - Stories + Tags

- Fechar fluxo de stories agrupados, tag accepted/rejected, reply to story, like/share/report/mute/unfollow.
- Persistir estado visto/curtido e remover acoes obsoletas da UI.

### Sprint 4 - Chat Reliability

- Consolidar direct/group chat, summaries, messages cursor, delete-for-me, unread e media.
- Corrigir qualquer fallback antigo que reabra conversa deletada.

### Sprint 5 - Progress + Gamification

- Elevar Meu Circle, streak restore, badges, monthly recap e achievements.
- Planejar ranking sem criar competicao toxica.

### Sprint 6 - Native Feel (infra concluida, RC movido pra Sprint 9)

- Cache local, haptics, keyboard, safe areas, push token, camera/gallery — ENTREGUE ao longo das Sprints 3.x-5.x.
- TestFlight RC adiado pra Sprint 9 (pos SwiftUI nativo da Sprint 8) — evitar buildar candidate Capacitor que sera reescrito.

### Sprint 7 - Onboarding (P0 App Store)

- Limpar `OnboardingFlow` legado, aceite legal no signup, contextual motion onboarding.
- Fases A + B entregues; Fase C pendente.

### Sprint 8 - SwiftUI Migration

- Migrar feed/stories/chat pra SwiftUI nativo (60fps + HealthKit).
- Foundation: `GymCircleAppModel`, `HKHealthStore`, design tokens.

### Sprint 9 - TestFlight + App Store submission

- App Store Connect, Apple Developer, signing.
- Xcode Archive → TestFlight internal/external → Apple Review.
- Checklist em `docs/testflight-upload-checklist.md`.

## Criterios de sucesso

- Usuario entende o app em segundos: feed, postar treino, stories, chat e perfil.
- Postar treino continua rapido e sem campos obrigatorios desnecessarios alem de midia.
- Dados de perfil persistem e nao sao sobrescritos por previews parciais.
- Feed/stories/chat nao fazem refresh global desnecessario.
- Notificacoes mostram apenas eventos sociais corretos e botoes coerentes com estado real.
- Build, lint, testes e `npx cap sync ios` passam em ambiente limpo.

## Metricas

- `app_boot_ms`
- `feed_first_posts_ms`
- `load_more_feed_ms`
- `stories_open_ms`
- `story_viewer_items_ms`
- `chat_open_ms`
- `conversation_open_ms`
- `profile_open_ms`
- `post_created`
- `story_created`
- `message_sent`
- `streak_lit`
- `follow_created`
- `comment_created`

## Riscos

- Misturar commits pendentes e perder rastreabilidade.
- Criar feature nova em cima de estado local divergente do Supabase remoto.
- Reintroduzir `ProfilePreview` sobrescrevendo `FullProfile`.
- Reativar Apple/Google Login na UI antes de decisao final.
- Criar migrations desnecessarias para funcionalidades que ja existem.
- Otimizacoes de cache mostrarem dados antigos sem invalidacao.

## Dependencias

- Supabase remoto `qajjpjmybmqqwflytcpr`.
- Vercel production `https://gym-circle-rust.vercel.app`.
- Capacitor iOS em `/ios`.
- Core services em `packages/core/src/services`.
- Web app em `apps/web/src/components/gym-circle`.
- Docs de performance/native existentes em `docs/performance-*` e `docs/native-feel-*`.

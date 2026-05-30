# Gym Circle 1.1 Audit

Data: 2026-05-30

Metodo: analise estatica do repositorio, migrations, services/hooks e consulta somente leitura ao Supabase remoto. Nenhuma mudanca foi aplicada em producao.

## Frontend

### Web app

- Stack: Next.js App Router, React, TypeScript, Tailwind/CSS global, Supabase client.
- Entrada principal: `apps/web/src/app/page.tsx` -> `LiveAuthGate`/`LiveHomeWrapper` -> `GymCirclePreview`.
- Shell principal: `GymCirclePreview.tsx` coordena tabs, overlays, story viewer, profile sheet, post composer, chat, notificacoes e settings.
- Telas: `FeedScreen`, `PostScreen`, `ChatScreen`, `ProfileScreen`, `CheckInScreen`, `StreakScreen`.
- Overlays/sheets: `CommentsBottomSheet`, `LikesOverlay`, `NotificationsSheet`, `ProfileSheet`, `EditProfileSheet`, `EditPostSheet`, `GymSearchSheet`, `UserSearchSheet`, `FollowListOverlay`, `MyCircleSheet`, `MonthlyRecapSheet`, `AccountSettingsSheet`, `AdminPanelSheet`.

### Mobile/Expo

- Existe scaffold em `apps/mobile`, com assets Gym Circle e componentes base, mas ainda nao e app de producao.
- Status: experimental/futuro. Nao deve receber regra de produto antes da web/Capacitor estabilizar.

## Backend

Backend ativo e Supabase. A camada de negocio fica em `packages/core/src/services` e dominio em `packages/core/src/domain`.

Services ativos:

- `auth.ts`: email/senha, username login, reset password, OAuth service ainda existe mas UI deve manter Google/Apple ocultos.
- `profiles.ts`: FullProfile com `select("*")`, update com remocao de `undefined`.
- `posts.ts`: post com midia obrigatoria, likes, comments, comment likes, post mutes e fallback feed legado.
- `stories.ts`: story com midia obrigatoria, likes, views, mutes e fallback active stories legado.
- `messages.ts`: direct/group messages, RPCs de envio, delete-for-me e read state.
- `follows.ts`: follow public/private com status.
- `gyms.ts`: academias/locais, coordenadas obrigatorias para cadastro, user gyms.
- `stats.ts`: user stats live, activity days, streak restore.
- `participants.ts`: post/story participants pending/accepted/rejected.
- `notifications.ts`: social bell notifications.
- `analytics.ts`, `push.ts`, `safety.ts`, `onboarding.ts`, `checkins.ts`, `admin.ts`.

## Supabase

### Tabelas public

Ativas:

- `profiles`, `user_stats`, `user_activity_days`
- `posts`, `post_likes`, `post_comments`, `post_comment_likes`, `post_mutes`, `post_participants`
- `stories`, `story_likes`, `story_views`, `story_mutes`, `story_participants`
- `follows`, `user_blocks`, `reports`
- `conversations`, `conversation_participants`, `direct_messages`
- `gyms`, `user_gyms`, `checkins`
- `notifications`, `analytics_events`
- `legal_acceptances`, `account_deletion_requests`
- `streak_restore_events`, `streak_restored_days`
- `device_push_tokens`, `push_subscriptions`

Possivel legado/compatibilidade:

- `push_subscriptions`: PWA/web push antigo; `device_push_tokens` e a base nativa mais recente.

### Views

- `feed_posts`: feed enriquecido legado/compatibilidade.
- `user_stats_live`: stats calculados/ao vivo.
- `conversation_members`: compatibilidade com modelo antigo de chat.
- `alpha_admin_summary`, `alpha_admin_daily_metrics`: painel/admin.

### RPCs public

- Feed/profile/stories: `get_home_feed`, `get_profile_posts`, `get_story_tray`, `get_story_tray_lightweight`, `get_story_viewer_items`.
- Discovery/search: `search_profiles`, `get_user_suggestions`.
- Chat: `get_conversation_summaries`, `get_conversation_messages`, `send_direct_message`, `send_group_message`, `create_group_conversation`, `add_group_conversation_members`, `remove_group_conversation_member`, `mark_conversation_read`, `delete_conversation_for_me`, `delete_direct_conversation_for_me`.
- Auth/safety/legal: `resolve_email_for_username`, `accept_alpha_legal`, `mark_onboarding_complete`, `request_account_deletion`, `delete_my_account`, `suspend_own_account`, `issue_account_reactivation_token`, `reactivate_suspended_account`.
- Streak/stats: `refresh_my_stats`, `sync_my_streak_restores`, `use_streak_restore`.

### Triggers principais

- Posts/stories inseridos/deletados sincronizam atividade/streak.
- Likes/comments/follows/messages/checkins/activity geram analytics.
- Likes/comments/follows/story likes/participants/messages geram notificacoes.
- Participants sincronizam atividade quando accepted/rejected/delete.
- Blocks desfazem follows.
- Profiles guardam status de conta.

### Buckets

- `avatars`
- `posts`
- `stories`
- `chat-media`

Todos aparecem como publicos para leitura. Upload/mutacao depende das policies de storage.

## RPCs

RPCs de performance das Sprints B-D estao ativas no remoto e no `database.types.ts`. O app usa RPCs com fallbacks:

- Feed: tenta `get_home_feed`, cai para `feed_posts`.
- Stories: tenta `get_story_tray_lightweight`, cai para `get_story_tray` ou tabela `stories`.
- Story viewer: tenta `get_story_viewer_items`, cai para `stories`.
- Chat: usa `get_conversation_summaries` e `get_conversation_messages`.
- Profile posts: usa `get_profile_posts`.
- Search/suggestions: usa `search_profiles` e `get_user_suggestions`.

## Services

Services estao bem separados em `packages/core`, o que ajuda futura migracao Expo. Pontos de atencao:

- `postService.listFeed` e `storyService.listActive` ainda sao legados/fallbacks e usam queries amplas.
- `profileService.listSuggested` ainda retorna `profiles.select("*")`; deve ser substituido por `get_user_suggestions`.
- `statsService.activityDaysForUser` usa `select("*")`, aceitavel sob demanda, mas nao deve entrar no boot.

## Hooks

Hooks core:

- `useAuth`, `useFeed`, `useGyms`, `useProfile`, `useStats`, `useStories`.

Hooks web:

- `useSupabaseSocial`: hook principal real, com refresh por surface, RPC fallbacks, realtime, cache e actions sociais.
- `useGymCircleSocial`: camada mock/local, util para demo/testes, nao deve ser fonte de verdade da 1.1.
- `useViewerLocation`: permissao/localizacao com persistencia local.

## Providers

- `SupabaseClientProvider` em `packages/core/src/hooks`.
- `SearchSheetContext` para abrir busca.
- `I18nClientProvider` para locale.

## Design System

Componentes oficiais em `apps/web/src/components/gym-circle/design-system`:

- `SocialPostCard`, `StoryBubbles`, `StoryViewer`, `StreakBadge`, `ActivityCircle`, `ProfilePostsGrid`, `PinchZoomImage`, `GCImage`, `VideoThumbnail`, `SwipeRevealDelete`, `BottomTabBar`, `FloatingCreatePostButton`, `ToastFeedback`.

Risco: alguns componentes viraram "smart" demais e acumulam UX + dados + fallback. A 1.1 deve manter componentes visuais magros e actions no hook/service.

## Capacitor

- Config principal: `capacitor.config.ts`.
- iOS em `/ios`.
- Plugins usados: camera, haptics, keyboard, push notifications, splash screen, status bar.
- `ci_scripts/ci_post_clone.sh` existe para Xcode Cloud.

## Native Feel

Implementado:

- `HapticsService`, `NativeMediaPickerService`, `PushNotificationsService`, `LocationProvider`, `LocalAppCache`, `OrientationService`.
- Safe areas e keyboard helpers existem.

Parcial:

- Push foundation registra tokens, mas envio push real/deep links ainda nao esta completo.
- AppleMapsProvider e placeholder/foundation.
- Cache existe, mas precisa governanca de TTL/invalidation por surface.

## Analytics

- Tabela `analytics_events`.
- Service `analytics.ts`.
- Triggers para signup/profile/post/story/follow/like/comment/checkin/message/activity.
- Performance metrics via `performance.ts` e `NEXT_PUBLIC_PERF_DEBUG`.

## Gamificacao

Implementado:

- Streak social por posts/stories com midia.
- `user_activity_days`, `user_stats`, `user_stats_live`.
- `streak_restore_events`, `streak_restored_days`, RPCs de restore.
- UI: `StreakBadge`, `ActivityCircle`, `StreakCard`, `MonthlyRecapSheet`, `MyCircleSheet`.

Parcial:

- Rankings, challenges e achievements sociais ainda sao planejados, nao produto completo.

## Notificacoes

Implementado:

- Bell social: follow, like, comment, story_like, post_tag, story_tag, mention/follow_request.
- `NotificationsSheet`.
- Triggers no banco.
- Push token foundation.

Pendente:

- Push real por evento + deep link.
- Limpeza definitiva de notificacoes obsoletas de tags aceitas/recusadas precisa hardening server-side se virar recorrente.

## Cache

- `LocalAppCache` existe.
- Story viewed IDs persistem em localStorage.
- Location prompt status persiste em localStorage.
- Push toggle/token usa localStorage.
- Image cache in-memory em `imageCache.ts`.

Risco: caches locais podem parecer "versao antiga voltando" se nao forem invalidados apos mutations.

## Midia

Implementado:

- Posts/stories/direct_messages tem campos opcionais `thumbnail_url`, `poster_url`, `media_width`, `media_height`, `media_duration_seconds`, `blur_data_url`.
- Upload tenta gerar thumbnail/poster.
- `PinchZoomImage`, `GCImage`, `VideoThumbnail`.

Pendente:

- Backfill de midia antiga.
- Compressao/transcoding robusto para video.
- Chat media thumbnails/posters ainda precisam auditoria por fluxo.

## Stories

Implementado:

- Story tray, viewer, likes, views, mutes, reply to story, participants/tags.
- RPC leve para tray e RPC sob demanda para viewer.

Pendente:

- Garantir gesto/auto-advance em todos os casos.
- Persistencia de viewed state deve continuar sendo testada em cold start.

## Feed

Implementado:

- Feed cronologico por RPC, likes, comments, share to chat, post menu, delete/edit, tags, suggestions.
- `CommentsBottomSheet` e `LikesOverlay`.

Pendente:

- Virtualizacao/Janela temporal real ainda e tema de Performance Sprint E.
- Confirmar que comentarios abrem sempre sem trazer foto/post inteiro junto apos hotfix local.

## Perfil

Implementado:

- Profile screen/sheet, edit profile, avatar, bio, instagram, birth date, sports, gym, privacy, followers/following overlays, latest post/grid.

Pendente:

- Profile recovery/hardening apos incidente de overwrite logico.
- Garantir que `ProfilePreview` nunca substitui `FullProfile`.

## Meu Circle

Existe em `MyCircleSheet.tsx`.

Conteudo atual:

- Identidade do usuario.
- Posts do usuario.
- Activity/streak context.
- UI social/progresso em sheet.

Status: existe parcialmente/visivel em algumas entradas. Precisa ser consolidado como area oficial ou removido de caminhos secundarios.

## Chat

Implementado:

- Direct e group chat, summaries, messages sob demanda, media, story replies, delete-for-me, unread, search.

Pendente:

- Incidente recente: conversa apagada reaparecendo/abrindo conversa antiga. Migration `20260521184212_stabilize_chat_delete_reopen.sql` indica tentativa de estabilizacao, mas precisa smoke test real antes da 1.1.

## Comentarios

Implementado:

- `CommentsBottomSheet`, comment likes, delete own comment, mentions/autocomplete.

Pendente:

- Hotfix local atual impede foto do feed aparecer atras/junto, mas ainda nao estava commitado no momento da auditoria.

## Academias

Implementado:

- `GymSearchSheet`, busca local, recentes, proximas, criar academia/local com coordenadas obrigatorias, user gyms, checkins.

Pendente:

- Deduplicacao e fontes externas devem continuar simples para nao virar fluxo pesado de cadastro.

## Localizacao

Implementado:

- Current position via browser/geolocation.
- Places API routes: search/nearby/reverse.
- Distancia viewer -> academia/local.
- Preference local para nao pedir toda vez.

Parcial:

- Apple Maps provider nativo ainda e foundation.

## Push

Implementado:

- `device_push_tokens`, service e controller.
- Capabilities/plugin.

Parcial:

- Envio real e deep links ainda planejados.

## Onboarding

Implementado:

- Cadastro/login simples email/senha/username.
- Completar perfil progressivo.
- Aviso de completar perfil com dismiss persistente.
- Legal alpha acceptance existe.

Pendente:

- Garantir aviso somente no perfil conforme decisao recente e nao no feed.

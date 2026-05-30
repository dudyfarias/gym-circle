# Feature Discovery Audit

Data: 2026-05-30

Legenda de recomendacao: reutilizar, melhorar, esconder, remover, reescrever.

## Feed

### Existe?

Existe parcialmente.

### Localizacao

- Arquivos: `FeedScreen.tsx`, `SocialPostCard.tsx`, `GymCirclePreview.tsx`, `useSupabaseSocial.ts`
- Services: `posts.ts`, `participants.ts`, `notifications.ts`, `analytics.ts`
- RPCs: `get_home_feed`
- Tabelas/views: `posts`, `post_likes`, `post_comments`, `post_comment_likes`, `post_mutes`, `post_participants`, `feed_posts`
- Triggers: posts insert/delete, likes/comments analytics/notify, participants activity.

### Status

Producao com fallbacks legados.

### Problemas

- Realtime ainda tem listeners amplos em algumas surfaces.
- Feed antigo/fallback ainda existe via `feed_posts`.
- Comentarios/likes completos so devem carregar sob demanda; isso precisa permanecer protegido.
- Hotfix local de comments overlay ainda precisa commit/deploy.

### Oportunidades

- Janela temporal real de 48h por Sprint E.
- Revalidacao local por post visivel.
- Melhor cache stale-while-revalidate por surface.

### Recomendacao

Melhorar.

### Prioridade

Critica.

## Stories

### Existe?

Existe parcialmente.

### Localizacao

- Arquivos: `StoryBubbles.tsx`, `StoryViewer.tsx`, `useSupabaseSocial.ts`, `stories.ts`
- RPCs: `get_story_tray_lightweight`, `get_story_viewer_items`, fallback `get_story_tray`
- Tabelas: `stories`, `story_views`, `story_likes`, `story_mutes`, `story_participants`
- Triggers: story insert/delete, story likes notify, participants activity/notify.

### Status

Producao.

### Problemas

- Gesto/auto-advance precisa smoke test em iPhone.
- Estado visto ja teve regressao; precisa teste de cold start.
- Story tag accepted/rejected precisava UI baseada em status real.

### Oportunidades

- Viewer com preload controlado e cancelamento.
- Deep links/push para story reply/like.

### Recomendacao

Melhorar.

### Prioridade

Alta.

## Perfil

### Existe?

Existe parcialmente.

### Localizacao

- Arquivos: `ProfileScreen.tsx`, `ProfileSheet.tsx`, `EditProfileSheet.tsx`, `ProfileIdentity.tsx`, `ProfilePostsGrid.tsx`, `LatestPostPreview.tsx`
- Service: `profiles.ts`
- RPC: `get_profile_posts`, `search_profiles`
- Tabelas/views: `profiles`, `user_stats_live`, `user_gyms`, `gyms`, `posts`

### Status

Producao com incidente recente de dados.

### Problemas

- Incidente: overwrite logico por preview parcial. Docs de recovery existem localmente.
- FullProfile e ProfilePreview precisam contrato explicito.
- Profile completion notice foi movido para perfil, mas deve ser validado.

### Oportunidades

- Perfil como "curriculo fitness social": posts, streak, bio, instagram, sports, followers/following.
- Melhorar campos opcionais sem bloquear onboarding.

### Recomendacao

Melhorar e harden.

### Prioridade

Critica.

## Meu Circle

### Existe?

Existe parcialmente.

### Localizacao

- Arquivo: `MyCircleSheet.tsx`
- Componentes: `ActivityCircle`, `StreakCard`, `MonthlyRecapCard`, `StreakBadge`
- Tabelas/RPCs: `user_activity_days`, `user_stats_live`, `get_profile_posts`

### Status

Experimental/parcial.

### Problemas

- Nao esta claramente posicionado como aba/tela oficial.
- Pode duplicar dados do perfil/streak se nao tiver papel definido.

### Oportunidades

- Transformar em hub de consistencia: calendario, badges, recaps e ranking futuro.

### Recomendacao

Melhorar.

### Prioridade

Media.

## Gamificacao

### Existe?

Existe parcialmente.

### Localizacao

- Domain: `streak.ts`, `gamification.ts`, `monthlyRecap.ts`
- UI: `StreakBadge`, `ActivityCircle`, `StreakCard`, `MonthlyRecapSheet`, `MyCircleSheet`
- RPCs: `refresh_my_stats`, `sync_my_streak_restores`, `use_streak_restore`
- Tabelas: `user_stats`, `user_activity_days`, `streak_restore_events`, `streak_restored_days`

### Status

Producao para streak/restaurador; experimental para rankings/achievements.

### Problemas

- Achievements/ranking ainda nao tem modelo completo.
- Restaurador precisa smoke test com timezone e transicao de dia.

### Oportunidades

- Ranking semanal entre amigos.
- Badges compartilhaveis.
- Monthly recap como asset social.

### Recomendacao

Reutilizar e melhorar.

### Prioridade

Alta.

## Sugestao de Amigos

### Existe?

Existe completa, mas precisa polimento.

### Localizacao

- Arquivos: `DiscoveryUserCard.tsx`, `FeedScreen.tsx`, `UserSearchSheet.tsx`
- RPCs: `get_user_suggestions`, `search_profiles`
- Tabelas: `profiles`, `follows`, `user_blocks`, `user_gyms`, `gyms`, `user_stats_live`

### Status

Producao.

### Problemas

- Ja teve ajuste para remover foco excessivo em academia.
- Admin/search especial e bloqueios precisam regressao.

### Oportunidades

- Razoes sociais melhores: amigos em comum, ativo hoje, treina perto.

### Recomendacao

Melhorar.

### Prioridade

Media.

## Comentarios

### Existe?

Existe parcialmente.

### Localizacao

- Arquivo: `CommentsBottomSheet.tsx`
- Service: `posts.ts`
- Tabelas: `post_comments`, `post_comment_likes`
- Trigger: `post_comments_after_insert_notify`, analytics.

### Status

Producao recente.

### Problemas

- Overlay/foto do feed teve hotfix local.
- Replies agrupadas nao existem no backend.
- Mentions existem no input/autocomplete, mas precisam teste de notificacao/UX.

### Oportunidades

- Reactions rapidas.
- Moderacao leve e delete proprio claro.

### Recomendacao

Melhorar.

### Prioridade

Alta.

## Notificacoes

### Existe?

Existe parcialmente.

### Localizacao

- Arquivo: `NotificationsSheet.tsx`
- Service: `notifications.ts`
- Tabela: `notifications`
- Triggers: follows, post likes/comments, story likes, participants, messages.

### Status

Producao com hotfix local pendente.

### Problemas

- Tags accepted/rejected precisam refletir status real.
- Evitar notificacoes de "novo treino" no sino.
- Push real ainda nao existe.

### Oportunidades

- Unificar bell social + push/deep link.
- Estado de CTA follow/tag consistente.

### Recomendacao

Melhorar.

### Prioridade

Critica.

## Chat

### Existe?

Existe parcialmente.

### Localizacao

- Arquivo: `ChatScreen.tsx`
- Service: `messages.ts`
- RPCs: `get_conversation_summaries`, `get_conversation_messages`, `send_direct_message`, `delete_conversation_for_me`, `delete_direct_conversation_for_me`, group RPCs
- Tabelas/views: `conversations`, `conversation_participants`, `direct_messages`, `conversation_members`

### Status

Producao instavel.

### Problemas

- Relatos recentes: conversa antiga aparece/desaparece, conversa deletada reaparece.
- Deve validar delete-for-me, summaries e local state apos mutations.

### Oportunidades

- Separar estado lista vs conversa aberta.
- Paginar historico antigo ao subir.

### Recomendacao

Melhorar antes de qualquer feature nova.

### Prioridade

Critica.

## Academias e Localizacao

### Existe?

Existe parcialmente.

### Localizacao

- Arquivos: `GymSearchSheet.tsx`, `PostScreen.tsx`, `CheckInScreen.tsx`, API routes `/api/places/*`
- Services: `gyms.ts`, `checkins.ts`
- Tabelas: `gyms`, `user_gyms`, `checkins`, campos de local em `posts`

### Status

Producao.

### Problemas

- Deduplicacao de recentes e locais proximos ja foi area de bug.
- Coordenadas sao obrigatorias para cadastrar academia, mas UX precisa continuar simples.

### Oportunidades

- Apple Maps provider futuro.
- Distancia contextual sem expor coordenadas exatas do usuario.

### Recomendacao

Melhorar.

### Prioridade

Media.

## Push

### Existe?

Existe parcialmente.

### Localizacao

- `NativePushController.tsx`, `PushNotificationsService.ts`, `push.ts`
- Tabelas: `device_push_tokens`, `push_subscriptions`
- iOS entitlements/capabilities.

### Status

Foundation.

### Problemas

- Nao ha envio push real/deep link por evento.
- `push_subscriptions` pode ser legado PWA.

### Oportunidades

- Edge Function/server para like/follow/message/streak at risk.

### Recomendacao

Melhorar depois da estabilizacao social.

### Prioridade

Media.

## Onboarding/Auth

### Existe?

Existe completa, com decisao de UI.

### Localizacao

- `LiveAuthGate`, `OnboardingFlow`, `auth.ts`, `authRedirect.ts`, `reset-password`, `reactivate-account`
- RPC: `resolve_email_for_username`
- Tabela: `legal_acceptances`

### Status

Producao.

### Problemas

- Google/Apple service existe, mas UI deve permanecer oculta/desativada.
- Reset password precisa smoke test App Store/iOS.

### Oportunidades

- Onboarding progressivo no perfil, sem bloquear feed.

### Recomendacao

Reutilizar.

### Prioridade

Alta.

## Analytics

### Existe?

Existe parcialmente.

### Localizacao

- Service: `analytics.ts`
- Tabela: `analytics_events`
- Triggers private analytics.
- Frontend metrics: `performance.ts`

### Status

Producao/foundation.

### Problemas

- Eventos existem, mas dashboards/relatorios ainda sao simples.

### Oportunidades

- Medir loop de retencao 1.1: app_opened, post_created, story_created, message_sent, streak_lit, day_1/day_7.

### Recomendacao

Melhorar.

### Prioridade

Media.

## Cache e Performance

### Existe?

Existe parcialmente.

### Localizacao

- `LocalAppCache.ts`, `imageCache.ts`, `lruCache.ts`, `performance.ts`, `useSupabaseSocial.ts`
- Docs: `performance-sprint-a` a `performance-sprint-e`.

### Status

Parcial/producao.

### Problemas

- Local cache pode causar sensacao de estado antigo se invalidacao falhar.
- Full lint local esta bloqueado por `node_modules` corrompido.

### Oportunidades

- TTL curto por surface.
- Cache stale apenas visual, revalidacao em background.

### Recomendacao

Melhorar.

### Prioridade

Alta.

## Native Feel

### Existe?

Existe parcialmente.

### Localizacao

- `HapticsService`, `NativeMediaPickerService`, `LocationProvider`, `PushNotificationsService`, `keyboardDetection`, Capacitor config/iOS.

### Status

Producao/foundation.

### Problemas

- Push real e Apple Maps nativo ainda nao completos.
- Expo scaffold existe, mas nao deve dividir foco agora.

### Oportunidades

- Melhorar sensacao iOS sem reescrever: haptics, gestures, keyboard, safe area, cache.

### Recomendacao

Melhorar incrementalmente.

### Prioridade

Media.

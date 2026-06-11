# Gym Circle — Auditoria Supabase (local + leituras read-only)

> 11/jun/2026. Fontes: `supabase/migrations` (62 arquivos), `supabase/functions`, grep de RPCs no código, advisors read-only. **Nada foi aplicado no remoto.**

## Inventário

- **62 migrations** (2026-05-06 → 2026-06-09), nomeação consistente com timestamps; últimas: carrossel `post_media` + `workout_types`, comment replies/likes, push auto-dispatch.
- **1 edge function**: `send-push` (APNs; chamada por triggers `private.notify_achievement_unlock` / `notify_challenge_complete` e pelo fluxo social).
- **seed.sql** presente (dev local).
- Tipos TS: `packages/core/database.types.ts` — **drift conhecido**: tabelas novas (monthly_challenges, user_monthly_challenge_progress, post_media) não estão no Database type; serviços usam casts locais ("symlink quirk" comentado no código). Regenerar types é quick win.

## Tabelas (mapa de uso)

| Grupo | Tabelas | Uso |
|-------|---------|-----|
| Identidade | `profiles`, `legal_acceptances`, `user_blocks`, `reports` | Ativas |
| Social | `posts`, `post_media`, `post_participants`, `post_likes`, `post_comments`, `post_comment_likes`, `post_mutes` | Ativas |
| Stories | `stories`, `story_likes`, `story_views`, `story_mutes`, `story_participants` | Ativas |
| Grafo | `follows` | Ativa |
| Chat | `conversations`, `conversation_participants`, mensagens diretas (RPC atômica) | Ativas |
| Progresso | `user_activity_days`, `user_stats_live` (view/tabela live), `checkins`, `streak_restored_days` | Ativas |
| Gamificação | `user_achievements`, `monthly_challenges`, `user_monthly_challenge_progress`, `monthly_recap_covers` | Ativas |
| Push/Notifs | `notifications`, `push_subscriptions` (web push), `device_push_tokens` (APNs) | Ativas |
| Infra | `gyms`, `user_gyms`, analytics_* (via triggers `private.analytics_*`) | Ativas |

Órfãs prováveis: nenhuma tabela claramente morta encontrada. Candidata a revisão: `checkins` (feature de check-in existe na UI mas com uso baixo — ver feature-opportunities).

## RPCs

**Usadas no código (28 únicas)** — destaque: `get_home_feed`, `get_profile_posts`, `get_story_tray_lightweight` (+ `get_story_tray` como fallback legado intencional), `get_conversation_summaries`, `get_conversation_messages`, `send_direct_message`, `send_group_message`, `create/add/remove_group_*`, `delete_*_conversation_for_me`, `mark_conversation_read`, `get_user_suggestions`, `search_profiles`, `get_achievement_global_stats`, `use_streak_restore`, `sync_my_streak_restores`, `refresh_my_stats`, `resolve_email_for_username`, `suspend_own_account`, `reactivate_suspended_account`, `request_account_deletion`, `issue_account_reactivation_token`, `mark_onboarding_complete`, `accept_alpha_legal`, `get_story_viewer_items`, `backfill_user_achievements_server_side`.

**Definidas e não chamadas pelo client (esperado)**: todo o schema `private.*` (guards, analytics triggers, push dispatch, cálculo de stats) — chamadas por triggers/policies, não órfãs.

**Atenção**:
- `get_story_tray` (legacy) mantida só como fallback do lightweight — marcar para remoção quando o fallback não disparar mais (precisa de observabilidade — ver security-audit sobre logs silenciosos).
- `delete_conversation_for_me` E `delete_direct_conversation_for_me` coexistem — confirmar se a primeira ainda tem call site real ou é o fallback antigo (1 call cada no grep; candidata a consolidação).

## RLS / Policies

- Padrão sólido: funções `private.can_view_profile_posts`, `can_interact_with_user`, `has_block_between` centralizam regra; políticas re-otimizadas com initplan na Sprint 9.9.9 (advisors sem WARN de RLS perf hoje).
- `user_achievements` com `public_read` — intencional (raridade global + hall de terceiros). OK, mas significa que datas/contagens de conquistas são públicas mesmo de perfil privado: **decisão de produto a confirmar**.
- `user_activity_days` visível conforme `user_activity_days_select_visible` (própria + perfis visíveis) ✓.

## Performance (advisors read-only)

- 36 índices sem uso (INFO) — esperado com poucos usuários; **não remover agora**. Reavaliar com volume real (>10k users) e remover os que continuarem zerados.
- Auth com 10 conexões fixas (INFO) — trocar pra estratégia percentual quando subir o instance size.
- Sem WARN de seq scan/initplan pendente.

## Segurança (resumo — detalhe no security-audit.md)

- 4 funções SECURITY DEFINER executáveis por **anon** (`resolve_email_for_username`, `backfill_user_achievements_server_side`, `rls_auto_enable`, `get_achievement_global_stats`) → sprint de hardening com REVOKEs seletivos.
- Leaked password protection desativada → ativar (dashboard).

## Storage (esperado pelo código)

- Buckets de mídia de posts/stories/avatars (URLs públicas `storage/v1/object/p...` confirmadas nos dados). Posters/thumbnails gerados desde a Sprint 13; **1 vídeo legado sem poster** (backfill opcional, 1 registro).

## Recomendações (ordem)

1. Regenerar `database.types.ts` e remover os casts "symlink quirk" (quick win de DX/typesafety).
2. Sprint de hardening: REVOKEs de anon + leaked password ON.
3. Decidir produto: conquistas públicas vs perfil privado.
4. Consolidar `delete_conversation_for_me` vs `delete_direct_conversation_for_me`.
5. Backfill opcional do poster do vídeo legado.

# Gym Circle — Auditoria de Performance v2

> Read-only, 11/jun/2026 (main @ `dbaa3d1`). Build de produção PASSA (11 rotas). Métricas por leitura de código + advisors read-only.

## Boot / cold start

| Item | Estado | Classificação |
|------|--------|---------------|
| Boot em 3 fases (`refreshHomeCritical` → `Secondary` → extras) com perf marks (`markPerf`/`measurePerf`) | Bom desenho; já instrumentado | OK |
| Boot ganhou +1 RPC (`refreshProfilePosts` do próprio user, fix do calendário) | 6 queries extras no boot (posts/stats/follows x2/activity/profile) | Melhoria média: fundir com o bulk existente ou adiar pro idle |
| `user_activity_days` do próprio user busca SEM limite (`order asc`) | Hoje ok (18 rows); com 3 anos de uso = ~1000 rows por boot | Risco futuro de escala: limitar a ~400 como no fetch de terceiros |
| Splash nativo `launchShowDuration: 4200ms` com auto-hide | Fallback seguro; mas 4.2s é teto alto se algo atrasar o `hide()` | Quick win: medir tempo real até hide e reduzir teto |

## Queries / dados

| Item | Evidência | Classificação |
|------|-----------|---------------|
| **59 ocorrências de `select("*")`** em web+core (likes, comments, profiles, monthly_challenges, etc.) | grep | Melhoria média: as quentes (post_likes/post_comments em `refreshPostDetails`, profiles) deviam projetar colunas |
| Surfaces principais já são RPCs dedicadas (`get_home_feed`, `get_profile_posts`, `get_story_tray_lightweight`, `get_conversation_summaries`) com fallback | 28 RPCs em uso | OK (Sprint Performance C fez o dever) |
| Feed: `INITIAL_FEED_LIMIT = 30` + cursor `loadMoreFeed` | código | OK |
| Calendário: fetch por mês com cursor + cache por user (b1eca76) | código | OK |
| 36 índices sem uso (advisors INFO) | advisors | Esperado na escala atual — NÃO remover agora; reavaliar com 10k users |
| RLS initplan/políticas: limpas na Sprint 9.9.9 | advisors sem WARN de RLS perf | OK |

## Render / React

| Item | Evidência | Classificação |
|------|-----------|---------------|
| `useSupabaseSocial.ts` = **4.658 linhas**, um único `agg` state: qualquer merge re-renderiza todos os consumidores | wc -l | **Melhoria grande**: maior alavanca de perf do app — separar slices (feed/chat/stories/profile) ou adotar selectors |
| `GymCirclePreview.tsx` = **2.308 linhas**, ~todos os sheets montados no mesmo componente | wc -l | Melhoria média: code-split de sheets pesados (`AchievementsSheet`, `StoryViewer`, `ChatScreen`) via dynamic import |
| 7x `set-state-in-effect` (GCImage, StoryViewer, PinchZoom, overlays, useLocale) | ESLint | Quick win de render: corrige cascatas e provável flicker de imagem |
| `screen` useMemo com deps curadas (handlers fora) | código | OK consciente — documentado no código |
| Glow/blur de artefatos 3D já limitado a hero/detail (`glow=false` em grids) | Sprint 15 | OK |
| Feed sem virtualização | leitura | Risco futuro: virtualizar com ~100+ posts em memória |

## Mídia

| Item | Estado |
|------|--------|
| `GCImage` + `imageCache` com decode/preload — mas 5 testes do cache estão quebrados (mock), então o contrato não está protegido | Corrigir testes antes de mexer no cache |
| Vídeos: poster/thumbnail gerados desde a Sprint 13; 1 vídeo legado sem poster (backfill opcional) | OK pós-dbaa3d1 |
| Stories: preload do próximo item — conferir continuidade entre AUTORES (relato antigo de fechar ao trocar de user) | Verificar junto com fix do B3 |
| Upload: galeria via `<input multiple>` (PHPicker direto, sem re-encode do plugin) | OK — ganho real medido na Sprint 13.x |

## Service Worker / rede

| Item | Estado |
|------|--------|
| HTML `no-store` via SW; estáticos `/_next/static` cache-first com hash | OK — deploy novo chega no app sem build |
| Cache GC_CACHE v4 limpa versões antigas no activate | OK |
| Chunks antigos órfãos ficam no cache até trocar a versão do SW | Baixo: considerar limpeza por idade |

## Realtime / polling

- Chat usa timer de refresh (`chatRealtimeTimerRef`) — polling, não canal realtime puro. Funciona na escala atual; com 10k users avaliar canal por conversa aberta apenas.
- Sem listeners realtime amplos (sem `postgres_changes` global) — bom: evita broadcast storm.

## Cenários de escala

| Usuários | O que segura | O que quebra primeiro | Ação |
|----------|--------------|----------------------|------|
| 1.000 | Tudo atual | Nada crítico; advisors de índice continuam INFO | Corrigir B3 + select("*") quentes |
| 10.000 | RPCs com índices certos | (1) re-render global do god hook em devices fracos; (2) feed sem virtualização; (3) `user_activity_days` sem limite no boot; (4) edge function `send-push` síncrona por trigger | Separar slices de estado; virtualizar; limitar activity; fila/batch no push |
| 50.000 | Postgres com índices + RLS initplan ok | (1) contadores por lateral count em `get_profile_posts` (likes/comments por post a cada page); (2) `get_home_feed` fan-out de follows; (3) storage egress de imagens full-size (sem CDN transform) | Contadores materializados; feed pré-computado/edge cache; image transform/resize no storage |

## Resumo priorizado

1. **Quick wins**: corrigir os 7 set-state-in-effect; reduzir teto do splash; projetar colunas nas 5 queries `select("*")` mais quentes; ativar limpeza de testes (B1/B2) pra medir de verdade.
2. **Melhoria média**: code-split dos sheets pesados; fundir boot hydration; limit no activity_days próprio.
3. **Melhoria grande**: fatiar o `useSupabaseSocial` (maior alavanca de render do app).
4. **Risco futuro**: virtualização do feed; push em fila; image transforms.

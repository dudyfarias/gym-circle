# Gym Circle Performance Sprint E

Data: 2026-05-21

## Resumo

Sprint E continua a redução de overhead percebido no app já estabilizado pelas Sprints A-D. O foco aqui é: (1) terminar a paginação real do feed por **janela temporal** em vez de count fixo, (2) prefetch inteligente dos chunks `next/dynamic` em idle, (3) cortar os listeners realtime amplos restantes, (4) cache local com TTL pra sobreviver re-entradas rápidas no app, e (5) backfill de thumbnails/posters em mídia antiga. Nenhum item desta sprint redesenha produto nem altera regras sociais; tudo é aditivo e compatível com clientes já publicados.

A Sprint D fechou mídia, story viewer e paginação de feed via cursor `get_home_feed(cursor, limit)`. A pendência mais clara é a versão temporal: o cliente quer "carregar de 2 em 2 dias", mas a RPC atual só aceita cursor superior + count, sem janela inferior. A migration desta Sprint resolve isso.

## Status pré-Sprint E

- Sprints A, B, C, D aplicadas e validadas no Supabase remoto (projeto `qajjpjmybmqqwflytcpr`).
- Release branch em `release/app-store-rc-2026-05-18 @ 3f10f35` (Sprint D + UI direcional/animação/black bar).
- Auto-promote do Vercel já ativado: push em produção promove deploy automaticamente.

## Itens planejados

### P0 — Janela temporal real de 2 dias no `get_home_feed`

Impacto: alto
Esforço: baixo/médio
Prioridade: P0

**Problema:** `loadMoreFeed` paginar por cursor + count limit traz N posts mais antigos por chamada. Não é "janela temporal": se o feed tem poucos posts por dia, uma chamada pode trazer posts de várias semanas; se tem muitos, pode trazer só algumas horas. UX inconsistente.

**Solução:** estender a RPC `get_home_feed` pra aceitar `p_window_hours` opcional. Quando passado, retorna apenas posts cujo `created_at` está em `[cursor - window_hours, cursor)`. Sem `window_hours`, comportamento atual (cursor + limit) preservado pra compatibilidade.

Migration nova: `supabase/migrations/<timestamp>_performance_sprint_e_window_hours.sql`
Fallback manual: `supabase/admin/apply_sprint_e_window_hours.sql`

Assinatura atualizada:

```sql
get_home_feed(
  p_cursor_created_at timestamptz default null,
  p_limit int default 30,
  p_window_hours int default null  -- novo
)
```

Frontend:

- `loadMoreFeed` passa `p_window_hours = 48` por chamada.
- Cliente trata `feedHasMore = false` quando duas chamadas consecutivas devolvem 0 (alcançou o início do banco do user).
- `INITIAL_FEED_LIMIT` no boot pode virar `gte(created_at, now - 48h)` puro via `p_window_hours=48` + `p_cursor=null` interpretado como "now".

Validação:

- Smoke SQL: `select * from get_home_feed(null, 30, 48)` deve retornar posts dos últimos 48h.
- Smoke SQL: `select * from get_home_feed('2026-05-19T12:00Z', 30, 48)` deve retornar posts entre 2026-05-17T12:00Z e 2026-05-19T12:00Z.
- Cliente: scroll até a penúltima posição e validar que cada load_more cobre exatamente 48h.

### P0 — Realtime mais seletivo (listeners restantes)

Impacto: médio/alto
Esforço: médio
Prioridade: P0

**Problema:** após Sprints A-D, ainda existem listeners realtime amplos pra `posts`, `stories`, `follows`, `checkins` e `user_stats`. Cada evento dispara recomputação não-trivial mesmo quando o item afetado não está visível.

**Solução:**

- `posts` e `stories`: assinar canais por usuário visível no feed atual (`post_likes:user=:userId`) em vez de tabela inteira.
- `follows`: trocar listener amplo por refresh local quando `follows.actions.*` executar.
- `checkins`: trocar por subscriber só do user atual + IDs amigos.
- `user_stats`: idem.

Frontend:

- Novo helper `subscribeToVisiblePosts(postIds)` que retorna função de unsubscribe.
- `FeedScreen` mantém o set de `postIds` visíveis via `IntersectionObserver`.
- Quando entra/sai do viewport, ajusta os listeners ativos.

### P1 — Prefetch idle dos chunks `next/dynamic`

Impacto: médio (UX feel)
Esforço: baixo
Prioridade: P1

**Problema:** 16 componentes foram movidos pra `next/dynamic` em Sprint B (ChatScreen, PostScreen, ProfileScreen, StoryViewer, AdminPanelSheet, UserSearchSheet, ProfileSheet, EditProfileSheet, EditPostSheet, MonthlyRecapSheet, NotificationsSheet, ConfirmSheet, PostMenuSheet, PostDetailSheet, LikesOverlay, AccountSettingsSheet). Cada abertura faz fetch do chunk, com delay perceptível em conexões móveis.

**Solução:** após o boot crítico estabilizar (ex: 1500ms após `app_boot_ms`), disparar `requestIdleCallback` que pré-carrega os chunks mais prováveis sem renderizá-los:

```ts
useEffect(() => {
  if (typeof window === "undefined") return;
  if (!("requestIdleCallback" in window)) return;
  const id = window.requestIdleCallback(() => {
    // ordem priorizada: usuário provavelmente abre stories/profile primeiro
    void import("./design-system/StoryViewer");
    void import("./screens/ChatScreen");
    void import("./ProfileSheet");
    void import("./screens/PostScreen");
    void import("./screens/ProfileScreen");
    void import("./NotificationsSheet");
  }, { timeout: 2500 });
  return () => window.cancelIdleCallback(id);
}, []);
```

Arquivo provável: `apps/web/src/components/gym-circle/GymCirclePreview.tsx` (effect dispara após `social.loading === false`).

Trade-off: gasta um pouco mais de banda no boot pra economizar latência percebida nas próximas interações. Em redes muito lentas (3G), pode atrasar a hidratação social — por isso `requestIdleCallback` (só roda em idle) com timeout.

### P1 — Cache local com TTL para feed/story tray

Impacto: médio/alto
Esforço: médio
Prioridade: P1

**Problema:** sair e voltar pro app (mesmo em segundos) sempre refaz `refreshHomeCritical`. Reabrir o feed após troca rápida de app deveria pintar imediatamente do cache e revalidar em background.

**Solução:**

- `sessionStorage` (não `localStorage` — quer ser efêmero por sessão de browser/PWA):
  - `gym-circle:cache:home-feed:v1` → `{ data, fetchedAt }`.
  - `gym-circle:cache:story-tray:v1` → idem.
  - TTL: 2 minutos. Após TTL, ignorar e fazer fetch fresh.
- No boot, se cache válido existe, hidrata o agg state imediatamente e marca como "loaded".
- Em paralelo, dispara `refreshHomeCritical` em background. Quando volta, faz merge incremental sem reset visual.
- Invalidação: qualquer mutation (like, comment, post) limpa o cache antes da próxima leitura.

### P1 — `blur_data_url` real com placeholder progressivo

Impacto: médio (UX feel)
Esforço: médio
Prioridade: P1

**Problema:** Sprint D adicionou a coluna `blur_data_url` mas ainda não é populada nem usada. Imagens do feed aparecem com fundo preto vazio antes de carregar.

**Solução:**

- Upload de imagem (web side): gerar `blur_data_url` (base64 de ~10x10 px JPEG) junto com thumbnail.
- Edge Function `generate_blur_placeholder(media_url)` pra mídia antiga (backfill).
- Frontend: usar `<img style={{ backgroundImage: `url(${blur_data_url})` }}>` enquanto o `src` principal não carrega.

### P2 — Paginação de histórico antigo em chat preservando scroll

Impacto: médio
Esforço: médio
Prioridade: P2

**Problema:** `get_conversation_messages(conversation_id, cursor, 30)` paginar mensagens antigas, mas o UI atual não tem trigger pra puxar mais. Usuário só vê últimas 30.

**Solução:**

- Em `ChatScreen` (conversa aberta), adicionar `IntersectionObserver` no TOPO da lista (oposto do feed).
- Quando o usuário scroll-para-cima e o sentinel entra em viewport, dispara `loadMoreMessages(conversationId, oldestCursor)`.
- Preservar posição de scroll: depois do prepend, recalcular `scrollTop` pra manter a mesma mensagem visível.

### P2 — Paginação visual de profile posts em sheets/telas longas

Impacto: baixo/médio
Esforço: baixo
Prioridade: P2

`get_profile_posts(user_id, cursor, limit)` já paginar. Falta UI:

- `ProfileScreen`: trigger igual feed (penúltimo post visível).
- `ProfileSheet`: mesmo padrão dentro do scroll.

### P2 — Thumbnails/posters para mídia enviada no chat

Impacto: médio
Esforço: médio
Prioridade: P2

`direct_messages` ganhou `thumbnail_url`/`poster_url`/`media_width`/etc em Sprint D, mas o upload via chat ainda envia só a mídia original. Replicar a geração client-side que o post upload já faz.

Arquivo provável: `apps/web/src/components/gym-circle/screens/ChatScreen.tsx`, helper de upload.

### P2 — Backfill de mídia antiga (Worker/Edge Function)

Impacto: alto (para legacy)
Esforço: alto
Prioridade: P2

Mídia anterior a Sprint D não tem thumbnails/posters. Edge Function que:

1. Lista `posts`/`stories`/`direct_messages` onde `thumbnail_url IS NULL AND media_url IS NOT NULL`.
2. Baixa cada mídia, gera thumbnail/poster/blur via ImageMagick ou similar (FFmpeg pra vídeo).
3. Sobe no Storage e atualiza row.
4. Roda em batches pra não estourar Functions timeout.

Pode ficar como cron diário ou job manual no Supabase.

### P3 — Bundle analyzer + tree-shake review

Impacto: baixo/médio
Esforço: baixo
Prioridade: P3

Rodar `next build --analyze` (ou `@next/bundle-analyzer`) e inspecionar:

- Componentes que ficaram no bundle inicial após Sprint B (provável: GymCirclePreview, FeedScreen, alguns helpers).
- Imports de `lucide-react` (cada icon = um chunk; verificar se está sendo tree-shaken).
- Helpers do `packages/core` arrastados sem necessidade.

Documentar achados antes de mexer.

### P3 — `profiles.select("*")` e `follows.select("*")` remanescentes (G6 do audit)

Impacto: alto se o banco crescer
Esforço: médio
Prioridade: P3 (alpha pequena ainda aguenta)

Sprint C tirou esses fetches da camada de discovery/search via RPCs `search_profiles` e `get_user_suggestions`. Mas `refreshHomeCritical` ainda baixa `profiles.select("*")` completo pra alimentar a relação user→profile no cliente.

**Plano:**

- Criar RPC `get_home_profile_set(user_id)` que retorna apenas:
  - Próprio profile completo.
  - Profiles dos autores dos posts no feed inicial.
  - Profiles dos seguidores/seguidos do user.
  - Profiles dos participantes das stories ativas.
- Frontend: substitui `profiles.select("*")` por essa RPC.
- `users` adicionais (search, mention, suggested) já são lazy via Sprint C RPCs.

Risco: o set "users visíveis no feed inicial" muda toda vez que `feed_posts` muda. A RPC pode ficar lenta com muitos relacionamentos. Considerar materialização ou view com índice composto.

## Compatibilidade

Todos os itens são **aditivos** — clientes antigos continuam funcionando:

- `p_window_hours` é opcional na RPC.
- Cache local é client-side, não afeta server.
- Prefetch idle não bloqueia nada.
- `blur_data_url` é opcional na resposta.
- Backfill respeita rows existentes.

## Métricas adicionadas

```
feed_window_hours_load_ms  // tempo de fetch por janela
realtime_listener_count    // listeners ativos (deve cair pós-Sprint E)
cache_hit_rate             // % de boots servidos do cache local
chunk_prefetch_hit_rate    // % de chunks já em cache quando user abre
blur_placeholder_used      // % de imagens com placeholder antes de load
```

Todas gated por `NEXT_PUBLIC_PERF_DEBUG=true`.

## Riscos restantes

- Mudar `get_home_feed` pra aceitar `p_window_hours` exige redeploy do Supabase RPC. Aplicar via MCP + manual SQL fallback (padrão das Sprints anteriores).
- Cache local pode mostrar dados stale por até 2 minutos após mutation se invalidação falhar. Aceitável pra v1.
- Prefetch idle pode atrasar boot em redes 3G/edge; mitigado por `requestIdleCallback` que só roda em idle real.
- Backfill é I/O pesado no Supabase; rodar em horário de baixo tráfego (madrugada BR).
- Bundle analyzer pode revelar dependências profundas que exigem refactor maior do que esperado.

## Validação esperada antes do deploy

```bash
npm run lint
npm run build
npm test -- --run
npx cap sync ios
git diff --check
```

Validação remota (após migration):

- `select * from get_home_feed(null, 30, 48)` retorna posts dos últimos 48h.
- `select * from get_home_feed('2026-05-19T12:00Z', 30, 48)` retorna janela de 48h antes do cursor.
- Smoke das outras RPCs continua passando.

## Itens carregados pra futuras sprints (F+)

- WebSocket consolidado (canal único com filtros server-side) em vez de N listeners.
- Service Worker com cache-first pra assets estáticos + offline real.
- IndexedDB pra cache persistente entre sessões (vs sessionStorage atual).
- Skeleton mais detalhado por surface (não só o feed genérico atual).
- Suspense boundaries por surface pra streaming SSR.

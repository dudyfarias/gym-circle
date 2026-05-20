# Gym Circle Performance Audit

Data: 2026-05-20

Rodada: pos-Sprint A.

Escopo: nova analise estatica do codigo, build local recente e deploy de producao na Vercel. Nenhuma migration, alteracao de Supabase remoto ou mudanca de produto foi feita nesta rodada.

## 1. Resumo executivo

A Sprint A reduziu o maior gargalo de percepcao nativa: o app autenticado nao precisa mais esperar o refresh social completo para montar a home. Agora o shell/feed pode aparecer com skeleton enquanto os dados sociais hidratam em camadas.

O refresh inicial tambem ficou mais leve. O feed caiu de 200 para 30 posts, comentarios completos sairam do boot, likes completos sairam do boot, chat saiu do boot e videos deixaram de usar `preload="auto"`.

O app ainda tem pontos importantes para a Sprint B: `profiles.select("*")`, `follows.select("*")` e a view `feed_posts.select("*")` ainda entram no caminho critico; o feed ainda filtra permissao/follow no cliente; chat ainda carrega ate 300 mensagens quando abre; e o bundle inicial segue com varias telas/sheets importadas estaticamente.

Deploy de producao: `READY`, aliasado para `https://gym-circle-rust.vercel.app`.

## 2. Principais gargalos encontrados

| ID | Problema | Estado pos-Sprint A | Impacto | Esforco | Prioridade |
| --- | --- | --- | --- | --- | --- |
| G1 | Boot bloqueado por refresh completo | melhorado: shell monta cedo e feed mostra skeleton | alto | feito parcial | P0 concluido parcial |
| G2 | Feed inicial carregava dados demais | melhorado: `limit(30)`, sem comments/likes completos | alto | feito parcial | P0 concluido parcial |
| G3 | Chat entrava no boot | melhorado: chat carrega ao abrir aba; badge usa count leve | alto | feito parcial | P0 concluido parcial |
| G4 | Realtime disparava refresh global para tudo | melhorado para likes/comments/chat/notifications; ainda global para posts/stories/follows/checkins/stats | medio | medio | P1 |
| G5 | Videos com preload pesado | melhorado: `preload="metadata"` e feed toca quando visivel | alto | feito | P1 concluido |
| G6 | Queries criticas amplas | ainda existe `profiles.select("*")`, `follows.select("*")`, `feed_posts.select("*")` no boot | alto | medio | P1 |
| G7 | Feed filtra follows no cliente | ainda existe; banco envia mais do que a tela precisa | alto | medio | P1 |
| G8 | Chat aberto carrega historico amplo | ainda busca ate 300 mensagens quando a aba abre | medio | medio | P1 |
| G9 | Bundle inicial sem code splitting por surface | ainda importa varias telas e modais no bundle inicial | medio | medio | P1 |
| G10 | Midia sem thumbnail/poster/transcoding | ainda usa original do Storage para feed/story/chat | medio | alto | P2 |

## 3. O que melhorou na Sprint A

### Boot

- `LiveHomeWrapper` nao bloqueia mais a home por `social.loading && feedPosts.length === 0`.
- `GymCirclePreview` monta apos auth, mesmo durante hidratacao social.
- `FeedScreen` mostra skeleton leve quando nao ha posts carregados.
- `performance.mark()`/`performance.measure()` foram centralizados em `apps/web/src/components/gym-circle/performance.ts` e ficam ativos apenas com `NEXT_PUBLIC_PERF_DEBUG=true`.

Impacto esperado: primeira tela util aparece mais cedo no iPhone/Capacitor, com menos risco de parecer splash travado.

### Feed

- `feed_posts` inicial caiu de `limit(200)` para `limit(30)`.
- Likes completos foram movidos para `refreshPostDetails(postId)`.
- Comentarios completos foram movidos para `refreshPostDetails(postId)`.
- Comment likes tambem carregam apenas no detalhe do post.
- O feed inicial ainda preserva `likes_count`, `comments_count`, autor, midia, caption e streak basico.

Impacto esperado: menos payload e menos processamento antes do primeiro feed.

### Chat

- `direct_messages.limit(300)` saiu do boot.
- `refreshChat()` carrega conversas/mensagens quando a aba chat abre.
- Antes de abrir o chat, o app busca apenas um count leve de mensagens nao lidas.

Impacto esperado: abertura do app nao paga custo de DMs.

### Stories

- Stories ativos foram limitados no boot inicial.
- Likes/views/mutes/participants dos stories sairam do caminho critico e entram em camada secundaria.
- Story likes deixaram de forcar refresh global.

Impacto esperado: story tray fica mais barato no boot, sem perder estado visto/curtido depois da hidratacao.

### Realtime

- `post_likes` atualiza contagem local do post afetado quando possivel.
- `post_comments` atualiza contagem local e so recarrega detalhe se aquele post ja tinha detalhes carregados.
- `direct_messages`, `conversations` e `conversation_participants` nao atualizam o app inteiro; hidratam chat se ele ja estiver aberto, ou apenas unread count.
- `notifications` atualiza apenas notificacoes.

Impacto esperado: curtir, comentar e receber mensagem deixam de reprocessar feed/stories/chat de uma vez.

### Midia

- Videos de feed, story viewer, preview de post, chat/check-in e thumbnails usam `preload="metadata"`.
- Video do feed usa `IntersectionObserver` para tocar apenas quando visivel.
- Preload manual de imagens foi reduzido.

Impacto esperado: menos rede/memoria no boot e no scroll.

## 4. Gargalos por area

### Boot

O gargalo P0 anterior foi reduzido, mas o caminho critico ainda faz:

- `profiles.select("*")`
- `follows.select("*")`
- `feed_posts.select("*").limit(30)`
- `stories.select("*").limit(40)`
- blocks/mutes
- stats dos autores criticos
- likes do usuario atual nos posts iniciais

Isso ja e bem melhor que carregar o app inteiro, mas ainda nao e o desenho ideal. A proxima melhoria deve ser uma RPC/view especifica para home, retornando apenas o necessario para o usuario atual.

Prioridade: P1.

### Feed

O feed inicial ficou mais leve, mas ainda:

- busca `feed_posts.select("*")` em vez de colunas estritas;
- filtra follows/mutes/participantes no cliente;
- renderiza todos os posts carregados sem virtualizacao;
- depende de `feed_posts` com counts embutidos.

Prioridade: P1 criar `get_home_feed(cursor, limit)` no Supabase e paginação real.

### Stories

Stories melhoraram no boot, mas ainda:

- o tray busca rows completas de `stories`;
- grouping e ordenacao seguem no cliente;
- views/likes ainda dependem de tabelas separadas apos hidratacao;
- story viewer ainda nao tem preload controlado do proximo item com cancelamento fino.

Prioridade: P1 para `get_story_tray()` ou service dedicado.

### Chat

Chat saiu do boot, o que era a maior vitoria. Ao abrir a aba, ainda:

- busca participantes/conversas;
- carrega ate 300 mensagens;
- monta agrupamento no cliente.

Prioridade: P1 criar resumo de conversas e paginação por conversa.

### Supabase

O padrao de query melhorou, mas ainda ha risco de escala por payload amplo:

- `profiles.select("*")` no critico;
- `follows.select("*")` no critico;
- `gyms.select("*")` e `user_gyms.select("*")` na camada secundaria;
- `feed_posts.select("*")`;
- chat com historico amplo ao abrir.

Indices/RPCs candidatos para Sprint B:

- RPC `get_home_feed(cursor, limit)` com filtro por follows, bloqueios, mutes e privacidade.
- RPC `get_conversation_summaries()` com ultima mensagem, unread count e participantes.
- RPC/view `get_story_tray()` agrupada por autor com flag de unseen.
- Indices para validar com `EXPLAIN`: `stories (expires_at, created_at desc)`, `follows (follower_id, status, following_id)`, `conversation_participants (user_id, last_read_at, conversation_id)`, `notifications (user_id, read_at, created_at desc)`.

### Midia

Ainda nao ha:

- thumbnail por post/story;
- poster de video;
- compressao/transcoding de video;
- URLs de imagem por surface;
- limites mais fortes de tamanho/duracao para video.

Prioridade: P2, mas vira P1 se usuarios reais começarem a postar videos grandes.

### React / Frontend

Ainda ha oportunidade clara de code splitting:

- `ChatScreen`
- `PostScreen`
- `StoryViewer`
- `ProfileSheet`
- `LikesOverlay`
- Admin/recap/modais pesados

O bundle observado localmente em `apps/web/.next/static/chunks` ficou em `1,330,588` bytes de JS, ainda perto de 1.3 MB. A Sprint A reduziu payload de dados, nao bundle.

Prioridade: P1.

### Capacitor / iOS

O app continua usando `server.url` remoto da Vercel no Capacitor. Isso e bom para update rapido, mas ainda significa que abertura nativa depende de rede/URL remota.

Pontos que seguem:

- medir em iPhone real com `NEXT_PUBLIC_PERF_DEBUG=true`;
- avaliar shell local mais forte para abrir instantaneo;
- haptics nativo ainda nao foi implementado;
- cache offline ainda e basico.

Prioridade: P2, exceto medicao em device, que e P1.

## 5. Metricas observadas

### Build local

- `npm run build`: passou.
- Next/Turbopack compilou em cerca de 2.1 s.
- TypeScript finalizou em cerca de 3.0 s.
- `apps/web/.next/static/chunks`: `1,330,588` bytes de JS.

### Testes locais recentes

- `npm run lint`: passou.
- `npm test -- --run`: passou, 22 arquivos e 134 testes.
- `npx cap sync ios`: passou.

### Vercel production deploy

- Deployment ID: `dpl_26qkBu6x1hpoUgtQdBC9VWgGvXAu`
- Preview/production URL gerada: `https://gym-circle-b4o4kxev8-dudycappia-4508s-projects.vercel.app`
- Alias de producao: `https://gym-circle-rust.vercel.app`
- Remote build: compilacao Next em 8.8 s; TypeScript em 9.0 s; build total em 24 s.
- Estado: `READY`.

## 6. Quick wins restantes

| Acao | Impacto | Esforco | Prioridade |
| --- | --- | --- | --- |
| Trocar `profiles.select("*")` por colunas estritas no critico | medio | baixo | P1 |
| Trocar `follows.select("*")` por colunas estritas no critico | medio | baixo | P1 |
| Criar `get_home_feed(cursor, limit)` e parar de filtrar feed no cliente | alto | medio | P1 |
| Criar summaries de chat e carregar mensagens por conversa | alto | medio | P1 |
| Lazy load de telas/sheets secundarias | medio | medio | P1 |
| Carregar posts historicos do perfil sob demanda | medio | medio | P1 |
| Adicionar thumbnails/posters para videos | alto | alto | P2 |
| Medir `app_boot_ms` e `feed_first_posts_ms` no iPhone real | alto | baixo | P1 |

## 7. Plano recomendado

### Sprint B: dados por surface

1. RPC `get_home_feed(cursor, limit)`.
2. RPC `get_story_tray()`.
3. RPC `get_conversation_summaries()`.
4. Mensagens por conversa com cursor.
5. Perfil com posts sob demanda.
6. Colunas estritas em todas as queries criticas.

### Sprint C: bundle e midia

1. Code splitting de telas e sheets.
2. Thumbnail/poster para cada upload.
3. Compressao ou limite forte para video.
4. Preload apenas do proximo story/post visivel.

### Sprint D: nativo

1. Medicoes em iPhone real com flag de performance.
2. Melhor shell local Capacitor.
3. Haptics nativo.
4. Cache local mais robusto.

## 8. Conclusao

A Sprint A atacou corretamente os gargalos de percepcao mais urgentes: boot bloqueado, feed pesado, chat no boot, realtime global e videos agressivos. A proxima maior melhoria nao e visual; e mover regras de feed/chat/story para queries/RPCs especificas do Supabase e reduzir o bundle inicial com code splitting.

# Gym Circle Performance Sprint A

Data: 2026-05-20

Escopo: otimizar velocidade percebida no boot, feed inicial, chat, stories, realtime e midia sem mudar produto, layout principal, regras sociais ou banco remoto.

## Mudancas feitas

### Boot e shell

- `LiveHomeWrapper` deixou de bloquear a home enquanto o refresh social completo termina.
- Apos auth resolvido, o app monta `GymCirclePreview` imediatamente.
- `FeedScreen` recebeu skeleton leve quando ainda nao existem posts carregados.
- Logs/medidas de boot ficaram protegidos por `NEXT_PUBLIC_PERF_DEBUG=true`.

Arquivos:

- `apps/web/src/components/gym-circle/LiveHomeWrapper.tsx`
- `apps/web/src/components/gym-circle/GymCirclePreview.tsx`
- `apps/web/src/components/gym-circle/screens/FeedScreen.tsx`
- `apps/web/src/components/gym-circle/performance.ts`

### Refresh social em camadas

- `useSupabaseSocial` foi separado em camadas:
  - `refreshHomeCritical`: perfil, follows, feed inicial leve, stories ativos limitados, bloqueios/mutes e likes apenas do usuario atual.
  - `refreshHomeSecondary`: stats completas, academias, user_gyms, activity days, check-ins, story views, story likes do usuario atual, mutes e participantes.
  - `refreshChat`: conversas e mensagens apenas quando a aba chat abre ou quando o chat ja foi hidratado.
  - `refreshPostDetails`: likes, comentarios, comment likes e participantes apenas quando abrir comentarios/detalhes/overlay de curtidas.
- `feed_posts` inicial caiu de `limit(200)` para `limit(30)`.
- Comments completos, likes completos e comment likes sairam do boot.
- Chat deixou de buscar `direct_messages.limit(300)` no boot.
- O contador leve de mensagens nao lidas usa query `count` sem carregar historico completo.

Arquivo:

- `apps/web/src/components/gym-circle/social/useSupabaseSocial.ts`

### Realtime menos agressivo

- `post_likes` agora ajusta contagem local do post afetado quando possivel.
- `post_comments` atualiza contagem local e so recarrega detalhes se aquele post ja estava com detalhes abertos/carregados.
- `direct_messages`, `conversations` e `conversation_participants` atualizam o chat apenas se ele ja foi aberto; antes disso, atualizam somente o contador leve.
- `notifications` atualiza apenas a lista/contador de notificacoes.
- `story_likes` atualiza estado local sem refresh global.

Arquivo:

- `apps/web/src/components/gym-circle/social/useSupabaseSocial.ts`

### Midia

- Videos de feed, stories, preview de postagem e thumbnails passaram de `preload="auto"` para `preload="metadata"`.
- Videos do feed tocam apenas quando visiveis via `IntersectionObserver`.
- Preload manual de imagens foi reduzido para competir menos com o feed inicial.

Arquivos:

- `apps/web/src/components/gym-circle/design-system/SocialPostCard.tsx`
- `apps/web/src/components/gym-circle/design-system/StoryViewer.tsx`
- `apps/web/src/components/gym-circle/design-system/VideoThumbnail.tsx`
- `apps/web/src/components/gym-circle/screens/PostScreen.tsx`
- `apps/web/src/components/gym-circle/GymCirclePreview.tsx`

## Antes/depois esperado

Antes:

- App autenticado esperava um refresh amplo antes de mostrar a primeira tela util.
- Feed carregava ate 200 posts e buscava likes/comentarios completos.
- Chat, conversas e mensagens entravam no boot mesmo sem abrir a aba.
- Realtime de pequenas acoes podia disparar refresh global.
- Videos carregavam metadata/arquivo cedo demais.

Depois:

- Shell, header, tab bar e skeleton/feed aparecem mais cedo.
- Feed inicial baixa ate 30 posts e hidrata detalhes sociais sob demanda.
- Chat so carrega dados completos ao abrir a aba.
- Likes/comentarios/realtime afetam menos o app inteiro.
- Videos deixam de iniciar downloads pesados no boot.

## Riscos restantes

- `profiles.select("*")` e `follows.select("*")` ainda entram no refresh critico. Para alpha pequena e aceitavel, mas precisa virar RPC/view paginada na Sprint B.
- O feed ainda filtra follows no cliente; o ideal e `get_home_feed` no Supabase retornando apenas posts permitidos.
- Perfil historico continua dependente do conjunto carregado no feed inicial. Para perfil completo, criar query sob demanda de posts do usuario.
- Chat ainda carrega ate 300 mensagens ao abrir a aba. A Sprint B deve separar lista de conversas de historico por conversa.
- Code splitting de sheets/telas secundarias ficou para Sprint B para reduzir risco nesta entrega.
- Videos ainda nao tem poster/thumbnail/transcoding dedicado.

## Itens para Sprint B

1. Criar RPC/view `get_home_feed(cursor, limit)` com follows, bloqueios, mutes, privacidade, `liked_by_me`, counts e previews leves.
2. Criar `get_conversation_summaries()` e carregar mensagens por conversa com cursor.
3. Carregar posts do perfil sob demanda por usuario.
4. Lazy load seguro de `ChatScreen`, `PostScreen`, `StoryViewer`, `ProfileSheet`, `LikesOverlay`, admin e recap.
5. Gerar thumbnails/posters para fotos/videos e usar URLs por surface.
6. Realtime filtrado por surface/conversa quando possivel.
7. Medir em iPhone real: `app_boot_ms`, `feed_first_posts_ms`, `chat_open_ms`, `stories_open_ms`.

## Validacao

Comandos executados nesta Sprint:

- `npm run build`: passou.
- `npm run lint`: passou.
- `npm test -- --run`: passou, 22 arquivos e 134 testes.
- `npx cap sync ios`: passou.

# Gym Circle Performance Sprint B

## Resumo

A Sprint B separou as surfaces principais do app para reduzir payload, parsing JSON e hidratação desnecessária no iPhone/Capacitor. A experiência visual não foi redesenhada; as mudanças ficam na camada de dados, carregamento e bundle inicial.

## RPCs Criadas

- `get_home_feed(cursor, limit)`: feed inicial já filtrado no Supabase por follows, mutes, bloqueios, conta ativa e privacidade.
- `get_story_tray(limit)`: tray de stories com dados mínimos, estado visto/não visto e ordenação por grupos com conteúdo não visto.
- `get_conversation_summaries()`: lista de conversas sem carregar histórico completo.
- `get_conversation_messages(conversation_id, cursor, limit)`: últimas 30 mensagens da conversa aberta, com cursor para paginação futura.
- `get_profile_posts(user_id, cursor, limit)`: posts do perfil carregados sob demanda, incluindo posts aceitos por marcação.

## Payload Reduzido

- Feed deixou de depender de `feed_posts.select("*")` no boot e passou a usar `get_home_feed`.
- Stories deixaram de buscar a tabela inteira no boot e passaram a usar `get_story_tray`.
- Chat deixou de carregar até 300 mensagens ao abrir a aba; a lista recebe só resumos e última mensagem.
- Perfis agora carregam seus posts via surface própria quando o perfil é aberto.
- Queries críticas trocaram `select("*")` por colunas explícitas em notificações, profiles, follows, gyms, user_gyms, activity days, check-ins, story likes, story mutes e story views.

## Bundle Inicial

Foram movidos para `next/dynamic`:

- `ChatScreen`
- `PostScreen`
- `ProfileScreen`
- `StoryViewer`
- `AdminPanelSheet`
- `UserSearchSheet`
- `ProfileSheet`
- `EditProfileSheet`
- `EditPostSheet`
- `MonthlyRecapSheet`
- `NotificationsSheet`
- `ConfirmSheet`
- `PostMenuSheet`
- `PostDetailSheet`
- `LikesOverlay`
- `AccountSettingsSheet`

## Listeners e Hidratação

- Realtime de mensagens agora atualiza o resumo do chat quando o chat está hidratado, sem puxar histórico completo.
- O histórico de uma conversa é carregado apenas ao abrir a conversa.
- Likes e comentários continuam atualizando localmente quando possível, sem refresh global pesado.

## Métricas

Mantido `NEXT_PUBLIC_PERF_DEBUG=true` para logs de performance.

Métricas adicionadas/continuadas:

- `app_boot_ms`
- `feed_first_posts_ms`
- `chat_open_ms`
- `conversation_open_ms`
- `stories_open_ms`
- `profile_open_ms`
- `profile_posts_ms`

## Antes / Depois Esperado

- Boot com menos dados críticos para parsear.
- Feed inicial menor e filtrado pelo banco.
- Chat abre mais leve porque não traz histórico completo.
- Perfil não depende mais do feed inicial para mostrar posts antigos.
- Menos JS inicial por conta de code splitting de telas e sheets pesados.

## Riscos Restantes

- Em 2026-05-20, a migration da Sprint B foi aplicada manualmente no Supabase remoto via SQL Editor e as RPCs foram confirmadas sem erro:
  - `get_home_feed`
  - `get_story_tray`
  - `get_conversation_summaries`
  - `get_conversation_messages`
  - `get_profile_posts`
- O Supabase CLI ainda fica preso em `Initialising login role...`; por isso novas migrations continuam tendo fallback manual em `supabase/admin/`.
- `refreshHomeSecondary()` deixou de carregar profiles/follows amplos para busca/sugestões na Sprint C segura, aplicada no remoto como `20260520184302 performance_sprint_c_discovery_search`.
- `get_story_tray()` ainda retorna `media_url` para manter o viewer atual simples. Sprint C pode dividir em tray sem mídia e viewer sob demanda por story.
- Realtime ainda usa alguns listeners amplos para preservar comportamento social. Sprint C pode assinar apenas posts visíveis e conversa aberta.
- A validação local de migrations via Supabase CLI não rodou porque o Postgres local não estava ativo em `127.0.0.1:54322`.

## Plano Sprint C

- Criar RPC de busca por username e sugestões sociais, removendo profiles/follows amplos do secondary.
- Separar story tray sem mídia de `get_story_viewer_items(author_id)`.
- Adicionar paginação real para feed, profile posts e histórico de chat no UI.
- Reduzir realtime para canais por post/conversa/surface ativa.
- Adicionar thumbnails/transcoding para vídeo e imagem de feed/story.

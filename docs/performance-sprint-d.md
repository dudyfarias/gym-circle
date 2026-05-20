# Gym Circle Performance Sprint D

## Resumo

Sprint D focou em mídia pesada, story tray mais leve e paginação incremental sem redesign e sem mudar regras sociais. As mudanças foram aditivas para preservar o app publicado e o TestFlight.

## Mudanças feitas

- Adicionados campos opcionais de mídia em `posts`, `stories` e `direct_messages`:
  - `thumbnail_url`
  - `poster_url`
  - `media_width`
  - `media_height`
  - `media_duration_seconds`
  - `blur_data_url`
- Criada migration `20260520190107_performance_sprint_d_media_story_viewer.sql`.
- Criado fallback manual em `supabase/admin/apply_sprint_d_media_story_viewer.sql`.
- `get_home_feed`, `get_profile_posts`, `get_conversation_summaries` e `get_conversation_messages` passam a retornar metadata opcional.
- Criada RPC aditiva `get_story_tray_lightweight(limit)` para tray agrupado sem carregar mídia.
- Criada RPC `get_story_viewer_items(author_id)` para carregar mídia do story apenas quando o usuário toca na bolinha.
- Frontend usa `get_story_tray_lightweight` com fallback para `get_story_tray` legado.
- Story viewer hidrata os itens do autor sob demanda.
- Feed usa `thumbnail_url` quando existir e vídeos usam `poster_url`.
- Profile grid, latest post, check-in previews, edit sheet e chat passam a usar thumbnail/poster com fallback.
- Upload de imagem de post gera thumbnail client-side quando possível.
- Upload de vídeo tenta gerar poster do primeiro frame quando possível.
- Feed ganhou paginação incremental via cursor de `get_home_feed`.
- Métricas dev adicionadas:
  - `load_more_feed_ms`
  - `story_viewer_items_ms`
  - `image_upload_ms`
  - `thumbnail_generation_ms`

## Compatibilidade

- `get_story_tray` legado foi mantido para clientes já publicados.
- Campos de mídia são opcionais e não quebram posts/stories/mensagens antigos.
- Se thumbnail/poster falhar, o app usa a mídia original.
- Se `get_story_tray_lightweight` ainda não existir no remoto, o app usa o RPC legado.

## Aplicação remota

Antes de qualquer deploy que dependa dos novos campos/RPCs, aplicar:

- `supabase/migrations/20260520190107_performance_sprint_d_media_story_viewer.sql`

Ou manualmente:

- `supabase/admin/apply_sprint_d_media_story_viewer.sql`

Validações remotas esperadas:

- Colunas opcionais existem em `posts`, `stories`, `direct_messages`.
- RPCs existem:
  - `get_story_tray_lightweight`
  - `get_story_viewer_items`
- RPCs atualizadas seguem respondendo:
  - `get_home_feed`
  - `get_profile_posts`
  - `get_conversation_summaries`
  - `get_conversation_messages`

## Pendências Seguras Para Sprint E

- Paginação de histórico antigo em chat preservando posição exata do scroll.
- Paginação visual de profile posts em sheets/telas longas.
- Thumbnails/posters para mídia enviada no chat.
- Cache local com TTL para último feed/story tray.
- Realtime por post visível, substituindo listeners amplos restantes de `posts`, `stories`, `follows`, `checkins` e `user_stats`.
- `blur_data_url` real com placeholder progressivo.
- Worker/Edge Function para backfill de thumbnails/posters de mídia antiga.

## Riscos Restantes

- Geração de poster de vídeo em iOS WebView pode falhar dependendo do codec/permissões de seek. O fluxo é fail-soft.
- Thumbnails client-side aumentam alguns segundos no upload em aparelhos antigos, mas reduzem payload de feed depois.
- O tray leve depende do deploy novo para ser usado; clientes antigos continuam usando `get_story_tray`.

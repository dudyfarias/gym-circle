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

Sprint D foi aplicada no Supabase remoto do projeto `qajjpjmybmqqwflytcpr` via MCP/Supabase integration em 2026-05-20.

Arquivo local:

- `supabase/migrations/20260520190107_performance_sprint_d_media_story_viewer.sql`

Fallback manual:

- `supabase/admin/apply_sprint_d_media_story_viewer.sql`

Histórico remoto:

- `20260520193024 performance_sprint_d_media_story_viewer`

Essa diferença de timestamp existe porque a aplicação remota foi feita pelo MCP. O SQL aplicado é equivalente ao arquivo local da Sprint D.

Validações remotas feitas:

- `posts`: 6/6 colunas opcionais confirmadas.
- `stories`: 6/6 colunas opcionais confirmadas.
- `direct_messages`: 6/6 colunas opcionais confirmadas.
- RPCs confirmadas:
  - `get_story_tray_lightweight`
  - `get_story_viewer_items`
  - `get_home_feed`
  - `get_profile_posts`
  - `get_conversation_summaries`
  - `get_conversation_messages`
- Smoke SQL executado sem erro para:
  - `get_story_tray_lightweight(10)`
  - `get_story_viewer_items(author_id)`
  - `get_home_feed(null, 5)`
  - `get_profile_posts(user_id, null, 5)`
  - `get_conversation_summaries()`
  - `get_conversation_messages(conversation_id, null, 5)`

## Correção Relacionada: FullProfile

Depois da Sprint D, foi corrigido um bug de perfil completo em `a5c256d fix: preserve full profile data`.

Causa:

- Linhas parciais de `ProfilePreview` vindas de feed/stories/busca/sugestões podiam sobrescrever o `FullProfile` no estado local.
- A edição de perfil tentava deduzir a academia principal pelo nome em vez de preservar `main_gym_id`.

Correção:

- `ProfilePreview` e `FullProfile` agora são mesclados por `mergeProfileRows`, preservando campos editáveis completos.
- O próprio perfil continua sendo carregado por query completa em `profiles`.
- `profileService.update` remove `undefined` antes do update e preserva campos não alterados.
- Salvar perfil atualiza o estado local imediatamente com a row completa retornada pelo Supabase.
- `mainGymId` foi adicionado ao usuário enriquecido para evitar salvar academia principal como `null` por falta de dados secundários.

Validações locais da correção:

- `npm run lint`
- `npm run build`
- `npm test -- --run`
- `npx cap sync ios`
- `git diff --check`

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

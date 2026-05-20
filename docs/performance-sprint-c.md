# Gym Circle Performance Sprint C

Data: 2026-05-20

## Status

Sprint C foi iniciada com foco em estabilidade de release. A Sprint B foi aplicada manualmente no Supabase remoto em 2026-05-20 via SQL Editor e as RPCs principais foram confirmadas sem erro.

O Supabase CLI ainda fica preso em `Initialising login role...` no projeto linkado `qajjpjmybmqqwflytcpr`, então a migration nova da Sprint C também tem fallback manual preparado.

Arquivos SQL manuais:

- Sprint B: `supabase/admin/apply_sprint_b_performance_surface_rpcs.sql`
- Sprint C: `supabase/admin/apply_sprint_c_discovery_search.sql`

Os SQLs criam índices/RPCs e não apagam nem alteram dados de usuários.

## Proteções Adicionadas

Para evitar tela branca caso frontend e banco fiquem temporariamente fora de sincronia:

- `get_home_feed` agora tem fallback seguro para a view antiga `feed_posts`.
- `get_story_tray` agora tem fallback seguro para a tabela `stories`.
- `get_conversation_summaries` falha em modo vazio amigável em vez de derrubar o chat.
- `get_conversation_messages` falha sem quebrar a conversa aberta.
- `get_profile_posts` falha sem quebrar o perfil.
- Logs aparecem apenas com `NEXT_PUBLIC_PERF_DEBUG=true`.

Esses fallbacks são uma proteção operacional, não substituem a aplicação da migration remota.

## Sprint C Planejada

### P0: Consolidar Sprint B no Remoto

Impacto: alto  
Esforço: baixo/médio  
Prioridade: P0

- Aplicar `20260520141439_performance_surface_rpcs.sql` no Supabase remoto.
- Confirmar existência das RPCs:
  - `get_home_feed`
  - `get_story_tray`
  - `get_conversation_summaries`
  - `get_conversation_messages`
  - `get_profile_posts`
- Só depois liberar deploy Vercel/App Store candidate.

### P1: RPCs de Descoberta Social

Impacto: alto  
Esforço: médio/alto  
Prioridade: P1  
Status: implementado localmente, pendente aplicação remota manual/CLI

Criado na migration `20260520181726_performance_sprint_c_discovery_search.sql`:

- `get_user_suggestions(current_lat, current_lng, limit)`
- `search_profiles(query, limit)`

Objetivo:

- remover `profiles.select(...)` amplo do refresh secundário;
- remover `follows.select(...)` amplo para busca/sugestões;
- respeitar bloqueios, contas suspensas/deletadas, privacidade e RLS;
- retornar apenas dados mínimos para UI.

Frontend:

- busca de usuários chama `search_profiles` com fallback local;
- sugestões chamam `get_user_suggestions` com fallback vazio/local;
- `refreshHomeSecondary()` não baixa mais `profiles`/`follows` completos para descoberta/busca.

### P1: Story Tray Sem Mídia

Impacto: alto  
Esforço: médio  
Prioridade: P1

Criar versão leve:

- `get_story_tray` sem `media_url`;
- `get_story_viewer_items(author_id)` sob demanda.

Motivo para não alterar agora:

- o viewer atual ainda depende de stories completos em memória;
- trocar a assinatura da RPC antes do remoto estar aplicado aumentaria risco de quebra em TestFlight.

### P1: Paginação Real

Impacto: alto  
Esforço: médio  
Prioridade: P1

Implementar incrementalmente:

- feed: carregar próxima página via cursor sem recarregar tudo;
- perfil: posts próprios por cursor;
- chat: histórico por cursor ao subir a conversa.

### P2: Realtime Mais Seletivo

Impacto: médio/alto  
Esforço: médio  
Prioridade: P2

Reduzir listeners amplos restantes:

- `posts`, `stories`, `follows`, `checkins`, `user_stats`;
- manter listeners dedicados para notificações e conversa aberta;
- atualizar contadores locais quando possível.

### P2: Thumbnails/Posters

Impacto: alto  
Esforço: alto  
Prioridade: P2

Adicionar campos opcionais em migration futura:

- `thumbnail_url`
- `poster_url`
- `media_width`
- `media_height`
- `media_duration_seconds`
- `blur_data_url`

Não implementado agora para não mexer no pipeline de upload antes de estabilizar as RPCs remotas.

### P2: Bundle/Code Splitting

Impacto: médio  
Esforço: baixo/médio  
Prioridade: P2

Revisar lazy loading adicional:

- busca de localização;
- modais de grupo;
- reações de story;
- sheets de follow requests;
- subseções de settings.

## Validação Necessária Antes de Deploy

Rodar:

```bash
npm run lint
npm run build
npm test -- --run
npx cap sync ios
git diff --check
```

Validação local em 2026-05-20:

- `npm run lint`: passou
- `npm run build`: passou
- `npm test -- --run`: passou, 22 arquivos e 134 testes
- `npx cap sync ios`: passou
- `git diff --check`: passou

Checklist remoto obrigatório antes de produção com Sprint C ativa:

- aplicar `supabase/admin/apply_sprint_c_discovery_search.sql` no Supabase;
- confirmar `search_profiles` e `get_user_suggestions`;
- abrir app logado;
- confirmar feed;
- abrir story tray;
- abrir chat;
- abrir conversa;
- abrir perfil;
- verificar que nenhuma tela mostra JSON cru.

## Riscos Restantes

- Sprint C só fica ativa no remoto depois da aplicação de `apply_sprint_c_discovery_search.sql`; até lá o app usa fallbacks e continua estável.
- Story tray ainda pode carregar mais dados do que o ideal enquanto o viewer depender do formato antigo.
- Thumbnails/posters seguem pendentes, então mídia pesada ainda é um gargalo em redes móveis.
- Paginação real de load-more no UI ainda fica para a próxima etapa segura.

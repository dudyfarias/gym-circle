# Auditoria de performance — `public.get_profile_posts`

Data da sprint: 2026-07-08  
Escopo: Gym Circle web/Capacitor atual, Supabase Query Performance, sem deploy e sem aplicar migrations em produção.

## Estado inicial do repositório

Branch inicial: `main`, sincronizada com `origin/main`.

Arquivos sujos encontrados antes desta sprint e mantidos fora do escopo:

- `ios-native/GymCircleNative/GymCircleNative.xcodeproj/project.pbxproj`
- `package.json`
- `package-lock.json`
- `android/`
- `ios/App/App/config 2.xml`

Observação: `ios/App/App/config 2.xml` parece arquivo duplicado/untracked. Não foi removido nesta sprint. Vale limpar depois com confirmação explícita.

Arquivos relacionados à sprint:

- `apps/web/src/components/gym-circle/social/useSupabaseSocial.ts`
- `apps/web/src/components/gym-circle/social/supabaseSocialActions.ts`
- `apps/web/src/components/gym-circle/social/profilePostsRequestCache.ts`
- `apps/web/src/components/gym-circle/social/profilePostsRequestCache.test.ts`
- `apps/web/src/components/gym-circle/social/supabaseSocialSelectors.ts`
- `apps/web/src/components/gym-circle/social/types.ts`
- `apps/web/src/components/gym-circle/GymCirclePreview.tsx`
- `apps/web/src/components/gym-circle/ProfileSheet.tsx`
- `apps/web/src/components/gym-circle/screens/ProfileScreen.tsx`
- `apps/web/src/components/gym-circle/design-system/ProfilePostsGrid.tsx`
- `supabase/migrations/20260708140659_revoke_backfill_user_achievements_execute.sql`

## Achado principal

`public.get_profile_posts` era chamada a partir de um único ponto central:

- `apps/web/src/components/gym-circle/social/useSupabaseSocial.ts`
  - action `refreshProfilePosts`
  - RPC `services.client.rpc("get_profile_posts", ...)`

Mas essa action era disparada por várias superfícies:

- `GymCirclePreview.openProfile(userId)` ao abrir perfil de outro usuário.
- `GymCirclePreview.openMyCircle(userId)` ao abrir Meu Circle.
- A aba `ProfileScreen`, para o usuário atual.
- Antes da correção: um `useEffect` no boot do `GymCirclePreview` chamava `refreshProfilePosts(currentUserId)` sempre que o app carregava, mesmo sem abrir o perfil.

## Causa provável do volume absurdo

O gargalo não era “muitos call sites” espalhados; era uma combinação perigosa:

1. Boot prefetch: todo app open fazia `get_profile_posts` do usuário atual.
2. Sem cache/TTL: abrir Perfil, MyCircle e ProfileSheet podia repetir a mesma chamada.
3. Sem dedupe: duas chamadas iguais simultâneas não compartilhavam a mesma Promise.
4. Limite alto no cliente: o frontend pedia `p_limit: 50`.
5. RPC pesada por execução:
   - junta `posts`, `profiles`, `gyms`, `user_stats_live`, `activities`;
   - retorna rota/métricas de treino;
   - calcula `likes_count` e `comments_count` com `lateral count(*)` por post;
   - calcula `liked_by_me` e `is_following_author` com `exists`;
   - chama `private.can_view_profile_posts(p_user_id)` e `private.can_view_profile_posts(p.user_id)`.

## Estado atual da função SQL

Metadados confirmados no Supabase:

- Função: `public.get_profile_posts(p_user_id uuid, p_cursor_created_at timestamptz, p_limit integer)`
- Linguagem: SQL
- Volatilidade: `STABLE`
- `SECURITY DEFINER`: não
- Executável por `authenticated`: sim
- Executável por `anon`: não
- Default atual: `p_limit default 30`
- Clamp atual no banco: `least(greatest(coalesce(p_limit, 30), 1), 50)`

O banco já usa cursor por `created_at`:

```sql
and (p_cursor_created_at is null or p.created_at < p_cursor_created_at)
order by p.created_at desc, p.id desc
```

Ponto de atenção: o cursor de SQL ordena por `created_at desc, id desc`, mas o parâmetro exposto só tem `created_at`. Em posts com timestamps idênticos, pode haver borda duplicada/ausente em paginação profunda. Não foi alterado nesta sprint para evitar quebrar contrato.

## Correções feitas no frontend

### 1. Cache + dedupe + TTL

Criado `profilePostsRequestCache` com:

- chave por `profile_user_id + cursor + limit`;
- dedupe de requests simultâneas idênticas;
- TTL de 60 segundos;
- `force` para refresh manual;
- invalidação por usuário;
- limpeza ao trocar `currentUserId`.

### 2. Limite menor

Antes:

- cliente enviava `p_limit: 50`.

Agora:

- default client-side: `15`;
- máximo client-side: `30`.

Isso reduz payload e custo por chamada sem migration.

### 3. Lifecycle

Antes:

- `GymCirclePreview` chamava `refreshProfilePosts(currentUserId)` no boot.

Agora:

- só chama quando a aba `profile` está ativa;
- `ProfileSheet` e `MyCircle` continuam carregando sob demanda;
- respostas são ignoradas se o hook desmontar.

### 4. Paginação segura

Adicionado `loadMoreProfilePosts(userId)`:

- não busca se já estiver carregando;
- não busca se `hasMore` for falso;
- não busca se não houver `nextCursor`;
- usa cursor da última linha recebida.

`ProfilePostsGrid` ganhou sentinel com `IntersectionObserver`, mas a proteção real contra double fetch fica na action.

### 5. Invalidação/local update

Invalidação de cache adicionada em:

- publicar post/treino;
- promover check-in para post;
- editar post;
- integrar treino em post;
- converter post em check-in;
- apagar post;
- aceitar/recusar marcação em post.

Para não refazer lista completa em interações leves:

- curtida continua otimista/local;
- comentário continua carregando detalhes do post, não a lista inteira do perfil.

Também foi feito update local ao apagar post e atualização otimista de capa/legenda/tipo/local ao editar.

## Estimativa de impacto

Impacto esperado:

- Remoção do boot prefetch: menos 1 chamada de `get_profile_posts` por sessão/app open.
- Dedupe: ProfileSheet/MyCircle/aba Perfil deixam de competir com chamadas iguais.
- TTL de 60s: navegação entre superfícies do mesmo perfil reutiliza o resultado.
- Limite 50 → 15: até 70% menos rows/payload por chamada inicial.

O relatório original apontava cerca de 77.753 chamadas de `get_profile_posts` somando as duas entradas. Esta sprint ataca volume e peso por chamada. A métrica real deve ser reavaliada depois de 24–72h de produção.

## Índices auditados

Índices necessários já encontrados:

- `posts_user_created_idx` em `posts(user_id, created_at desc)`
- `posts_created_at_id_idx` em `posts(created_at desc, id desc)`
- `post_media_post_id_position_key` em `post_media(post_id, position)`
- `idx_post_media_post` em `post_media(post_id, position)`
- `post_comments_post_idx` em `post_comments(post_id, created_at)`
- `post_likes_pkey` em `post_likes(post_id, user_id)`
- `post_comment_likes_pkey` em `post_comment_likes(comment_id, user_id)`
- `post_participants_post_id_tagged_user_id_key`
- `post_participants_post_status_idx`
- `post_participants_tagged_status_idx`

Conclusão: não criar índices duplicados nesta sprint.

## Proposta SQL/RPC sem aplicar

Não foi criada migration para alterar `get_profile_posts`, porque o cliente já passou a limitar `15/30` e qualquer `CREATE OR REPLACE FUNCTION` grande pode quebrar contrato se aplicado com pressa.

Proposta para próxima etapa, após medir o impacto do frontend:

1. Alterar clamp do banco para:

```sql
least(greatest(coalesce(p_limit, 15), 1), 30)
```

2. Considerar cursor composto em versão nova da RPC:

```sql
p_cursor_created_at timestamptz,
p_cursor_id uuid
```

3. Separar payload:

- `get_profile_posts_light`: lista leve para grid/perfil;
- detalhes de treino/rota/comentários/likes completos sob demanda.

4. Evitar `private.can_view_profile_posts(p.user_id)` por linha quando possível, pré-calculando a permissão do perfil alvo e simplificando a condição para posts do próprio `p_user_id`.

## Realtime auditado

Canal principal:

- `apps/web/src/components/gym-circle/social/useSupabaseSocial.ts`
- canal: `supabase-social`
- possui cleanup com `services.client.removeChannel(channel)`.

Tabelas inscritas globalmente hoje:

- `posts`
- `stories`
- `story_likes`
- `story_mutes`
- `post_participants`
- `story_participants`
- `post_mutes`
- `post_likes`
- `post_comment_likes`
- `post_comments`
- `follows`
- `checkins`
- `activities`
- `user_stats`
- `direct_messages`
- `conversations`
- `conversation_participants`
- `notifications` filtrado por `user_id`

Achado: não há evidência de canal sem cleanup no app web atual. O alto `realtime.list_changes` é mais compatível com assinatura ampla por sessão do que com vazamento clássico.

Correção aplicada nesta sprint: nenhuma remoção de listener global para não quebrar feed/chat/stories. Recomendação próxima:

- separar canais por tela ativa;
- manter chat realtime só quando chat estiver aberto/hidratado, ou trocar parte do unread para polling leve;
- remover realtime global de `user_stats` se as ações próprias já fizerem refresh explícito;
- manter `notifications` filtrado por usuário.

## `user_stats_live`

Chamadas encontradas:

- boot/feed surfaces;
- `refreshProfilePosts`;
- busca de perfis/descoberta;
- serviços de posts/stats no core.

Nesta sprint, `refreshProfilePosts` passa a cachear também a consulta auxiliar de `user_stats_live` por perfil. O volume global ainda pode ser alto, mas a média é baixa; não foi priorizado antes da RPC principal.

## `post_comment_likes`

Índices confirmados:

- primary key `(comment_id, user_id)` cobre buscas por `comment_id` e `comment_id + user_id`;
- índice adicional por `user_id, created_at desc`.

Uso atual:

- detalhes/comentários de post;
- realtime atualiza detalhes do post aberto.

Não foi criado índice extra. Próxima melhoria se o pico persistir:

- carregar somente `count` e `liked_by_viewer` para listas grandes;
- likes completos só sob demanda.

## Segurança

Função auditada:

- `public.backfill_user_achievements_server_side()`

Achado:

- `SECURITY DEFINER = true`
- `authenticated_execute = true`

Migration local criada, não aplicada:

- `supabase/migrations/20260708140659_revoke_backfill_user_achievements_execute.sql`

Conteúdo:

```sql
revoke execute on function public.backfill_user_achievements_server_side()
from anon, authenticated;

grant execute on function public.backfill_user_achievements_server_side()
to service_role;
```

## Testes adicionados

Arquivo:

- `apps/web/src/components/gym-circle/social/profilePostsRequestCache.test.ts`

Cobre:

- dedupe de chamadas simultâneas;
- TTL;
- force refresh;
- invalidação por usuário;
- chave por usuário/cursor/limit.

## Próximos passos recomendados

1. Rodar 24–72h em produção e comparar `pg_stat_statements`.
2. Se `get_profile_posts` continuar alto, criar uma RPC leve ou alterar clamp no banco.
3. Dividir realtime por tela ativa, começando por chat/user_stats.
4. Rodar `EXPLAIN (ANALYZE, BUFFERS)` em staging/branch para uma chamada típica da RPC.
5. Aplicar a migration de segurança somente após aprovação.

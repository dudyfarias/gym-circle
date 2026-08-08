# Legendas por mídia no carrossel — design

**Data:** 2026-08-05
**Status:** rev. 4 (pós-review 3) — pronta para leitura do Eduardo

## Problema

Um post do Gym Circle tem uma legenda só (`posts.caption`), mesmo quando o
carrossel tem até 10 fotos ou vídeos. Quem publica um treino com várias fotos
não consegue comentar cada uma. O Instagram lançou legendas múltiplas em junho
de 2026 — seletor "Legenda única / Várias legendas" acima da caixa de texto, e
no modo múltiplo a pessoa escreve o texto de cada card. Vamos copiar isso.

## Escopo aprovado

| Decisão | Escolha |
|---|---|
| Relação entre as legendas | **Substitui** — no modo múltiplo não há legenda geral *editável* (ver "espelho") |
| Alcance desta entrega | **Web completo** (criar + editar + ler); **nativo só leitura** |
| Editar post existente | **Sim**, inclusive alternar de modo |
| Padrão do composer | **Tira de miniaturas** |
| Limite por legenda | **300 caracteres** |
| Proteção contra o app publicado | **Tabela separada** (opção A) |

Fora de escopo: composer nativo multi-legenda; mudar o limite de 10 mídias.

## Restrição dominante: o binário iOS já publicado

O app na App Store **não se corrige retroativamente**, e o que ele faz decide
quase todo este design:

- **Edita mídia escrevendo direto na tabela, não por RPC:**
  `client.from("post_media").delete()` seguido de
  `client.from("post_media").insert(rows)` —
  `PostComposerService.swift:323-345`; `publish` também insere direto
  (`:267-286`). **Quem usa `replace_social_post_media` é só o web**
  (`packages/core/src/services/posts.ts:130`).
- **São duas requisições HTTP = duas transações.** Existe um instante em que
  `post_media` está **vazia**. Nenhum trigger pode reagir a esse estado.
- **Só insere quando `items.count > 1`** (`:330`). Reduzir um carrossel a 1
  mídia é um **delete sem insert nenhum** — caso que morde o design (ver
  "estado degenerado").
- Chama `update_social_post` com **4 argumentos** (`:389`),
  `get_home_feed` (`GymCircleAPI.swift:32`), `get_profile_posts` (`:300`), e lê
  `post_media` com select enumerado (`:330`).
- URLs de mídia são públicas e estáveis, sem cache-buster
  (`getPublicURL`, `PostComposerService.swift:434-435`) — é o que sustenta a
  chave por URL.

Consequência central: **guardar a legenda dentro de `post_media` a condena** —
o `DELETE` cego a apaga e nenhuma RPC intercepta, porque não é chamada.

## Arquitetura

### Modelo de dados: tabela separada

```sql
create table if not exists public.post_media_caption (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  media_key text not null,          -- image_url normalizada (sem query string)
  caption text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_media_caption_key unique (post_id, media_key),
  constraint post_media_caption_length_check check (char_length(caption) <= 300)
);

alter table public.posts
  add column if not exists caption_mode text not null default 'single';
alter table public.posts
  add constraint posts_caption_mode_check
  check (caption_mode in ('single', 'per_media'));
```

`post_media` **não ganha coluna de legenda.** O `unique (post_id, media_key)`
cobre o índice da FK (`post_id` é a coluna líder).

**RLS, políticas e grants** (o projeto sempre os declara explicitamente;
omitir deixaria a tabela gravável por qualquer autenticado ou invisível para
os leitores):

- `enable row level security`;
- `select` espelhando a visibilidade do post
  (`private.can_view_profile_posts(p.user_id)`, padrão de `post_media`);
- `insert`, `update` e `delete` restritos ao dono do post;
- `grant select to anon` (senão o leitor deslogado perde as legendas);
- `grant select, insert, update, delete to authenticated`.

**Atenção:** `post_media` não tem política nem grant de `UPDATE`
(`20260609140000_post_media_carousel_and_workout_types.sql:29-58`). Copiar o
padrão dele quebraria o upsert por `media_key` — a tabela nova **precisa** de
`UPDATE` nos dois lugares.

**Realtime:** `alter publication supabase_realtime add table
public.post_media_caption`. Sem isso a assinatura do cliente não recebe evento
algum (precedente em `20260506193703_gym_circle_storage_realtime_grants.sql:56-62`).

**`updated_at`** precisa de trigger de touch — só `default now()` não
atualiza, e a purga por idade (abaixo) depende dele.

**`media_key` normalizada** (sem query string, ou só o path do storage). Hoje
as URLs de mídia não têm cache-buster, mas o projeto já anexa um em avatares
(`ProfilesService.swift:318`); normalizar custa uma linha e evita que a
correspondência quebre em silêncio no futuro.

**Chave por identidade, nunca por posição.** Casar por posição reconstruiria o
defeito pelo qual a alternativa JSONB foi descartada: se o app antigo
reordenar, a legenda cola na **foto errada**, publicamente. Legenda errada é
pior que legenda ausente.

Posts existentes: `caption_mode='single'` por default, sem backfill.

### O que pode e o que não pode ter trigger

- **Proibido em `delete` de `post_media`.** No instante do delete legado a
  tabela fica vazia; qualquer limpeza ou "forçar single" ali destruiria as
  legendas ou desligaria o modo de todo post editado pelo app antigo.
- **Permitido (e necessário) em `insert` de `post_media`.** É a última
  instrução da sequência legada e o momento em que já existem linhas — é onde
  o espelho é recalculado.

### Espelho `posts.caption`

Ao gravar em `per_media`, `posts.caption` recebe a **primeira legenda
não-vazia** na ordem das mídias, para que todo leitor que ignora `caption_mode`
(app publicado, superfícies de uma linha) mostre algo verdadeiro.

**Garantido por trigger, não por disciplina de RPC** — `postService.update()`
(`posts.ts:142-154`) escreve `posts.caption` direto na tabela e a RLS permite
isso de qualquer cliente.

`private.sync_post_caption_mirror(p_post_id)` é chamada por triggers em:

- `post_media_caption` (insert/update/delete) — a legenda mudou;
- `post_media` **insert** — a ordem mudou (reordenar sem mexer em legenda
  dessincronizaria o espelho: ele continuaria apontando para quem era a
  primeira);
- `posts` (update de `caption` ou `caption_mode`).

Dois guardas obrigatórios:

1. **Anti-recursão.** A função escreve em `posts.caption`, o que redispara o
   trigger de `posts` → `stack depth limit exceeded` na primeira edição. Usar
   `when (pg_trigger_depth() = 0)` na definição do trigger **e** escrever com
   `where caption is distinct from <novo>`.
2. **Mídia vazia não recalcula.** Se não houver linhas em `post_media` naquele
   instante (janela do app legado), a função não toca no espelho.

Consequência declarada: uma edição de legenda feita pelo app publicado (que
manda `p_caption` num post `per_media`) é **sobrescrita pelo espelho**. O
espelho é sempre derivado, nunca autoral. Recusar a chamada daria erro
insolúvel no app da loja.

### Estado degenerate: `per_media` com menos de 2 mídias

A regra "menos de 2 mídias → `single`" roda no servidor **avaliada apenas no
insert**. Mas o caminho legado que reduz um carrossel a 1 mídia é um **delete
sem insert nenhum** (`items.count > 1`), então a regra **não dispara** e o post
fica `per_media` com zero linhas em `post_media`. Sem tratamento, a leitura
entraria no ramo `per_media`, não acharia legenda e devolveria `""` — o post
ficaria **mudo para sempre**, mesmo com `posts.caption` preenchido. Não é caso
exótico: é uma edição normal no app da loja.

Correção no único ponto que enxerga o estado degenerado, a função pura:
`per_media` **com menos de 2 itens de mídia → devolve `post.caption`**
(preservando `""` para card sem legenda em carrossel de verdade, que é o
comportamento desejado). O `caption_mode` é reparado no próximo write do web.

### RPCs

`p_media` é `jsonb`, então a legenda entra como chave de cada item **sem mudar
assinatura** em `create_social_post_with_media` e `replace_social_post_media`.

**Contrato da legenda:** `null` ou `""` significa **remover a linha** daquele
`media_key` — não upsert. Além de evitar estourar o `not null`, é o que faz
"primeira legenda não-vazia" funcionar sem filtrar vazio. (`mediaRpcRows`
emite `caption: media.caption?.trim() || null`.)

**Ordem obrigatória dentro de `replace_social_post_media`:** (1) mídias
primeiro; (2) legendas depois; (3) limpeza de órfãs do conjunto final; (4)
recálculo do espelho por último. Se as legendas fossem antes das mídias, o
trigger encontraria `post_media` vazia e — pela regra do guarda — deixaria o
espelho velho.

**Sobrecarga sem `DROP`.** Parâmetro **obrigatório** cria sobrecarga (resolvida
por aridade; o PostgREST resolve pelo conjunto de nomes de chaves do corpo
JSON). `DEFAULT` causaria ambiguidade. As antigas continuam vivas para o
binário publicado:

- `update_social_post(p_post_id, p_caption, p_workout_types, p_gym_id, p_caption_mode)`
- `update_social_post_full(p_post_id, p_caption, p_workout_types, p_gym_id, p_media, p_caption_mode)`

**Armadilha:** `posts.ts:165-172` monta `p_caption: input.caption ?? undefined`
(idem `p_gym_id`, `p_media`) e `JSON.stringify` **remove chaves `undefined`** —
o corpo encolhido cairia na assinatura antiga ou em `PGRST202`. O cliente web
passa a enviar **`null` explícito**, com teste de contrato do corpo mínimo.

DDL no Postgres é transacional (não há "janela sem função"). Os riscos reais
são cliente antigo depois do commit e o **schema cache do PostgREST** —
recarregar e verificar é passo explícito da migration.

Se alguma função precisar ser recriada (as `returns table` abaixo), reaplicar
`security definer`, `set search_path = ''`, `revoke all ... from public, anon`
e `grant execute ... to authenticated` no par `private`/`public`.

### Órfãs e ressurreição

Legenda cuja `media_key` não corresponde a nenhuma mídia atual fica **dormente**
(invisível, inofensiva) e é removida no próximo write do web, que conhece o
conjunto final. Limpeza **nunca** é disparada por delete de `post_media`.

**Semântica declarada:** se a **mesma** mídia voltar ao post (o `EditMediaItem`
legado reusa a `imageURL` existente, então é o caminho comum de reedição), a
legenda antiga **ressuscita**. Isso é desejável — é "preservar" — mas precisa
estar escrito. Para limitar a janela, o job existente (`media_cleanup_runs`)
purga órfãs com `updated_at` acima de N dias.

### Propagação até o cliente

- `caption_mode` em: view `public.feed_posts`, `get_home_feed`,
  `get_suggested_feed_posts`, `get_profile_posts` (colunas enumeradas; alterar
  `returns table` exige `drop`+`create` → reaplicar grants), e nos `.select()`
  de `useSupabaseSocial.ts:1489-1511` e `supabaseSocialSurfaces.ts:160-183`.
- **Legendas em lote, nunca N+1.** O par existente `mediaForPosts(postIds)` usa
  `.in("post_id", ids)` justamente por isso (`posts.ts:110-121`). A busca de
  `post_media_caption` segue o mesmo padrão, na mesma rodada, e o mapper casa
  por URL em memória. O web lê `post_media` com `select("*")`, então não precisa
  mexer nesse select.
- Nativo: `GymCircleAPI.swift:330` enumera colunas de `post_media` e precisa da
  consulta nova à tabela de legendas.
- Adicionar coluna às RPCs de leitura é seguro para o binário publicado: Swift
  `Codable` ignora chaves desconhecidas.

### Código compartilhado

- `CreatePostInput` ganha `captionMode`; o objeto `p_post` (`posts.ts:64-93`)
  ganha a chave. `updateSocialDetails` (`posts.ts:156-173`) recebe e repassa
  `p_caption_mode`.
- `PostMediaInput` ganha `caption?: string | null`; `mediaRpcRows` emite
  `caption` mantendo `slice(0, 10)`.
- Regenerar `packages/core/src/database.types.ts` (typegen).
- Mapper `mediaByPost` (`supabaseSocialSelectors.ts:356-400`) monta item a item
  e descarta o desconhecido → carregar a legenda casada por URL.
- `GymPost.media[]` ganha `caption`.
- Patch otimista (`supabaseSocialActions.ts:1116-1130`) escreve
  `caption: input.caption` na linha local → respeitar o modo.

Função pura:

```ts
resolvePostCaption(post, activeIndex): string
```

Retorna `string` (nunca `null`), para casar com `GymPost.caption: string` e não
quebrar `SocialPostCard.tsx:177-181`. `single` → `post.caption`; `per_media`
**com 2+ mídias** → legenda da mídia ativa (`""` se vazia); `per_media` com
menos de 2 mídias (estado degenerado) → `post.caption`; índice inválido ou post
legado sem array → `post.caption`.

### Reordenar mídias (escopo somado em 06/08)

A pessoa pode reordenar as mídias do carrossel arrastando as miniaturas, com
setas ‹ › como alternativa acessível (arrastar sozinho exclui leitor de tela e
dificuldade motora).

**Não exige mudança de banco.** Os composers já guardam `mediaItems` como
array e a RPC grava `position` pela ordem do array
(`entry.ordinality - 1`); só faltava a interface para mover.

Interação com as legendas: elas **seguem a mídia**, porque são chaveadas por
URL normalizada e não por posição — foi exatamente por isso que a alternativa
por posição foi descartada. Reordenar dispara o recálculo do espelho, já que
`replace_social_post_media` apaga e reinsere `post_media` (e o trigger de
espelho escuta o insert).

Consequência declarada e **não sinalizada na UI** (decisão do produto): a
primeira mídia é a capa do post (`posts.image_url`), então reordenar troca a
miniatura no feed, na grade do perfil e no compartilhamento.

### Composer

Seletor só com 2+ mídias. Modo único intocado. Modo múltiplo: tira de
miniaturas, contador `"2 de 4 · 42/300"`, marcador nas que têm texto.

- **Editar só legendas precisa salvar:** hoje `EditPostSheet.tsx:464` manda
  `media` apenas se `mediaChanged` — alterar legenda passa a sujar o payload.
- **Carregar legendas existentes** ao abrir a edição.
- **Remover a mídia selecionada** → seleção vai para a anterior (ou 0).
- **Cair para 1 mídia** → avisa que a legenda daquela mídia sai da leitura.

### Leitura (web)

`MediaCarousel` ganha `onActiveIndexChange?` opcional; continua dono do índice.
A notificação sai de um `useEffect` sobre `active`, declarado **antes dos early
returns** (`MediaCarousel.tsx:54-71` retorna cedo com 0 ou 1 mídia — hook
depois disso violaria as regras dos hooks).

- **Altura estável:** altura mínima de 2 linhas; truncamento por **caracteres**
  (o projeto evita medir DOM por causa da WebView iOS) com limiar de **120
  caracteres** para legenda por mídia (o global é 140 em `social/caption.ts`).
- **"Ver mais" reseta ao trocar de card.**
- **Key do slide:** hoje `item.imageUrl` (`MediaCarousel.tsx:88`) — com mídia
  repetida as keys colidem → usar posição/índice. (A chave por URL tem a mesma
  limitação: mídia repetida no mesmo post compartilha legenda. Aceito.)
- **`CommentsBottomSheet.tsx:556-561`** renderiza a legenda **inteira** no topo
  — num post `per_media` mostrará a espelhada (a da 1ª mídia), fixa. Escolha
  declarada, não efeito colateral.
- Demais superfícies via espelho: grade do perfil, notificações,
  compartilhamento, `PostDetailOverlay` (definir se abre no índice ativo ou 0),
  `RecapCoverPickerSheet.tsx:206` (`alt`).
- **Acessibilidade:** legenda em região `aria-live="polite"` incluindo posição
  ("2 de 4"); miniaturas do composer como `<button>` com nome acessível e
  `aria-current`; o carrossel hoje não tem role/label/teclado
  (`MediaCarousel.tsx:79-120`).
- **Realtime:** incluir `post_media_caption` no canal
  (`useSupabaseSocial.ts:1887-1904`) **e** na publicação (DDL acima).

### Nativo (só leitura)

`FeedPost.swift` ganha `captionMode` + legendas; `GymCircleAPI` busca a tabela
nova; o carrossel do `FeedView` troca a legenda pelo card ativo. O composer
nativo segue criando em `single`. A edição nativa
(`FeedView.swift:1445` → `GymCircleAppModel.swift:1089`) fica protegida pela
tabela separada, sem código novo no app.

## Testes

**Puros** — `resolvePostCaption`: single; per_media com texto; card vazio;
**per_media com menos de 2 mídias (estado degenerado) → `post.caption`**;
índice inválido; post legado sem array. `mediaRpcRows`: legenda, trim,
`slice(0,10)`.

**Banco / caminhos legados (o que quebra produção)**
- `delete` + `insert` direto em `post_media` não apaga legendas; elas voltam
  casadas por URL;
- reordenar pelo cliente legado **não** troca legenda de foto **e atualiza o
  espelho**;
- `delete` sem insert (redução a 1 mídia) não deixa o post mudo;
- espelho não recalcula com `post_media` vazia;
- trigger de espelho não recursa (edição de legenda conclui);
- `caption` `null`/`""` remove a linha em vez de estourar `not null`;
- `update_social_post` de 4 args sobre post `per_media` tem a legenda
  sobrescrita pelo espelho;
- corpo mínimo da RPC resolve a sobrecarga certa (`null` explícito);
- `caption_mode` sai pela view e pelas 3 RPCs de leitura;
- RLS: outro usuário não escreve legenda em post alheio; `anon` lê legenda de
  post público;
- busca de legendas é em lote (sem N+1 no feed).

**Composer** — toggle só com 2+; editar só legendas persiste; queda para 1
mídia avisa; remover a selecionada move a seleção.

**Leitura** — legenda troca com o índice; "ver mais" reseta; altura estável.

Suíte existente segue verde.

## Riscos

| Risco | Mitigação |
|---|---|
| App publicado apaga legendas | Tabela separada — o `DELETE` cego não a alcança |
| Trigger reagir à janela de 2 transações | Nada em `delete` de `post_media`; espelho não recalcula com mídia vazia |
| Post mudo após redução a 1 mídia | Fallback do estado degenerado na função pura |
| Recursão do trigger de espelho | `pg_trigger_depth() = 0` + `is distinct from` |
| Espelho velho após reordenação | Recálculo também no `insert` de `post_media` |
| Legenda na foto errada | Casamento por URL normalizada, nunca por posição |
| Tabela nova exposta ou invisível | RLS + políticas + grants explícitos (com `UPDATE`) |
| Realtime silencioso | Tabela adicionada à publicação `supabase_realtime` |
| Sobrecarga não resolver | `null` explícito + teste de contrato |
| Espelho furado por escrita direta | Garantido por trigger |
| N+1 no feed | Busca em lote com `.in("post_id", ids)` |
| Legenda ressuscitando | Semântica declarada + purga por idade no job existente |
| `DROP`+`CREATE` das RPCs de leitura perde grants | Reaplicar definer/search_path/revoke/grant |
| Schema cache do PostgREST | Recarga + verificação como passo da migration |
| Divergência migrations locais × produção | Aplicar via MCP `apply_migration`, nunca `db push`; gated no ok do Eduardo |

Concorrência: `for update` em `posts` serializa, mas legendas seguem
*last-write-wins* — aceito.

## Alternativas descartadas

- **Coluna `caption` em `post_media`**: o `DELETE` cego do app publicado a
  apaga, e a RPC não intercepta porque o app não a chama.
- **Array JSONB em `posts`**: amarra a legenda à posição.
- **Preservação dentro da RPC**: inerte — o cliente legado não passa por ela.
- **Bloquear escrita direta em `post_media`**: erro insolúvel no app da loja.
- **`DROP` + recriar as RPCs de update**: quebraria o app publicado e perderia
  grants, sem necessidade técnica.
- **Composer em lista vertical / passo dedicado**: rolagem longa; passo extra.

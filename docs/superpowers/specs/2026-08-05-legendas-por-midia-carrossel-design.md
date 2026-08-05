# Legendas por mídia no carrossel — design

**Data:** 2026-08-05
**Status:** revisado (rev. 2, pós-review) — aguardando plano de implementação

## Problema

Um post do Gym Circle tem uma legenda só (`posts.caption`), mesmo quando o
carrossel tem até 10 fotos ou vídeos. Quem publica um treino com várias fotos
não consegue comentar cada uma — "aquecimento", "PR no agachamento", "final
destruído" viram um texto único descolado das imagens.

O Instagram lançou legendas múltiplas em junho de 2026: um seletor
"Legenda única / Várias legendas" acima da caixa de texto; no modo múltiplo a
pessoa desliza card a card e escreve o texto de cada um. Vamos copiar essa
solução.

## Escopo aprovado

| Decisão | Escolha |
|---|---|
| Relação entre as legendas | **Substitui** — no modo múltiplo o post não tem legenda geral |
| Alcance desta entrega | **Web completo** (criar + editar + ler); **nativo só leitura** |
| Editar post existente | **Sim** — inclusive alternar entre os modos depois de publicado |
| Padrão do composer | **Tira de miniaturas** (fiel ao Instagram) |
| Limite por legenda | **300 caracteres** |

Fora de escopo: composer nativo com legendas múltiplas; mudar o limite de 10 mídias.

## Restrição dominante: o binário nativo já publicado

O app iOS na App Store **não se corrige retroativamente**. Ele já chama:

- `rpc("update_social_post")` com 4 argumentos — `PostComposerService.swift:389`
- `rpc("get_home_feed")` — `GymCircleAPI.swift:32`
- `rpc("get_profile_posts")` — `GymCircleAPI.swift:300`
- `setMedia` → `replace_social_post_media` com `EditMediaItem`, struct que
  **não tem campo de legenda** (`PostComposerService.swift:292-308`)

Isso governa três decisões desta spec: (1) nenhuma assinatura de RPC existente
pode ser removida; (2) o servidor precisa proteger as legendas de clientes que
não as conhecem; (3) o que for gravado em `posts.caption` **é visível** para
esses clientes.

## Estado atual (verificado no código)

- `posts.caption text` nullable; `GymPost.caption` é `string` **não-nullable**
  em `social/types.ts:168,207`, e `SocialPostCard.tsx:177-181` chama
  `post.caption.length` sem guarda.
- `post_media` — sem coluna de legenda.
- `private.replace_social_post_media` faz **`delete from public.post_media` e
  reinsere** a partir de `p_media`, e **só insere quando `media_count > 1`**
  (`20260703192608_resilient_media_pipeline.sql:57-99`). Portanto post de 1
  mídia não tem linha em `post_media`.
- `EditPostSheet.tsx:464` envia `media: mediaChanged ? mediaItems : undefined`.
- Leitura web **não lê `posts` direto**: passa pela view `public.feed_posts`
  (colunas enumeradas, `20260514113227_streak_restore.sql:746`) e pelas RPCs
  `get_home_feed`, `get_suggested_feed_posts`, `get_profile_posts` — todas
  `returns table(...)` com colunas enumeradas.
- `.select()` explícitos em `useSupabaseSocial.ts:1489-1511` e
  `supabaseSocialSurfaces.ts:160-183`.
- Truncamento de legenda é **por contagem de caracteres**
  (`social/caption.ts`, `CAPTION_TRUNCATE_THRESHOLD = 140`), decisão
  documentada por causa da fragilidade de medir DOM em WebView iOS.
- Canal realtime (`useSupabaseSocial.ts:1887-1904`) assina `posts`,
  `post_comments`, `post_likes` — **não** `post_media`.
- Grants são explícitos por função (`revoke all` + `grant execute`), ex.:
  `20260703192608_resilient_media_pipeline.sql:400-415`.

## Arquitetura

### Modelo de dados

```sql
alter table public.post_media add column if not exists caption text;

alter table public.post_media
  add constraint post_media_caption_length_check
  check (caption is null or char_length(caption) <= 300);

alter table public.posts
  add column if not exists caption_mode text not null default 'single';

alter table public.posts
  add constraint posts_caption_mode_check
  check (caption_mode in ('single', 'per_media'));
```

Posts existentes caem em `'single'` pelo default — sem backfill.

**`caption_mode` explícito** em vez de deduzir de "alguma mídia tem legenda":
deduzir é frágil (legendas residuais renderizariam errado) e não distingue
"modo único" de "modo múltiplo com todos os cards vazios".

### `posts.caption` no modo `per_media`: espelho da primeira legenda

**Revisão importante em relação à rev. 1.** A rev. 1 dizia "preserva
`posts.caption` guardado, só não exibido". Isso **vaza**: todo leitor que não
conhece `caption_mode` — incluindo o app nativo publicado — renderiza
`posts.caption`. A pessoa escreveria um rascunho, trocaria para "várias
legendas", publicaria achando que substituiu, e o rascunho apareceria
publicamente.

Decisão: ao gravar em modo `per_media`, a própria RPC define
`posts.caption` = **primeira legenda não-vazia por posição** (string vazia se
não houver nenhuma). Consequências:

- Nada de rascunho não relacionado vaza — o que aparece é conteúdo real do post.
- Clientes antigos e toda superfície de uma linha (grade do perfil,
  notificações, compartilhamento, topo do sheet de comentários) mostram algo
  verdadeiro **sem código novo**.
- Como é calculado **dentro da RPC**, nenhum cliente pode esquecer de manter
  em sincronia.

Custo aceito: é um campo denormalizado; a regra de recálculo vive nas RPCs de
escrita e em nenhum outro lugar. A conveniência de "alternar de modo preserva
o texto antigo" passa a valer **apenas dentro da sessão do composer** (estado
local), que é onde ela importa na prática.

### RPCs

`p_media` é `jsonb` em todas as RPCs de mídia, então a legenda entra como mais
uma chave de cada objeto — **sem mudança de assinatura** em:

- `create_social_post_with_media(p_post jsonb, p_media jsonb)` — lê `caption`
  de cada item e `caption_mode` de `p_post`.
- `replace_social_post_media(p_post_id uuid, p_media jsonb)` — lê `caption` de
  cada item.

**Preservação obrigatória no servidor.** Como `replace_social_post_media`
apaga e reinsere, e o nativo publicado envia itens **sem** a chave `caption`,
a função precisa distinguir:

- chave `caption` **ausente** (`not (item ? 'caption')`) → **preservar** a
  legenda existente daquela posição (snapshot antes do delete);
- chave presente com `null`/`""` → limpar de fato.

Sem isso, qualquer edição feita pelo app publicado apaga silenciosamente todas
as legendas do carrossel. A preservação é por **posição** e existe só como
compatibilidade com clientes legados; o cliente web sempre envia a chave.

**As duas RPCs de update precisam de `caption_mode` — via sobrecarga, sem
`DROP`.** Correção técnica em relação à rev. 1: adicionar um parâmetro
**obrigatório** cria uma *sobrecarga*, não uma ambiguidade — o Postgres
resolve por aridade e o PostgREST resolve pelo conjunto de nomes de chaves do
corpo JSON (4 chaves → função antiga; 5 → nova). Ambiguidade só surgiria se o
parâmetro novo tivesse `DEFAULT`, porque aí uma chamada de 4 args casaria com
os dois candidatos.

Portanto: **criar sobrecargas novas e manter as antigas vivas**:

- `update_social_post(p_post_id, p_caption, p_workout_types, p_gym_id, p_caption_mode)`
- `update_social_post_full(p_post_id, p_caption, p_workout_types, p_gym_id, p_media, p_caption_mode)`

As versões de 4 e 5 argumentos continuam existindo para o binário publicado, e
devem tratar o post como `single` — sem tocar em `caption_mode`. A remoção das
antigas só entra em pauta depois do cutover nativo (fora desta entrega).

Também é falso o que a rev. 1 dizia sobre "janela em que a função não existe":
DDL no Postgres é transacional. Os riscos reais são clientes antigos **depois**
do commit e a recarga do schema cache do PostgREST.

**Se alguma função precisar mesmo ser recriada** (caso das `returns table`
abaixo), a migration tem de reaplicar `security definer`, `set search_path =
''`, `revoke all ... from public, anon` e `grant execute ... to authenticated`
para o par `private`/`public` — `DROP FUNCTION` descarta grants e a função
nova nasce com `EXECUTE` para `PUBLIC`.

### Propagação de `caption_mode` e `caption` até o cliente

Não basta a migration de colunas. É preciso incluir os campos em:

- view `public.feed_posts` (colunas enumeradas);
- `get_home_feed`, `get_suggested_feed_posts`, `get_profile_posts` — alterar o
  `returns table` exige `drop` + `create` (não há `create or replace` mudando
  tipo de retorno) → **reaplicar grants** conforme acima;
- `.select()` explícitos de `useSupabaseSocial.ts` e `supabaseSocialSurfaces.ts`
  (incluir `caption` em `post_media` e `caption_mode` em `posts`).

Adicionar coluna a essas RPCs é seguro para o nativo publicado: Swift `Codable`
ignora chaves desconhecidas.

### Código compartilhado

- `PostMediaInput` (`domain/types.ts:164`) ganha `caption?: string | null`.
- `mediaRpcRows()` emite `caption: media.caption?.trim() || null` mantendo o
  `slice(0, 10)`.
- Regenerar `packages/core/src/database.types.ts` (typegen) — `PostMediaRow`
  deriva do tipo gerado; sem isso `caption`/`caption_mode` não compilam.
- Mapper `mediaByPost` (`supabaseSocialSelectors.ts:356-400`) monta cada item
  campo a campo e **descarta o que não conhece** → precisa carregar `caption`.
- `GymPost.media[]` (`social/types.ts`) ganha `caption`.
- Patch otimista em `supabaseSocialActions.ts:1116-1130` escreve
  `caption: input.caption` na linha local — num post `per_media` isso pisca a
  legenda espelhada até o refresh; deve respeitar o modo.

Função **pura** no domínio:

```ts
resolvePostCaption(post, activeIndex): string
```

Retorna `string` (nunca `null`) para casar com `GymPost.caption: string` e não
quebrar `SocialPostCard.tsx:177-181`. Regras: modo `single` → `post.caption`;
`per_media` → legenda da mídia no índice ativo (`""` se vazia); índice fora do
intervalo ou post legado sem array de mídia → `post.caption`.

### Composer (criar + editar)

Seletor "Legenda única / Várias legendas" **somente com 2+ mídias**.

- **Modo único:** comportamento atual, intocado.
- **Modo múltiplo:** tira de miniaturas; tocar seleciona qual legenda editar;
  contador `"2 de 4 · 42/300"`; marcador nas miniaturas com texto.

Regras de borda:

- **Editar só legendas precisa salvar.** `EditPostSheet.tsx:464` hoje envia
  `media` apenas quando `mediaChanged`. Alterar qualquer legenda deve marcar o
  payload de mídia como sujo, senão a edição some sem erro.
- **Carregar legendas existentes** para dentro de `mediaItems` ao abrir a
  edição, já que o payload é reenviado inteiro.
- **Remover a mídia selecionada** → seleção vai para a anterior (ou 0).
- **Cair para 1 mídia** → volta para `single`. Como post de 1 mídia não tem
  linha em `post_media`, **a legenda daquela mídia é descartada**; o composer
  deve avisar antes de aplicar.

### Leitura (web)

`MediaCarousel` ganha `onActiveIndexChange?: (index: number) => void` opcional
— continua dono do índice, só notifica. A notificação sai de um `useEffect`
sobre `active`, **não** de dentro do updater de `setActive`
(`MediaCarousel.tsx:73-78`), senão dispara setState de outro componente
durante a fase de render.

`SocialPostCard` guarda o índice ativo e usa `resolvePostCaption`.

- **Altura estável:** no modo `per_media` a área da legenda reserva altura
  mínima equivalente a 2 linhas, e o truncamento continua sendo o **por
  caracteres** já existente (`CAPTION_TRUNCATE_THRESHOLD`). Como 140
  caracteres rendem ~4 linhas no celular, esta entrega adota um limiar próprio
  menor para legenda por mídia, alinhado à altura reservada — sem medir DOM.
- **"Ver mais" reseta ao trocar de card.**
- **Key do slide:** hoje é `item.imageUrl` (`MediaCarousel.tsx:88`); com a
  mesma mídia repetida as keys colidem e a legenda gruda na duplicata → usar
  `position`/índice.

**Superfícies de uma linha** passam a funcionar via `posts.caption` espelhado
(sem derivação no cliente). Verificar nominalmente: topo do
`CommentsBottomSheet.tsx:556-561`, `PostDetailOverlay.tsx` (definir se abre no
índice ativo do feed ou em 0), grade do perfil, notificações, compartilhamento,
`RecapCoverPickerSheet.tsx:206` (`alt`).

**Acessibilidade:** a legenda muda ao deslizar sem anúncio, e o carrossel hoje
não tem role/label/teclado (`overflow-x-auto` + dots decorativos,
`MediaCarousel.tsx:79-120`). Mínimo: região da legenda com `aria-live="polite"`
incluindo a posição ("2 de 4"); associação entre slide ativo e legenda;
miniaturas do composer como `<button>` com nome acessível ("mídia 2 de 4, com
legenda") e `aria-current`.

**Realtime:** o canal não assina `post_media`. Hoje funciona por acidente
(toda escrita também dá `update` em `posts`). Registrar essa dependência ou
incluir `post_media` no canal — do contrário uma futura otimização de "salvar
só legendas" mata o refresh entre dispositivos.

### Nativo (somente leitura)

- `FeedPost.swift` ganha `captionMode` e legenda por mídia; `GymCircleAPI`
  passa a trazer as colunas novas.
- Carrossel do `FeedView` troca a legenda conforme o card ativo.
- Composer nativo continua criando em `single` (default da coluna).
- A edição nativa existe (`FeedView.swift:1445` → `GymCircleAppModel.swift:1089`)
  e está protegida pela preservação server-side descrita acima — não por
  código novo no app.

## Testes

**Puros (`packages/core`)** — `resolvePostCaption`: modo único; múltiplo com
texto; card vazio; índice fora do intervalo; post legado sem array de mídia.
`mediaRpcRows`: carrega legenda, respeita `slice(0,10)`, trima.

**Banco (o que quebra produção)**
- payload de mídia **sem** a chave `caption` **não** apaga legendas existentes
  (caso do nativo publicado);
- payload com `caption: null` limpa de fato;
- `posts.caption` recebe a primeira legenda não-vazia ao gravar em `per_media`;
- sobrecargas de 4/5 e 5/6 args coexistem e a de aridade menor trata como
  `single`;
- `caption_mode` e `caption` saem pela view e pelas 3 RPCs de leitura.

**Composer** — toggle só com 2+ mídias; editar só legendas persiste (caso do
`mediaChanged`); queda para 1 mídia reverte para `single` com aviso; remover a
mídia selecionada move a seleção.

**Leitura** — legenda troca com o índice; "ver mais" reseta; altura não muda
entre cards; duplicata de mídia não compartilha legenda.

Suíte existente segue verde.

## Riscos

| Risco | Mitigação |
|---|---|
| Nativo publicado apaga legendas ao editar | Preservação server-side por posição quando a chave `caption` vem ausente |
| Nativo publicado quebra por assinatura removida | Nenhum `DROP` das RPCs de update; sobrecargas novas convivem com as antigas |
| `DROP`+`CREATE` das RPCs de leitura perde grants | Reaplicar `security definer`, `search_path`, `revoke`/`grant` no par private/public |
| Rascunho vazando para clientes antigos | `posts.caption` recebe a 1ª legenda real, calculada na RPC |
| Feed tremendo ao deslizar | Altura reservada + limiar de truncamento por caracteres |
| Legenda somindo ao editar só texto | Alteração de legenda marca o payload de mídia como sujo |
| Divergência migrations locais × produção | Aplicar via MCP `apply_migration`, nunca `db push`; gated no ok do Eduardo |

Concorrência (dois dispositivos editando o mesmo post) é serializada pelo
`for update` em `posts`, mas as legendas continuam *last-write-wins* — aceito.

## Alternativas descartadas

- **Array JSONB em `posts`**: amarra a legenda à posição no cliente; a edição
  reordena/remove/adiciona mídia.
- **Tabela `post_media_caption`**: 1:1 com `post_media` — join e RLS extras,
  nenhum ganho.
- **`DROP` + recriar as RPCs de update**: quebraria o app publicado e perderia
  grants, sem necessidade técnica (sobrecarga resolve).
- **Composer em lista vertical / passo dedicado**: rolagem longa com 10 mídias;
  passo extra no fluxo de publicar.

# Gym Circle Native Feel Sprint 3

## Objetivo

Remodelar feed e comentários para uma experiência mais minimalista, social e
iOS-like, inspirada na UX do Instagram. Mantém identidade Gym Circle (dark
mode, ciano de destaque, foco social fitness) sem copiar assets, marca ou
ícones proprietários.

Esta sprint NÃO inclui módulos nativos pesados (Apple Maps, push real,
HealthKit). Esses ficam para sprints futuras conforme `native-feel-roadmap.md`.

## Decisão de autenticação

Inalterada: Apple/Google Login permanecem ocultos da UI. Fluxo ativo continua
sendo email/senha.

## Referências visuais

- Instagram feed dark mode (apenas UX; nenhum asset copiado)
- Instagram comments bottom sheet
- Padrões "minimalist social feed" (Threads, Mastodon dark, etc.)
- iOS bottom sheet behavior (sheet drag, safe area, keyboard avoid)

## Escopo

### Feed

- Post header minimalista (avatar + username + streak badge + local + "...")
- Mídia com bordas mínimas, sem fundo preto durante load (ProgressiveMedia ok)
- Indicador de carrossel preparado (visual only; sem feature nova)
- Actions row clean (coração / comentar / compartilhar + bookmark opcional)
- Likes summary com plural correto ("1 curtida" vs "2 curtidas" vs "curtido por X e outras pessoas")
- Caption inline com username em bold + botão "mais" pra expandir
- Comments preview: "Ver todos os X comentários" / "Ver comentário" / vazio
- Timestamp curto e cinza

### Comments

- CommentsBottomSheet (novo componente)
- Topo: handle central + título "Comentários"
- Lista: avatar + username + tempo + texto + responder + like + replies agrupadas
- Estado vazio: "Ainda não há nenhum comentário / Inicie a conversa."
- Input fixo no rodapé com placeholder "Adicione um comentário..."
- Barra de reactions rápidas (❤️ 🙌 🔥 👏 🥲 😍 😮 😂)
- Replies agrupadas com "Ver mais X respostas" se backend suportar
- Comment likes com update otimista
- Carregamento de comentários só ao abrir (via `refreshPostDetails`)
- Safe area + keyboard handling iOS natural

### Sugestões de amizade

- Renomear seção "Pessoas perto de você" → "Sugestões de amizade"
- Remover subtítulo "mesmas academias" (sem substituir por outro)
- Refactor visual do `DiscoveryUserCard`:
  - Avatar maior em destaque
  - Username + streak badge discreto
  - Texto social contextual ("Treina perto de você", "Segue amigos em comum", etc.)
  - **REMOVER** "1 academia em comum" / "mesmas academias"
  - Chip discreto de streak/consistência
- Botão "Adicionar" iOS-like (pill minimalista) com haptic + update otimista
- Estados: adicionar / enviado / seguindo

### Microinterações + haptics

- Like post: `light` ou `selection`
- Abrir CommentsSheet: `light`
- Enviar comentário: `success`
- Curtir comentário: `light`
- Tocar em emoji da reaction row: `selection`
- Erro: `warning` / `error`

### Performance

- Feed não carrega comentários completos inicialmente (já é assim desde Sprint A)
- Comentários carregam apenas ao abrir CommentsSheet via `refreshPostDetails(postId)`
- Update otimista no comentário novo (sem refresh global)
- ProgressiveMedia preservado
- Sem regressão nas Sprints A-D

## Fora do escopo

- Apple Maps real (Sprint 4+)
- HealthKit (Sprint 4+)
- Login Apple/Google (decisão de produto futura)
- Redesign completo do app (só feed + comments + sugestões nesta sprint)
- Reescrita nativa
- Mudança de regras sociais (RLS, blocks, follows, etc.)
- Alteração destrutiva de banco
- Carrossel real de múltiplas mídias (preparar componente, não implementar feature)

## Checklist

| Item | Planejado | Implementado | Validado | Pendente |
| --- | --- | --- | --- | --- |
| Bug plural curtidas no feed | Sim | Sim (3.1) | Sim | — |
| `formatLikesSummary` helper testável | Sim | Sim (já existia: `getPostLikeSummary`) | Sim | — |
| Post header minimalista | Sim | Sim (3.2 — já estava limpo) | Sim | — |
| Actions row clean | Sim | Sim (3.2) | Sim | — |
| Caption inline com "mais" | Sim | Sim (3.2) | Sim | — |
| Comments preview "Ver todos os X" | Sim | Sim (3.2) | Sim | — |
| Timestamp curto cinza | Sim | Sim (3.2) | Sim | — |
| Remover "Mesma academia" do smartReason | Sim | Sim (3.2) | Sim | — |
| CommentsBottomSheet (novo) | Sim | Sim (3.3) | Sim | — |
| Estado vazio CommentsSheet | Sim | Sim (3.3) | Sim | — |
| Input fixo no rodapé do sheet | Sim | Sim (3.3) | Sim | — |
| Keyboard handling no sheet | Sim | Sim (3.3 — Capacitor + visualViewport) | Sim | — |
| Reactions row rápidas | Sim | Sim (3.3 — 8 emojis enviados como comentário) | Sim | — |
| Replies agrupadas (se backend suportar) | Sim | — | — | Backend não suporta (sem `parentCommentId`) — pendência futura |
| Comment likes update otimista | Sim | Sim (já existia) | Sim | — |
| Header "Sugestões de amizade" | Sim | Sim (3.1) | Sim | — |
| Remover "academia" do DiscoveryUserCard | Sim | Sim (3.1) | Sim | — |
| DiscoveryUserCard refactor visual | Sim | Sim (3.1) | Sim | — |
| Botão "Adicionar" iOS-like | Sim | Sim (já estava — pill com haptic indireto via toggleFollow) | Sim | — |
| Microinterações + haptics | Sim | Parcial (like + comentar — Fase 3.2) | Sim | Fase 3.4 (restantes) |
| Safe area / Dynamic Island / keyboard | Sim | — | — | Fase 3.3 |
| Acessibilidade (aria-labels, tap >=44px) | Sim | Parcial (3.2 — aria nos novos botões) | Sim | Fase 3.4 (auditoria final) |
| Testes vitest | Sim | Parcial (3.2 — `caption.test.ts` 8 testes) | Sim | Fase 3.4 |
| Teste manual no iPhone | Sim | — | — | Fase 3.4 |

## Implementação planejada

Esta sprint é dividida em fases dentro da Sprint 3 — cada fase pode ser um
commit separado pra reduzir blast radius.

### Fase 3.1 — Quick wins (esta sessão)

1. **Plural correto no feed** — `formatLikesSummary(post, knownUsers)` puro em
   `packages/core/src/domain/likes.ts` (ou helper local). Substitui o texto
   atual em `SocialPostCard.tsx` (linha ~558). Testes unitários por caso:
   `0 → null`, `1 → "1 curtida"`, `>=2 sem known → "X curtidas"`, `>=2 com
   known → "Curtido por <nome> e outras N pessoas"`.
2. **DiscoveryUserCard refactor visual + remover "academia"** — atualizar
   `DiscoveryUserCard.tsx`, atualizar o consumer em `FeedScreen.tsx` (header
   "Sugestões de amizade", remover subtítulo "mesmas academias"), substituir
   `getSharedGymCount(...)` por nova lógica de texto contextual baseada em
   sinais que JÁ existem (`followStatus`, `currentStreak`, distância via
   `viewerLocation` se disponível, etc).

### Fase 3.2 — Feed visual refactor (próxima sessão)

3. Post header redesenhado (avatar + username + streak + local + "...")
4. Actions row clean (icons minimalistas, tap >= 44px, haptic light no like)
5. Caption inline `username + texto` com botão "mais" se > N linhas
6. Comments preview clicável → abre CommentsBottomSheet
7. Timestamp curto cinza

### Fase 3.3 — CommentsBottomSheet (próxima sessão)

8. Componente `CommentsBottomSheet.tsx` novo
9. Lista de comentários com avatar/username/tempo/texto/responder/like
10. Estado vazio
11. Input fixo no rodapé com auto-focus opcional
12. Reactions row
13. Keyboard handling (`@capacitor/keyboard` listener via `keyboardDetection.ts`)
14. Replies agrupadas se backend já suporta
15. Atualizar `PostDetailSheet` ou substituir por `CommentsBottomSheet`
16. Integrar com `refreshPostDetails(postId)` da social bundle

### Fase 3.4 — Polish e validação (próxima sessão)

17. Microinterações + haptics em todos os taps relevantes
18. Acessibilidade completa
19. Testes vitest
20. Teste manual no iPhone real
21. Documentar mudanças e pendências

## Componentes a criar/alterar

### Novos

- `apps/web/src/components/gym-circle/CommentsBottomSheet.tsx` (a criar na Fase 3.3)
- `packages/core/src/domain/likes.ts` (helper `formatLikesSummary`) ou local em `social/likes.ts`
- `apps/web/src/components/gym-circle/social/discoverySuggestion.ts` (helper de texto contextual pra `DiscoveryUserCard`)

### Alterados

- `apps/web/src/components/gym-circle/design-system/SocialPostCard.tsx` — refactor visual + bug plural + nova caption + comments preview
- `apps/web/src/components/gym-circle/design-system/DiscoveryUserCard.tsx` — refactor visual + remover academia
- `apps/web/src/components/gym-circle/screens/FeedScreen.tsx` — header "Sugestões de amizade"
- `apps/web/src/components/gym-circle/PostDetailSheet.tsx` — provavelmente substituído por `CommentsBottomSheet`
- `apps/web/src/components/gym-circle/social/haptics.ts` — adicionar novos tones se necessário
- `apps/web/src/components/gym-circle/GymCirclePreview.tsx` — wire-up do CommentsSheet

## Riscos e mitigações

- **Risco**: refactor visual do `SocialPostCard` pode quebrar layouts em diferentes
  tamanhos de tela. Mitigação: testar em iPhone SE 1 (375px), iPhone 17 Pro Max
  (430px), iPad Air (820px+).
- **Risco**: CommentsBottomSheet pode ter conflito de gesto com scroll do feed.
  Mitigação: usar mesmo padrão do `MonthlyRecapSheet` (já testado) ou
  `EditPostSheet`.
- **Risco**: keyboard avoid no iOS WebView é delicado. Mitigação: reusar
  `keyboardDetection.ts` (Sprint 1, comprovado em produção).
- **Risco**: refresh global ao comentar pode disparar via realtime. Mitigação:
  Sprint A já tornou `post_comments` realtime granular — confirmar que apenas
  o post afetado re-renderiza.
- **Risco**: remover academia do `DiscoveryUserCard` muda algoritmo de sugestão.
  Mitigação: backend NÃO muda (sugestões continuam via `get_user_suggestions`
  da Sprint C); apenas o TEXTO de motivação no card muda.

## Performance — princípios da sprint

Mantém todos os princípios das Sprints A–D + Native Sprint 1:

- Comentários carregam apenas ao abrir CommentsSheet, nunca no feed
- `refreshPostDetails(postId)` é a única forma de buscar comentários completos
- Cache curto (sessionStorage) opcional pra comentários abertos
- Sem refresh global ao comentar (otimista local)
- Realtime granular (já é desde Sprint A)
- ProgressiveMedia preservado em todas as imagens/vídeos

## Acessibilidade

- Botões com `aria-label` descritivo (ex: "Curtir post", "Abrir comentários")
- Contraste WCAG AA em todos os textos
- Input do CommentsSheet com `placeholder` claro + `aria-label`
- Foco vai pro input quando user toca "Comentar"
- Tap targets >= 44px (incluindo emoji da reactions row)
- Fechar sheet acessível por gesto + botão visível
- Reduce-motion: animações respeitam `prefers-reduced-motion`

## Validações esperadas

- `npm run lint` (apps/web): 0 warnings
- `npm run build` (apps/web): typecheck pleno
- `npm test -- --run`: todos os existentes + novos
- `npx cap sync ios`: passa
- `git diff --check`: limpo

## Teste manual iPhone real

Antes de marcar a sprint como completa:

### Feed
- abrir app frio
- scroll feed (header só some scrolling down, footer só scrolling up — Sprint 1 UI)
- curtir post → haptic light
- abrir likes overlay (toque no "Curtido por X")
- abrir comentários (CommentsBottomSheet)
- expandir legenda longa ("mais")
- vídeo/imagem load sem flash preto

### Comments
- abrir CommentsSheet em post sem comentários (estado vazio)
- abrir CommentsSheet em post com muitos comentários
- comentar texto
- enviar emoji da reaction row
- curtir comentário
- responder comentário (se backend suportar)
- fechar com swipe down
- abrir teclado → input acima
- fechar teclado → input retorna

### Sugestões
- header "Sugestões de amizade" sem subtítulo
- card sem "academia"
- texto contextual visível
- botão "Adicionar" → haptic + update otimista
- estados (adicionar / enviado / seguindo)

### Regressão
- feed (Sprints A–D + UI Sprint 1)
- stories
- chat
- perfil
- upload de mídia
- notificações
- login email/senha

## Pendências para sprints futuras

- Apple Maps real (Sprint 4)
- HealthKit (Sprint 4+)
- Carrossel real de múltiplas mídias por post (precisa migration + UI)
- Stories com replies/reactions ricas (paralelo do que vamos fazer pra comments)
- Composer de post nativo (Item D do Native Feel Sprint 2 do roadmap)

## Descobertas durante o planejamento

- **`smartReason: "Mesma academia"`** aparece no `SocialPostCard.tsx:602`
  como `"5 comentarios · mesma academia"` em CADA post do feed. Conflita
  com a filosofia da sprint mas é mais invasivo de remover (mexe em
  `useSupabaseSocial.ts:124`, `useGymCircleSocial.ts:83`, mocks + tests).
  Deixei pra **Fase 3.2** quando o post header inteiro for refatorado.
- **`getSharedGymCount`** continua sendo usado no algoritmo de ranking
  dos suggested users (`useGymCircleSocial.ts` + `useSupabaseSocial.ts`).
  Isso é CORRETO: quem treina na mesma academia continua sendo melhor
  candidato a sugerir, **apenas não mostramos isso visualmente**.
- `helper formatLikesSummary` adiado: por enquanto o fix do plural foi
  inline (1 linha). Quando a Fase 3.2 adicionar a variante
  `"Curtido por X e outras pessoas"`, vale extrair pra helper testável.

## Estado

Sprint 3 PLANEJADA em 2026-05-21. Fases 3.1, 3.2 e 3.3 entregues. Fase 3.4
(polish + validação manual) fica para próxima sessão.

### Fase 3.1 entregue (2026-05-21)

- Plural correto no feed (`1 curtida` vs `N curtidas` — inline em
  `SocialPostCard.tsx`).
- `DiscoveryUserCard.tsx` refeito: sem `sharedGymCount`, sem "academia em
  comum". Novo `getSuggestionContext(user)` deriva texto contextual de sinais
  reais (`followStatus`, `streakLitToday`, `currentStreak`, `longestStreak`,
  `workoutsThisMonth`, `sports`, `goal`).
- `FeedScreen.tsx`: header "Sugestões de amizade" sem subtítulo de academia,
  removida a função morta local `getSharedGymCount`.

Deploy: `dpl_HqV3AycEVvjmkaWtGbF1fnqowuyq` (commit `450ab2c`) → READY em
produção via auto-promote do Vercel.

### Fase 3.3 entregue (2026-05-22)

**Novo: `apps/web/src/components/gym-circle/CommentsBottomSheet.tsx`**

Sheet dedicado a comentários, substitui o antigo `PostDetailSheet.tsx`
(que reabria o post inteiro num overlay). Layout estilo Instagram, dark mode,
sem assets copiados.

- **Backdrop tap pra fechar** — botão a11y de fundo (`role="button"` implícito,
  `aria-label="Fechar comentários"`).
- **Handle bar visual** no topo (drag indicator). Gesto real de swipe-to-dismiss
  fica pra Sprint 4 quando o resto do app for retrabalhado com gestos.
- **Header** com título "Comentários" centralizado + botão X de fechar (44px).
- **Lista scrollável** com avatar/username/tempo/texto/like/delete. Reusa
  `SwipeRevealDelete` pra apagar próprios comentários (gesture iOS).
- **Estado vazio** quando `commentPreviews.length === 0`:
  "Ainda não há nenhum comentário / Inicie a conversa..."
- **Reactions row** sticky entre lista e input: `❤️ 🙌 🔥 👏 🥲 😍 😮 😂`.
  Tap → envia o emoji como comentário via `onCommentPost(postId, emoji)`.
  Haptic `selection` (tone "brand").
- **Input fixo** no rodapé com avatar do `currentUser` à esquerda, placeholder
  "Adicione um comentário...", botão send circular ciano (brand). Disabled se
  `draft.trim() === ""` ou submitting.
- **Mention autocomplete** `@username` migrado do `SocialPostCard`. Popover
  acima do input, mesma lógica de `getDraftMentionMatch`.
- **Keyboard handling híbrido**: `attachCapacitorKeyboardListeners` (Capacitor
  nativo iOS — vide `keyboardDetection.ts` pra contexto do bug do App Store
  Guideline 2.1) + `visualViewport` como fallback web/PWA.
  - Quando teclado aberto: `padding-bottom: 12px`.
  - Quando fechado: `padding-bottom: max(12px, env(safe-area-inset-bottom))`
    pra respeitar home bar do iPhone.
- **Reset on close** via `handleClose` local (não via `useEffect`) — evita o
  React `react-hooks/set-state-in-effect` que dispararia cascading re-renders.
- **`getCommentsCount` overflow indicator**: se `commentsCount > commentPreviews.length`,
  mostra "Mostrando N de M comentários" no rodapé da lista.

**Wire-up em `GymCirclePreview.tsx`:**

- Import dinâmico do `CommentsBottomSheet` substitui o `PostDetailSheet`.
- Renderizado no mesmo lugar (estado `postDetailId` reutilizado).
- Passa `currentUser` adicionalmente pro avatar do input.
- Props desnecessárias removidas (`onLikePost`, `onSharePostToChat`,
  `onOpenPostMenu`, `onToggleFollow`, `onOpenLikes`, `shareTargets`,
  `formatTime` continua).

**Refactor no `SocialPostCard.tsx`:**

- Removido toggle inline `commentsOpen` + bloco JSX de lista/input/reactions
  inline (~150 linhas).
- Removidas funções `submitComment`, `updateCaret`, `selectMention`.
- Removidos imports `EmptyState` e `SwipeRevealDelete` (não usados mais aqui —
  migraram pro sheet).
- Removido tipo `MentionMatch` + helper `getDraftMentionMatch` (idem).
- `handleToggleComments` virou `handleOpenComments` — chama apenas
  `onOpenComments?.(post.id)` (que abre o sheet via parent).
- Novo **preview inline do último comentário** acima do "Ver todos os N":
  `<username bold> <body>` clicável → abre sheet (estilo Instagram).
- "Ver todos os N comentários" perde a variante "Ocultar comentários" (não
  há toggle local mais).
- Props `onComment`, `onDeleteComment`, `onLikeComment`, `mentionUsers`
  permanecem no type pra retrocompat com `FeedScreen`/`GymCirclePreview`,
  mas não são consumidas. Cleanup do contrato pra Fase 3.4.

**Removido:**

- `apps/web/src/components/gym-circle/PostDetailSheet.tsx` — código morto
  após o swap pro `CommentsBottomSheet`.

**Validação:**

- `npm run lint` (apps/web): 0 warnings ✓
- `npm test` (vitest): 30 arquivos, **166/166 testes** passed ✓
- `npm run build` (apps/web): Turbopack 1.78s + TS 3.1s, 12 páginas ✓

**Fora de escopo (movido pra Fase 3.4 ou futura):**

- **Replies aninhados** — `GymComment` não tem `parentCommentId` no backend.
  Migration + UI ficam pra sprint dedicada (provavelmente quando carrossel
  de mídia também for mexer no schema de posts).
- **Swipe-to-dismiss real** do sheet — visual handle ok, gesto fica pra
  Sprint 4 quando o app ganhar swipe-back patterns iOS.
- **Animação de entrada do sheet** — atualmente usa `translate-y` simples
  com `transition-transform duration-300`. Spring-based fica pra polish.
- **Cleanup das props deprecadas** do `SocialPostCard` — Fase 3.4.

### Fase 3.2 entregue (2026-05-22)

**Refactor visual completo do `SocialPostCard.tsx`:**

- Likes summary unificado Instagram-style — usa `getPostLikeSummary`
  ("Curtido por @ana.fit e mais 2 pessoas") quando há dados de quem curtiu,
  com fallback de contador puro (`X curtidas`). Avatares empilhados (`-space-x-2`)
  pra preview. Clicável apenas pelo owner (UX existente — só dono vê sheet).
- Caption inline com botão "**mais**" — truncada em
  `CAPTION_TRUNCATE_THRESHOLD = 140` chars, cortando no último espaço pra não
  quebrar palavra/mention. State `captionExpanded` controla expansão.
- Comments preview clicável — substitui a linha
  `{commentsCount} comentarios · {smartReason}`. Plural correto:
  `Ver 1 comentário` / `Ver todos os N comentários` / `Ocultar comentários`.
- Haptic `light` no botão Heart e no botão MessageCircle via novos handlers
  `handleLike` e `handleToggleComments` (chamam `simulateHaptic("like")` e
  `simulateHaptic("comment")` respectivamente, antes do callback).
- Removida microinteração "Primeiro apoio ainda aberto" pra visitor sem likes
  (consistente com Instagram — só o coração no actions row sinaliza o estado).

**`smartReason` "Mesma academia" removido dos dois hooks:**

- `useGymCircleSocial.ts:73-91` e `useSupabaseSocial.ts:121-127`.
- O ranking `getSmartScore` continua usando `getSharedGymCount * 26` —
  o sinal influencia ordem do feed, só não vaza visualmente.
- Razões remanescentes: "Seu treino", "Seguindo", "Streak em alta",
  "Descoberta". Como o card não exibe mais `smartReason`, são strings vivas
  no `EnrichedPost.smartReason` sem render, prontas pra próximos usos
  (debug/analytics) ou remoção total numa sprint futura.

**Novo módulo: `apps/web/src/components/gym-circle/social/caption.ts`**

- `CAPTION_TRUNCATE_THRESHOLD = 140`
- `truncateCaptionText(text, max)` — corta no último espaço antes do limite,
  trimEnd no resultado.
- `isCaptionLong(text, threshold?)` — predicate booleano.

Decisão arquitetural: truncar por contagem de chars (não por CSS `line-clamp`)
porque `line-clamp` esconde texto mas não nos diz se cortou — o botão "mais"
precisaria adivinhar via medição de DOM, frágil em iOS WebView.

**Cobertura unitária:**

- `apps/web/src/components/gym-circle/social/caption.test.ts` — 8 testes
  cobrindo: texto curto preservado, texto no limite exato, corte no último
  espaço, fallback hard-cut sem espaços, preservação de `@mention` quando
  cabe, trim de trailing whitespace, `isCaptionLong` default e custom
  threshold.

**Validação:**

- `npm run lint` (apps/web): 0 warnings ✓
- `npm test` (root, vitest): 30 arquivos, 166/166 testes passed ✓
- `npm run build` (apps/web): TypeScript 3.0s, build Turbopack 1.78s ✓

**Não escopo desta fase (movido pra 3.3/3.4):**

- CommentsBottomSheet dedicado (o card ainda renderiza comentários inline
  via `commentsOpen` toggle).
- Reactions row rápida (`❤️ 🙌 🔥 👏 🥲 😍 😮 😂`).
- Replies agrupadas e expansão.
- Microinterações em todos os taps do feed (compartilhar, follow, etc).
- Auditoria final de acessibilidade.
- Teste manual no iPhone real.

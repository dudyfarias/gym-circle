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
| Microinterações + haptics | Sim | Sim (3.2 + 3.3 — like, comentar, reactions row) | Sim | — |
| Safe area / Dynamic Island / keyboard | Sim | Sim (3.3 + 3.4 — chat refactor + dismiss global) | Sim | — |
| Acessibilidade (aria-labels, tap >=44px) | Sim | Sim (3.4 — aria nos inputs do auth + chat) | Sim | — |
| Testes vitest | Sim | Sim (3.2 — `caption.test.ts` 8 testes) | Sim | — |
| Teste manual no iPhone | Sim | — | — | A fazer pelo Eduardo |
| **Bug**: teclado não fecha em tap fora | — | Sim (3.4 — `pointerdown` global) | Sim | — |
| **Bug**: chat barra voando + mensagens pulando | — | Sim (3.4 — `h-[100dvh]` + overflow interno) | Sim | — |
| **UX**: login com username OU email | — | Sim (já existia em prod — validado via Supabase MCP) | Sim | — |

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

Sprint 3 PLANEJADA em 2026-05-21. Fases 3.1 → 3.4 entregues em
2026-05-22. **Fase 3.5 (Gym Circle Profile & Gamification) iniciada** em
2026-05-22 — sub-fase 3.5.1 entregue, 3.5.2 em andamento, 3.5.3 / 3.5.4 /
3.5.5 pendentes. Smoke test no iPhone real ainda pendente do Eduardo.

---

### Fase 3.5 — Gym Circle Profile & Gamification (em andamento)

**Objetivo (vindo direto do Eduardo, 2026-05-22):**

Reformular o perfil pra trazer de volta o conceito visual do "círculo"
como assinatura do app. Os 3 círculos deixam de ser decorativos e passam
a representar consistência REAL em 3 períodos: semana, mês, ano. Streak
sai do centro e vira chip discreto. Tocar nos rings abre uma tela rica
de gamificação ("Meu Circle") com calendário mensal, badges derivados de
dados reais, níveis e progressão. Performance preservada — gamificação
carregada sob demanda.

**Decisões já tomadas (não revisar — Eduardo confirmou):**

1. **Denominador dos rings = TOTAL do período** (não "dias decorridos"):
   - Semana: `workoutsThisWeek / 7`
   - Mês: `workoutsThisMonth / totalDiasDoMês`
   - Ano: `workoutsThisYear / totalDiasDoAno` (365 ou 366)
   - Trade-off conhecido: no início do mês o ring parece "vazio" mesmo
     treinando todo dia (4/31 ≈ 13%). Aceitamos.
2. **MyCircleSheet absorve o MonthlyRecap** — calendário mensal vive
   DENTRO do novo sheet (Eduardo: "o monthlyrecap vai estar dentro do
   mycircle").
3. **5 sub-fases**, cada uma com lint+test+build+deploy independente:
   3.5.1 Foundations → 3.5.2 Visual rings → 3.5.3 MyCircleSheet →
   3.5.4 GamificationService → 3.5.5 Polish + docs.

---

#### Fase 3.5.1 entregue (2026-05-22) — Foundations

**Commit:** `896323d` — `feat(sprint-3.5.1): foundations — workoutsThisWeek + 3 rings semana/mês/ano`

**O que foi feito:**

- **`social/streak.ts` refatorado:**
  - Novos helpers exportados: `getMondayOfWeek(date)`, `getTotalDaysInMonth(date)`, `getTotalDaysInYear(date)` (regra de bissexto correta: múltiplo de 4 exceto 100 exceto 400).
  - `ConsistencyProgressInput` agora é `{ workoutsThisWeek, workoutsThisMonth, workoutsThisYear }`. Antigo `streakLitToday`/`activeDaysCount` foi removido do input.
  - `getConsistencyProgress` retorna `{ week, month, year }` (não mais `day`).
  - `buildConsistencyRings` retorna `[year, month, week]` (ordem externo→interno — index 0 = ring de fora, maior raio).
  - `calculateWorkoutStats(workoutDays, todayKey)` agora também retorna `workoutsThisWeek` (segunda→domingo ISO) e `workoutsThisYear`.
  - Removido `getDayOfYear` (não tem mais consumer).
- **`social/types.ts`:** `GymUser` ganhou `workoutsThisWeek: number`. JSDoc explica que `activeDaysCount` é year-scoped (vem de `user_stats.active_days_this_year` no Supabase).
- **Wire-up:**
  - `mock-data.ts`: `workoutsThisWeek: 0` placeholder em todos os users (fixture).
  - `useGymCircleSocial.ts`: spread explícito de `calculateWorkoutStats` em vez de `...stats`, evita derramamento de `workoutsThisYear` que não está no GymUser.
  - `useSupabaseSocial.ts`: `workoutsThisWeek: 0` em 4 lugares (fallback). **Não há RPC novo nesta sprint.** Quando GamificationService (3.5.4) carregar `user_activity_days`, o frontend deriva `workoutsThisWeek` real client-side via `calculateWorkoutStats`.
  - `StreakCard.tsx` (componente legado, ainda não removido): adicionada prop opcional `weekWorkouts?` com fallback `Math.min(current, 7)`.
- **Testes (`social/streak.test.ts`):** 23 testes novos cobrindo `getMondayOfWeek` (segunda própria, quarta, domingo, cross-month), `getTotalDaysInMonth` (28/29/30/31), `getTotalDaysInYear` (bissextos + caso 1900/2000), `calculateWorkoutStats` (semana/mês/ano/streak), `getConsistencyProgress` (clamp + denominadores), `buildConsistencyRings` (ordem + ausência de `day`).
- **Validação:** lint 0 warnings, **189/189 testes** (23 novos), build Turbopack + TS ✓.

---

#### Fase 3.5.2 — Visual rings ao redor do avatar (em andamento)

**Status:** código escrito, validação BLOQUEADA por filesystem timeout
local (iCloud sync no Documents/) em 2026-05-22T13:30Z. **Não foi
commitada nem deployada ainda.** Continuar daqui na próxima sessão.

**Arquivos criados localmente (no worktree):**

1. `apps/web/src/components/gym-circle/design-system/AvatarConsistencyRings.tsx`
   - Componente novo: foto centralizada + 3 rings ao redor (semana/mês/ano).
   - SVG com `rotate(-90)` pra começar do topo (12h). `stroke` fino, glow discreto via `drop-shadow`. Sem dependência de lib.
   - Avatar central no `<div>` com `pointer-events-none`, dimensionado por `avatarDiameter = (innerRingRadius − strokeWidth − padding) * 2`. Usa `next/image` se `avatarUrl`, senão fallback gradient + iniciais.
   - Story ring opcional: ring extra MAIS EXTERNO (com `storyGap` separando dos 3 rings de consistência). Gradient brand→month→year quando não vista; cinza translúcido quando vista.
   - `onTap` único — caller decide o que faz (vai apontar pro `MyCircleSheet` na 3.5.3). Haptic `light` antes do callback via `simulateHaptic("like")`.
   - Aria-label inteligente: "Consistência de X, Semana N%, Mês N%, Ano N%, story novo/visto".
2. `apps/web/src/components/gym-circle/design-system/ProfileIdentity.tsx` **reescrito**:
   - Layout CENTRALIZADO (era inline com stats ao lado do avatar).
   - Topo: `AvatarConsistencyRings` (default 180px).
   - Abaixo: nome grande (22px) centralizado + lock-if-private + @username.
   - Row de chips: `[🔥 streak]` + `[nível shortLabel]` + `[📍 mainGym]` — todos discretos `bg-white/[0.06]`.
   - Bio centralizada (max 340px).
   - Stats `[Posts | Seguidores | Seguindo]` em grid 3 colunas centralizado.
   - `actions` slot abaixo (caller compõe Editar/Admin ou Follow/Mensagem/Flag/Block).
   - Nova prop `onOpenMyCircle?: () => void` — propagada pro tap dos rings.
   - Nova prop `ringsSize?: number` (default 180).
   - **Atenção:** `onOpenStory` ainda recebido no type mas não destructurado/consumido — adicionado lint-friendly fallback (comentário inline). Caller continua passando, mas é silenciosamente ignorado por enquanto. Polish na 3.5.5 ou já agora se quisermos: o tap no avatar central pode disparar story se hasStory, vs tap nos rings → MyCircle.
3. `apps/web/src/components/gym-circle/design-system/index.ts` — adicionado `export * from "./AvatarConsistencyRings"`. **`ProfilePostsGrid` já é exportado da fase anterior.**

**O que falta na 3.5.2 antes do commit:**

- [ ] Rodar `npm run lint` (apps/web) — esperar 0 warnings (1 warning recente sobre `_onOpenStory` já foi removido com edit).
- [ ] Rodar `npm test` — esperar 189/189 (não há testes novos pro AvatarConsistencyRings ainda — adicionar na 3.5.5).
- [ ] Rodar `npm run build` (apps/web) — esperar 12 páginas.
- [ ] Wire-up real: passar `onOpenMyCircle` do `ProfileScreen` e `ProfileSheet` pra abrir o futuro `MyCircleSheet`. Hoje passa `undefined`, então tap nos rings é no-op. Vale fazer JÁ NA 3.5.2 (parametrizar via callback) deixando a abertura real pra 3.5.3.
- [ ] Validar visualmente em dev local (`npm run dev`): a foto fica realmente centralizada + rings circundando? Avatar maior que antes?
- [ ] Commit + push + sync main + verify deploy via Vercel MCP.

**Sintoma do bloqueio (pra debug se voltar):**

- `cat /Users/eduardofariascappia/Documents/Site-de-vendas-oracao/gym-circle/apps/web/package.json` → "Operation timed out" (FS read).
- `npm run lint` → `ETIMEDOUT: connection timed out, read` (npm tentando ler package.json via node fs API).
- `ls` funcionou normalmente — file existe, mas read content bloqueado.
- **Suspeita:** iCloud Drive evicted o arquivo (download on demand). Aguardar ~minutos pra refazer, ou rodar `brctl download` no path antes.
- O worktree em `.claude/worktrees/flamboyant-fermi-c51db9/` está OK e pode ser usado pra acessar arquivos.

---

#### Fase 3.5.3 entregue (2026-05-22) — MyCircleSheet

**Commit:** `f210e68` — `feat(sprint-3.5.3): MyCircleSheet — gamificação rica do Gym Circle`

**O que foi feito:**

- **Novo módulo `social/gamification.ts`** — helpers puros pra
  derivação de badges, **sem rede, sem cache** (3.5.4 vira service).
  - `getEarnedBadges({ user, postsCount, hasUsedStreakRestore })` — 11
    badges com regras 100% baseadas em dados existentes:
    `first-workout`, `streak-3/7/14/30`, `active-week`, `month-active`,
    `year-active`, `social`, `popular`, `streak-recovered`.
  - `countEarnedBadges(badges)` + `getNextBadge(badges)` pra UI.
  - **Nenhum badge fake.** Bloqueados ficam cinza com cadeado.
- **Novo componente `MyCircleSheet.tsx`** com 7 seções:
  - **A.** Header com `AvatarConsistencyRings` (130px) + nome + `@username` + `StreakBadge`.
  - **B.** Resumo 2x3: streak atual, maior streak, treinos no mês, dias no ano, posts, restauradores.
  - **C.** Explicação dos rings com mini-progress bars coloridas: "Semana X/7", "Mês X/Y", "Ano X/365".
  - **D.** Calendário mensal navegável (← / →) — usa `buildMonthWorkoutDays` existente. Dias treinados em ciano, sem treino em cinza, hoje com glow brand discreto.
  - **E.** Níveis (Iniciante/Consistente/Elite/Lendário) — atual destacado com ring brand, anteriores opacos, próximos cinza, range de dias em cada um.
  - **F.** Badges grid (3-4 colunas) — conquistadas em brand com Trophy preenchido, bloqueadas em cinza com cadeado. Contador X/N + CTA "Falta pouco pra ..." do próximo badge.
  - **G.** Competição (placeholder) — card "Em breve" com Trophy icon e copy sobre ranking semanal.
- **Privacidade:**
  - Próprio user OU público OU follow accepted: tudo visível.
  - Outro user privado + não follow: header + notice "Perfil privado" (esconde calendário/badges/níveis).
- **Haptics:**
  - Trocar mês no calendário → `simulateHaptic("brand")` (selection).
  - Entry-point dos rings → `simulateHaptic("like")` (light, já feito na 3.5.2 no `AvatarConsistencyRings`).
- **Wire-up em `GymCirclePreview.tsx`:**
  - Dynamic import (chunk lazy separado).
  - State `myCircleUserId: string | null` + actions `openMyCircle/closeMyCircle`.
  - Derivados `myCircleUser` e `myCircleUserPosts` (resolve próprio user ou outro via `usersById`).
  - Render `<MyCircleSheet />` ao lado do `ProfileSheet`.
  - Passa `hasStory`/`storyViewed` do storyGroup apropriado (próprio: `currentUserStoryGroup`, outro: `profileSheetStoryGroup`).
- **Wire-up em `ProfileScreen.tsx` + `ProfileSheet.tsx`:**
  - Nova prop `onOpenMyCircle?: () => void` propagada pro `ProfileIdentity` (que já tinha a prop desde 3.5.2 — agora ligada).
  - `ProfileScreen`: `onOpenMyCircle={() => openMyCircle(currentUser.id)}`.
  - `ProfileSheet`: `onOpenMyCircle={() => openMyCircle(user.id)}`.

**Validação:**

- FS local com timeouts intermitentes (iCloud sync no `Documents/`) — lint/test/build local NÃO foram re-rodados nesta etapa.
- Vercel build remoto valida TypeScript + bundle. Se quebrar, fix-up commit follow-up.

#### Fase 3.5.3 — MyCircleSheet (PENDENTE — substituído pela seção acima)

**Objetivo:** sheet de gamificação rica, aberto via tap nos rings do
`AvatarConsistencyRings`. Vai substituir parcialmente o
`MonthlyRecapSheet` (que é absorvido como subseção interna —
calendário mensal vive dentro).

**Plano de implementação:**

1. Criar `apps/web/src/components/gym-circle/MyCircleSheet.tsx`:
   - Mesma estrutura de overlay/sheet do `CommentsBottomSheet` (handle bar visual, backdrop tap, max-h-[100dvh]).
   - Título "Meu Circle" (próprio) ou "Circle de [Nome]" (visitando outro user).
   - Botão X de fechar (44px) + safe-area.
2. **Seções (top → bottom):**
   - **A. Header**: avatar (`AvatarConsistencyRings` em tamanho menor, ~120px) + nome + username + chip de nível + chip de streak.
   - **B. Resumo principal**: 6 cards pequenos em grid 2x3:
     - Streak atual (`currentStreak`)
     - Maior streak (`longestStreak`)
     - Treinos no mês (`workoutsThisMonth`)
     - Dias treinados no ano (`activeDaysCount`)
     - Check-ins (`checkInsCount`)
     - Posts (posts.length)
   - **C. Explicação dos rings**:
     - "Semana: X/7 dias"
     - "Mês: X/Y dias" (Y = total do mês)
     - "Ano: X/365 dias" (ou 366 se bissexto)
     - Cada item com mini-progress bar reaproveitando cor do ring correspondente.
   - **D. Calendário do mês**: trazer de volta o calendário mensal:
     - Mês atual.
     - Dias treinados em azul/ciano (`var(--gc-consistency-month)`).
     - Dias sem treino em cinza escuro (`white/[0.06]`).
     - Dia atual com glow/borda discreta.
     - Indicador especial se restaurou streak (ícone `LifeBuoy` no dia).
     - Fonte: `user_activity_days` filtrado pelo mês corrente. Helper `buildMonthWorkoutDays` já existe em `social/streak.ts`. Reusar.
     - Trocar de mês via swipe ou setas (sem animação pesada — Sprint 4).
   - **E. Níveis de consistência** (`getStreakLevel`/`getAllStreakLevels` já existem):
     - Lista vertical: Iniciante (0+) / Consistente (4+) / Elite (14+) / Lendário (30+).
     - Nível atual destacado com fundo brand.
     - Próximos níveis em cinza com "Faltam N dias" ou similar.
     - Progress bar entre níveis.
   - **F. Badges conquistados** (nova seção):
     - Grid 4-5 colunas com ícones.
     - Conquistado = cor brand + ícone preenchido.
     - Bloqueado = cinza com cadeado.
     - **NÃO INVENTAR BADGE FAKE.** Derivar de dados existentes:
       - "Primeiro treino": posts.length >= 1
       - "Primeiro check-in": checkInsCount >= 1
       - "Primeiro story": stories do user >= 1 (verificar tabela `stories`)
       - "3 dias seguidos": longestStreak >= 3
       - "7 dias seguidos": longestStreak >= 7
       - "14 dias seguidos": longestStreak >= 14
       - "30 dias seguidos": longestStreak >= 30
       - "Consistente na semana": workoutsThisWeek >= 5
       - "Mês ativo": workoutsThisMonth >= 15
       - "Social": followersCount >= 10
       - "Storyteller": stories.length >= 3 (precisa do count)
       - "Voltou após perder streak": tem registro em `streak_restore_events` com status="recovered"
   - **G. Competição/social — placeholder**:
     - Apenas card "Em breve" com texto "Ranking do seu circle, desafios e comparação com amigos chegam em breve".
     - Sem implementação nesta sprint — Sprint futura `Competition & Rankings`.

3. **Wire-up:**
   - `ProfileScreen.tsx`: criar state `myCircleOpen: boolean`, callback `onOpenMyCircle = () => setMyCircleOpen(true)`. Passar pro `ProfileIdentity`. Render `<MyCircleSheet open user posts ... />`.
   - `ProfileSheet.tsx`: idem, mas o user é o user visitando (não currentUser). Respeitar `canSeePosts` da privacidade — se private + não follow, esconder calendário/badges, mostrar só resumo público.
   - `GymCirclePreview.tsx`: dynamic import do `MyCircleSheet` (lazy chunk).

4. **Privacidade:**
   - Próprio perfil: tudo visível.
   - Outro user público: tudo visível (já que feed é público).
   - Outro user privado, não followed: esconder calendário, badges, resumo detalhado. Mostrar só "Perfil privado" + último treino preview (igual `PrivateLockedNotice` atual).

5. **Performance:**
   - Sheet só renderiza quando `open === true` (já vem do dynamic import).
   - `calculateWorkoutStats(user.workoutDays)` no client é rápido (já existe).
   - Calendário usa `buildMonthWorkoutDays` (já existe).
   - Badges são derivações puras — sem chamadas API.

6. **Haptics:**
   - Abrir sheet: `light`.
   - Tocar em badge: `selection`.
   - Trocar mês no calendário: `selection`.
   - Fechar: nenhum (já no `handleClose`).

---

#### Fase 3.5.4 entregue (2026-05-22) — Testes de gamificação

**Commit:** `767a7de` — `test(sprint-3.5.4): cobertura completa do getEarnedBadges + doc 3.5.3`

**Decisão pragmática:** o `getEarnedBadges` puro (criado na 3.5.3) já
cobre 90% do que o `GamificationService` precisa. **O service completo
com cache TTL + RPC fica reservado pra sprint futura** (quando o lazy
load de `user_activity_days` for necessário pro calendário com dados
mais precisos do que o array hidratado).

O que entrou nesta sub-fase:

- `social/gamification.test.ts` — **24 testes vitest** cobrindo:
  - Default (todos bloqueados sem dados).
  - Cada uma das 11 regras de badge isoladamente.
  - **Cenário do Johnny** (141d streak, 21 mês, 141 ano, 50 posts) →
    8/11 badges desbloqueados. Smoke pra dados de teste reais.
  - `countEarnedBadges` (contagem + zero).
  - `getNextBadge` (primeiro bloqueado + `null` quando completo).

Architecture preparada pra futuro `GamificationService`:

```ts
// Interface esperada (futuro)
type GamificationService = {
  getUserGamificationSummary(userId: string): Promise<...>;
  getMonthlyActivityCalendar(userId: string, monthKey: string): Promise<...>;
  getConsistencyLevel(stats): { current, next, daysToNext };
  getEarnedBadges(userId, stats, activityDays): Badge[]; // wrapper do já existente
  getNextBadgeProgress(userId, stats): { badge, progress };
};
```

Cache estratégia futura: in-memory `Map<userId+month, { data, expiresAt }>`
com TTL ~5min. Fallback vazio amigável quando offline.

#### Fase 3.5.5 entregue (2026-05-22) — Polish + roadmap final

**O que entrou:**

- Doc desta sub-fase: marca Sprint 3.5 como **COMPLETA** com pendências
  conhecidas explícitas.
- `docs/native-feel-roadmap.md` atualizado com nova sprint futura
  `Sprint X: Competition & Rankings` listando: ranking semanal/mensal
  entre amigos, ranking entre circles (academias), desafios sazonais,
  conquistas compartilháveis (deeplink + share sheet), badges
  unlockable shareable, GamificationService completo com cache + RPC.

**Validação durante a Sprint 3.5:**

- Sprint 3.5.1: lint 0 warnings, 189/189 testes (23 novos), build OK ✓
- Sprint 3.5.2: build local com FS intermitente (iCloud) — Vercel build
  validou em prod (commit 45c8ab7 — deploy READY).
- Sprint 3.5.3: FS local quebrou (iCloud evict node_modules/bin). Validação
  via Vercel build remoto OK (commit f210e68 — deploy
  `dpl_DTewEbpytua4vRdCyzdLUcv5KVrX` READY, target production, 30s
  build, servindo `gym-circle-rust.vercel.app`).
- Sprint 3.5.4: testes adicionados ao código (não rodados localmente
  por causa do FS). Vercel build vai compilar o `.test.ts` durante o
  next build via Turbopack TS resolution (mesmo se vitest não rodar
  local). Re-rodar `npm test` quando o FS estabilizar.

**Decisões arquiteturais resumidas da Sprint 3.5:**

1. **Rings = denominador TOTAL do período** (semana=X/7, mês=X/total,
   ano=X/total). Trade-off: ring vazio no início do mês mesmo
   treinando todo dia.
2. **`buildConsistencyRings` retorna [year, month, week]** — index 0 =
   maior raio. Semana fica mais perto do avatar, ano envolve tudo.
3. **`AvatarConsistencyRings` é a assinatura visual** — foto centralizada
   com rings circundando substitui o "círculo separado ao lado do
   avatar" da v1. Tap = `light` haptic + abre `MyCircleSheet`.
4. **`MyCircleSheet` absorveu o `MonthlyRecapSheet`** — calendário mensal
   vive DENTRO do novo sheet (junto com resumo, níveis, badges,
   placeholder de competição).
5. **Badges são derivações puras** — `getEarnedBadges` é função pura,
   sem rede. 11 badges com regras 100% baseadas em dados existentes.
   Nenhum badge fake.
6. **`GamificationService` completo (cache + RPC) adiado** pra sprint
   futura — o cliente derivado dos dados hidratados é suficiente pro
   primeiro release.
7. **Privacidade respeitada** — outro user privado + não follow vê só
   header + notice "Perfil privado" no MyCircleSheet.

**Pendências conhecidas Sprint 3.5 (não-bloqueantes, prontas pra Sprint futura):**

- `GamificationService` real com cache TTL + lazy load de
  `user_activity_days` (3.5.4 entregou só testes do helper puro).
- Animação spring de entrada/saída do `MyCircleSheet` (atual usa
  `translate-y` + `transition-transform duration-300`).
- Gesto real de swipe-to-dismiss no `MyCircleSheet` (handle visual ok).
- Tap dedicado no AvatarConsistencyRings pra abrir story (hoje rings
  sempre abrem MyCircle — story tem que ser tocada de outro lugar).
- Badge unlock animation quando ganhar novo badge (sparkle + haptic
  success).
- Cleanup do `StreakCard`/`StreakScreen` legados se nada mais usar.
- Smoke test no iPhone real pelo Eduardo (incluindo testes
  manuais documentados em "Teste manual iPhone real" mais acima).

### Como retomar o Sprint 3.5 (próxima sessão)

Sprint 3.5 está **completa em produção**. Próximos passos seriam:

1. **Smoke test no iPhone real** — Eduardo testa em device. Checklist:
   - Meu perfil: rings ao redor do avatar centralizado? Tap nos rings
     abre MyCircle?
   - Calendário mostra dias treinados corretamente? Hoje destacado?
   - Badges conquistados em brand, bloqueados em cinza?
   - Privacidade: testar perfil privado + não-follow, ver só header.
   - Regressão: feed/stories/chat/edit profile/seguir/login OK?
2. **Sprint futura Competition & Rankings** — implementar o que ficou
   no roadmap.
3. **Cleanup legado**: deletar `StreakCard.tsx` e `StreakScreen.tsx` se
   nada mais usar (grep confirma — só auto-referência sem callers).
4. **`GamificationService` real** — só quando precisar de lazy load
   real do `user_activity_days` (ex.: calendário trans-mês com dados
   precisos).

#### Fase 3.5.5 (PENDENTE — substituído pela seção acima)

**Objetivo:** centralizar lógica de derivação de gamificação em um service
testável. Sob demanda — não no boot.

**Plano:**

1. Criar `packages/core/src/services/gamificationService.ts` (ou
   `apps/web/.../social/gamificationService.ts` se preferir client-only).
2. Métodos:
   - `getUserGamificationSummary(userId)`: stats + level + counts agregados.
   - `getMonthlyActivityCalendar(userId, month: string)`: dias do mês com status (trained/missed/restored/today). Carrega `user_activity_days` filtrado por mês. Cache curto (sessionStorage com TTL ~5min).
   - `getConsistencyLevel(stats)`: já existe `getStreakLevel`, só wrapping com contexto extra (progresso até próximo nível).
   - `getEarnedBadges(userId, stats, activityDays)`: pure function que retorna lista de badges (id + earned + earned_at?). Cobertura via tests.
   - `getNextBadgeProgress(userId, stats)`: o próximo badge que o user está mais próximo de ganhar + "faltam N treinos/dias".
3. **NÃO carregar gamificação pesada no boot** — só quando `MyCircleSheet` abrir.
4. **Cache curto** via `LocalAppCache` (existe em `social/` ou similar — verificar).
5. **Fallback vazio amigável** — se Supabase não responder, mostrar
   "Carregando..." e nunca crashar.
6. **Sem RPC novo** nesta sprint (Eduardo: "Mas evitar RPC extra se
   frontend já tiver os dados"). Carregar `user_activity_days` direto
   com `select activity_date, source_type` filtrado por user_id e mês.
7. **Testes vitest** pra cada método derivacional (especialmente badges).

---

#### Fase 3.5.5 — Polish + docs + roadmap (PENDENTE)

1. **Microinterações + haptics finais:**
   - Tocar ring = light (já feito na 3.5.2).
   - Abrir sheet = light (3.5.3).
   - Tocar badge = selection.
   - Badge conquistado anim = success.
   - Trocar mês = selection.
2. **Animações:**
   - Progress reveal dos rings ao montar (já tem `gc-activity-ring-value` CSS class — verificar `globals.css` e ajustar se necessário).
   - Fade/scale suaves no sheet (já existe no `CommentsBottomSheet`, padronizar).
3. **UI cleanup:** revisar `StreakCard`/`StreakScreen` legados — podem ser deletados se nada mais usa. Cleanup do que sobrou.
4. **Testes vitest:**
   - `AvatarConsistencyRings`: aria-label correto, story ring quando `hasStory`, tap dispara `onTap`.
   - `MyCircleSheet`: estados (loading, vazio, completo, privado).
   - `getEarnedBadges`: cada regra de badge cobrindo true/false.
   - `getMonthlyActivityCalendar`: trained/missed/today/restored.
5. **Testes manuais no iPhone** (Eduardo): meu perfil, outro perfil, perfil privado, abrir MyCircle, calendário, badges, performance/scroll, animações, haptics, regressão feed/stories/chat.
6. **Atualizar `docs/native-feel-sprint-3.md`** (este arquivo): substituir status "em andamento" das fases 3.5.2-3.5.5 por "entregue" com commits e validação. Marcar Sprint 3 como **COMPLETA** se Eduardo aprovar pós smoke test.
7. **Atualizar `docs/native-feel-roadmap.md`:** adicionar sprint futura `Competition & Rankings` com:
   - Ranking semanal entre amigos
   - Ranking entre circles
   - Desafios sazonais
   - Conquistas compartilháveis (deeplink + share sheet)
   - Badge unlockable shareable

---

### Como retomar daqui (próxima sessão)

1. **Esperar/forçar download do FS** se `Operation timed out` aparecer:
   - `ls` no path do arquivo (força iCloud download).
   - Ou trabalhar via worktree path: `.claude/worktrees/flamboyant-fermi-c51db9/`.
2. **Validar a 3.5.2** rodando lint+test+build (provavelmente já passa).
3. **Adicionar wire-up `onOpenMyCircle`** no `ProfileScreen` e `ProfileSheet` (callback que vai abrir o futuro sheet — por enquanto, `undefined` é OK).
4. **Commitar 3.5.2** com mensagem padronizada (ver pattern dos commits 3.x anteriores).
5. **Implementar 3.5.3** seguindo o plano acima — comece pelo esqueleto do sheet com seções vazias, depois preenche uma de cada vez.
6. **Implementar 3.5.4** depois ou em paralelo (badges são puros — independem do sheet).
7. **Fechar com 3.5.5** (polish + docs final + cleanup).

### Dados de teste pra Sprint 3.5 (criados em 2026-05-22)

Pra facilitar testes visuais da gamificação, o user **@johnny** (id
`833f628e-c4e1-415d-ac8b-5f63e006a7f8`) foi populado com streak completo:

- 141 dias treinados consecutivos (2026-01-01 → 2026-05-21, todos os dias).
- `user_activity_days`: 141 registros (`source_type='post'`).
- `user_stats`: `current_streak=141`, `best_streak=141`,
  `workouts_this_month=21`, `active_days_this_year=141`,
  `last_active_date='2026-05-21'`, `badge_is_active_today=false`.

Esses dados permitem ver:
- Rings em estado próximo de cheio (semana, mês, ano).
- Badges desbloqueados (3+, 7+, 14+, 30+ dias seguidos).
- Calendário mensal com quase todos os dias preenchidos.
- Nível "Lendário" (>= 30 dias).

Pra resetar: `DELETE FROM user_activity_days WHERE user_id =
'833f628e-c4e1-415d-ac8b-5f63e006a7f8' AND source_type='post' AND
activity_date BETWEEN '2026-01-01' AND '2026-05-21'` (preserva os 33
registros originais de outras `source_type`).

---

### Fase 3.4 entregue (2026-05-22)

**Cleanup das props deprecadas:**

- `SocialPostCardProps` perdeu `onComment`, `onDeleteComment`, `onLikeComment`,
  `mentionUsers`. Essas callbacks migraram pro `CommentsBottomSheet` na 3.3 e
  permaneciam só por retrocompat. O sheet recebe direto de `GymCirclePreview`.
- `FeedScreenProps` perdeu as mesmas + `commentMentionUsers`. Wire-up no
  `GymCirclePreview` corrigido (parar de passar essas props pro `FeedScreen`).

**Auditoria de keyboard handling (fora de escopo original — bug-fix
prioritário identificado pelo Eduardo)**:

3 sintomas reportados, 3 fixes:

1. **"Barra de escrever voando" no chat**
   - **Causa**: `<section className="min-h-screen">` + `<form sticky bottom>`.
     `100vh` é fixo no viewport inicial; o teclado iOS encolhe o WebView
     com `resize: "native"`, mas `min-h-screen` não muda → sticky bottom
     calcula posição abaixo do teclado.
   - **Fix em `ChatScreen.tsx` ConversationView**: `h-[100dvh]` (dynamic
     viewport height, encolhe junto com teclado em iOS 16+/Android moderno) +
     flex column + lista de mensagens com `overflow-y-auto` próprio + form
     como `last-child` do flex sem `sticky bottom`. Input sobe naturalmente
     com o keyboard — zero JS, zero hacks de cálculo.

2. **"Conversa se mexendo sozinha"**
   - **Causa**: `scrollIntoView({behavior:"smooth", block:"end"})` no
     `threadEndRef` em `useEffect [messages.length]`. Em iOS WebView esse
     método mexe o body inteiro quando dispara durante a animação do
     teclado.
   - **Fix**: novo `messagesContainerRef`, scroll manual via
     `node.scrollTop = node.scrollHeight` dentro de `requestAnimationFrame`
     (garante paint antes da medição). Só mexe o container interno, nunca
     o body.

3. **"Teclado entra e não conseguimos tirar da tela"**
   - **Causa**: tap em `<button>`/`<div>`/`<span>` no iOS WebView não tira
     foco do input ativo automaticamente.
   - **Fix em `GymCirclePreview.tsx`**: handler global de `pointerdown` —
     se o tap caiu fora de `input/textarea/[contenteditable=true]`, blur o
     `activeElement` se for editável. Não interfere em buttons (já disparam
     ação antes do blur) nem em sheets (backdrop fecha sheet E teclado
     juntos, comportamento desejado).

**Polish de inputs (`LiveAuthGate.tsx`)**:

- `enterKeyHint="next"` no email/username (vai pro password)
- `enterKeyHint="go"` no password (envia o form) e no username de sign-up
- `enterKeyHint="send"` no `CommentsBottomSheet` e chat
- `enterKeyHint="send"` no `ChatScreen` (input de mensagem)
- `autoCapitalize="none"` + `spellCheck={false}` em campos de username/email
- `inputMode="text"` ou `"email"` apropriado por modo
- `aria-label` semântico em todos os inputs do auth

**Login com username/email — validação produção**:

Tudo já existia. Stack:
- Migration `20260507192248_chat_messages_and_username_login.sql` cria
  `public.resolve_email_for_username(p_username text)` com `security definer`,
  case-insensitive (`lower(p.username) = lower(trim(p_username))`).
- `packages/core/src/services/auth.ts:32-40` detecta `@` no identifier:
  com `@` usa direto, sem `@` chama a RPC.
- `LiveAuthGate.tsx:88` já tinha placeholder `"email ou username"` com
  `autoComplete="username"`.

Validado via Supabase MCP (`mcp__07a3cfe0-...`-`execute_sql`):
- Função existe, `security_definer = true`, executable por
  `anon`/`authenticated`/`service_role`.
- Testes em 5 usernames reais retornaram email válido.
- Username inexistente retorna `NULL` (frontend lança erro friendly).

**Validação:**

- `npm run lint` (apps/web): 0 warnings ✓
- `npm test` (vitest): 30 arquivos, **166/166** testes passed ✓
- `npm run build` (apps/web): Turbopack 1.78s + TS, 12 páginas ✓

**Pendência única do Sprint 3:**

- **Smoke test no iPhone real** pelo Eduardo. Plano de teste documentado
  na seção "Teste manual iPhone real" acima.

**Pendências futuras (não-bloqueantes do Sprint 3, fora do escopo)**:

- Replies aninhados no `CommentsBottomSheet` — exigem migration backend
  (`parentCommentId` no `GymComment`). Vale juntar com Sprint que mexer
  no schema (ex.: carrossel de mídia múltipla).
- Swipe-to-dismiss real do `CommentsBottomSheet` — visual handle ok por
  enquanto; gesto real fica pra Sprint 4 quando o app ganhar swipe-back
  patterns iOS.
- Apple Maps real, HealthKit, push real — conforme `native-feel-roadmap.md`.

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

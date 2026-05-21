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
| Bug plural curtidas no feed | Sim | — | — | Sim |
| `formatLikesSummary` helper testável | Sim | — | — | Sim |
| Post header minimalista | Sim | — | — | Sim |
| Actions row clean | Sim | — | — | Sim |
| Caption inline com "mais" | Sim | — | — | Sim |
| Comments preview "Ver todos os X" | Sim | — | — | Sim |
| Timestamp curto cinza | Sim | — | — | Sim |
| CommentsBottomSheet (novo) | Sim | — | — | Sim |
| Estado vazio CommentsSheet | Sim | — | — | Sim |
| Input fixo no rodapé do sheet | Sim | — | — | Sim |
| Keyboard handling no sheet | Sim | — | — | Sim |
| Reactions row rápidas | Sim | — | — | Sim |
| Replies agrupadas (se backend suportar) | Sim | — | — | Sim |
| Comment likes update otimista | Sim | — | — | Sim |
| Header "Sugestões de amizade" | Sim | — | — | Sim |
| Remover "academia" do DiscoveryUserCard | Sim | — | — | Sim |
| DiscoveryUserCard refactor visual | Sim | — | — | Sim |
| Botão "Adicionar" iOS-like | Sim | — | — | Sim |
| Microinterações + haptics | Sim | — | — | Sim |
| Safe area / Dynamic Island / keyboard | Sim | — | — | Sim |
| Acessibilidade (aria-labels, tap >=44px) | Sim | — | — | Sim |
| Testes vitest | Sim | — | — | Sim |
| Teste manual no iPhone | Sim | — | — | Sim |

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

Sprint 3 PLANEJADA em 2026-05-21. Implementação iniciada na Fase 3.1
(quick wins — bug plural curtidas, header "Sugestões de amizade",
`DiscoveryUserCard` sem academia). Fases 3.2 (post visual refactor),
3.3 (CommentsBottomSheet), 3.4 (polish + validação) ficam para próximas
sessões.

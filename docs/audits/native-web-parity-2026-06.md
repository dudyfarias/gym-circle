# Auditoria de paridade visual Web ↔ Nativo — jun/2026

> Alvo (decisão Eduardo, 16/jun): **mesma estrutura/tokens** — cores,
> espaçamento, tipografia, raios, ícones, cópia e fluxos iguais; visualmente
> indistinguível na prática (SwiftUI e React renderizam um pouco diferente,
> mas o olho não pega). Começo pelos **tokens** (cascateiam pra todas as telas).

## Status

- ✅ **Build 4 (já no ar):** 2 bugs corrigidos — chat "conversa comigo mesmo"
  (UUID maiúsculo) + fotos em baixa qualidade (feed usava thumbnail 720px).
- 🔜 Esta auditoria orienta os próximos sprints de paridade visual.

---

## Fase 1 — Tokens de design (maior alavanca)

### 1.1 Cores — ✅ batem bem
O `GymCircleTheme.ColorToken` foi construído com os hex exatos do web:
bg `#000`, card `#111`, card-elevated `#1c1c1e`, separator `rgba(255,.06)`,
text-secondary `#a1a1aa`, brand/cyan `#8af7ff`, pink `#ff2d55`,
blue `#30d5ff`, deep-blue `#0066ff` — todos conferem.

**Tokens do web que faltam no nativo** (usados em nav/blur/realces):
| Web (`globals.css`) | Falta no nativo |
|---|---|
| `--gc-bg-elevated` `#050607` | sim |
| `--gc-card-soft` `#17181a` | sim |
| `--gc-separator-strong` `rgba(255,.10)` | sim |
| `--gc-glass` `rgba(28,28,30,.72)` / `--gc-glass-strong` | sim (fundo de barras/sheets com blur) |
| `--gc-brand-soft` `#c7fcff` / `--gc-brand-glow` | sim (glow do brand) |
| `--gc-orange` `#ff9f0a` | sim — nativo conflou laranja com o gold `#FBBF24` |
| rampa consistency `daily #8cfbff / mid #009dff` (4 stops) | parcial |

### 1.2 Tipografia — ⚠️ MAIOR divergência
- **Família:** `GCText` usa `.system(design: .rounded)` (**SF Pro Rounded**) em
  TODO texto; o web usa `--gc-font-sans` = **SF Pro Display/Text** (normal).
  → trocar `.rounded` → `.default` alinha o app inteiro. **Maior impacto.**
- **Escala** (`GCText.Style`): title 28 / headline 20 / body 16 / caption 13 /
  large 48 / micro 11, todos `weight` próprios. Conferir tamanho+peso+tracking
  contra o web tela a tela na varredura (provável ≈, mas valida).

### 1.3 Raios — ⚠️ faltam stops + hardcode
- Web: md 20 / lg 24 / **xl 28** / 2xl 32 / **3xl 40** / full 999.
- Nativo `Radius`: control 20 / card 24 / panel 32 → **faltam xl(28) e 3xl(40)**.
- **Drift por hardcode:** ex. `FeedView` usa `cornerRadius: 22` (nem 20 nem 24).
  Vários views cravam valor em vez de usar o token → fonte de divergência.

### 1.4 Espaçamento — escala ok, uso inconsistente
`Spacing` (4/8/12/16/20/24/32) alinha com Tailwind (base 4). O problema é o
**hardcode** (`padding(20)`, `spacing: 14`…) espalhado em vez do token.

### Ações da Fase 1 (próximo sprint)
1. **Trocar `.rounded` → `.default`** no `GCText` + varrer `design: .rounded`
   no resto do código. (⚠️ mudança app-wide — confirmar com Eduardo.)
2. Adicionar os tokens de cor faltantes + raios xl/3xl ao `GymCircleTheme`.
3. Conferir escala de tipografia (tamanho/peso) contra o web.

---

## Fase 2+ — Varredura tela a tela (depois dos tokens)

Para cada tela: comparar com o componente web equivalente e trocar valores
cravados pelos tokens, alinhar paddings/raios/tamanhos/ícones/cópia.

| Nativo | Web equivalente | Prioridade |
|---|---|---|
| `FeedView` + card | `FeedScreen` / `SocialPostCard` / `MediaCarousel` | P0 (mais usada) |
| `MyCircleView` | `ProfileScreen` / `StreakScreen` / `StatsWidget` | P0 |
| `ProfileView` / `OtherProfileView` | `ProfileScreen` / `ProfilePostsGrid` / `ProfileIdentity` | P0 |
| `ChatViews` | `ChatScreen` | P1 |
| `AchievementsView` / `AchievementDetailView` | Hall (design-system) | P1 |
| `ComposerView` | create-post flow | P1 |
| `StoriesViews` | `StoryViewer` / `StoryBubbles` | P1 |
| `NotificationsSheet` / `CommentsSheet` / `LikesSheet` | sheets web | P2 |
| `SettingsSheet` / `EditProfileSheet` | settings/edit web | P2 |
| `CheckInView` | `CheckInScreen` / `GymCheckInCard` | P2 |
| `MonthlyRecapSheet` / Recap pickers | `MonthlyRecapCard` | P2 |

### Pendência de foto fora do feed
`OtherProfileView:367` (detalhe do post no perfil) ainda usa `displayMediaURL`
(thumbnail) — trocar pelo full ao abrir o post grande. Entra na varredura do
Perfil.

---

## Como verificar
Sem web/nativo rodando lado a lado aqui, a auditoria é **por código**: tokens do
`globals.css`/Tailwind vs `GymCircleTheme`, e classes Tailwind dos componentes web
vs modifiers SwiftUI. Cada sprint fecha com build + testes verdes; o smoke visual
final é no aparelho (TestFlight) comparando com o web no navegador.

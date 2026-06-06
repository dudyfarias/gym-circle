# Sprint 8 — Auditoria de paridade SwiftUI ↔ Web

Data: 2026-06-06
Status: 🟡 **Funciona como demo, mas NÃO está em paridade com o app Vercel**

Este doc é o resultado da revisão sistemática que você pediu. O resumo
honesto: temos a **estrutura visual** das telas nativas, com a maioria
das animações nativas (rings, particles, spotlight), **mas a integração
com dados reais está incompleta** em vários pontos, e há **divergências
funcionais e visuais** com o app web original. Sprint 8.10 disse "pronto
pra App Store" — na real, **antes de mandar pro review precisa fechar os
itens P0 abaixo**.

---

## 1. Resumo executivo

| Dimensão | Status | Observação |
|----------|--------|------------|
| **Build compila** | ✅ | Foundation Package `BUILD SUCCEEDED` e bridge `swiftc -parse exit=0` |
| **Plugin Bridge wired** | ✅ | 4 métodos expostos pro JS (`isAvailable` + 4 `present*`) |
| **Auth real (SessionStore)** | ✅ | Restaura via Supabase Keychain, compartilha com web |
| **MyCircle stats reais** | 🟡 | `workoutsThisWeek/Month/Year/streak` vêm da API. Mas… (ver §3) |
| **Calendário com dias treinados** | ❌ | `workoutDays: []` hardcoded → calendar SEMPRE VAZIO no nativo |
| **Achievements computados de DB** | 🟡 | Faltam 5 (cross-trainer, explorer, active-week, network-100, community-200) |
| **Achievements dependentes de posts/follows** | ❌ | `postsCount: 0`, `followersCount: 0` hardcoded — nunca desbloqueiam |
| **Profile do user carregado** | ❌ | `profile` só é populado em `loadDemoData()` — em produção fica nil |
| **i18n PT-BR / EN** | ❌ | TUDO hardcoded em PT-BR no SwiftUI; web tem 100% via `t()` |
| **Calendar mini-fotos** | ❌ | Web Sprint 5.2 mostra thumbnail post como bg. Swift só cor sólida |
| **Navegação calendar ← / →** | ❌ | Web tem chevron buttons. Swift mostra só mês atual estático |
| **Privacidade (perfil de outros)** | ❌ | Web tem `canSeeDetails`. Swift assume sempre `isOwn` |
| **First-visit hint banner** | ❌ | Sprint 7C.3 ausente no nativo |
| **MonthlyRecap CTA primário** | 🟡 | Botão existe mas só fala "Compartilhar resumo" — sem mês, sem fluxo |
| **MonthlyRecap sub-CTA "Outro período"** | ❌ | Sprint 5.10 ausente |
| **Competição placeholder** | ❌ | Web tem card "Em breve" — swift não |
| **AchievementsView 6ª tab "Secretos"** | ❌ | Web tem 6 tabs (Tudo+5). Swift tem 6 mas categoriza diferente |
| **FeaturedAchievements paleta por kind** | 🟡 | Swift usa rarity. Web usa kind (relic→purple/trophy→cyan/medal→gold) |
| **AchievementDetail "Você é o primeiro"** | ✅ | Implementado |
| **AchievementCelebration particles** | ✅ | Canvas SwiftUI 60fps |
| **Plugin Bridge no app JS** | 🟡 | TS wrapper `GymCircleNativeBridge.ts` existe — falta wire em ALGUM lugar do app (search-fail abaixo) |
| **ProfileSheet (perfil de outros users)** | ❌ | Não tem versão SwiftUI — só ProfileView (próprio) |
| **EditProfileSheet** | ❌ | Sem paridade SwiftUI |
| **MonthlyRecapSheet (poster canvas)** | ❌ | Sem paridade SwiftUI |
| **RecapCoverPickerSheet** | ❌ | Sem paridade SwiftUI |

**Veredito:** as 4 telas SwiftUI core (MyCircle, Detail, Celebration, Hub)
existem e renderizam, mas:
- **Calendar nunca mostra dias treinados** (bug crítico — feature visível)
- **~30% dos achievements ficam permanentemente trancados** mesmo pra users elegíveis
- **App nativo está só em PT-BR** (rejeição EN provável no review)
- **Bridge nunca é chamado pelo JS** (cap plugin existe mas wrapper nunca usado)

---

## 2. Inventário de paridade tela-a-tela

### 2.1 MyCircleSheet (web 838 linhas) ↔ MyCircleView (swift 327 linhas)

Estrutura web (A–H) | Nativo |
|-|-|
| A. Header com rings + avatar + chips | ✅ ActivityRingsView + chips streak/level |
| B. Resumo grid 2×3 | 🟡 6 cards mas com campos diferentes |
| C. Consistency rings (semana/mês/ano) | ✅ |
| D. Calendar mensal | ❌ Sem mini-fotos, sem navegação ← → |
| E. Níveis (4 chips) | ✅ |
| F. Badge highlight | ✅ |
| G. Monthly Challenges | ✅ Sprint 7.5.6 + 5.10 (Brasil) |
| H1. Recap CTA primário "Mês X" | 🟡 Botão sem mês dinâmico |
| H2. Recap CTA secundário "Outro período" | ❌ |
| Footer. Competição "Em breve" | ❌ |
| First-visit hint | ❌ |
| Privacy lock (user privado, sem follow) | ❌ |

#### Bugs específicos:
- **`SummaryCard`** swift faz "Conquistas / Total" — web faz "Posts / Streak restores". Decisão errada de tradução conceitual.
- **`calendarSection`** chama `CalendarBuilder.buildMonth(workoutDays: [])` no `loadMyCircle()` → grid sempre cinza
- **`recapCTASection`** texto fixo "Compartilhar resumo" — falta `monthlyRecap.shortMonthLabel`
- **Strings PT-BR hardcoded:** "Streak atual", "Maior streak", "Treinos no mês", "Dias no ano", "Conquistas", "Total", "Sua Consistência", "Semana", "Mês", "Ano", "Calendário do mês", "Níveis", "Conquistas", "Desafios do mês", "Compartilhar resumo", "Você escolhe a foto da capa"

### 2.2 AchievementDetailOverlay (web 473) ↔ AchievementDetailView (swift 325)

| Web | Nativo |
|-|-|
| Spotlight radial | ✅ |
| Artwork scale-spring | ✅ |
| Glow ring blur | ✅ |
| Eyebrow "VOCÊ DESBLOQUEOU" / "EM PROGRESSO" | ✅ |
| Label + descrição stagger | ✅ |
| Progress block (current/target + bar) | ✅ |
| Stats card (earnedAt + count + lastEarned) | ✅ |
| Raridade "Você é o primeiro" / "Apenas X%" | ✅ |
| **Locked state (Lock icon overlay)** | ❌ Não tem |
| **Como desbloquear (hint) bloco** | ❌ |
| **Share button (placeholder disabled)** | ❌ |
| **Spotlight transition fade-in** | 🟡 Quase — sem `requestAnimationFrame` |
| i18n strings | ❌ Hardcoded PT-BR |

#### Bugs:
- **Cor do spotlight no swift** está hardcoded `electricBlue` quando rarity é nil — web tem fallback diferente
- **`Achievement.isMysterySecret`** swift checa `secret && !earned` ✅ — paridade OK
- **Não fetch `globalStats`** quando achievement do model não tem rarity nominal (fallback web é mais robusto)

### 2.3 AchievementsSheet (web 427) ↔ AchievementsView (swift 267)

| Web | Nativo |
|-|-|
| Header + close | ✅ |
| Progress hero | ✅ |
| Tab chips (Tudo + 5 kinds) | ✅ 6 chips |
| **Tab "Secretos" dedicado** | 🟡 Web considera secretos como tab própria, swift usa filtro |
| Sub-seções: Conquistados / Próximos / Bloqueados | ✅ |
| Card 2-col grid | ✅ |
| Tap card → AchievementDetail | ✅ |
| Mystery secret = "???" + ? icon | ✅ |
| **Empty state com troféu cinza** | ✅ |
| **Privacy lock external user** | ❌ |
| i18n | ❌ Hardcoded |

#### Diferença sutil:
- Web "Bloqueados" inclui `secret + !earned`. Swift faz mesma lógica ✅

### 2.4 AchievementCelebrationOverlay (web 398) ↔ AchievementCelebrationView (swift 319)

| Web | Nativo |
|-|-|
| Backdrop + spotlight | ✅ |
| Particles canvas | ✅ (Canvas SwiftUI + TimelineView) |
| 5 intensidades por rarity | ✅ (35–200 particles, 3.5–6.5s) |
| Spring scale entry | ✅ |
| Stagger text animations | ✅ |
| Auto-dismiss | ✅ |
| Haptic per rarity | ✅ |
| Queue indicator "1 de 3" | ✅ |
| **Botão "Ver depois" (skipAll)** | ✅ |
| **markCelebrated DB** | ✅ |
| i18n strings ("VOCÊ DESBLOQUEOU") | ❌ Hardcoded |

**Status: melhor paridade do Sprint 8.** Aqui o nativo até supera o web em fluidez.

### 2.5 ProfileSheet (web 272) + ProfileScreen ↔ ProfileView (swift 141)

| Web | Nativo |
|-|-|
| **Versão "outro user"** (ProfileSheet) | ❌ Não existe SwiftUI |
| **Versão "próprio"** (ProfileScreen) | 🟡 ProfileView simplificado |
| Header com avatar + nome + bio | ✅ |
| Stats Streak / Maior / Posts | ✅ |
| FeaturedAchievements row 3 cards | ✅ Sprint 8.8 |
| **Paleta por kind** (relic purple, trophy cyan, medal gold) | ❌ Swift usa rarity (legendary gold, epic purple…) |
| Posts grid 3-col | ✅ |
| **Action row** (Follow / Message / Flag / Block) | ❌ |
| **LatestPostPreview** destaque | ❌ |
| **PrivateLockedNotice** | ❌ |
| **Edit profile button** | ❌ |

#### Bug visual significativo:
A web definiu **cores por categoria** (`KIND_TONE` em `FeaturedAchievementsRow.tsx`):
- relic → purple #A78BFA
- trophy → brand cyan
- medal → gold #FBBF24
- badge → white
- challenge → green #34D399

O swift `featuredCardBackground` usa `achievement.rarity` (legendary/epic/rare/uncommon/common). Resultado: **mesma conquista aparece com cor diferente entre web e iOS**.

---

## 3. Lacunas de dados (porque achievements ficam trancados)

### 3.1 `loadMyCircle()` em `GymCircleAppModel.swift:189-200`

```swift
let builderInput = AchievementBuilder.Input(
    postsCount: 0,              // ❌ HARDCODED — wire profile_posts count
    longestStreak: summary.stats.bestStreak,
    workoutsThisMonth: ...,
    workoutsThisWeek: ...,
    activeDaysCount: ...,
    followersCount: 0,          // ❌ HARDCODED — wire follows count
    hasUsedStreakRestore: false, // ❌ HARDCODED — wire lastStreakRestoreUsedAt
    createdAt: nil,              // ❌ HARDCODED — wire profile.createdAt
    monthlyChallenges: challenges
)
```

#### Achievements que NUNCA destrancam no nativo (mesmo elegíveis):
- `first-workout` (precisa `postsCount >= 1`)
- `workouts-50` (precisa `postsCount >= 50`)
- `prolific-100` (precisa `postsCount >= 100`)
- `friends-50` (precisa `followersCount >= 50`)
- `social-10` (precisa `followersCount >= 10`)
- `founder-2026` (precisa `createdAt` em 2026)
- `streak-recovered` (precisa `hasUsedStreakRestore = true`)

### 3.2 Calendar SEMPRE vazio

```swift
calendarDays: CalendarBuilder.buildMonth(
    workoutDays: [],            // ❌ Linha 222 — vetor vazio!
    todayKey: Self.todayKey()
)
```

Web busca `user.workoutDays` e `posts` do feed. Swift nunca busca essa lista.

#### O que falta wired:
- `MyCircleService.getWorkoutDays(userId:)` ou expandir `getSummary` pra incluir
- Fetch posts pra extrair `workout_date` (web faz no `buildMonthWorkoutDays`)

### 3.3 Profile nunca é carregado

```swift
// signOut() em :136
profile = nil

// loadDemoData() em :325
profile = demoProfile
```

Em produção, após login bem-sucedido, `profile` permanece `nil` → `displayName` cai em fallback `sessionStore.currentUserEmail ?? "Você"`. Avatar nunca aparece.

Falta: `loadProfile()` chamando RPC `get_user_profile` ou `profiles` table direto.

### 3.4 Achievements faltando vs web

Web tem **24 achievements + N challenges**. Swift tem **19 + N challenges**. Faltam 5:

| ID | Tipo | Por que falta |
|-|-|-|
| `cross-trainer` | secret badge | Precisa lógica de "3+ workout types em 7 dias" — não portada |
| `explorer` | secret badge | Precisa "5+ academias diferentes em 30 dias" — sem `gymId` no input |
| `active-week` | trophy | Workouts essa semana ≥ 5 — wire é fácil |
| `network-100` | medal | Followers ≥ 100 — depende fix §3.1 |
| `community-200` | medal | Followers ≥ 200 — depende fix §3.1 |

---

## 4. Plugin Bridge — wire incompleto

### 4.1 Lado nativo: ✅

`GymCircleNativeBridgePlugin.swift` expõe `isAvailable`, `presentMyCircleNative`,
`presentAchievementDetail`, `presentCelebration`, `presentAchievementsHub`.

### 4.2 Lado JS: 🟡 wrapper existe, **mas ninguém chama**

`apps/web/src/components/gym-circle/native/GymCircleNativeBridge.ts` exporta:

```typescript
const plugin = registerPlugin<GymCircleNativeBridgePlugin>(
  "GymCircleNativeBridge"
);
export async function presentMyCircleNative(...) { ... }
```

**Mas nenhum componente do app importa esse arquivo.** Não há call site
em `MyCircleSheet`, `ProfileScreen`, `GymCirclePreview`, etc. → o user
nunca vê a tela nativa.

#### Pra acender o bridge:
1. Em `GymCirclePreview.tsx` (ou onde MyCircleSheet abre), checar
   `isAvailable()` antes do `setMyCircleOpen(true)`. Se sim, chamar
   `presentMyCircleNative({ userId, isOwn })` em vez do sheet web.
2. Idem pros 3 outros métodos.
3. Fallback gracioso pra sheet web quando bridge não disponível
   (Capacitor não rodando, simulador, web build).

---

## 5. i18n — 100% PT-BR hardcoded

Web tem `t("myCircle.currentStreak")`, `t("achievementDetail.rarityPercent")`, etc.
SwiftUI tem strings literais. **Vai falhar review da App Store se o app
estiver listado pra EN** (Apple checa screenshots EN).

### Quick win: criar `Strings.swift` com enum `L10n.MyCircle.currentStreak`
respondendo via `NSLocalizedString(...)` + `Localizable.strings` PT/EN.

Strings que precisam virar i18n (lista non-exaustiva, encontrada em scan):

- MyCircleView: "Streak atual", "Maior streak", "Treinos no mês", "Dias no ano", "Conquistas", "Total", "Sua Consistência", "Semana", "Mês", "Ano", "Calendário do mês", "Níveis", "Desafios do mês", "Compartilhar resumo", "Você escolhe a foto da capa"
- AchievementDetailView: "VOCÊ DESBLOQUEOU", "EM PROGRESSO", "PROGRESSO", "Conquistado", "Total", "X vezes", "Última vez", "Ninguém conquistou esta ainda. Seja o primeiro!", "✦ Você é o primeiro a conquistar esta!", "Apenas X dos usuários possuem esta conquista.", "Comum", "Incomum", "Raro", "Épico", "Lendário"
- AchievementsView: "Hall da Fama", "X de Y conquistadas", "Tudo", "Badges", "Medalhas", "Troféus", "Relíquias", "Desafios", "Conquistados", "Próximos", "Bloqueados", "Descubra como desbloquear", "Nenhuma conquista nesta categoria ainda."
- AchievementCelebrationView: "VOCÊ DESBLOQUEOU", "Continuar", "Ver depois", "X DE Y"
- ProfileView: "CONQUISTAS EM DESTAQUE", "Streak", "Maior", "Posts", "Perfil indisponível"

---

## 6. Tabela de prioridade pra fechar paridade real

### 🔴 P0 — bloqueia App Store / quebra UX visível
| # | Item | Esforço | Arquivo |
|-|-|-|-|
| 1 | Wire `postsCount` + `followersCount` + `createdAt` + `hasUsedStreakRestore` em `loadMyCircle` | M | `GymCircleAppModel.swift:189` |
| 2 | Carregar `workoutDays` real → `CalendarBuilder.buildMonth` | M | `MyCircleService.swift` + `GymCircleAppModel.swift:222` |
| 3 | Implementar `loadProfile()` (avatar + displayName + createdAt) | M | `GymCircleAppModel.swift` (novo método) |
| 4 | i18n completo: `Localizable.strings` PT/EN + replace 60+ strings | M | Todas screens |
| 5 | JS wire-up: `GymCircleNativeBridge.ts` precisa ser chamado em `GymCirclePreview.tsx` (ou equivalente) | S | `apps/web/.../GymCirclePreview.tsx` |
| 6 | Calendar navegação `← →` chevron | S | `MyCircleComponents.swift` |
| 7 | Calendar mini-fotos (Sprint 5.2 paridade) | M | `MonthlyCalendarGridView` |

### 🟠 P1 — divergência visível mas não bloqueia review
| # | Item | Esforço |
|-|-|-|
| 8 | `FeaturedAchievementsRow` paleta **por kind** (não rarity) | S |
| 9 | Adicionar 5 achievements faltando (cross-trainer, explorer, active-week, network-100, community-200) | M |
| 10 | First-visit hint banner Sprint 7C.3 | M |
| 11 | Recap CTA mostrar `monthLabel` dinâmico + sub-CTA "Outro período" | S |
| 12 | Privacy lock pra outros users (`canSeeDetails`) | M |
| 13 | Competição placeholder "Em breve" | XS |
| 14 | AchievementDetail: locked state + Lock overlay icon | S |
| 15 | AchievementDetail: bloco "Como desbloquear" | S |

### 🟡 P2 — features ausentes mas não-críticas v1.1
| # | Item | Esforço |
|-|-|-|
| 16 | ProfileSheet (perfil de outros users) SwiftUI | L |
| 17 | EditProfileSheet SwiftUI | L |
| 18 | MonthlyRecapSheet (canvas poster + share) | L |
| 19 | RecapCoverPickerSheet | M |
| 20 | RecapPeriodPickerSheet | S |
| 21 | Cache LRU pra `getGlobalStats` (Sprint 8.11) | S |
| 22 | HealthKit integration (Sprint 8.13 roadmap) | L |

---

## 7. Sprint 8.11 sugerido — fechar P0

Em vez de pular pra Sprint 9 (TestFlight), proponho **Sprint 8.11 = P0 paridade**
antes do review:

1. **8.11.1** — `loadProfile()` + fix `loadMyCircle` inputs hardcoded (#1, #3)
2. **8.11.2** — `getWorkoutDays` no MyCircleService + wire calendar (#2)
3. **8.11.3** — Calendar UX (navegação + mini-fotos) (#6, #7)
4. **8.11.4** — JS wire-up Plugin Bridge no GymCirclePreview (#5)
5. **8.11.5** — i18n strings sweep (#4)

Estimativa: ~2-3 dias de implementação. Depois sim Sprint 9 (archive + upload).

---

## 8. O que está realmente funcionando bem

Pra não soar só negativo — coisas que ficaram excelentes:

- ✅ **Foundation Swift Package build limpo** com Supabase SPM
- ✅ **AchievementCelebrationView** com particles 60fps via Canvas/TimelineView é
  melhor que a versão web (canvas-confetti)
- ✅ **AchievementDetailView** spotlight radial + spring scale paridade ótima
- ✅ **`async let` paralelo** em `NativeAchievementDetailHost` pra fetch
  record + stats
- ✅ **Bridge plugin architecture** está sólida — só falta o consumer JS
- ✅ **SessionStore + AuthService actor** padrão Sendable Swift Concurrency
  exemplar
- ✅ **`fileprivate static func makeModel`** evita repetir env-var lookup
  em 4 hosts

---

## 9. Recomendação final

**Não recomendo submeter pro App Store ainda.** Os 7 itens P0 vão exigir
~2-3 dias mas o resultado vai ser:

- App nativo que **realmente mostra dados reais** (calendar, posts, follows)
- Achievements que **destrancam corretamente**
- App **funcional em EN** (cobertura review internacional)
- Plugin Bridge **acionado de fato** (não morto-code)

Sem essas correções, o user na 1ª abertura vai ver:
- Calendar 100% cinza
- "Treinos no mês: 0" mesmo com 15 treinos no app web
- "Você" em vez do nome real
- Todas as conquistas sociais trancadas

Cumpre o brief "deixar funcionando pro usuário"? Hoje só parcialmente.

---

## 10. Como verificar você mesmo

```bash
# Confirmar workoutDays vazio
grep -A1 "workoutDays:" ios-native/GymCircleNative/Sources/GymCircleNativeFoundation/App/GymCircleAppModel.swift

# Confirmar postsCount=0
grep -n "postsCount:" ios-native/GymCircleNative/Sources/GymCircleNativeFoundation/App/GymCircleAppModel.swift

# Confirmar bridge wrapper sem call sites
grep -rn "GymCircleNativeBridge\|presentMyCircleNative" apps/web/src/components/gym-circle/

# Confirmar strings hardcoded
grep -c '"' ios-native/GymCircleNative/Sources/GymCircleNativeFoundation/Screens/MyCircleView.swift
```

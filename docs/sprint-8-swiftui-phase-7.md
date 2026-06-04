# Sprint 8 v1.1 — SwiftUI Phase 7: MyCircle Premium + Profile + Achievement

Data: 2026-06-04
Status: 🟡 em andamento (8.0 audit + spec)

## Decisão estratégica

Sprint 8 ataca **Phase 7 do swiftui-migration-plan.md** primeiro (em vez de
seguir 2-3-4 em ordem). Razão: a Sprint 7.5 acabou de entregar 12 sub-fases
de gamification no web; o trabalho está fresco e a paridade nativa entrega
maior impacto visual (rings 60fps, particle effects nativos, HealthKit).

Auth + Feed + Stories + Chat continuam no Capacitor web durante esta sprint.
Migração dessas surfaces fica pra Sprint 8.x posterior.

### Estratégia: HÍBRIDA com Capacitor Plugin Bridge (decisão Sprint 8.1)

Em vez de manter dois apps paralelos (Capacitor + SwiftUI standalone) ou
migrar 100% antes de Sprint 9 TestFlight, adotamos arquitetura híbrida:

```
┌──────────────────────────────────────────────────────────────┐
│ Single iOS Bundle                                             │
│                                                               │
│  Capacitor + WKWebView          GymCircleNativeBridge        │
│  ├─ Auth                        (Capacitor Plugin Swift)     │
│  ├─ Feed                        │                            │
│  ├─ Stories                     ├─ presentMyCircleNative()   │
│  ├─ Chat                        ├─ presentAchievementDetail()│
│  ├─ Profile (web)               ├─ presentCelebration()      │
│  └─ MyCircle (web) ──── bridge ──┴─► UIHostingController     │
│                                       └─ SwiftUI Views       │
│                                          (Package Foundation)│
│                                                               │
│  Shared: Supabase Session (iOS Keychain — supabase-swift     │
│          e Capacitor Auth leem a mesma)                       │
│  Shared: HealthKit (apenas nativo acessa)                     │
└──────────────────────────────────────────────────────────────┘
```

**Feature flag** (`NEXT_PUBLIC_USE_NATIVE_MYCIRCLE`, etc) decide por
surface se abre via bridge nativo ou continua web. Rollback instantâneo.

**Phase 10 (Migration Plan original)** vira trivial: quando paridade
100%, remove plugin + Capacitor + WebView. SwiftUI nativo já está
standalone, só vira o app principal.

### Trade-offs aceitos

**Pros**:
- Incremental: Sprint 8 entrega MyCircle nativo em 2-3 commits, não 4-6 semanas
- Risco baixo: rollback via env flag, web continua funcionando
- A/B real possível em produção
- Web app desktop/admin continua

**Cons aceitos**:
- 2 codebases temporariamente (gerenciar duplicação)
- Bundle iOS +6MB (SwiftUI Package + plugin)
- Bridge calls ~30ms overhead vs render JS direto
- Estado cache pode dessincronizar (mitigation: Supabase fonte de verdade)

## Estado nativo no boot (Phase 1 — Sprint 3 v1.1 entregue)

| Surface | Estado |
|---|---|
| Foundation Package | ✅ `ios-native/GymCircleNative/` Swift Package iOS 16+ |
| Supabase SDK | ✅ supabase-swift 2.0+ |
| GymCircleAppModel | ✅ Phase 1 (auth + feed/stories/profile read-only) |
| Models existentes | ✅ FeedPost, StoryModels, UserProfile, MyCircleModels (parcial) |
| Screens existentes | ✅ Feed, Stories, Profile, MyCircle, Login, MainTab (todas read-only) |
| Components | ✅ ActivityRingsView, BaseComponents (GCCard, GCText, GCEmptyState) |
| Theme | ✅ `GymCircleTheme.ColorToken` (cyan, secondaryText, appBackground) |
| API | ✅ homeFeed, storyTray, storyViewerItems, profilePosts |

## Gap entre web Sprint 7.5 e nativo

O que falta migrar pra paridade Phase 7:

| Web (TS) | Nativo (SwiftUI) | Status |
|---|---|---|
| `Achievement` discriminated union | `Achievement` struct + enum AchievementKind | ❌ |
| 21+ achievements (5 categorias) | `getAllAchievements()` equivalente | ❌ |
| `MonthlyChallenge` system | `MonthlyChallenge` struct | ❌ |
| `featured_achievements` JSONB | `featuredAchievements: [String]` em UserProfile | ❌ |
| AchievementDetailOverlay | `AchievementDetailView` | ❌ |
| AchievementsSheet (Hall da Fama) | `AchievementsView` com tabs | ❌ |
| AchievementCelebrationOverlay | `AchievementCelebrationView` com particles | ❌ |
| MonthlyChallengesCard | `MonthlyChallengesCardView` | ❌ |
| FeaturedAchievementsRow (perfil) | `FeaturedAchievementsRowView` | ❌ |
| HealthKit foundation | `HKHealthStoreProvider` + permissões | ❌ |
| Motion polish (herda 7C.4) | `.symbolEffect(.bounce)` + transitions | ❌ |
| Backfill server-side | RPC já existe — só consumir do Swift | ✅ infra DB pronta |
| `get_achievement_global_stats` RPC | Swift call | ❌ |
| `celebrated_at` queries | Swift call | ❌ |

## Sub-fases planejadas

### 8.0 — Audit + spec + Models Foundation (este commit)

- Doc Sprint 8 (este arquivo)
- `Models/AchievementModels.swift` — Achievement struct + enums
- `Models/MonthlyChallengeModels.swift` — MonthlyChallenge struct
- Atualizar `Models/UserProfile.swift` — adicionar featuredAchievements
- Sem UI ainda

### 8.1 — Capacitor Plugin Bridge foundation (revised escopo)

**NOVO escopo** (estratégia híbrida confirmada em Sprint 8.1):

- `ios/App/App/Plugins/GymCircleNativeBridgePlugin.swift` — plugin Capacitor 8 com `@objc(...)` registration
  - `presentMyCircleNative(userId:)` — apresenta UIHostingController com MyCircleView SwiftUI
  - Stub methods para AchievementDetail, Celebration, Achievements (sub-fases futuras)
- `ios/App/App/Plugins/MyCircleHostingController.swift` — wrapper UIHostingController + dismissal handling
- `apps/web/src/native/GymCircleNativeBridge.ts` — TS wrapper via `registerPlugin`
- Feature flag wiring no GymCirclePreview pra escolher entre web sheet (default) vs bridge
- Doc passo-a-passo de adicionar Swift Package no Xcode (manual user step)

GymCircleAPI extension (queries Achievement/Challenge) moved pra **8.3**.

### 8.2 — Components reutilizáveis

- `Components/BadgeIconNativeView` — SF Symbol mapping por BadgeIconKey
- `Components/KindBadgeView` — chip pequeno colorido por AchievementKind
- `Components/RarityChipView` — chip nominal de raridade
- `Components/ProgressBarView` — barra fina reutilizável
- Theme expandido com cores por raridade

### 8.3 — AchievementDetailView

- Full-screen sheet Apple Fitness style
- BadgeIcon GIGANTE com `.symbolEffect(.bounce)` no aparecer
- Glow ring com `RadialGradient`
- Stats card (earnedAt, count, last_earned_at)
- Raridade % com precisão até 0,01% (reusa `formatRarityPercent` logic)
- Casos: earned / locked / secret_mystery / nobodyYet / onlyEarner

### 8.4 — AchievementCelebrationView (com particles nativos)

- Full-screen `.fullScreenCover`
- `Canvas` SwiftUI pra particles (alternativa a UIKit Emitter)
  - Particle count escalado por raridade (35 → 200)
  - Cores por raridade (cyan → gold)
- `.sensoryFeedback(.success)` (iOS 17+)
- Auto-dismiss timer + botão "Continuar"
- Queue UI: "1 de 3" + "Ver depois"

### 8.5 — AchievementsView (Hall da Fama)

- `NavigationStack` + `TabView` (ou segmented Picker) com 6 tabs:
  Tudo / Badges / Medalhas / Troféus / Relíquias / Desafios
- Sub-seções LazyVStack: Conquistados → Próximos → Bloqueados
- Cada card → push pra `AchievementDetailView`
- Pull-to-refresh

### 8.6 — MyCircleView upgrade

- Mantém ActivityRingsView no topo
- Adiciona seção F (badge highlight card único)
- Adiciona seção G (Monthly Challenges card com 4 desafios)
- Adiciona seção H (Monthly Recap CTA — placeholder por enquanto)
- Tap em qualquer achievement → AchievementDetailView ou AchievementsView

### 8.7 — ProfileView upgrade

- Adiciona FeaturedAchievementsRowView (top 3 priorizados)
- Tap → AchievementDetailView
- Identidade já existe — mantém

### 8.8 — HealthKit integration foundation

- `Services/HKHealthStoreProvider.swift`
- `requestAuthorization()` pra read workouts + active calories + duration
- `fetchWorkouts(from:to:) -> [HealthKitWorkoutData]`
- Async/await wrapper sobre HealthKit callbacks
- Info.plist: NSHealthShareUsageDescription
- Display: stats overlay condicional no MyCircle (se há permissão)

### 8.9 — Motion polish (herda 7C.4 absorvido)

- Badge unlock → confetti via Sprint 8.4 component
- Streak ignite → `.symbolEffect(.bounce, value: streak)` no flame icon
- Level up → animation transition entre StreakLevel chips
- First post → toast curto + confetti micro

### 8.10 — Smoke validation iPhone real

- Build no Xcode, abrir simulator + iPhone real
- Roteiro de validação completo
- Confirmar paridade Sprint 7.5 web ↔ nativo

## Decisões técnicas

### iOS 17 vs 16 features

- `.symbolEffect(.bounce)` — iOS 17+ (mantém deployment 17 ou conditional)
- `.sensoryFeedback(.success)` — iOS 17+
- `Canvas` particles — iOS 15+ ✅
- `RadialGradient` — iOS 13+ ✅

Decisão: subir deployment para iOS 17. Apple Stats: 90%+ iPhones em iOS 17+
em 2026. Trade-off mínimo.

### Reuso vs reescrita

- Models TS → Swift: paridade campo-a-campo, Codable maps via CodingKeys
- Logic derivacional (getAllAchievements, suggestFeatured) → reescrever em Swift
  porque é específico de UI. Sub-fase futura considera mover lógica pra RPC
  Postgres.
- API: chamada RPC direta via supabase-swift, ZERO refactor no DB

### Particle effects

- **SwiftUI Canvas** > UIKit CAEmitterLayer pela simplicidade
- Sub-fase 8.4 implementa AchievementCelebrationView.swift com Canvas
- Performance: 200 particles legendary roda 60fps em iPhone 12+

### HealthKit

- Opt-in com explicit prompt no Settings (sem auto-request no boot)
- Sprint 8.8 só foundation (auth + fetch). UI condicional do MonthlyRecap
  com stats fica pra sub-fase futura

## Compatibility Capacitor ↔ SwiftUI

Decisão de produto:
- Sprint 8 mantém web app COMPLETO. Sprint 8 só ADICIONA experiência nativa
  paralela no Swift Package.
- Phase 10 do migration plan (decisão de replace Capacitor) fica pra DEPOIS
  da Sprint 8.10 smoke validation.
- Sprint 9 (TestFlight) usa a versão que estiver mais estável (Capacitor ou
  SwiftUI nativo) — decisão tomada no fim da Sprint 8.

## Verificação por sub-fase

Após cada sub-fase 8.x:
1. **Regenerar xcodeproj** se adicionou/removeu arquivos:
   ```bash
   cd ios-native/GymCircleNative && xcodegen generate
   ```
   (XcodeGen via `project.yml` — necessário porque o `.xcodeproj` lista
   arquivos source explicitamente, e adicionar novo `.swift` não basta)
2. **Build pra iOS**:
   ```bash
   cd ios-native/GymCircleNative && \
     xcodebuild -scheme GymCircleNative \
     -destination "generic/platform=iOS" build
   ```
3. SwiftUI Preview em Xcode (manual visual)
4. Git commit + push (não merge)
5. Smoke iPhone só na 8.10

## Passo a passo: Adicionar Swift Package no Xcode (manual, Eduardo)

Sprint 8.1 introduz dependência do Swift Package
`ios-native/GymCircleNative/` no projeto Xcode principal `ios/App/App.xcodeproj`.
Esse step não é automatizável via CLI — precisa abrir Xcode.

**Quando fazer**: depois do commit Sprint 8.1, antes de tentar buildar
o app iOS pra testar o bridge.

**Passos**:

1. Abrir `ios/App/App.xcworkspace` no Xcode
2. Em File menu → Add Package Dependencies... (ou Add Files to "App"...)
3. Clicar no botão "Add Local..." (canto inferior esquerdo da janela)
4. Navegar até `ios-native/GymCircleNative/` (a pasta com `Package.swift`)
5. Selecionar a pasta e clicar Add Package
6. No diálogo "Choose Package Products":
   - Target App: marcar `GymCircleNativeFoundation` (library)
   - Clicar Add Package
7. Build (Cmd+B). Pode aparecer prompt pra confirmar Package Resolution
   — confirmar
8. Em `GymCircleNativeBridgePlugin.swift`, descomentar a linha:
   ```swift
   // import GymCircleNativeFoundation
   ```
   Vira:
   ```swift
   import GymCircleNativeFoundation
   ```
9. Build novamente (Cmd+B) — deve compilar limpo
10. Em `apps/web/.env.local` (ou Vercel env vars) adicionar:
    ```
    NEXT_PUBLIC_USE_NATIVE_MYCIRCLE=true
    ```
11. `npm run build && npx cap sync ios` no monorepo root
12. Run no simulator ou device — quando tocar nos rings, abre native
    placeholder em vez do web sheet

## Risk / mitigation

- **Symbol effects iOS 17**: deployment 17. Risk: bloqueia iOS 16. Mitigation: 90%+ usuários em 17+ em 2026.
- **HealthKit App Review risk**: requer usage description + categoria Health. Mitigation: NSHealthShareUsageDescription clara: "Enriquecer recap mensal".
- **Particle perf em iPhone antigo**: 200 particles podem dar drop em iPhone X. Mitigation: scalar configurável + fallback pra menos particles em devices low-end.
- **Symbol bounce em Canvas**: alguns layouts não suportam. Mitigation: testar em preview ANTES de commit.
- **Migration timeline**: Sprint 8 é gigante. Mitigation: 10 sub-fases granulares — cada commit funciona standalone.

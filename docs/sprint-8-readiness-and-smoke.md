# Sprint 8.10 — Smoke checklist + Ready for App Store

Data: 2026-06-06
Status: 🟢 pronto pra Sprint 9 TestFlight

Este doc fecha Sprint 8 (SwiftUI Migration Phase 7 híbrida) com:
1. Setup local pra rodar o app com bridge ativo
2. Smoke checklist iPhone real (passo a passo)
3. Critérios de aceite App Store (P0 itens cobertos)
4. Known limitations / próximos passos pra Sprint 8.11+

---

## 1. Setup local — 1ª vez

```bash
# Worktree fresh? Instale node_modules (Capacitor SPM lê de lá)
pnpm install
# OU: npm install   # se não tem pnpm

# Build web (gera apps/web/.next + dist)
pnpm --filter @gym-circle/web build
# OU: cd apps/web && npm run build

# Sync Capacitor (copia web build pra ios/App/App/public)
pnpm cap sync ios

# Abre Xcode
open ios/App/App.xcodeproj
```

### 1.1 Adicionar Foundation Swift Package (1 vez por máquina)

1. Em Xcode, `File → Add Package Dependencies…`
2. Click `Add Local…`
3. Navega até `<repo>/ios-native/GymCircleNative`
4. Adiciona ao target `App`
5. Product list: marca **`GymCircleNativeFoundation`**
6. Click `Add Package`

### 1.2 Env vars Supabase (Info.plist OU schema env)

No Xcode, edita o scheme `App` → `Run` → `Arguments` → `Environment Variables`:

```
NEXT_PUBLIC_SUPABASE_URL = https://<proj>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc…
```

Ou hardcode em `ios/App/App/Info.plist`:

```xml
<key>NEXT_PUBLIC_SUPABASE_URL</key>
<string>https://...</string>
<key>NEXT_PUBLIC_SUPABASE_ANON_KEY</key>
<string>eyJhbGc...</string>
```

Sem essas vars o bridge cai em modo demo (`GymCircleAppModel()` placeholder).

---

## 2. Smoke checklist — iPhone real

Roda em iPhone 12+ (iOS 16+ obrigatório pelo Foundation Package).

### A — Boot + Auth (Capacitor web, baseline)
- [ ] App abre, splash → tela de login
- [ ] Sign in com user real existente → dashboard
- [ ] Feed carrega (posts, autors, mídias)

### B — Bridge MyCircle nativo (Sprint 8.2 + 8.3)
- [ ] Botão MyCircle abre fullScreen SwiftUI (não web sheet)
- [ ] Header com avatar + nome do user logado
- [ ] 6 stats cards (Workouts mês/Streak/Maior/Total/Tipo+/Lugar+)
- [ ] Calendar grid 7-cols com today highlight + workout days
- [ ] Levels chips (Iniciante → Lendário) com level atual destacado
- [ ] Badge Highlight: 1 conquista com mais raridade
- [ ] Monthly Challenges (4 desafios temáticos Junho 2026 BR)
- [ ] Recap CTA botão funcional
- [ ] X fecha → volta pro web feed

### C — Bridge Achievement Detail (Sprint 8.5 + 8.9)
- [ ] Tap em badge highlight abre `presentAchievementDetail`
- [ ] Spotlight radial cor por rarity (gold/purple/cyan/green/white)
- [ ] Artwork scale-spring entry + glow ring blurred
- [ ] Eyebrow "VOCÊ DESBLOQUEOU" ou "EM PROGRESSO"
- [ ] Label + descrição com stagger animations (delays 0.2/0.3/0.4s)
- [ ] Progress block se !earned (current/target + bar)
- [ ] Stats card se earned (Conquistado / Total X vezes / Última vez)
- [ ] Rarity bloco: "Ninguém conquistou ainda" / "✦ Você é o primeiro" /
      "Apenas X.XX% dos usuários" / chip nominal
- [ ] Chevron-left fecha → volta pra MyCircle

### D — Bridge Celebration (Sprint 8.7 + 8.9)
- [ ] Após unlock de nova conquista, overlay celebration aparece
- [ ] Backdrop preto 72% + spotlight radial pela rarity color
- [ ] Particles burst Canvas SwiftUI (35 common → 200 legendary)
- [ ] Haptic dispara (selection common → notification.success legendary)
- [ ] "VOCÊ DESBLOQUEOU" → label → descrição com stagger
- [ ] Botão "Continuar" branco capsule
- [ ] Auto-dismiss (3.5s common → 6.5s legendary)
- [ ] Tap "Continuar" marca celebrated no DB (uncelebratedAchievementIds shrinks)

### E — Bridge Hall da Fama (Sprint 8.6 + 8.9)
- [ ] Tap "Ver todos" no MyCircle abre `presentAchievementsHub`
- [ ] Header "Hall da Fama" com close X
- [ ] Progress bar "X de Y conquistadas"
- [ ] 6 tabs scrollable (Tudo + Badges + Medalhas + Troféus + Relíquias + Desafios)
- [ ] Active tab azul electric com texto preto
- [ ] 3 sub-sections (Conquistados / Próximos / Bloqueados)
- [ ] Grid 2-col com card por achievement (icon + label + descrição + progress)
- [ ] Tap em achievement abre `AchievementDetailView` via `fullScreenCover`
- [ ] Secret achievements aparecem como `???` + lock icon

### F — ProfileView featured (Sprint 8.8)
- [ ] Profile screen mostra row "CONQUISTAS EM DESTAQUE"
- [ ] Até 3 cards horizontais
- [ ] Background color por rarity (legendary gold / epic purple / rare cyan / etc)
- [ ] Tap em card abre `AchievementDetailView`
- [ ] Empty state quando featuredAchievements vazio (sem row)

### G — Web ↔ Native parity sanity
- [ ] MyCircle web ainda funciona (fallback caso bridge falhe)
- [ ] Achievements web Hall da Fama ainda funciona
- [ ] Logout via web → re-login → MyCircle nativo refresh

### H — i18n
- [ ] Toggle EN ↔ PT-BR no Settings
- [ ] MyCircle native re-renderiza com strings traduzidas
  - "Treinos do mês" ↔ "Workouts this month"
  - "Sequência" ↔ "Streak"
  - "Hall da Fama" ↔ "Hall of Fame"

### I — Acessibilidade smoke
- [ ] VoiceOver lê labels dos rings/cards
- [ ] Dynamic Type respeitado (testa Settings → Larger Text)
- [ ] Touch targets ≥ 44pt (badges, chips, botões)

### J — Performance smoke
- [ ] MyCircle abre <500ms (perfil já hydrated do feed)
- [ ] Celebration particles 60fps em iPhone 12
- [ ] Hall da Fama scroll suave com 60+ achievements

---

## 3. Critérios de aceite — App Store P0

| Item | Status |
|------|--------|
| Aceite legal no signup (Sprint 7B) | ✅ |
| Privacy manifest (Sprint 7D) | ✅ |
| App Tracking Transparency | ✅ |
| Foundation Swift Package compila clean | ✅ (BUILD SUCCEEDED 2026-06-06) |
| Bridge plugin syntax check (swiftc -parse) | ✅ exit=0 |
| `force-dynamic` em pages que usam Supabase | ✅ (4 pages) |
| Web build Vercel verde | ⏳ verificar antes do TestFlight |
| iPhone smoke checklist completo (seções A-J) | ⏳ aguarda execução |
| HealthKit permissions (deferred) | 🟡 Sprint 8.11+ |

---

## 4. Known limitations + Sprint 8.11+ roadmap

### Funcionando agora
- ✅ MyCircle nativo completo com data real Supabase
- ✅ AchievementDetail + Celebration + Hall da Fama nativos
- ✅ ProfileView featured row
- ✅ Plugin Bridge 4 métodos (`presentMyCircleNative`, `presentAchievementDetail`,
  `presentCelebration`, `presentAchievementsHub`)
- ✅ Auth restoreSession Supabase Keychain compartilhada com web

### Limitações conscientes (não bloqueia App Store)
- ✅ `NativeAchievementDetailHost` busca `userRecord` + `globalStats` em
  paralelo (async let) via `model.fetchUserRecord` / `model.fetchGlobalStats`.
- 🟡 Cache LRU pros stats globais ficou pra Sprint 8.11. Por ora cada open
  do detail dispara 1 RPC fresh — aceitável (RPC cacheada server-side 60s).
- 🟡 HealthKit Sprint 5.6 roadmap doc continua deferred. Sprint 8.11 vai integrar
  `HKHealthStore` no Foundation Package pra paridade kcal/duração/BPM.
- 🟡 Stories + Feed + Chat seguem Capacitor web (decisão Phase 7 first).
  Sprint 8.12+ migra essas surfaces.

### Sprint 8.11 — Detail stats cache + featured persistence
1. LRU cache pra `getGlobalStats` (in-memory, TTL 5min) — evita refetch
2. `setFeaturedAchievements` UI no ProfileView (long-press card)
3. Test coverage `AchievementBuilderTests` (paridade `getAllAchievements` TS)

### Sprint 8.12 — Stories + Feed nativos
1. Avalia perf wins reais (Capacitor já 60fps)
2. Se decidir migrar: novo `StoriesView` SwiftUI + bridge `presentStoryReel(userId:)`
3. ProfileView grid de posts vira `LazyVGrid` com fetch direto

### Sprint 8.13 — HealthKit integration
1. `HealthKitService` no Foundation Package
2. Request authorization no first run
3. Hidrata stats card em `MyCircleView` com kcal/avgHR
4. Recap PNG canvas usa kcal real (não só workouts count)

---

## 5. Comandos úteis de verificação rápida

```bash
# Foundation Package build
cd ios-native/GymCircleNative
xcodegen generate
xcodebuild -project GymCircleNative.xcodeproj -scheme GymCircleNative \
  -destination 'generic/platform=iOS' build

# Bridge plugin syntax check
swiftc -parse ios/App/App/Plugins/GymCircleNativeBridgePlugin.swift

# Web build (precisa antes do cap sync)
pnpm --filter @gym-circle/web build

# Cap sync (copia web/dist + atualiza SPM)
pnpm cap sync ios

# iOS App build (precisa node_modules)
cd ios/App
xcodebuild -project App.xcodeproj -scheme App \
  -destination 'generic/platform=iOS Simulator,name=iPhone 15' build
```

---

## 6. Próximo passo: Sprint 9 — TestFlight + App Store submission

Após smoke A-J ✅:
1. Bump version `ios/App/App/Info.plist` CFBundleShortVersionString
2. Archive em Xcode (Generic iOS Device)
3. Upload via Organizer → App Store Connect
4. TestFlight internal testing 24h
5. Submit for review

Doc detalhado: `docs/sprint-9-testflight-roadmap.md` (criar próxima sprint).

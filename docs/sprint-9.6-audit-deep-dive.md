# Sprint 9.6 — Auditoria minuciosa pós Sprint 9.5

Data: 2026-06-07 (pós-Sprint 9.5)
Status: 🟡 **Estrutura completa funcional, mas vários gaps de fidelidade UX**

Auditoria deep-dive comparando cada tela web ↔ swift linha-a-linha,
verificando design tokens, animações, estados, acessibilidade,
side effects e features ausentes. Esta é a varredura mais detalhada
até aqui.

---

## 🔥 Ranking de gaps por severidade

### P0 — Bloqueia App Store ou quebra UX visível
1. **Acessibilidade ZERO no Swift** — 9 telas sem `.accessibilityLabel`, `.accessibilityHidden`, `.accessibilityAddTraits(.isModal)`. Bloqueia revisão Apple (HIG checklist).
2. **EditProfileSheet swift cobre só ~30% do web** — faltam 6 campos (username, birthDate, sports, instagram, mainGym, preferredTimes).
3. **MonthlyRecap sem Apple Fitness rings** — gap mais visível do poster.
4. **Calendar weekday hardcoded "S T Q Q S S D"** — quebra em EN (esperado: "M T W T F S S").
5. **Backdrop blur ausente no AchievementCelebrationView swift** — perde sensação Apple-fitness premium.

### P1 — Drift significativo de UX, feature parcial
6. **MonthlyRecapSheet swift sem BrandMark + tagline + hint text**.
7. **AchievementsView sem KindBadge chip + sem progress%** nos cards.
8. **Burst secundário + SparkleDecor ausentes** no Celebration (rarity ≥ epic).
9. **MonthlyChallengeRowView swift sem `tone` por difficulty** — todos azuis (web tem cyan/blue/purple/gold).
10. **PrivateLockedNotice latest-post-preview ausente** — OtherProfileView nativo não mostra "latest post" público pra perfil privado.

### P2 — Polish / drift visual menor
11. **RecapCoverPickerSheet swift como full-screen** (web é bottom-sheet 82dvh com grab handle).
12. **Spotlight color hardcoded no Detail** quando rarity nil (web tem fallback brand).
13. **Stats card layout divergente** (grid 2-col web vs VStack swift).
14. **Progress bar gradient 3-stop → 2-stop** swift.
15. **Haptic mapping divergente** (epic: web success, swift impactHeavy).

### P3 — Surfaces inteiras não migradas (decisão consciente Sprint 8 Phase 7-only)
16. CommentsBottomSheet, NotificationsSheet, FollowListOverlay, LikesOverlay
17. PostDetailOverlay, PostMenuSheet, EditPostSheet
18. AccountSettingsSheet, AdminPanelSheet
19. GymSearchSheet, UserSearchSheet
20. FeedScreen, ChatScreen, StoriesViews, CheckInScreen, PostScreen, StreakScreen

---

## 1. MyCircleSheet (838) ↔ MyCircleView (585)

### Features web ausentes/parciais no swift

| Feature | Web | Swift status |
|---------|-----|--------------|
| **simulateHaptic("brand")** em ← → calendar + tap em foto | L212, L222, L504 | ❌ Sem haptic em nenhuma interação do calendar |
| **AvatarConsistencyRings com `hasStory` ring** (story indicator azul/rosa) | L313 | ❌ ActivityRingsView swift não tem story ring |
| **Streak `lit` indicator** (chama animada quando treinou hoje) | L331-336 | ❌ Streak badge swift sempre estático |
| **Bestseller chip em level** (current ring + `· você está aqui`) | L572 | 🟡 Swift mostra `LevelChipView` mas sem sufixo "você está aqui" |
| **BadgeHighlightCard com 3 status** (Conquistado/Próximo/Bloqueado pill colorido) | L788-803 | 🟡 Swift mostra label/desc/icon, **sem status pill** |
| **Calendar weekday locale-aware** | L433-440 | ❌ Hardcoded `["S","T","Q","Q","S","S","D"]` (line 345) — quebra em EN |
| **Calendar mini-foto com `text-shadow: 0 1px 3px rgba(0,0,0,0.72)` no número** | L489 | ✅ Swift adicionou Sprint 8.13.1 — paridade |
| **Calendar today highlight ring com `ring-offset-2 ring-offset-[#101214]`** | L471 | 🟡 Swift usa stroke direto sem offset |
| **Calendar haptic on tap photo** | L504 (`simulateHaptic("brand")`) | ❌ |
| **Calendar `aria-label` por cell** ("Treinou dia X" / "Não treinou dia X") | L500, L517 | ❌ Sem accessibilityLabel |
| **MonthLabel locale-aware via Intl.DateTimeFormat** | L233 | ✅ Sprint 8.11.3 usa DateFormatter LLLL — paridade |
| **First-visit hint banner** | L295-308 | ✅ Sprint 8.12.5 — paridade |
| **Privacy notice card centralized** | L341-352 | ✅ Sprint 8.12.4 — paridade |
| **Recap sub-CTA "Outro período"** | L649-657 | ✅ Sprint 9.5.3 — paridade |
| **`ContextualHint markSeen` async callback** | L298-300, prop `onMarkContextualHintSeen` | ❌ Swift usa UserDefaults local — não persiste cross-device |
| **Tap em foto do calendar abre PostDetail** | L497-512 | ❌ `CalendarDay.postId` existe mas `MonthlyCalendarGridView` swift não tem `onTapDay` callback |

### Recomendação MyCircleView

- Adicionar haptic `UISelectionFeedbackGenerator` nos chevron ← → e tap em day
- Adicionar `accessibilityLabel` na cell ("Treinou em \(day.day) de \(monthLabel)")
- Locale-aware weekday: usar `Calendar.current.shortWeekdaySymbols` em vez de hardcoded
- Story ring overlay no avatar (hasStory: 2-pt rosa/azul gradient)
- StreakBadge `isLit` (flame animation quando treinou hoje)
- BadgeHighlightCard com status pill colorido
- Tap em foto do calendar → callback pra abrir PostDetail (via inverse bridge `openPost`)
- ContextualHint cross-device via DB (paridade Sprint 7C.1)

---

## 2. AchievementsSheet (427) ↔ AchievementsView (267)

### Features web ausentes no swift

1. **Hero `% indicator`** ao lado direito da progress bar ("25%") — web L172-174
2. **Hero gradient progress bar** `linear-gradient(90deg,#8CFBFF,#30D5FF,#0066FF)` com `transition-all duration-700 ease-out` — swift usa fill simples
3. **`KindBadge` chip pequeno** ao lado do label de cada card (8.5px uppercase: BADGE/MEDAL/TROPHY/RELIC/CHALLENGE com KIND_TONE) — web L351, L404-417
4. **`KIND_TONE` paleta colored**: medal=gold, trophy=brand, relic=purple, challenge=green — web L419-425
5. **Progress %** ao lado do progress current/target no card individual (`0/100  25%`) — web L362-378
6. **Aria-label rico** no card (`${label} — ${description}`) — web L307-311
7. **transition-[width] duration-500** no progress bar individual — web L383

### Recomendação AchievementsView

- Adicionar `%` indicator hero + gradient
- Adicionar `KindBadge` chip com `KIND_TONE` paleta
- Adicionar `progressPct%` ao lado do `current/target`
- `accessibilityLabel(achievement.label + " — " + achievement.description)`

---

## 3. AchievementDetailOverlay (473) ↔ AchievementDetailView (382)

### Critical
- **Haptic on mount ausente** — web `simulateHaptic("brand")` (L94). Swift NÃO dispara haptic. **Falta paridade**.
- **Acessibilidade zero** — sem `accessibilityAddTraits(.isModal)`, sem `accessibilityLabel` no close.

### Drift visual
- **Artwork scale entry**: web `scale 0.95 → 1.0` ease-out 500ms; swift `scale 0.5 → 1.0` spring 0.6/0.65 — drasticamente diferente.
- **Glow ring opacity**: web `bg-brand/24`; swift varia por rarity (feature extra).
- **Spotlight color**: swift tem feature extra de cor por rarity — web sempre brand.
- **Eyebrow text "VOCÊ DESBLOQUEOU"**: swift tem feature extra — web não.
- **Stats card layout**: web grid 2-col; swift VStack com Dividers.
- **Progress bar gradient**: web 3-stop `#8CFBFF→#30D5FF→#0066FF`; swift 2-stop.
- **Animation delays**: web 0/80/160ms; swift 200/300/400ms — sequência mais lenta.

### Recomendação AchievementDetailView
- Dispatchar `UISelectionFeedbackGenerator` on appear
- Adicionar acessibilidade modal + labels
- Reduzir delays pra 0/80/160ms (paridade)
- Decidir: manter eyebrow + spotlight-by-rarity como features Swift, OU remover pra paridade

---

## 4. AchievementCelebrationOverlay (398) ↔ AchievementCelebrationView (319)

### Critical
- **Backdrop SEM blur no swift** — web `bg-black/72 backdrop-blur-2xl`; swift só opacity 0.72. **Falta paridade premium**.
- **Burst secundário ausente** pra rarity ≥ epic (web faz 2 bursts laterais em x=0.2 e x=0.8 após 250ms — swift 1 burst único).
- **SparkleDecor (3 estrelas douradas) ausente** pra rarity ≥ epic.
- **Mapping haptic divergente**: epic: web=`success`, swift=`impactHeavy` (inconsistência).
- **Scalar partícula por rarity ausente** — web common 0.9 / legendary 1.2; swift sempre `6...14` random.

### Recomendação AchievementCelebrationView
- Adicionar `.background(.ultraThinMaterial)` no backdrop
- Implementar 2 bursts laterais via `DispatchQueue.main.asyncAfter(0.25)` × 2 com `originX: 0.2/0.8`
- Adicionar 3 sparkles SF Symbol `sparkle` nos cantos com `.opacity(animateIn ? 1 : 0)` + `.animation(.easeInOut(duration: 1.8).repeatForever())`
- Trocar epic haptic pra `notificationOccurred(.success)`
- Scalar particle size por rarity: common 0.7, legendary 1.4

---

## 5. ProfileSheet (272) ↔ OtherProfileView (318)

### Features web ausentes no swift

1. **PrivateLockedNotice mostra `latest post preview`** quando privado — paridade UX "público vê só último treino" — web L220-272.
2. **`getFollowCta` 4 estados** vs swift 3 estados — web tem `Clock3` icon pra `pending`, swift tem mas com label diferente.
3. **`isMe` check** — web esconde action row quando current user vê próprio perfil (L141-184). Swift OtherProfileView assume sempre não-self.

### Recomendação OtherProfileView
- Adicionar `latestPost` opcional no `PrivateLockedNotice` swift (já tem `latestPost: ProfilePost?` no init, mas só usa quando `canSeePosts`)
- Quando `!canSeePosts && latestPost != nil`: mostrar foto no notice
- Guard `isMe` antes de renderizar action row

---

## 6. EditProfileSheet (489) ↔ EditProfileSheet swift (326)

### Features web ausentes (MUITO grande)

1. **Username field** com validation `[a-z0-9_.]+` 3-32 chars
2. **BirthDate field** `<input type="date">` + `calculateAgeFromBirthDate`
3. **Sports CSV input** com `formatSportsInput`/`splitSportsInput` (max 140)
4. **Instagram username** com `normalizeInstagramUsername` + prefix `@`
5. **Main gym selector** + `GymSearchSheet` aninhado + `onCatalogPlace`
6. **Preferred times** chips multi-select (Manhã/Almoço/Tarde/Noite/Madrugada)
7. **Reset state quando `open` muda** (Swift mantém saveError entre aberturas)
8. **maxLength em cada field** (name 60, username 32, bio 200 — swift tem 240, divergente — , goal 60, instagram 30, sports 140)
9. **Avatar URL diff check** — só envia se mudou (`...(avatarUrl !== currentUser.avatarUrl ? { avatarUrl } : {})`)
10. **Trim com fallback null** pra distinção "vazio" vs "ausente"
11. **Avatar size 80 com badge câmera 44pt brand glow** — swift size 96 sem badge

### Recomendação EditProfileSheet
- Sprint 9.7 grande necessária pra cobrir os 6 campos
- Adicionar 5 chips PreferredTimes (UISwitch row OR FlowLayout chips)
- Adicionar BirthDate via `DatePicker`
- Username TextField + regex validation inline
- Diff check pré-update profiles
- maxLength via `.onChange(of: text) { newValue in ... }`

---

## 7. MonthlyRecapSheet (608) ↔ MonthlyRecapSheet swift (259) — **WORST RATIO 0.43**

### Features web ausentes (massivo)

1. **Apple Fitness 3-anéis (week/month/year)** no top-right do poster — web L174-179, L256-316
2. **BrandMark + tagline** bottom-left do poster com text-shadow — web L182-191
3. **Hero stat treatment** (mês label + workout count 44pt cyan + suffix "DIAS DE TREINO EM MAIO") — web L159-164
4. **Stat suffix line** ("MAIS TREINADO" / "LUGAR MAIS") em cima do value — web L165-172
5. **Hint text abaixo do poster** ("dica de compartilhamento") — web L101-103
6. **Header com eyebrow "VOCÊ FECHOU" + título 19px** — web L73-78
7. **Sharing loading state** ("Gerando...") no botão — web L114-116
8. **Download button separate circle** + Share2 button capsule — web L107-126
9. **Web Share API com fallback download anchor** — web L42-61
10. **Canvas drawing 1080×1350** (com texto, anéis, badge user) — web L322-545
11. **Camera icon no botão "Trocar foto"** com text — web L97
12. **PosterStatStack com isHero flag** (44px brand color + 26pt label + 11pt suffix) — web L207-247

### Recomendação MonthlyRecapSheet
- **Sprint 9.7.5 grande**: portar RecapRings SwiftUI (Path arc), PosterStatStack com isHero, BrandMark, hint text, sharing loading state, download separate button
- **Canvas drawing**: já é nativo via ImageRenderer (1080×1350 OK)

---

## 8. RecapCoverPickerSheet (233) ↔ RecapCoverPickerSheet swift (166)

### Features web ausentes

1. **"Usar foto automática"** botão (callback `onSelect(null)`) — Swift API só aceita String
2. **Filter `mediaType === "image"`** + sort desc by createdAt — Swift recebe lista pronta
3. **Saving inline state** por célula (overlay "Salvando...") — Swift sem feedback
4. **Error inline pill pink** quando onSelect rejeita
5. **Bloqueio outros taps** durante save
6. **Auto-close pós-save** — Swift exige tap separado no confirmBar (UX extra)
7. **Bottom sheet styling** com grab handle + rounded-t-32px + slide-up 300ms — Swift é full-screen

### Recomendação RecapCoverPickerSheet
- Refactor callback pra `(String?)` (aceitar nil)
- Adicionar botão "Foto automática" no topo do grid
- Auto-close after onSelect success (remove confirmBar)
- Adopt bottom sheet via `presentationDetents([.medium, .large])` iOS 16+

---

## 9. MonthlyChallengesCard (180) ↔ MonthlyChallengeRowView swift (~100)

### Features web ausentes no swift

1. **`DIFFICULTY_TONE` paleta colored** — easy=cyan #22D3EE, medium=brand, hard=purple #A78BFA, legendary=gold #FBBF24 — web L156-179
2. **Completed background tone-specific** (`bg-[color]/8 border-[color]/16`) — web L156-178
3. **Icon background colored quando completed** (`bg-[color]/20`) — web L158, 165, 172, 178
4. **Progress bar com cor por difficulty** — web L160, 166, 173, 178
5. **Difficulty chip** dentro do card com `tone.chip` (uppercase, 9.5px tracking 0.04em) — web L104-111

### Status swift atual
- `difficultyTone` private var existe — verificar se é mapeado corretamente
- `difficultyChip` view existe (linha 220) — verificar paridade visual

### Recomendação
- Audit detalhado de `MonthlyChallengeRowView.difficultyTone` para garantir 4 cores corretas (easy cyan / medium brand / hard purple / legendary gold)

---

## 10. Design tokens — drift global

### Cores
| Token | Web | Swift |
|-------|-----|-------|
| brand cyan | `var(--gc-brand)` ≈ `#30D5FF` | `GymCircleTheme.ColorToken.electricBlue` (RGB 0.19,0.84,1.0) ✅ |
| consistency-week | `var(--gc-consistency-daily)` | `cyan` ✅ |
| consistency-month | `var(--gc-consistency-month)` | `electricBlue` ✅ |
| consistency-year | `var(--gc-consistency-year)` | `deepBlue` ✅ |
| rarity legendary | `#FBBF24` gold | RGB 0.98,0.75,0.14 ≈ `#FAC024` 🟡 drift |
| rarity epic | `#A78BFA` purple | RGB 0.66,0.55,0.98 ≈ `#A78CFA` ✅ |
| rarity rare | brand | electricBlue ✅ |
| rarity uncommon | `#34D399` green | RGB 0.20,0.83,0.60 ≈ `#33D499` ✅ |

### Tipografia
- Web: `font-black` (900), `font-bold` (700), `font-semibold` (600)
- Swift: `.black`, `.heavy`, `.bold`, `.semibold` ✅

### Border radius
- Web: 10/12/14/16/18/20/24/32/36px patterns
- Swift: `RoundedRectangle(cornerRadius:)` valores correspondem ✅

### Shadows
- Web: `0_24px_72px_rgba(0,0,0,0.6)` heavy modal shadow ✅
- Swift: `.shadow(color: .black.opacity(0.5), radius: 12)` 🟡 levemente mais leve

---

## 11. Estados (loading/empty/error)

### Loading states
- Web: `Sharing`, `Saving`, `Uploading`, `SavingAuto`, `SavingPostId` — múltiplos
- Swift: tem `isSaving`, `isUploadingAvatar` — **faltam savePerCellState no CoverPicker**

### Empty states
- Web: textos em todos os sheets (RecapCoverPicker, AchievementsSheet) — ✅ swift cobre

### Error states
- Web: pill pink inline em ProfileSheet/RecapCoverPicker — ❌ swift só tem `Text(error)` plain
- Web: try-catch + i18n `errors.generateImage` em RecapShare — ❌ swift sem mensagens granulares

---

## 12. Acessibilidade — gap crítico

**Swift está com 0 modifiers de acessibilidade em TODAS as telas.** Apple HIG requer:

- `.accessibilityLabel("Conquistou \(label) em \(date)")` em buttons
- `.accessibilityAddTraits(.isModal)` em fullScreenCover
- `.accessibilityHidden(true)` em decorativos
- `.accessibilityValue("\(progress.current) de \(progress.target)")` em progress bars
- `.accessibilityElement(children: .combine)` agrupar form fields

**Action item Sprint 9.7**: sweep de a11y em todas as 9 telas. Critical pra App Store HIG check.

---

## 13. Haptics

| Local | Web | Swift |
|-------|-----|-------|
| Calendar ← → | `simulateHaptic("brand")` | ❌ |
| Calendar day tap photo | `simulateHaptic("brand")` | ❌ |
| AchievementDetail mount | `simulateHaptic("brand")` | ❌ |
| AchievementCelebration mount | ✅ por rarity | ✅ por rarity (mapping divergente epic) |
| Pull-to-refresh, button taps | ⚪ não tem | ⚪ não tem |

**Recomendação Sprint 9.7**: `UISelectionFeedbackGenerator` em todos os taps + `UIImpactFeedbackGenerator(style: .light)` em interactive gestures.

---

## 14. Side effects

### Web tem, swift não tem
- **Analytics** — Web não usa, swift também não. Paridade neutra.
- **Perf marks** — Web `markPerf/measurePerf` em openProfile, openMyCircle. Swift sem.
- **ContextualHint markSeen** cross-device — Web async via DB, swift local UserDefaults
- **Avatar URL diff check** — só PATCH se mudou. Swift sempre envia.

### Cleanup
- Web `useEffect return cleanup` + cancellation flags — Swift task se beneficia de SwiftUI lifecycle, mas em alguns hosts não tem cleanup explícito de `notifyListeners`

---

## 15. Estratégia Sprint 9.6/9.7 sugerida

**Sprint 9.6 — A11y + haptics + paleta drift** (~4h)
- 9.6.1: Sweep `.accessibilityLabel` em todas 9 telas (1h)
- 9.6.2: Haptics `UISelectionFeedbackGenerator` em 8 pontos (1h)
- 9.6.3: Fix legendary gold color drift (RGB exato)
- 9.6.4: Calendar weekday locale-aware via `Calendar.current.shortWeekdaySymbols` (15min)
- 9.6.5: Backdrop blur `.ultraThinMaterial` no AchievementCelebrationView (30min)
- 9.6.6: BadgeHighlightCard status pill colorido (30min)

**Sprint 9.7 — UX parity grande** (~8h)
- 9.7.1: EditProfileSheet 6 campos faltando (3h)
- 9.7.2: MonthlyRecapSheet RecapRings + BrandMark + hero stat + suffix + hint (3h)
- 9.7.3: AchievementsView KindBadge + progress% + hero gradient (1h)
- 9.7.4: MonthlyChallengeRowView difficulty tones (30min)
- 9.7.5: RecapCoverPickerSheet auto-pick + sheet style + inline saving (30min)

**Sprint 9.8 — Polish final** (~3h)
- 9.8.1: AchievementCelebrationView burst secundário + sparkle decor pra rarity ≥ epic
- 9.8.2: AchievementDetailView haptic on mount + reduzir delays animation
- 9.8.3: Story ring overlay no avatar com hasStory flag
- 9.8.4: StreakBadge isLit animation (flame anim)
- 9.8.5: OtherProfileView latestPost na PrivateLockedNotice

**Total estimado**: ~15h pra paridade COMPLETA (vs ~75% atual).

---

## 16. Surfaces não migradas (escopo Phase 7 only)

Pra v1.1 essas continuam web (decisão Sprint 8.0). Pra v1.2 considerar:

| Surface | Linhas web | Prioridade migração |
|---------|------------|--------------------|
| CommentsBottomSheet | ~350 | P2 |
| NotificationsSheet | ~280 | P2 |
| FollowListOverlay | ~200 | P3 |
| LikesOverlay | ~150 | P3 |
| PostDetailOverlay | ~600 | P1 (alta interação) |
| PostMenuSheet | ~180 | P3 |
| EditPostSheet | ~400 | P2 |
| AccountSettingsSheet | ~500 | P2 |
| AdminPanelSheet | ~700 | P3 |
| GymSearchSheet | ~350 | P2 (já necessário pra EditProfile mainGym) |
| UserSearchSheet | ~280 | P3 |
| FeedScreen | ~1200 | P1 (tela principal) |
| ChatScreen | ~800 | P2 |
| StoriesViews | ~600 | P1 (alta visibilidade) |
| CheckInScreen | ~500 | P2 |

---

## 17. Comandos pra você verificar

```bash
# Confirmar weekdays hardcoded
grep -n 'weekdaysShort = \\[' ios-native/GymCircleNative/Sources/GymCircleNativeFoundation/Components/MyCircleComponents.swift

# Confirmar a11y zero
grep -c "accessibilityLabel\\|accessibilityHidden\\|accessibilityAddTraits" \\
  ios-native/GymCircleNative/Sources/GymCircleNativeFoundation/Screens/*.swift
# (esperado: 0 = problema, ou só algumas linhas)

# Confirmar haptic só em Celebration
grep -rn "UISelectionFeedbackGenerator\\|UIImpactFeedbackGenerator\\|UINotificationFeedbackGenerator" \\
  ios-native/GymCircleNative/Sources/GymCircleNativeFoundation/Screens/
# (esperado: apenas AchievementCelebrationView.swift)

# Color drift legendary
grep -n "0.98, green: 0.75, blue: 0.14" ios-native/GymCircleNative/Sources/GymCircleNativeFoundation/
# (FBBF24 = 251/30, 191/255, 36/255 = 0.984, 0.749, 0.141 — drift é 0.001)
```

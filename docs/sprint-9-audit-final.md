# Sprint 9 — Auditoria final pós Sprint 8.11–8.13 + 9.1–9.4

Data: 2026-06-07 (pós Sprint 9.4)
Status: 🟢 **Gamification SwiftUI 100% paridade** · 🟡 **3 gaps de wiring** · ⏳ **Apple Developer setup pendente**

Este doc roda a auditoria completa de novo após 22 sub-fases entregues
(Sprint 8.11 → 9.4). Foco em **o que ainda está aberto** e **diferenças
restantes** entre web e nativo.

---

## 1. Status geral — onde estamos

| Dimensão | Status | Mudança vs auditoria original |
|----------|--------|--------------------------------|
| Telas SwiftUI Phase 7 | ✅ 9/9 | era 4/9 |
| Achievements no nativo | ✅ 24/24 | era 19/24 |
| L10n PT/EN keys | ✅ 100+ | era 0 (tudo hardcoded) |
| Bridge methods (Plugin Swift) | ✅ 7/7 | era 4/4 (mas só 1 wirado) |
| Bridge methods wirados no JS | 🟡 **4/7** | era 1/4 |
| Calendar workoutDays reais | ✅ | era `[]` hardcoded |
| Profile carregado | ✅ | era nunca |
| 4 inputs hardcoded no AchievementBuilder | ✅ wirados | eram 0/false/nil |
| Calendar mini-fotos | ✅ | era ausente |
| Calendar navegação ← → | ✅ | era estático |
| Avatar upload | ✅ | era "coming soon" |
| Version bump | ✅ 1.1.0 (5) | era 1.0 (4) |

---

## 2. Inventário paralelo (web ↔ swift)

### 2.1 Phase 7 surfaces (escopo principal Sprint 8)

| Web | Swift | Bridge JS call site | Status |
|-----|-------|---------------------|--------|
| `MyCircleSheet.tsx` | `MyCircleView.swift` | ✅ `presentMyCircleNative` em `GymCirclePreview.tsx:397` | ✅ funcionando |
| `AchievementDetailOverlay.tsx` | `AchievementDetailView.swift` | ✅ `presentAchievementDetail` em `:428` | ✅ |
| `AchievementsSheet.tsx` | `AchievementsView.swift` | ✅ `presentAchievementsHub` em `:454` | ✅ |
| `AchievementCelebrationOverlay.tsx` | `AchievementCelebrationView.swift` | ✅ `presentCelebration` em `:1080` (useEffect queue) | ✅ |
| `ProfileSheet.tsx` (outros users) | `OtherProfileView.swift` | ❌ **`presentOtherProfile` declarado mas SEM call site JS** | 🔴 P0 wiring |
| `EditProfileSheet.tsx` | `EditProfileSheet.swift` | ❌ **`presentEditProfile` declarado mas SEM call site JS** | 🔴 P0 wiring |
| `MonthlyRecapSheet.tsx` | `MonthlyRecapSheet.swift` | ❌ **`presentMonthlyRecap` declarado mas SEM call site JS** | 🔴 P0 wiring |
| `RecapCoverPickerSheet.tsx` | `RecapCoverPickerSheet.swift` | Bridge via `NativeMonthlyRecapHost.fullScreenCover` (interno) | ✅ wirado interno |
| `RecapPeriodPickerSheet.tsx` | `RecapPeriodPickerSheet.swift` | ⚠️ **NÃO wirado em lugar nenhum** (nem JS nem Swift host) | 🟠 P1 wiring |

### 2.2 Não-Phase 7 (Capacitor web fica)

| Web | Decisão |
|-----|---------|
| ChatScreen, FeedScreen, StoriesViews, PostScreen, CheckInScreen, StreakScreen | Não migrado (decisão Sprint 8.0 — Phase 7 only) |
| AccountSettingsSheet, AdminPanelSheet, EditPostSheet | Não migrado (escopo Phase 8+) |
| FollowListOverlay, LikesOverlay, NotificationsSheet | Não migrado |
| PostDetailOverlay, PostMenuSheet, GymSearchSheet, UserSearchSheet | Não migrado |
| CommentsBottomSheet, MentionText, ConfirmSheet | Não migrado |
| TopBar, BottomNav, LoginView (Capacitor flow) | Não migrado |

---

## 3. Gaps abertos por prioridade

### 🔴 P0 — wiring que impede features chegarem ao user

**P0.1 — 3 bridge methods declarados sem call site JS**

`presentOtherProfile`, `presentEditProfile`, `presentMonthlyRecap` existem
no plugin Swift (Sprint 9.1) e estão registrados no Capacitor. O wrapper
TS existe em `GymCircleNativeBridge.ts`. **Mas o JS web app nunca chama
esses métodos.**

Resultado prático: clicar pra abrir perfil de outro user, editar perfil,
ou ver Monthly Recap continua abrindo a versão **web overlay** mesmo com
flag `NEXT_PUBLIC_USE_NATIVE_MYCIRCLE=true` ativada.

**Onde wirar** (`apps/web/src/components/gym-circle/GymCirclePreview.tsx`):
- `setProfileOpenId(userId)` (linha ~382) → wrapper `openOtherProfileHybrid`
  que tenta `presentOtherProfile({ targetUserId, currentUserId })` antes
  do fallback web
- Botão "Editar perfil" em `ProfileScreen.tsx` → wrapper `openEditProfileHybrid`
- `setMonthlyRecapOpen(true)` (do MyCircle CTA) → wrapper que tenta
  `presentMonthlyRecap({ userId, monthKey })`

**P0.2 — NativeMyCircleHost callbacks vazios**

Em `GymCircleNativeBridgePlugin.swift:296-303` os 3 callbacks da MyCircleView
nativa estão como stubs:

```swift
onTapBadgeHighlight: {
    // Sprint 8.5 — aqui chama presentAchievementsHub
},
onTapChallenge: { _ in
    // Sprint 8.4 — aqui chama presentAchievementDetail
},
onTapRecap: {
    // Sprint 8.x — aqui chama presentRecapNative
},
```

Resultado: user dentro do MyCircle nativo clica no Badge Highlight,
Monthly Challenge ou Recap CTA — **nada acontece**.

**Fix**: Cada callback deve chamar a próxima função `make*HostingController`
e apresentá-la em cima do viewController atual. Padrão (~30 linhas):

```swift
onTapBadgeHighlight: { [weak viewController = self.bridge?.viewController] in
    guard let vc = viewController else { return }
    let host = makeAchievementsHubHostingController(
        userId: userId,
        onDismiss: { [weak vc] in vc?.presentedViewController?.dismiss(animated: true) }
    )
    vc.presentedViewController?.present(host, animated: true)
}
```

### 🟠 P1 — features visíveis incompletas

**P1.1 — `RecapPeriodPickerSheet` órfã**

A tela existe (`RecapPeriodPickerSheet.swift`, 210 linhas) mas nenhum
host abre ela. No web é abertura pelo sub-CTA "Outro período" da seção H
do MyCircleSheet. No nativo o sub-CTA nem está renderizado.

**Fix**: Adicionar botão `myCircleOutroPeriodo` no `recapCTASection` do
MyCircleView + callback `onTapPickPeriod`. NativeMyCircleHost apresenta
`RecapPeriodPickerSheet` via fullScreenCover. Tap seleciona período →
abre `MonthlyRecapSheet` com `monthKey` correto.

**P1.2 — OtherProfileView actions são stubs**

`NativeOtherProfileHost` passa closures vazias pros 4 buttons:

```swift
onToggleFollow: {  // Sprint 9.2+: wire FollowsService.toggle aqui.  },
onMessage: { /* Sprint 9.x: deep-link pro web chat */ },
onReport: { /* Sprint 9.x */ },
onBlock: { /* Sprint 9.x */ },
onOpenPost: { _ in /* Sprint 9.x: deep-link pro web post detail */ },
```

Resultado: user vê perfil mas não consegue interagir.

**Fix**: Criar `FollowsService.swift` (paralela ao MyCircleService) com
`follow(userId)` / `unfollow(userId)` / `getFollowState(userId)`. Pro
chat/report/block/post, expor um Capacitor bridge inverso (Swift →
WKWebView postMessage com action).

**P1.3 — MonthlyRecap stats incompletos**

`GymCircleAppModel.buildMonthlyRecap:510-512`:

```swift
bestStreak: 0,        // Sprint 9.x+: computar best streak do mês específico
topWorkoutType: nil,  // Sprint 9.x+: GROUP BY workout_type ORDER BY count DESC
topGymName: nil       // Sprint 9.x+: join gyms table + group
```

Resultado: poster mostra "Treinos: X" mas os outros 3 cards aparecem
incompletos ou somem.

**Fix**: 3 novas RPCs ou queries no `MyCircleService`:
- `bestStreakInMonth(userId, monthKey)` — janela deslizante de consecutive days
- `topWorkoutType(userId, monthKey)` — `select workout_type, count(*) group by workout_type order by 2 desc limit 1`
- `topGym(userId, monthKey)` — idem com `gym_id` + join `gyms.name`

### 🟡 P2 — qualidade/robustez

**P2.1 — `setMonthlyRecapCover` race condition**

`ProfilesService.swift:52` flag de "RPC server-side seria mais robusto
pra concorrência". Read-merge-write atual pode perder updates se 2
escritas chegam concorrentes.

**Fix futuro**: nova migration `monthly_recap_cover_set(month_key, post_id)`
RPC com `UPDATE ... SET monthly_recap_covers = jsonb_set(...)` atômico.

**P2.2 — Avatar upload sem crop UI**

PhotosPicker padrão entrega imagem original. Downsample faz 512×512
square por scaling, **não crop**. Se user passa foto landscape, vai
ficar esticada/distorcida.

**Fix futuro**: Vision framework `VNDetectFaceRectanglesRequest` pra
square crop centrado no rosto, OU tela de crop manual antes do upload.

**P2.3 — EditProfile sem inline validation de username**

Username é obrigatório `[a-z0-9_.]+` 3-32 chars (constraint DB). UI
swift aceita qualquer string e só falha no save. Mensagem do erro
não traduz "violates check constraint".

**Fix futuro**: Sprint 9.5+ — Regex check inline + char counter +
disable Save até válido.

**P2.4 — LoginView strings hardcoded**

`LoginView.swift:20-21`:
```swift
GCText("Gym Circle", style: .title)
GCText("Train together", style: .caption, ...)
```

"Gym Circle" = nome do produto (não traduz). "Train together" deveria
ir pra L10n. Cosmético, baixo impacto.

---

## 4. Comparação com auditoria original

### 4.1 P0 antes (auditoria inicial) → agora

| Item P0 original | Status agora |
|------------------|--------------|
| Calendar `workoutDays: []` hardcoded | ✅ wirado Sprint 8.11.2 |
| `postsCount: 0` hardcoded | ✅ Sprint 8.11.1 |
| `followersCount: 0` hardcoded | ✅ Sprint 8.11.1 |
| `createdAt: nil` hardcoded | ✅ Sprint 8.11.1 |
| `hasUsedStreakRestore: false` hardcoded | ✅ Sprint 8.11.1 |
| `profile` nunca carregado | ✅ `loadProfile()` Sprint 8.11.1 |
| i18n 100% PT hardcoded | ✅ L10n PT/EN Sprint 8.11.5 |
| 3 dos 4 bridge methods sem JS call site | ✅ wirados Sprint 8.11.4 + 8.13.3 |
| Calendar sem ← → | ✅ Sprint 8.11.3 |

### 4.2 P1 antes → agora

| Item P1 original | Status agora |
|------------------|--------------|
| 5 achievements faltando | ✅ todos Sprint 8.12.1 + 8.13.2 |
| Paleta featured divergente (rarity vs kind) | ✅ kind-based Sprint 8.12.1 |
| First-visit hint banner ausente | ✅ Sprint 8.12.5 |
| Recap monthLabel estático | ✅ dinâmico Sprint 8.12.3 |
| Privacy lock ausente | ✅ Sprint 8.12.4 |
| Competição "Em breve" ausente | ✅ Sprint 8.12.3 |
| AchievementDetail locked state | ✅ Sprint 8.12.2 |
| AchievementDetail "Como desbloquear" | ✅ Sprint 8.12.2 |

### 4.3 P2 antes → agora

| Item P2 original | Status agora |
|------------------|--------------|
| Calendar mini-fotos | ✅ Sprint 8.13.1 |
| Celebration bridge JS wire | ✅ Sprint 8.13.3 |
| ProfileSheet outros users SwiftUI | ✅ tela existe Sprint 8.13.6 (**mas falta JS call site — P0.1 agora**) |
| EditProfileSheet SwiftUI | ✅ tela existe Sprint 8.13.7 (**mas falta JS call site — P0.1 agora**) |
| MonthlyRecapSheet canvas | ✅ tela existe Sprint 8.13.8 (**mas falta JS call site — P0.1 agora**) |
| RecapCoverPickerSheet | ✅ Sprint 8.13.5 (wirado interno via NativeMonthlyRecapHost) |
| RecapPeriodPickerSheet | ✅ tela existe Sprint 8.13.4 (**órfã — P1.1**) |
| LRU cache `getGlobalStats` | 🟡 não feito |
| HealthKit integration | 🟡 não feito |

---

## 5. Novos gaps descobertos nesta auditoria

| Gap | Descoberto onde | Sprint sugerido |
|-----|----------------|-----------------|
| 3 bridge methods sem JS call site | `GymCirclePreview.tsx` busca | Sprint 9.5.1 |
| NativeMyCircleHost callbacks vazios | `GymCircleNativeBridgePlugin.swift:296-303` | Sprint 9.5.2 |
| RecapPeriodPickerSheet órfã | grep wide | Sprint 9.5.3 |
| OtherProfileView Follow/Msg/etc. stubs | bridge plugin | Sprint 9.5.4 |
| MonthlyRecap 3 stats faltando | AppModel TODO comments | Sprint 9.5.5 |

---

## 6. Recomendação final

**Status pra TestFlight beta interno**: 🟢 **OK pra subir build 1.1.0 (5)**
mesmo com os gaps acima.

Razão: MyCircle + AchievementDetail + Hall da Fama + Celebration funcionam
end-to-end (5 das 9 surfaces). Esses são os "feature stars" do Sprint 8 e
o que o user mais vai tocar.

OtherProfile/EditProfile/MonthlyRecap nativos: shells prontos mas web continua
servindo. User pode editar perfil (web) e ver recap (web) — sem regressão.

**Estratégia de release**:

1. **Build 1.1.0 (5)** — submeter agora pra TestFlight com 4 telas nativas
   funcionando + 5 telas web fallback transparente. Testers validam UX.
2. **Build 1.1.0 (6)** — incremental com Sprint 9.5 fechando os 5 gaps
   descobertos acima. ~1-2 dias de implementação. Sem precisar de nova review
   App Store (TF accepts builds da mesma versão).
3. **App Store release** — após smoke TestFlight passar nas 2 builds.

---

## 7. Sprint 9.5 — sugestão pra fechar tudo

5 sub-fases pra zerar gaps:

- **9.5.1** — JS call sites pros 3 bridge methods (~1h)
- **9.5.2** — NativeMyCircleHost callbacks → nested present (~1h)
- **9.5.3** — Sub-CTA "Outro período" no MyCircleView + RecapPeriodPicker wire (~1h)
- **9.5.4** — `FollowsService.swift` + OtherProfileView wiring + Capacitor inverse bridge pra chat/report/block (~3h)
- **9.5.5** — MonthlyRecap stats reais (3 RPCs ou queries) (~2h)

Total estimado: ~8h. Pode ser feito antes ou em paralelo com TestFlight processing.

---

## 8. Comandos rápidos pra você verificar

```bash
# Confirmar bridge methods sem JS call sites
grep -rn "presentOtherProfile\|presentEditProfile\|presentMonthlyRecap" apps/web/src/components/gym-circle/ | grep -v ".ts:"
# (esperado: vazio = problema, ou linhas em GymCirclePreview = OK)

# Confirmar NativeMyCircleHost callbacks vazios
grep -A2 "onTapBadgeHighlight: {" ios/App/App/Plugins/GymCircleNativeBridgePlugin.swift

# Confirmar RecapPeriodPickerSheet usado
grep -rn "RecapPeriodPickerSheet\b" ios-native/ ios/App/App/Plugins/

# Confirmar achievements count = 24
grep -c "achievementId:" ios-native/GymCircleNative/Sources/GymCircleNativeFoundation/Models/AchievementBuilder.swift
# (esperado: 24, era 19 na auditoria original)

# Foundation build clean
cd ios-native/GymCircleNative && xcodegen generate && \
  xcodebuild -project GymCircleNative.xcodeproj -scheme GymCircleNative \
  -destination 'generic/platform=iOS' build 2>&1 | grep -E "BUILD"
```

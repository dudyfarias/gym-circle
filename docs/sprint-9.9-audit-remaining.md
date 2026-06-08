# Sprint 9.9 — Auditoria final pós Sprint 9.8

Data: 2026-06-07
Status: 🟢 **Pronto pra TestFlight**, mas com lista clara de melhorias

Após Sprint 9.5–9.8 (P0/P1/P2 fechados + polish), esta auditoria varre
todas as dimensões do app pra identificar **o que ainda merece atenção
antes/durante TestFlight e v1.2**.

---

## 1. Status geral

| Dimensão | Status |
|----------|--------|
| **9 telas Phase 7 nativas funcionando end-to-end** | ✅ |
| **24/24 achievements paridade web** | ✅ |
| **L10n PT/EN ~130 keys** | ✅ |
| **A11y modal traits em todas 9 telas** | ✅ |
| **Haptics em 10+ pontos** | ✅ |
| **7/7 bridge methods wirados** | ✅ |
| **Foundation BUILD SUCCEEDED** | ✅ |
| **Push pra origin/main funcional** | ✅ |
| **Tests cobertura** | 🔴 só 3 funções, 60 linhas |
| **6 surfaces inteiras ainda web** | 🟡 decisão Phase 7-only |
| **Apple Developer setup** | ⏳ pendente manual |

---

## 2. Gaps remanescentes priorizados

### 🔴 P0 — Bloqueiam release ou são debt visível

| # | Item | Local | Esforço | Por que P0 |
|---|------|-------|---------|------------|
| 1 | **`StoriesService` inexistente** | AppModel L283 `hasStory: false` hardcoded | 2h | StreakBadge story ring nunca aparece — feature renderizada mas sem dado |
| 2 | **LoginView strings hardcoded** | LoginView.swift L20-21 ("Gym Circle"/"Train together") | 15min | App em EN mostra "Train together" em PT também |
| 3 | **A11y labels hardcoded PT** | 5 telas: `"Fechar"` literal | 30min | EN VoiceOver lê "Fechar" em vez de "Close" — review fail Apple |
| 4 | **"SEMANA" hardcoded** | ActivityRingsView L38 | 5min | EN mostra "SEMANA" em vez de "WEEK" |
| 5 | ~~**Push Notifications zero setup**~~ | **Sprint 10.3 fechou client-side**. Server trigger (Edge function) pendente pra v1.1.2 | 2h done + 2h follow-up | Token registration + 2 listeners runtime wirados. Edge function que dispara push quando achievement unlock / challenge complete ainda falta |

### 🟠 P1 — Qualidade técnica relevante

| # | Item | Local | Esforço | Impacto |
|---|------|-------|---------|---------|
| 6 | **Tests Foundation Package** muito raso | NativeModelsTests 60 linhas, 3 funções | 4h | AchievementBuilder/CalendarBuilder/Services sem cobertura. Risco de regressão alto |
| 7 | **LRU cache pra getGlobalStats** | AchievementsService linha 51 | 1h | Comentado como TODO desde Sprint 8.11. Cada open do Detail dispara fetch repetido |
| 8 | **EditProfileSheet reset state** | init _ State syntax — não reseta quando reabre | 30min | Erro de save persiste entre aberturas. UX ruim |
| 9 | **EditProfileSheet avatar diff check** | sempre envia avatar_url no update | 30min | PATCH desnecessário toda vez. Anotado em 9.8.6 commit msg como TODO |
| 10 | **Retry/backoff em fetches** | zero em todos services | 2h | Network blip → erro propagado pro user. Apple HIG sugere graceful |
| 11 | **Bridge plugin .docs stale** | linhas 22-27 dizem "stub" mas já não são | 5min | Comentário desatualizado confunde leitura |

### 🟡 P2 — Roadmap v1.2

| # | Item | Tela/Surface | Esforço |
|---|------|-------------|---------|
| 12 | **FeedScreen migration** | feed principal Capacitor → SwiftUI | L (~2 semanas) |
| 13 | **ChatScreen migration** | mensagens DM | L |
| 14 | **StoriesViews real** | só 112 linhas placeholder | M |
| 15 | **CheckInScreen** | post creation flow | M |
| 16 | **PostScreen migration** | individual post detail | M |
| 17 | **HealthKit integration** | roadmap doc Sprint 5.6 nunca feito | L (~1 semana) |
| 18 | **Comments BottomSheet nativo** | gap web sem paridade | M |
| 19 | **Notifications nativo** | sheet + push tap navigation | M |
| 20 | **FollowList overlay nativo** | seguindo/seguidores | S |

### ⚪ P3 — Polish menor

| # | Item | Esforço |
|---|------|---------|
| 21 | Sound effects em achievement unlock (AudioToolbox) | 30min |
| 22 | Deep links URL scheme (`gymcircle://`) | 1h |
| 23 | Universal Links setup (apple-app-site-association) | 2h |
| 24 | Image cache strategy (URLSession + ImageCache custom) | 2h |
| 25 | Pre-warm AppModel quando user faz login | 30min |
| 26 | Make `makeModel` retornar singleton (atualmente cria por host) | 1h |
| 27 | Dark mode lock (já é dark, mas declarar `preferredColorScheme(.dark)`) | 5min |
| 28 | Dynamic Type cap em alguns componentes | 1h |
| 29 | Reduced motion respeitar `accessibilityReduceMotion` | 1h |
| 30 | Bridge plugin `presentRecapNative` stub comment cleanup | 5min |

---

## 3. Pendências server-side

### Migrations — ✅ Sprint 9.9.8 verificou (8 jun 2026)

**Status real (via Supabase MCP, project `qajjpjmybmqqwflytcpr`):**

Schema 100% sincronizado. Os 7 candidatos identificados no audit inicial
(store_hardening, story_social_interactions, require_gym_location,
social_workout_participants, streak_restore, notification_bell_social_only,
performance_surface_rpcs) tiveram seus objetos verificados via
`information_schema` / `pg_proc` / `pg_constraint` — **todos presentes
em prod**. As migrations foram aplicadas via Dashboard / push direto
em sessões anteriores; o nome no migrations history divergiu do filename
local (ex: `gym_circle_store_hardening` em prod vs `store_hardening` local).

Conclusão: nenhuma migration pra aplicar antes do TestFlight.

### Advisors pendentes (não bloqueantes — v1.2)

Snapshot dos advisors Supabase rodado em 8 jun 2026:

**Security (12 WARN):**
- 12 funções SECURITY DEFINER expostas a anon/authenticated.
  Maioria intencional (RPCs com `auth.uid()` check interno:
  `get_achievement_global_stats`, `use_streak_restore`,
  `delete_my_account`, `refresh_my_stats`, `sync_my_streak_restores`,
  `resolve_email_for_username`). Auditoria caso-a-caso = sprint dedicada.
- `auth_leaked_password_protection` desabilitado. **Quick win**: toggle
  no Dashboard → Auth → Settings → Password Policy.

**Performance (40+ INFO/WARN):**
- 5 RLS policies re-avaliam `auth.uid()` por row (paridade `(select
  auth.uid())` recomendada): `user_monthly_challenge_progress` (3 policies),
  `user_achievements` (2 policies). Escala = lento. Fix simples.
- 11 FKs sem index covering: `conversations.created_by`,
  `notifications.actor_id/post_id/comment_id`, `reports.*`,
  `post_participants.tagged_by_user_id`, etc.
- 30+ unused indexes (gyms, profiles, posts, stories, push_subscriptions,
  etc). Candidatos a drop em sprint de cleanup.
- 2 multiple permissive policies (`reports`, `user_blocks`).
- Auth DB connection strategy: absolute (10) — recomendado percentage.

### Storage policies

✅ Avatars bucket `Owner upload/update/delete avatars` policies já criadas
em `20260506205548_gym_circle_advisor_fixes.sql`.

### RPCs faltando

- `achievement_global_stats` ✅ existe Sprint 7.5.8
- `monthly_recap_cover_set` ❌ Sprint 8.13.5 anotado como Sprint 9+ — read-merge-write client-side por ora
- `top_workout_type_in_month` ❌ Sprint 9.5.5 fez client-side group+count — RPC mais eficiente seria útil pra users com >500 posts/mês

---

## 4. App Store Connect — checklist pendente

| Item | Status |
|------|--------|
| App ID criado em Identifiers | ⏳ Manual |
| App Store Connect record | ⏳ Manual |
| Signing certs no Keychain | ⏳ Manual |
| Privacy manifest | ⏳ Precisa atualizar pra cobrir PhotosPicker + Storage |
| Encryption export compliance | ⏳ "Uses HTTPS only" exemption |
| ATT prompt (Apple Tracking Transparency) | 🟡 Não usa tracking — pode pular |
| **Screenshots** 6.7"/6.1"/5.5" | ❌ Não gerados |
| **App Preview vídeo** opcional | ❌ |
| **Description PT-BR + EN** | ❌ |
| **Keywords ASO** | ❌ |
| **Promotional Text** | ❌ |
| **What's New in This Version** | ❌ (sugestão no `sprint-9-testflight-guide.md`) |
| **Test account credentials pra reviewer** | ❌ |
| **Support URL + Marketing URL** | ❌ |
| **Privacy policy URL** | ❌ |

---

## 5. Bridge plugin coverage atual

| Method | Implementado | JS call site | Wire host |
|--------|--------------|--------------|-----------|
| `isAvailable` | ✅ | ✅ | N/A |
| `presentMyCircleNative` | ✅ | ✅ openProfile native fallback | NativeMyCircleHost |
| `presentAchievementDetail` | ✅ | ✅ wrapper híbrido | NativeAchievementDetailHost |
| `presentCelebration` | ✅ | ✅ useEffect queue | NativeCelebrationHost |
| `presentAchievementsHub` | ✅ | ✅ openBadges hybrid | NativeAchievementsHubHost |
| `presentOtherProfile` | ✅ | ✅ openProfile async | NativeOtherProfileHost |
| `presentEditProfile` | ✅ | ✅ openEditProfile async | NativeEditProfileHost |
| `presentMonthlyRecap` | ✅ | ✅ openMonthlyRecapHybrid | NativeMonthlyRecapHost |

**Inverse bridge listeners:**
| Event | Disparado por | Capturado por |
|-------|---------------|--------------|
| `openChat` | OtherProfileHost onMessage | GymCirclePreview `openChatWithUser` |
| `openPost` | OtherProfileHost onOpenPost | GymCirclePreview `setPostDetailFullId` |
| `reportUser` | OtherProfileHost onReport | console.info stub (Sprint 9.x wire) |
| `blockUser` | OtherProfileHost onBlock | `social.actions.blockUser` |

---

## 6. Hardcoded strings ainda no Foundation Package

```
LoginView.swift:20:  "Gym Circle" (nome do produto — não traduz)
LoginView.swift:21:  "Train together" (TAGLINE — precisa L10n)
ActivityRingsView.swift:38:  "SEMANA" (precisa L10n)
RecapPeriodPickerSheet.swift:70:  "Fechar" a11y label (precisa L10n)
MonthlyRecapSheet.swift:126:  "Fechar" a11y label
RecapCoverPickerSheet.swift:167:  "Fechar" a11y label
OtherProfileView.swift:105:  "Fechar" a11y label
AchievementDetailView.swift:closeButton  "Voltar" a11y label
AchievementsView.swift:header  "Fechar" a11y label
MyCircleView.swift:calendar chevrons  "Mês anterior" / "Próximo mês"
```

**Fix rápido:** adicionar `L10n.commonClose`, `L10n.commonBack`,
`L10n.commonPreviousMonth`, `L10n.commonNextMonth`, `L10n.streakDays`,
`L10n.loginTagline` — 7 keys novas, ~10 min.

---

## 7. Comparação Foundation Swift vs Web (estimativa cobertura)

| Surface | Web LoC | Swift LoC | Cobertura UX | Cobertura DB |
|---------|---------|-----------|--------------|--------------|
| MyCircleSheet | 838 | 700+ | **95%** | ✅ |
| AchievementDetailOverlay | 473 | 400+ | **90%** | ✅ |
| AchievementsSheet | 427 | 320 | **85%** | ✅ |
| AchievementCelebrationOverlay | 398 | 380+ | **92%** | ✅ |
| ProfileSheet (OtherProfile) | 272 | 380 | **90%** | 🟡 actions stub |
| EditProfileSheet | 489 | 600+ | **90%** | ✅ 8 campos |
| MonthlyRecapSheet | 608 | 475 | **85%** | ✅ |
| RecapCoverPickerSheet | 233 | 280 | **95%** | ✅ |
| RecapPeriodPickerSheet | 207 | 215 | **100%** | ✅ |

**Média global Phase 7: ~91% UX parity.**

---

## 8. Sprints sugeridas pra v1.1.1 / v1.2

### v1.1.1 (Sprint 9.9 → 9.10) — Pre-TestFlight polish (~6h)
- 9.9.1: A11y labels via L10n (commonClose, commonBack, etc) — 30min
- 9.9.2: LoginView L10n + "SEMANA" → L10n — 15min
- 9.9.3: Bridge plugin docs cleanup — 5min
- 9.9.4: EditProfileSheet reset state on open — 30min
- 9.9.5: EditProfileSheet avatar URL diff check — 30min
- 9.9.6: LRU cache pra getGlobalStats — 1h
- 9.9.7: Retry/backoff pattern em services — 2h
- 9.10: App Store screenshots + metadata gen — 1h

### v1.1.2 (Sprint 10) — StoriesService + Push (~10h)
- 10.1: `StoriesService.swift` (lista, criar, view) — 4h
- 10.2: Story ring no MyCircleView wire real — 1h
- 10.3: Push Notifications setup completo — 4h
- 10.4: Tests Foundation Package (target 70% cobertura) — 4h

### v1.2 (Sprint 11+) — Surface migrations (~3 semanas)
- 11.1: FeedScreen → SwiftUI nativo
- 11.2: ChatScreen → SwiftUI nativo
- 11.3: CheckInScreen + PostScreen
- 11.4: NotificationsSheet + FollowList + Comments nativos

### v1.3 (Sprint 12) — HealthKit + advanced (~2 semanas)
- 12.1: HealthKitService + permissions
- 12.2: Workout sync com posts
- 12.3: Deep links + Universal Links
- 12.4: Sound effects pra achievements
- 12.5: ReducedMotion / DynamicType edge cases

---

## 9. Hot fixes pra fazer AGORA (antes do Archive)

**Esses ~1h fecham os items mais críticos pra evitar review rejection:**

1. ✅ A11y labels via L10n (`commonClose`, etc) — Sprint 9.9.1
2. ✅ LoginView strings → L10n — Sprint 9.9.1
3. ✅ "SEMANA" → L10n — Sprint 9.9.1
4. ✅ Bridge plugin docs cleanup — Sprint 9.9.3
5. ✅ Migration prod check — Sprint 9.9.8 (schema 100% alinhado, sem
   gap real; "12 migrations pendentes" eram registros de history table,
   não DDL ausente — verificado via Supabase MCP)

---

## 10. Comandos pra você verificar localmente

```bash
# Hardcoded strings remanescentes
grep -rn 'Text("[A-ZÀ-Úa-zà-ú]' \
  ios-native/GymCircleNative/Sources/GymCircleNativeFoundation/Screens/ \
  ios-native/GymCircleNative/Sources/GymCircleNativeFoundation/Components/ \
  | grep -v "L10n\\.\\|systemName\\|font\\|//"

# Stubs remanescentes
grep -rn "TODO\\|FIXME\\|Sprint 9.x" \
  ios-native/GymCircleNative/Sources/ ios/App/App/Plugins/ \
  | grep -v "Sprint 8\\|Sprint 9.[1-8]\\|paridade"

# Tests
swift test --package-path ios-native/GymCircleNative

# Migrations pendentes
ls supabase/migrations/20260603*.sql | wc -l

# Push notifications config
grep -rn "PushNotifications\\|requestPermissions" ios/App/App/

# Foundation build
cd ios-native/GymCircleNative && xcodegen generate && \
  xcodebuild -project GymCircleNative.xcodeproj -scheme GymCircleNative \
  -destination 'generic/platform=iOS' build 2>&1 | grep BUILD
```

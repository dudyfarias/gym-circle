# Sprint 9.4 — TestFlight + App Store submission guide

Data: 2026-06-07
Status: 🟢 código pronto · ⏳ pendente Apple Developer setup pelo dono

Este doc é o passo-a-passo manual pra você subir o app pra TestFlight e
App Store. Eu não consigo fazer essa parte porque depende da sua conta
Apple Developer + Apple ID + 2FA + Mac com keychain.

---

## 0. Pré-requisitos (1ª vez)

Confirma que você tem:

- [ ] **Apple Developer Program** ativo (US$ 99/ano) em https://developer.apple.com/account
- [ ] **App ID** registrado: `com.gymcircle.app` (Identifiers > App IDs)
  - Capabilities: Push Notifications, Sign in with Apple (futuro), App Groups (futuro)
- [ ] **App Store Connect** record criado pro app:
  - Nome: Gym Circle
  - Bundle ID: `com.gymcircle.app`
  - SKU: `gymcircle-app-001`
  - Primary language: Portuguese (Brazil)
- [ ] **Signing certificates** instaladas no Keychain (Xcode auto-manages é OK)
- [ ] **Provisioning profile** App Store distribution criado (ou usa automatic)

---

## 1. Pre-flight (no Mac local)

### 1.1 Atualizar dependências

```bash
cd /Users/eduardofariascappia/Documents/Site-de-vendas-oracao/gym-circle/
git pull origin main
pnpm install
pnpm --filter @gym-circle/web build
pnpm cap sync ios
```

### 1.2 Confirmar Foundation Swift Package adicionado

Em Xcode (`open ios/App/App.xcodeproj`):

1. Select project root → target `App` → Package Dependencies
2. Confirma `GymCircleNativeFoundation` na lista
3. Se não, `Add Local…` → `<repo>/ios-native/GymCircleNative` → product
   `GymCircleNativeFoundation` → target `App`

### 1.3 Configurar env vars no scheme

Edit scheme `App` → Run → Arguments → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL = https://<seu-projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc...
NEXT_PUBLIC_USE_NATIVE_MYCIRCLE = true
```

**Importante**: pra Archive (Release), env vars do scheme NÃO entram no
binary. Você precisa hardcodar em `ios/App/App/Info.plist` antes de
fazer Archive, OU usar uma `.xcconfig` que injeta via `User-Defined`.

Opção rápida (Info.plist):

```xml
<key>NEXT_PUBLIC_SUPABASE_URL</key>
<string>https://...</string>
<key>NEXT_PUBLIC_SUPABASE_ANON_KEY</key>
<string>eyJhbGc...</string>
```

⚠️ **Cuidado**: o anon key vai pro binary público. Confirma que RLS
policies no Supabase estão corretas (essa key sozinha não dá acesso
sem auth user). Estratégia padrão Supabase.

### 1.4 Confirmar versão

```bash
grep MARKETING_VERSION ios/App/App.xcodeproj/project.pbxproj
# → MARKETING_VERSION = 1.1.0;
grep CURRENT_PROJECT_VERSION ios/App/App.xcodeproj/project.pbxproj
# → CURRENT_PROJECT_VERSION = 5;
```

Se já enviou build 5 pra TF antes, incremente `CURRENT_PROJECT_VERSION`
pra 6 antes do Archive.

---

## 2. Archive em Xcode

1. **Connect** iPhone físico OU select `Any iOS Device (arm64)` no scheme
   selector (NÃO simulator)
2. **Product → Archive** (menu, ou Cmd+B com scheme em Release)
3. Build leva 3-8 min. Erros comuns:
   - **"No matching profile"**: `Signing & Capabilities` → check "Automatically
     manage signing" → team selecionado
   - **"GymCircleNativeFoundation not found"**: voltar pro 1.2
   - **"@capacitor/splash-screen not found"**: rodar `pnpm install` + `pnpm cap sync ios`
4. Archive abre Organizer automaticamente

---

## 3. Upload pra App Store Connect

1. No Organizer → archive selecionado (mais recente no topo)
2. **Distribute App** → **App Store Connect** → **Upload**
3. Signing: **Automatically manage signing** (recomendado)
4. Click **Upload**. Demora 5-15 min upload + processing
5. Se app rejected na validação:
   - Missing icon: `App Icon` no Assets.xcassets cobre 1024x1024 + todos slots
   - Missing privacy: ver §4
   - Bitcode (já desabilitado em Xcode 14+, ignore)

---

## 4. App Store Connect — preparar TestFlight

Login em https://appstoreconnect.apple.com/

### 4.1 Privacy

**My Apps** → Gym Circle → **App Privacy** → **Get Started**:

- Data Used to Track You: **No**
- Data Linked to You: 
  - Contact Info (email, name)
  - User Content (photos, posts)
  - Identifiers (User ID)
- Data Not Linked to You: nenhum
- Purposes: App Functionality, Analytics (se ativo)

### 4.2 Encryption export compliance

Build vai pedir resposta:
- "Does your app use encryption?" → **Yes** (HTTPS/TLS via Supabase)
- "Exempt from filing?" → **Yes** (HTTPS standard exemption)

### 4.3 Internal testing (TestFlight)

**TestFlight tab** → após processing terminar (10-30 min):

1. Click no build 1.1.0 (5)
2. **Internal Testing** → **+ Group** → "Internal QA"
3. Add testers (você + outros). Pode usar Apple IDs cadastrados como App
   Store Connect Users (free)
4. Click **Start Testing**
5. Testers recebem email com link pra TestFlight app

**External Testing** (até 10k usuários sem App Store review):
- **+ Group** → "Beta Brasil"
- Add testers por email OU public link
- Marcar build como External → submete pra Beta Review (24-48h)
- Aprovado → testers convidados via email/link

---

## 5. Smoke test no TestFlight (você + testers)

Roteiro mínimo no iPhone com TF instalado:

- [ ] Login com user real
- [ ] Feed carrega (1 post mínimo)
- [ ] Tap MyCircle → tela SwiftUI nativa abre full-screen
- [ ] Calendar mostra dias treinados (cyan) + thumbnails (Sprint 8.13.1)
- [ ] Stats reais (não "0 0 0")
- [ ] Nome real no header (não email)
- [ ] Achievement Detail tap → tela SwiftUI nativa
- [ ] Profile próprio → featured achievements row
- [ ] EditProfile → trocar avatar (PhotosPicker), salvar, refresh
- [ ] Recap CTA → MonthlyRecapSheet nativo abre
- [ ] Recap "Trocar foto" → grid posts do mês
- [ ] Recap "Compartilhar" → UIActivityViewController com PNG
- [ ] EN switch via Settings (linguagem do device) → strings traduzidas

Checklist completo em `docs/sprint-8-readiness-and-smoke.md`.

---

## 6. App Store submission (após TF aprovado por testers)

Quando smoke passar em TF, submeter pra App Store review:

### 6.1 Preparar metadata

**App Store Connect** → **App Store tab** → **+ Version** → 1.1.0:

- **What's New in This Version** (release notes):
  ```
  Versão 1.1 — Sprint 8 SwiftUI Migration
  
  • MyCircle agora 100% nativo SwiftUI com animações 60fps
  • 24 conquistas nas 5 categorias (Badges, Medalhas, Troféus, Relíquias, Desafios)
  • Calendar com mini-fotos do seu treino (estilo Gym Rats)
  • Hall da Fama com 6 abas + sub-seções
  • Celebration full-screen com particle effects nativos
  • Trocar avatar direto pelo app
  • Recap mensal com foto escolhida e compartilhamento
  • Tradução completa PT/EN
  ```
- **Promotional Text**: 170 chars max
- **Description**: completo (paridade web descrição)
- **Keywords**: gym, treino, fitness, social, streak, academia, workout, accountability
- **Support URL**: site/contato
- **Marketing URL**: opcional
- **Screenshots**: 6.7" (iPhone 15 Pro Max), 6.1", 5.5" — capturas dos 9
  surfaces principais (MyCircle, Detail, Hall da Fama, Celebration,
  Profile, OtherProfile, Recap, Feed, Chat)
- **App Preview** (vídeo 15-30s opcional): mostra MyCircle scroll +
  AchievementCelebration burst

### 6.2 Build selection

- **Build** → Select Build → escolhe 1.1.0 (5)
- **Notes for Reviewer**:
  ```
  Test account:
    Email: appreview@gymcircle.app (cria sandbox account)
    Password: <colocar antes de submeter>
  
  Notes:
    - App requires authentication for full feature access
    - Uses Supabase backend (web view + native SwiftUI hybrid)
    - Camera permission used for posting workout photos
    - Photo library permission used for avatar upload
  ```

### 6.3 Submit for review

- Click **Save** → **Add for Review** → **Submit for Review**
- Review típico: 24-48h
- Status: Waiting for Review → In Review → Pending Developer Release → 
  Ready for Sale

---

## 7. Pós-release

### 7.1 Monitoring

- **App Store Connect → Sales and Trends** — downloads + revenue (se IAP)
- **TestFlight → Crashes** — crash reports após release
- **Supabase Dashboard** — RLS errors, query perf, storage usage

### 7.2 Hotfix workflow

Se aparecer crash crítico:

```bash
# 1. Fix + commit
git checkout -b hotfix/<issue>
# ...fix...
git commit -am "fix: <crash>"

# 2. Bump CURRENT_PROJECT_VERSION (build) — NÃO bumpa MARKETING_VERSION
sed -i '' 's/CURRENT_PROJECT_VERSION = 5/CURRENT_PROJECT_VERSION = 6/g' ios/App/App.xcodeproj/project.pbxproj

# 3. Archive + Upload (§2-3)
# 4. App Store Connect → Submit nova build 1.1.0 (6) pra review com:
#    "Expedited Review" requested em casos de crash crítico
```

---

## 8. Known limitations / Sprint 9.x backlog

Coisas que ficaram pra Sprint 9 ou futura:

- **Avatar upload sem crop UI**: PhotosPicker padrão. Sprint 9.5+ pode
  adicionar tela de crop com Vision square detection.
- **Edit profile sem validation de username**: front aceita qualquer
  string. Validação `[a-z0-9_.]+` 3-32 chars existe no DB (constraint),
  mas erro só apparece depois de tentar salvar. Sprint 9.5+: inline
  validation.
- **Follows actions stub no OtherProfileView**: bridge passa callback
  vazio. Wire FollowsService quando criado.
- **MonthlyRecap stats parciais**: bestStreak/topType/topGym do mês
  específico ainda não computados — Sprint 9.5+: novos RPCs.
- **Stories/Feed/Chat seguem Capacitor web**: decisão de não migrar
  Phase 8+ (perf web já 60fps).

---

## 9. Comandos rápidos de verificação

```bash
# Confirmar versão antes do Archive
grep -E "MARKETING_VERSION|CURRENT_PROJECT_VERSION" ios/App/App.xcodeproj/project.pbxproj | head -4

# Foundation Package build (catch errors antes do iOS App)
cd ios-native/GymCircleNative && xcodegen generate && \
xcodebuild -project GymCircleNative.xcodeproj -scheme GymCircleNative \
  -destination 'generic/platform=iOS' build

# Bridge plugin syntax
swiftc -parse ios/App/App/Plugins/GymCircleNativeBridgePlugin.swift

# Web build (precisa rodar antes de cap sync)
pnpm --filter @gym-circle/web build

# Cap sync (copia public + atualiza SPM)
pnpm cap sync ios

# iOS App build (com node_modules instalados)
cd ios/App && xcodebuild -project App.xcodeproj -scheme App \
  -destination 'generic/platform=iOS Simulator,name=iPhone 15' build
```

---

## 10. Suporte

Problemas no Archive ou TestFlight?

1. **Apple Developer Forums**: https://developer.apple.com/forums
2. **App Store Connect Help**: https://help.apple.com/app-store-connect
3. **Capacitor docs iOS**: https://capacitorjs.com/docs/ios

Bugs específicos do Gym Circle nativo: vê `docs/sprint-8-audit-paridade.md`
seção 11-13 pra status de cada feature.

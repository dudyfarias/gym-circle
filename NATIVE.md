# Gym Circle — Submissão App Store / Play Store

Wrapper Capacitor que carrega o deploy do Vercel num WebView nativo iOS + Android.
Toda atualização do site continua sendo OTA: você só precisa publicar nova
versão na loja quando mudar plugin nativo, ícone, splash ou permissão.

## Pré-requisitos

- macOS (necessário pra build iOS)
- Xcode 16+ instalado pela App Store
- Android Studio (Hedgehog ou superior)
- Conta Apple Developer ($99/ano) — pessoa física, login com seu Apple ID
- Conta Google Play Developer ($25 once) — usar mesmo Google da conta Vercel
- Node.js 24 LTS (`node -v` deve mostrar v24.x)

## Bundle ID

`com.dudyfarias.gymcircle` — definido em [`capacitor.config.ts`](capacitor.config.ts).
**Não troque** depois de publicar; perderia continuidade pros usuários.

## Adicionar plataformas (rodar 1x na vida)

```bash
# Da raiz do repo
npm run cap:add:ios
npm run cap:add:android
```

Isso gera `ios/` e `android/` no repo. **Comite** essas pastas — elas têm
configurações de signing, ícones nativos, info.plist, AndroidManifest.xml,
etc. Sem elas, ninguém consegue rebuildar.

## Sincronizar mudanças do web → nativo

Sempre que mudar `capacitor.config.ts`, `package.json` (plugins) ou as
permissões/ícones, rode:

```bash
npm run cap:sync
```

Mudanças puras de UI Next.js **não** precisam de `cap sync` — o app puxa
direto do Vercel.

---

## 🍎 iOS — App Store Connect

### 1. Apple Developer Program
1. Acesse [developer.apple.com/programs](https://developer.apple.com/programs/) e enroll
2. Pessoa física: precisa CPF + Apple ID 2FA habilitado
3. Aguarda 24-48h aprovação

### 2. Configurar projeto Xcode
```bash
npm run cap:open:ios
```

No Xcode:
- **Signing & Capabilities** → Team = sua conta Apple Developer
- **Bundle Identifier** → confirma `com.dudyfarias.gymcircle`
- **Display Name** → `Gym Circle`
- **Version** → `1.0.0`, **Build** → `1` (incrementa em cada upload)
- **Capabilities** → adiciona `Push Notifications` (se for usar)

### 3. Permissions (Info.plist)
Editar `ios/App/App/Info.plist`. Strings que a Apple **exige**:

```xml
<key>NSCameraUsageDescription</key>
<string>O Gym Circle usa a câmera para você publicar fotos e vídeos do seu treino.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Para selecionar fotos e vídeos do seu treino na galeria.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>Para mostrar onde foi o treino e descobrir gente que treina perto de você.</string>

<key>NSMicrophoneUsageDescription</key>
<string>Necessária para gravar o áudio dos vídeos do seu treino.</string>
```

**Importante**: rejection clássica é não ter essas strings ou usar texto vago.
Apple lê.

### 4. Splash + Ícones
- Ícone: `apps/web/public/icons/icon-1024.png` → Xcode Assets.xcassets → AppIcon
- Splash: usar `apps/web/public/splash/splash-1170x2532.png` como base, gerar
  resoluções via [appicon.co](https://appicon.co)

### 5. TestFlight (interno)
- Xcode → Product → Archive
- Validate App
- Distribute App → App Store Connect
- Aguarda processamento (15min - 1h)
- App Store Connect → TestFlight → adiciona testers internos (até 100 emails)

### 6. App Store review
- App Store Connect → My Apps → Gym Circle → Prepare for Submission
- Screenshots obrigatórios:
  - iPhone 6.7" (3-10): 1290×2796px
  - iPhone 6.5" (3-10): 1242×2688px
  - Você pode reaproveitar mesma arte
- Description (max 4000 chars), keywords, support URL, marketing URL
- **Privacy Nutrition Labels**: declarar que coleta Email, User Content (fotos),
  Usage Data, Identifiers
- Submit for Review
- Wait: tipicamente 24-48h

### Common rejections para wrapper webview
- "Apps that are designed for the iOS environment" → tem que funcionar offline
  (manifestar service worker já cobre)
- "Minimum functionality" → adicione push notifications + camera capture nativo
  pra evitar
- "Sign in with Apple" → exigido se você oferece sign in social. Hoje só temos
  email, então OK.

---

## 🤖 Android — Play Console

### 1. Google Play Developer
1. [play.google.com/console](https://play.google.com/console) → criar conta ($25)
2. Verificação de identidade pode levar até 7 dias (CPF/RG)

### 2. Configurar Android Studio
```bash
npm run cap:open:android
```

No Android Studio:
- **app/build.gradle.kts**: confirma `applicationId = "com.dudyfarias.gymcircle"`
- **versionCode** → `1` (inteiro, incrementa toda release)
- **versionName** → `"1.0.0"`

### 3. Permissions (AndroidManifest.xml)
Em `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### 4. Gerar AAB assinado
- Android Studio → Build → Generate Signed Bundle / APK → Android App Bundle
- Cria keystore na primeira vez. **GUARDE O KEYSTORE** num lugar seguro
  (1Password, etc) — perdeu, perdeu o app pra sempre. Anote senha
  da keystore + senha da key.

### 5. Internal testing track
- Play Console → Test and release → Internal testing → Create new release
- Upload do AAB
- Adiciona até 100 testers por email
- Promove pra Closed → Open testing → Production conforme valida

### 6. Play Store review
- Store listing: descrição, ícone (512x512), feature graphic (1024x500),
  screenshots (mínimo 2 phone)
- **Data Safety**: declarar email, fotos do usuário, location, push tokens
- Content rating questionnaire
- Target API level: 34+ (Capacitor 6 já cumpre)
- Submit for Review
- Wait: 1-3 dias geralmente

---

## ✅ Checklist final (antes de cada submit)

- [ ] `npm run lint` zero warnings
- [ ] `npm run test` 18/18 passando
- [ ] `npm run build` verde
- [ ] Vercel deploy READY no commit que vai virar release
- [ ] `capacitor.config.ts` aponta pro Vercel certo
- [ ] Bundle ID confirmado em ambos os projetos nativos
- [ ] versionCode/versionName e Build/Version incrementados
- [ ] Permissions strings em PT-BR (nada genérico)
- [ ] Ícones e splash gerados em todas as resoluções
- [ ] `/privacy` e `/terms` acessíveis em produção (já existem)
- [ ] Privacy Nutrition Labels (iOS) + Data Safety (Android) preenchidos

## 🛡️ Hardening Supabase pendente (manual no dashboard)

Após o deploy, fazer 1x:
1. [Auth → Policies → Password](https://supabase.com/dashboard/project/qajjpjmybmqqwflytcpr/auth/providers)
2. Habilitar **"Leaked Password Protection"** (HaveIBeenPwned check)

Os 3 advisories restantes (`resolve_email_for_username`, `refresh_my_stats`,
`rls_auto_enable`) são intencionais — documentados via SQL `COMMENT ON FUNCTION`.

## 🔒 Visibilidade do repo

Lembrete: o repo tá **público** no GitHub agora. Antes do alpha real,
vale fechar de novo:
[github.com/dudyfarias/gym-circle/settings](https://github.com/dudyfarias/gym-circle/settings)
→ Danger Zone → Change visibility → Make private.

# Gym Circle — Submissão App Store / Play Store

Wrapper Capacitor que carrega o deploy de produção do Vercel num WebView nativo iOS + Android.
Toda atualização do site continua sendo OTA: você só precisa publicar nova
versão na loja quando mudar plugin nativo, ícone, splash ou permissão.

## Pré-requisitos

- macOS (necessário pra build iOS)
- Xcode 16+ instalado pela App Store
- Android Studio (Hedgehog ou superior)
- Conta Apple Developer ($99/ano) — pessoa física, login com seu Apple ID
- Conta Google Play Developer ($25 once) — usar mesmo Google da conta Vercel
- Node.js LTS compatível com Next/Capacitor

## Bundle ID

`com.gymcircle.app` — definido em [`capacitor.config.ts`](capacitor.config.ts).
**Não troque** depois de publicar; perderia continuidade pros usuários.

## Estratégia de URL

O app iOS usa `server.url = https://gym-circle-rust.vercel.app`. Esse é o
caminho certo para a alpha porque o Gym Circle ainda depende de Next.js/Vercel
para rotas dinâmicas e APIs como lugares/localização. O `webDir`
`native-fallback` existe apenas como fallback técnico/offline para o Capacitor.

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

Para iOS, prefira:

```bash
npm run cap:build:ios # npm run build + cap sync ios + patch Info.plist
npm run cap:open:ios
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
- **Bundle Identifier** → confirma `com.gymcircle.app`
- **Display Name** → `Gym Circle`
- **Version** → `1.0.0`, **Build** → `1` (incrementa em cada upload)
- **Capabilities** → adiciona `Push Notifications` (se for usar)

### 3. Permissions (Info.plist) — **automatizado**

As strings de permissão em PT-BR vivem em [`scripts/patch-ios-permissions.mjs`](scripts/patch-ios-permissions.mjs).
O script roda automaticamente toda vez que você executa:

```bash
npm run cap:add:ios   # primeira vez (cap add ios + patch)
npm run cap:sync      # subsequentes (cap sync + patch)
npm run cap:patch:ios # só o patch, se quiser rodar manualmente
```

Idempotente: insere as chaves se faltam, atualiza o texto se existem.

Permissões cobertas:
- `NSCameraUsageDescription` — câmera (publicar foto/vídeo de treino)
- `NSPhotoLibraryUsageDescription` — galeria (escolher mídia)
- `NSPhotoLibraryAddUsageDescription` — salvar mídia na galeria
- `NSMicrophoneUsageDescription` — áudio nos vídeos
- `NSLocationWhenInUseUsageDescription` — localização do treino
- `NSUserNotificationsUsageDescription` — texto interno/documental para push notifications

**Importante**: a Apple lê o texto literal das strings durante o review.
Texto genérico tipo "to use camera" é rejection garantida. As strings em
`patch-ios-permissions.mjs` foram redigidas pra explicar BENEFÍCIO ao
usuário, não tecnologia. Se mudar o texto, edite só o script — não o
Info.plist diretamente, porque o próximo `cap:sync` sobrescreve.

### 4. Splash + Ícones
- Ícone: `apps/web/public/icons/icon-1024.png` → Xcode Assets.xcassets → AppIcon
- Splash: usar `apps/web/public/splash/splash-1170x2532.png` como base, gerar
  resoluções via [appicon.co](https://appicon.co)
- Status bar: dark style sobre fundo preto, configurado em `capacitor.config.ts`
- Safe areas: já consideradas no CSS web e no fallback nativo

### 5. TestFlight (interno)
- Xcode → Product → Archive
- Validate App
- Distribute App → App Store Connect
- Aguarda processamento (15min - 1h)
- App Store Connect → TestFlight → adiciona testers internos (até 100 emails)

### 6. App Store review
- App Store Connect → My Apps → Gym Circle → Prepare for Submission
- **Toda a metadata** (descrição, keywords, categorias, privacy nutrition
  labels, demo account) está em [`STORE_METADATA.md`](STORE_METADATA.md) — copy-paste-ready.
- Screenshots obrigatórios estão na §13 do STORE_METADATA.md
- Submit for Review
- Wait: tipicamente 24-48h

### 7. Checklist de teste em iPhone real

- [ ] Login com email + senha
- [ ] Login com username + senha
- [ ] Feed carrega posts apenas permitidos
- [ ] Postar foto no feed
- [ ] Postar vídeo no feed
- [ ] Postar story foto/vídeo
- [ ] Story visto mantém anel apagado após fechar/reabrir
- [ ] Curtir/descurtir post e story
- [ ] Responder story no chat
- [ ] Chat envia texto, foto e vídeo
- [ ] Streak acende ao postar feed/story
- [ ] Localização atual pede permissão e salva local aproximado
- [ ] Perfil próprio edita avatar/bio/campos opcionais
- [ ] Perfil público abre ao tocar usuário
- [ ] Notificações pedem permissão e aparecem quando permitido
- [ ] Bloquear usuário
- [ ] Denunciar usuário/post/story
- [ ] Excluir conta
- [ ] Pull to refresh nas abas principais
- [ ] Bottom nav não sobe indevidamente com teclado

### 8. Checklist TestFlight fechado

- [ ] App Store Connect criado
- [ ] Bundle ID `com.gymcircle.app` criado em Certificates, Identifiers & Profiles
- [ ] Signing automático ligado no Xcode
- [ ] Provisioning profile gerado
- [ ] Push Notifications capability ativada no identifier e no target
- [ ] Version `1.0.0`, Build `1`
- [ ] Archive validado
- [ ] Build enviado para App Store Connect
- [ ] Demo account criada e populada
- [ ] Testers internos adicionados
- [ ] Grupo fechado de 20-50 testers criado
- [ ] Privacy Policy: `https://gym-circle-rust.vercel.app/privacy`
- [ ] Terms: `https://gym-circle-rust.vercel.app/terms`
- [ ] Support URL definido
- [ ] Notas de teste explicando fluxo feed → postar → streak → chat

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
- **app/build.gradle.kts**: confirma `applicationId = "com.gymcircle.app"`
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
- Store listing, descrição, Data Safety, content rating: tudo em
  [`STORE_METADATA.md`](STORE_METADATA.md) §10 e §11.
- Feature graphic 1024×500 + ícone 512×512: criativo manual (ainda não automatizado)
- Target API level: 34+ (Capacitor 6 já cumpre)
- Submit for Review
- Wait: 1-3 dias geralmente

---

## ✅ Checklist final (antes de cada submit)

- [ ] `npm run lint` zero warnings
- [ ] `npm run test` 18/18 passando
- [ ] `npm run build` verde
- [ ] Vercel deploy READY no commit que vai virar release
- [ ] `capacitor.config.ts` aponta para `https://gym-circle-rust.vercel.app`
- [ ] Bundle ID confirmado como `com.gymcircle.app`
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

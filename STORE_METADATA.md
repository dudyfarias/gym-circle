# Gym Circle — Metadata pra App Store + Play Store

Tudo aqui é **copy-paste-ready** pros formulários do App Store Connect e do
Play Console. Edite a fonte aqui no repo, não no console — assim a versão
oficial fica em git e vc pode reabastecer entre releases.

> **Posicionamento obrigatório**: rede social fitness focada em
> consistência, progresso e comunidade. **Nunca** descrever como app de
> dating, encontros, paquera, conhecer pessoas no estilo "match". Apple e
> Google rejeitam apps de relacionamento sob review mais estrito —
> consistência fitness é categoria mais segura e mais alinhada ao produto.

---

## 1. Identidade básica

| Campo | Valor | Limites |
|---|---|---|
| Bundle ID | `com.gymcircle.app` | imutável |
| App Name (iOS) | `Gym Circle` | 30 chars (10 ✓) |
| Title (Android) | `Gym Circle` | 30 chars (10 ✓) |
| Subtitle (iOS) | `Consistência em comunidade` | 30 chars (26 ✓) |
| SKU | `gymcircle-ios-1` | interno |
| Primary Language | Português (Brasil) | — |
| Bundle Display Name | `Gym Circle` | — |

---

## 2. Categorias

### iOS App Store
- **Primary**: `Health & Fitness`
- **Secondary**: `Social Networking`

Por que essa ordem: a App Store penaliza apps de Social Networking em
review se eles parecem dating/encontros. Posicionar primário como
Health & Fitness faz o reviewer enquadrar como app de fitness com
features sociais — não rede social genérica.

### Google Play
- **Category**: `Health & Fitness`
- **Tags**: `Workout`, `Fitness Tracker`, `Habit Tracker`

---

## 3. Promotional Text (170 chars, iOS, editável sem re-review)

```
Marque seu treino, mantenha o streak aceso, descubra quem treina perto. Rede social do fitness focada em consistência, progresso e comunidade.
```
**150 chars** ✓

---

## 4. Short Description (Android, 80 chars)

```
Rede social fitness: streak diário, posts de treino e check-in da academia.
```
**77 chars** ✓

---

## 5. Description (full, 4000 chars iOS / 4000 Android)

```
Gym Circle é a rede social do fitness focada em consistência, progresso e comunidade. Aqui você marca seu treino, mantém o streak aceso, posta o antes-e-depois e descobre quem treina perto de você — sem dating, sem fofoca, sem feed infinito de gente que não treina.

POR QUE GYM CIRCLE É DIFERENTE
Outras redes sociais celebram fotos de corpo. O Gym Circle celebra o dia que você foi treinar mesmo. O streak diário acende quando você publica um treino real — foto, vídeo ou check-in da sua academia. Quanto mais consistência, mais alto o streak vai. Quem mantém o fogo aceso vira referência pra galera que tá começando.

PRINCIPAIS RECURSOS
• Streak diário — uma chama acende a cada dia que você treina e quebra se você falhar. Não dá pra trapacear: o app só conta dias com prova (foto, vídeo ou check-in)
• Feed dos seus amigos do treino — só posts de quem realmente está treinando, sem foto-shoot e sem sponcon
• Stories de treino — 24h pra mostrar o pico do dia: a sequência pesada, a corrida no parque, o grupo na crossfit
• Check-in nas academias — registre onde treinou, descubra parças que treinam no mesmo lugar
• Direct messages — papo privado pra combinar treino, dividir parceria de academia, mandar resposta de story
• Descoberta por região — encontre gente que treina perto de você (com seu controle total de privacidade)

PRIVACIDADE EM PRIMEIRO LUGAR
Você sempre escolhe o que compartilhar. Localização do treino é opcional em cada post. Perfil pode ser privado. Bloqueio e silenciamento de outros usuários estão a 2 toques de distância. Apple Sign In + email; suas mensagens privadas são privadas.

PARA QUEM É
• Quem já treina e quer accountability social pra manter
• Quem tá começando e precisa de inspiração de gente real
• Quem cansou do Instagram fitness performático e quer feed honesto
• Pessoal de academia, crossfit, corrida, escalada, ciclismo, yoga, calistenia — todo esporte conta

GRATUITO. Sem ads, sem pay-to-win, sem premium escondido. Pelo menos por enquanto.

Gym Circle é desenvolvido por uma pessoa só, no Brasil. Feedback direto via @dudyfarias.
```

**~2200 chars** — espaço sobrando pra evoluir sem rebreaching o limit.

---

## 6. Keywords (iOS only, 100 chars CSV sem espaços)

```
treino,academia,gym,fitness,workout,streak,consistencia,musculacao,crossfit,corrida,checkin,social
```
**99 chars** ✓

Notas:
- Sem palavras competindo: `streak`, `consistencia`, `checkin` são únicos do produto
- Sem dating: `match`, `date`, `relacionamento`, `crush` ficam fora intencionalmente
- Português sem acentos pra economizar bytes — Apple normaliza

---

## 7. What's New (4000 chars, versão 1.0.0)

```
v1.0.0 — primeira versão pública

• Feed e stories de treino
• Streak diário com check-in
• Descoberta por academia
• Direct messages
• Bloqueio, silenciamento e denúncia
• Exclusão de conta com confirmação dupla
• Modo offline parcial (PWA)

Bugs ou sugestão? Conta em @dudyfarias no Instagram ou abra a aba "Suporte" dentro do app.
```

---

## 8. URLs (iOS App Store Connect)

| Campo | URL | Status |
|---|---|---|
| Privacy Policy URL | `https://gym-circle-rust.vercel.app/privacy` | ✅ existe (rota /privacy) |
| Terms of Use URL | `https://gym-circle-rust.vercel.app/terms` | ✅ existe (rota /terms) |
| Support URL | `https://instagram.com/dudyfarias` | ✅ DM aberta |
| Marketing URL | `https://gym-circle-rust.vercel.app` | ✅ landing |
| Copyright | `© 2026 Eduardo Farias` | — |

> Privacy Policy URL é **obrigatória** pra Apple. Se a Vercel mudar o
> domínio (ex: comprar `gymcircle.app`), atualize aqui e nas Settings do
> ASC ANTES de submeter pra review — Apple bate o link automaticamente.

---

## 9. iOS Privacy Nutrition Labels

App Store Connect → App Privacy → Edit. Pra cada categoria, declare se
coleta, se é linked ao usuário, e se é usado pra tracking (sempre **NÃO**
no nosso caso — não vendemos data, não temos third-party SDKs de ad).

### 9.1 Data Linked to User

| Categoria | Item | Purpose |
|---|---|---|
| **Contact Info** | Email Address | App Functionality, Account Management |
| **User Content** | Photos or Videos | App Functionality |
| **User Content** | Audio Data | App Functionality (vídeos têm áudio) |
| **User Content** | Other User Content | App Functionality (bio, captions, comentários) |
| **User Content** | Customer Support | App Functionality (relatórios, denúncias) |
| **Identifiers** | User ID | App Functionality |
| **Identifiers** | Device ID | App Functionality (push notification token) |
| **Usage Data** | Product Interaction | Analytics, App Functionality |
| **Diagnostics** | Performance Data | Analytics |
| **Sensitive Info** | Date of Birth | App Functionality (verificação de idade) |
| **Location** | Precise Location | App Functionality (opcional, user-controlled em cada post) |

### 9.2 Data Not Collected
- Health & Fitness (não rastreamos exercícios via HealthKit)
- Financial Info
- Browsing History fora do app
- Search History (search queries não são persistidos)
- Purchases / In-App Purchases
- Contacts (não acessamos lista de contatos)

### 9.3 Tracking
**NÃO usamos data pra tracking** (tracking = compartilhar com terceiros pra
ads ou data brokers). Marque "Data Not Used to Track You" pra todas as
categorias acima.

---

## 10. Android Data Safety (Play Console)

Play Console → App content → Data safety. Estrutura idêntica à Apple mas
com nomes ligeiramente diferentes.

### 10.1 Personal info
- ✅ **Name**: collected, shared with no one, optional, app functionality
- ✅ **Email address**: collected, required, app functionality
- ✅ **User IDs**: collected, required, app functionality
- ✅ **Date of birth**: collected, optional, app functionality
- ✅ **Other info** (bio, fitness_goal): collected, optional, user-generated

### 10.2 Photos and videos
- ✅ **Photos**: collected, optional, app functionality, user-generated
- ✅ **Videos**: collected, optional, app functionality, user-generated

### 10.3 Audio files
- ✅ **Voice or sound recordings**: collected via vídeo, optional, app functionality

### 10.4 Messages
- ✅ **Other in-app messages**: collected (direct messages), required pro DM funcionar, app functionality

### 10.5 Location
- ✅ **Approximate location**: collected (post location), optional, app functionality
- ✅ **Precise location**: collected (post location quando user escolhe "atual"), optional, app functionality

### 10.6 App activity
- ✅ **App interactions**: collected (likes, follows, story views), app functionality + analytics
- ✅ **Other actions**: collected (block, report, mute), app functionality

### 10.7 App info and performance
- ✅ **Crash logs**: NÃO coletamos via app própria (Vercel logs server-side)
- ✅ **Diagnostics**: collected (analytics_events), app functionality + analytics

### 10.8 Device or other IDs
- ✅ **Device or other IDs**: collected (push subscription token), app functionality (notificações)

### 10.9 Security practices
- ✅ Data is encrypted in transit (HTTPS/TLS)
- ✅ User can request data be deleted (via Settings → Excluir conta + soft-delete via account_deletion_requests)
- ✅ Independent security review: NÃO (alpha; só RLS Postgres)

### 10.10 Data shared
**Nada é compartilhado com terceiros.** Todo storage e processamento
acontece em Supabase + Vercel (que são processadores, não data sharing).

---

## 11. Age Rating

### iOS App Store
**Age Rating Questionnaire (ASC):**
- Cartoon or Fantasy Violence: None
- Realistic Violence: None
- Sexual Content or Nudity: None
- Profanity or Crude Humor: Infrequent / Mild — UGC pode ter palavrão (alpha; tem report/block)
- Alcohol, Tobacco, Drug Use: None
- Mature/Suggestive Themes: None
- Horror/Fear: None
- Medical/Treatment Info: None
- Gambling: None
- Contests: None
- Unrestricted Web Access: **Yes** — embeddings de Vercel/Supabase são domínios próprios; sem browser embutido

**Age Rating final esperado**: 12+ (ou 13+ no Google Play) por causa de
UGC + interação social. Ajusta se Apple/Google override.

### Google Play
- **Target age**: 13+
- **Content rating questionnaire**: similar ao Apple acima

---

## 12. App Privacy Choices

App Store Connect também pede declarações sobre features sensíveis:

- ☐ Encryption (Export Compliance): **Yes, ITSAppUsesNonExemptEncryption = NO** — usamos só HTTPS/TLS padrão (qualifica pra exemption, basta declarar `false` no Info.plist)
- ☐ Third-party content: **No** (não temos webview de conteúdo de terceiros)
- ☐ Sign in with Apple: **No** — não oferecemos sign-in social. Se um dia oferecer Google/Facebook, Apple **exige** Apple Sign In também

> Adicione ao `Info.plist` via `patch-ios-permissions.mjs`:
> ```xml
> <key>ITSAppUsesNonExemptEncryption</key>
> <false/>
> ```
> Sem isso, App Store Connect pede pra preencher um formulário de export
> compliance toda release.

---

## 13. Screenshots — especificação técnica

### iOS App Store (obrigatório enviar pra cada device class)

| Display | Tamanho | Min | Max |
|---|---|---|---|
| iPhone 6.7" (Pro Max 14/15/16) | 1290×2796 px | 3 | 10 |
| iPhone 6.5" (XS Max / 11 Pro Max) | 1242×2688 px ou 1284×2778 | 3 | 10 |
| iPhone 5.5" (8 Plus) | 1242×2208 px | 3 | 10 — opcional Apple permite reusar 6.5 |
| iPad 12.9" (Pro) | 2048×2732 px | só se publicar pra iPad |

**Tip**: Se você só publicar pra iPhone, focar em **6.7"** (mais novo) — Apple
upscala/downscala pra outras telas se faltar. Mas tem que ter pelo menos
o 6.5" também.

### Google Play

| Tipo | Tamanho | Min | Max |
|---|---|---|---|
| Phone screenshot | 16:9 ou 9:16, mínimo 320 px lado curto, máximo 3840 px | 2 | 8 |
| 7" Tablet | só se publicar pra tablet | — | — |
| Feature graphic | 1024×500 px | obrigatório | — |
| Icon | 512×512 px (32-bit PNG with alpha) | obrigatório | — |

### Conteúdo recomendado pros 5 primeiros screenshots
1. **Feed** com posts reais e streak visível na top bar
2. **Story viewer** com heart de like + reactions
3. **Profile screen** com streak + monthly recap
4. **Direct message** com story reply
5. **Check-in screen** com mapa de academia

Apple/Google permitem screenshots com texto sobreposto explicando feature
(tipo "Mantenha o streak aceso", "Treino de verdade, não foto-shoot"). Mas
manter simples e mostrar o app real é mais authentic — reviewers
desconfiam de screenshots muito polidos.

---

## 14. Localizações suportadas

Versão alpha: **só Português (Brasil)**.

Adicionar inglês (en-US) e espanhol (es-419) faz sentido depois do alpha
quando descobrirmos onde a galera real tá usando.

---

## 15. Build Settings (Xcode + Android Studio)

### iOS
- **Deployment Target**: iOS 15.0 (cobre 99% dos iPhones ativos em 2026)
- **Supported Devices**: iPhone (iPad opcional pra próxima)
- **Build Settings → Architecture**: arm64 (default Xcode 16)
- **Capabilities ativas**: Push Notifications

### Android
- **minSdkVersion**: 24 (Android 7.0 — cobre ~96% dos devices ativos)
- **targetSdkVersion**: 34 (Capacitor 6 default; Play Store exige 33+ a partir de Aug 2025)
- **compileSdkVersion**: 34

---

## 16. Demo account pro Apple Review

Apple **exige** demo account quando o app tem auth. Crie um user de teste:

```
Username:  applereview
Email:     review@dudyfarias.com  (forward pro seu email)
Password:  GymCircle2026!
Birth:     2000-01-01
```

E preencha o "App Review Information":
- **Sign-In Required**: Yes
- **Demo Account Username**: applereview
- **Demo Account Password**: GymCircle2026!
- **Notes**: "Login via username (não email). Após login, o app abre direto no feed. Para testar publicação, toque no botão (+) flutuante. Para testar mensagens, abra qualquer perfil e toque no ícone de mensagem. Para testar exclusão de conta: Profile → Settings (engrenagem) → Excluir conta."

Se a conta de review precisar de dados pra mostrar (feed vazio = rejection
"app appears to be empty"), considere seedar 5-10 posts de exemplo nessa
conta antes de submeter.

---

## 17. Checklist de submission

- [ ] Bundle ID confirmado em ambos projetos nativos
- [ ] versionCode/versionName e Build/Version incrementados
- [ ] Permission strings em PT-BR injetadas via `npm run cap:patch:ios`
- [ ] `ITSAppUsesNonExemptEncryption = false` em Info.plist
- [ ] Privacy Nutrition Labels (iOS) preenchidos exatamente conforme §9
- [ ] Data Safety (Android) preenchidos exatamente conforme §10
- [ ] Screenshots em pelo menos 6.7" (iOS) e phone (Android)
- [ ] Demo account criada e dados de exemplo populados
- [ ] /privacy e /terms acessíveis em produção
- [ ] App Review Notes inclui credenciais demo + fluxo de teste
- [ ] App Store Description, Subtitle, Keywords copiados deste arquivo
- [ ] Categorias: Health & Fitness primary, Social Networking secondary
- [ ] Age Rating questionário respondido (12+/13+ esperado)

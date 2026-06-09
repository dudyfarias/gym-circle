# Gym Circle — Roadmap de Migração 100% Nativo (SwiftUI)

> **Objetivo:** sair do app **híbrido** (Capacitor + WKWebView carregando o
> site, com algumas telas SwiftUI por cima) para um app **100% nativo em
> Swift/SwiftUI**, sem WebView, sem dependência de deploy Vercel em runtime.

Data: 2026-06-09 · Status: planejamento · Estimativa: 30 sprints (~3-6 meses solo)

---

## 1. Estado atual (ponto de partida)

### Já é nativo (shippado via Capacitor bridge)
- `MyCircleView` (622 ln) — streak, calendário, hub de gamificação
- `AchievementsView` + `AchievementDetailView` + `AchievementCelebrationView`
- `OtherProfileView`, `EditProfileSheet`, `ProfileView`
- `MonthlyRecapSheet` + `RecapCoverPickerSheet` + `RecapPeriodPickerSheet`
- **Services nativos:** Auth, Achievements, Challenges, Follows, MyCircle,
  Profiles, Stories, GymCircleAPI, SupabaseClientProvider
- **Infra:** `SessionStore`, `GymCircleAppModel`, `GymCircleNativeRootView`,
  `BaseComponents` (GCText/GCButton/GCCard/GCAvatar), `GymCircleTheme`,
  `Haptics`, `L10n`, `PressableButtonStyle`, `ActivityRingsView`

### Scaffold (existe mas é esqueleto, não shippado)
- `MainTabView` (68 ln), `LoginView` (79), `FeedView` (120), `StoriesViews` (112)

### Ainda 100% web (dentro do WKWebView)
| Surface | Linhas web |
|---------|-----------|
| Chat / DMs (`ChatScreen`) | 1.336 |
| Criar post (`CheckInScreen`) | 896 |
| Post detail (`PostScreen`) | 842 |
| Profile próprio (`ProfileScreen`) | 398 |
| Feed (`FeedScreen` + componentes) | 356 + apoio |
| Streak (`StreakScreen`) | 132 |
| + ~37 componentes top-level, 22 arquivos de `social/`, 28 de design-system | ~26k |

### Arquitetura alvo
```
┌─ App nativo (SwiftUI) ────────────────────┐
│  MainTabView                              │
│   ├─ FeedTab      → FeedView nativo        │
│   ├─ SearchTab    → DiscoveryView nativo   │
│   ├─ CreateTab    → CreatePostFlow nativo  │
│   ├─ ActivityTab  → NotificationsView      │
│   └─ ProfileTab   → ProfileView (próprio)  │
│  Sheets/overlays: Stories, PostDetail,     │
│   Comments, Chat, Settings, MyCircle...    │
│                                            │
│  Camadas: Views → Stores → Services →      │
│           Supabase SDK (Swift) + Realtime  │
└────────────────────────────────────────────┘
   (Capacitor/WKWebView REMOVIDO)
   (site web continua existindo só p/ web/PWA)
```

---

## 2. Princípios

1. **Reuso máximo da Foundation** — todo sprint estende o package
   `GymCircleNativeFoundation`, não cria projeto novo.
2. **1 surface por sprint** — escopo fechado, commit + smoke a cada sprint.
3. **Paridade dirigida** — cada tela nativa é validada contra a web equivalente
   (mesmos dados, mesmas ações, mesmos edge cases).
4. **Não quebrar o que shippa** — durante a migração o híbrido continua de pé;
   o cutover (remover Capacitor) é o ÚLTIMO passo (Sprint 28).
5. **Dark premium UI mantida** — tokens `GymCircleTheme`, haptics, animações.
6. **Build verde + testes a cada sprint** — `xcodebuild` SUCCEEDED, suite passa.

---

## 3. Fases

| Fase | Sprints | Tema |
|------|---------|------|
| **A** | 1-6 | App shell + infra (auth, design, mídia, realtime, store) |
| **B** | 7-11 | Feed nativo |
| **C** | 12-14 | Stories nativo |
| **D** | 15-18 | Post detail + criação de post |
| **E** | 19-23 | Chat / DMs nativo |
| **F** | 24-27 | Search, Notifications, Settings, Profile próprio |
| **G** | 28-30 | Cutover (remover Capacitor), i18n/a11y/offline, QA + App Store |

---

## FASE A — App shell & infra (Sprints 1-6)

### Sprint N1 — App target real + navigation shell
**Objetivo:** um app SwiftUI standalone com tab bar e roteamento de sessão.
- Criar/repurpor um app target nativo (xcodegen `project.yml`) consumindo a
  Foundation. Não é o target Capacitor.
- `MainTabView` real com 5 tabs: Feed, Search, Create (botão central), Activity,
  Profile. `TabView` + `NavigationStack` por tab.
- Root gated por sessão: `SessionStore.isAuthenticated ? MainTabView : LoginView`.
- Splash/launch nativo.
- **Reusa:** `GymCircleNativeRootView`, `SessionStore`, `GymCircleAppModel`.
- **Saída:** app abre, tabs trocam, sessão restaurada do Keychain leva pro
  MainTabView; sem sessão cai no Login (mesmo que stub ainda).

### Sprint N2 — Auth nativo completo
**Objetivo:** login/signup/recuperação 100% nativo.
- `LoginView` real: email OU username + senha; toggle sign-in/sign-up.
- Signup com aceite legal (checkbox alpha terms + privacy) → grava
  `alpha_terms_accepted_at`/`privacy_policy_accepted_at`.
- Forgot-password (envia email) + reset (deep link `gymcircle://reset`).
- Persistência de sessão (Keychain), refresh token, logout.
- **Reusa:** `AuthService`, `SessionStore`. **Cria:** `SignUpView`,
  `ForgotPasswordView`, `ResetPasswordView`, validações inline.
- **Saída:** ciclo completo signup → confirm email → login → logout funciona em
  device real contra Supabase prod.

### Sprint N3 — Design system nativo (consolidação)
**Objetivo:** primitivos que TODA tela vai usar, prontos e testados.
- Auditar `BaseComponents` + `MyCircleComponents`; extrair/criar: `GCAvatar`
  (com story ring + presence), `GCBadgePill`, `GCChip`, `GCBottomSheet`
  (handle + `min(82dvh,720)`), `GCEmptyState`, `GCSkeleton`, `GCErrorState`,
  `GCToast`.
- Tipografia + spacing scale + cores consolidadas em `GymCircleTheme`.
- **Saída:** catálogo de componentes renderiza num preview; todas as telas
  futuras montam só com esses primitivos.

### Sprint N4 — Pipeline de mídia nativo
**Objetivo:** carregar/cachear imagens e tocar vídeo sem WebView.
- `MediaLoader` (paridade `MediaLoadingService`): cache LRU (NSCache + disco),
  variantes thumbnail/poster/original, blur placeholder (`blur_data_url`),
  cancelamento por scroll.
- `GCAsyncImage` (wrapper com placeholder/erro) e `GCVideoPlayer` (AVPlayer,
  mute autoplay, pause off-screen).
- **Saída:** grid e card de mídia carregam rápido com cache; vídeo toca/pausa
  conforme viewport.

### Sprint N5 — Supabase Realtime nativo
**Objetivo:** infra de tempo real para chat + notificações + presença.
- `RealtimeService`: canais por tabela (`direct_messages`, `notifications`,
  presence), reconnect com backoff (reusa `Retry.swift`), cleanup no deinit.
- Bridge pra os Stores observarem mudanças (`@Published` updates).
- **Saída:** um insert em `notifications` no DB aparece no app sem refresh.

### Sprint N6 — Social store + updates otimistas
**Objetivo:** estado social compartilhado (paridade `useSupabaseSocial`).
- `SocialStore` (`@MainActor ObservableObject`): cache de users, posts, likes,
  comments, follows; merge por chave; updates otimistas com rollback em erro.
- Services novos: `PostsService` (feed/detail), `LikesService`,
  `CommentsService`. Reusa `FollowsService`, `ProfilesService`.
- **Saída:** like otimista reflete na hora e reverte se a request falhar;
  cache de user alimenta qualquer tela.

---

## FASE B — Feed nativo (Sprints 7-11)

### Sprint N7 — Feed data + paginação
**Objetivo:** dados do feed nativo via `get_home_feed`.
- `FeedService.getHomeFeed(cursor, limit)` + modelo `EnrichedPost` (já existe
  `FeedPost`; estender). Cursor/`createdAt` pagination.
- Pull-to-refresh + infinite scroll (prefetch quando faltam ~5 itens).
- **Saída:** lista pagina e atualiza; feed mostra posts próprios + de quem segue.

### Sprint N8 — SocialPostCard nativo
**Objetivo:** o card de post (componente mais reusado do app).
- `SocialPostCard`: mídia (imagem/vídeo via N4), header do autor (avatar+nome+
  streak badge), legenda, contadores like/coment, localização, tipo de treino.
- Aspect ratio 4:5, gestos de tap.
- **Saída:** um post renderiza idêntico ao web, com mídia e metadados corretos.

### Sprint N9 — Interações do feed
**Objetivo:** ações sociais no card.
- Like (otimista, double-tap + botão), abrir comentários, abrir post detail,
  abrir perfil, follow CTA inline, menu do post (denunciar/bloquear/excluir/
  compartilhar).
- Haptics em cada ação.
- **Saída:** todas as ações do feed web funcionam nativas e otimistas.

### Sprint N10 — Stories tray + integração no feed
**Objetivo:** trilha de stories no topo do feed.
- `StoriesTray`: anéis (não visto = brand, visto = cinza), avatar do user 1º,
  tap abre viewer (placeholder até N12).
- `StoriesService.getActiveStoryGroups` (agrupado por autor).
- **Saída:** trilha aparece, estados de visto corretos, tap dispara o viewer.

### Sprint N11 — Polish + performance do feed
**Objetivo:** feed fluido e à prova de edge cases.
- Vídeo autoplay/pause no scroll, prefetch de mídia, skeleton no load, empty
  state, error/retry, scroll-to-top no tap da tab.
- QA de paridade vs `FeedScreen` web (8 itens de checklist).
- **Saída:** feed nativo substitui o web no smoke; 60fps no scroll.

---

## FASE C — Stories nativo (Sprints 12-14)

### Sprint N12 — Story viewer nativo
**Objetivo:** viewer full-screen estilo Instagram.
- `StoryViewerView`: progress bars por segmento, tap (próximo/anterior),
  hold (pausa), swipe (troca de autor), auto-advance, mídia imagem/vídeo.
- Sequência cross-author (navega entre grupos).
- **Saída:** abrir story do tray reproduz a sequência com gestos corretos.

### Sprint N13 — Interações + view tracking
**Objetivo:** reply, like, registro de visualização.
- Reply (vira DM), like de story, `story_views` insert no avanço, denunciar,
  silenciar autor, story tags (aceitar/recusar).
- **Saída:** ver story marca como visto (ring cinza); reply abre/cria conversa.

### Sprint N14 — Criação de story
**Objetivo:** publicar story nativo.
- Câmera/galeria (`PhotosPicker` + captura), upload pro bucket `stories`,
  tags de academia/tipo de treino, publish com expiração 24h.
- **Saída:** criar story aparece no próprio tray e no de quem segue.

---

## FASE D — Post detail + criação (Sprints 15-18)

### Sprint N15 — Post detail nativo
**Objetivo:** tela cheia do post (paridade `PostScreen`).
- `PostDetailView`: mídia grande, header, legenda, contadores, lista de likes,
  bloco de comentários (preview), ações.
- Resolução por ID (fetch se não estiver no cache — lição dos bugs 11.x).
- **Saída:** abrir post de qualquer lugar (feed, perfil, notificação) renderiza.

### Sprint N16 — Comentários nativo
**Objetivo:** sheet de comentários completa.
- `CommentsSheet`: lista, adicionar comentário (otimista), like de comentário,
  replies, realtime (novos comentários aparecem), denunciar/excluir.
- **Saída:** comentar/curtir comentário funciona otimista + realtime.

### Sprint N17 — Criação de post: mídia + câmera
**Objetivo:** captura e upload de mídia.
- `CreatePostFlow` parte 1: câmera (foto/vídeo) + galeria, crop/preview,
  downsample, upload com barra de progresso (paridade `CheckInScreen` mídia).
- **Saída:** capturar/selecionar mídia e subir pro Storage com preview.

### Sprint N18 — Criação de post: metadados + publish
**Objetivo:** academia, tipo, legenda, tags, publicar.
- Picker de academia (busca + mapa/coordenadas), tipo de treino, legenda,
  marcar participantes, publish → insere no feed + streak.
- **Saída:** post completo publicado aparece no feed e conta no streak.

---

## FASE E — Chat / DMs nativo (Sprints 19-23)

### Sprint N19 — Lista de conversas
**Objetivo:** inbox de DMs.
- `ChatListView`: conversas com preview da última mensagem, não-lidas,
  ordenação por recência, realtime (nova mensagem sobe a conversa).
- `ChatService.listConversations`.
- **Saída:** inbox lista conversas e atualiza em tempo real.

### Sprint N20 — Thread de mensagens
**Objetivo:** conversa 1:1 com mensagens.
- `ChatThreadView`: bolhas (enviadas/recebidas), enviar texto (otimista),
  receber realtime, paginação pra cima, read receipts, scroll-to-bottom.
- **Saída:** trocar mensagens texto em tempo real entre 2 contas.

### Sprint N21 — Mídia no chat
**Objetivo:** foto/vídeo em mensagens.
- Anexar foto/vídeo, upload, render inline, viewer de imagem, player de vídeo.
- **Saída:** enviar/receber mídia no chat funciona.

### Sprint N22 — Grupos + compartilhamento
**Objetivo:** conversas em grupo e share.
- Grupos (criar, participantes, nome), compartilhar post pro chat,
  delete-for-me, reabrir conversa apagada.
- **Saída:** grupo funciona; compartilhar post do feed pro chat funciona.

### Sprint N23 — Polish do chat
**Objetivo:** chat redondo.
- Typing/presence (se aplicável), silenciar, integração com bloqueio,
  estados vazios, QA de paridade vs `ChatScreen` web.
- **Saída:** chat nativo substitui o web no smoke.

---

## FASE F — Surfaces restantes (Sprints 24-27)

### Sprint N24 — Search / Discovery nativo
**Objetivo:** busca e descoberta de pessoas/academias.
- `DiscoveryView`: busca de @username, cards de descoberta, follow inline,
  busca de academia, "encontre quem treina perto".
- **Saída:** buscar e seguir usuário pela aba Search funciona.

### Sprint N25 — Notifications (sino) nativo
**Objetivo:** central de notificações nativa.
- `NotificationsView`: lista, hidratação de actor (lição bug 10.5/11.2),
  tap like/coment → post (bug 11.4), follow-back CTA com status real do DB
  (bug 11.3), follow requests aceitar/recusar, post/story tags.
- Mark-all-read, realtime, push tap → deep link pra surface certa.
- **Saída:** todos os comportamentos que corrigimos no web, nativos.

### Sprint N26 — Settings / Account nativo
**Objetivo:** configurações e gestão de conta.
- `SettingsView`: conta privada toggle, push toggle, usuários bloqueados,
  links legais (privacy/terms/support), excluir conta, logout, reativação.
- **Saída:** gerenciar conta + excluir conta nativo (fluxo App Store crítico).

### Sprint N27 — Profile próprio + Streak nativo
**Objetivo:** perfil do próprio user + streak screen.
- `MyProfileView`: grid de posts, entrada pra EditProfile (já nativo), entrada
  pro MyCircle (já nativo), featured achievements.
- `StreakScreen` nativo, profile completion prompts, contextual hints.
- **Saída:** aba Profile 100% nativa; tudo conecta com MyCircle/Edit já prontos.

---

## FASE G — Cutover & hardening (Sprints 28-30)

### Sprint N28 — Remover Capacitor / WKWebView
**Objetivo:** o app deixa de ser híbrido.
- Trocar o target Capacitor pelo app SwiftUI puro como produto shippado.
- Remover: `GymCircleNativeBridgePlugin`, `server.url`, `native-fallback`,
  plugins Capacitor não usados. Manter o site web só pra web/PWA.
- Deep links + Universal Links nativos (`gymcircle://`, apple-app-site-assoc).
- **Saída:** binário sem WebView; nenhuma tela carrega `vercel.app`.

### Sprint N29 — i18n + acessibilidade + offline
**Objetivo:** qualidade transversal.
- Sweep PT/EN de TODAS as strings nativas novas (L10n), VoiceOver labels,
  Dynamic Type, reduce-motion, offline (cache + fila de ações), error/retry
  consistente.
- **Saída:** app usável em EN, com VoiceOver, e degrada gracioso offline.

### Sprint N30 — QA de paridade + perf + App Store
**Objetivo:** lançar o app 100% nativo.
- Checklist de paridade end-to-end vs web (todas as surfaces), performance
  (cold launch, scroll, memória, vídeo), crash-free, regressão TestFlight,
  screenshots novos, bump de versão, submit.
- **Saída:** v2.0 nativo submetido à App Store.

---

## 4. Concerns transversais (atravessam vários sprints)

- **Realtime reconnect** — chat e notificações dependem de reconexão robusta.
- **Pipeline de mídia** — vídeo é o maior risco de performance/memória.
- **Updates otimistas** — concorrência: rollback correto em falha.
- **Paginação consistente** — feed, comentários, chat, busca.
- **i18n** — não deixar acumular pro fim; cada sprint já usa L10n.
- **Testes** — estender a suite Foundation a cada service/store novo.
- **Push deep-linking** — Sprint 25 + 28 conectam push tap → surface.

## 5. Definição de "100% nativo" (critérios de saída)

- [ ] Nenhuma tela carrega `WKWebView` / `vercel.app`
- [ ] Capacitor + bridge plugin removidos do target shippado
- [ ] Todas as surfaces da tabela §1 reescritas em SwiftUI
- [ ] Realtime (chat + notificações) nativo
- [ ] Paridade funcional validada surface a surface vs web
- [ ] i18n PT/EN completo, VoiceOver, Dynamic Type
- [ ] Build verde + suite de testes Foundation passando
- [ ] TestFlight sem regressão; App Store submetido

## 6. Riscos & mitigação

| Risco | Mitigação |
|-------|-----------|
| Chat realtime complexo | Sprint dedicado de infra (N5) antes do chat (N19+) |
| Vídeo no feed (memória/perf) | Pipeline de mídia próprio (N4) + pause off-screen |
| Dois codebases durante a migração | Híbrido continua de pé até o cutover (N28); migrar por surface |
| Paridade de edge cases (privacidade, bloqueio) | QA dirigido a cada surface; reusar RLS do servidor |
| Escopo escorregar | 1 surface por sprint, commit + smoke, sem misturar |

## 7. Nota estratégica

O app web **continua existindo** (produto web/PWA). Este roadmap entrega um
app iOS **independente do WebView**, mas cria a realidade de **manter duas
implementações** (web + Swift) a partir do cutover. Reavaliar a cada fase se o
ganho de "nativo" justifica o custo de manutenção dobrada — especialmente para
surfaces de baixa fricção (Settings, Search) onde o usuário não percebe a
diferença entre web e nativo.

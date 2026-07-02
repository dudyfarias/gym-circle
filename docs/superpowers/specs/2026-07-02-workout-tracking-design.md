# Rastreio de treino (estilo Strava) — design

Data: 2026-07-02
Status: design aprovado (brainstorm) — pronto pra plano de implementação (Fase 1)
Autor: Eduardo + Claude

## 1. Contexto e motivação

Hoje o Gym Circle registra treino de duas formas: **post** (foto/carrossel via composer)
e **check-in** (marca o dia sem foto, alimenta o streak; pode virar post depois via
`source_checkin_id` — shippado em 2/jul). Falta o que o Strava/Apple Fitness fazem:
**iniciar um treino e rastrear ao vivo** (tempo, ritmo, distância, altimetria, frequência
cardíaca, calorias) e **puxar treinos já gravados em outros apps** (Strava, Nike, Apple
Watch) que ficam no Apple Saúde.

O público principal do app treina **musculação/academia** (indoor), não corrida — então o
design é **academia-first**, com outdoor GPS como caso secundário.

Groundwork que já existe:
- `ios-native/.../Services/HealthKitService.swift` — `HealthKitProviding` com
  `requestReadAuthorization()` + `workouts(from:to:) -> [HealthWorkoutSummary]` (a leitura
  de treinos do Saúde já está meio pronta; herança do roadmap Sprint 5.6).
- `ios-native/.../Services/NativeLocationProvider.swift` — busca de academias
  (`kCLLocationAccuracyHundredMeters`, when-in-use). NÃO serve pra tracking contínuo.
- Entitlement `com.apple.developer.healthkit` já declarado.
- Padrão `source_checkin_id → post` (migration `20260701175012`) que este design reusa.

## 2. Decisões (do brainstorm)

| Fork | Decisão |
|---|---|
| Paridade web↔nativo | **Paridade de resultado com degradação graciosa**: a feature existe nos dois, muda a profundidade. |
| Tipos de treino | **Indoor (academia) + outdoor GPS** — academia é o primário. |
| HealthKit | **Completo**: ler FC/calorias do Apple Watch **e escrever** o treino no Apple Saúde. |
| Layout da tela ao vivo | **Data-first** (números em destaque; mapa só no modo outdoor). |
| Entrada | **Botão `+` central** (substitui a câmera) → hub: Iniciar treino / Postar treino / Check-in. |
| Apple Watch | **No escopo** (Fase 3). |
| Import de outros apps | **No escopo** — via HealthKit read, nativo-only ("registrar treino que já fez"). |
| Consistência visual | **Reusar os tokens/componentes atuais** (web e nativo) — nada de UI destoante. |

## 3. Escopo / não-escopo

**No escopo:** iniciar/rastrear treino (indoor + outdoor), timer de descanso programável,
resumo → CTA foto → post, atividade marca dia+streak, importar do HealthKit, app de Apple
Watch, versão enxuta no web (cronômetro + descanso + aviso).

**Fora (por ora):** séries/reps automáticas (HealthKit não conta rep — manual fica Fase 3),
planos de treino/rotinas prontas, segmentos/KOM estilo Strava, sync bidirecional (a gente
só LÊ do Saúde; escreve só o treino que a gente mesmo gravou), rastrear no web com GPS real.

## 4. As três origens de uma atividade

Toda atividade vira uma linha em `activities`, independente da origem, e pode virar post:

1. **`live`** — rastreada ao vivo no app nativo (CoreLocation + HealthKit).
2. **`web_timer`** — cronômetro do web (tempo + descanso; sem GPS/FC/calorias).
3. **`imported`** — puxada do Apple Saúde (gravada por Strava/Nike/Watch); guarda `source_app`.

As três: marcam o dia + streak, e são **postáveis** (source_activity_id) com foto opcional.

## 5. Fluxos

### 5.1 Iniciar treino (nativo)
`+` → **Iniciar treino** → **seletor de tipo** (cards estilo Apple Exercício: Treino de força,
Corrida ao ar livre, Caminhada, Pedalada, Outro — cada um com play; cards de academia mostram
"Descanso 90s ›", cards outdoor mostram "GPS + rota") → **tela ao vivo data-first** (layout B):
- Indoor: só números (duração, FC, calorias) + **timer de descanso** programável.
- Outdoor: números + mini-mapa com a rota ao vivo em azul elétrico + indicador "GPS forte".
- Controles: bloquear / pausar (azul) / encerrar (rosa). Auto-pause opcional (outdoor).
→ **Encerrar** → **resumo**: stats + nota "Dia marcado · streak mantido" + CTA **"Adicionar
foto do treino"** (secundário: "Salvar sem foto") → vira post via `source_activity_id`.

### 5.2 Iniciar treino (web — enxuto)
`+` → **Iniciar treino** → aviso "No app fica mais preciso — GPS, batimentos e calorias.
Aqui contamos o tempo e o descanso." → **cronômetro** do treino + **timer de descanso**
(60/90/120s + custom) → encerrar → resumo → CTA foto → post (`origin=web_timer`, sem
GPS/FC/calorias). Marca dia + streak igual.

### 5.3 Postar treino que já fez (import — nativo)
`+` → **Postar treino** → no composer, botão **"Anexar treino"** → **seletor de importação**
(lista de `HKWorkout` recentes com badge do app de origem: Strava/Nike/Apple Watch, tipo,
data, distância/duração/calorias/FC) → escolhe → cria `activity` (`origin=imported`,
`source_app`) e anexa ao post (foto opcional + stats + rota se houver).

### 5.4 Apple Watch (Fase 3)
Iniciar/pausar/encerrar do pulso, FC ao vivo do sensor, mirror com o iPhone; o resumo e o
CTA de foto acontecem no iPhone ao abrir.

## 6. Modelo de dados

Nova tabela `activities` (a atividade é a fonte; o post é o artefato):

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid | dono |
| `activity_type` | text | strength / run / walk / ride / other (mapeia HKWorkoutActivityType e workout_type) |
| `mode` | text | `session` (indoor) / `route` (outdoor) |
| `origin` | text | `live` / `web_timer` / `imported` |
| `source_app` | text null | só quando `imported` ("Strava", "Nike Run Club"...) |
| `started_at`, `ended_at` | timestamptz | |
| `elapsed_s`, `moving_s` | int | moving só outdoor |
| `distance_m`, `elevation_gain_m` | numeric null | só outdoor |
| `route` | jsonb/text null | polyline codificada (só outdoor com GPS) |
| `splits` | jsonb null | splits por km (outdoor) |
| `avg_hr`, `max_hr` | int null | do HealthKit/Watch |
| `active_calories`, `total_calories` | numeric null | do HealthKit |
| `workout_date` | date | pro streak/calendário |
| `created_at` | timestamptz default now() | |

- **`posts.source_activity_id` uuid** (FK → activities, igual ao `source_checkin_id`): índice
  único parcial + trigger validando que post e atividade são do mesmo user/dia.
- **`user_activity_days`**: uma atividade marca o dia (trigger `activities_after_insert`,
  espelho do trigger de check-in), com dedup — não conta 2× se já há check-in/atividade no dia.
- **RLS**: dono lê/escreve as suas; leitura de terceiros só via o post (que já tem RLS).
- **Import dedup**: filtrar `HKWorkout` cujo `source.name == "Gym Circle"` (não re-importar o
  que a gente escreveu); um `HKWorkout` já importado (por uuid do sample) não reaparece.

## 7. Motor nativo

- **`WorkoutTrackingService`** (novo, `@MainActor ObservableObject`): orquestra a sessão ao vivo.
  - GPS: `CLLocationManager` próprio, `kCLLocationAccuracyBestForNavigation`,
    `allowsBackgroundLocationUpdates`, `activityType = .fitness`. Acumula rota, distância
    (Haversine/`CLLocation.distance`), ritmo, altimetria; expõe qualidade do sinal.
  - Sessão/saúde: `HKWorkoutSession` + `HKLiveWorkoutBuilder` (indoor e outdoor) → FC/calorias
    ao vivo + **escreve o `HKWorkout` no Apple Saúde** ao encerrar.
  - Estados: `idle → requesting → active → paused → finishing → summary`; discard cancela sem salvar.
  - Timer de descanso: model próprio (presets + custom + haptics/som ao zerar).
- **`HealthKitService` estendido** (o `HealthKitProviding` que já existe):
  - Import: enriquecer `HealthWorkoutSummary` com `avg/max_hr` (query de `heartRate`), rota
    (`HKWorkoutRouteQuery`) e `source_app` (`sourceRevision.source.name`).
  - Write: `requestWriteAuthorization()` pros tipos do workout gravado ao vivo.
- **Info.plist**: `UIBackgroundModes: [location]`, `NSHealthShareUsageDescription`,
  `NSHealthUpdateUsageDescription`, `NSLocationWhenInUseUsageDescription` +
  `NSLocationAlwaysAndWhenInUseUsageDescription` (justificativas específicas p/ revisão Apple).
- **Watch (Fase 3)**: novo target WatchKit + `HKWorkoutSession` no relógio, transfere via
  `WCSession`/HealthKit mirroring.

## 8. Web (enxuto)

- Rota nova no PWA (dentro do hub `+`): cronômetro (elapsed) + **timer de descanso** (mesma
  UX de presets do nativo) + banner de aviso de precisão. Sem GPS/FC/calorias.
- Persistência anti-refresh: estado do timer em `localStorage` + `started_at` do servidor, pra
  não perder a contagem se recarregar.
- Ao encerrar: cria `activity` (`origin=web_timer`) via a mesma action/serviço do post →
  resumo → CTA foto → post.

## 9. Consistência visual (requisito)

Tudo reusa o design system atual — nada de tela destoante:
- **Nativo**: `GymCircleTheme` (ColorToken.electricBlue #30D5FF / cyan / pink, Radius.card 32,
  Spacing), `GCText`/`GCButton`/`GCCard`/`GCAvatar`/`StreakBadgeView`; o card do treino no feed
  = mesma estrutura do `FeedPostCard` (edge-to-edge, coração azul, header nome+streak) só com
  uma faixa de stats sobreposta na mídia.
- **Web**: tokens `--gc-blue`/`--gc-pink`/`--gc-brand`, `SocialPostCard`/`MediaCarousel`, os
  sheets/bottom-nav existentes. O hub `+` reusa o padrão de bottom-sheet dos overlays atuais.
- O post de atividade é **um post normal** com campos extras (via `source_activity_id`) — o
  feed, likes, comentários, perfil e realtime tratam igual, então a paridade sai de graça.

## 10. Paridade web↔nativo

| Capacidade | Nativo | Web |
|---|---|---|
| Iniciar treino + cronômetro | ✅ | ✅ |
| Timer de descanso | ✅ | ✅ |
| GPS/rota/ritmo/altimetria | ✅ | ❌ (aviso) |
| FC/calorias (HealthKit) | ✅ | ❌ (aviso) |
| Importar de outros apps | ✅ | ❌ |
| Ver o post da atividade no feed | ✅ | ✅ (idêntico) |
| Marca dia + streak | ✅ | ✅ |

Regra: **gravar** varia por plataforma; **ver o resultado** é idêntico (é um post).

## 11. Privacidade / App Store

- HealthKit é read + write (write só do treino gravado ao vivo). Usage descriptions
  específicas ("rastrear e registrar seus treinos"; "ler treinos de outros apps pra você
  compartilhar"). Nunca vender/compartilhar dado de saúde; só leitura pro que o user escolher.
- Background location precisa de justificativa clara ("rastrear a rota do seu treino").
- Copy de aviso no web reforça que dados finos vêm do app.

## 12. Edge cases / erros

- Permissão negada (HealthKit/localização): degrada — sessão segue com o que dá (ex.: sem FC),
  ou mostra CTA pra abrir Ajustes; nunca trava.
- Sinal GPS ruim: indicador + continua contando tempo; distância pausa até recuperar.
- App em background/morto no meio do treino: `HKWorkoutSession` sobrevive; a rota persiste
  incrementalmente pra recuperar o resumo.
- Import sem treinos / duplicado: empty-state; dedup por sample uuid e por `source==Gym Circle`.
- Streak: dedup de dia (atividade + check-in + post no mesmo dia = 1 dia).

## 13. Testes

- **Puros (Swift/TS)**: cálculo de distância/ritmo/altimetria a partir de `[CLLocation]`;
  mapeamento `HKWorkoutActivityType ↔ activity_type ↔ workout_type`; máquina de estados do
  tracking; math do timer de descanso; dedup de import.
- **DB**: trigger de dia/streak (dedup), trigger de `source_activity_id` (mesmo user/dia),
  RLS de `activities`.
- **Web**: action de criar activity/post (`origin=web_timer`); persistência do timer.
- Sensores (GPS/HR/Watch) só validam em device — smoke manual do Eduardo.

## 14. Faseamento

1. **Fase 1 (MVP, os dois lados):** tabela `activities` + `source_activity_id` + trigger de
   streak; hub `+` (Iniciar/Postar/Check-in) substituindo a câmera; seletor de tipo; **sessão
   de academia** (`HKWorkoutSession` duração/FC/calorias + escreve no Saúde) + **timer de
   descanso**; **import do HealthKit** (Strava etc.) no composer; resumo + CTA foto → post. Web
   enxuto (cronômetro + descanso + aviso). Consistência visual com o app atual.
2. **Fase 2:** outdoor GPS (`WorkoutTrackingService` com CoreLocation background + rota/ritmo/
   altimetria + mini-mapa ao vivo + imagem da rota no post).
3. **Fase 3:** app de Apple Watch (FC no pulso, iniciar do relógio), splits por km, séries/reps
   manuais.

Web acompanha cada fase só renderizando o post da atividade (paridade de resultado).

## 15. Riscos / decisões em aberto

| Risco | Mitigação |
|---|---|
| Revisão HealthKit da Apple (usage descriptions genéricas rejeitam) | copy específica por permissão; foco em "seus treinos" |
| FC ao vivo no iPhone sem Watch é limitada | Fase 1 entrega duração+calorias garantidos; FC do pulso vem no Watch (Fase 3); aviso honesto |
| Background location + bateria | BestForNavigation só durante o treino; para no encerrar; auto-pause |
| Escopo grande | faseado e shippável por fase; Fase 1 já entrega valor pro público academia |
| `activities` novo entra em realtime/notif/perfil | como vira **post**, herda tudo — não precisa de entidade nova no feed |
| Import duplicar dia/atividade | dedup por sample uuid, por `source==Gym Circle`, e dedup de dia no streak |

## Próximo passo

Plano de implementação da **Fase 1** (writing-plans), fatiado e verificável, seguindo as
regras do CLAUDE.md (branch main, `check:main`, deploy:preview normal, deploy:prod só quando
o Eduardo pedir, build nativo com bump + xcodegen + DEVELOPMENT_TEAM=0).

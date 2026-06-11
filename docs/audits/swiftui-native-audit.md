# Gym Circle — Auditoria SwiftUI Nativa (`ios-native/GymCircleNative`)

> Read-only, 11/jun/2026. 46 arquivos Swift; XcodeGen (`project.yml`) + SwiftPM (`Package.swift`).

## Estrutura

```
Sources/GymCircleNativeFoundation/
  App/        GymCircleAppModel (orquestração)
  Components/ (design system: rings, badges, rows)
  Config/     AppConfiguration (env-based)
  Models/     MyCircleModels, AchievementBuilder, MonthlyChallenge*
  Screens/    14 telas (Login, MainTab, Feed, Stories, Profile, OtherProfile,
              EditProfile, MyCircle, Achievements, AchievementDetail,
              AchievementCelebration, MonthlyRecap, RecapCover/PeriodPicker)
  Services/   9 services (Auth, SupabaseClientProvider, GymCircleAPI, MyCircle,
              Achievements, Challenges, Follows, Profiles, Stories)
  Theme/ Utilities/
Tests/        RetryTests, AchievementBuilderTests, CalendarBuilderTests
```

**Veredito de isolamento: bom.** O pacote é independente do Capacitor (consumido pelo app via plugin bridge), com camadas claras e testes nos builders puros.

## Respostas diretas

| Pergunta | Resposta |
|----------|----------|
| Está bem isolado? | Sim — SwiftPM próprio, sem dependência do shell Capacitor |
| Usa Supabase real? | Sim — supabase-swift com anon key + sessão real (SessionStore via bridge) |
| Está seguro? | Sem segredos hardcoded (verificado por grep). **Porém** `AppConfiguration.fromEnvironment()` lê `ProcessInfo.environment` — funciona em DEBUG (scheme do Xcode), **não existe em build de distribuição**. Hoje o app real injeta a config via bridge do Capacitor; para o app standalone será preciso injetar via Info.plist/xcconfig |
| Pronto pra próximas sprints? | Sim para as telas já portadas; ver lacunas abaixo |

## Drift TS ↔ Swift (risco nº 1 desta camada)

A gamificação existe DUAS vezes (`social/achievements.ts` e `AchievementBuilder.swift`). Todo fix de regra no web precisa de port manual. Drifts **já reais** hoje:

| Regra | Web (atual) | Swift (atual) | Efeito visível |
|-------|-------------|---------------|----------------|
| Tipos distintos (cross-trainer + desafio) | conta primária + tags `workout_types` (fix f4e1f0b) | conta só `workout_type` primária | Conquista earned no web, locked no nativo |
| Treino em grupo (desafio) | 1 participante accepted = grupo | n/a (ChallengesService é read-only, exibe o que o web gravou) | OK por arquitetura |
| Calendário mini-foto de vídeo | thumbnail→poster→nunca arquivo de vídeo (dbaa3d1) | **portado** em dbaa3d1 (`getMonthPosts`) — entra no próximo build | Paridade após build |

Outros pontos de drift potencial: shape das RPCs (`get_profile_posts` ganhou colunas novas — decoders Swift com campos opcionais aguentam, mas structs com campos NÃO opcionais derrubam o decode da lista inteira; padrão recomendado = tudo opcional + compactMap, como feito em `PostThumbnailRow`).

## Arquitetura de dados nativa

- `ChallengesService` é **read-only por design**: o recompute/sync de desafios roda só no web. Como o app é híbrido (web sempre boota), funciona. No app 100% nativo, o recompute precisa ser portado ou movido pra server-side (recomendado: server-side via RPC/cron — resolve web E nativo de uma vez).
- `MyCircleService` consulta posts por mês direto (sem janela de feed) — desenho melhor que o web tinha; o web convergiu pra isso na b1eca76.

## Validações executadas

- `swift test` (host macOS): **falha esperada de compilação** — `import UIKit` (MonthlyRecapSheet e outros) não existe no destino macOS. O pacote é iOS-only; testes devem rodar via `xcodebuild test -scheme GymCircleNative -destination 'platform=iOS Simulator,...'`.
- `xcodebuild` de simulador: **não executado nesta auditoria** (pesado; exige resolução de DerivedData/signing local). Recomendação: adicionar um lane de CI local (`scripts/native-test.sh`) que rode os 3 test targets no simulador.

## O que falta para ser o app nativo real (substituir o Capacitor)

| Bloco | Estado | Esforço |
|-------|--------|---------|
| Feed (leitura) | FeedView existe | Médio (paridade de interações: like, comment sheet, carrossel) |
| Composer (foto/vídeo/carrossel/upload) | Inexistente nativo | **Alto** (PHPicker + upload + posters) |
| Stories (captura + viewer completo) | Viewer parcial | Alto |
| Chat | Inexistente nativo | Alto |
| Push registration + deep link de notificação | Foundation existe (device_push_tokens) | Médio |
| Auth (login/social) | LoginView + AuthService | Médio (Apple/Google nativos) |
| Onboarding contextual | Inexistente nativo | Médio |
| Config de produção (URL/anon key) sem env | **Gap** (ver acima) | Baixo |

## Riscos da substituição do Capacitor

1. **Perda do "deploy remoto"**: hoje QUALQUER fix chega no app sem build (server.url). Nativo puro = todo fix passa por TestFlight/Review. Mitigação: manter híbrido por tela (estratégia atual) até o conjunto nativo estar maduro.
2. Dupla manutenção durante a transição (drift acima) — minimizar movendo regras pra server-side (RPCs) em vez de duplicar em 2 clients.
3. Sessão única (bridge atual injeta a sessão web) — no standalone, fluxo de auth nativo precisa ser o dono da sessão.

## Recomendações

1. Portar o fix multi-tags pro `AchievementBuilder.swift` no próximo build (paridade do Hall).
2. Padronizar decoders Swift com campos opcionais + compactMap (anti-fragilidade de RPC drift).
3. Criar `scripts/native-test.sh` (xcodebuild simulador) e rodar nas sprints nativas.
4. Definir a estratégia de config de produção do standalone (xcconfig + Info.plist).
5. Mover recompute de desafios pra server-side antes da fase nativa do MyCircle ficar standalone.

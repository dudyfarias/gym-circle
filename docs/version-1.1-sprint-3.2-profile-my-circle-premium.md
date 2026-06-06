# Gym Circle 1.1 - Sprint 3.2 - SwiftUI Profile + Meu Circle Premium

Data da auditoria inicial: 2026-06-02

Escopo desta etapa: auditoria obrigatoria antes de implementar. Nenhum componente, tela, servico, model, migration ou regra nova foi criado nesta etapa.

## Regra De Trabalho

Reutilizar > melhorar > recriar.

A Sprint 3.2 deve evoluir o app SwiftUI paralelo em `ios-native/GymCircleNative`, sem substituir o app Capacitor em `ios/App`, sem alterar o banco, sem criar RPCs novas e sem reativar Apple/Google Login.

# Auditoria Inicial

## Documentos Lidos

- `docs/version-1.1-master-plan.md`
- `docs/feature-discovery-audit.md`
- `docs/version-1.1-sprint-3-swiftui-native-foundation.md`
- `docs/version-1.1-sprint-3.1-swiftui-auth-feed.md`
- `docs/swiftui-native-app-foundation.md`
- `docs/swiftui-migration-plan.md`
- `docs/native-feel-roadmap.md`
- `docs/design-system.md`
- `docs/expo-reuse.md`
- `docs/version-1.1-sprint-1-stabilization.md`

## Componentes Reutilizados

- `ActivityRingsView` em `ios-native/GymCircleNative/Sources/GymCircleNativeFoundation/Components/ActivityRingsView.swift`.
- Componentes base SwiftUI: `GCText`, `GCButton`, `GCCard`, `GCGlassPanel`, `GCAvatar`, `GCLoadingView`, `GCErrorState`, `GCSkeletonBlock`, `GCEmptyState`.
- `ProfileView` existente como tela de perfil nativa read-only.
- `MyCircleView` existente como tela nativa read-only de consistencia.
- `MainTabView` existente com tabs Home, Circle, Criar, Chat e Perfil.
- `FeedView`, `StoriesTrayView` e `StoryViewerView` existentes como contexto de dados reais.
- Tokens de `GymCircleTheme`, alinhados ao `docs/design-system.md`.
- Do app web, usar como referencia de produto: `ProfileIdentity`, `AvatarConsistencyRings`, `ProfilePostsGrid`, `FollowListOverlay`, `MyCircleSheet`, `StreakBadge`, `ActivityCircle`, `AchievementBadge`, `StreakCard`.

## Componentes Melhorados

Componentes a evoluir, sem criar versoes paralelas:

- `ActivityRingsView`: transformar em rings premium definitivos semana/mes/ano, mantendo o mesmo nome e arquivo.
- `ProfileView`: evoluir para header premium com avatar centralizado, rings ao redor, nome, username, chips, bio, stats e posts.
- `MyCircleView`: evoluir para area premium com header, resumo, consistencia, calendario mensal, niveis e badges.
- `GCAvatar`: reaproveitar para avatar centralizado; melhorar apenas se precisar de crop/placeholder mais premium.
- `GCGlassPanel`/`GCCard`: reaproveitar para secoes, evitando cards duplicados e excesso visual.
- `MainTabView`: manter sheet/story e navegacao existentes; so ajustar wiring se o tap nos rings abrir Meu Circle.

## Componentes Novos

Nenhum componente novo foi criado nesta auditoria.

Possiveis subcomponentes internos permitidos apenas se reduzirem complexidade sem duplicar telas:

- `ProfileStatRow` ou equivalente local dentro de `ProfileView`.
- `MyCircleCalendarSection` ou equivalente local dentro de `MyCircleView`.
- `BadgeGrid` ou equivalente local dentro de `MyCircleView`.

Proibido criar duplicatas como `ActivityRingsViewV2`, `ProfileViewNew`, `MyCircleNew`, `BadgeService2` ou `GamificationServiceV2`.

## Servicos Reutilizados

- `AuthService`: autenticacao real Supabase email/senha.
- `SessionStore`: estado de sessao, restore e sign out.
- `SupabaseClientProvider`: criacao do client Supabase Swift.
- `GymCircleAPI`: RPCs e carregamento de perfil/posts/stories/feed.
- `MyCircleService`: leitura de `user_stats_live` e `user_activity_days`, calculando semana/mes/ano.
- Do app web/core como referencia de contrato: `profileService`, `statsService`, `followService`, `notificationService`.
- RPCs existentes: `get_home_feed`, `get_story_tray_lightweight`, `get_story_viewer_items`, `get_profile_posts`, `search_profiles`, `get_user_suggestions`.

## Servicos Novos

Nenhum servico novo deve ser criado nesta sprint antes de tentar estender os existentes.

Recomendacao: enriquecer `MyCircleService` para calendario/badges e `GymCircleAPI.currentProfile` para FullProfile antes de considerar qualquer novo servico.

## Models Reutilizados

- `UserProfile`
- `FeedPost` / `ProfilePost`
- `StoryAuthorGroup`
- `StoryItem`
- `GymCircleStats`
- `ConsistencyRings`
- `Badge`
- `MyCircleSummary`

Do web/core como referencia:

- `EnrichedUser`
- `GymUser`
- `UserStatsRow`
- `UserActivityDayRow`
- `StreakLevel`
- regras puras em `social/streak.ts`, `social/gamification.ts` e `packages/core/src/domain/streak.ts`.

## Models Novos

Nenhum model novo foi criado nesta auditoria.

Possiveis extensoes seguras dos models existentes:

- Adicionar campos opcionais em `UserProfile` para `instagramUsername`, `birthDate`, `sports`, `mainGymId`, `mainGymName`, `followersCount`, `followingCount`, `profileCompletionNoticeDismissed`, se a Sprint 3.2 precisar exibir esses dados.
- Adicionar campos em `GymCircleStats` para `checkInsCount`, `postsCount`, `streakRestoresAvailable` e restore metadata, se a UI de Meu Circle mostrar esses blocos.
- Adicionar estrutura simples de calendario mensal dentro de `MyCircleModels.swift` somente se `MyCircleView` precisar de identidade estavel no `ForEach`.

## Debitos Tecnicos Encontrados

- `UserProfile` Swift ainda e parcial: nao inclui instagram, birth date/age, sports, academia principal detalhada, followers/following, preferred times, profile completion dismissal ou account status.
- `GymCircleAPI.currentProfile` seleciona apenas `id,user_id,username,display_name,avatar_url,bio,fitness_goal,is_private`. Para perfil premium, deve buscar FullProfile explicito, sem depender de preview.
- `MyCircleService` calcula semana/mes/ano a partir de `user_activity_days`, mas ainda nao modela calendario mensal, badges, restauradores, check-ins ou posts count.
- `Badge` Swift existe, mas nao possui estado `earned`, descricao de bloqueio, progress ou regra derivada. A referencia correta de regra esta em `apps/web/src/components/gym-circle/social/gamification.ts`.
- Existem duas semanticas TypeScript de consistency rings: no app web `social/streak.ts` usa semana/mes/ano; em `packages/core/src/domain/streak.ts` ainda existe day/month/year por dias decorridos. Para Sprint 3.2, a semantica visual aprovada e semana/mes/ano.
- `GymCircleAPI` ainda tem `signIn`/`signOut`, mesmo com `AuthService` como dono da auth. Nao bloqueia, mas deve ser limpo quando seguro.
- Followers/following overlay existe no web, mas nao foi migrado para SwiftUI.
- O SwiftUI nao tem i18n; textos estao hardcoded em portugues. Aceitavel para fundacao, mas e debito se a versao nativa avancar.
- `ActivityRingsView` Swift mostra numero da semana no centro; a regra da Sprint 3.2 pede que streak nao fique dentro dos rings e que os rings representem apenas consistencia.
- Ainda nao ha haptic service nativo SwiftUI ligado ao tap dos rings; o web usa `simulateHaptic`.

## Funcionalidades Ja Existentes Descobertas

- App SwiftUI paralelo ja possui login real, session restore, feed read-only, story tray, story viewer, profile read-only e Meu Circle read-only.
- `ActivityRingsView` Swift ja desenha tres rings com `Shape.trim`, animacao e paleta azul/ciano.
- `MyCircleService` Swift ja le `user_stats_live` e `user_activity_days` e deduplica dias para semana/mes/ano.
- App web ja possui `ProfileIdentity` com avatar centralizado, rings ao redor, chips, bio e stats.
- App web ja possui `MyCircleSheet` com resumo 2x3, explicacao dos rings, calendario mensal, niveis e badges.
- App web ja possui regras puras de streak levels, pluralizacao, calendario mensal e progresso de consistencia.
- App web ja possui `FollowListOverlay` para seguidores/seguindo.
- Supabase ja possui `user_stats_live`, `user_activity_days`, `streak_restore_events`, `streak_restored_days`, `get_profile_posts` e RPCs de feed/stories.
- Supabase ja registra atividade por post/story e recalcula streak/badge via triggers/funcoes existentes.
- Restaurador de streak ja existe no backend e no dominio TypeScript.

## Funcionalidades Ainda Nao Migradas

- Header premium do perfil no SwiftUI com avatar + rings + chips + stats completos.
- Visual do `AvatarConsistencyRings` web ainda nao foi equivalente no SwiftUI.
- `MyCircleSheet` rico do web ainda nao foi migrado para `MyCircleView`.
- Calendario mensal nativo baseado em `user_activity_days`.
- Badges derivados de regras reais no SwiftUI.
- Niveis de streak no SwiftUI.
- Followers/following overlay no SwiftUI.
- Counts reais de seguidores/seguindo no SwiftUI.
- Academia principal detalhada no perfil SwiftUI.
- Instagram, idade/aniversario, esportes e horarios preferidos no perfil SwiftUI.
- Streak restores no Meu Circle SwiftUI.
- Monthly recap/share nao migrado para SwiftUI.
- Notificacoes, comentarios, likes interativos, chat, upload, push, Apple Maps e HealthKit continuam fora do escopo da Sprint 3.2.

## Decisao De Implementacao Para A Proxima Etapa

1. Melhorar `UserProfile`, `GymCircleStats`, `MyCircleSummary`, `GymCircleAPI` e `MyCircleService` antes de tocar na UI.
2. Evoluir `ActivityRingsView`, `ProfileView` e `MyCircleView` existentes.
3. Usar `ProfileIdentity` e `MyCircleSheet` do web como referencia de produto, nao como componente a duplicar literalmente.
4. Manter `ios/App` intocado.
5. Nao criar migrations/RPCs para a Sprint 3.2; usar tabelas e RPCs ja existentes.

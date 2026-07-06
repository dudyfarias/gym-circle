import Foundation
import Supabase

/// GymCircleAppModel — Sprint 8.3 reescrito (paridade auth real + MyCircle data).
///
/// Composição:
///   - SessionStore (Sprint 3.1) — estado de auth observable
///   - AuthService (Sprint 3.1) — Supabase auth actor
///   - MyCircleService (Sprint 3.2) — queries user_stats_live + user_activity_days
///   - GymCircleAPI (Sprint 3.0) — feed/stories read-only legado
///
/// Pipeline boot:
///   1. init(client) cria todos os services com mesma SupabaseClient
///   2. restoreSession() — tenta restaurar session do Keychain
///   3. loadInitialSurfaces() — feed + stories (legado)
///   4. loadMyCircle() — fetcha MyCircleViewData real via service
///
/// O Plugin Bridge consome `myCircleData` quando user toca rings.
/// Sprint 8.4+ vai integrar AchievementsService + ChallengesService
/// pra hidratar `highlightBadge` + `monthlyChallenges` reais.
@MainActor
public final class GymCircleAppModel: ObservableObject {
    // MARK: - Estado published (UI observa)

    @Published public private(set) var isLoading = false
    /// Boot terminou (restoreSession resolveu)? Enquanto false, o RootView
    /// mostra o splash — evita o flash da tela de login antes da sessão
    /// restaurar do Keychain.
    @Published public private(set) var hasBooted = false
    @Published public private(set) var error: String?
    @Published public private(set) var posts: [FeedPost] = []
    @Published public private(set) var checkins: [FeedCheckin] = []
    // Rastreio de treino — entradas de atividade do feed (get_home_activities).
    @Published public private(set) var activities: [FeedActivity] = []
    // Sprint 20.3a — paginação infinita do feed.
    @Published public private(set) var isLoadingMoreFeed = false
    @Published public private(set) var feedHasMore = true
    @Published public private(set) var stories: [StoryAuthorGroup] = []
    @Published public private(set) var profile: UserProfile?
    @Published public private(set) var profilePosts: [ProfilePost] = []

    /// Sprint 8.3 — MyCircleViewData hidratado via MyCircleService quando
    /// autenticado. Nil enquanto não carregar OU quando user é guest.
    @Published public private(set) var myCircleData: MyCircleViewData?

    // MARK: - Services (composição via init)

    /// Sprint 8.3 — auth observable. UI deve observar via @ObservedObject
    /// pra reagir a state changes (restoring/signedOut/signedIn).
    public let sessionStore: SessionStore?

    private let api: GymCircleAPI?
    /// Sprint 20.7 — localização do viewer pra distância no feed (paridade web
    /// useViewerLocation). Lazy: só liga o CoreLocation quando pedido.
    private lazy var locationProvider: NativeLocationProviding = AppleMapsLocationProvider()
    @Published public private(set) var viewerCoordinate: GymCircleCoordinate?
    // Sprint 20.7 — realtime (postgres_changes) pra liveness do feed/badges.
    private var realtimeChannel: RealtimeChannelV2?
    private var realtimeStreamTasks: [Task<Void, Never>] = []
    private var realtimeRefreshTask: Task<Void, Never>?
    private let myCircleService: MyCircleService?
    private let achievementsService: AchievementsService?
    private let challengesService: ChallengesService?
    private let profilesService: ProfilesService?
    private let followsService: FollowsService?
    // Sprint 10.1 — substitui hardcoded hasStory: false pelo dado real.
    private let storiesService: StoriesService?
    // Sprint 20.3b — comentários do feed (público: o CommentsSheet usa direto).
    public let commentsService: CommentsService?
    // Sprint 20.4a — publicação nativa (upload + posts + post_media).
    private let composerService: PostComposerService?
    // Sprint 20.3c — menu do post (mute/report) e participantes de grupo.
    private let safetyService: SafetyService?
    public let participantsService: PostParticipantsService?
    private var mutedUserIds: Set<String> = []
    // Users bloqueados (user_blocks) — filtra o feed igual ao mute.
    private var blockedUserIds: Set<String> = []
    // Sprint 20.7 — sino de notificações.
    private let notificationsService: NotificationsService?
    @Published public private(set) var unreadNotifications = 0
    // Sprint 20.6 — chat.
    private let chatService: ChatService?
    /// Badge da tab Conversas (paridade BottomNav web — soma dos unread).
    @Published public private(set) var unreadMessages = 0
    // Sprint 20.7b/Native P1 — APNs token lifecycle.
    private let pushService: NativePushNotificationsService?
    // Alpha admin (só leitura, gateado pra "dudy"). Exposto pro AdminPanelSheet.
    public let adminService: AdminService?
    // Native P2 — HealthKit foundation. No-op em devices sem Apple Saúde.
    private let healthKitProvider: HealthKitProviding

    // MARK: - State expandido pra Sprint 8.4

    /// Sprint 8.4 — array completo de achievements (todas 5 categorias)
    /// computado client-side via AchievementBuilder.buildAll após services
    /// retornarem. Re-publicado pra UI observar.
    @Published public private(set) var achievements: [Achievement] = []

    /// IDs de achievements ainda não celebrados. Drive AchievementCelebrationView
    /// queue na UI nativa (Sprint 8.7).
    @Published public private(set) var uncelebratedAchievementIds: [String] = []

    public var isAuthenticated: Bool {
        sessionStore?.isAuthenticated ?? false
    }

    /// Sprint 20.3b — atalho pro CommentsSheet (e futuros consumidores de UI).
    public var currentUserId: String? {
        sessionStore?.currentUserId
    }

    // MARK: - Init

    /// Construtor de produção: usa client Supabase real pra criar todos
    /// os services. Bridge Plugin chama essa quando inicializa
    /// AppModel pra apresentar MyCircleView nativa.
    public convenience init(client: SupabaseClient) {
        let authService = AuthService(client: client)
        let sessionStore = SessionStore(authService: authService)
        let api = GymCircleAPI(client: client)
        let myCircleService = MyCircleService(client: client)
        let achievementsService = AchievementsService(client: client)
        let challengesService = ChallengesService(client: client)
        let profilesService = ProfilesService(client: client)
        let followsService = FollowsService(client: client)
        let storiesService = StoriesService(client: client)
        let commentsService = CommentsService(client: client)
        let composerService = PostComposerService(client: client)
        let safetyService = SafetyService(client: client)
        let participantsService = PostParticipantsService(client: client)
        let notificationsService = NotificationsService(client: client)
        let chatService = ChatService(client: client)
        let pushService = NativePushNotificationsService(client: client)
        let adminService = AdminService(client: client)
        self.init(
            sessionStore: sessionStore,
            api: api,
            myCircleService: myCircleService,
            achievementsService: achievementsService,
            challengesService: challengesService,
            profilesService: profilesService,
            followsService: followsService,
            storiesService: storiesService,
            commentsService: commentsService,
            composerService: composerService,
            safetyService: safetyService,
            participantsService: participantsService,
            notificationsService: notificationsService,
            chatService: chatService,
            pushService: pushService,
            adminService: adminService,
            healthKitProvider: AppleHealthKitProvider()
        )
    }

    /// Construtor injetável pra preview/tests com mocks. Sem services
    /// = modo demo (loadInitialSurfaces popula com loadDemoData).
    public init(
        sessionStore: SessionStore? = nil,
        api: GymCircleAPI? = nil,
        myCircleService: MyCircleService? = nil,
        achievementsService: AchievementsService? = nil,
        challengesService: ChallengesService? = nil,
        profilesService: ProfilesService? = nil,
        followsService: FollowsService? = nil,
        storiesService: StoriesService? = nil,
        commentsService: CommentsService? = nil,
        composerService: PostComposerService? = nil,
        safetyService: SafetyService? = nil,
        participantsService: PostParticipantsService? = nil,
        notificationsService: NotificationsService? = nil,
        chatService: ChatService? = nil,
        pushService: NativePushNotificationsService? = nil,
        adminService: AdminService? = nil,
        healthKitProvider: HealthKitProviding = AppleHealthKitProvider()
    ) {
        self.sessionStore = sessionStore
        self.api = api
        self.myCircleService = myCircleService
        self.achievementsService = achievementsService
        self.challengesService = challengesService
        self.profilesService = profilesService
        self.followsService = followsService
        self.storiesService = storiesService
        self.commentsService = commentsService
        self.composerService = composerService
        self.safetyService = safetyService
        self.participantsService = participantsService
        self.notificationsService = notificationsService
        self.chatService = chatService
        self.pushService = pushService
        self.adminService = adminService
        self.healthKitProvider = healthKitProvider
    }

    // MARK: - Boot pipeline

    /// Restaura session do Keychain. Quando sucesso, dispara
    /// loadProfile + loadInitialSurfaces + loadMyCircle. Quando guest, popula
    /// demo data (modo preview).
    public func boot() async {
        guard let sessionStore else {
            loadDemoData()
            hasBooted = true
            return
        }
        await sessionStore.restoreSession()
        // Sessão resolvida (signedIn ou signedOut): libera o RootView pra
        // escolher MainTabView vs LoginView, encerrando o splash. Pra usuário
        // logado, as telas entram com skeleton enquanto os loads abaixo correm
        // — sem passar pela tela de login.
        hasBooted = true
        if sessionStore.isAuthenticated {
            // Sprint 8.11.1 — profile primeiro pq loadMyCircle usa
            // displayName/username/avatar/createdAt do profile.
            await loadProfile()
            await loadInitialSurfaces()
            await loadMyCircle()
            await syncPushTokenIfAuthorized()
        }
    }

    /// Login + boot completo. Wrapper que SessionStore signIn já cobre,
    /// mas garante data load depois.
    /// Sprint 22.1 — `identifier` aceita email OU username (paridade web).
    public func signIn(identifier: String, password: String) async throws {
        guard let sessionStore else {
            // Demo mode — login fake instantâneo
            loadDemoData()
            return
        }
        try await sessionStore.signIn(identifier: identifier, password: password)
        await loadProfile()
        await loadInitialSurfaces()
        await loadMyCircle()
        await syncPushTokenIfAuthorized()
    }

    // MARK: - Sprint 8.11.1 — profile loader

    /// Busca `profiles` row do user autenticado e popula `@Published profile`.
    /// Fail-soft: erro só seta `error` mas não interrompe o boot — UI cai
    /// no fallback `displayName = currentUserEmail`.
    public func loadProfile() async {
        guard let profilesService,
              let userId = sessionStore?.currentUserId else { return }
        do {
            profile = try await profilesService.getProfile(userId: userId)
        } catch {
            self.error = error.localizedDescription
        }
        // Posts do próprio user pro grid do Perfil + contador "Posts". Sem isso
        // o perfil mostrava sempre 0 posts e grid vazio (profilePosts nunca era
        // populado). Fail-soft: mantém o que tinha em caso de erro.
        if let api {
            profilePosts = (try? await api.profilePosts(userId: userId)) ?? profilePosts
        }
    }

    public func signOut() async {
        await stopRealtime()
        if let pushService, let userId = sessionStore?.currentUserId {
            try? await pushService.revokeCurrentToken(userId: userId)
        }
        await sessionStore?.signOut()
        // Limpa estado in-memory
        posts = []
        checkins = []
        activities = []
        stories = []
        profile = nil
        profilePosts = []
        myCircleData = nil
    }

    // MARK: - Competição (Sprint 19 — ranking sob demanda)

    /// Carrega o ranking (escopo × período) via RPC. Fail-soft em [] (paridade
    /// queryCircleRankingSurface web). A UI dispara ao abrir/trocar seleção.
    public func loadRanking(_ scope: RankingScope, _ period: RankingPeriod) async -> [CircleRankingRow] {
        guard let api else { return [] }
        do {
            return try await api.circleRanking(scope: scope, period: period)
        } catch {
            return []
        }
    }

    /// Sprint 20.7 — pede a localização do viewer (1x) pra calcular distância
    /// dos posts. Silencioso se negado/erro — o feed só não mostra distância.
    public func requestViewerLocation() async {
        guard viewerCoordinate == nil else { return }
        if let coordinate = try? await locationProvider.currentPosition() {
            viewerCoordinate = coordinate
        }
    }

    // MARK: - Realtime (Sprint 20.7 — paridade canal "supabase-social" do web)

    /// Tabelas que disparam refresh (espelha o canal único do web). Mudança em
    /// qualquer uma agenda um refresh debounced de feed + badges.
    private static let realtimeTables = [
        "posts", "post_likes", "post_comments", "post_participants",
        "stories", "story_likes", "follows", "checkins", "activities", "user_stats",
        "direct_messages", "conversations", "notifications",
    ]

    /// Assina postgres_changes das tabelas-chave e mantém o feed/badges vivos.
    /// Só no modo real (api presente). Idempotente.
    public func startRealtime() async {
        guard let api, realtimeChannel == nil else { return }
        let channel = await api.realtimeChannel("supabase-social-native")
        for table in Self.realtimeTables {
            let stream = channel.postgresChange(AnyAction.self, schema: "public", table: table)
            let task = Task { [weak self] in
                for await _ in stream {
                    // Task herda o @MainActor do AppModel; scheduleRealtimeRefresh
                    // é síncrono no mesmo ator, então não precisa de await.
                    self?.scheduleRealtimeRefresh()
                }
            }
            realtimeStreamTasks.append(task)
        }
        // subscribe() foi deprecado em favor de subscribeWithError(); fail-soft
        // (try?) mantém o realtime best-effort, igual ao comportamento antigo.
        try? await channel.subscribeWithError()
        realtimeChannel = channel
    }

    public func stopRealtime() async {
        realtimeRefreshTask?.cancel()
        realtimeRefreshTask = nil
        realtimeStreamTasks.forEach { $0.cancel() }
        realtimeStreamTasks.removeAll()
        if let channel = realtimeChannel {
            await channel.unsubscribe()
        }
        realtimeChannel = nil
    }

    /// Debounce 0,6s — coalesce rajadas de eventos num refresh leve.
    private func scheduleRealtimeRefresh() {
        realtimeRefreshTask?.cancel()
        realtimeRefreshTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 600_000_000)
            guard !Task.isCancelled, let self else { return }
            await self.refreshFeed()
            await self.refreshUnreadMessages()
            await self.refreshUnreadNotifications()
        }
    }

    // MARK: - Surfaces

    public func loadInitialSurfaces() async {
        guard let api else {
            loadDemoData()
            return
        }

        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            async let feed = api.homeFeed()
            async let checkinFeed = api.homeCheckins()
            async let activityFeed = api.homeActivities()
            async let tray = api.storyTray()
            let feedPosts = try await feed
            checkins = (try? await checkinFeed) ?? []
            activities = (try? await activityFeed) ?? []
            stories = try await tray
            feedHasMore = feedPosts.count >= Self.feedPageSize
            posts = await hydrateCarouselMedia(feedPosts)
        } catch {
            self.error = error.localizedDescription
        }
        await startRealtime()
    }

    // MARK: - Sprint 20.3a — feed interativo (carrossel, like, paginação)

    private static let feedPageSize = 30

    /// Hidrata media[] (carrossel Sprint 13) + participantes (20.3c) em
    /// queries únicas agrupadas, e filtra autores silenciados. Fail-soft:
    /// qualquer satélite falhando degrada (capa única / sem participantes)
    /// sem quebrar o feed.
    private func hydrateCarouselMedia(_ feedPosts: [FeedPost]) async -> [FeedPost] {
        guard let api, !feedPosts.isEmpty else { return feedPosts }

        // Mute + block filter: atualiza as listas no load e esconde os posts de
        // autores silenciados (post_mutes) E bloqueados (user_blocks) — paridade
        // web. Sem isso, um user bloqueado reaparecia no feed após reabrir o app
        // (o block só ficava no banco; o feed não recarregava o conjunto).
        if let safetyService, let userId = sessionStore?.currentUserId {
            if let muted = try? await safetyService.mutedUserIds(userId: userId) {
                mutedUserIds = muted
            }
            if let blocked = try? await safetyService.blockedUserIds(userId: userId) {
                blockedUserIds = blocked
            }
        }
        let hidden = mutedUserIds.union(blockedUserIds)
        let visible = feedPosts.filter { !hidden.contains($0.userId) }
        guard !visible.isEmpty else { return [] }

        let postIds = visible.map(\.id)
        // Resiliência (bug "carrossel some no refresh"): se o batch de post_media
        // FALHAR (rede instável no pull-to-refresh), NÃO colapsa pra mídia única
        // — reusa o carrossel que já tínhamos pros mesmos posts. Sucesso com
        // dicionário vazio = posts realmente sem carrossel (mídia única), aí ok.
        let mediaByPost: [String: [PostMediaItem]]
        if let fetched = try? await api.postMedia(postIds: postIds) {
            mediaByPost = fetched
        } else {
            mediaByPost = Dictionary(
                uniqueKeysWithValues: posts.compactMap { existing in
                    existing.media.map { (existing.id, $0) }
                }
            )
        }
        let participantsByPost =
            (try? await participantsService?.listForPosts(postIds: postIds)) ?? [:]

        return visible.map { post in
            var updated = post
            updated.media = mediaByPost[post.id]
            updated.participants = participantsByPost[post.id]
            return updated
        }
    }

    /// Pull-to-refresh: recarrega feed + tray sem ligar o skeleton
    /// (`isLoading`) — o spinner do gesto já dá o feedback.
    public func refreshFeed() async {
        guard let api else { return }
        // Limpa o erro ao re-tentar (mesmo padrão de loadInitialSurfaces): um
        // retry bem-sucedido some com o estado de erro em vez de deixá-lo preso.
        error = nil
        do {
            async let feed = api.homeFeed()
            async let checkinFeed = api.homeCheckins()
            async let activityFeed = api.homeActivities()
            async let tray = api.storyTray()
            let feedPosts = try await feed
            checkins = (try? await checkinFeed) ?? checkins
            activities = (try? await activityFeed) ?? activities
            stories = (try? await tray) ?? stories
            feedHasMore = feedPosts.count >= Self.feedPageSize
            posts = await hydrateCarouselMedia(feedPosts)
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Próxima página via cursor de created_at (mesmo contrato do
    /// get_home_feed da web). Dedup defensivo contra post repetido na
    /// borda do cursor.
    public func loadMoreFeed() async {
        guard let api, feedHasMore, !isLoadingMoreFeed,
              let cursor = posts.last?.createdAt else { return }
        isLoadingMoreFeed = true
        defer { isLoadingMoreFeed = false }
        do {
            let nextPage = try await api.homeFeed(cursorCreatedAt: cursor)
            feedHasMore = nextPage.count >= Self.feedPageSize
            let hydrated = await hydrateCarouselMedia(nextPage)
            let knownIds = Set(posts.map(\.id))
            posts.append(contentsOf: hydrated.filter { !knownIds.contains($0.id) })
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Sprint 20.3b — o CommentsSheet reporta deltas (+1 comentou, -N
    /// apagou com replies) e o badge do card fica exato sem refetch.
    public func adjustCommentsCount(postId: String, delta: Int) {
        guard let index = posts.firstIndex(where: { $0.id == postId }) else { return }
        posts[index].commentsCount = max(0, posts[index].commentsCount + delta)
    }

    /// Curtir/descurtir com update otimista: UI responde na hora, erro de
    /// rede reverte o estado e expõe `error`.
    public func toggleLike(postId: String) async {
        guard let api,
              let userId = sessionStore?.currentUserId,
              let index = posts.firstIndex(where: { $0.id == postId }) else { return }
        let wasLiked = posts[index].likedByMe ?? false
        posts[index].likedByMe = !wasLiked
        posts[index].likesCount = max(0, posts[index].likesCount + (wasLiked ? -1 : 1))
        do {
            try await api.setLike(postId: postId, userId: userId, liked: !wasLiked)
        } catch {
            if let revertIndex = posts.firstIndex(where: { $0.id == postId }) {
                posts[revertIndex].likedByMe = wasLiked
                posts[revertIndex].likesCount = max(
                    0,
                    posts[revertIndex].likesCount + (wasLiked ? 1 : -1)
                )
            }
            self.error = error.localizedDescription
        }
    }

    /// Sprint 8.3 + 8.4 — fetcha TUDO pra MyCircleViewData: stats reais,
    /// monthly challenges, achievements computados client-side via
    /// AchievementBuilder, featured/highlight via AchievementSuggester.
    ///
    /// Quando services ausentes ou erro, fallback graceful pra demo data.
    public func loadMyCircle() async {
        guard let sessionStore, let myCircleService else {
            myCircleData = MyCircleViewData.demo(
                userId: profile?.userId ?? "demo-user",
                isOwn: true
            )
            return
        }
        guard let userId = sessionStore.currentUserId else {
            myCircleData = nil
            return
        }

        do {
            // 1. Stats reais (Sprint 8.3)
            let summary = try await myCircleService.getSummary(userId: userId)

            // 2. Monthly challenges + posts do mês corrente em paralelo
            // (Sprint 8.4 + 8.13.1)
            async let challengesTask: [MonthlyChallenge] = {
                guard let challengesService else { return [] }
                return (try? await challengesService.loadChallenges(userId: userId)) ?? []
            }()
            let currentMonth = Self.monthKey(offsetFromToday: 0)
            async let monthPostsTask: [MonthCalendarPost] =
                (try? await myCircleService.getMonthPosts(userId: userId, monthKey: currentMonth, includeTagged: true)) ?? []
            // Sprint 8.13.2 — paralelo: distinct types em 7d + gyms em 30d
            // alimentam achievements secret cross-trainer e explorer
            async let distinctTypesTask: Int =
                (try? await myCircleService.getDistinctWorkoutTypes(userId: userId, sinceDaysAgo: 7)) ?? 0
            async let distinctGymsTask: Int =
                (try? await myCircleService.getDistinctGyms(userId: userId, sinceDaysAgo: 30)) ?? 0
            // Sprint 10.1 — story ring no avatar (P0 #1 fechado).
            // hasStory = tem story ativa (<24h). storyViewed = você já abriu a
            // sua própria story ativa (paridade web `currentUserStoryGroup
            // .viewed`): ring aceso só com story NÃO-vista, apaga ao ver.
            async let hasStoryTask: Bool = {
                guard let storiesService else { return false }
                return (try? await storiesService.hasActiveStory(userId: userId)) ?? false
            }()
            async let storyViewedTask: Bool = {
                guard let storiesService else { return false }
                return (try? await storiesService.hasViewedActiveStories(
                    targetUserId: userId, viewerUserId: userId)) ?? false
            }()
            let challenges = await challengesTask
            let monthPosts = await monthPostsTask
            let distinctTypes = await distinctTypesTask
            let distinctGyms = await distinctGymsTask
            let hasStory = await hasStoryTask
            let storyViewed = await storyViewedTask

            // 3. Computa achievements client-side via builder
            // Sprint 8.11.1 — todos inputs hidratados via MyCircleSummary +
            // profile real. Antes ficavam hardcoded 0/nil/false, deixando
            // ~7 achievements sociais permanentemente trancados.
            let builderInput = AchievementBuilder.Input(
                postsCount: summary.postsCount,
                longestStreak: summary.stats.bestStreak,
                workoutsThisMonth: summary.stats.workoutsThisMonth,
                workoutsThisWeek: summary.stats.workoutsThisWeek,
                activeDaysCount: summary.stats.workoutsThisYear,
                followersCount: summary.followersCount,
                hasUsedStreakRestore: summary.hasUsedStreakRestore,
                createdAt: profile?.createdAt,
                monthlyChallenges: challenges,
                distinctWorkoutTypesIn7Days: distinctTypes,
                distinctGymsIn30Days: distinctGyms
            )
            let allAchievements = AchievementBuilder.buildAll(input: builderInput)
            achievements = allAchievements

            let earnedCount = allAchievements.filter(\.earned).count
            let totalCount = allAchievements.count
            let highlight = AchievementSuggester.nextAchievement(achievements: allAchievements)
                ?? AchievementSuggester.suggestFeatured(achievements: allAchievements, count: 1).first

            // 4. Uncelebrated queue (Sprint 7.5.11 — Sprint 8.7 vai mostrar overlay)
            if let achievementsService {
                uncelebratedAchievementIds = (try? await achievementsService.getUncelebratedAchievementIds(userId: userId)) ?? []
            }

            myCircleData = MyCircleViewData(
                userId: userId,
                isOwn: true,
                displayName: profile?.displayName ?? profile?.username ?? sessionStore.currentUserEmail ?? "Você",
                username: profile?.username ?? "me",
                avatarURL: profile?.avatarURL.flatMap(URL.init(string:)),
                stats: summary.stats,
                calendarDays: CalendarBuilder.buildMonth(
                    monthKey: currentMonth,
                    workoutDays: summary.workoutDays,
                    todayKey: Self.todayKey(),
                    posts: monthPosts
                ),
                currentLevel: StreakLevel.current(for: summary.stats.currentStreak),
                allLevels: StreakLevel.all,
                highlightBadge: highlight,
                nextBadge: highlight,
                earnedCount: earnedCount,
                totalAchievements: totalCount,
                monthlyChallenges: challenges,
                streakLitToday: profile?.badgeIsActiveToday ?? false,
                // Story ring: aceso só com story ativa NÃO-vista; apaga ao ver
                // (paridade web — antes era hardcoded false).
                hasStory: hasStory,
                storyViewed: storyViewed,
                // Sprint 20.1 — paridade 15.5 web: equipados → sugeridos,
                // e a lista completa alimenta o Hall aberto pela row.
                featuredAchievements: AchievementSuggester.resolveFeatured(
                    achievements: allAchievements,
                    equippedCompositeIds: profile?.featuredAchievements ?? []
                ),
                allAchievements: allAchievements,
                // Sprint 22.x — cards Posts + Restauradores do grid 2x3 (paridade web).
                postsCount: summary.postsCount,
                streakRestoresAvailable: summary.streakRestoresAvailable
            )
        } catch {
            self.error = error.localizedDescription
            myCircleData = MyCircleViewData.demo(userId: userId, isOwn: true)
        }
    }

    /// MyCircle de OUTRO user (paridade web `targetUserId`): monta um
    /// MyCircleViewData com isOwn:false pra ver ao tocar no avatar do perfil.
    /// Privado sem follow aprovado → canSeeDetails:false (a view mostra só
    /// header + lock). Seções "só dono" (desafios, restauradores, recap,
    /// competição) ficam vazias. Fail-soft: cada fetch degrada pra default.
    public func fetchOtherMyCircle(userId: String) async -> MyCircleViewData? {
        guard let myCircleService else { return nil }
        // Perfil + status de follow num fetch só (define canSeeDetails).
        guard let other = await fetchOtherProfileSummary(userId: userId) else { return nil }
        let p = other.profile
        let canSeeDetails = !p.isPrivate || other.isFollowingAuthor
        let displayName = p.displayName ?? p.username
        let username = p.username
        let avatarURL = p.avatarURL.flatMap(URL.init(string:))

        // Privado não-seguido: só header + lock (usa o streak público já vindo).
        guard canSeeDetails else {
            return MyCircleViewData(
                userId: userId,
                isOwn: false,
                displayName: displayName,
                username: username,
                avatarURL: avatarURL,
                stats: GymCircleStats(currentStreak: other.currentStreak, bestStreak: other.bestStreak),
                currentLevel: StreakLevel.current(for: other.currentStreak),
                canSeeDetails: false,
                streakLitToday: p.badgeIsActiveToday,
                postsCount: other.postsCount
            )
        }

        // Detalhes liberados: mesmo fan-out do loadMyCircle, mas pro alvo.
        let summary = (try? await myCircleService.getSummary(userId: userId))
            ?? MyCircleSummary(stats: GymCircleStats())
        let currentMonth = Self.monthKey(offsetFromToday: 0)
        let viewerId = sessionStore?.currentUserId
        async let monthPostsTask: [MonthCalendarPost] =
            (try? await myCircleService.getMonthPosts(userId: userId, monthKey: currentMonth)) ?? []
        async let distinctTypesTask: Int =
            (try? await myCircleService.getDistinctWorkoutTypes(userId: userId, sinceDaysAgo: 7)) ?? 0
        async let distinctGymsTask: Int =
            (try? await myCircleService.getDistinctGyms(userId: userId, sinceDaysAgo: 30)) ?? 0
        async let hasStoryTask: Bool = {
            guard let storiesService else { return false }
            return (try? await storiesService.hasActiveStory(userId: userId)) ?? false
        }()
        async let storyViewedTask: Bool = {
            guard let storiesService, let viewerId else { return false }
            return (try? await storiesService.hasViewedActiveStories(
                targetUserId: userId, viewerUserId: viewerId)) ?? false
        }()
        let monthPosts = await monthPostsTask
        let distinctTypes = await distinctTypesTask
        let distinctGyms = await distinctGymsTask
        let hasStory = await hasStoryTask
        let storyViewed = await storyViewedTask

        let builderInput = AchievementBuilder.Input(
            postsCount: summary.postsCount,
            longestStreak: summary.stats.bestStreak,
            workoutsThisMonth: summary.stats.workoutsThisMonth,
            workoutsThisWeek: summary.stats.workoutsThisWeek,
            activeDaysCount: summary.stats.workoutsThisYear,
            followersCount: summary.followersCount,
            hasUsedStreakRestore: summary.hasUsedStreakRestore,
            createdAt: p.createdAt,
            monthlyChallenges: [],
            distinctWorkoutTypesIn7Days: distinctTypes,
            distinctGymsIn30Days: distinctGyms
        )
        let allAchievements = AchievementBuilder.buildAll(input: builderInput)
        let highlight = AchievementSuggester.nextAchievement(achievements: allAchievements)
            ?? AchievementSuggester.suggestFeatured(achievements: allAchievements, count: 1).first

        return MyCircleViewData(
            userId: userId,
            isOwn: false,
            displayName: displayName,
            username: username,
            avatarURL: avatarURL,
            stats: summary.stats,
            calendarDays: CalendarBuilder.buildMonth(
                monthKey: currentMonth,
                workoutDays: summary.workoutDays,
                todayKey: Self.todayKey(),
                posts: monthPosts
            ),
            currentLevel: StreakLevel.current(for: summary.stats.currentStreak),
            allLevels: StreakLevel.all,
            highlightBadge: highlight,
            nextBadge: highlight,
            earnedCount: allAchievements.filter(\.earned).count,
            totalAchievements: allAchievements.count,
            monthlyChallenges: [],
            canSeeDetails: true,
            streakLitToday: p.badgeIsActiveToday,
            hasStory: hasStory,
            storyViewed: storyViewed,
            featuredAchievements: AchievementSuggester.resolveFeatured(
                achievements: allAchievements,
                equippedCompositeIds: p.featuredAchievements
            ),
            allAchievements: allAchievements,
            postsCount: summary.postsCount,
            streakRestoresAvailable: 0
        )
    }

    // MARK: - Sprint 20.3c — menu do post + participantes

    /// Silencia o autor: some do feed na hora e persiste em post_mutes.
    public func muteAuthor(authorId: String) async {
        guard let safetyService, let userId = sessionStore?.currentUserId else { return }
        mutedUserIds.insert(authorId)
        posts.removeAll { $0.userId == authorId }
        do {
            try await safetyService.muteAuthor(userId: userId, mutedUserId: authorId)
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Denuncia o post (tabela reports — mesma do web).
    public func reportPost(postId: String, authorId: String) async {
        guard let safetyService, let userId = sessionStore?.currentUserId else { return }
        do {
            try await safetyService.reportPost(
                reporterId: userId,
                postId: postId,
                reportedUserId: authorId
            )
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Denuncia um USER (perfil de outra pessoa) — paridade web reportUser.
    @discardableResult
    public func reportUser(userId target: String) async -> Bool {
        guard let safetyService, let userId = sessionStore?.currentUserId else { return false }
        do {
            try await safetyService.reportUser(reporterId: userId, reportedUserId: target)
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    /// Bloqueia um user — persiste em user_blocks, esconde os posts dele do feed
    /// na hora (paridade web blockUser + filtro de bloqueados).
    @discardableResult
    public func blockUser(userId target: String) async -> Bool {
        guard let safetyService, let userId = sessionStore?.currentUserId else { return false }
        blockedUserIds.insert(target)
        posts.removeAll { $0.userId == target }
        do {
            try await safetyService.blockUser(blockerId: userId, blockedId: target)
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    /// Apaga o próprio post (remoção otimista; erro recarrega o feed).
    public func deletePost(postId: String) async {
        guard let api, let userId = sessionStore?.currentUserId else { return }
        let backup = posts
        posts.removeAll { $0.id == postId }
        do {
            try await api.deletePost(postId: postId, userId: userId)
            await loadMyCircle()
        } catch {
            posts = backup
            self.error = error.localizedDescription
        }
    }

    /// Aceita/recusa marcação de treino em grupo no post dado.
    public func respondToInvite(postId: String, accepted: Bool) async {
        guard let participantsService,
              let userId = sessionStore?.currentUserId,
              let index = posts.firstIndex(where: { $0.id == postId }) else { return }
        do {
            try await participantsService.respond(
                postId: postId,
                taggedUserId: userId,
                accepted: accepted
            )
            var updated = posts[index]
            updated.participants = (updated.participants ?? []).map { participant in
                guard participant.taggedUserId == userId else { return participant }
                return PostParticipant(
                    postId: participant.postId,
                    taggedUserId: participant.taggedUserId,
                    status: accepted ? "accepted" : "rejected",
                    username: participant.username,
                    displayName: participant.displayName,
                    avatarURL: participant.avatarURL
                )
            }
            posts[index] = updated
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Aceita/recusa marcação de post a partir do SINO — não depende do post
    /// estar no feed (diferente de respondToInvite). Atualiza o feed local se
    /// o post estiver carregado, mas funciona mesmo se não estiver.
    @discardableResult
    public func respondToPostTag(postId: String, accepted: Bool) async -> Bool {
        guard let participantsService, let userId = sessionStore?.currentUserId else { return false }
        do {
            try await participantsService.respond(
                postId: postId,
                taggedUserId: userId,
                accepted: accepted
            )
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    /// Quem curtiu (LikesSheet) — passthrough da API.
    public func fetchPostLikers(postId: String) async -> [PostParticipant] {
        guard let api else { return [] }
        return (try? await api.postLikers(postId: postId)) ?? []
    }

    /// Busca de pessoas (PeopleSearchSheet) — RPC search_profiles.
    public func searchProfiles(query: String) async -> [DiscoveredProfile] {
        guard let api, !query.trimmingCharacters(in: .whitespaces).isEmpty else { return [] }
        return (try? await api.searchProfiles(query: query)) ?? []
    }

    // MARK: - Sprint 20.4a/b — publicação nativa

    public enum ComposerMediaInput: Sendable {
        case photo(Data)
        case video(Data)
    }

    /// Etapa 1 do composer: envia em sequência e devolve somente referências
    /// leves do Storage. A tela pode então liberar Data/UIImage antes de abrir
    /// legenda, teclado, localização e participantes.
    public func prepareComposerMedia(
        media: [ComposerMediaInput],
        onProgress: ((Int, Int) -> Void)? = nil
    ) async -> [PostComposerService.UploadedMedia]? {
        guard let composerService,
              let userId = sessionStore?.currentUserId,
              !media.isEmpty else { return [] }
        do {
            var uploads: [PostComposerService.UploadedMedia] = []
            onProgress?(0, media.count)
            for item in media {
                switch item {
                case .photo(let data):
                    uploads.append(
                        try await composerService.uploadImage(userId: userId, imageData: data)
                    )
                case .video(let data):
                    uploads.append(
                        try await composerService.uploadVideo(userId: userId, videoData: data)
                    )
                }
                onProgress?(uploads.count, media.count)
            }
            return uploads
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    /// Etapa 2 do composer: publica referências já enviadas. Nenhum Data bruto
    /// de foto/vídeo precisa permanecer em memória enquanto o teclado aparece.
    public func publishPreparedPost(
        media: [PostComposerService.UploadedMedia],
        caption: String,
        workoutTypes: [String],
        gym: GymOption? = nil,
        taggedUserIds: [String] = [],
        // Paridade web (PostScreen destinations): feed e/ou story, ambos default
        // ligados. Story-only não cria post (só story); feed-only não cria story.
        postToFeed: Bool = true,
        postToStory: Bool = true,
        // "Registrar treino" (post retroativo): YYYY-MM-DD de um dia já treinado
        // sem mídia. Quando setado, vai SÓ pro feed com created_at backdatado
        // (não sobe no topo do feed; preenche calendário/perfil).
        workoutDate: String? = nil,
        // Rastreio de treino: post nascido de uma activity gravada — a entrada
        // some do feed (promovida) e volta se o post for apagado.
        sourceActivityId: String? = nil
    ) async -> Bool {
        let isBackdated = workoutDate != nil
        let wantsFeed = isBackdated ? true : postToFeed
        let wantsStory = isBackdated ? false : postToStory
        guard let composerService,
              let userId = sessionStore?.currentUserId,
              !media.isEmpty,
              wantsFeed || wantsStory else { return false }
        do {
            if wantsFeed {
                let postId = try await composerService.publish(
                    userId: userId,
                    medias: media,
                    caption: caption,
                    workoutTypes: workoutTypes,
                    workoutDate: workoutDate ?? Self.todayKey(),
                    // Backdata o created_at ao meio-dia (SP) do dia treinado.
                    createdAt: workoutDate.map { "\($0)T12:00:00-03:00" },
                    sourceActivityId: sourceActivityId,
                    gymId: gym?.id,
                    locationName: gym?.name,
                    locationLatitude: gym?.latitude,
                    locationLongitude: gym?.longitude,
                    locationGoogleMapsURL: Self.googleMapsURL(for: gym)
                )
                // Marcações são best-effort: post já está no ar. Só no feed
                // (story não tem participantes).
                if !taggedUserIds.isEmpty {
                    try? await participantsService?.tag(
                        postId: postId,
                        taggedByUserId: userId,
                        taggedUserIds: taggedUserIds
                    )
                }
            }
            if wantsStory, let cover = media.first {
                try? await storiesService?.createStory(
                    userId: userId,
                    media: cover,
                    gymId: gym?.id,
                    workoutType: workoutTypes.first
                )
            }
            await refreshFeed()
            await loadMyCircle()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    /// Compatibilidade com callers antigos: prepara e publica em uma chamada.
    public func publishPost(
        media: [ComposerMediaInput],
        caption: String,
        workoutTypes: [String],
        gym: GymOption? = nil,
        taggedUserIds: [String] = [],
        postToFeed: Bool = true,
        postToStory: Bool = true,
        workoutDate: String? = nil,
        onProgress: ((Int, Int) -> Void)? = nil
    ) async -> Bool {
        guard let uploads = await prepareComposerMedia(
            media: media,
            onProgress: onProgress
        ), !uploads.isEmpty else { return false }
        return await publishPreparedPost(
            media: uploads,
            caption: caption,
            workoutTypes: workoutTypes,
            gym: gym,
            taggedUserIds: taggedUserIds,
            postToFeed: postToFeed,
            postToStory: postToStory,
            workoutDate: workoutDate
        )
    }

    /// Converte um check-in sem mídia em post social completo. Os uploads já
    /// chegam prontos do sheet; o vínculo source_checkin_id faz a troca de card
    /// no feed sem apagar o check-in que sustenta streak/calendário.
    public func promoteCheckin(
        _ checkin: FeedCheckin,
        medias: [PostComposerService.UploadedMedia],
        caption: String,
        workoutTypes: [String],
        gym selectedGym: GymOption? = nil
    ) async -> Bool {
        guard let composerService,
              let userId = sessionStore?.currentUserId,
              checkin.userId == userId,
              !medias.isEmpty else { return false }
        do {
            let gym: GymOption?
            if let selectedGym {
                gym = selectedGym
            } else {
                gym = await fetchGym(id: checkin.gymId)
            }
            guard let gym else { return false }
            let sourceCheckinId = gym.id == checkin.gymId
                ? checkin.id
                : try await composerService.updateCheckinLocation(
                    checkinId: checkin.id,
                    gymId: gym.id
                )
            let coordinates: (latitude: Double, longitude: Double)?
            if let latitude = gym.latitude, let longitude = gym.longitude {
                coordinates = (latitude, longitude)
            } else if let latitude = checkin.gymLatitude,
                      let longitude = checkin.gymLongitude {
                coordinates = (latitude, longitude)
            } else {
                coordinates = nil
            }
            let mapsURL = Self.googleMapsURL(
                latitude: coordinates?.latitude,
                longitude: coordinates?.longitude,
                fallback: [
                    gym.name,
                    gym.address,
                    gym.city,
                    gym.state,
                ]
                .compactMap { $0 }
                .filter { !$0.isEmpty }
                .joined(separator: ", ")
            )
            _ = try await composerService.publish(
                userId: userId,
                medias: medias,
                caption: caption,
                workoutTypes: workoutTypes,
                workoutDate: checkin.checkinDate,
                createdAt: checkin.createdAt,
                sourceCheckinId: sourceCheckinId,
                gymId: gym.id,
                locationName: gym.name,
                locationLatitude: coordinates?.latitude,
                locationLongitude: coordinates?.longitude,
                locationGoogleMapsURL: mapsURL
            )
            await refreshFeed()
            await loadMyCircle()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    /// Sprint 20.4b — edita caption/tags do próprio post e atualiza o
    /// feed local sem refetch.
    public func updatePost(
        postId: String,
        caption: String,
        workoutTypes: [String],
        gym: GymOption?,
        media: [PostComposerService.EditMediaItem]? = nil
    ) async -> Bool {
        guard let composerService, sessionStore?.currentUserId != nil else { return false }
        do {
            try await composerService.updatePost(
                postId: postId,
                caption: caption,
                workoutTypes: workoutTypes,
                gymId: gym?.id
            )
            // Paridade editPost web (Sprint 14): media != nil substitui o
            // carrossel inteiro + capa via setMedia.
            if let media {
                try await composerService.setMedia(postId: postId, items: media)
            }
            await refreshFeed()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    public func updateCheckin(_ checkin: FeedCheckin, gym: GymOption) async -> Bool {
        guard let composerService,
              let userId = sessionStore?.currentUserId,
              checkin.userId == userId else { return false }
        do {
            _ = try await composerService.updateCheckinLocation(
                checkinId: checkin.id,
                gymId: gym.id
            )
            await refreshFeed()
            await loadMyCircle()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    public func convertPostToCheckin(postId: String, gym: GymOption) async -> Bool {
        guard let composerService else { return false }
        do {
            _ = try await composerService.convertPostToCheckin(
                postId: postId,
                gymId: gym.id
            )
            await refreshFeed()
            await loadMyCircle()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    // MARK: - Rastreio de treino (Fase 1 — sessão de academia)

    /// Encerra a sessão: salva o treino no Apple Saúde (best-effort), lê
    /// FC média/kcal da janela (ex.: Apple Watch gravando junto) e grava a
    /// activity no Supabase — a ENTRADA aparece no feed via get_home_activities
    /// e os triggers marcam dia + streak. Retorna o contexto pro composer.
    public func finishNativeWorkout(
        kind: WorkoutActivityKind,
        startedAt: Date,
        endedAt: Date,
        elapsedS: Int? = nil,
        // Fase 2 (GPS outdoor): rota gravada → mode "route" + métricas.
        route: WorkoutRouteSummary? = nil,
        // P2: séries de musculação (só treino de força).
        strengthSets: [WorkoutStrengthSet]? = nil
    ) async -> ActivityComposerContext? {
        guard let api, let userId = sessionStore?.currentUserId else {
            self.error = Loc.t(
                "Sign in to save your workout.",
                "Entre na sua conta pra salvar o treino."
            )
            return nil
        }
        let elapsed = max(
            0,
            elapsedS ?? Int(endedAt.timeIntervalSince(startedAt).rounded())
        )
        var stats = WorkoutSessionHealthStats(averageHeartRate: nil, activeKilocalories: nil)
        if healthKitProvider.isAvailable {
            try? await healthKitProvider.requestWorkoutSessionAuthorization()
            try? await healthKitProvider.saveWorkout(
                activityKind: kind.rawValue,
                start: startedAt,
                end: endedAt
            )
            stats = await healthKitProvider.sessionStats(from: startedAt, to: endedAt)
        }
        do {
            let iso = ISO8601DateFormatter()
            let workoutDate = Self.dateKey(for: startedAt)
            let activityId = try await api.createActivity(
                userId: userId,
                activityType: kind.rawValue,
                startedAt: iso.string(from: startedAt),
                endedAt: iso.string(from: endedAt),
                elapsedS: elapsed,
                workoutDate: workoutDate,
                avgHr: stats.averageHeartRate,
                activeCalories: stats.activeKilocalories,
                mode: route == nil ? "session" : "route",
                distanceM: route?.distanceM,
                movingS: route?.movingS,
                elevationGainM: route?.elevationGainM,
                routePoints: route?.points,
                strengthSets: (strengthSets?.isEmpty ?? true) ? nil : strengthSets
            )
            await refreshFeed()
            await loadMyCircle()
            return ActivityComposerContext(
                id: activityId,
                kind: kind,
                elapsedS: elapsed,
                workoutDate: workoutDate,
                avgHr: stats.averageHeartRate,
                activeCalories: stats.activeKilocalories
            )
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    /// Treinos recentes do Apple Saúde (Strava/Nike/Watch…) pro import.
    /// Pede permissão de leitura primeiro; fail-soft: [] sem acesso/amostras.
    public func recentHealthWorkouts(days: Int = 14) async -> [HealthWorkoutSummary] {
        guard healthKitProvider.isAvailable else { return [] }
        try? await healthKitProvider.requestReadAuthorization()
        let end = Date()
        let start = Calendar.current.date(byAdding: .day, value: -days, to: end) ?? end
        return (try? await healthKitProvider.workouts(from: start, to: end)) ?? []
    }

    /// Importa um treino do Saúde como ENTRADA no feed (origin imported).
    /// O UUID do HKWorkout em external_id barra duplicata (23505 → mensagem
    /// amigável). Dia/streak marcados no workout_date REAL do treino.
    public func importHealthWorkout(
        _ workout: HealthWorkoutSummary
    ) async -> ActivityComposerContext? {
        guard let api, let userId = sessionStore?.currentUserId else {
            self.error = Loc.t(
                "Sign in to import workouts.",
                "Entre na sua conta pra importar treinos."
            )
            return nil
        }
        let elapsed = max(0, Int(workout.durationSeconds.rounded()))
        do {
            let iso = ISO8601DateFormatter()
            let workoutDate = Self.dateKey(for: workout.startDate)
            let activityId = try await api.createActivity(
                userId: userId,
                activityType: workout.activityKind,
                startedAt: iso.string(from: workout.startDate),
                endedAt: iso.string(from: workout.endDate),
                elapsedS: elapsed,
                workoutDate: workoutDate,
                activeCalories: workout.activeEnergyKilocalories,
                origin: "imported",
                sourceApp: workout.sourceName,
                externalId: workout.id
            )
            await refreshFeed()
            await loadMyCircle()
            return ActivityComposerContext(
                id: activityId,
                kind: WorkoutActivityKind(rawValue: workout.activityKind) ?? .other,
                elapsedS: elapsed,
                workoutDate: workoutDate,
                activeCalories: workout.activeEnergyKilocalories
            )
        } catch {
            let description = "\(error)"
            if description.contains("23505") || description.lowercased().contains("duplicate") {
                self.error = Loc.t(
                    "This workout was already imported.",
                    "Esse treino já foi importado."
                )
            } else {
                self.error = error.localizedDescription
            }
            return nil
        }
    }

    /// "Integrar treino": treinos do dia do post ainda livres pra juntar.
    public func mergeableActivities(workoutDate: String) async -> [MergeableActivity] {
        guard let api else { return [] }
        return (try? await api.mergeableActivities(workoutDate: workoutDate)) ?? []
    }

    /// Integra o treino no post — o post recebe as estatísticas e o treino
    /// some do feed (sem duplicar). Refresh no sucesso.
    public func integrateWorkoutIntoPost(postId: String, activityId: String) async -> Bool {
        guard let api else { return false }
        do {
            try await api.mergeActivityIntoPost(postId: postId, activityId: activityId)
            await refreshFeed()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    /// Salva legenda/tags/local NA ENTRADA (treino sem foto) — paridade web
    /// saveActivityEntry. O treino já está no feed; isso completa as infos.
    public func saveActivityEntry(
        activityId: String,
        caption: String,
        workoutTypes: [String],
        gym: GymOption?
    ) async -> Bool {
        guard let api else { return false }
        do {
            try await api.updateActivityEntry(
                activityId: activityId,
                caption: caption,
                workoutTypes: workoutTypes,
                gymId: gym?.id,
                locationName: gym?.name,
                locationLatitude: gym?.latitude,
                locationLongitude: gym?.longitude,
                locationGoogleMapsURL: Self.googleMapsURL(for: gym)
            )
            await refreshFeed()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    public func createComposerCheckin(gym: GymOption, workoutDate: String?) async -> Bool {
        guard let api, let userId = sessionStore?.currentUserId else { return false }
        do {
            try await api.checkIn(
                userId: userId,
                gymId: gym.id,
                checkinDate: workoutDate
            )
            await refreshFeed()
            await loadMyCircle()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    /// Upload de foto avulsa pro edit de mídia (mesmas variantes do publish).
    public func uploadEditImage(data: Data) async -> PostComposerService.UploadedMedia? {
        guard let composerService, let userId = sessionStore?.currentUserId else { return nil }
        do {
            return try await composerService.uploadImage(userId: userId, imageData: data)
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    /// Vídeo novo adicionado ao editar um post (carrossel). Reusa o uploadVideo
    /// do composer (cap suave 1080p + poster), pra o edit aceitar vídeo igual ao
    /// composer e ao web.
    public func uploadEditVideo(data: Data) async -> PostComposerService.UploadedMedia? {
        guard let composerService, let userId = sessionStore?.currentUserId else { return nil }
        do {
            return try await composerService.uploadVideo(userId: userId, videoData: data)
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    /// Sugestões de pessoas (estado inicial da busca — RPC get_user_suggestions).
    public func fetchSuggestions() async -> [DiscoveredProfile] {
        guard let api else { return [] }
        return (try? await api.userSuggestions()) ?? []
    }

    // MARK: - Sprint 20.6 — chat

    public func fetchChatThreads() async -> [ChatThread] {
        guard let chatService, let userId = sessionStore?.currentUserId else { return [] }
        let threads = (try? await chatService.threads(currentUserId: userId)) ?? []
        // Badge da tab (web soma os unread no boot via mesma RPC).
        unreadMessages = threads.reduce(0) { $0 + ($1.summary.unreadCount ?? 0) }
        return threads
    }

    /// Atualiza só o badge (boot/refresh do feed) sem montar a tela de chat.
    public func refreshUnreadMessages() async {
        _ = await fetchChatThreads()
    }

    /// Paridade Fase 2 (web sharePostToChat): manda o post como DM — body +
    /// mídia do post. Retorna sucesso pra UI dar feedback.
    @discardableResult
    public func sharePostToChat(post: FeedPost, receiverId: String) async -> Bool {
        guard let chatService else { return false }
        let isOwn = post.userId == currentUserId
        let body = isOwn
            ? Loc.t("Shared my workout on Gym Circle.", "Compartilhei meu treino no Gym Circle.")
            : Loc.t("Shared @\(post.username)'s workout on Gym Circle.",
                    "Compartilhei o treino de @\(post.username) no Gym Circle.")
        do {
            _ = try await chatService.sendDirect(
                receiverId: receiverId,
                body: body,
                mediaURL: post.imageURL,
                mediaType: post.mediaType?.rawValue
            )
            await refreshUnreadMessages()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    public func fetchChatMessages(conversationId: String) async -> [ChatMessage] {
        guard let chatService else { return [] }
        let page = (try? await chatService.messages(conversationId: conversationId)) ?? []
        // RPC devolve mais-recentes-primeiro; UI quer cronológico.
        return page.sorted { $0.createdAt < $1.createdAt }
    }

    /// Sprint 22.x — resolve remetentes (username/nome/avatar) pra rotular
    /// bolhas em grupo. Fail-soft: lista vazia se não houver service.
    public func fetchChatSenderChips(userIds: [String]) async -> [DiscoveredProfile] {
        guard let chatService else { return [] }
        return (try? await chatService.senderChips(userIds: userIds)) ?? []
    }

    public func sendDirectMessage(receiverId: String, body: String) async -> ChatMessage? {
        guard let chatService else { return nil }
        do {
            return try await chatService.sendDirect(receiverId: receiverId, body: body)
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    public func sendGroupMessage(conversationId: String, body: String) async -> ChatMessage? {
        guard let chatService else { return nil }
        do {
            return try await chatService.sendGroup(conversationId: conversationId, body: body)
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    public func sendChatImage(
        conversationId: String?,
        peerUserId: String?,
        isGroup: Bool,
        imageData: Data,
        isVideo: Bool = false
    ) async -> ChatMessage? {
        guard let chatService, let userId = sessionStore?.currentUserId else { return nil }
        let mediaType = isVideo ? "video" : "image"
        do {
            let url = try await chatService.uploadImage(
                userId: userId,
                data: imageData,
                fileExtension: isVideo ? "mp4" : "jpg",
                contentType: isVideo ? "video/mp4" : "image/jpeg"
            )
            if let conversationId, isGroup {
                return try await chatService.sendGroup(
                    conversationId: conversationId,
                    body: nil,
                    mediaURL: url,
                    mediaType: mediaType
                )
            }
            if let peerUserId {
                return try await chatService.sendDirect(
                    receiverId: peerUserId,
                    body: nil,
                    mediaURL: url,
                    mediaType: mediaType
                )
            }
            if let conversationId {
                return try await chatService.sendGroup(
                    conversationId: conversationId,
                    body: nil,
                    mediaURL: url,
                    mediaType: mediaType
                )
            }
            return nil
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    public func createGroupConversation(name: String, memberIds: [String]) async -> String? {
        guard let chatService else { return nil }
        do {
            return try await chatService.createGroup(name: name, memberIds: memberIds)
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    public func markConversationRead(conversationId: String) async {
        guard let chatService else { return }
        try? await chatService.markRead(conversationId: conversationId)
    }

    public func deleteConversationForMe(conversationId: String) async {
        guard let chatService else { return }
        do {
            try await chatService.deleteForMe(conversationId: conversationId)
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Sprint 20.5 — reply de story por DM (fecha a pendência do viewer).
    @discardableResult
    public func sendStoryReply(
        authorId: String,
        storyId: String,
        previewURL: String?,
        text: String
    ) async -> Bool {
        guard let chatService else { return false }
        do {
            try await chatService.sendDirect(
                receiverId: authorId,
                body: text,
                storyId: storyId,
                replyToStory: true,
                storyPreviewURL: previewURL
            )
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    // MARK: - Sprint 20.7 — notificações

    public func fetchNotifications() async -> [AppNotification] {
        guard let notificationsService, let userId = sessionStore?.currentUserId else { return [] }
        return (try? await notificationsService.list(userId: userId)) ?? []
    }

    public func refreshUnreadNotifications() async {
        guard let notificationsService, let userId = sessionStore?.currentUserId else { return }
        unreadNotifications = (try? await notificationsService.unreadCount(userId: userId)) ?? 0
    }

    public func markNotificationsRead() async {
        guard let notificationsService, let userId = sessionStore?.currentUserId else { return }
        try? await notificationsService.markAllRead(userId: userId)
        unreadNotifications = 0
    }

    /// Post único (routing do sino) — já hidratado com carrossel.
    public func fetchPost(postId: String) async -> FeedPost? {
        guard let api, let userId = sessionStore?.currentUserId else { return nil }
        guard let post = try? await api.fetchPost(postId: postId, viewerId: userId) else { return nil }
        return await hydrateCarouselMedia([post]).first
    }

    // MARK: - Sprint 20.5 — stories viewer

    /// Stories ativos de um autor (RPC get_story_viewer_items).
    public func fetchStoryItems(authorId: String) async -> [StoryItem] {
        guard let api else { return [] }
        return (try? await api.storyViewerItems(authorId: authorId)) ?? []
    }

    /// Marca visto + atualiza o ring da tray localmente (hasUnseen).
    public func markStorySeen(storyId: String) async {
        guard let storiesService, let userId = sessionStore?.currentUserId else { return }
        try? await storiesService.markSeen(storyId: storyId, userId: userId)
    }

    @discardableResult
    public func setStoryLike(storyId: String, liked: Bool) async -> Bool {
        guard let storiesService, let userId = sessionStore?.currentUserId else { return false }
        do {
            try await storiesService.setLike(storyId: storyId, userId: userId, liked: liked)
            return true
        } catch {
            return false
        }
    }

    @discardableResult
    public func muteStoryAuthor(authorId: String) async -> Bool {
        guard let storiesService, let userId = sessionStore?.currentUserId else { return false }
        do {
            try await storiesService.muteStories(userId: userId, mutedUserId: authorId)
            stories.removeAll { $0.authorId == authorId }
            Haptics.success()
            return true
        } catch {
            self.error = error.localizedDescription
            Haptics.error()
            return false
        }
    }

    /// Apaga a própria story (paridade web `deleteStory`). O viewer fecha na UI.
    @discardableResult
    public func deleteStory(storyId: String) async -> Bool {
        guard let storiesService, let userId = sessionStore?.currentUserId else { return false }
        do {
            try await storiesService.remove(storyId: storyId, userId: userId)
            Haptics.success()
            return true
        } catch {
            self.error = error.localizedDescription
            Haptics.error()
            return false
        }
    }

    /// Denuncia a story de outro user (paridade web `reportStory`).
    @discardableResult
    public func reportStory(storyId: String, authorId: String) async -> Bool {
        guard let storiesService, let userId = sessionStore?.currentUserId else { return false }
        do {
            try await storiesService.report(
                storyId: storyId,
                reportedUserId: authorId,
                reporterId: userId
            )
            Haptics.success()
            return true
        } catch {
            self.error = error.localizedDescription
            Haptics.error()
            return false
        }
    }

    // MARK: - Sprint 20.2 — Settings (privacidade + conta)

    /// Toggle de perfil privado (profiles.is_private).
    public func setPrivacy(isPrivate: Bool) async {
        await saveProfile(displayName: nil, bio: nil, fitnessGoal: nil, isPrivate: isPrivate)
    }

    /// Suspende a conta e desloga (reativação por magic link é fluxo web).
    public func suspendAccount() async {
        guard let safetyService else { return }
        do {
            try await safetyService.suspendOwnAccount()
            await signOut()
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Marca a conta pra exclusão e desloga.
    public func deleteAccount() async {
        guard let safetyService else { return }
        do {
            try await safetyService.requestAccountDeletion()
            await signOut()
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Sprint 20.4b — passthroughs pro composer (academias + seguindo).
    public func searchGyms(query: String) async -> [GymOption] {
        guard let api, !query.trimmingCharacters(in: .whitespaces).isEmpty else { return [] }
        return (try? await api.searchGyms(query: query)) ?? []
    }

    /// Academias usadas recentemente (paridade web recentLocations). Fail-soft.
    public func recentGyms() async -> [GymOption] {
        guard let api, let userId = sessionStore?.currentUserId else { return [] }
        return (try? await api.recentGyms(userId: userId)) ?? []
    }

    /// Posts de uma academia (check-in "lugar vivo"): pessoas/amigos/grid.
    public func gymPosts(gymId: String) async -> [GymCheckInPost] {
        guard let api else { return [] }
        return (try? await api.gymPosts(gymId: gymId)) ?? []
    }

    /// Conjunto de userIds que EU sigo (aceitos) — pra separar "amigos" dos
    /// demais no check-in. Fail-soft: conjunto vazio.
    public func followingUserIds() async -> Set<String> {
        Set(await loadFollowingProfiles().map(\.userId))
    }

    public func nearbyGyms(coordinate: GymCircleCoordinate) async -> [GymOption] {
        guard let api else { return [] }
        return (try? await api.nearbyGyms(
            latitude: coordinate.latitude,
            longitude: coordinate.longitude
        )) ?? []
    }

    public func catalogPlace(_ place: NativePlaceCandidate) async -> GymOption? {
        guard let api else { return nil }
        do {
            return try await api.findOrCreateGym(from: place)
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    @discardableResult
    public func checkIn(gym: GymOption) async -> Bool {
        guard let api, let userId = sessionStore?.currentUserId else { return false }
        do {
            try await api.checkIn(userId: userId, gymId: gym.id)
            Haptics.success()
            await loadMyCircle()
            return true
        } catch {
            Haptics.error()
            self.error = error.localizedDescription
            return false
        }
    }

    public func enablePushNotifications() async -> Bool {
        guard let pushService, let userId = sessionStore?.currentUserId else { return false }
        do {
            try await pushService.requestPermissionAndRegisterWithAPNs()
            try await pushService.upsertCurrentToken(userId: userId)
            Haptics.success()
            return true
        } catch {
            Haptics.error()
            self.error = error.localizedDescription
            return false
        }
    }

    public func disablePushNotifications() async {
        guard let pushService, let userId = sessionStore?.currentUserId else { return }
        try? await pushService.revokeCurrentToken(userId: userId)
    }

    private func syncPushTokenIfAuthorized() async {
        guard let pushService, let userId = sessionStore?.currentUserId else { return }
        _ = try? await pushService.syncIfAlreadyAuthorized(userId: userId)
    }

    public func requestHealthKitAccess() async -> Bool {
        do {
            try await healthKitProvider.requestReadAuthorization()
            Haptics.success()
            return true
        } catch {
            Haptics.error()
            self.error = error.localizedDescription
            return false
        }
    }

    public func loadFollowingProfiles() async -> [DiscoveredProfile] {
        guard let participantsService, let userId = sessionStore?.currentUserId else { return [] }
        return (try? await participantsService.followingProfiles(userId: userId)) ?? []
    }

    /// Sprint 22.x — listas de seguidores/seguindo de QUALQUER user (perfil
    /// próprio ou de outro). Fail-soft: lista vazia.
    public func fetchFollowing(userId: String) async -> [DiscoveredProfile] {
        guard let participantsService else { return [] }
        return (try? await participantsService.followingProfiles(userId: userId)) ?? []
    }

    public func fetchFollowers(userId: String) async -> [DiscoveredProfile] {
        guard let participantsService else { return [] }
        return (try? await participantsService.followersProfiles(userId: userId)) ?? []
    }

    // MARK: - Sprint 8.11.3 — calendar navigation

    /// Carrega dias treinados de um mês específico (offset relativo ao hoje:
    /// 0 = mês corrente, -1 = mês anterior, +1 = mês seguinte). Atualiza
    /// `myCircleData.calendarDays` no @Published — UI re-renderiza.
    /// No-op quando services ausentes (modo demo).
    public func loadCalendarForMonth(offset: Int) async {
        guard let myCircleService,
              let userId = sessionStore?.currentUserId,
              var data = myCircleData else { return }

        let targetMonthKey = Self.monthKey(offsetFromToday: offset)
        do {
            // Sprint 8.13.1 — dispara workoutDays + posts em paralelo.
            async let daysTask = myCircleService.getWorkoutDays(
                userId: userId,
                monthKey: targetMonthKey
            )
            async let postsTask = myCircleService.getMonthPosts(
                userId: userId,
                monthKey: targetMonthKey,
                includeTagged: true
            )
            let days = try await daysTask
            let posts = (try? await postsTask) ?? []
            let newCalendar = CalendarBuilder.buildMonth(
                monthKey: targetMonthKey,
                workoutDays: days,
                todayKey: Self.todayKey(),
                posts: posts
            )
            data = MyCircleViewData(
                userId: data.userId,
                isOwn: data.isOwn,
                displayName: data.displayName,
                username: data.username,
                avatarURL: data.avatarURL,
                stats: data.stats,
                calendarDays: newCalendar,
                currentLevel: data.currentLevel,
                allLevels: data.allLevels,
                highlightBadge: data.highlightBadge,
                nextBadge: data.nextBadge,
                earnedCount: data.earnedCount,
                totalAchievements: data.totalAchievements,
                monthlyChallenges: data.monthlyChallenges
            )
            myCircleData = data
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Retorna YYYY-MM relativo a hoje. Offset 0 = mês corrente.
    private static func monthKey(offsetFromToday offset: Int) -> String {
        var calendar = Calendar(identifier: .gregorian)
        if let tz = TimeZone(identifier: "America/Sao_Paulo") {
            calendar.timeZone = tz
        }
        let target = calendar.date(byAdding: .month, value: offset, to: .now) ?? .now
        let y = calendar.component(.year, from: target)
        let m = calendar.component(.month, from: target)
        return String(format: "%04d-%02d", y, m)
    }

    // MARK: - Sprint 8.4 — celebration management

    /// Marca um achievement como celebrado e remove da queue.
    /// Chamado quando user dispensa AchievementCelebrationView.
    public func markCelebrated(compositeId: String) async {
        guard let achievementsService,
              let userId = sessionStore?.currentUserId else { return }
        do {
            try await achievementsService.markCelebrated(userId: userId, compositeId: compositeId)
            uncelebratedAchievementIds.removeAll { $0 == compositeId }
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Marca TODOS uncelebrated como celebrados ("Pular tudo").
    public func markAllCelebrated() async {
        guard let achievementsService,
              let userId = sessionStore?.currentUserId else { return }
        do {
            try await achievementsService.markAllCelebrated(userId: userId)
            uncelebratedAchievementIds = []
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Detail accessors (Sprint 8.9 - Plugin Bridge expansion)

    /// Busca o `UserAchievementRecord` específico do user pra um composite ID.
    /// Usado por NativeAchievementDetailHost pra hidratar earnedAt/count.
    public func fetchUserRecord(compositeId: String) async -> UserAchievementRecord? {
        guard let achievementsService,
              let userId = sessionStore?.currentUserId else { return nil }
        do {
            let records = try await achievementsService.getUserAchievements(userId: userId)
            return records.first(where: { $0.achievementId == compositeId })
        } catch {
            return nil
        }
    }

    /// Busca raridade global (% de users que conquistaram) — RPC supabase.
    /// Cache LRU futuro (Sprint 8.11+) — por ora chama a cada open.
    public func fetchGlobalStats(compositeId: String) async -> AchievementGlobalStats? {
        guard let achievementsService else { return nil }
        do {
            return try await achievementsService.getGlobalStats(achievementId: compositeId)
        } catch {
            return nil
        }
    }

    // MARK: - Sprint 9.1 — Bridge helpers (other profile / save / recap)

    /// Sprint 9.5.4 — verifica se autenticado segue target user.
    public func isFollowing(targetUserId: String) async -> Bool {
        guard let followsService,
              let myId = sessionStore?.currentUserId else { return false }
        do {
            return try await followsService.isFollowing(follower: myId, following: targetUserId)
        } catch {
            return false
        }
    }

    /// Sprint 9.5.4 — toggle follow/unfollow. Retorna novo estado.
    public func toggleFollow(targetUserId: String) async -> Bool {
        guard let followsService,
              let myId = sessionStore?.currentUserId else { return false }
        do {
            return try await followsService.toggle(follower: myId, following: targetUserId)
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    /// Busca profile de outro user (não o autenticado). Usado pelo bridge
    /// `presentOtherProfile`.
    public func fetchOtherProfile(userId: String) async -> UserProfile? {
        guard let profilesService else { return nil }
        do {
            return try await profilesService.getProfile(userId: userId)
        } catch {
            return nil
        }
    }

    /// Sprint 11.1 — agrega profile + stats + posts + counts pra
    /// OtherProfileView. Substitui o fetchOtherProfile + posts vazio +
    /// streak/best 0 que causavam o bug "bio sumida + counts errados".
    public func fetchOtherProfileSummary(userId: String) async -> OtherProfileSummary? {
        guard let profilesService,
              let currentUserId = sessionStore?.currentUserId else { return nil }
        do {
            return try await profilesService.getOtherProfileSummary(
                userId: userId,
                currentUserId: currentUserId
            )
        } catch {
            return nil
        }
    }

    /// Resolve um @username → perfil (pra abrir ao tocar numa menção). Usa o
    /// search_profiles e pega o match EXATO de username. Fail-soft: nil.
    public func fetchOtherProfileSummary(username: String) async -> OtherProfileSummary? {
        let handle = username.lowercased()
        let matches = await searchProfiles(query: handle)
        guard let target = matches.first(where: { ($0.username ?? "").lowercased() == handle }) else {
            return nil
        }
        return await fetchOtherProfileSummary(userId: target.userId)
    }

    /// Wrapper de ProfilesService.updateProfile + reload local @Published.
    /// Chamado pelo NativeEditProfileHost no save.
    /// Sprint 9.7.1 — agora também aceita instagramUsername, birthDate,
    /// sports, preferredTrainingTimes.
    public func saveProfile(
        displayName: String?,
        bio: String?,
        fitnessGoal: String?,
        isPrivate: Bool?,
        instagramUsername: String? = nil,
        birthDate: Date? = nil,
        sports: [String]? = nil,
        preferredTrainingTimes: [String]? = nil,
        // Double-optional: outer .none = não mexe na academia; outer .some(v) =
        // define (v pode ser nil = limpar). Espelha o web que sempre envia.
        mainGymId: String?? = nil
    ) async {
        guard let profilesService,
              let userId = sessionStore?.currentUserId else { return }
        do {
            try await profilesService.updateProfile(
                userId: userId,
                displayName: displayName,
                bio: bio,
                fitnessGoal: fitnessGoal,
                isPrivate: isPrivate,
                instagramUsername: instagramUsername,
                birthDate: birthDate,
                sports: sports,
                preferredTrainingTimes: preferredTrainingTimes
            )
            if case let .some(gymId) = mainGymId {
                try await profilesService.setMainGym(userId: userId, gymId: gymId)
            }
            await loadProfile()
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Sprint 22.x — busca 1 academia por id (nome pro editor). Fail-soft nil.
    public func fetchGym(id: String) async -> GymOption? {
        guard let profilesService else { return nil }
        return try? await profilesService.gym(id: id)
    }

    /// Sprint 22.x — counts de seguidores/seguindo do próprio user (header
    /// do Perfil, paridade web). Fail-soft (0,0).
    public func fetchFollowCounts() async -> (followers: Int, following: Int) {
        guard let profilesService,
              let userId = sessionStore?.currentUserId else { return (0, 0) }
        return (try? await profilesService.followCounts(userId: userId)) ?? (0, 0)
    }

    /// Sprint 22.x — estado do restaurador de streak do próprio user (card do
    /// perfil, paridade web). Fail-soft nil.
    public func fetchStreakRestoreInfo() async -> MyCircleService.StreakRestoreInfo? {
        guard let myCircleService, let userId = sessionStore?.currentUserId else { return nil }
        return try? await myCircleService.streakRestoreInfo(userId: userId)
    }

    /// Consome 1 restaurador e recarrega o perfil.
    public func useStreakRestore() async {
        guard let myCircleService else { return }
        try? await myCircleService.consumeStreakRestore()
        await loadProfile()
    }

    /// Sprint 22.x — anéis de consistência (semana/mês/ano) de um user pro
    /// header do OtherProfile (paridade web AvatarConsistencyRings). Fail-soft
    /// nil quando indisponível (ex.: perfil privado que não sigo — a RLS de
    /// user_activity_days bloqueia via can_view_profile_posts).
    public func fetchConsistencyRings(userId: String) async -> ConsistencyRings? {
        guard let myCircleService else { return nil }
        return try? await myCircleService.getConsistencyRings(userId: userId)
    }

    /// Story ring de OUTRO user (paridade web `profileSheetStoryGroup`): tem
    /// story ativa (<24h)? e o viewer atual já abriu? O ring acende só com
    /// story NÃO-vista e apaga ao ver. Fail-soft → (false, false).
    public func fetchStoryRingState(userId: String) async -> (hasStory: Bool, viewed: Bool) {
        guard let storiesService else { return (false, false) }
        // Lê o viewer no corpo main-actor (currentUserId é isolado); o closure
        // async-let só captura o valor, sem cruzar fronteira de ator.
        let viewerId = sessionStore?.currentUserId
        async let hasStoryTask: Bool =
            (try? await storiesService.hasActiveStory(userId: userId)) ?? false
        async let viewedTask: Bool = {
            guard let viewerId else { return false }
            return (try? await storiesService.hasViewedActiveStories(
                targetUserId: userId, viewerUserId: viewerId)) ?? false
        }()
        return (await hasStoryTask, await viewedTask)
    }

    /// Sprint 9.2 — upload de avatar. Wrapper ProfilesService.uploadAvatar
    /// + reload profile pra atualizar @Published.
    public func uploadAvatar(imageData: Data) async -> String? {
        guard let profilesService,
              let userId = sessionStore?.currentUserId else { return nil }
        do {
            let url = try await profilesService.uploadAvatar(
                userId: userId,
                imageData: imageData
            )
            await loadProfile()
            return url
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    /// Persistir capa escolhida pro recap do mês. Chamado pelo
    /// NativeMonthlyRecapHost depois do RecapCoverPickerSheet.
    /// Sprint 9.7.5 — retorna Bool pra caller saber se persistiu.
    @discardableResult
    public func setRecapCover(monthKey: String, postId: String?) async -> Bool {
        guard let profilesService,
              let userId = sessionStore?.currentUserId else { return false }
        do {
            try await profilesService.setMonthlyRecapCover(
                userId: userId,
                monthKey: monthKey,
                postId: postId
            )
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    /// Constrói payload pro MonthlyRecapSheet a partir de stats + posts
    /// do mês alvo. Returns também os posts pra alimentar o
    /// RecapCoverPickerSheet quando aberto.
    public func buildMonthlyRecap(monthKey: String) async -> (data: MonthlyRecapSheet.RecapData?, posts: [MonthCalendarPost]) {
        guard let myCircleService,
              let userId = sessionStore?.currentUserId else {
            return (nil, [])
        }

        // Sprint 9.5.5 — fan-out 6 queries em paralelo pra hidratar TUDO
        async let postsTask = (try? await myCircleService.getMonthPosts(userId: userId, monthKey: monthKey)) ?? []
        async let workoutDaysTask = (try? await myCircleService.getWorkoutDays(userId: userId, monthKey: monthKey)) ?? []
        async let coverTask: String? = {
            guard let profilesService else { return nil }
            return try? await profilesService.getMonthlyRecapCover(userId: userId, monthKey: monthKey)
        }()
        async let bestStreakTask: Int = (try? await myCircleService.getBestStreakInMonth(userId: userId, monthKey: monthKey)) ?? 0
        async let topTypeTask: String? = try? await myCircleService.getTopWorkoutType(userId: userId, monthKey: monthKey)
        async let topGymTask: String? = try? await myCircleService.getTopGymName(userId: userId, monthKey: monthKey)

        let posts = await postsTask
        let workoutDays = await workoutDaysTask
        let coverPostId = await coverTask
        let bestStreak = await bestStreakTask
        let topType = await topTypeTask
        let topGym = await topGymTask

        let coverURL: URL? = {
            if let id = coverPostId, let match = posts.first(where: { $0.postId == id }) {
                return match.imageURL
            }
            // Fallback: primeiro post do mês (auto-pick)
            return posts.first?.imageURL
        }()

        let monthLabel = Self.monthLabelLong(monthKey: monthKey)
        let displayName = profile?.displayName ?? profile?.username ?? "Atleta"
        let username = profile?.username ?? "atleta"

        // Sprint 9.7.2 — progresses dos 3 anéis (week=7d, month=dias do mês, year=365).
        // Para meses passados usamos stats fechadas do mês corrente: simplificação MVP.
        let stats = myCircleData?.stats ?? GymCircleStats()
        let weekDen: Double = 7
        let monthDen: Double = 30
        let yearDen: Double = 365
        let weekProgress = min(1, Double(stats.workoutsThisWeek) / weekDen)
        let monthProgress = min(1, Double(workoutDays.count) / monthDen)
        let yearProgress = min(1, Double(stats.workoutsThisYear) / yearDen)

        let data = MonthlyRecapSheet.RecapData(
            monthLabel: monthLabel,
            shortMonthLabel: monthLabel.split(separator: " ").first.map(String.init) ?? monthLabel,
            username: username,
            displayName: displayName,
            coverImageURL: coverURL,
            workoutsCount: workoutDays.count,
            bestStreak: bestStreak,
            topWorkoutType: topType,
            topGymName: topGym,
            weekProgress: weekProgress,
            monthProgress: monthProgress,
            yearProgress: yearProgress
        )
        return (data, posts)
    }

    private static func monthLabelLong(monthKey: String) -> String {
        let parts = monthKey.split(separator: "-")
        guard parts.count == 2,
              let year = Int(parts[0]),
              let month = Int(parts[1]) else { return monthKey }
        var comps = DateComponents()
        comps.year = year
        comps.month = month
        comps.day = 1
        let date = Calendar(identifier: .gregorian).date(from: comps) ?? .now
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.dateFormat = "LLLL yyyy"
        return formatter.string(from: date).capitalized
    }

    // MARK: - Backwards-compat

    /// Legacy: usado por MainTabView (Sprint 3 read-only) antes do Sprint 8.2
    /// migrar pra MyCircleViewData. Mantido pra back-compat — internamente
    /// agora reusa myCircleData quando disponível.
    public var myCircleSummary: MyCircleSummary {
        if let myCircleData {
            return MyCircleSummary(stats: myCircleData.stats)
        }
        let stats = GymCircleStats(
            currentStreak: profile?.currentStreak ?? 0,
            bestStreak: profile?.bestStreak ?? 0,
            workoutsThisWeek: 0,
            workoutsThisMonth: 0,
            workoutsThisYear: 0
        )
        return MyCircleSummary(stats: stats)
    }

    // MARK: - Demo data (modo preview/sem services)

    private func loadDemoData() {
        let demoProfile = UserProfile(
            id: "demo-profile",
            userId: "demo-user",
            username: "dudy",
            displayName: "Dudy",
            avatarURL: nil,
            bio: "Fundacao SwiftUI do Gym Circle.",
            currentStreak: 7,
            bestStreak: 21,
            badgeIsActiveToday: true,
            createdAt: Date(timeIntervalSince1970: 1704067200) // 2026 Jan 1 (founder window)
        )
        profile = demoProfile
        posts = []
        checkins = []
        stories = []
        profilePosts = []
        myCircleData = MyCircleViewData.demo(userId: "demo-user", isOwn: true)
    }

    // MARK: - Helpers

    private static func todayKey() -> String {
        dateKey(for: .now)
    }

    /// YYYY-MM-DD em São Paulo (mesmo fuso do resto do produto). O dia do
    /// treino é o dia em que ele COMEÇOU (sessão virando a madrugada conta
    /// no dia de início — paridade web getGymCircleDateKey).
    private static func dateKey(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: "America/Sao_Paulo") ?? .current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private static func googleMapsURL(for gym: GymOption?) -> String? {
        guard let gym else { return nil }
        let fallback = [gym.name, gym.address, gym.city, gym.state]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
        return googleMapsURL(
            latitude: gym.latitude,
            longitude: gym.longitude,
            fallback: fallback
        )
    }

    private static func googleMapsURL(
        latitude: Double?,
        longitude: Double?,
        fallback: String?
    ) -> String? {
        let query: String
        if let latitude, let longitude {
            query = "\(latitude),\(longitude)"
        } else if let fallback, !fallback.isEmpty {
            query = fallback
        } else {
            return nil
        }
        var components = URLComponents(
            string: "https://www.google.com/maps/search/"
        )
        components?.queryItems = [
            URLQueryItem(name: "api", value: "1"),
            URLQueryItem(name: "query", value: query),
        ]
        return components?.url?.absoluteString
    }
}

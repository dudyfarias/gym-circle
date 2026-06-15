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
    @Published public private(set) var error: String?
    @Published public private(set) var posts: [FeedPost] = []
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
    // Sprint 20.7 — sino de notificações.
    private let notificationsService: NotificationsService?
    @Published public private(set) var unreadNotifications = 0
    // Sprint 20.6 — chat.
    private let chatService: ChatService?
    /// Badge da tab Conversas (paridade BottomNav web — soma dos unread).
    @Published public private(set) var unreadMessages = 0
    // Sprint 20.7b/Native P1 — APNs token lifecycle.
    private let pushService: NativePushNotificationsService?
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
        self.healthKitProvider = healthKitProvider
    }

    // MARK: - Boot pipeline

    /// Restaura session do Keychain. Quando sucesso, dispara
    /// loadProfile + loadInitialSurfaces + loadMyCircle. Quando guest, popula
    /// demo data (modo preview).
    public func boot() async {
        guard let sessionStore else {
            loadDemoData()
            return
        }
        await sessionStore.restoreSession()
        if sessionStore.isAuthenticated {
            // Sprint 8.11.1 — profile primeiro pq loadMyCircle usa
            // displayName/username/avatar/createdAt do profile.
            await loadProfile()
            await loadInitialSurfaces()
            await loadMyCircle()
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
    }

    public func signOut() async {
        await stopRealtime()
        await sessionStore?.signOut()
        // Limpa estado in-memory
        posts = []
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
        "stories", "story_likes", "follows", "checkins", "user_stats",
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
                    await self?.scheduleRealtimeRefresh()
                }
            }
            realtimeStreamTasks.append(task)
        }
        await channel.subscribe()
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
            async let tray = api.storyTray()
            let feedPosts = try await feed
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

        // Mute filter (20.3c): atualiza a lista no load e esconde os
        // posts de autores silenciados — paridade post_mutes web.
        if let safetyService, let userId = sessionStore?.currentUserId,
           let muted = try? await safetyService.mutedUserIds(userId: userId) {
            mutedUserIds = muted
        }
        let visible = feedPosts.filter { !mutedUserIds.contains($0.userId) }
        guard !visible.isEmpty else { return [] }

        let postIds = visible.map(\.id)
        let mediaByPost = (try? await api.postMedia(postIds: postIds)) ?? [:]
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
        do {
            async let feed = api.homeFeed()
            async let tray = api.storyTray()
            let feedPosts = try await feed
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
                (try? await myCircleService.getMonthPosts(userId: userId, monthKey: currentMonth)) ?? []
            // Sprint 8.13.2 — paralelo: distinct types em 7d + gyms em 30d
            // alimentam achievements secret cross-trainer e explorer
            async let distinctTypesTask: Int =
                (try? await myCircleService.getDistinctWorkoutTypes(userId: userId, sinceDaysAgo: 7)) ?? 0
            async let distinctGymsTask: Int =
                (try? await myCircleService.getDistinctGyms(userId: userId, sinceDaysAgo: 30)) ?? 0
            // Sprint 10.1 — story ring no avatar (P0 #1 fechado).
            // own profile: storyViewed sempre false (você sempre "vê" suas
            // próprias stories — UX ring brand fica até expirar).
            async let hasStoryTask: Bool = {
                guard let storiesService else { return false }
                return (try? await storiesService.hasActiveStory(userId: userId)) ?? false
            }()
            let challenges = await challengesTask
            let monthPosts = await monthPostsTask
            let distinctTypes = await distinctTypesTask
            let distinctGyms = await distinctGymsTask
            let hasStory = await hasStoryTask

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
                // Sprint 10.1 — own profile sempre storyViewed=false (UX ring brand persiste).
                hasStory: hasStory,
                storyViewed: false,
                // Sprint 20.1 — paridade 15.5 web: equipados → sugeridos,
                // e a lista completa alimenta o Hall aberto pela row.
                featuredAchievements: AchievementSuggester.resolveFeatured(
                    achievements: allAchievements,
                    equippedCompositeIds: profile?.featuredAchievements ?? []
                ),
                allAchievements: allAchievements
            )
        } catch {
            self.error = error.localizedDescription
            myCircleData = MyCircleViewData.demo(userId: userId, isOwn: true)
        }
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

    /// Sobe as mídias (sequencial), publica o post (capa + carrossel +
    /// local + participantes) e recarrega feed + MyCircle (streak,
    /// desafios tipo Popstar e conquistas reagem na hora).
    public func publishPost(
        media: [ComposerMediaInput],
        caption: String,
        workoutTypes: [String],
        gym: GymOption? = nil,
        taggedUserIds: [String] = [],
        alsoPublishStory: Bool = false
    ) async -> Bool {
        guard let composerService,
              let userId = sessionStore?.currentUserId,
              !media.isEmpty else { return false }
        do {
            var uploads: [PostComposerService.UploadedMedia] = []
            for item in media {
                switch item {
                case .photo(let data):
                    uploads.append(try await composerService.uploadImage(userId: userId, imageData: data))
                case .video(let data):
                    uploads.append(try await composerService.uploadVideo(userId: userId, videoData: data))
                }
            }
            let postId = try await composerService.publish(
                userId: userId,
                medias: uploads,
                caption: caption,
                workoutTypes: workoutTypes,
                workoutDate: Self.todayKey(),
                gymId: gym?.id,
                locationName: gym?.name
            )
            // Marcações são best-effort: post já está no ar.
            if !taggedUserIds.isEmpty {
                try? await participantsService?.tag(
                    postId: postId,
                    taggedByUserId: userId,
                    taggedUserIds: taggedUserIds
                )
            }
            if alsoPublishStory, let cover = uploads.first {
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

    /// Sprint 20.4b — edita caption/tags do próprio post e atualiza o
    /// feed local sem refetch.
    public func updatePost(
        postId: String,
        caption: String,
        workoutTypes: [String],
        media: [PostComposerService.EditMediaItem]? = nil
    ) async -> Bool {
        guard let composerService, let userId = sessionStore?.currentUserId else { return false }
        do {
            try await composerService.updatePost(
                postId: postId,
                userId: userId,
                caption: caption,
                workoutTypes: workoutTypes
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

    public func fetchChatMessages(conversationId: String) async -> [ChatMessage] {
        guard let chatService else { return [] }
        let page = (try? await chatService.messages(conversationId: conversationId)) ?? []
        // RPC devolve mais-recentes-primeiro; UI quer cronológico.
        return page.sorted { $0.createdAt < $1.createdAt }
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
            try? await Task.sleep(nanoseconds: 900_000_000)
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
                monthKey: targetMonthKey
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
        preferredTrainingTimes: [String]? = nil
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
            await loadProfile()
        } catch {
            self.error = error.localizedDescription
        }
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
        stories = []
        profilePosts = []
        myCircleData = MyCircleViewData.demo(userId: "demo-user", isOwn: true)
    }

    // MARK: - Helpers

    private static func todayKey() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: "America/Sao_Paulo") ?? .current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: .now)
    }
}

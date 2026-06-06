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
    private let myCircleService: MyCircleService?
    private let achievementsService: AchievementsService?
    private let challengesService: ChallengesService?

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
        self.init(
            sessionStore: sessionStore,
            api: api,
            myCircleService: myCircleService,
            achievementsService: achievementsService,
            challengesService: challengesService
        )
    }

    /// Construtor injetável pra preview/tests com mocks. Sem services
    /// = modo demo (loadInitialSurfaces popula com loadDemoData).
    public init(
        sessionStore: SessionStore? = nil,
        api: GymCircleAPI? = nil,
        myCircleService: MyCircleService? = nil,
        achievementsService: AchievementsService? = nil,
        challengesService: ChallengesService? = nil
    ) {
        self.sessionStore = sessionStore
        self.api = api
        self.myCircleService = myCircleService
        self.achievementsService = achievementsService
        self.challengesService = challengesService
    }

    // MARK: - Boot pipeline

    /// Restaura session do Keychain. Quando sucesso, dispara
    /// loadInitialSurfaces + loadMyCircle. Quando guest, popula
    /// demo data (modo preview).
    public func boot() async {
        guard let sessionStore else {
            loadDemoData()
            return
        }
        await sessionStore.restoreSession()
        if sessionStore.isAuthenticated {
            await loadInitialSurfaces()
            await loadMyCircle()
        }
    }

    /// Login + boot completo. Wrapper que SessionStore signIn já cobre,
    /// mas garante data load depois.
    public func signIn(email: String, password: String) async throws {
        guard let sessionStore else {
            // Demo mode — login fake instantâneo
            loadDemoData()
            return
        }
        try await sessionStore.signIn(email: email, password: password)
        await loadInitialSurfaces()
        await loadMyCircle()
    }

    public func signOut() async {
        await sessionStore?.signOut()
        // Limpa estado in-memory
        posts = []
        stories = []
        profile = nil
        profilePosts = []
        myCircleData = nil
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
            posts = try await feed
            stories = try await tray
        } catch {
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

            // 2. Monthly challenges (Sprint 8.4)
            let challenges: [MonthlyChallenge] = await {
                guard let challengesService else { return [] }
                return (try? await challengesService.loadChallenges(userId: userId)) ?? []
            }()

            // 3. Computa achievements client-side via builder
            let builderInput = AchievementBuilder.Input(
                postsCount: 0, // Sprint 8.x — wire profile_posts count
                longestStreak: summary.stats.bestStreak,
                workoutsThisMonth: summary.stats.workoutsThisMonth,
                workoutsThisWeek: summary.stats.workoutsThisWeek,
                activeDaysCount: summary.stats.workoutsThisYear,
                followersCount: 0, // Sprint 8.x — wire follows count
                hasUsedStreakRestore: false,
                createdAt: nil,
                monthlyChallenges: challenges
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
                    workoutDays: [],
                    todayKey: Self.todayKey()
                ),
                currentLevel: StreakLevel.current(for: summary.stats.currentStreak),
                allLevels: StreakLevel.all,
                highlightBadge: highlight,
                nextBadge: highlight,
                earnedCount: earnedCount,
                totalAchievements: totalCount,
                monthlyChallenges: challenges
            )
        } catch {
            self.error = error.localizedDescription
            myCircleData = MyCircleViewData.demo(userId: userId, isOwn: true)
        }
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
            badgeIsActiveToday: true
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

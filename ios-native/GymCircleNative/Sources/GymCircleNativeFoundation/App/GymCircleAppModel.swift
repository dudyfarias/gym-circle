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
        self.init(
            sessionStore: sessionStore,
            api: api,
            myCircleService: myCircleService
        )
    }

    /// Construtor injetável pra preview/tests com mocks. Sem services
    /// = modo demo (loadInitialSurfaces popula com loadDemoData).
    public init(
        sessionStore: SessionStore? = nil,
        api: GymCircleAPI? = nil,
        myCircleService: MyCircleService? = nil
    ) {
        self.sessionStore = sessionStore
        self.api = api
        self.myCircleService = myCircleService
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

    /// Sprint 8.3 — fetcha MyCircleViewData real via MyCircleService.
    /// Caller (Plugin Bridge ou MainTabView) chama isso depois de auth OK.
    /// Quando services ausentes ou erro, usa demo data como fallback graceful.
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
            let summary = try await myCircleService.getSummary(userId: userId)
            myCircleData = MyCircleViewData(
                userId: userId,
                isOwn: true,
                displayName: profile?.displayName ?? profile?.username ?? sessionStore.currentUserEmail ?? "Você",
                username: profile?.username ?? "me",
                avatarURL: profile?.avatarURL.flatMap(URL.init(string:)),
                stats: summary.stats,
                calendarDays: CalendarBuilder.buildMonth(
                    workoutDays: [], // Sprint 8.4: trazer activity_days pra cá
                    todayKey: Self.todayKey()
                ),
                currentLevel: StreakLevel.current(for: summary.stats.currentStreak),
                allLevels: StreakLevel.all,
                highlightBadge: nil,     // Sprint 8.4: AchievementsService
                nextBadge: nil,
                earnedCount: 0,
                totalAchievements: 22,    // hardcoded até Sprint 8.4 conectar
                monthlyChallenges: []     // Sprint 8.4: ChallengesService
            )
        } catch {
            self.error = error.localizedDescription
            // Fallback graceful pra demo se falhar
            myCircleData = MyCircleViewData.demo(userId: userId, isOwn: true)
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

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
    private let profilesService: ProfilesService?
    private let followsService: FollowsService?

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
        let profilesService = ProfilesService(client: client)
        let followsService = FollowsService(client: client)
        self.init(
            sessionStore: sessionStore,
            api: api,
            myCircleService: myCircleService,
            achievementsService: achievementsService,
            challengesService: challengesService,
            profilesService: profilesService,
            followsService: followsService
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
        followsService: FollowsService? = nil
    ) {
        self.sessionStore = sessionStore
        self.api = api
        self.myCircleService = myCircleService
        self.achievementsService = achievementsService
        self.challengesService = challengesService
        self.profilesService = profilesService
        self.followsService = followsService
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
    public func signIn(email: String, password: String) async throws {
        guard let sessionStore else {
            // Demo mode — login fake instantâneo
            loadDemoData()
            return
        }
        try await sessionStore.signIn(email: email, password: password)
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
            let challenges = await challengesTask
            let monthPosts = await monthPostsTask
            let distinctTypes = await distinctTypesTask
            let distinctGyms = await distinctGymsTask

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
                monthlyChallenges: challenges
            )
        } catch {
            self.error = error.localizedDescription
            myCircleData = MyCircleViewData.demo(userId: userId, isOwn: true)
        }
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

    /// Wrapper de ProfilesService.updateProfile + reload local @Published.
    /// Chamado pelo NativeEditProfileHost no save.
    public func saveProfile(
        displayName: String?,
        bio: String?,
        fitnessGoal: String?,
        isPrivate: Bool?
    ) async {
        guard let profilesService,
              let userId = sessionStore?.currentUserId else { return }
        do {
            try await profilesService.updateProfile(
                userId: userId,
                displayName: displayName,
                bio: bio,
                fitnessGoal: fitnessGoal,
                isPrivate: isPrivate
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
    public func setRecapCover(monthKey: String, postId: String?) async {
        guard let profilesService,
              let userId = sessionStore?.currentUserId else { return }
        do {
            try await profilesService.setMonthlyRecapCover(
                userId: userId,
                monthKey: monthKey,
                postId: postId
            )
        } catch {
            self.error = error.localizedDescription
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

        async let postsTask = (try? await myCircleService.getMonthPosts(userId: userId, monthKey: monthKey)) ?? []
        async let workoutDaysTask = (try? await myCircleService.getWorkoutDays(userId: userId, monthKey: monthKey)) ?? []
        async let coverTask: String? = {
            guard let profilesService else { return nil }
            return try? await profilesService.getMonthlyRecapCover(userId: userId, monthKey: monthKey)
        }()

        let posts = await postsTask
        let workoutDays = await workoutDaysTask
        let coverPostId = await coverTask

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

        let data = MonthlyRecapSheet.RecapData(
            monthLabel: monthLabel,
            username: username,
            displayName: displayName,
            coverImageURL: coverURL,
            workoutsCount: workoutDays.count,
            bestStreak: 0, // Sprint 9.x+: computar best streak do mês específico
            topWorkoutType: nil, // Sprint 9.x+: GROUP BY workout_type ORDER BY count DESC
            topGymName: nil      // Sprint 9.x+: join gyms table + group
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

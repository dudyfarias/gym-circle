import Foundation

public struct ConsistencyRings: Codable, Hashable, Sendable {
    public let week: Double
    public let month: Double
    public let year: Double

    public init(workoutsThisWeek: Int, workoutsThisMonth: Int, workoutsThisYear: Int, date: Date = Date()) {
        week = min(max(Double(workoutsThisWeek) / 7.0, 0), 1)
        month = min(max(Double(workoutsThisMonth) / Double(Self.daysInMonth(for: date)), 0), 1)
        year = min(max(Double(workoutsThisYear) / Double(Self.daysInYear(for: date)), 0), 1)
    }

    private static func daysInMonth(for date: Date) -> Int {
        Calendar.current.range(of: .day, in: .month, for: date)?.count ?? 30
    }

    private static func daysInYear(for date: Date) -> Int {
        let year = Calendar.current.component(.year, from: date)
        var components = DateComponents()
        components.year = year
        components.month = 2
        components.day = 1
        let february = Calendar.current.date(from: components) ?? date
        return daysInMonth(for: february) == 29 ? 366 : 365
    }
}

public struct GymCircleStats: Codable, Hashable, Sendable {
    public let currentStreak: Int
    public let bestStreak: Int
    public let workoutsThisWeek: Int
    public let workoutsThisMonth: Int
    public let workoutsThisYear: Int

    public init(
        currentStreak: Int = 0,
        bestStreak: Int = 0,
        workoutsThisWeek: Int = 0,
        workoutsThisMonth: Int = 0,
        workoutsThisYear: Int = 0
    ) {
        self.currentStreak = currentStreak
        self.bestStreak = bestStreak
        self.workoutsThisWeek = workoutsThisWeek
        self.workoutsThisMonth = workoutsThisMonth
        self.workoutsThisYear = workoutsThisYear
    }
}

public struct Badge: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public let title: String
    public let subtitle: String
}

public struct CommentPreview: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public let username: String
    public let body: String
}

public struct MyCircleSummary: Codable, Hashable, Sendable {
    public let stats: GymCircleStats
    public let rings: ConsistencyRings
    public let badges: [Badge]

    /// Sprint 8.11.1 — total de posts do user (alimenta achievements
    /// `first-workout`, `workouts-50`, `prolific-100`). Default 0 preserva
    /// back-compat com callers anteriores.
    public let postsCount: Int

    /// Sprint 8.11.1 — total de followers (alimenta `social-10`, `friends-50`,
    /// `network-100`, `community-200`).
    public let followersCount: Int

    /// Sprint 8.11.1 — true quando user já usou pelo menos 1 streak restore
    /// (alimenta `streak-recovered`). Lookup via `user_stats.last_streak_restore_used_at`.
    public let hasUsedStreakRestore: Bool

    /// Sprint 8.11.1 — datas (yyyy-MM-dd) em que o user treinou no mês alvo.
    /// Alimenta o calendar mensal (CalendarBuilder). Vazio = calendar
    /// sem treinos destacados.
    public let workoutDays: [String]

    public init(
        stats: GymCircleStats,
        badges: [Badge] = [],
        postsCount: Int = 0,
        followersCount: Int = 0,
        hasUsedStreakRestore: Bool = false,
        workoutDays: [String] = []
    ) {
        self.stats = stats
        rings = ConsistencyRings(
            workoutsThisWeek: stats.workoutsThisWeek,
            workoutsThisMonth: stats.workoutsThisMonth,
            workoutsThisYear: stats.workoutsThisYear
        )
        self.badges = badges
        self.postsCount = postsCount
        self.followersCount = followersCount
        self.hasUsedStreakRestore = hasUsedStreakRestore
        self.workoutDays = workoutDays
    }
}

// MARK: - Streak Levels (Sprint 8.2 — paridade web StreakLevel)

public enum StreakLevelId: String, Codable, Sendable, CaseIterable, Hashable {
    case iniciante
    case consistente
    case elite
    case lendario
}

public struct StreakLevel: Identifiable, Codable, Hashable, Sendable {
    public let id: StreakLevelId
    public let label: String
    public let shortLabel: String
    public let minDays: Int
    public let nextLevelAt: Int?

    /// Sprint 9.9.1 — agora `static var` (computed) pra re-render com locale
    /// atual quando user trocar idioma no device. Labels vêm de L10n.
    public static var all: [StreakLevel] {
        [
            StreakLevel(id: .iniciante,   label: L10n.levelIniciante.string,   shortLabel: L10n.levelShortNovo.string,   minDays: 0,  nextLevelAt: 4),
            StreakLevel(id: .consistente, label: L10n.levelConsistente.string, shortLabel: L10n.levelConsistente.string, minDays: 4,  nextLevelAt: 14),
            StreakLevel(id: .elite,       label: L10n.levelElite.string,       shortLabel: L10n.levelElite.string,       minDays: 14, nextLevelAt: 30),
            StreakLevel(id: .lendario,    label: L10n.levelLendario.string,    shortLabel: L10n.levelShortLenda.string,  minDays: 30, nextLevelAt: nil)
        ]
    }

    /// Resolve o level corrente baseado em dias de streak.
    public static func current(for days: Int) -> StreakLevel {
        all.reversed().first(where: { days >= $0.minDays }) ?? all[0]
    }
}

// MARK: - Calendar Day (paridade buildMonthWorkoutDays TS)

public struct CalendarDay: Identifiable, Hashable, Sendable {
    public let day: Int
    public let dateKey: String   // "YYYY-MM-DD"
    public let trained: Bool
    public let thumbnailURL: URL?
    public let postId: String?

    public var id: String { dateKey }

    public init(day: Int, dateKey: String, trained: Bool, thumbnailURL: URL? = nil, postId: String? = nil) {
        self.day = day
        self.dateKey = dateKey
        self.trained = trained
        self.thumbnailURL = thumbnailURL
        self.postId = postId
    }
}

public enum CalendarBuilder {
    /// Constrói array de dias do mês corrente do todayKey (YYYY-MM-DD).
    /// Paridade com `buildMonthWorkoutDays` TS — mínimo necessário pra UI.
    public static func buildMonth(workoutDays: [String], todayKey: String) -> [CalendarDay] {
        let monthKey = String(todayKey.prefix(7))
        return buildMonth(monthKey: monthKey, workoutDays: workoutDays, todayKey: todayKey, posts: [])
    }

    /// Sprint 8.11.3 — variação que aceita `monthKey` explícito ("YYYY-MM").
    /// Usado pela navegação calendar ← → quando user vê meses passados.
    /// `todayKey` continua sendo "hoje" pra ring de today highlight quando
    /// o mês corrente contém hoje.
    /// Sprint 8.13.1 — `posts` opcional pra wirear mini-fotos (Gym Rats style).
    /// Quando informado, dateKey é linkado ao primeiro post correspondente.
    public static func buildMonth(
        monthKey: String,
        workoutDays: [String],
        todayKey: String,
        posts: [MonthCalendarPost] = []
    ) -> [CalendarDay] {
        let parts = monthKey.split(separator: "-")
        guard parts.count == 2,
              let year = Int(parts[0]),
              let month = Int(parts[1]) else {
            return []
        }

        // Total dias no mês via DateComponents
        var calendar = Calendar(identifier: .gregorian)
        if let tz = TimeZone(identifier: "America/Sao_Paulo") {
            calendar.timeZone = tz
        }
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = 1
        guard let firstDate = calendar.date(from: components),
              let range = calendar.range(of: .day, in: .month, for: firstDate) else {
            return []
        }
        let totalDays = range.count
        let trainedSet = Set(workoutDays)
        // 1 thumbnail por dia. Primeiro post (lista já ordenada asc) vence.
        var postByDay: [String: MonthCalendarPost] = [:]
        for post in posts where postByDay[post.dateKey] == nil {
            postByDay[post.dateKey] = post
        }

        return (1...totalDays).map { day in
            let dateKey = String(format: "%04d-%02d-%02d", year, month, day)
            let thumb = postByDay[dateKey]
            return CalendarDay(
                day: day,
                dateKey: dateKey,
                trained: trainedSet.contains(dateKey),
                thumbnailURL: thumb?.imageURL,
                postId: thumb?.postId
            )
        }
    }
}

// MARK: - MyCircle View Data (composta na Sprint 8.3 via API)

/// Bundle de dados consumidos pela MyCircleView. Sprint 8.3 vai popular
/// via GymCircleAPI. Sprint 8.2 usa `MyCircleViewData.demo` pra preview
/// + bridge placeholder.
public struct MyCircleViewData: Sendable {
    public let userId: String
    public let isOwn: Bool
    public let displayName: String
    public let username: String
    public let avatarURL: URL?
    public let stats: GymCircleStats
    public let calendarDays: [CalendarDay]
    public let currentLevel: StreakLevel
    public let allLevels: [StreakLevel]
    public let highlightBadge: Achievement?
    public let nextBadge: Achievement?
    public let earnedCount: Int
    public let totalAchievements: Int
    public let monthlyChallenges: [MonthlyChallenge]

    /// Sprint 8.12.4 — true quando user atual pode ver os detalhes completos
    /// do MyCircle do dono. Cálculo padrão:
    /// `isOwn || !ownerIsPrivate || followStatus == "accepted"`.
    /// Quando `false`, MyCircleView mostra apenas Header + Lock notice
    /// (paridade `canSeeDetails` em MyCircleSheet.tsx).
    public let canSeeDetails: Bool

    /// Sprint 9.8.3 — true quando user treinou hoje (paridade `streakLitToday` web).
    /// Renderiza StreakBadge com pulse flame anim + orange tint.
    public let streakLitToday: Bool
    /// Sprint 9.8.3 — story disponível pro user? (paridade hasStory web)
    public let hasStory: Bool
    /// Sprint 9.8.3 — story já visto? (dim ring quando true)
    public let storyViewed: Bool

    public init(
        userId: String,
        isOwn: Bool,
        displayName: String,
        username: String,
        avatarURL: URL? = nil,
        stats: GymCircleStats,
        calendarDays: [CalendarDay] = [],
        currentLevel: StreakLevel = StreakLevel.all[0],
        allLevels: [StreakLevel] = StreakLevel.all,
        highlightBadge: Achievement? = nil,
        nextBadge: Achievement? = nil,
        earnedCount: Int = 0,
        totalAchievements: Int = 0,
        monthlyChallenges: [MonthlyChallenge] = [],
        canSeeDetails: Bool = true,
        streakLitToday: Bool = false,
        hasStory: Bool = false,
        storyViewed: Bool = false
    ) {
        self.userId = userId
        self.isOwn = isOwn
        self.displayName = displayName
        self.username = username
        self.avatarURL = avatarURL
        self.stats = stats
        self.calendarDays = calendarDays
        self.currentLevel = currentLevel
        self.allLevels = allLevels
        self.highlightBadge = highlightBadge
        self.nextBadge = nextBadge
        self.earnedCount = earnedCount
        self.totalAchievements = totalAchievements
        self.monthlyChallenges = monthlyChallenges
        self.canSeeDetails = canSeeDetails
        self.streakLitToday = streakLitToday
        self.hasStory = hasStory
        self.storyViewed = storyViewed
    }

    /// Dados de demonstração pra preview + bridge placeholder antes da
    /// integração API (Sprint 8.3). Reflete um perfil intermediário
    /// com alguns achievements e desafios em progresso.
    public static func demo(userId: String, isOwn: Bool = true) -> MyCircleViewData {
        let stats = GymCircleStats(
            currentStreak: 7,
            bestStreak: 21,
            workoutsThisWeek: 4,
            workoutsThisMonth: 16,
            workoutsThisYear: 142
        )

        let demoBadge = Achievement(
            kind: .medal,
            achievementId: "streak-7",
            label: "Semana cheia",
            description: "Treinou 7 dias consecutivos.",
            earned: true,
            iconKey: .flame,
            rarity: .common,
            tier: .bronze
        )

        let demoChallenges: [MonthlyChallenge] = [
            MonthlyChallenge(
                id: "festa-junina",
                periodKey: "2026-06",
                title: "Festa Junina Fit",
                description: "Treine 8 dias em Junho enquanto o Brasil dança quadrilha.",
                difficulty: .easy,
                goalKind: .workoutsInMonth,
                goalTarget: 8,
                trophyId: "trophy:festa-junina-fit-2026-06",
                progress: 4,
                completedAt: nil,
                isSecret: false,
                goalConfig: nil
            ),
            MonthlyChallenge(
                id: "saque-brasileiro",
                periodKey: "2026-06",
                title: "Saque Brasileiro",
                description: "Publique 3 treinos de tênis em Junho.",
                difficulty: .medium,
                goalKind: .workoutTypeSpecific,
                goalTarget: 3,
                trophyId: "trophy:saque-brasileiro-2026-06",
                progress: 0,
                completedAt: nil,
                isSecret: true,
                goalConfig: GoalConfigData(workoutType: "tenis")
            ),
            MonthlyChallenge(
                id: "brasileirao",
                periodKey: "2026-06",
                title: "Brasileirão da Galera",
                description: "Treine com amigos 4 vezes em Junho.",
                difficulty: .hard,
                goalKind: .groupWorkouts,
                goalTarget: 4,
                trophyId: "trophy:brasileirao-galera-2026-06",
                progress: 1,
                completedAt: nil,
                isSecret: false,
                goalConfig: nil
            ),
            MonthlyChallenge(
                id: "atleta-olimpico",
                periodKey: "2026-06",
                title: "Atleta Olímpico",
                description: "Varie em 5 modalidades diferentes em Junho.",
                difficulty: .legendary,
                goalKind: .distinctTypes,
                goalTarget: 5,
                trophyId: "trophy:atleta-olimpico-2026-06",
                progress: 0,
                completedAt: nil,
                isSecret: true,
                goalConfig: nil
            )
        ]

        let todayKey = ISO8601DateFormatter().string(from: .now).prefix(10)
        let demoWorkoutDays = (1...16).map {
            String(format: "%@-%02d", String(todayKey.prefix(7)), $0 * 2)
        }
        let calendar = CalendarBuilder.buildMonth(
            workoutDays: demoWorkoutDays,
            todayKey: String(todayKey)
        )

        return MyCircleViewData(
            userId: userId,
            isOwn: isOwn,
            displayName: "Eduardo Farias",
            username: "dudy",
            stats: stats,
            calendarDays: calendar,
            currentLevel: StreakLevel.current(for: stats.currentStreak),
            highlightBadge: demoBadge,
            nextBadge: nil,
            earnedCount: 7,
            totalAchievements: 22,
            monthlyChallenges: demoChallenges
        )
    }
}

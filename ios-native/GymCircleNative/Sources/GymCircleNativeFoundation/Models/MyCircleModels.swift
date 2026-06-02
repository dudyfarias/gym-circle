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

    public init(stats: GymCircleStats, badges: [Badge] = []) {
        self.stats = stats
        rings = ConsistencyRings(
            workoutsThisWeek: stats.workoutsThisWeek,
            workoutsThisMonth: stats.workoutsThisMonth,
            workoutsThisYear: stats.workoutsThisYear
        )
        self.badges = badges
    }
}

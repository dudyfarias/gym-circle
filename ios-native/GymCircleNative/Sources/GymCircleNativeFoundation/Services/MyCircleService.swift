import Foundation
import Supabase

public actor MyCircleService {
    private let client: SupabaseClient
    private let calendar: Calendar

    public init(client: SupabaseClient, calendar: Calendar = .current) {
        self.client = client
        self.calendar = calendar
    }

    public func getSummary(userId: String, date: Date = Date()) async throws -> MyCircleSummary {
        async let statsRow = fetchStats(userId: userId)
        async let activityDates = fetchActivityDates(userId: userId, since: startOfYear(for: date))

        let stats = try await statsRow
        let dates = try await activityDates
        let uniqueDates = Set(dates.map(\.activityDate))

        let workoutsThisWeek = uniqueDates.filter { isDateString($0, inSameComponentAs: date, component: .weekOfYear) }.count
        let workoutsThisMonth = uniqueDates.filter { isDateString($0, inSameComponentAs: date, component: .month) }.count
        let workoutsThisYear = uniqueDates.filter { isDateString($0, inSameComponentAs: date, component: .year) }.count

        return MyCircleSummary(
            stats: GymCircleStats(
                currentStreak: stats?.currentStreak ?? 0,
                bestStreak: stats?.bestStreak ?? 0,
                workoutsThisWeek: workoutsThisWeek,
                workoutsThisMonth: workoutsThisMonth,
                workoutsThisYear: workoutsThisYear
            )
        )
    }

    public func getConsistencyRings(userId: String, date: Date = Date()) async throws -> ConsistencyRings {
        try await getSummary(userId: userId, date: date).rings
    }

    private func fetchStats(userId: String) async throws -> UserStatsLiveRow? {
        let rows: [UserStatsLiveRow] = try await client
            .from("user_stats_live")
            .select("user_id,current_streak,best_streak,workouts_this_month,active_days_this_year,badge_is_active_today")
            .eq("user_id", value: userId)
            .execute()
            .value

        return rows.first
    }

    private func fetchActivityDates(userId: String, since: String) async throws -> [UserActivityDayRow] {
        try await client
            .from("user_activity_days")
            .select("activity_date")
            .eq("user_id", value: userId)
            .gte("activity_date", value: since)
            .execute()
            .value
    }

    private func startOfYear(for date: Date) -> String {
        let year = calendar.component(.year, from: date)
        return "\(year)-01-01"
    }

    private func isDateString(_ value: String, inSameComponentAs date: Date, component: Calendar.Component) -> Bool {
        guard let parsed = Self.dateFormatter.date(from: value) else {
            return false
        }
        return calendar.isDate(parsed, equalTo: date, toGranularity: component)
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

private struct UserStatsLiveRow: Codable, Sendable {
    let userId: String
    let currentStreak: Int
    let bestStreak: Int
    let workoutsThisMonth: Int
    let activeDaysThisYear: Int
    let badgeIsActiveToday: Bool

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case currentStreak = "current_streak"
        case bestStreak = "best_streak"
        case workoutsThisMonth = "workouts_this_month"
        case activeDaysThisYear = "active_days_this_year"
        case badgeIsActiveToday = "badge_is_active_today"
    }
}

private struct UserActivityDayRow: Codable, Sendable {
    let activityDate: String

    enum CodingKeys: String, CodingKey {
        case activityDate = "activity_date"
    }
}

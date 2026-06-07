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
        // Sprint 8.11.1 — Fan-out: dispara TODAS as queries em paralelo.
        // Latência total ≈ max(query) em vez de soma.
        async let statsRow = fetchStats(userId: userId)
        async let activityDates = fetchActivityDates(userId: userId, since: startOfYear(for: date))
        async let postsCount = fetchPostsCount(userId: userId)
        async let followersCount = fetchFollowersCount(userId: userId)
        async let streakRestoreInfo = fetchStreakRestoreInfo(userId: userId)

        let stats = try await statsRow
        let dates = try await activityDates
        let uniqueDates = Set(dates.map(\.activityDate))

        let workoutsThisWeek = uniqueDates.filter { isDateString($0, inSameComponentAs: date, component: .weekOfYear) }.count
        let workoutsThisMonth = uniqueDates.filter { isDateString($0, inSameComponentAs: date, component: .month) }.count
        let workoutsThisYear = uniqueDates.filter { isDateString($0, inSameComponentAs: date, component: .year) }.count

        // Sprint 8.11.2 — datas do mês alvo (já filtradas) pro calendar.
        let monthDays = uniqueDates.filter { isDateString($0, inSameComponentAs: date, component: .month) }

        // Best effort nas contagens — falha não bloqueia summary.
        let postsCountValue = (try? await postsCount) ?? 0
        let followersCountValue = (try? await followersCount) ?? 0
        let streakRestore = (try? await streakRestoreInfo) ?? false

        return MyCircleSummary(
            stats: GymCircleStats(
                currentStreak: stats?.currentStreak ?? 0,
                bestStreak: stats?.bestStreak ?? 0,
                workoutsThisWeek: workoutsThisWeek,
                workoutsThisMonth: workoutsThisMonth,
                workoutsThisYear: workoutsThisYear
            ),
            postsCount: postsCountValue,
            followersCount: followersCountValue,
            hasUsedStreakRestore: streakRestore,
            workoutDays: Array(monthDays).sorted()
        )
    }

    public func getConsistencyRings(userId: String, date: Date = Date()) async throws -> ConsistencyRings {
        try await getSummary(userId: userId, date: date).rings
    }

    /// Sprint 8.13.1 — posts do mês para renderizar thumbnails no calendar.
    /// Retorna lista (workout_date, post_id, image_url) ordenada por
    /// workout_date asc. UI agrupa por dia (1 thumbnail por dia, prefere
    /// o primeiro post quando há mais que 1 no mesmo dia).
    public func getMonthPosts(userId: String, monthKey: String) async throws -> [MonthCalendarPost] {
        let parts = monthKey.split(separator: "-")
        guard parts.count == 2,
              let year = Int(parts[0]),
              let month = Int(parts[1]) else { return [] }

        let monthStart = String(format: "%04d-%02d-01", year, month)
        let nextMonth = month == 12 ? 1 : month + 1
        let nextYear = month == 12 ? year + 1 : year
        let monthEnd = String(format: "%04d-%02d-01", nextYear, nextMonth)

        let rows: [PostThumbnailRow] = try await client
            .from("posts")
            .select("id,workout_date,image_url")
            .eq("user_id", value: userId)
            .gte("workout_date", value: monthStart)
            .lt("workout_date", value: monthEnd)
            .order("workout_date", ascending: true)
            .execute()
            .value

        return rows.compactMap { row in
            guard let url = URL(string: row.imageURL) else { return nil }
            return MonthCalendarPost(
                dateKey: row.workoutDate,
                postId: row.id,
                imageURL: url
            )
        }
    }

    /// Sprint 8.11.3 — workout days de um mês específico (YYYY-MM).
    /// Usado pela navegação calendar ← → no MyCircleView. Range filtrado
    /// no DB pra evitar transferir o ano inteiro só pra mostrar 1 mês.
    public func getWorkoutDays(userId: String, monthKey: String) async throws -> [String] {
        let parts = monthKey.split(separator: "-")
        guard parts.count == 2,
              let year = Int(parts[0]),
              let month = Int(parts[1]) else { return [] }

        let monthStart = String(format: "%04d-%02d-01", year, month)
        // 1º dia do próximo mês = limite superior (exclusive via lt)
        let nextMonth = month == 12 ? 1 : month + 1
        let nextYear = month == 12 ? year + 1 : year
        let monthEnd = String(format: "%04d-%02d-01", nextYear, nextMonth)

        let rows: [UserActivityDayRow] = try await client
            .from("user_activity_days")
            .select("activity_date")
            .eq("user_id", value: userId)
            .gte("activity_date", value: monthStart)
            .lt("activity_date", value: monthEnd)
            .execute()
            .value
        return Array(Set(rows.map(\.activityDate))).sorted()
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

    /// Sprint 8.11.1 — count(posts where user_id = userId).
    /// Usa head request com count=exact pra evitar baixar rows.
    private func fetchPostsCount(userId: String) async throws -> Int {
        let response = try await client
            .from("posts")
            .select("id", head: true, count: .exact)
            .eq("user_id", value: userId)
            .execute()
        return response.count ?? 0
    }

    /// Sprint 8.11.1 — count(follows where following_id = userId).
    /// `following_id` é quem está sendo seguido. Followers = pessoas que
    /// seguem o user (follower_id apontando pra user).
    private func fetchFollowersCount(userId: String) async throws -> Int {
        let response = try await client
            .from("follows")
            .select("follower_id", head: true, count: .exact)
            .eq("following_id", value: userId)
            .execute()
        return response.count ?? 0
    }

    /// Sprint 8.11.1 — true se `user_stats.last_streak_restore_used_at` é
    /// não-nulo (qualquer uso histórico desbloqueia badge).
    private func fetchStreakRestoreInfo(userId: String) async throws -> Bool {
        let rows: [UserStatsRestoreRow] = try await client
            .from("user_stats")
            .select("last_streak_restore_used_at")
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value
        return rows.first?.lastStreakRestoreUsedAt != nil
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

/// Sprint 8.11.1 — `user_stats.last_streak_restore_used_at` shape mínimo.
/// Só lê 1 coluna pra checar "user já usou pelo menos 1 streak restore?".
private struct UserStatsRestoreRow: Codable, Sendable {
    let lastStreakRestoreUsedAt: Date?

    enum CodingKeys: String, CodingKey {
        case lastStreakRestoreUsedAt = "last_streak_restore_used_at"
    }
}

/// Sprint 8.13.1 — row de `posts` pra renderizar thumbnail no calendar.
private struct PostThumbnailRow: Codable, Sendable {
    let id: String
    let workoutDate: String
    let imageURL: String

    enum CodingKeys: String, CodingKey {
        case id
        case workoutDate = "workout_date"
        case imageURL = "image_url"
    }
}

/// Sprint 8.13.1 — payload usado por UI calendar (1 thumbnail por dia).
public struct MonthCalendarPost: Hashable, Sendable {
    public let dateKey: String  // YYYY-MM-DD
    public let postId: String
    public let imageURL: URL
}

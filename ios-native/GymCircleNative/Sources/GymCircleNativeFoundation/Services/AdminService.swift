import Foundation
import Supabase

// MARK: - Linhas do painel admin (paridade web adminService — só leitura)

public struct AdminSummary: Decodable, Sendable {
    public let usersRegistered: Int?
    public let postsToday: Int?
    public let activeUsersToday: Int?
    public let streaksLitToday: Int?
    public let openReports: Int?
    public let blocksTotal: Int?

    enum CodingKeys: String, CodingKey {
        case usersRegistered = "users_registered"
        case postsToday = "posts_today"
        case activeUsersToday = "active_users_today"
        case streaksLitToday = "streaks_lit_today"
        case openReports = "open_reports"
        case blocksTotal = "blocks_total"
    }
}

public struct AdminDailyMetric: Decodable, Identifiable, Sendable {
    public let metricDate: String
    public let activeUsers: Int?
    public let postsCreated: Int?
    public let storiesCreated: Int?
    public let streaksLit: Int?
    public let usersRegistered: Int?

    public var id: String { metricDate }

    enum CodingKeys: String, CodingKey {
        case metricDate = "metric_date"
        case activeUsers = "active_users"
        case postsCreated = "posts_created"
        case storiesCreated = "stories_created"
        case streaksLit = "streaks_lit"
        case usersRegistered = "users_registered"
    }
}

public struct AdminReportRow: Decodable, Identifiable, Sendable {
    public let id: String
    public let reason: String?
    public let status: String?
    public let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, reason, status
        case createdAt = "created_at"
    }
}

public struct AdminBlockRow: Decodable, Identifiable, Sendable {
    public let blockerId: String
    public let blockedId: String
    public let reason: String?
    public let createdAt: String

    public var id: String { "\(blockerId)-\(blockedId)" }

    enum CodingKeys: String, CodingKey {
        case blockerId = "blocker_id"
        case blockedId = "blocked_id"
        case reason
        case createdAt = "created_at"
    }
}

public struct AdminDeletionRow: Decodable, Identifiable, Sendable {
    public let id: String
    public let reason: String?
    public let status: String?
    public let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, reason, status
        case createdAt = "created_at"
    }
}

/// AdminService — paridade web `adminService` (Alpha admin, só leitura). As
/// views/tabelas têm RLS de admin no server (mesma policy que libera no web).
public final class AdminService {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    public func summary() async throws -> AdminSummary? {
        let rows: [AdminSummary] = try await client
            .from("alpha_admin_summary")
            .select("*")
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    public func dailyMetrics(limit: Int = 10) async throws -> [AdminDailyMetric] {
        try await client
            .from("alpha_admin_daily_metrics")
            .select("*")
            .order("metric_date", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    public func reports(limit: Int = 12) async throws -> [AdminReportRow] {
        try await client
            .from("reports")
            .select("*")
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    public func blocks(limit: Int = 12) async throws -> [AdminBlockRow] {
        try await client
            .from("user_blocks")
            .select("*")
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    public func deletionRequests(limit: Int = 12) async throws -> [AdminDeletionRow] {
        try await client
            .from("account_deletion_requests")
            .select("*")
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }
}

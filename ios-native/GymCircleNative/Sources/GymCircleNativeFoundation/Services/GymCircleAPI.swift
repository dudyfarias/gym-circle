import Foundation
import Supabase

public actor GymCircleAPI {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    public func signIn(email: String, password: String) async throws {
        try await client.auth.signIn(email: email, password: password)
    }

    public func signOut() async throws {
        try await client.auth.signOut()
    }

    public func currentProfile(userId: String) async throws -> UserProfile {
        async let profileRow = fetchProfile(userId: userId)
        async let statsRow = fetchStats(userId: userId)

        let profile = try await profileRow
        let stats = try await statsRow

        return UserProfile(
            id: profile.id,
            userId: profile.userId,
            username: profile.username,
            displayName: profile.displayName,
            avatarURL: profile.avatarURL,
            bio: profile.bio,
            fitnessGoal: profile.fitnessGoal,
            isPrivate: profile.isPrivate,
            currentStreak: stats?.currentStreak ?? 0,
            bestStreak: stats?.bestStreak ?? 0,
            badgeIsActiveToday: stats?.badgeIsActiveToday ?? false
        )
    }

    public func homeFeed(cursorCreatedAt: String? = nil, limit: Int = 30) async throws -> [FeedPost] {
        let params = HomeFeedParams(
            p_cursor_created_at: cursorCreatedAt,
            p_limit: limit
        )

        return try await client
            .rpc("get_home_feed", params: params)
            .execute()
            .value
    }

    public func storyTray(limit: Int = 40) async throws -> [StoryAuthorGroup] {
        let params = StoryTrayParams(p_limit: limit)

        return try await client
            .rpc("get_story_tray_lightweight", params: params)
            .execute()
            .value
    }

    public func storyViewerItems(authorId: String) async throws -> [StoryItem] {
        let params = StoryViewerParams(p_author_id: authorId)

        return try await client
            .rpc("get_story_viewer_items", params: params)
            .execute()
            .value
    }

    public func profilePosts(userId: String, cursorCreatedAt: String? = nil, limit: Int = 30) async throws -> [FeedPost] {
        let params = ProfilePostsParams(
            p_user_id: userId,
            p_cursor_created_at: cursorCreatedAt,
            p_limit: limit
        )

        return try await client
            .rpc("get_profile_posts", params: params)
            .execute()
            .value
    }

    private func fetchProfile(userId: String) async throws -> ProfileRow {
        try await client
            .from("profiles")
            .select("id,user_id,username,display_name,avatar_url,bio,fitness_goal,is_private")
            .eq("user_id", value: userId)
            .single()
            .execute()
            .value
    }

    private func fetchStats(userId: String) async throws -> UserStatsRow? {
        let rows: [UserStatsRow] = try await client
            .from("user_stats_live")
            .select("user_id,current_streak,best_streak,badge_is_active_today")
            .eq("user_id", value: userId)
            .execute()
            .value

        return rows.first
    }
}

private struct HomeFeedParams: Encodable {
    let p_cursor_created_at: String?
    let p_limit: Int
}

private struct StoryTrayParams: Encodable {
    let p_limit: Int
}

private struct StoryViewerParams: Encodable {
    let p_author_id: String
}

private struct ProfilePostsParams: Encodable {
    let p_user_id: String
    let p_cursor_created_at: String?
    let p_limit: Int
}

private struct ProfileRow: Decodable, Sendable {
    let id: String
    let userId: String
    let username: String
    let displayName: String?
    let avatarURL: String?
    let bio: String?
    let fitnessGoal: String?
    let isPrivate: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case username
        case displayName = "display_name"
        case avatarURL = "avatar_url"
        case bio
        case fitnessGoal = "fitness_goal"
        case isPrivate = "is_private"
    }
}

private struct UserStatsRow: Decodable, Sendable {
    let userId: String
    let currentStreak: Int
    let bestStreak: Int
    let badgeIsActiveToday: Bool

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case currentStreak = "current_streak"
        case bestStreak = "best_streak"
        case badgeIsActiveToday = "badge_is_active_today"
    }
}

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

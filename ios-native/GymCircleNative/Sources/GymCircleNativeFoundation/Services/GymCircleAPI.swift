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

    /// Sprint 20.3a — mídias do carrossel pros posts dados (post_media
    /// ordenado por position). Retorna dicionário post_id → itens; posts
    /// sem entrada são mídia única.
    public func postMedia(postIds: [String]) async throws -> [String: [PostMediaItem]] {
        guard !postIds.isEmpty else { return [:] }
        let rows: [PostMediaItem] = try await client
            .from("post_media")
            .select("id,post_id,position,media_type,image_url,thumbnail_url,poster_url,media_width,media_height")
            .in("post_id", values: postIds)
            .order("position", ascending: true)
            .execute()
            .value
        return Dictionary(grouping: rows, by: \.postId)
    }

    /// Sprint 20.3a — curtir/descurtir. Idempotente: upsert no like
    /// (re-curtir não duplica), delete escopado no unlike.
    public func setLike(postId: String, userId: String, liked: Bool) async throws {
        if liked {
            try await client
                .from("post_likes")
                .upsert(
                    PostLikeInsert(post_id: postId, user_id: userId),
                    onConflict: "post_id,user_id"
                )
                .execute()
        } else {
            try await client
                .from("post_likes")
                .delete()
                .eq("post_id", value: postId)
                .eq("user_id", value: userId)
                .execute()
        }
    }
}

private struct PostLikeInsert: Encodable {
    let post_id: String
    let user_id: String
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

import Foundation
import Supabase

/// CommentsService — Sprint 20.3b (paridade Sprint 12.1 web).
///
/// Compõe post_comments + post_comment_likes + profiles dos autores em
/// [PostComment] pronto pra UI. Mutations: add (com reply), delete dos
/// próprios, like/unlike idempotente.
public actor CommentsService {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    // MARK: - Rows

    private struct CommentRow: Decodable {
        let id: String
        let post_id: String
        let user_id: String
        let parent_comment_id: String?
        let body: String
        let created_at: String
    }

    private struct CommentLikeRow: Decodable {
        let comment_id: String
        let user_id: String
    }

    private struct AuthorRow: Decodable {
        let user_id: String
        let username: String
        let display_name: String?
        let avatar_url: String?
    }

    private struct StatRow: Decodable {
        let user_id: String
        let current_streak: Int?
    }

    private struct NewCommentInsert: Encodable {
        let post_id: String
        let user_id: String
        let body: String
        let parent_comment_id: String?
    }

    private struct CommentLikeInsert: Encodable {
        let comment_id: String
        let user_id: String
    }

    // MARK: - Queries

    /// Lista completa do post (ordenada por created_at asc, replies
    /// incluídas — a UI agrupa por parent_comment_id).
    public func listComments(postId: String, currentUserId: String) async throws -> [PostComment] {
        let rows: [CommentRow] = try await client
            .from("post_comments")
            .select("id,post_id,user_id,parent_comment_id,body,created_at")
            .eq("post_id", value: postId)
            .order("created_at", ascending: true)
            .execute()
            .value
        guard !rows.isEmpty else { return [] }

        let commentIds = rows.map(\.id)
        let userIds = Array(Set(rows.map(\.user_id)))

        // Fail-soft nos satélites: comentários aparecem mesmo se likes ou
        // autores falharem (autor cai no fallback "user").
        let likes: [CommentLikeRow] = (try? await client
            .from("post_comment_likes")
            .select("comment_id,user_id")
            .in("comment_id", values: commentIds)
            .execute()
            .value) ?? []
        let authors: [AuthorRow] = (try? await client
            .from("profiles")
            .select("user_id,username,display_name,avatar_url")
            .in("user_id", values: userIds)
            .execute()
            .value) ?? []
        // Streak por autor (paridade com o StreakBadge do comentário no web).
        let stats: [StatRow] = (try? await client
            .from("user_stats_live")
            .select("user_id,current_streak")
            .in("user_id", values: userIds)
            .execute()
            .value) ?? []

        let likesByComment = Dictionary(grouping: likes, by: \.comment_id)
        let authorsById = Dictionary(uniqueKeysWithValues: authors.map { ($0.user_id, $0) })
        let streakByUser = Dictionary(
            uniqueKeysWithValues: stats.map { ($0.user_id, $0.current_streak ?? 0) }
        )

        return rows.map { row in
            let commentLikes = likesByComment[row.id] ?? []
            let author = authorsById[row.user_id]
            return PostComment(
                id: row.id,
                postId: row.post_id,
                userId: row.user_id,
                parentCommentId: row.parent_comment_id,
                body: row.body,
                createdAt: row.created_at,
                authorUsername: author?.username ?? "user",
                authorDisplayName: author?.display_name,
                authorAvatarURL: author?.avatar_url,
                authorStreak: streakByUser[row.user_id] ?? 0,
                likesCount: commentLikes.count,
                likedByMe: commentLikes.contains { $0.user_id == currentUserId }
            )
        }
    }

    // MARK: - Mutations

    /// Insere comentário (ou reply quando parentCommentId != nil) e
    /// retorna o id criado. Caller re-lista pra compor com autor.
    @discardableResult
    public func addComment(
        postId: String,
        userId: String,
        body: String,
        parentCommentId: String? = nil
    ) async throws -> String {
        struct InsertedRow: Decodable { let id: String }
        let inserted: InsertedRow = try await client
            .from("post_comments")
            .insert(NewCommentInsert(
                post_id: postId,
                user_id: userId,
                body: body,
                parent_comment_id: parentCommentId
            ))
            .select("id")
            .single()
            .execute()
            .value
        return inserted.id
    }

    /// Delete escopado por user_id — RLS já garante, o eq é cinto de
    /// segurança contra regressão de policy.
    public func deleteComment(commentId: String, userId: String) async throws {
        try await client
            .from("post_comments")
            .delete()
            .eq("id", value: commentId)
            .eq("user_id", value: userId)
            .execute()
    }

    /// Like/unlike idempotente (mesmo padrão do setLike de post).
    public func setCommentLike(commentId: String, userId: String, liked: Bool) async throws {
        if liked {
            try await client
                .from("post_comment_likes")
                .upsert(
                    CommentLikeInsert(comment_id: commentId, user_id: userId),
                    onConflict: "comment_id,user_id"
                )
                .execute()
        } else {
            try await client
                .from("post_comment_likes")
                .delete()
                .eq("comment_id", value: commentId)
                .eq("user_id", value: userId)
                .execute()
        }
    }
}

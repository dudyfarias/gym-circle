import Foundation

/// Sprint 20.3b — comentário composto pra UI: linha de post_comments +
/// autor (profiles) + likes (post_comment_likes). A composição acontece
/// no CommentsService; a UI só renderiza.
public struct PostComment: Identifiable, Hashable, Sendable {
    public let id: String
    public let postId: String
    public let userId: String
    public let parentCommentId: String?
    public let body: String
    public let createdAt: String
    public let authorUsername: String
    public let authorDisplayName: String?
    public let authorAvatarURL: String?
    /// Streak atual do autor (paridade com o StreakBadge do comentário no web).
    public let authorStreak: Int
    public var likesCount: Int
    public var likedByMe: Bool

    public var displayAuthorName: String {
        authorDisplayName?.isEmpty == false ? authorDisplayName! : authorUsername
    }

    public init(
        id: String,
        postId: String,
        userId: String,
        parentCommentId: String?,
        body: String,
        createdAt: String,
        authorUsername: String,
        authorDisplayName: String?,
        authorAvatarURL: String?,
        authorStreak: Int = 0,
        likesCount: Int,
        likedByMe: Bool
    ) {
        self.id = id
        self.postId = postId
        self.userId = userId
        self.parentCommentId = parentCommentId
        self.body = body
        self.createdAt = createdAt
        self.authorUsername = authorUsername
        self.authorDisplayName = authorDisplayName
        self.authorAvatarURL = authorAvatarURL
        self.authorStreak = authorStreak
        self.likesCount = likesCount
        self.likedByMe = likedByMe
    }
}

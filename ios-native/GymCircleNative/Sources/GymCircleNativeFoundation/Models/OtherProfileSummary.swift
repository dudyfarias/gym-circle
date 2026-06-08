import Foundation

/// OtherProfileSummary — Sprint 11.1
///
/// Container retornado por `ProfilesService.getOtherProfileSummary()`.
/// Agrega profile + stats + posts + counts numa única estrutura pra UX
/// estilo Instagram (Posts | Seguidores | Seguindo) com paridade de
/// dados que vinham faltando no OtherProfileView.
///
/// Antes desta sprint:
///   - `UserProfile.currentStreak/bestStreak` sempre 0 (não vinham de
///     user_stats)
///   - `posts` array era state vazio (nunca populado)
///   - Followers/following nem existiam na UI
public struct OtherProfileSummary: Sendable {
    public let profile: UserProfile
    public let posts: [ProfilePost]
    public let postsCount: Int
    public let followersCount: Int
    public let followingCount: Int
    public let currentStreak: Int
    public let bestStreak: Int
    public let workoutsThisMonth: Int
    public let isFollowingAuthor: Bool

    public init(
        profile: UserProfile,
        posts: [ProfilePost],
        postsCount: Int,
        followersCount: Int,
        followingCount: Int,
        currentStreak: Int,
        bestStreak: Int,
        workoutsThisMonth: Int,
        isFollowingAuthor: Bool
    ) {
        self.profile = profile
        self.posts = posts
        self.postsCount = postsCount
        self.followersCount = followersCount
        self.followingCount = followingCount
        self.currentStreak = currentStreak
        self.bestStreak = bestStreak
        self.workoutsThisMonth = workoutsThisMonth
        self.isFollowingAuthor = isFollowingAuthor
    }
}

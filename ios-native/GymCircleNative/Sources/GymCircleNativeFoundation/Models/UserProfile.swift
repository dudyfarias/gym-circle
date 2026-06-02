import Foundation

public struct UserProfile: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public let userId: String
    public let username: String
    public let displayName: String?
    public let avatarURL: String?
    public let bio: String?
    public let fitnessGoal: String?
    public let isPrivate: Bool
    public let currentStreak: Int
    public let bestStreak: Int
    public let badgeIsActiveToday: Bool

    public init(
        id: String,
        userId: String,
        username: String,
        displayName: String? = nil,
        avatarURL: String? = nil,
        bio: String? = nil,
        fitnessGoal: String? = nil,
        isPrivate: Bool = false,
        currentStreak: Int = 0,
        bestStreak: Int = 0,
        badgeIsActiveToday: Bool = false
    ) {
        self.id = id
        self.userId = userId
        self.username = username
        self.displayName = displayName
        self.avatarURL = avatarURL
        self.bio = bio
        self.fitnessGoal = fitnessGoal
        self.isPrivate = isPrivate
        self.currentStreak = currentStreak
        self.bestStreak = bestStreak
        self.badgeIsActiveToday = badgeIsActiveToday
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case username
        case displayName = "display_name"
        case avatarURL = "avatar_url"
        case bio
        case fitnessGoal = "fitness_goal"
        case isPrivate = "is_private"
        case currentStreak = "current_streak"
        case bestStreak = "best_streak"
        case badgeIsActiveToday = "badge_is_active_today"
    }
}

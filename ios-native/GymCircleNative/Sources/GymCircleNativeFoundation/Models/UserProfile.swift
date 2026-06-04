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

    /// Sprint 8.0 — IDs compositos dos achievements equipados no perfil.
    /// Default array vazio. Mapeia `profiles.featured_achievements` JSONB.
    /// Cada string formato "kind:id" (ou "challenge:periodKey:id").
    public let featuredAchievements: [String]

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
        badgeIsActiveToday: Bool = false,
        featuredAchievements: [String] = []
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
        self.featuredAchievements = featuredAchievements
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
        case featuredAchievements = "featured_achievements"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(String.self, forKey: .id)
        self.userId = try container.decode(String.self, forKey: .userId)
        self.username = try container.decode(String.self, forKey: .username)
        self.displayName = try container.decodeIfPresent(String.self, forKey: .displayName)
        self.avatarURL = try container.decodeIfPresent(String.self, forKey: .avatarURL)
        self.bio = try container.decodeIfPresent(String.self, forKey: .bio)
        self.fitnessGoal = try container.decodeIfPresent(String.self, forKey: .fitnessGoal)
        self.isPrivate = try container.decodeIfPresent(Bool.self, forKey: .isPrivate) ?? false
        self.currentStreak = try container.decodeIfPresent(Int.self, forKey: .currentStreak) ?? 0
        self.bestStreak = try container.decodeIfPresent(Int.self, forKey: .bestStreak) ?? 0
        self.badgeIsActiveToday = try container.decodeIfPresent(Bool.self, forKey: .badgeIsActiveToday) ?? false
        self.featuredAchievements = try container.decodeIfPresent([String].self, forKey: .featuredAchievements) ?? []
    }
}

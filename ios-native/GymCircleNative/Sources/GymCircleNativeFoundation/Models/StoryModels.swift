import Foundation

public struct StoryAuthorGroup: Identifiable, Codable, Hashable, Sendable {
    public var id: String { authorId }

    public let authorId: String
    public let username: String
    public let displayName: String?
    public let avatarURL: String?
    public let currentStreak: Int
    public let badgeIsActiveToday: Bool
    public let hasUnseen: Bool
    public let latestStoryAt: String
    public let storyCount: Int
    public let firstUnseenStoryId: String?
    public let firstStoryId: String?

    enum CodingKeys: String, CodingKey {
        case authorId = "author_id"
        case username
        case displayName = "display_name"
        case avatarURL = "avatar_url"
        case currentStreak = "current_streak"
        case badgeIsActiveToday = "badge_is_active_today"
        case hasUnseen = "has_unseen"
        case latestStoryAt = "latest_story_at"
        case storyCount = "story_count"
        case firstUnseenStoryId = "first_unseen_story_id"
        case firstStoryId = "first_story_id"
    }
}

public struct StoryItem: Identifiable, Codable, Hashable, Sendable {
    public var id: String { storyId }

    public let storyId: String
    public let userId: String
    public let mediaURL: String
    public let thumbnailURL: String?
    public let posterURL: String?
    public let mediaWidth: Int?
    public let mediaHeight: Int?
    public let mediaDurationSeconds: Double?
    public let blurDataURL: String?
    public let mediaType: FeedMediaType?
    public let caption: String?
    public let gymId: String?
    public let workoutType: String?
    public let locationName: String?
    public let createdAt: String
    public let expiresAt: String
    public let viewerHasLiked: Bool?
    public let viewerHasSeen: Bool?

    public var displayMediaURL: String {
        thumbnailURL ?? posterURL ?? mediaURL
    }

    enum CodingKeys: String, CodingKey {
        case storyId = "story_id"
        case userId = "user_id"
        case mediaURL = "media_url"
        case thumbnailURL = "thumbnail_url"
        case posterURL = "poster_url"
        case mediaWidth = "media_width"
        case mediaHeight = "media_height"
        case mediaDurationSeconds = "media_duration_seconds"
        case blurDataURL = "blur_data_url"
        case mediaType = "media_type"
        case caption
        case gymId = "gym_id"
        case workoutType = "workout_type"
        case locationName = "location_name"
        case createdAt = "created_at"
        case expiresAt = "expires_at"
        case viewerHasLiked = "viewer_has_liked"
        case viewerHasSeen = "viewer_has_seen"
    }
}

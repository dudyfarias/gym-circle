import Foundation

public enum FeedMediaType: String, Codable, Sendable {
    case image
    case video
}

public struct FeedPost: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public let userId: String
    public let imageURL: String
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
    public let workoutDate: String?
    public let createdAt: String
    public let locationSource: String?
    public let locationName: String?
    public let likesCount: Int
    public let commentsCount: Int
    public let username: String
    public let displayName: String?
    public let avatarURL: String?
    public let authorCurrentStreak: Int?
    public let authorBestStreak: Int?
    public let authorBadgeActive: Bool?
    public let likedByMe: Bool?
    public let isFollowingAuthor: Bool?
    public let visibility: String?

    public var displayAuthorName: String {
        displayName?.isEmpty == false ? displayName! : username
    }

    public var displayMediaURL: String {
        thumbnailURL ?? posterURL ?? imageURL
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case imageURL = "image_url"
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
        case workoutDate = "workout_date"
        case createdAt = "created_at"
        case locationSource = "location_source"
        case locationName = "location_name"
        case likesCount = "likes_count"
        case commentsCount = "comments_count"
        case username
        case displayName = "display_name"
        case avatarURL = "avatar_url"
        case authorCurrentStreak = "author_current_streak"
        case authorBestStreak = "author_best_streak"
        case authorBadgeActive = "author_badge_active"
        case likedByMe = "liked_by_me"
        case isFollowingAuthor = "is_following_author"
        case visibility
    }
}

public typealias ProfilePost = FeedPost

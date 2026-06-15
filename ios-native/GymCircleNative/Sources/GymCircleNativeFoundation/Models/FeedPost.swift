import Foundation

public enum FeedMediaType: String, Codable, Sendable {
    case image
    case video
}

/// Sprint 20.3a — item do carrossel (linha de `post_media`, ordenada por
/// position). Post sem linhas = mídia única (a capa em posts.* continua
/// sendo a fonte, paridade com a Sprint 13 web).
public struct PostMediaItem: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public let postId: String
    public let position: Int
    public let mediaType: FeedMediaType?
    public let imageURL: String
    public let thumbnailURL: String?
    public let posterURL: String?
    public let mediaWidth: Int?
    public let mediaHeight: Int?

    /// Mesma regra de exibição da capa: thumbnail → poster → original.
    public var displayURL: String {
        thumbnailURL ?? posterURL ?? imageURL
    }

    enum CodingKeys: String, CodingKey {
        case id
        case postId = "post_id"
        case position
        case mediaType = "media_type"
        case imageURL = "image_url"
        case thumbnailURL = "thumbnail_url"
        case posterURL = "poster_url"
        case mediaWidth = "media_width"
        case mediaHeight = "media_height"
    }
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
    // Sprint 20.7 — coords do local (RPC get_home_feed) pra distância do viewer.
    public let locationLatitude: Double?
    public let locationLongitude: Double?
    // Sprint 20.3a/b — vars pra update otimista de like e contador de
    // comentários (sheet reporta delta).
    public var likesCount: Int
    public var commentsCount: Int
    public let username: String
    public let displayName: String?
    public let avatarURL: String?
    public let authorCurrentStreak: Int?
    public let authorBestStreak: Int?
    public let authorBadgeActive: Bool?
    // Sprint 20.3a — var pra update otimista do like.
    public var likedByMe: Bool?
    public let isFollowingAuthor: Bool?
    public let visibility: String?

    /// Sprint 20.3a — mídias do carrossel, hidratadas pós-decode (o RPC
    /// get_home_feed não retorna post_media; o AppModel agrupa numa query
    /// separada). Nil/vazio = post de mídia única (usa a capa).
    public var media: [PostMediaItem]? = nil

    /// Sprint 20.3c — participantes do treino em grupo, hidratados como o
    /// carrossel (query única agrupada).
    public var participants: [PostParticipant]? = nil

    public var acceptedParticipants: [PostParticipant] {
        (participants ?? []).filter { $0.status == "accepted" }
    }

    /// Convite pendente do user dado neste post (banner Aceitar/Recusar).
    public func pendingInvite(for userId: String?) -> PostParticipant? {
        guard let userId else { return nil }
        return (participants ?? []).first {
            $0.taggedUserId == userId && $0.status == "pending"
        }
    }

    public var displayAuthorName: String {
        displayName?.isEmpty == false ? displayName! : username
    }

    public var displayMediaURL: String {
        thumbnailURL ?? posterURL ?? imageURL
    }

    /// Coordenada do local do post (quando tem lat/lng) — base da distância.
    public var coordinate: GymCircleCoordinate? {
        guard let locationLatitude, let locationLongitude else { return nil }
        return GymCircleCoordinate(latitude: locationLatitude, longitude: locationLongitude)
    }

    /// Itens prontos pro carrossel: post_media quando existe (≥1), senão a
    /// capa vira o único item — espelho do media[] sempre ≥1 da web.
    public var carouselItems: [PostMediaItem] {
        if let media, !media.isEmpty { return media }
        return [
            PostMediaItem(
                id: id,
                postId: id,
                position: 0,
                mediaType: mediaType,
                imageURL: imageURL,
                thumbnailURL: thumbnailURL,
                posterURL: posterURL,
                mediaWidth: mediaWidth,
                mediaHeight: mediaHeight
            ),
        ]
    }

    /// Sprint 11.1 — init público explícito pra construção manual em
    /// ProfilesService.getOtherProfileSummary (hidrata posts com author
    /// info do profile target).
    public init(
        id: String,
        userId: String,
        imageURL: String,
        thumbnailURL: String?,
        posterURL: String?,
        mediaWidth: Int?,
        mediaHeight: Int?,
        mediaDurationSeconds: Double?,
        blurDataURL: String?,
        mediaType: FeedMediaType?,
        caption: String?,
        gymId: String?,
        workoutType: String?,
        workoutDate: String?,
        createdAt: String,
        locationSource: String?,
        locationName: String?,
        locationLatitude: Double? = nil,
        locationLongitude: Double? = nil,
        likesCount: Int,
        commentsCount: Int,
        username: String,
        displayName: String?,
        avatarURL: String?,
        authorCurrentStreak: Int?,
        authorBestStreak: Int?,
        authorBadgeActive: Bool?,
        likedByMe: Bool?,
        isFollowingAuthor: Bool?,
        visibility: String?
    ) {
        self.id = id
        self.userId = userId
        self.imageURL = imageURL
        self.thumbnailURL = thumbnailURL
        self.posterURL = posterURL
        self.mediaWidth = mediaWidth
        self.mediaHeight = mediaHeight
        self.mediaDurationSeconds = mediaDurationSeconds
        self.blurDataURL = blurDataURL
        self.mediaType = mediaType
        self.caption = caption
        self.gymId = gymId
        self.workoutType = workoutType
        self.workoutDate = workoutDate
        self.createdAt = createdAt
        self.locationSource = locationSource
        self.locationName = locationName
        self.locationLatitude = locationLatitude
        self.locationLongitude = locationLongitude
        self.likesCount = likesCount
        self.commentsCount = commentsCount
        self.username = username
        self.displayName = displayName
        self.avatarURL = avatarURL
        self.authorCurrentStreak = authorCurrentStreak
        self.authorBestStreak = authorBestStreak
        self.authorBadgeActive = authorBadgeActive
        self.likedByMe = likedByMe
        self.isFollowingAuthor = isFollowingAuthor
        self.visibility = visibility
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
        case locationLatitude = "location_latitude"
        case locationLongitude = "location_longitude"
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

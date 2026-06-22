import Foundation

/// Sprint 20.3c — participante de treino em grupo (linha de
/// post_participants composta com o profile do marcado).
public struct PostParticipant: Identifiable, Hashable, Sendable {
    public let postId: String
    public let taggedUserId: String
    public let status: String // pending | accepted | rejected
    public let username: String
    public let displayName: String?
    public let avatarURL: String?

    public var id: String { "\(postId):\(taggedUserId)" }

    public var displayedName: String {
        displayName?.isEmpty == false ? displayName! : username
    }

    public init(
        postId: String,
        taggedUserId: String,
        status: String,
        username: String,
        displayName: String?,
        avatarURL: String?
    ) {
        self.postId = postId
        self.taggedUserId = taggedUserId
        self.status = status
        self.username = username
        self.displayName = displayName
        self.avatarURL = avatarURL
    }
}

/// Sprint 20.4b — academia selecionável no composer (tabela gyms).
public struct GymOption: Identifiable, Decodable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let address: String?
    public let city: String?
    public let state: String?
    public let latitude: Double?
    public let longitude: Double?

    public var subtitle: String {
        [address, city, state].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
    }

    public init(
        id: String,
        name: String,
        address: String? = nil,
        city: String? = nil,
        state: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil
    ) {
        self.id = id
        self.name = name
        self.address = address
        self.city = city
        self.state = state
        self.latitude = latitude
        self.longitude = longitude
    }
}

/// Sprint 20.3c — linha da busca de pessoas (RPC search_profiles).
public struct DiscoveredProfile: Identifiable, Decodable, Hashable, Sendable {
    public let userId: String
    public let username: String?
    public let displayName: String?
    public let avatarURL: String?
    public let currentStreak: Int?

    public var id: String { userId }

    public var displayedName: String {
        displayName?.isEmpty == false ? displayName! : (username ?? "user")
    }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case username
        case displayName = "display_name"
        case avatarURL = "avatar_url"
        case currentStreak = "current_streak"
    }
}

/// Sprint 22.x — post de uma academia (check-in "lugar vivo"): alimenta
/// "pessoas no gym" (hoje/semana), "amigos que treinaram lá" e o grid de posts
/// recentes do detalhe. É o feed filtrado por gym_id + autor hidratado.
public struct GymCheckInPost: Identifiable, Hashable, Sendable {
    public let id: String          // postId
    public let userId: String
    public let username: String?
    public let displayName: String?
    public let avatarURL: String?
    public let createdAtISO: String
    public let workoutType: String?
    public let thumbnailURL: String?  // mini-foto renderável (poster/thumb)
    public let isVideo: Bool

    public var displayedName: String {
        displayName?.isEmpty == false ? displayName! : (username ?? "user")
    }

    public init(
        id: String,
        userId: String,
        username: String?,
        displayName: String?,
        avatarURL: String?,
        createdAtISO: String,
        workoutType: String?,
        thumbnailURL: String?,
        isVideo: Bool
    ) {
        self.id = id
        self.userId = userId
        self.username = username
        self.displayName = displayName
        self.avatarURL = avatarURL
        self.createdAtISO = createdAtISO
        self.workoutType = workoutType
        self.thumbnailURL = thumbnailURL
        self.isVideo = isVideo
    }
}

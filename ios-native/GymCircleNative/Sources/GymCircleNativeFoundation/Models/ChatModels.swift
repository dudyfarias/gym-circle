import Foundation

/// Sprint 20.6 — resumo de conversa (RPC get_conversation_summaries).
public struct ConversationSummary: Identifiable, Decodable, Hashable, Sendable {
    public let conversationId: String
    public let type: String // "direct" | "group"
    public let name: String?
    public let imageURL: String?
    public let lastMessageAt: String?
    public let unreadCount: Int?
    public let participants: [SummaryParticipant]

    public var id: String { conversationId }
    public var isGroup: Bool { type == "group" }

    public struct SummaryParticipant: Decodable, Hashable, Sendable {
        public let userId: String?
        public let role: String?

        enum CodingKeys: String, CodingKey {
            case userId = "user_id"
            case role
        }
    }

    enum CodingKeys: String, CodingKey {
        case conversationId = "conversation_id"
        case type
        case name
        case imageURL = "image_url"
        case lastMessageAt = "last_message_at"
        case unreadCount = "unread_count"
        case participants
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        conversationId = try container.decode(String.self, forKey: .conversationId)
        type = (try? container.decode(String.self, forKey: .type)) ?? "direct"
        name = try? container.decodeIfPresent(String.self, forKey: .name)
        imageURL = try? container.decodeIfPresent(String.self, forKey: .imageURL)
        lastMessageAt = try? container.decodeIfPresent(String.self, forKey: .lastMessageAt)
        unreadCount = try? container.decodeIfPresent(Int.self, forKey: .unreadCount)
        // O RPC pode devolver participants como JSON nativo OU string
        // (paridade do parseJsonValue web) — tenta os dois.
        if let direct = try? container.decodeIfPresent([SummaryParticipant].self, forKey: .participants) {
            participants = direct
        } else if let raw = try? container.decodeIfPresent(String.self, forKey: .participants),
                  let data = raw.data(using: .utf8),
                  let parsed = try? JSONDecoder().decode([SummaryParticipant].self, from: data) {
            participants = parsed
        } else {
            participants = []
        }
    }
}

/// Sprint 20.6 — mensagem (direct_messages / RPC get_conversation_messages).
public struct ChatMessage: Identifiable, Decodable, Hashable, Sendable {
    public let id: String
    public let conversationId: String?
    public let senderId: String
    public let receiverId: String?
    public let body: String?
    public let mediaURL: String?
    public let mediaType: String?
    public let storyId: String?
    public let replyToStory: Bool?
    public let storyPreviewURL: String?
    public let createdAt: String
    public let readAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case conversationId = "conversation_id"
        case senderId = "sender_id"
        case receiverId = "receiver_id"
        case body
        case mediaURL = "media_url"
        case mediaType = "media_type"
        case storyId = "story_id"
        case replyToStory = "reply_to_story"
        case storyPreviewURL = "story_preview_url"
        case createdAt = "created_at"
        case readAt = "read_at"
    }
}

/// Conversa pronta pra UI: summary + nome/avatar resolvidos (grupo usa
/// name/image próprios; direct usa o profile do peer).
public struct ChatThread: Identifiable, Hashable, Sendable {
    public let summary: ConversationSummary
    public let displayName: String
    public let avatarURL: String?
    /// Peer da conversa 1:1 (nil em grupo) — destino do send_direct_message.
    public let peerUserId: String?

    public var id: String { summary.conversationId }

    public init(
        summary: ConversationSummary,
        displayName: String,
        avatarURL: String?,
        peerUserId: String?
    ) {
        self.summary = summary
        self.displayName = displayName
        self.avatarURL = avatarURL
        self.peerUserId = peerUserId
    }
}

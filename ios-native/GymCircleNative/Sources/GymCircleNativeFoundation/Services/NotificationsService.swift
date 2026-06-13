import Foundation
import Supabase

/// Sprint 20.7 — notificação do sino composta com o profile do ator.
public struct AppNotification: Identifiable, Hashable, Sendable {
    public let id: String
    public let kind: String
    public let actorId: String?
    public let postId: String?
    public let commentId: String?
    public let storyId: String?
    public let body: String?
    public let readAt: String?
    public let createdAt: String
    public let actorUsername: String
    public let actorDisplayName: String?
    public let actorAvatarURL: String?

    public var isUnread: Bool { readAt == nil }

    public var displayedActorName: String {
        actorDisplayName?.isEmpty == false ? actorDisplayName! : actorUsername
    }

    /// Texto localizado por kind (paridade NotificationsSheet web, PT/EN).
    public var message: String {
        switch kind {
        case "like": return Loc.notifLike()
        case "comment": return Loc.notifComment()
        case "comment_like": return Loc.notifCommentLike()
        case "comment_reply": return Loc.notifCommentReply()
        case "follow": return Loc.notifFollow()
        case "follow_request": return Loc.notifFollowRequest()
        case "mention": return Loc.notifMention()
        case "story_like": return Loc.notifStoryLike()
        case "post_tag": return Loc.notifPostTag()
        case "story_tag": return Loc.notifStoryTag()
        default: return body ?? Loc.notifDefault
        }
    }
}

/// NotificationsService — Sprint 20.7 (paridade notificationService web:
/// mesmos SOCIAL_BELL_NOTIFICATION_KINDS, mesma tabela).
public actor NotificationsService {
    private let client: SupabaseClient

    /// Espelho de SOCIAL_BELL_NOTIFICATION_KINDS (packages/core).
    public static let bellKinds = [
        "like", "comment", "comment_like", "comment_reply", "follow",
        "mention", "follow_request", "story_like", "post_tag", "story_tag",
    ]

    public init(client: SupabaseClient) {
        self.client = client
    }

    private struct NotificationRow: Decodable {
        let id: String
        let kind: String
        let actor_id: String?
        let post_id: String?
        let comment_id: String?
        let story_id: String?
        let body: String?
        let read_at: String?
        let created_at: String
    }

    private struct ActorRow: Decodable {
        let user_id: String
        let username: String
        let display_name: String?
        let avatar_url: String?
    }

    public func list(userId: String, limit: Int = 50) async throws -> [AppNotification] {
        let rows: [NotificationRow] = try await client
            .from("notifications")
            .select("id,kind,actor_id,post_id,comment_id,story_id,body,read_at,created_at")
            .eq("user_id", value: userId)
            .in("kind", values: Self.bellKinds)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
        guard !rows.isEmpty else { return [] }

        let actorIds = Array(Set(rows.compactMap(\.actor_id)))
        let actors: [ActorRow] = actorIds.isEmpty ? [] : (try? await client
            .from("profiles")
            .select("user_id,username,display_name,avatar_url")
            .in("user_id", values: actorIds)
            .execute()
            .value) ?? []
        let actorsById = Dictionary(uniqueKeysWithValues: actors.map { ($0.user_id, $0) })

        return rows.map { row in
            let actor = row.actor_id.flatMap { actorsById[$0] }
            return AppNotification(
                id: row.id,
                kind: row.kind,
                actorId: row.actor_id,
                postId: row.post_id,
                commentId: row.comment_id,
                storyId: row.story_id,
                body: row.body,
                readAt: row.read_at,
                createdAt: row.created_at,
                actorUsername: actor?.username ?? "alguém",
                actorDisplayName: actor?.display_name,
                actorAvatarURL: actor?.avatar_url
            )
        }
    }

    public func unreadCount(userId: String) async throws -> Int {
        let response = try await client
            .from("notifications")
            .select("id", head: true, count: .exact)
            .eq("user_id", value: userId)
            .in("kind", values: Self.bellKinds)
            .is("read_at", value: nil)
            .execute()
        return response.count ?? 0
    }

    public func markAllRead(userId: String) async throws {
        struct ReadPatch: Encodable { let read_at: String }
        try await client
            .from("notifications")
            .update(ReadPatch(read_at: ISO8601DateFormatter().string(from: .now)))
            .eq("user_id", value: userId)
            .in("kind", values: Self.bellKinds)
            .is("read_at", value: nil)
            .execute()
    }
}

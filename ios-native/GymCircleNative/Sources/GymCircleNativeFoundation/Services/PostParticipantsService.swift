import Foundation
import Supabase

/// PostParticipantsService — Sprint 20.3c/20.4b (paridade do
/// participants service web).
///
/// - listForPosts: hidrata os participantes (com profile) pro feed
/// - tag: marca seguidores no publish (status pending, upsert idempotente)
/// - respond: aceitar/recusar marcação própria
public actor PostParticipantsService {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    private struct ParticipantRow: Decodable {
        let post_id: String
        let tagged_user_id: String
        let status: String
    }

    private struct AuthorRow: Decodable {
        let user_id: String
        let username: String
        let display_name: String?
        let avatar_url: String?
    }

    private struct TagInsert: Encodable {
        let post_id: String
        let tagged_by_user_id: String
        let tagged_user_id: String
        let status: String
    }

    private struct StatusPatch: Encodable {
        let status: String
    }

    /// Participantes (qualquer status) dos posts dados, compostos com o
    /// profile. Dicionário post_id → participantes.
    public func listForPosts(postIds: [String]) async throws -> [String: [PostParticipant]] {
        guard !postIds.isEmpty else { return [:] }
        let rows: [ParticipantRow] = try await client
            .from("post_participants")
            .select("post_id,tagged_user_id,status")
            .in("post_id", values: postIds)
            .execute()
            .value
        guard !rows.isEmpty else { return [:] }

        let userIds = Array(Set(rows.map(\.tagged_user_id)))
        let authors: [AuthorRow] = (try? await client
            .from("profiles")
            .select("user_id,username,display_name,avatar_url")
            .in("user_id", values: userIds)
            .execute()
            .value) ?? []
        let authorsById = Dictionary(uniqueKeysWithValues: authors.map { ($0.user_id, $0) })

        let participants = rows.map { row in
            let author = authorsById[row.tagged_user_id]
            return PostParticipant(
                postId: row.post_id,
                taggedUserId: row.tagged_user_id,
                status: row.status,
                username: author?.username ?? "user",
                displayName: author?.display_name,
                avatarURL: author?.avatar_url
            )
        }
        return Dictionary(grouping: participants, by: \.postId)
    }

    /// Marca participantes no publish (paridade createPostTags web:
    /// upsert pending, ignora duplicata, autor nunca se marca).
    public func tag(postId: String, taggedByUserId: String, taggedUserIds: [String]) async throws {
        let unique = Array(Set(taggedUserIds)).filter { $0 != taggedByUserId }
        guard !unique.isEmpty else { return }
        let rows = unique.map {
            TagInsert(
                post_id: postId,
                tagged_by_user_id: taggedByUserId,
                tagged_user_id: $0,
                status: "pending"
            )
        }
        try await client
            .from("post_participants")
            .upsert(rows, onConflict: "post_id,tagged_user_id", ignoreDuplicates: true)
            .execute()
    }

    /// Sprint 20.4b — quem eu sigo (follows accepted + profile), pra
    /// seleção de participantes no composer.
    public func followingProfiles(userId: String) async throws -> [DiscoveredProfile] {
        struct FollowRow: Decodable { let following_id: String }
        let follows: [FollowRow] = try await client
            .from("follows")
            .select("following_id")
            .eq("follower_id", value: userId)
            .eq("status", value: "accepted")
            .execute()
            .value
        guard !follows.isEmpty else { return [] }
        let authors: [AuthorRow] = try await client
            .from("profiles")
            .select("user_id,username,display_name,avatar_url")
            .in("user_id", values: follows.map(\.following_id))
            .execute()
            .value
        return authors.map {
            DiscoveredProfile(
                userId: $0.user_id,
                username: $0.username,
                displayName: $0.display_name,
                avatarURL: $0.avatar_url,
                currentStreak: nil
            )
        }
    }

    /// Aceitar/recusar a própria marcação (respondToPostTag web).
    public func respond(postId: String, taggedUserId: String, accepted: Bool) async throws {
        try await client
            .from("post_participants")
            .update(StatusPatch(status: accepted ? "accepted" : "rejected"))
            .eq("post_id", value: postId)
            .eq("tagged_user_id", value: taggedUserId)
            .execute()
    }
}

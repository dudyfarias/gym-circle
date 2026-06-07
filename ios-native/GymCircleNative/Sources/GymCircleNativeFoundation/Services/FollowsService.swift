import Foundation
import Supabase

/// FollowsService — Sprint 9.5.4.
///
/// Maneja o follow graph entre users. Usado pelo `OtherProfileView`
/// pra renderizar Follow CTA com state correto + permitir toggle.
///
/// Schema `public.follows`:
///   - follower_id (UUID, FK auth.users)
///   - following_id (UUID, FK auth.users)
///   - created_at (timestamptz)
///   - PK (follower_id, following_id)
///
/// Modelo simples sem pending: row presente = following accepted.
/// (Web tem follow requests pra perfis privados via `follow_requests`
/// table — não modelada aqui ainda; OtherProfileView só usa
/// `none` / `accepted` por enquanto.)
public actor FollowsService {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    /// Retorna true se `follower` segue `following` (row existe).
    public func isFollowing(follower: String, following: String) async throws -> Bool {
        let rows: [FollowRow] = try await client
            .from("follows")
            .select("follower_id")
            .eq("follower_id", value: follower)
            .eq("following_id", value: following)
            .limit(1)
            .execute()
            .value
        return !rows.isEmpty
    }

    /// Insere row pra começar a seguir. No-op se já segue.
    public func follow(follower: String, following: String) async throws {
        struct Payload: Encodable {
            let followerId: String
            let followingId: String
            enum CodingKeys: String, CodingKey {
                case followerId = "follower_id"
                case followingId = "following_id"
            }
        }
        // Upsert pra ser idempotente (já segue → no-op)
        try await client
            .from("follows")
            .upsert(Payload(followerId: follower, followingId: following))
            .execute()
    }

    /// Remove row pra parar de seguir.
    public func unfollow(follower: String, following: String) async throws {
        try await client
            .from("follows")
            .delete()
            .eq("follower_id", value: follower)
            .eq("following_id", value: following)
            .execute()
    }

    /// Toggle conveniente: lê state atual e inverte.
    /// Retorna o novo state (true = agora segue, false = parou).
    public func toggle(follower: String, following: String) async throws -> Bool {
        let current = try await isFollowing(follower: follower, following: following)
        if current {
            try await unfollow(follower: follower, following: following)
            return false
        } else {
            try await follow(follower: follower, following: following)
            return true
        }
    }
}

private struct FollowRow: Codable, Sendable {
    let followerId: String

    enum CodingKeys: String, CodingKey {
        case followerId = "follower_id"
    }
}

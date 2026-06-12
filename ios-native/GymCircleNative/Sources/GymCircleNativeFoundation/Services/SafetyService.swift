import Foundation
import Supabase

/// SafetyService — Sprint 20.3c (paridade do menu de post web).
///
/// - reports: denúncia de post/user (mesma tabela do web safety.report)
/// - post_mutes: silenciar autor — esconde só os posts no feed; stories e
///   perfil continuam acessíveis (decisão da Sprint 11 web)
public actor SafetyService {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    private struct ReportInsert: Encodable {
        let reporter_id: String
        let reported_user_id: String?
        let post_id: String?
        let reason: String
        let details: String?
    }

    private struct MuteInsert: Encodable {
        let user_id: String
        let muted_user_id: String
    }

    private struct MuteRow: Decodable {
        let muted_user_id: String
    }

    public func reportPost(
        reporterId: String,
        postId: String,
        reportedUserId: String,
        reason: String = "other",
        details: String? = nil
    ) async throws {
        try await client
            .from("reports")
            .insert(ReportInsert(
                reporter_id: reporterId,
                reported_user_id: reportedUserId,
                post_id: postId,
                reason: reason,
                details: details
            ))
            .execute()
    }

    public func muteAuthor(userId: String, mutedUserId: String) async throws {
        try await client
            .from("post_mutes")
            .upsert(
                MuteInsert(user_id: userId, muted_user_id: mutedUserId),
                onConflict: "user_id,muted_user_id"
            )
            .execute()
    }

    /// IDs silenciados — o AppModel filtra o feed com isso a cada load.
    public func mutedUserIds(userId: String) async throws -> Set<String> {
        let rows: [MuteRow] = try await client
            .from("post_mutes")
            .select("muted_user_id")
            .eq("user_id", value: userId)
            .execute()
            .value
        return Set(rows.map(\.muted_user_id))
    }
}

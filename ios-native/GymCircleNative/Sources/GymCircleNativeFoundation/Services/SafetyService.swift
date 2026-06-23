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

    /// Denúncia de USER (sem post) — paridade web safety.report(userId,"other").
    public func reportUser(
        reporterId: String,
        reportedUserId: String,
        reason: String = "other",
        details: String? = nil
    ) async throws {
        try await client
            .from("reports")
            .insert(ReportInsert(
                reporter_id: reporterId,
                reported_user_id: reportedUserId,
                post_id: nil,
                reason: reason,
                details: details
            ))
            .execute()
    }

    /// Bloqueia um user (paridade web blockUser) — insere em user_blocks.
    public func blockUser(blockerId: String, blockedId: String, reason: String? = nil) async throws {
        struct BlockInsert: Encodable {
            let blocker_id: String
            let blocked_id: String
            let reason: String?
        }
        try await client
            .from("user_blocks")
            .upsert(
                BlockInsert(blocker_id: blockerId, blocked_id: blockedId, reason: reason),
                onConflict: "blocker_id,blocked_id"
            )
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

    // MARK: - Sprint 20.2 — conta (paridade safety.ts web)

    /// Suspende a própria conta (RPC suspend_own_account). O caller faz
    /// signOut na sequência; reativação via magic link é fluxo web.
    public func suspendOwnAccount() async throws {
        try await client.rpc("suspend_own_account").execute()
    }

    /// Marca a conta pra exclusão (RPC request_account_deletion).
    public func requestAccountDeletion(reason: String? = nil) async throws {
        struct Params: Encodable { let p_reason: String? }
        try await client
            .rpc("request_account_deletion", params: Params(p_reason: reason))
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

    /// Users que EU bloqueei (paridade web blockedUserIds) — pra filtrar o feed.
    public func blockedUserIds(userId: String) async throws -> Set<String> {
        struct BlockRow: Decodable { let blocked_id: String }
        let rows: [BlockRow] = try await client
            .from("user_blocks")
            .select("blocked_id")
            .eq("blocker_id", value: userId)
            .execute()
            .value
        return Set(rows.map(\.blocked_id))
    }
}

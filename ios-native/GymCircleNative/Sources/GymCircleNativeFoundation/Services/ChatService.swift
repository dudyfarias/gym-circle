import Foundation
import Supabase

/// ChatService — Sprint 20.6 (paridade messages service + RPCs web).
///
/// RPCs atômicas existentes (Sprint B web): get_conversation_summaries,
/// get_conversation_messages, send_direct_message, send_group_message,
/// mark_conversation_read, delete_conversation_for_me.
public actor ChatService {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    private struct PeerRow: Decodable {
        let user_id: String
        let username: String
        let display_name: String?
        let avatar_url: String?
    }

    /// Summaries compostos: grupo usa name/image do summary; direct
    /// resolve o peer (participante != eu) em profiles.
    public func threads(currentUserId: String) async throws -> [ChatThread] {
        let summaries: [ConversationSummary] = try await client
            .rpc("get_conversation_summaries")
            .execute()
            .value
        guard !summaries.isEmpty else { return [] }

        let peerIds = Array(Set(summaries.flatMap { summary in
            summary.participants.compactMap(\.userId).filter { $0 != currentUserId }
        }))
        let peers: [PeerRow] = peerIds.isEmpty ? [] : (try? await client
            .from("profiles")
            .select("user_id,username,display_name,avatar_url")
            .in("user_id", values: peerIds)
            .execute()
            .value) ?? []
        let peersById = Dictionary(uniqueKeysWithValues: peers.map { ($0.user_id, $0) })

        return summaries.map { summary in
            if summary.isGroup {
                return ChatThread(
                    summary: summary,
                    displayName: summary.name ?? "Grupo",
                    avatarURL: summary.imageURL,
                    peerUserId: nil
                )
            }
            let peerId = summary.participants.compactMap(\.userId).first { $0 != currentUserId }
            let peer = peerId.flatMap { peersById[$0] }
            let peerName = peer?.display_name?.isEmpty == false
                ? peer!.display_name!
                : (peer?.username ?? "Conversa")
            return ChatThread(
                summary: summary,
                displayName: peerName,
                avatarURL: peer?.avatar_url,
                peerUserId: peerId
            )
        }
        .sorted { ($0.summary.lastMessageAt ?? "") > ($1.summary.lastMessageAt ?? "") }
    }

    public func messages(
        conversationId: String,
        cursorCreatedAt: String? = nil,
        limit: Int = 30
    ) async throws -> [ChatMessage] {
        struct Params: Encodable {
            let p_conversation_id: String
            let p_cursor_created_at: String?
            let p_limit: Int
        }
        return try await client
            .rpc("get_conversation_messages", params: Params(
                p_conversation_id: conversationId,
                p_cursor_created_at: cursorCreatedAt,
                p_limit: limit
            ))
            .execute()
            .value
    }

    /// 1:1 — o RPC cria a conversa quando não existe e devolve a mensagem
    /// (com conversation_id). Também é o reply de story (20.5).
    @discardableResult
    public func sendDirect(
        receiverId: String,
        body: String?,
        storyId: String? = nil,
        replyToStory: Bool = false,
        storyPreviewURL: String? = nil
    ) async throws -> ChatMessage {
        struct Params: Encodable {
            let p_receiver_id: String
            let p_body: String?
            let p_media_url: String?
            let p_media_type: String?
            let p_story_id: String?
            let p_reply_to_story: Bool
            let p_story_preview_url: String?
        }
        return try await client
            .rpc("send_direct_message", params: Params(
                p_receiver_id: receiverId,
                p_body: body,
                p_media_url: nil,
                p_media_type: nil,
                p_story_id: storyId,
                p_reply_to_story: replyToStory,
                p_story_preview_url: storyPreviewURL
            ))
            .execute()
            .value
    }

    @discardableResult
    public func sendGroup(conversationId: String, body: String) async throws -> ChatMessage {
        struct Params: Encodable {
            let p_conversation_id: String
            let p_body: String?
            let p_media_url: String?
            let p_media_type: String?
        }
        return try await client
            .rpc("send_group_message", params: Params(
                p_conversation_id: conversationId,
                p_body: body,
                p_media_url: nil,
                p_media_type: nil
            ))
            .execute()
            .value
    }

    public func markRead(conversationId: String) async throws {
        struct Params: Encodable { let p_conversation_id: String }
        try await client
            .rpc("mark_conversation_read", params: Params(p_conversation_id: conversationId))
            .execute()
    }

    /// Delete-for-me: a conversa some só pra mim (paridade web).
    public func deleteForMe(conversationId: String) async throws {
        struct Params: Encodable { let p_conversation_id: String }
        try await client
            .rpc("delete_conversation_for_me", params: Params(p_conversation_id: conversationId))
            .execute()
    }
}

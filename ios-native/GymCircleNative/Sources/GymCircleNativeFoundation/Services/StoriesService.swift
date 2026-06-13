import Foundation
import Supabase

/// StoriesService — Sprint 10.1 (P0 #1 fechado).
///
/// Camada mínima pra responder "tem story ativo?" + "currentUser já viu?".
/// Stories full (criação, viewer, navigation cross-author) ficam pra
/// v1.1.2 quando Stories nativos forem implementados completos.
///
/// Schema relevante:
///   - stories(user_id, expires_at default now()+24h, ...)
///   - story_views(story_id, user_id, viewed_at) — Sprint 20260508152000
///
/// Actor isolation garante thread-safety pra cache futuro.
public actor StoriesService {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    /// Retorna true se o user tem PELO MENOS 1 story não-expirada.
    /// Usa head + count pra evitar trazer rows (response body vazio).
    /// Sprint 9.9.6 — withRetry: chamada em paralelo no loadMyCircle;
    /// falha graceful ainda retorna false (cai via try? do AppModel).
    public func hasActiveStory(userId: String) async throws -> Bool {
        try await withRetry {
            let nowISO = ISO8601DateFormatter().string(from: .now)
            let response = try await self.client
                .from("stories")
                .select("id", head: true, count: .exact)
                .eq("user_id", value: userId)
                .gt("expires_at", value: nowISO)
                .execute()
            return (response.count ?? 0) > 0
        }
    }

    // MARK: - Sprint 20.5 — viewer completo

    private struct StoryViewInsert: Encodable {
        let story_id: String
        let user_id: String
    }

    private struct StoryLikeInsert: Encodable {
        let story_id: String
        let user_id: String
    }

    private struct StoryMuteInsert: Encodable {
        let user_id: String
        let muted_user_id: String
    }

    private struct StoryInsert: Encodable {
        let user_id: String
        let media_url: String
        let media_type: String
        let thumbnail_url: String?
        let poster_url: String?
        let media_width: Int?
        let media_height: Int?
        let media_duration_seconds: Double?
        let gym_id: String?
        let workout_type: String?
    }

    /// Marca o story como visto (idempotente) — alimenta o ring da tray.
    public func markSeen(storyId: String, userId: String) async throws {
        try await client
            .from("story_views")
            .upsert(
                StoryViewInsert(story_id: storyId, user_id: userId),
                onConflict: "story_id,user_id"
            )
            .execute()
    }

    /// Like/unlike de story (mesmo padrão idempotente do feed).
    public func setLike(storyId: String, userId: String, liked: Bool) async throws {
        if liked {
            try await client
                .from("story_likes")
                .upsert(
                    StoryLikeInsert(story_id: storyId, user_id: userId),
                    onConflict: "story_id,user_id"
                )
                .execute()
        } else {
            try await client
                .from("story_likes")
                .delete()
                .eq("story_id", value: storyId)
                .eq("user_id", value: userId)
                .execute()
        }
    }

    /// Paridade Instagram: ring fica cinza assim que viewer abre QUALQUER
    /// story do target. Retorna true se existe pelo menos 1 view do viewer
    /// em qualquer story ativa do target.
    ///
    /// Implementação simplificada (sem JOIN em PostgREST):
    /// 1) lista IDs de stories ativas do target
    /// 2) checa se existe story_views(viewer_user_id, story_id IN ...) > 0
    public func hasViewedActiveStories(
        targetUserId: String,
        viewerUserId: String
    ) async throws -> Bool {
        let nowISO = ISO8601DateFormatter().string(from: .now)

        // 1) IDs das stories ativas do target
        let storyRows: [StoryIdRow] = try await client
            .from("stories")
            .select("id")
            .eq("user_id", value: targetUserId)
            .gt("expires_at", value: nowISO)
            .execute()
            .value
        let storyIds = storyRows.map(\.id)
        guard !storyIds.isEmpty else {
            // sem stories ativas → não tem o que "viewed" significar
            return false
        }

        // 2) Existe view do viewer em alguma delas?
        let viewsResponse = try await client
            .from("story_views")
            .select("story_id", head: true, count: .exact)
            .eq("user_id", value: viewerUserId)
            .in("story_id", values: storyIds)
            .execute()
        return (viewsResponse.count ?? 0) > 0
    }

    public func muteStories(userId: String, mutedUserId: String) async throws {
        try await client
            .from("story_mutes")
            .upsert(
                StoryMuteInsert(user_id: userId, muted_user_id: mutedUserId),
                onConflict: "user_id,muted_user_id"
            )
            .execute()
    }

    public func createStory(
        userId: String,
        media: PostComposerService.UploadedMedia,
        gymId: String?,
        workoutType: String?
    ) async throws {
        try await client
            .from("stories")
            .insert(StoryInsert(
                user_id: userId,
                media_url: media.imageURL,
                media_type: media.mediaType,
                thumbnail_url: media.thumbnailURL,
                poster_url: media.posterURL,
                media_width: media.width,
                media_height: media.height,
                media_duration_seconds: media.durationSeconds,
                gym_id: gymId,
                workout_type: workoutType
            ))
            .execute()
    }
}

// MARK: - Private DTOs

private struct StoryIdRow: Codable {
    let id: String
}

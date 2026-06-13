import Foundation
import Supabase

public actor GymCircleAPI {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    public func signIn(email: String, password: String) async throws {
        try await client.auth.signIn(email: email, password: password)
    }

    public func signOut() async throws {
        try await client.auth.signOut()
    }

    public func homeFeed(cursorCreatedAt: String? = nil, limit: Int = 30) async throws -> [FeedPost] {
        let params = HomeFeedParams(
            p_cursor_created_at: cursorCreatedAt,
            p_limit: limit
        )

        return try await client
            .rpc("get_home_feed", params: params)
            .execute()
            .value
    }

    public func storyTray(limit: Int = 40) async throws -> [StoryAuthorGroup] {
        let params = StoryTrayParams(p_limit: limit)

        return try await client
            .rpc("get_story_tray_lightweight", params: params)
            .execute()
            .value
    }

    public func storyViewerItems(authorId: String) async throws -> [StoryItem] {
        let params = StoryViewerParams(p_author_id: authorId)

        return try await client
            .rpc("get_story_viewer_items", params: params)
            .execute()
            .value
    }

    public func profilePosts(userId: String, cursorCreatedAt: String? = nil, limit: Int = 30) async throws -> [FeedPost] {
        let params = ProfilePostsParams(
            p_user_id: userId,
            p_cursor_created_at: cursorCreatedAt,
            p_limit: limit
        )

        return try await client
            .rpc("get_profile_posts", params: params)
            .execute()
            .value
    }

    /// Sprint 20.3a — mídias do carrossel pros posts dados (post_media
    /// ordenado por position). Retorna dicionário post_id → itens; posts
    /// sem entrada são mídia única.
    public func postMedia(postIds: [String]) async throws -> [String: [PostMediaItem]] {
        guard !postIds.isEmpty else { return [:] }
        let rows: [PostMediaItem] = try await client
            .from("post_media")
            .select("id,post_id,position,media_type,image_url,thumbnail_url,poster_url,media_width,media_height")
            .in("post_id", values: postIds)
            .order("position", ascending: true)
            .execute()
            .value
        return Dictionary(grouping: rows, by: \.postId)
    }

    /// Sprint 20.3c — apagar o próprio post (RLS garante; o eq de
    /// user_id é cinto de segurança).
    public func deletePost(postId: String, userId: String) async throws {
        try await client
            .from("posts")
            .delete()
            .eq("id", value: postId)
            .eq("user_id", value: userId)
            .execute()
    }

    /// Sprint 20.3c — quem curtiu o post (post_likes + profiles).
    public func postLikers(postId: String) async throws -> [PostParticipant] {
        struct LikeRow: Decodable { let user_id: String }
        struct AuthorRow: Decodable {
            let user_id: String
            let username: String
            let display_name: String?
            let avatar_url: String?
        }
        let likes: [LikeRow] = try await client
            .from("post_likes")
            .select("user_id")
            .eq("post_id", value: postId)
            .order("created_at", ascending: false)
            .execute()
            .value
        guard !likes.isEmpty else { return [] }
        let authors: [AuthorRow] = (try? await client
            .from("profiles")
            .select("user_id,username,display_name,avatar_url")
            .in("user_id", values: likes.map(\.user_id))
            .execute()
            .value) ?? []
        let byId = Dictionary(uniqueKeysWithValues: authors.map { ($0.user_id, $0) })
        return likes.map { like in
            let author = byId[like.user_id]
            return PostParticipant(
                postId: postId,
                taggedUserId: like.user_id,
                status: "like",
                username: author?.username ?? "user",
                displayName: author?.display_name,
                avatarURL: author?.avatar_url
            )
        }
    }

    /// Sugestões de pessoas (RPC get_user_suggestions da Sprint C web) —
    /// estado inicial da busca, antes do usuário digitar.
    public func userSuggestions(limit: Int = 12) async throws -> [DiscoveredProfile] {
        struct SuggestionParams: Encodable {
            let p_current_lat: Double?
            let p_current_lng: Double?
            let p_limit: Int
        }
        return try await client
            .rpc("get_user_suggestions", params: SuggestionParams(
                p_current_lat: nil,
                p_current_lng: nil,
                p_limit: limit
            ))
            .execute()
            .value
    }

    /// Sprint 20.3c — busca de pessoas (RPC search_profiles da Sprint C web).
    public func searchProfiles(query: String, limit: Int = 20) async throws -> [DiscoveredProfile] {
        struct SearchParams: Encodable {
            let p_query: String
            let p_limit: Int
        }
        return try await client
            .rpc("search_profiles", params: SearchParams(p_query: query, p_limit: limit))
            .execute()
            .value
    }

    /// Sprint 20.7 — post único composto (routing de notificação). O RPC
    /// do feed não serve pra post fora da janela, então compõe na mão:
    /// posts + profile do autor + counts/likedByMe.
    public func fetchPost(postId: String, viewerId: String) async throws -> FeedPost? {
        struct PostRow: Decodable {
            let id: String
            let user_id: String
            let image_url: String
            let thumbnail_url: String?
            let poster_url: String?
            let media_width: Int?
            let media_height: Int?
            let media_duration_seconds: Double?
            let blur_data_url: String?
            let media_type: String?
            let caption: String?
            let gym_id: String?
            let workout_type: String?
            let workout_date: String?
            let created_at: String
            let location_source: String?
            let location_name: String?
        }
        struct AuthorRow: Decodable {
            let username: String
            let display_name: String?
            let avatar_url: String?
        }
        struct LikeRow: Decodable { let user_id: String }

        let rows: [PostRow] = try await client
            .from("posts")
            .select(
                "id,user_id,image_url,thumbnail_url,poster_url,media_width,media_height," +
                    "media_duration_seconds,blur_data_url,media_type,caption,gym_id," +
                    "workout_type,workout_date,created_at,location_source,location_name"
            )
            .eq("id", value: postId)
            .limit(1)
            .execute()
            .value
        guard let row = rows.first else { return nil }

        let authors: [AuthorRow] = (try? await client
            .from("profiles")
            .select("username,display_name,avatar_url")
            .eq("user_id", value: row.user_id)
            .limit(1)
            .execute()
            .value) ?? []
        let author = authors.first
        let likes: [LikeRow] = (try? await client
            .from("post_likes")
            .select("user_id")
            .eq("post_id", value: postId)
            .execute()
            .value) ?? []
        let commentsResponse = try? await client
            .from("post_comments")
            .select("id", head: true, count: .exact)
            .eq("post_id", value: postId)
            .execute()

        return FeedPost(
            id: row.id,
            userId: row.user_id,
            imageURL: row.image_url,
            thumbnailURL: row.thumbnail_url,
            posterURL: row.poster_url,
            mediaWidth: row.media_width,
            mediaHeight: row.media_height,
            mediaDurationSeconds: row.media_duration_seconds,
            blurDataURL: row.blur_data_url,
            mediaType: row.media_type.flatMap(FeedMediaType.init(rawValue:)),
            caption: row.caption,
            gymId: row.gym_id,
            workoutType: row.workout_type,
            workoutDate: row.workout_date,
            createdAt: row.created_at,
            locationSource: row.location_source,
            locationName: row.location_name,
            likesCount: likes.count,
            commentsCount: commentsResponse?.count ?? 0,
            username: author?.username ?? "user",
            displayName: author?.display_name,
            avatarURL: author?.avatar_url,
            authorCurrentStreak: nil,
            authorBestStreak: nil,
            authorBadgeActive: nil,
            likedByMe: likes.contains { $0.user_id == viewerId },
            isFollowingAuthor: nil,
            visibility: nil
        )
    }

    /// Sprint 20.4b — busca de academias pro composer (gyms por nome).
    public func searchGyms(query: String, limit: Int = 15) async throws -> [GymOption] {
        try await client
            .from("gyms")
            .select("id,name,address,city,state,latitude,longitude")
            .ilike("name", pattern: "%\(query)%")
            .limit(limit)
            .execute()
            .value
    }

    /// Academias próximas a uma coordenada. Mantém o cálculo simples no
    /// cliente/Supabase sem PostGIS: bbox aproximado + ordenação local.
    public func nearbyGyms(
        latitude: Double,
        longitude: Double,
        radiusKm: Double = 5,
        limit: Int = 20
    ) async throws -> [GymOption] {
        let delta = max(radiusKm, 0.5) / 111.0
        let rows: [GymOption] = try await client
            .from("gyms")
            .select("id,name,address,city,state,latitude,longitude")
            .gte("latitude", value: latitude - delta)
            .lte("latitude", value: latitude + delta)
            .gte("longitude", value: longitude - delta)
            .lte("longitude", value: longitude + delta)
            .limit(limit)
            .execute()
            .value
        return rows.sorted {
            NativeLocationProvider.distanceKm(
                from: .init(latitude: latitude, longitude: longitude),
                to: .init(latitude: $0.latitude ?? latitude, longitude: $0.longitude ?? longitude)
            ) <
            NativeLocationProvider.distanceKm(
                from: .init(latitude: latitude, longitude: longitude),
                to: .init(latitude: $1.latitude ?? latitude, longitude: $1.longitude ?? longitude)
            )
        }
    }

    /// Cria ou reusa uma academia vinda do Apple Maps/MapKit. Espelha a regra
    /// web: localização é obrigatória e dedup prioriza nome + coordenadas.
    public func findOrCreateGym(from place: NativePlaceCandidate) async throws -> GymOption {
        let tolerance = 0.0009 // ~100m
        let nearby: [GymOption] = (try? await client
            .from("gyms")
            .select("id,name,address,city,state,latitude,longitude")
            .gte("latitude", value: place.coordinate.latitude - tolerance)
            .lte("latitude", value: place.coordinate.latitude + tolerance)
            .gte("longitude", value: place.coordinate.longitude - tolerance)
            .lte("longitude", value: place.coordinate.longitude + tolerance)
            .limit(8)
            .execute()
            .value) ?? []

        let target = Self.normalizedPlaceName(place.name)
        if let match = nearby.first(where: { Self.normalizedPlaceName($0.name) == target }) {
            return match
        }

        struct GymInsert: Encodable {
            let name: String
            let address: String?
            let city: String
            let state: String?
            let latitude: Double
            let longitude: Double
        }

        let payload = GymInsert(
            name: place.name.trimmingCharacters(in: .whitespacesAndNewlines),
            address: place.address?.trimmingCharacters(in: .whitespacesAndNewlines),
            city: place.city?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
                ?? place.neighborhood?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
                ?? "Brasil",
            state: place.state?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            latitude: place.coordinate.latitude,
            longitude: place.coordinate.longitude
        )

        do {
            return try await client
                .from("gyms")
                .insert(payload)
                .select("id,name,address,city,state,latitude,longitude")
                .single()
                .execute()
                .value
        } catch {
            let fallback: [GymOption] = (try? await client
                .from("gyms")
                .select("id,name,address,city,state,latitude,longitude")
                .ilike("name", pattern: payload.name)
                .ilike("city", pattern: payload.city)
                .limit(1)
                .execute()
                .value) ?? []
            if let existing = fallback.first { return existing }
            throw error
        }
    }

    public func checkIn(userId: String, gymId: String) async throws {
        struct CheckInInsert: Encodable {
            let user_id: String
            let gym_id: String
            let checkin_date: String
        }
        try await client
            .from("checkins")
            .insert(CheckInInsert(
                user_id: userId,
                gym_id: gymId,
                checkin_date: Self.todayKey()
            ))
            .execute()
    }

    /// Sprint 20.3a — curtir/descurtir. Idempotente: upsert no like
    /// (re-curtir não duplica), delete escopado no unlike.
    public func setLike(postId: String, userId: String, liked: Bool) async throws {
        if liked {
            try await client
                .from("post_likes")
                .upsert(
                    PostLikeInsert(post_id: postId, user_id: userId),
                    onConflict: "post_id,user_id"
                )
                .execute()
        } else {
            try await client
                .from("post_likes")
                .delete()
                .eq("post_id", value: postId)
                .eq("user_id", value: userId)
                .execute()
        }
    }
}

private struct PostLikeInsert: Encodable {
    let post_id: String
    let user_id: String
}

private struct HomeFeedParams: Encodable {
    let p_cursor_created_at: String?
    let p_limit: Int
}

private struct StoryTrayParams: Encodable {
    let p_limit: Int
}

private struct StoryViewerParams: Encodable {
    let p_author_id: String
}

private struct ProfilePostsParams: Encodable {
    let p_user_id: String
    let p_cursor_created_at: String?
    let p_limit: Int
}

private extension GymCircleAPI {
    static func todayKey() -> String {
        var calendar = Calendar(identifier: .gregorian)
        if let tz = TimeZone(identifier: "America/Sao_Paulo") {
            calendar.timeZone = tz
        }
        let components = calendar.dateComponents([.year, .month, .day], from: .now)
        return String(
            format: "%04d-%02d-%02d",
            components.year ?? 1970,
            components.month ?? 1,
            components.day ?? 1
        )
    }

    static func normalizedPlaceName(_ value: String) -> String {
        value
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}

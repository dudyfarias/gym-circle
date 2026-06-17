import Foundation
import Supabase

/// ProfilesService — Sprint 8.11.1.
///
/// Lookup do perfil real do user autenticado. Mapeia `profiles` table
/// pra `UserProfile`. Separado do MyCircleService pra ter responsabilidade
/// clara (Single Responsibility) — MyCircleService cuida só de stats
/// agregados/contagens, ProfilesService cuida do row de identidade.
///
/// Quando o backend evoluir com RPC consolidado (`get_user_full_snapshot`),
/// esse service vira um wrapper desse RPC.
public actor ProfilesService {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    // MARK: - Sprint 11.1 — Other profile summary (bug fix bio + counts)

    /// Agrega profile + stats + posts + counts pro OtherProfileView.
    /// Faz 6 queries em paralelo via async let — latência total ≈ max(q),
    /// não soma. Bio e contadores vinham faltando porque getProfile() só
    /// trazia `profiles` row; streak/best vem de `user_stats` e
    /// followers/following/posts são counts agregados.
    public func getOtherProfileSummary(
        userId: String,
        currentUserId: String,
        postsLimit: Int = 12
    ) async throws -> OtherProfileSummary? {
        async let profileTask: UserProfile? = self.getProfile(userId: userId)
        async let statsTask: ProfileStatsRow? = self.fetchProfileStats(userId: userId)
        async let postsTask: [ProfilePostLite] = self.fetchProfilePosts(userId: userId, limit: postsLimit)
        async let postsCountTask: Int = self.countPosts(userId: userId)
        async let followersTask: Int = self.countFollowers(userId: userId)
        async let followingTask: Int = self.countFollowing(userId: userId)
        async let isFollowingTask: Bool = self.isFollowing(targetUserId: userId, followerId: currentUserId)

        guard let profile = try await profileTask else { return nil }
        let stats = (try? await statsTask)
        let liteRows = (try? await postsTask) ?? []
        let postsCount = (try? await postsCountTask) ?? 0
        let followersCount = (try? await followersTask) ?? 0
        let followingCount = (try? await followingTask) ?? 0
        let isFollowingAuthor = (try? await isFollowingTask) ?? false

        // Hidrata cada ProfilePostLite num FeedPost com author info do profile
        let posts: [ProfilePost] = liteRows.map { row in
            FeedPost(
                id: row.id,
                userId: profile.userId,
                imageURL: row.imageURL,
                thumbnailURL: row.thumbnailURL,
                posterURL: row.posterURL,
                mediaWidth: nil,
                mediaHeight: nil,
                mediaDurationSeconds: nil,
                blurDataURL: nil,
                mediaType: row.mediaType.flatMap(FeedMediaType.init(rawValue:)),
                caption: row.caption,
                gymId: nil,
                workoutType: row.workoutType,
                workoutDate: row.workoutDate,
                createdAt: row.createdAt,
                locationSource: nil,
                locationName: nil,
                likesCount: row.likesCount ?? 0,
                commentsCount: row.commentsCount ?? 0,
                username: profile.username,
                displayName: profile.displayName,
                avatarURL: profile.avatarURL,
                authorCurrentStreak: stats?.currentStreak ?? 0,
                authorBestStreak: stats?.bestStreak ?? 0,
                authorBadgeActive: stats?.badgeIsActiveToday ?? false,
                likedByMe: false,
                isFollowingAuthor: isFollowingAuthor,
                visibility: nil
            )
        }

        return OtherProfileSummary(
            profile: profile,
            posts: posts,
            postsCount: postsCount,
            followersCount: followersCount,
            followingCount: followingCount,
            currentStreak: stats?.currentStreak ?? 0,
            bestStreak: stats?.bestStreak ?? 0,
            workoutsThisMonth: stats?.workoutsThisMonth ?? 0,
            isFollowingAuthor: isFollowingAuthor
        )
    }

    // MARK: - Sprint 11.1 helpers (private)

    private struct ProfileStatsRow: Decodable {
        let currentStreak: Int
        let bestStreak: Int
        let workoutsThisMonth: Int
        let badgeIsActiveToday: Bool
        enum CodingKeys: String, CodingKey {
            case currentStreak = "current_streak"
            case bestStreak = "best_streak"
            case workoutsThisMonth = "workouts_this_month"
            case badgeIsActiveToday = "badge_is_active_today"
        }
    }

    private struct ProfilePostLite: Decodable {
        let id: String
        let imageURL: String
        let thumbnailURL: String?
        let posterURL: String?
        let mediaType: String?
        let caption: String?
        let workoutType: String?
        let workoutDate: String?
        let createdAt: String
        let likesCount: Int?
        let commentsCount: Int?
        enum CodingKeys: String, CodingKey {
            case id
            case imageURL = "image_url"
            case thumbnailURL = "thumbnail_url"
            case posterURL = "poster_url"
            case mediaType = "media_type"
            case caption
            case workoutType = "workout_type"
            case workoutDate = "workout_date"
            case createdAt = "created_at"
            case likesCount = "likes_count"
            case commentsCount = "comments_count"
        }
    }

    private func fetchProfileStats(userId: String) async throws -> ProfileStatsRow? {
        let rows: [ProfileStatsRow] = try await withRetry {
            try await self.client
                .from("user_stats")
                .select("current_streak,best_streak,workouts_this_month,badge_is_active_today")
                .eq("user_id", value: userId)
                .limit(1)
                .execute()
                .value
        }
        return rows.first
    }

    private func fetchProfilePosts(userId: String, limit: Int) async throws -> [ProfilePostLite] {
        try await withRetry {
            try await self.client
                .from("posts")
                .select("id,image_url,thumbnail_url,poster_url,media_type,caption,workout_type,workout_date,created_at,likes_count,comments_count")
                .eq("user_id", value: userId)
                .order("created_at", ascending: false)
                .limit(limit)
                .execute()
                .value
        }
    }

    private func countPosts(userId: String) async throws -> Int {
        let response = try await withRetry {
            try await self.client
                .from("posts")
                .select("id", head: true, count: .exact)
                .eq("user_id", value: userId)
                .execute()
        }
        return response.count ?? 0
    }

    /// Sprint 22.x — counts leves (followers + following) pro header do
    /// próprio perfil. 2 queries HEAD em paralelo — bem mais barato que o
    /// getOtherProfileSummary (6 queries).
    public func followCounts(userId: String) async throws -> (followers: Int, following: Int) {
        async let followers = countFollowers(userId: userId)
        async let following = countFollowing(userId: userId)
        return (try await followers, try await following)
    }

    private func countFollowers(userId: String) async throws -> Int {
        let response = try await withRetry {
            try await self.client
                .from("follows")
                .select("follower_id", head: true, count: .exact)
                .eq("following_id", value: userId)
                .eq("status", value: "accepted")
                .execute()
        }
        return response.count ?? 0
    }

    private func countFollowing(userId: String) async throws -> Int {
        let response = try await withRetry {
            try await self.client
                .from("follows")
                .select("following_id", head: true, count: .exact)
                .eq("follower_id", value: userId)
                .eq("status", value: "accepted")
                .execute()
        }
        return response.count ?? 0
    }

    private func isFollowing(targetUserId: String, followerId: String) async throws -> Bool {
        let response = try await withRetry {
            try await self.client
                .from("follows")
                .select("follower_id", head: true, count: .exact)
                .eq("follower_id", value: followerId)
                .eq("following_id", value: targetUserId)
                .eq("status", value: "accepted")
                .execute()
        }
        return (response.count ?? 0) > 0
    }

    /// Busca o profile row do user autenticado. Retorna nil quando linha
    /// não encontrada (usuário recém-criado ou sem trigger ainda).
    /// Sprint 9.9.6 — withRetry: profile é boot-critical, blip de rede
    /// não pode quebrar o login flow.
    public func getProfile(userId: String) async throws -> UserProfile? {
        try await withRetry {
            let rows: [UserProfile] = try await self.client
                .from("profiles")
                .select("id,user_id,username,display_name,avatar_url,bio,fitness_goal,is_private,featured_achievements,created_at,instagram_username,birth_date,sports,preferred_training_times,main_gym_id")
                .eq("user_id", value: userId)
                .limit(1)
                .execute()
                .value
            return rows.first
        }
    }

    /// Sprint 8.13.5 — busca foto de capa que o user escolheu pro Monthly Recap
    /// de um mês específico. Retorna postId ou nil (auto-pick fallback).
    /// JSONB shape: `{ "2026-05": "post_uuid", "2026-04": "post_uuid" }`.
    public func getMonthlyRecapCover(userId: String, monthKey: String) async throws -> String? {
        let rows: [MonthlyRecapCoversRow] = try await client
            .from("profiles")
            .select("monthly_recap_covers")
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value
        return rows.first?.covers?[monthKey]
    }

    /// Sprint 8.13.5 — persiste escolha de capa pro mês. Passa nil pra
    /// remover override (volta pro auto-pick).
    public func setMonthlyRecapCover(userId: String, monthKey: String, postId: String?) async throws {
        // Lê mapa atual, muta, escreve. Sem RPC ainda — direct table update
        // com merge JSONB no client. Para concurrent writes, RPC seria
        // mais robusto (Sprint 9+ migration possível).
        let current = try await fetchCoversMap(userId: userId)
        var next = current
        if let postId {
            next[monthKey] = postId
        } else {
            next.removeValue(forKey: monthKey)
        }

        struct UpdatePayload: Encodable {
            let monthlyRecapCovers: [String: String]
            enum CodingKeys: String, CodingKey {
                case monthlyRecapCovers = "monthly_recap_covers"
            }
        }
        let payload = UpdatePayload(monthlyRecapCovers: next)
        try await client
            .from("profiles")
            .update(payload)
            .eq("user_id", value: userId)
            .execute()
    }

    /// Sprint 9.2 — upload de avatar pro bucket `avatars`. RLS exige
    /// path `{user_id}/{filename}`. Após upload retorna public URL e
    /// atualiza `profiles.avatar_url`.
    ///
    /// Usa upsert pra sobrescrever quando user troca de foto (mantém
    /// 1 path estável por user — evita acumular orphans).
    public func uploadAvatar(
        userId: String,
        imageData: Data,
        contentType: String = "image/jpeg"
    ) async throws -> String {
        let filename = "avatar.jpg" // path estável; upsert sobrescreve
        let storagePath = "\(userId)/\(filename)"

        // Upsert pro bucket avatars
        _ = try await client.storage
            .from("avatars")
            .upload(
                storagePath,
                data: imageData,
                options: FileOptions(
                    cacheControl: "3600",
                    contentType: contentType,
                    upsert: true
                )
            )

        // Public URL (avatars bucket é público pra read)
        let publicURL = try client.storage
            .from("avatars")
            .getPublicURL(path: storagePath)

        // Atualiza profiles.avatar_url com cache buster (timestamp param)
        // pra forçar reload no client após upload.
        let urlWithBuster = "\(publicURL.absoluteString)?t=\(Int(Date().timeIntervalSince1970))"
        struct AvatarPatch: Encodable {
            let avatarURL: String
            enum CodingKeys: String, CodingKey { case avatarURL = "avatar_url" }
        }
        try await client
            .from("profiles")
            .update(AvatarPatch(avatarURL: urlWithBuster))
            .eq("user_id", value: userId)
            .execute()

        return urlWithBuster
    }

    /// Sprint 8.13.7 + 9.7.1 — atualiza campos editáveis do profile.
    /// Apenas campos não-nil são enviados (PATCH-like). Para arrays
    /// (sports, preferredTrainingTimes) caller passa nil pra não alterar.
    public func updateProfile(
        userId: String,
        displayName: String? = nil,
        bio: String? = nil,
        fitnessGoal: String? = nil,
        isPrivate: Bool? = nil,
        instagramUsername: String? = nil,
        birthDate: Date? = nil,
        sports: [String]? = nil,
        preferredTrainingTimes: [String]? = nil
    ) async throws {
        struct UpdatePayload: Encodable {
            var displayName: String?
            var bio: String?
            var fitnessGoal: String?
            var isPrivate: Bool?
            var instagramUsername: String?
            var birthDate: String?
            var sports: [String]?
            var preferredTrainingTimes: [String]?

            enum CodingKeys: String, CodingKey {
                case displayName = "display_name"
                case bio
                case fitnessGoal = "fitness_goal"
                case isPrivate = "is_private"
                case instagramUsername = "instagram_username"
                case birthDate = "birth_date"
                case sports
                case preferredTrainingTimes = "preferred_training_times"
            }
        }
        let dateFormatter = DateFormatter()
        dateFormatter.calendar = Calendar(identifier: .gregorian)
        dateFormatter.locale = Locale(identifier: "en_US_POSIX")
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let payload = UpdatePayload(
            displayName: displayName,
            bio: bio,
            fitnessGoal: fitnessGoal,
            isPrivate: isPrivate,
            instagramUsername: instagramUsername,
            birthDate: birthDate.map(dateFormatter.string(from:)),
            sports: sports,
            preferredTrainingTimes: preferredTrainingTimes
        )
        try await client
            .from("profiles")
            .update(payload)
            .eq("user_id", value: userId)
            .execute()
    }

    /// Sprint 22.x — academia principal. Sempre envia main_gym_id (valor OU
    /// null) — espelha o web (`mainGymId: mainGymId || null`). O encode usa
    /// `encode` (não `encodeIfPresent`) pra null explícito ao limpar.
    public func setMainGym(userId: String, gymId: String?) async throws {
        struct GymPayload: Encodable {
            let gymId: String?
            enum CodingKeys: String, CodingKey { case gymId = "main_gym_id" }
            func encode(to encoder: Encoder) throws {
                var c = encoder.container(keyedBy: CodingKeys.self)
                try c.encode(gymId, forKey: .gymId)
            }
        }
        try await client
            .from("profiles")
            .update(GymPayload(gymId: gymId))
            .eq("user_id", value: userId)
            .execute()
    }

    /// Sprint 22.x — busca 1 academia por id (pra exibir o nome atual no
    /// editor). Fail-soft nil.
    public func gym(id: String) async throws -> GymOption? {
        let rows: [GymOption] = try await client
            .from("gyms")
            .select("id,name,address,city,state,latitude,longitude")
            .eq("id", value: id)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    private func fetchCoversMap(userId: String) async throws -> [String: String] {
        let rows: [MonthlyRecapCoversRow] = try await client
            .from("profiles")
            .select("monthly_recap_covers")
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value
        return rows.first?.covers ?? [:]
    }
}

/// Sprint 8.13.5 — shape mínimo só do JSONB de capas.
private struct MonthlyRecapCoversRow: Codable, Sendable {
    let covers: [String: String]?

    enum CodingKeys: String, CodingKey {
        case covers = "monthly_recap_covers"
    }
}

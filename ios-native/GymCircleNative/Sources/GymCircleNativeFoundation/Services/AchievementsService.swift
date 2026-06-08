import Foundation
import Supabase

/// AchievementsService — Sprint 8.4 (paridade Sprint 7.5 web).
///
/// Actor que consulta:
///   - user_achievements: histórico (Sprint 7.5.1)
///   - get_achievement_global_stats RPC: raridade global (Sprint 7.5.8)
///   - profiles.featured_achievements JSONB (Sprint 7.5.5)
///   - markAchievementCelebrated (Sprint 7.5.11)
///
/// Builders client-side (`getAllAchievements`, equivalente TS) ficam pra
/// caller compor — service só faz queries + writes. Service NÃO computa
/// achievements derived: a logic vive no GymCircleAppModel + ChallengesService.
public actor AchievementsService {
    private let client: SupabaseClient

    // Sprint 9.9.5 — TTL cache pra getGlobalStats. Stats globais variam
    // pouco numa sessão (mudam só quando outros users desbloqueiam).
    // 5min TTL evita refetch em cada open do AchievementDetailView sem
    // ficar stale demais. Actor isolation = thread-safe sem lock manual.
    private struct CachedStats {
        let stats: AchievementGlobalStats
        let expiresAt: Date
    }
    private var globalStatsCache: [String: CachedStats] = [:]
    private let globalStatsCacheTTL: TimeInterval = 5 * 60

    public init(client: SupabaseClient) {
        self.client = client
    }

    // MARK: - Reads

    /// Retorna histórico de achievements ganhos pelo user.
    public func getUserAchievements(userId: String) async throws -> [UserAchievementRecord] {
        try await client
            .from("user_achievements")
            .select("user_id,achievement_id,earned_at,last_earned_at,count,celebrated_at")
            .eq("user_id", value: userId)
            .order("last_earned_at", ascending: false)
            .execute()
            .value
    }

    /// Composite IDs de achievements ainda NÃO celebrados (Sprint 7.5.11).
    /// Caller cross-ref com `getAllAchievements()` pra montar queue de
    /// celebrations. Ordem por earned_at ASC pra mostrar o mais antigo primeiro.
    public func getUncelebratedAchievementIds(userId: String) async throws -> [String] {
        let rows: [UncelebratedRow] = try await client
            .from("user_achievements")
            .select("achievement_id")
            .eq("user_id", value: userId)
            .is("celebrated_at", value: nil)
            .order("earned_at", ascending: true)
            .execute()
            .value
        return rows.map(\.achievementId)
    }

    /// Stats globais (% de users que têm) — Sprint 7.5.8 RPC.
    /// Sprint 9.9.5 — cache TTL 5min evita refetch redundante por open
    /// do AchievementDetailView. Caller invalida via `invalidateGlobalStatsCache()`
    /// quando user desbloqueia algo (raridade própria do achievement muda).
    public func getGlobalStats(achievementId: String) async throws -> AchievementGlobalStats {
        if let cached = globalStatsCache[achievementId], cached.expiresAt > .now {
            return cached.stats
        }
        let params = GlobalStatsParams(p_achievement_id: achievementId)
        let rows: [AchievementGlobalStats] = try await client
            .rpc("get_achievement_global_stats", params: params)
            .execute()
            .value
        let stats = rows.first ?? AchievementGlobalStats(earnedCount: 0, totalUsers: 0)
        globalStatsCache[achievementId] = CachedStats(
            stats: stats,
            expiresAt: .now.addingTimeInterval(globalStatsCacheTTL)
        )
        return stats
    }

    /// Sprint 9.9.5 — drop do cache. Chamado quando o user desbloqueia
    /// achievement novo (seu próprio earnedCount muda → raridade mexe).
    /// Também pode ser usado pra force-refresh manual.
    public func invalidateGlobalStatsCache() {
        globalStatsCache.removeAll()
    }

    /// Featured achievements equipados (composite IDs) no profile do user.
    /// Quando vazio, caller cai pro fallback de suggestFeaturedAchievements.
    public func getFeaturedAchievements(userId: String) async throws -> [String] {
        let rows: [FeaturedRow] = try await client
            .from("profiles")
            .select("featured_achievements")
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value
        return rows.first?.featuredAchievements ?? []
    }

    // MARK: - Writes

    /// Marca achievement como celebrado (user dispensou overlay).
    /// Best-effort: erro só loga, próximo boot recoloca na queue.
    public func markCelebrated(userId: String, compositeId: String) async throws {
        let payload = MarkCelebratedPayload(celebrated_at: ISO8601DateFormatter().string(from: .now))
        try await client
            .from("user_achievements")
            .update(payload)
            .eq("user_id", value: userId)
            .eq("achievement_id", value: compositeId)
            .execute()
    }

    /// Marca TODOS uncelebrated do user. Usado quando user "Pular tudo".
    public func markAllCelebrated(userId: String) async throws {
        let payload = MarkCelebratedPayload(celebrated_at: ISO8601DateFormatter().string(from: .now))
        try await client
            .from("user_achievements")
            .update(payload)
            .eq("user_id", value: userId)
            .is("celebrated_at", value: nil)
            .execute()
    }

    /// Persiste featured achievements equipados (max 3 IDs).
    public func setFeaturedAchievements(userId: String, achievementIds: [String]) async throws {
        let payload = FeaturedPayload(featured_achievements: achievementIds)
        try await client
            .from("profiles")
            .update(payload)
            .eq("user_id", value: userId)
            .execute()
    }
}

// MARK: - Private DTOs

private struct UncelebratedRow: Codable {
    let achievementId: String

    enum CodingKeys: String, CodingKey {
        case achievementId = "achievement_id"
    }
}

private struct FeaturedRow: Codable {
    let featuredAchievements: [String]?

    enum CodingKeys: String, CodingKey {
        case featuredAchievements = "featured_achievements"
    }
}

private struct GlobalStatsParams: Encodable {
    let p_achievement_id: String
}

private struct MarkCelebratedPayload: Encodable {
    let celebrated_at: String
}

private struct FeaturedPayload: Encodable {
    let featured_achievements: [String]
}

import Foundation

// MARK: - Competição / Ranking (Sprint 19 — paridade web rankingPoints + RPC)

/// Escopo do ranking: amigos (você + follows aceitos) ou geral (todos ativos).
public enum RankingScope: String, CaseIterable, Sendable, Hashable {
    case circle
    case global
}

/// Recorte temporal (semana/mês/ano corrente, fuso SP — resolvido no RPC).
public enum RankingPeriod: String, CaseIterable, Sendable, Hashable {
    case week
    case month
    case year
}

/// Linha do ranking — paridade `CircleRankingRow` TS. Vem agregada do RPC
/// `get_circle_ranking` (só totais, nunca linhas cruas).
public struct CircleRankingRow: Codable, Identifiable, Hashable, Sendable {
    public let userId: String
    public let username: String?
    public let displayName: String?
    public let avatarUrl: String?
    public let currentStreak: Int
    public let badgeIsActiveToday: Bool
    public let workoutDays: Int
    public let achievementPoints: Int
    public let totalPoints: Int
    public let rank: Int

    public var id: String { userId }

    /// Nome de exibição com fallback (display_name → username → "—").
    public var name: String { displayName ?? username ?? "—" }

    /// Pontos de treino (10/dia) — paridade breakdown web.
    public var workoutPoints: Int { workoutDays * 10 }

    /// Bônus (semana/mês completos) = total − treino − conquistas.
    public var bonusPoints: Int { max(0, totalPoints - workoutPoints - achievementPoints) }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case username
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case currentStreak = "current_streak"
        case badgeIsActiveToday = "badge_is_active_today"
        case workoutDays = "workout_days"
        case achievementPoints = "achievement_points"
        case totalPoints = "total_points"
        case rank
    }
}

/// Params do RPC `get_circle_ranking(p_scope, p_period, p_limit)`.
struct CircleRankingParams: Encodable, Sendable {
    let p_scope: String
    let p_period: String
    let p_limit: Int
}

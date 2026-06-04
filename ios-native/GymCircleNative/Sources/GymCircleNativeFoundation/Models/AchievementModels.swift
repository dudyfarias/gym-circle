import Foundation

// MARK: - Achievement system (Sprint 8.0 — paridade Sprint 7.5 web)

/// Categoria do achievement (discriminante). Mapeia 1:1 com `AchievementKind`
/// TypeScript em `apps/web/src/components/gym-circle/social/achievements.ts`.
public enum AchievementKind: String, Codable, Sendable, CaseIterable, Hashable {
    case badge
    case medal
    case trophy
    case relic
    case challenge
}

/// Raridade estimada. Pra achievements computados client-side é nominal
/// (definido no builder). Pra `globalEarnedPercent`, calcula via RPC
/// `get_achievement_global_stats`.
public enum AchievementRarity: String, Codable, Sendable, CaseIterable, Hashable {
    case common
    case uncommon
    case rare
    case epic
    case legendary
}

/// Tier visual das medalhas (analogia olímpica). Trophies e Relics não têm tier.
public enum MedalTier: String, Codable, Sendable, CaseIterable, Hashable {
    case bronze
    case silver
    case gold
}

/// Icon keys que mapeiam SF Symbols nativos. Reutiliza nomenclatura web
/// (Lucide), mas resolve em SF Symbols no `BadgeIconNativeView`.
public enum BadgeIconKey: String, Codable, Sendable, CaseIterable, Hashable {
    case trophy
    case flame
    case calendar
    case users
    case share
    case shield
    case sunrise
    case moon
    case shuffle
    case compass
}

public enum ChallengeDifficulty: String, Codable, Sendable, CaseIterable, Hashable {
    case easy
    case medium
    case hard
    case legendary
}

public struct AchievementProgress: Codable, Hashable, Sendable {
    public let current: Int
    public let target: Int

    public init(current: Int, target: Int) {
        self.current = current
        self.target = target
    }

    public var percent: Double {
        guard target > 0 else { return 0 }
        return min(max(Double(current) / Double(target), 0), 1)
    }
}

/// Achievement unified — paridade `Achievement` discriminated union em TS.
/// Campos opcionais por categoria (tier só pra medal, periodKey só pra
/// challenge, etc.). Validação client-side já que Swift não tem
/// discriminated unions nativos.
public struct Achievement: Identifiable, Codable, Hashable, Sendable {
    public let kind: AchievementKind
    public let achievementId: String
    public let label: String
    public let description: String
    public let earned: Bool
    public let iconKey: BadgeIconKey
    public let rarity: AchievementRarity?
    public let progress: AchievementProgress?
    public let secret: Bool

    // Específicos por kind (nil quando não aplicável)
    public let tier: MedalTier?           // medal
    public let repeatable: Bool?          // trophy
    public let periodKey: String?          // challenge
    public let difficulty: ChallengeDifficulty?  // challenge
    public let trophyId: String?           // challenge

    public init(
        kind: AchievementKind,
        achievementId: String,
        label: String,
        description: String,
        earned: Bool,
        iconKey: BadgeIconKey,
        rarity: AchievementRarity? = nil,
        progress: AchievementProgress? = nil,
        secret: Bool = false,
        tier: MedalTier? = nil,
        repeatable: Bool? = nil,
        periodKey: String? = nil,
        difficulty: ChallengeDifficulty? = nil,
        trophyId: String? = nil
    ) {
        self.kind = kind
        self.achievementId = achievementId
        self.label = label
        self.description = description
        self.earned = earned
        self.iconKey = iconKey
        self.rarity = rarity
        self.progress = progress
        self.secret = secret
        self.tier = tier
        self.repeatable = repeatable
        self.periodKey = periodKey
        self.difficulty = difficulty
        self.trophyId = trophyId
    }

    /// Identifiable pra ForEach. Combina kind + id (ou kind:periodKey:id pra
    /// challenges) pra evitar collision entre categorias com mesmo id.
    public var id: String { compositeId }

    /// Composite ID usado em `user_achievements.achievement_id` no DB.
    /// Formato:
    ///   - default: "kind:id" (ex: "badge:first-workout")
    ///   - challenge: "challenge:periodKey:id" (ex: "challenge:2026-06:saque-brasileiro")
    public var compositeId: String {
        if kind == .challenge, let periodKey {
            return "\(kind.rawValue):\(periodKey):\(achievementId)"
        }
        return "\(kind.rawValue):\(achievementId)"
    }

    /// Quando true, UI mostra "???" + ícone misterioso até user ganhar.
    /// Útil em UI: `if achievement.isMysterySecret { showQuestionMark() }`.
    public var isMysterySecret: Bool {
        secret && !earned
    }
}

// MARK: - Composite ID helpers

public enum AchievementCompositeId {
    /// Decoda composite ID em (kind, id, periodKey?). Retorna nil pra
    /// strings malformadas (caller ignora silenciosamente).
    public static func parse(_ compositeId: String) -> (kind: AchievementKind, id: String, periodKey: String?)? {
        let parts = compositeId.split(separator: ":").map(String.init)
        guard parts.count >= 2,
              let kind = AchievementKind(rawValue: parts[0]) else { return nil }

        if kind == .challenge && parts.count == 3 {
            return (kind, parts[2], parts[1])
        }
        // Junta resto pra suportar IDs com ":" (raro mas defensive)
        let id = parts.dropFirst().joined(separator: ":")
        return (kind, id, nil)
    }
}

// MARK: - User Achievement Record (vem de user_achievements DB)

/// Row da tabela `user_achievements` retornada do DB.
public struct UserAchievementRecord: Codable, Hashable, Sendable, Identifiable {
    public let userId: String
    public let achievementId: String
    public let earnedAt: Date
    public let lastEarnedAt: Date
    public let count: Int
    public let celebratedAt: Date?

    public var id: String { "\(userId)::\(achievementId)" }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case achievementId = "achievement_id"
        case earnedAt = "earned_at"
        case lastEarnedAt = "last_earned_at"
        case count
        case celebratedAt = "celebrated_at"
    }
}

// MARK: - Global stats (RPC get_achievement_global_stats)

public struct AchievementGlobalStats: Codable, Hashable, Sendable {
    public let earnedCount: Int
    public let totalUsers: Int

    /// Null quando earnedCount = 0 ou totalUsers = 0 (esconde UI).
    public var percent: Double? {
        guard totalUsers > 0, earnedCount > 0 else { return nil }
        return (Double(earnedCount) / Double(totalUsers)) * 100
    }

    enum CodingKeys: String, CodingKey {
        case earnedCount = "earned_count"
        case totalUsers = "total_users"
    }
}

// MARK: - Format helper (paridade formatRarityPercent TS)

public enum AchievementRarityFormatter {
    /// Formata percent com precisão variável por magnitude.
    ///
    ///   0/null       → nil (esconder UI)
    ///   0.001–0.099  → "0,01%" cap (relíquias raríssimas)
    ///   0.10–0.99    → "0,50%" (2 decimal)
    ///   1.0–9.9      → "1,5%" (1 decimal)
    ///   10–100       → "23%" (integer)
    ///
    /// Locale-aware separator (vírgula em pt-BR, ponto em en).
    public static func format(_ percent: Double?, locale: Locale = .current) -> String? {
        guard let percent, percent > 0 else { return nil }

        let decimals: Int
        if percent < 1 {
            decimals = 2
        } else if percent < 10 {
            decimals = 1
        } else {
            decimals = 0
        }

        // Cap em 0,01% (não mostra 0,001%)
        let value = max(percent, 0.01)

        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.minimumFractionDigits = decimals
        formatter.maximumFractionDigits = decimals

        guard let formatted = formatter.string(from: NSNumber(value: value)) else {
            return nil
        }
        return "\(formatted)%"
    }
}

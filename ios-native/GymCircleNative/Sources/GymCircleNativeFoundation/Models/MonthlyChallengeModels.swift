import Foundation

// MARK: - Monthly Challenge (Sprint 8.0 — paridade Sprint 7.5.6+10 web)

/// Goal kinds aceitos pelo sistema. Reusa enum `goal_kind` da tabela
/// `monthly_challenges`. `recompute` no Swift trata cada um.
public enum ChallengeGoalKind: String, Codable, Sendable, Hashable {
    case workoutsInMonth = "workouts_in_month"
    case streakInMonth = "streak_in_month"
    case perfectMonth = "perfect_month"
    case groupWorkouts = "group_workouts"
    case distinctTypes = "distinct_types"
    /// Sprint 7.5.10 — N posts de um workout_type específico (config.workout_type)
    case workoutTypeSpecific = "workout_type_specific"
}

/// Definição do desafio mensal (row em `monthly_challenges`).
///
/// title/description vêm em variantes localizadas (`title_pt` / `title_en`).
/// `MonthlyChallenge.localized(for:locale:)` resolve a string apropriada.
public struct MonthlyChallengeDefinition: Codable, Hashable, Sendable {
    public let id: String
    public let periodKey: String         // "YYYY-MM"
    public let titlePt: String
    public let titleEn: String
    public let descriptionPt: String
    public let descriptionEn: String
    public let difficulty: ChallengeDifficulty
    public let goalKind: ChallengeGoalKind
    public let goalTarget: Int
    public let startDate: Date
    public let endDate: Date
    public let trophyId: String
    public let isSecret: Bool
    /// JSONB free-form. Use `goalConfigDictionary` pra acessar campos.
    public let goalConfig: GoalConfigData?

    enum CodingKeys: String, CodingKey {
        case id
        case periodKey = "period_key"
        case titlePt = "title_pt"
        case titleEn = "title_en"
        case descriptionPt = "description_pt"
        case descriptionEn = "description_en"
        case difficulty
        case goalKind = "goal_kind"
        case goalTarget = "goal_target"
        case startDate = "start_date"
        case endDate = "end_date"
        case trophyId = "trophy_id"
        case isSecret = "is_secret"
        case goalConfig = "goal_config"
    }

    /// String localizada via locale preferido. pt-BR usa title_pt, demais en.
    public func localizedTitle(locale: Locale = .current) -> String {
        usesPortuguese(locale: locale) ? titlePt : titleEn
    }

    public func localizedDescription(locale: Locale = .current) -> String {
        usesPortuguese(locale: locale) ? descriptionPt : descriptionEn
    }

    private func usesPortuguese(locale: Locale) -> Bool {
        let identifier = locale.identifier.lowercased()
        return identifier.hasPrefix("pt")
    }
}

/// Progress per user, retornado de `user_monthly_challenge_progress`.
public struct MonthlyChallengeProgress: Codable, Hashable, Sendable {
    public let userId: String
    public let challengeId: String
    public let progress: Int
    public let completedAt: Date?
    public let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case challengeId = "challenge_id"
        case progress
        case completedAt = "completed_at"
        case updatedAt = "updated_at"
    }
}

/// View-model unificado: definição + progresso. Idêntico ao
/// `MonthlyChallengeData` TS — usado direto pela UI.
public struct MonthlyChallenge: Identifiable, Hashable, Sendable {
    public let id: String
    public let periodKey: String
    public let title: String              // já localizada
    public let description: String        // já localizada
    public let difficulty: ChallengeDifficulty
    public let goalKind: ChallengeGoalKind
    public let goalTarget: Int
    public let trophyId: String
    public let progress: Int
    public let completedAt: Date?
    public let isSecret: Bool
    public let goalConfig: GoalConfigData?

    public var isCompleted: Bool { completedAt != nil }
    public var isMystery: Bool { isSecret && !isCompleted }

    /// % de progresso (0...1). Cap em 1 quando ultrapassa target.
    public var progressFraction: Double {
        guard goalTarget > 0 else { return 0 }
        return min(Double(progress) / Double(goalTarget), 1)
    }

    public init(
        id: String,
        periodKey: String,
        title: String,
        description: String,
        difficulty: ChallengeDifficulty,
        goalKind: ChallengeGoalKind,
        goalTarget: Int,
        trophyId: String,
        progress: Int,
        completedAt: Date?,
        isSecret: Bool,
        goalConfig: GoalConfigData?
    ) {
        self.id = id
        self.periodKey = periodKey
        self.title = title
        self.description = description
        self.difficulty = difficulty
        self.goalKind = goalKind
        self.goalTarget = goalTarget
        self.trophyId = trophyId
        self.progress = progress
        self.completedAt = completedAt
        self.isSecret = isSecret
        self.goalConfig = goalConfig
    }

    /// Compose a partir de definição + progresso (ou nil progresso = zerado).
    public static func compose(
        definition: MonthlyChallengeDefinition,
        progress: MonthlyChallengeProgress?,
        locale: Locale = .current
    ) -> MonthlyChallenge {
        MonthlyChallenge(
            id: definition.id,
            periodKey: definition.periodKey,
            title: definition.localizedTitle(locale: locale),
            description: definition.localizedDescription(locale: locale),
            difficulty: definition.difficulty,
            goalKind: definition.goalKind,
            goalTarget: definition.goalTarget,
            trophyId: definition.trophyId,
            progress: progress?.progress ?? 0,
            completedAt: progress?.completedAt,
            isSecret: definition.isSecret,
            goalConfig: definition.goalConfig
        )
    }
}

// MARK: - GoalConfigData (JSONB flexível)

/// Wrapper Codable pra goal_config JSONB. Suporta valores comuns
/// (workout_type string, min_hour int, tags array) sem precisar de
/// AnyCodable lib externa. Expandir conforme novos goal_kinds.
public struct GoalConfigData: Codable, Hashable, Sendable {
    public let workoutType: String?
    public let minHour: Int?
    public let tags: [String]?

    public init(
        workoutType: String? = nil,
        minHour: Int? = nil,
        tags: [String]? = nil
    ) {
        self.workoutType = workoutType
        self.minHour = minHour
        self.tags = tags
    }

    enum CodingKeys: String, CodingKey {
        case workoutType = "workout_type"
        case minHour = "min_hour"
        case tags
    }
}

// MARK: - Período corrente helper

public enum MonthlyChallengePeriod {
    /// Retorna period_key corrente "YYYY-MM" em timezone America/Sao_Paulo.
    /// Paridade com `getCurrentPeriodKey()` TS.
    public static func currentKey(now: Date = .now) -> String {
        var calendar = Calendar(identifier: .gregorian)
        if let tz = TimeZone(identifier: "America/Sao_Paulo") {
            calendar.timeZone = tz
        }
        let comps = calendar.dateComponents([.year, .month], from: now)
        let year = comps.year ?? 2026
        let month = comps.month ?? 1
        return String(format: "%04d-%02d", year, month)
    }
}

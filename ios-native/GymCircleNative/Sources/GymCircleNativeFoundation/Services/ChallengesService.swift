import Foundation
import Supabase

/// ChallengesService — Sprint 8.4 (paridade Sprint 7.5.6+10 web).
///
/// Actor que consulta:
///   - monthly_challenges: definições (Sprint 7.5.6 + 7.5.10 secret support)
///   - user_monthly_challenge_progress: progress per user (Sprint 7.5.6)
///
/// Builder method `loadCurrent(userId:locale:)` retorna shape pronto pro
/// MyCircleViewData.monthlyChallenges. Sprint 7.5.10 secret support
/// (isSecret + goalConfig) já mapeado nos models (Sprint 8.0).
public actor ChallengesService {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    // MARK: - Loaders

    /// Carrega definições + progress do user pra um período (default = corrente).
    /// Retorna view-model MonthlyChallenge pronto pra UI consumir.
    public func loadChallenges(
        userId: String,
        periodKey: String? = nil,
        locale: Locale = .current
    ) async throws -> [MonthlyChallenge] {
        let period = periodKey ?? MonthlyChallengePeriod.currentKey()

        async let definitionsTask = fetchDefinitions(periodKey: period)
        async let progressTask = fetchProgress(userId: userId, periodKey: period)

        let definitions = try await definitionsTask
        let progressByChallenge = try await progressTask

        return definitions.map { def in
            MonthlyChallenge.compose(
                definition: def,
                progress: progressByChallenge[def.id],
                locale: locale
            )
        }
    }

    // MARK: - Privates

    private func fetchDefinitions(periodKey: String) async throws -> [MonthlyChallengeDefinition] {
        try await client
            .from("monthly_challenges")
            .select("id,period_key,title_pt,title_en,description_pt,description_en,difficulty,goal_kind,goal_target,start_date,end_date,trophy_id,is_secret,goal_config")
            .eq("period_key", value: periodKey)
            .order("difficulty", ascending: true)
            .execute()
            .value
    }

    private func fetchProgress(userId: String, periodKey: String) async throws -> [String: MonthlyChallengeProgress] {
        // Filter por user_id; period scope via JOIN seria ideal mas client-side
        // resolve pelo challenge IDs do step 1. Pra simplicidade, query todas
        // progress do user — pouco volume (4 challenges/mês × N meses).
        let rows: [MonthlyChallengeProgress] = try await client
            .from("user_monthly_challenge_progress")
            .select("user_id,challenge_id,progress,completed_at,updated_at")
            .eq("user_id", value: userId)
            .execute()
            .value
        return Dictionary(uniqueKeysWithValues: rows.map { ($0.challengeId, $0) })
    }
}

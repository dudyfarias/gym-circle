import Foundation

/// AchievementBuilder — Sprint 8.4 (paridade `getAllAchievements` TS).
///
/// Computa array de Achievement objects baseado em estado social do user
/// (stats + counts). Reflete EXATAMENTE o builder TS em
/// `apps/web/src/components/gym-circle/social/achievements.ts`.
///
/// Achievements derivados em 4 categorias (Badge, Medal, Trophy, Relic);
/// Challenges entram via parâmetro opcional (vêm de ChallengesService).
public enum AchievementBuilder {
    public struct Input {
        public let postsCount: Int
        public let longestStreak: Int
        public let workoutsThisMonth: Int
        public let workoutsThisWeek: Int
        public let activeDaysCount: Int
        public let followersCount: Int
        public let hasUsedStreakRestore: Bool
        public let createdAt: Date?
        public let monthlyChallenges: [MonthlyChallenge]

        public init(
            postsCount: Int,
            longestStreak: Int,
            workoutsThisMonth: Int,
            workoutsThisWeek: Int = 0,
            activeDaysCount: Int,
            followersCount: Int,
            hasUsedStreakRestore: Bool = false,
            createdAt: Date? = nil,
            monthlyChallenges: [MonthlyChallenge] = []
        ) {
            self.postsCount = postsCount
            self.longestStreak = longestStreak
            self.workoutsThisMonth = workoutsThisMonth
            self.workoutsThisWeek = workoutsThisWeek
            self.activeDaysCount = activeDaysCount
            self.followersCount = followersCount
            self.hasUsedStreakRestore = hasUsedStreakRestore
            self.createdAt = createdAt
            self.monthlyChallenges = monthlyChallenges
        }
    }

    /// Retorna achievements de todas as 5 categorias. Ordem é estável.
    public static func buildAll(input: Input) -> [Achievement] {
        var result: [Achievement] = []
        result.append(contentsOf: buildBadges(input))
        result.append(contentsOf: buildMedals(input))
        result.append(contentsOf: buildTrophies(input))
        result.append(contentsOf: buildRelics(input))
        result.append(contentsOf: buildChallenges(input.monthlyChallenges))
        return result
    }

    // MARK: - Badges

    private static func buildBadges(_ input: Input) -> [Achievement] {
        [
            Achievement(
                kind: .badge,
                achievementId: "first-workout",
                label: "Primeiro treino",
                description: "Publicou seu primeiro treino no feed.",
                earned: input.postsCount >= 1,
                iconKey: .trophy,
                rarity: .common
            ),
            Achievement(
                kind: .badge,
                achievementId: "early-bird",
                label: "Madrugador",
                description: "Postou um treino entre 5h e 7h da manhã.",
                earned: false,
                iconKey: .sunrise,
                rarity: .uncommon,
                secret: true
            ),
            Achievement(
                kind: .badge,
                achievementId: "night-owl",
                label: "Coruja",
                description: "Postou um treino depois das 23h.",
                earned: false,
                iconKey: .moon,
                rarity: .uncommon,
                secret: true
            )
        ]
    }

    // MARK: - Medals

    private static func buildMedals(_ input: Input) -> [Achievement] {
        let streak = input.longestStreak
        return [
            Achievement(
                kind: .medal,
                achievementId: "streak-3",
                label: "3 dias seguidos",
                description: "Treinou 3 dias consecutivos.",
                earned: streak >= 3,
                iconKey: .flame,
                rarity: .common,
                progress: streak < 3 ? AchievementProgress(current: streak, target: 3) : nil,
                tier: .bronze
            ),
            Achievement(
                kind: .medal,
                achievementId: "streak-7",
                label: "Semana cheia",
                description: "Treinou 7 dias consecutivos.",
                earned: streak >= 7,
                iconKey: .flame,
                rarity: .common,
                progress: streak < 7 ? AchievementProgress(current: streak, target: 7) : nil,
                tier: .bronze
            ),
            Achievement(
                kind: .medal,
                achievementId: "streak-14",
                label: "Duas semanas",
                description: "Treinou 14 dias consecutivos.",
                earned: streak >= 14,
                iconKey: .flame,
                rarity: .uncommon,
                progress: streak < 14 ? AchievementProgress(current: streak, target: 14) : nil,
                tier: .silver
            ),
            Achievement(
                kind: .medal,
                achievementId: "streak-30",
                label: "Um mês",
                description: "Treinou 30 dias consecutivos.",
                earned: streak >= 30,
                iconKey: .flame,
                rarity: .rare,
                progress: streak < 30 ? AchievementProgress(current: streak, target: 30) : nil,
                tier: .gold
            ),
            Achievement(
                kind: .medal,
                achievementId: "workouts-50",
                label: "50 treinos",
                description: "Publicou 50 treinos no feed.",
                earned: input.postsCount >= 50,
                iconKey: .share,
                rarity: .uncommon,
                progress: input.postsCount < 50 ? AchievementProgress(current: input.postsCount, target: 50) : nil,
                tier: .silver
            ),
            Achievement(
                kind: .medal,
                achievementId: "streak-recovered",
                label: "Recuperou a streak",
                description: "Usou um restaurador pra salvar o circle.",
                earned: input.hasUsedStreakRestore,
                iconKey: .shield,
                rarity: .common,
                tier: .bronze
            )
        ]
    }

    // MARK: - Trophies

    private static func buildTrophies(_ input: Input) -> [Achievement] {
        let followers = input.followersCount
        return [
            Achievement(
                kind: .trophy,
                achievementId: "streak-60",
                label: "Streak de aço",
                description: "Treinou 60 dias consecutivos.",
                earned: input.longestStreak >= 60,
                iconKey: .flame,
                rarity: .rare,
                progress: input.longestStreak < 60 ? AchievementProgress(current: input.longestStreak, target: 60) : nil
            ),
            Achievement(
                kind: .trophy,
                achievementId: "month-active",
                label: "Mês ativo",
                description: "Treinou 15+ dias neste mês.",
                earned: input.workoutsThisMonth >= 15,
                iconKey: .calendar,
                rarity: .uncommon,
                progress: input.workoutsThisMonth < 15 ? AchievementProgress(current: input.workoutsThisMonth, target: 15) : nil,
                repeatable: true
            ),
            Achievement(
                kind: .trophy,
                achievementId: "year-active",
                label: "Ano em alta",
                description: "100+ dias treinados neste ano.",
                earned: input.activeDaysCount >= 100,
                iconKey: .calendar,
                rarity: .rare,
                progress: input.activeDaysCount < 100 ? AchievementProgress(current: input.activeDaysCount, target: 100) : nil
            ),
            Achievement(
                kind: .trophy,
                achievementId: "social-10",
                label: "Primeiros amigos",
                description: "Tem 10+ seguidores.",
                earned: followers >= 10,
                iconKey: .users,
                rarity: .common,
                progress: followers < 10 ? AchievementProgress(current: followers, target: 10) : nil
            ),
            Achievement(
                kind: .trophy,
                achievementId: "friends-50",
                label: "50 amigos",
                description: "Tem 50+ seguidores no Gym Circle.",
                earned: followers >= 50,
                iconKey: .users,
                rarity: .uncommon,
                progress: followers < 50 ? AchievementProgress(current: followers, target: 50) : nil
            ),
            Achievement(
                kind: .trophy,
                achievementId: "prolific-100",
                label: "Centurião do feed",
                description: "Publicou 100+ posts de treino.",
                earned: input.postsCount >= 100,
                iconKey: .share,
                rarity: .epic,
                progress: input.postsCount < 100 ? AchievementProgress(current: input.postsCount, target: 100) : nil
            )
        ]
    }

    // MARK: - Relics

    private static func buildRelics(_ input: Input) -> [Achievement] {
        [
            Achievement(
                kind: .relic,
                achievementId: "unbreakable",
                label: "Inquebrável",
                description: "Treinou 100 dias consecutivos.",
                earned: input.longestStreak >= 100,
                iconKey: .flame,
                rarity: .epic,
                progress: input.longestStreak < 100 ? AchievementProgress(current: input.longestStreak, target: 100) : nil
            ),
            Achievement(
                kind: .relic,
                achievementId: "circle-master",
                label: "Mestre do Circle",
                description: "300 dias treinados num único ano.",
                earned: input.activeDaysCount >= 300,
                iconKey: .trophy,
                rarity: .legendary,
                progress: input.activeDaysCount < 300 ? AchievementProgress(current: input.activeDaysCount, target: 300) : nil
            ),
            Achievement(
                kind: .relic,
                achievementId: "streak-365",
                label: "Ano inteiro",
                description: "Treinou 365 dias consecutivos.",
                earned: input.longestStreak >= 365,
                iconKey: .flame,
                rarity: .legendary,
                progress: input.longestStreak < 365 ? AchievementProgress(current: input.longestStreak, target: 365) : nil
            ),
            Achievement(
                kind: .relic,
                achievementId: "founder-2026",
                label: "Fundador 2026",
                description: "Esteve no Gym Circle nos primeiros meses.",
                earned: isFounder2026(input.createdAt),
                iconKey: .shield,
                rarity: .legendary
            )
        ]
    }

    private static func isFounder2026(_ createdAt: Date?) -> Bool {
        guard let createdAt else { return false }
        var components = DateComponents()
        components.year = 2027
        components.month = 1
        components.day = 1
        let calendar = Calendar(identifier: .gregorian)
        guard let cutoff = calendar.date(from: components) else { return false }
        return createdAt < cutoff
    }

    // MARK: - Challenges

    private static func buildChallenges(_ monthlyChallenges: [MonthlyChallenge]) -> [Achievement] {
        monthlyChallenges.map { challenge in
            let rarity: AchievementRarity = {
                switch challenge.difficulty {
                case .legendary: return .legendary
                case .hard: return .epic
                case .medium: return .uncommon
                case .easy: return .common
                }
            }()

            return Achievement(
                kind: .challenge,
                achievementId: challenge.id,
                label: challenge.title,
                description: challenge.description,
                earned: challenge.isCompleted,
                iconKey: .trophy,
                rarity: rarity,
                progress: challenge.isCompleted ? nil : AchievementProgress(
                    current: challenge.progress,
                    target: challenge.goalTarget
                ),
                secret: challenge.isSecret,
                periodKey: challenge.periodKey,
                difficulty: challenge.difficulty,
                trophyId: challenge.trophyId
            )
        }
    }
}

// MARK: - Suggestion helper (Sprint 7.5.5 — paridade)

public enum AchievementSuggester {
    /// Top N achievements priorizados por raridade x kind. Usado quando
    /// user não tem featured manuais — fallback automático.
    public static func suggestFeatured(achievements: [Achievement], count: Int = 3) -> [Achievement] {
        let earned = achievements.filter(\.earned)
        let sorted = earned.sorted { a, b in
            priorityScore(a) > priorityScore(b)
        }
        return Array(sorted.prefix(count))
    }

    private static func priorityScore(_ a: Achievement) -> Int {
        let kindRank: Int = {
            switch a.kind {
            case .relic: return 5
            case .trophy: return 4
            case .medal: return 3
            case .badge: return 2
            case .challenge: return 1
            }
        }()
        let rarityRank: Int = {
            switch a.rarity {
            case .legendary: return 5
            case .epic: return 4
            case .rare: return 3
            case .uncommon: return 2
            case .common: return 1
            case .none: return 0
            }
        }()
        return kindRank * 10 + rarityRank
    }

    /// Próximo achievement mais próximo de ser ganho. Mesma heurística
    /// do TS getNextAchievement (ignora secret, prioriza progress %).
    public static func nextAchievement(achievements: [Achievement]) -> Achievement? {
        let candidates = achievements.filter { !$0.earned && !$0.secret }
        let withProgress = candidates.filter { $0.progress != nil }
        let pool = withProgress.isEmpty ? candidates : withProgress
        return pool.sorted { a, b in
            let aPct = a.progress.map { Double($0.current) / Double($0.target) } ?? 0
            let bPct = b.progress.map { Double($0.current) / Double($0.target) } ?? 0
            return aPct > bPct
        }.first
    }
}

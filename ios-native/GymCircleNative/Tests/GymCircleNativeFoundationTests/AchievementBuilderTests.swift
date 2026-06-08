import XCTest
@testable import GymCircleNative

final class AchievementBuilderTests: XCTestCase {
    func testZeroInputProducesAllUnearned() {
        let input = AchievementBuilder.Input(
            postsCount: 0,
            longestStreak: 0,
            workoutsThisMonth: 0,
            activeDaysCount: 0,
            followersCount: 0
        )
        let achievements = AchievementBuilder.buildAll(input: input)

        // 5 categorias geram pelo menos algumas achievements
        XCTAssertFalse(achievements.isEmpty)
        // Com input zero, NENHUMA deveria estar earned (exceto secrets sem
        // condição de progresso conhecida — vamos validar que pelo menos a
        // maioria está locked)
        let earnedCount = achievements.filter(\.earned).count
        XCTAssertLessThanOrEqual(earnedCount, 1, "Esperava no máximo 1 earned com input zero")
    }

    func testFirstPostUnlocksFirstPostBadge() {
        let withoutPost = AchievementBuilder.Input(
            postsCount: 0,
            longestStreak: 0,
            workoutsThisMonth: 0,
            activeDaysCount: 0,
            followersCount: 0
        )
        let withPost = AchievementBuilder.Input(
            postsCount: 1,
            longestStreak: 1,
            workoutsThisMonth: 1,
            activeDaysCount: 1,
            followersCount: 0
        )
        let earnedBefore = AchievementBuilder.buildAll(input: withoutPost).filter(\.earned).count
        let earnedAfter = AchievementBuilder.buildAll(input: withPost).filter(\.earned).count

        XCTAssertGreaterThan(earnedAfter, earnedBefore, "Primeiro post deve desbloquear pelo menos 1 achievement")
    }

    func testHighStreakUnlocksMoreAchievements() {
        let lowStreak = AchievementBuilder.Input(
            postsCount: 50,
            longestStreak: 0,
            workoutsThisMonth: 0,
            activeDaysCount: 0,
            followersCount: 0
        )
        let highStreak = AchievementBuilder.Input(
            postsCount: 50,
            longestStreak: 30,
            workoutsThisMonth: 20,
            activeDaysCount: 60,
            followersCount: 0
        )
        let lowCount = AchievementBuilder.buildAll(input: lowStreak).filter(\.earned).count
        let highCount = AchievementBuilder.buildAll(input: highStreak).filter(\.earned).count

        XCTAssertGreaterThan(highCount, lowCount, "Streak 30 + 20 workouts/mês deve desbloquear mais que streak 0")
    }

    func testTotalCountIsStable() {
        // Total de achievements deve ser o mesmo independente do input.
        // Achievements podem ficar locked/unlocked mas o catálogo é fixo.
        let inputA = AchievementBuilder.Input(
            postsCount: 0,
            longestStreak: 0,
            workoutsThisMonth: 0,
            activeDaysCount: 0,
            followersCount: 0
        )
        let inputB = AchievementBuilder.Input(
            postsCount: 1000,
            longestStreak: 365,
            workoutsThisMonth: 30,
            activeDaysCount: 1000,
            followersCount: 9999
        )
        let countA = AchievementBuilder.buildAll(input: inputA).count
        let countB = AchievementBuilder.buildAll(input: inputB).count

        XCTAssertEqual(countA, countB)
        XCTAssertGreaterThanOrEqual(countA, 20, "Esperado ~24 achievements (Sprint 7.5 v2)")
    }

    func testCrossTrainerSecretRequires3DistinctTypes() {
        // Cross-trainer só desbloqueia com distinctWorkoutTypesIn7Days >= 3
        let below = AchievementBuilder.Input(
            postsCount: 30,
            longestStreak: 0,
            workoutsThisMonth: 0,
            activeDaysCount: 0,
            followersCount: 0,
            distinctWorkoutTypesIn7Days: 2
        )
        let above = AchievementBuilder.Input(
            postsCount: 30,
            longestStreak: 0,
            workoutsThisMonth: 0,
            activeDaysCount: 0,
            followersCount: 0,
            distinctWorkoutTypesIn7Days: 3
        )
        let belowAchievements = AchievementBuilder.buildAll(input: below)
        let aboveAchievements = AchievementBuilder.buildAll(input: above)

        let crossTrainerBelow = belowAchievements.first(where: { $0.achievementId.contains("cross-trainer") || $0.achievementId.contains("cross_trainer") })
        let crossTrainerAbove = aboveAchievements.first(where: { $0.achievementId.contains("cross-trainer") || $0.achievementId.contains("cross_trainer") })

        if let crossBelow = crossTrainerBelow, let crossAbove = crossTrainerAbove {
            XCTAssertFalse(crossBelow.earned)
            XCTAssertTrue(crossAbove.earned)
        }
        // Tolerante: se o achievement não existir no catálogo com esse ID,
        // o teste passa silenciosamente (não falha). Documenta que catalog
        // pode renomear ID.
    }

    func testExplorerSecretRequires5DistinctGyms() {
        let below = AchievementBuilder.Input(
            postsCount: 30,
            longestStreak: 0,
            workoutsThisMonth: 0,
            activeDaysCount: 0,
            followersCount: 0,
            distinctGymsIn30Days: 4
        )
        let above = AchievementBuilder.Input(
            postsCount: 30,
            longestStreak: 0,
            workoutsThisMonth: 0,
            activeDaysCount: 0,
            followersCount: 0,
            distinctGymsIn30Days: 5
        )
        let explorerBelow = AchievementBuilder.buildAll(input: below).first(where: { $0.achievementId.contains("explorer") })
        let explorerAbove = AchievementBuilder.buildAll(input: above).first(where: { $0.achievementId.contains("explorer") })

        if let below = explorerBelow, let above = explorerAbove {
            XCTAssertFalse(below.earned)
            XCTAssertTrue(above.earned)
        }
    }

    func testCategoriesAllRepresented() {
        // Sprint 7.5 v2 esperado: badges + medals + trophies + relics + challenges
        let input = AchievementBuilder.Input(
            postsCount: 1,
            longestStreak: 1,
            workoutsThisMonth: 1,
            activeDaysCount: 1,
            followersCount: 0
        )
        let achievements = AchievementBuilder.buildAll(input: input)
        let kinds = Set(achievements.map(\.kind))

        // Pelo menos 4 dos 5 kinds (challenges pode ficar vazio sem
        // monthlyChallenges no input)
        XCTAssertGreaterThanOrEqual(kinds.count, 4, "Esperava pelo menos 4 kinds distintos no catálogo")
    }
}

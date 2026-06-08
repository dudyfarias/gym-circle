import XCTest
@testable import GymCircleNative

final class CalendarBuilderTests: XCTestCase {
    func testBuildMonthReturnsCorrectDayCount() {
        // Junho 2026 = 30 dias
        let days = CalendarBuilder.buildMonth(
            monthKey: "2026-06",
            workoutDays: [],
            todayKey: "2026-06-15"
        )
        XCTAssertEqual(days.count, 30)
    }

    func testBuildMonthFebruaryNonLeap() {
        // 2027 não é leap → fevereiro tem 28 dias
        let days = CalendarBuilder.buildMonth(
            monthKey: "2027-02",
            workoutDays: [],
            todayKey: "2027-02-10"
        )
        XCTAssertEqual(days.count, 28)
    }

    func testBuildMonthFebruaryLeap() {
        // 2028 leap → fevereiro 29 dias
        let days = CalendarBuilder.buildMonth(
            monthKey: "2028-02",
            workoutDays: [],
            todayKey: "2028-02-10"
        )
        XCTAssertEqual(days.count, 29)
    }

    func testBuildMonthMarksTrainedDays() {
        let trained = ["2026-06-01", "2026-06-15", "2026-06-30"]
        let days = CalendarBuilder.buildMonth(
            monthKey: "2026-06",
            workoutDays: trained,
            todayKey: "2026-06-15"
        )
        XCTAssertTrue(days.first(where: { $0.dateKey == "2026-06-01" })?.trained ?? false)
        XCTAssertTrue(days.first(where: { $0.dateKey == "2026-06-15" })?.trained ?? false)
        XCTAssertTrue(days.first(where: { $0.dateKey == "2026-06-30" })?.trained ?? false)
        // Dias não treinados ficam false
        XCTAssertFalse(days.first(where: { $0.dateKey == "2026-06-02" })?.trained ?? true)
    }

    func testBuildMonthLinksPostThumbnail() {
        let url = URL(string: "https://cdn.test/post.jpg")!
        let posts = [
            MonthCalendarPost(dateKey: "2026-06-05", postId: "p1", imageURL: url)
        ]
        let days = CalendarBuilder.buildMonth(
            monthKey: "2026-06",
            workoutDays: [],
            todayKey: "2026-06-15",
            posts: posts
        )
        let day5 = days.first(where: { $0.dateKey == "2026-06-05" })
        XCTAssertEqual(day5?.thumbnailURL, url)
        XCTAssertEqual(day5?.postId, "p1")
        // Outros dias não têm thumbnail
        let day6 = days.first(where: { $0.dateKey == "2026-06-06" })
        XCTAssertNil(day6?.thumbnailURL)
    }

    func testBuildMonthFirstPostWinsWhenMultiplePerDay() {
        let url1 = URL(string: "https://cdn.test/p1.jpg")!
        let url2 = URL(string: "https://cdn.test/p2.jpg")!
        let posts = [
            MonthCalendarPost(dateKey: "2026-06-10", postId: "first", imageURL: url1),
            MonthCalendarPost(dateKey: "2026-06-10", postId: "second", imageURL: url2)
        ]
        let days = CalendarBuilder.buildMonth(
            monthKey: "2026-06",
            workoutDays: [],
            todayKey: "2026-06-15",
            posts: posts
        )
        let day10 = days.first(where: { $0.dateKey == "2026-06-10" })
        XCTAssertEqual(day10?.postId, "first")
        XCTAssertEqual(day10?.thumbnailURL, url1)
    }

    func testBuildMonthInvalidMonthKeyReturnsEmpty() {
        XCTAssertTrue(CalendarBuilder.buildMonth(
            monthKey: "invalid",
            workoutDays: [],
            todayKey: "2026-06-15"
        ).isEmpty)
        XCTAssertTrue(CalendarBuilder.buildMonth(
            monthKey: "2026",
            workoutDays: [],
            todayKey: "2026-06-15"
        ).isEmpty)
    }

    func testBuildMonthDayKeysAreFormattedYYYYMMDD() {
        let days = CalendarBuilder.buildMonth(
            monthKey: "2026-01",
            workoutDays: [],
            todayKey: "2026-01-15"
        )
        // Zero-padding em dia + mês
        XCTAssertEqual(days[0].dateKey, "2026-01-01")
        XCTAssertEqual(days[8].dateKey, "2026-01-09")
        XCTAssertEqual(days[9].dateKey, "2026-01-10")
    }
}

final class StreakLevelTests: XCTestCase {
    func testZeroDaysIsIniciante() {
        XCTAssertEqual(StreakLevel.current(for: 0).id, .iniciante)
    }

    func testThreeDaysStillIniciante() {
        // boundary: 4 dias é consistente → 3 ainda iniciante
        XCTAssertEqual(StreakLevel.current(for: 3).id, .iniciante)
    }

    func testFourDaysIsConsistente() {
        XCTAssertEqual(StreakLevel.current(for: 4).id, .consistente)
    }

    func testThirteenDaysStillConsistente() {
        XCTAssertEqual(StreakLevel.current(for: 13).id, .consistente)
    }

    func testFourteenDaysIsElite() {
        XCTAssertEqual(StreakLevel.current(for: 14).id, .elite)
    }

    func testTwentyNineDaysStillElite() {
        XCTAssertEqual(StreakLevel.current(for: 29).id, .elite)
    }

    func testThirtyDaysIsLendario() {
        XCTAssertEqual(StreakLevel.current(for: 30).id, .lendario)
    }

    func testVeryHighStreakStillLendario() {
        XCTAssertEqual(StreakLevel.current(for: 9999).id, .lendario)
    }

    func testNegativeDaysFallsBackToIniciante() {
        // Defensivo: streak negativo não deveria existir mas fallback gracioso.
        XCTAssertEqual(StreakLevel.current(for: -5).id, .iniciante)
    }

    func testLevelsHaveStableBoundaries() {
        // Garante que minDays sequence é 0/4/14/30 — qualquer mudança quebra aqui.
        let levels = StreakLevel.all.map(\.minDays)
        XCTAssertEqual(levels, [0, 4, 14, 30])
    }
}

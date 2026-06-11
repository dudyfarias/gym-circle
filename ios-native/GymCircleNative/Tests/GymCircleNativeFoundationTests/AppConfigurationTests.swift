import XCTest
@testable import GymCircleNative

/// Sprint 20.0 — config resolution do app standalone + paridade da
/// normalização de workout types (port do fix multi-tags web f4e1f0b).
final class AppConfigurationTests: XCTestCase {
    // MARK: - AppConfiguration.fromBundle

    func testFromBundleRejectsEmptyValues() {
        // O Info.plist do test bundle não tem as keys → nil (modo demo),
        // nunca crash.
        XCTAssertNil(AppConfiguration.fromBundle(Bundle(for: Self.self)))
    }

    func testResolvePrefersEnvironmentWhenPresent() {
        // Em CI/Xcode os testes podem rodar COM env vars setadas; o
        // contrato é: env presente ⇒ resolve() == fromEnvironment().
        if let fromEnv = AppConfiguration.fromEnvironment() {
            let resolved = AppConfiguration.resolve(bundle: Bundle(for: Self.self))
            XCTAssertEqual(resolved?.supabaseURL, fromEnv.supabaseURL)
        } else {
            // Sem env e sem keys no bundle de teste ⇒ nil.
            XCTAssertNil(AppConfiguration.resolve(bundle: Bundle(for: Self.self)))
        }
    }

    // MARK: - normalizeWorkoutType (paridade web normalizeForCompare)

    func testNormalizeRemovesAccentsAndCase() {
        XCTAssertEqual(MyCircleService.normalizeWorkoutType("Musculação"), "musculacao")
        XCTAssertEqual(
            MyCircleService.normalizeWorkoutType("Musculação"),
            MyCircleService.normalizeWorkoutType("musculacao")
        )
        XCTAssertEqual(MyCircleService.normalizeWorkoutType("  Tênis  "), "tenis")
    }

    func testNormalizeEmptyAndNilReturnNil() {
        XCTAssertNil(MyCircleService.normalizeWorkoutType(nil))
        XCTAssertNil(MyCircleService.normalizeWorkoutType(""))
        XCTAssertNil(MyCircleService.normalizeWorkoutType("   "))
    }
}

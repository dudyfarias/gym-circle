import XCTest
@testable import GymCircleNative

/// Sprint 22.1 — cobre a detecção email-vs-username do login nativo, que
/// espelha o `packages/core/src/services/auth.ts`. O bug que motivou o fix:
/// o app só fazia `auth.signIn(email:)`, então quem entrava com o handle
/// recebia "credenciais inválidas" e ficava preso na tela de login.
final class AuthIdentifierTests: XCTestCase {
    func testEmailsAreDetectedAsEmail() {
        XCTAssertTrue(AuthService.isEmailIdentifier("dudy@dudyfarias.com"))
        XCTAssertTrue(AuthService.isEmailIdentifier("  Dudy@Dudyfarias.com  "))
    }

    func testHandlesAreNotEmail() {
        XCTAssertFalse(AuthService.isEmailIdentifier("dudy"))
        // Quirk crucial: "@dudy" é handle, não email — o @ inicial não conta.
        XCTAssertFalse(AuthService.isEmailIdentifier("@dudy"))
    }

    func testCleanUsernameNormalizes() {
        XCTAssertEqual(AuthService.cleanUsername("@Dudy.Farias"), "dudy.farias")
        XCTAssertEqual(AuthService.cleanUsername("  DUDY  "), "dudy")
        // Caracteres fora de [a-z0-9_.] somem (igual ao web).
        XCTAssertEqual(AuthService.cleanUsername("du dy!"), "dudy")
        XCTAssertEqual(AuthService.cleanUsername("@user_name.1"), "user_name.1")
    }
}

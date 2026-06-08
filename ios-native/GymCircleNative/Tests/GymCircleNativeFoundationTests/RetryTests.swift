import XCTest
@testable import GymCircleNative

final class RetryPolicyTests: XCTestCase {
    // MARK: - delay()

    func testDelayFirstAttemptIsZero() {
        // Primeiro attempt = sem espera (retry policy só ativa do 2º em diante).
        XCTAssertEqual(RetryPolicy.standard.delay(forAttempt: 1, randomness: { 0.5 }), 0)
    }

    func testDelayExponentialDoubling() {
        // baseDelay 0.5, jitter 0 (passado via init custom): 2→0.5*2^1=1.0, 3→0.5*2^2=2.0
        let policy = RetryPolicy(maxAttempts: 5, baseDelay: 0.5, maxDelay: 100, jitterRatio: 0)
        XCTAssertEqual(policy.delay(forAttempt: 2, randomness: { 0.5 }), 1.0, accuracy: 0.001)
        XCTAssertEqual(policy.delay(forAttempt: 3, randomness: { 0.5 }), 2.0, accuracy: 0.001)
        XCTAssertEqual(policy.delay(forAttempt: 4, randomness: { 0.5 }), 4.0, accuracy: 0.001)
    }

    func testDelayClampedByMaxDelay() {
        // baseDelay 1.0 com max 3.0: 2→2, 3→3 (clampado), 10→3 (clampado).
        let policy = RetryPolicy(maxAttempts: 20, baseDelay: 1.0, maxDelay: 3.0, jitterRatio: 0)
        XCTAssertEqual(policy.delay(forAttempt: 2, randomness: { 0.5 }), 2.0, accuracy: 0.001)
        XCTAssertEqual(policy.delay(forAttempt: 3, randomness: { 0.5 }), 3.0, accuracy: 0.001)
        XCTAssertEqual(policy.delay(forAttempt: 10, randomness: { 0.5 }), 3.0, accuracy: 0.001)
    }

    func testDelayJitterAppliedInRange() {
        // Com jitter 0.2 e raw 1.0, range esperada [0.8, 1.2].
        let policy = RetryPolicy(maxAttempts: 5, baseDelay: 0.5, maxDelay: 100, jitterRatio: 0.2)
        let minD = policy.delay(forAttempt: 2, randomness: { 0.0 }) // r=0 → 1 + (-1)*0.2 = 0.8
        let maxD = policy.delay(forAttempt: 2, randomness: { 1.0 }) // r=1 → 1 + (1)*0.2  = 1.2
        XCTAssertEqual(minD, 0.8, accuracy: 0.001)
        XCTAssertEqual(maxD, 1.2, accuracy: 0.001)
    }

    func testPolicyEnforceMinimumOneAttempt() {
        let zero = RetryPolicy(maxAttempts: 0, baseDelay: 0, maxDelay: 0)
        XCTAssertEqual(zero.maxAttempts, 1, "maxAttempts deve ser pelo menos 1")
    }

    func testPolicyClampsJitterRatio() {
        let outOfRange = RetryPolicy(maxAttempts: 3, baseDelay: 0.1, maxDelay: 1, jitterRatio: 5.0)
        XCTAssertEqual(outOfRange.jitterRatio, 1.0)
        let negative = RetryPolicy(maxAttempts: 3, baseDelay: 0.1, maxDelay: 1, jitterRatio: -1.0)
        XCTAssertEqual(negative.jitterRatio, 0.0)
    }
}

final class WithRetryTests: XCTestCase {
    /// Erro local pra simular falha transiente (não-URLError).
    struct FakeTransient: Error {}
    /// Erro local pra simular falha permanente.
    struct FakePermanent: Error {}

    func testSuccessOnFirstAttempt() async throws {
        var calls = 0
        let result = try await withRetry(policy: .standard) {
            calls += 1
            return 42
        }
        XCTAssertEqual(result, 42)
        XCTAssertEqual(calls, 1)
    }

    func testSuccessOnSecondAttempt() async throws {
        var calls = 0
        let result = try await withRetry(
            policy: RetryPolicy(maxAttempts: 3, baseDelay: 0.001, maxDelay: 0.001, jitterRatio: 0),
            isTransient: { _ in true },
            sleep: { _ in }
        ) {
            calls += 1
            if calls == 1 { throw FakeTransient() }
            return "ok"
        }
        XCTAssertEqual(result, "ok")
        XCTAssertEqual(calls, 2)
    }

    func testExhaustsAndRethrowsLastError() async {
        var calls = 0
        do {
            _ = try await withRetry(
                policy: RetryPolicy(maxAttempts: 3, baseDelay: 0.001, maxDelay: 0.001, jitterRatio: 0),
                isTransient: { _ in true },
                sleep: { _ in }
            ) {
                calls += 1
                throw FakeTransient()
            }
            XCTFail("Esperava throw após esgotar tentativas")
        } catch {
            XCTAssertTrue(error is FakeTransient)
            XCTAssertEqual(calls, 3)
        }
    }

    func testNonTransientErrorRethrowsImmediately() async {
        var calls = 0
        do {
            _ = try await withRetry(
                policy: .standard,
                isTransient: { _ in false }, // tudo é permanente
                sleep: { _ in }
            ) {
                calls += 1
                throw FakePermanent()
            }
            XCTFail("Esperava throw imediato")
        } catch {
            XCTAssertTrue(error is FakePermanent)
            XCTAssertEqual(calls, 1, "Erro permanente não retry — só 1 call")
        }
    }

    func testIsTransientNetworkErrorRecognizesTimedOut() {
        let err = URLError(.timedOut)
        XCTAssertTrue(isTransientNetworkError(err))
    }

    func testIsTransientNetworkErrorRecognizesNotConnected() {
        let err = URLError(.notConnectedToInternet)
        XCTAssertTrue(isTransientNetworkError(err))
    }

    func testIsTransientNetworkErrorRejectsCancellation() {
        XCTAssertFalse(isTransientNetworkError(CancellationError()))
    }

    func testIsTransientNetworkErrorRejectsBadURL() {
        let err = URLError(.badURL)
        XCTAssertFalse(isTransientNetworkError(err))
    }
}

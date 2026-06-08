import Foundation

/// Retry helper — Sprint 9.9.6 (P1 #10).
///
/// Network blip não deve propagar erro cru pro user. Apple HIG sugere
/// graceful recovery em fetches transientes. Este helper aplica
/// exponential backoff + jitter em qualquer closure async throws.
///
/// Uso típico em service actor:
/// ```swift
/// try await withRetry { try await client.from("...").select().execute() }
/// ```
///
/// Override de política quando útil:
/// ```swift
/// try await withRetry(policy: .aggressive) { ... }
/// ```
///
/// Override de detection quando o erro tem semântica de domínio:
/// ```swift
/// try await withRetry(isTransient: { $0 is MyDomainError == false }) { ... }
/// ```

// MARK: - RetryPolicy

public struct RetryPolicy: Sendable {
    /// Total de tentativas, incluindo a primeira. 1 = sem retry.
    public let maxAttempts: Int
    /// Delay base entre tentativas (segundos). Multiplica por 2^(attempt-1).
    public let baseDelay: TimeInterval
    /// Teto absoluto pra evitar backoff explodir em 60s+.
    public let maxDelay: TimeInterval
    /// Fração de jitter aplicada ao delay (0.0 = nenhum, 0.2 = ±20%).
    public let jitterRatio: Double

    public init(
        maxAttempts: Int,
        baseDelay: TimeInterval,
        maxDelay: TimeInterval,
        jitterRatio: Double = 0.2
    ) {
        self.maxAttempts = max(1, maxAttempts)
        self.baseDelay = max(0, baseDelay)
        self.maxDelay = max(baseDelay, maxDelay)
        self.jitterRatio = max(0, min(1, jitterRatio))
    }

    /// 3 tentativas, 0.5s base, 4s teto. Adequado pra GET/POST normais.
    public static let standard = RetryPolicy(
        maxAttempts: 3,
        baseDelay: 0.5,
        maxDelay: 4.0
    )

    /// 5 tentativas, 0.25s base, 8s teto. Para operações críticas
    /// (upload de avatar, save de profile) que valem mais paciência.
    public static let aggressive = RetryPolicy(
        maxAttempts: 5,
        baseDelay: 0.25,
        maxDelay: 8.0
    )

    /// No-op pattern: 1 tentativa, retorna o primeiro erro. Útil em
    /// testes pra desligar retry sem mudar call site.
    public static let none = RetryPolicy(
        maxAttempts: 1,
        baseDelay: 0,
        maxDelay: 0,
        jitterRatio: 0
    )

    /// Delay calculado pra um attempt específico (1-indexed).
    /// Exponential: base * 2^(attempt-1), clampado por maxDelay.
    /// Jitter aplicado uniformemente no final.
    public func delay(forAttempt attempt: Int, randomness: () -> Double = { Double.random(in: 0...1) }) -> TimeInterval {
        guard attempt > 1, baseDelay > 0 else { return 0 }
        let exponent = Double(attempt - 1)
        let raw = baseDelay * pow(2.0, exponent)
        let clamped = min(raw, maxDelay)
        guard jitterRatio > 0 else { return clamped }
        // Jitter em ±jitterRatio: multiplicador uniforme em [1 - r, 1 + r]
        let r = randomness()
        let factor = 1.0 + (r * 2.0 - 1.0) * jitterRatio
        return max(0, clamped * factor)
    }
}

// MARK: - Transient detection

/// Detecta erros que indicam falha transiente onde retry vale a pena.
///
/// Cobertura:
/// - URLError de rede (sem conexão, timeout, host inacessível, DNS)
/// - HTTPStatusError (placeholder; Supabase swift lança PostgrestError em
///   alguns casos, vamos checar pelo description quando não der pra
///   inspecionar struct interna).
///
/// NÃO transiente (não retry):
/// - 4xx (cliente errado — query inválida, auth ruim) exceto 429 rate-limit
/// - Parsing/decoding errors
/// - Cancellation
public func isTransientNetworkError(_ error: Error) -> Bool {
    if error is CancellationError { return false }

    if let urlError = error as? URLError {
        switch urlError.code {
        case .notConnectedToInternet,
             .timedOut,
             .networkConnectionLost,
             .cannotConnectToHost,
             .dnsLookupFailed,
             .cannotFindHost,
             .resourceUnavailable,
             .internationalRoamingOff:
            return true
        default:
            return false
        }
    }

    // Fallback heurístico via descrição. Supabase swift às vezes embrulha
    // erros como NSError com message que contém "5xx" ou "429".
    let desc = (error as NSError).localizedDescription.lowercased()
    if desc.contains("timed out") ||
       desc.contains("network connection") ||
       desc.contains("503") ||
       desc.contains("504") ||
       desc.contains("rate limit") ||
       desc.contains("429") {
        return true
    }

    return false
}

// MARK: - withRetry

/// Executa `operation` com retry policy. Retorna o primeiro sucesso ou
/// rethrows o último erro após esgotar tentativas.
///
/// `sleep` injetável pra testes (default: Task.sleep). `isTransient`
/// também injetável pra domain-specific detection.
public func withRetry<T>(
    policy: RetryPolicy = .standard,
    isTransient: (Error) -> Bool = isTransientNetworkError,
    sleep: (TimeInterval) async throws -> Void = { try await Task.sleep(nanoseconds: UInt64($0 * 1_000_000_000)) },
    operation: () async throws -> T
) async throws -> T {
    var lastError: Error?
    for attempt in 1...policy.maxAttempts {
        do {
            return try await operation()
        } catch {
            lastError = error
            // Última tentativa OU erro não-transiente → rethrow imediato
            if attempt == policy.maxAttempts || !isTransient(error) {
                throw error
            }
            let delay = policy.delay(forAttempt: attempt + 1)
            if delay > 0 {
                try await sleep(delay)
            }
        }
    }
    // Tecnicamente inalcançável (loop sempre retorna ou throw),
    // mas Swift exige fallback.
    throw lastError ?? URLError(.unknown)
}

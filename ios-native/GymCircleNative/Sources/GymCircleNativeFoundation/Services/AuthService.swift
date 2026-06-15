import Foundation
import Supabase

public actor AuthService {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    /// Sprint 22.1 — paridade com o web (`packages/core/src/services/auth.ts`):
    /// o usuário pode entrar com **email OU username**. Antes o nativo só
    /// chamava `auth.signIn(email:)`, então quem digitava o handle (a maioria)
    /// recebia "credenciais inválidas" e ficava preso na tela de login.
    ///
    /// Username é resolvido server-side pela Edge Function `login-with-username`
    /// (o e-mail nunca volta pro cliente; anti-enumeração) e a sessão retornada
    /// é aplicada via `setSession`. Email segue o fluxo direto do GoTrue.
    @discardableResult
    public func signIn(identifier: String, password: String) async throws -> Session {
        let cleaned = identifier.trimmingCharacters(in: .whitespacesAndNewlines)
        if AuthService.isEmailIdentifier(cleaned) {
            return try await client.auth.signIn(email: cleaned, password: password)
        }
        return try await signInWithUsername(cleaned, password: password)
    }

    private func signInWithUsername(_ username: String, password: String) async throws -> Session {
        let normalized = AuthService.cleanUsername(username)
        guard normalized.count >= 3 else {
            throw AuthError.invalidCredentials
        }

        let response: LoginWithUsernameResponse
        do {
            response = try await client.functions.invoke(
                "login-with-username",
                options: FunctionInvokeOptions(
                    body: ["username": normalized, "password": password]
                )
            )
        } catch let FunctionsError.httpError(code, _) where code == 400 {
            // 400 = credencial inválida (a função devolve o MESMO erro pra
            // username inexistente e senha errada — sem oráculo de existência).
            throw AuthError.invalidCredentials
        }

        return try await client.auth.setSession(
            accessToken: response.session.accessToken,
            refreshToken: response.session.refreshToken
        )
    }

    public func signOut() async throws {
        try await client.auth.signOut()
    }

    public func currentSession() -> Session? {
        client.auth.currentSession
    }

    public func currentUser() -> User? {
        client.auth.currentUser
    }

    public func restoreSession() async -> Session? {
        if let session = client.auth.currentSession, !session.isExpired {
            return session
        }

        return try? await client.auth.session
    }

    // MARK: - Identifier helpers (espelham o cleanUsername/isEmail do web)

    /// "@dudy" é handle, não e-mail — o `@` só indica e-mail quando vem DEPOIS
    /// da parte local. (Mesmo fix de quirk do `packages/core`: antes "@user"
    /// caía no fluxo de e-mail e falhava sempre.)
    static func isEmailIdentifier(_ value: String) -> Bool {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "^@", with: "", options: .regularExpression)
            .contains("@")
    }

    /// Normaliza o handle igual ao `cleanUsername` do web: minúsculas, sem `@`
    /// inicial e só `[a-z0-9_.]`.
    static func cleanUsername(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "^@", with: "", options: .regularExpression)
            .replacingOccurrences(of: "[^a-z0-9_.]", with: "", options: .regularExpression)
    }
}

/// Resposta da Edge Function `login-with-username` (só os tokens da sessão;
/// o e-mail nunca é exposto). O decoder default do FunctionsClient não
/// converte snake_case, então mapeamos explícito.
private struct LoginWithUsernameResponse: Decodable {
    struct SessionTokens: Decodable {
        let accessToken: String
        let refreshToken: String

        enum CodingKeys: String, CodingKey {
            case accessToken = "access_token"
            case refreshToken = "refresh_token"
        }
    }

    let session: SessionTokens
}

public enum AuthError: LocalizedError {
    case invalidCredentials

    public var errorDescription: String? {
        switch self {
        case .invalidCredentials:
            return "Usuário/email ou senha incorretos."
        }
    }
}

import Foundation
import Supabase

@MainActor
public final class SessionStore: ObservableObject {
    public enum State: Equatable {
        case restoring
        case signedOut
        case signedIn(userId: String)
    }

    @Published public private(set) var state: State = .restoring
    @Published public private(set) var currentUserEmail: String?
    @Published public private(set) var authError: String?

    private let authService: AuthService

    public init(authService: AuthService) {
        self.authService = authService
    }

    public var isAuthenticated: Bool {
        if case .signedIn = state {
            return true
        }
        return false
    }

    public var currentUserId: String? {
        if case .signedIn(let userId) = state {
            return userId
        }
        return nil
    }

    public func restoreSession() async {
        state = .restoring
        authError = nil

        if let session = await authService.restoreSession() {
            apply(session: session)
        } else {
            state = .signedOut
            currentUserEmail = nil
        }
    }

    /// Sprint 22.1 — `identifier` aceita email OU username (o AuthService
    /// resolve via Edge Function quando for handle).
    public func signIn(identifier: String, password: String) async throws {
        authError = nil
        do {
            let session = try await authService.signIn(identifier: identifier, password: password)
            apply(session: session)
        } catch {
            authError = Self.friendlyAuthError(error)
            throw error
        }
    }

    public func signOut() async {
        authError = nil
        do {
            try await authService.signOut()
        } catch {
            authError = Self.friendlyAuthError(error)
        }

        state = .signedOut
        currentUserEmail = nil
    }

    private func apply(session: Session) {
        state = .signedIn(userId: session.user.id.uuidString)
        currentUserEmail = session.user.email
    }

    public static func friendlyAuthError(_ error: Error) -> String {
        // AuthError já vem com mensagem amigável em PT (ex.: username/senha).
        if let authError = error as? AuthError, let description = authError.errorDescription {
            return description
        }
        let message = error.localizedDescription
        if message.localizedCaseInsensitiveContains("invalid") ||
            message.localizedCaseInsensitiveContains("credentials") {
            return "Usuário/email ou senha incorretos."
        }
        if message.localizedCaseInsensitiveContains("network") {
            return "Nao foi possivel conectar. Tente novamente."
        }
        return "Nao foi possivel entrar agora. Tente novamente."
    }
}

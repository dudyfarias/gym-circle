import Foundation
import Supabase

public actor AuthService {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    @discardableResult
    public func signIn(email: String, password: String) async throws -> Session {
        try await client.auth.signIn(email: email, password: password)
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
}

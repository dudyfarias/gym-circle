import Foundation
import Supabase

public final class SupabaseClientProvider: ObservableObject {
    public let client: SupabaseClient

    public init(configuration: AppConfiguration) throws {
        guard let url = URL(string: configuration.supabaseURL) else {
            throw GymCircleNativeError.invalidSupabaseURL
        }

        client = SupabaseClient(
            supabaseURL: url,
            supabaseKey: configuration.supabaseAnonKey
        )
    }

    public static func fromEnvironment() throws -> SupabaseClientProvider {
        guard let configuration = AppConfiguration.fromEnvironment() else {
            throw GymCircleNativeError.missingConfiguration
        }

        return try SupabaseClientProvider(configuration: configuration)
    }
}

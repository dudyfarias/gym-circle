import Foundation

public struct AppConfiguration: Sendable {
    public let supabaseURL: String
    public let supabaseAnonKey: String

    public init(supabaseURL: String, supabaseAnonKey: String) {
        self.supabaseURL = supabaseURL
        self.supabaseAnonKey = supabaseAnonKey
    }

    public static func fromEnvironment() -> AppConfiguration? {
        let environment = ProcessInfo.processInfo.environment
        guard
            let url = environment["SUPABASE_URL"], !url.isEmpty,
            let anonKey = environment["SUPABASE_ANON_KEY"], !anonKey.isEmpty
        else {
            return nil
        }

        return AppConfiguration(supabaseURL: url, supabaseAnonKey: anonKey)
    }
}

public enum GymCircleNativeError: LocalizedError {
    case missingConfiguration
    case invalidSupabaseURL

    public var errorDescription: String? {
        switch self {
        case .missingConfiguration:
            return "Supabase configuration is missing."
        case .invalidSupabaseURL:
            return "Supabase URL is invalid."
        }
    }
}

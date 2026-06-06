import Foundation

public struct AppConfiguration: Sendable {
    public let supabaseURL: String
    public let supabaseAnonKey: String

    public init(supabaseURL: String, supabaseAnonKey: String) {
        self.supabaseURL = supabaseURL
        self.supabaseAnonKey = supabaseAnonKey
    }

    public static func fromEnvironment() -> AppConfiguration? {
        guard
            let url = value(named: "SUPABASE_URL"),
            let anonKey = value(named: "SUPABASE_ANON_KEY")
        else {
            return nil
        }

        return AppConfiguration(supabaseURL: url, supabaseAnonKey: anonKey)
    }

    private static func value(named key: String) -> String? {
        let environment = ProcessInfo.processInfo.environment
        if let value = sanitized(environment[key]) {
            return value
        }

        if let value = Bundle.main.object(forInfoDictionaryKey: key) as? String {
            return sanitized(value)
        }

        return nil
    }

    private static func sanitized(_ value: String?) -> String? {
        guard let value else {
            return nil
        }

        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !trimmed.contains("$(") else {
            return nil
        }

        return trimmed
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

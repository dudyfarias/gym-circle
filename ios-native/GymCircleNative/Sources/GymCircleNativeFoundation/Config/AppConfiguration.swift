import Foundation

public struct AppConfiguration: Sendable {
    public let supabaseURL: String
    public let supabaseAnonKey: String

    public init(supabaseURL: String, supabaseAnonKey: String) {
        self.supabaseURL = supabaseURL
        self.supabaseAnonKey = supabaseAnonKey
    }

    /// Variáveis de ambiente do processo. Só existe em runs DEBUG pelo
    /// Xcode (scheme env vars) e em testes — builds de distribuição NÃO
    /// recebem environment. Mantida como override de desenvolvimento.
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

    /// Sprint 20.0 — caminho de PRODUÇÃO do app standalone: lê do
    /// Info.plist (keys `SupabaseURL`/`SupabaseAnonKey`, injetadas no
    /// build via Config/Shared.xcconfig → Secrets.xcconfig). Sem o
    /// Secrets.xcconfig as keys resolvem pra string vazia ⇒ nil (o app
    /// cai no modo demo em vez de quebrar).
    public static func fromBundle(_ bundle: Bundle = .main) -> AppConfiguration? {
        guard
            let url = bundle.object(forInfoDictionaryKey: "SupabaseURL") as? String,
            let anonKey = bundle.object(forInfoDictionaryKey: "SupabaseAnonKey") as? String
        else {
            return nil
        }

        let trimmedURL = url.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedKey = anonKey.trimmingCharacters(in: .whitespacesAndNewlines)
        // "$(SUPABASE_URL)" não resolvido (build sem xcconfig) também
        // conta como ausente — defensivo contra setups parciais.
        guard
            !trimmedURL.isEmpty, !trimmedURL.hasPrefix("$("),
            !trimmedKey.isEmpty, !trimmedKey.hasPrefix("$(")
        else {
            return nil
        }

        return AppConfiguration(supabaseURL: trimmedURL, supabaseAnonKey: trimmedKey)
    }

    /// Sprint 20.0 — resolução padrão do standalone: env (override de
    /// dev/testes) → bundle (produção) → nil (modo demo).
    public static func resolve(bundle: Bundle = .main) -> AppConfiguration? {
        fromEnvironment() ?? fromBundle(bundle)
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

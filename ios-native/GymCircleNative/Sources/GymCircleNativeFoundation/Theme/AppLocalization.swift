import Foundation
import SwiftUI

/// Idioma escolhido pelo usuário DENTRO do app, independente do iPhone.
/// `.system` = segue o idioma do device (comportamento da 1ª abertura).
public enum AppLanguage: String, CaseIterable, Identifiable, Sendable {
    case system
    case pt
    case en

    public var id: String { rawValue }
}

/// Resolve o idioma efetivo do app. O override é persistido em UserDefaults;
/// sem override (primeira abertura), segue o idioma do iPhone. Os helpers
/// `Loc`/`L10n` leem `AppLocalization.code` em vez de `Locale.current` direto,
/// então a escolha do usuário vale pra TODAS as strings — e o iPhone pode
/// estar num idioma e o app em outro.
public enum AppLocalization {
    static let defaultsKey = "app_language_override"

    /// Override salvo (ou `.system` se o usuário nunca escolheu).
    public static var stored: AppLanguage {
        guard
            let raw = UserDefaults.standard.string(forKey: defaultsKey),
            let language = AppLanguage(rawValue: raw)
        else {
            return .system
        }
        return language
    }

    /// Código efetivo: "pt" ou "en".
    public static var code: String {
        switch stored {
        case .pt: return "pt"
        case .en: return "en"
        case .system: return systemCode()
        }
    }

    public static var isEnglish: Bool { code == "en" }

    /// Idioma do device normalizado: "pt" se for português, senão "en"
    /// (mesma regra que o app já usava antes do seletor).
    static func systemCode() -> String {
        let raw = Locale.current.language.languageCode?.identifier
            ?? String(Locale.current.identifier.prefix(2)).lowercased()
        return raw.hasPrefix("pt") ? "pt" : "en"
    }

    static func persist(_ language: AppLanguage) {
        UserDefaults.standard.set(language.rawValue, forKey: defaultsKey)
    }
}

/// ObservableObject que dispara o re-render da árvore quando o idioma muda.
/// Singleton: o RootView e o SettingsSheet observam o MESMO objeto, então a
/// troca reflete na hora (inclusive na própria tela de Ajustes).
@MainActor
public final class LocalizationStore: ObservableObject {
    public static let shared = LocalizationStore()

    @Published public private(set) var language: AppLanguage

    private init() {
        language = AppLocalization.stored
    }

    /// Locale efetivo pra `.environment(\.locale)` — datas/números seguem o app.
    public var locale: Locale {
        Locale(identifier: AppLocalization.code == "en" ? "en_US" : "pt_BR")
    }

    public func set(_ language: AppLanguage) {
        guard language != self.language else { return }
        AppLocalization.persist(language)
        self.language = language
    }
}

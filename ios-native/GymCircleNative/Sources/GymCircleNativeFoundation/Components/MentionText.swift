import SwiftUI

/// MentionText — paridade web `MentionText`.
///
/// Realça @menções (cor da marca, bold) numa legenda de post ou comentário e as
/// deixa clicáveis; o tap resolve o @username e abre o perfil. Match igual ao
/// web: `@` + 3–32 de `[A-Za-z0-9_.]`. Texto comum segue normal (GCText .body).
///
/// Implementação: AttributedString com `.link` num esquema próprio
/// (`gcmention://username`) + OpenURLAction interceptando o tap inline — jeito
/// nativo de ter trechos clicáveis dentro de um Text.
struct MentionText: View {
    let text: String
    let onTapUsername: (String) -> Void

    private static let mentionRegex = try? NSRegularExpression(
        pattern: "@[a-zA-Z0-9_.]{3,32}"
    )
    private static let baseFont = Font.system(size: 16, design: .default)

    var body: some View {
        Text(attributed)
            .environment(\.openURL, OpenURLAction { url in
                guard url.scheme == "gcmention" else { return .systemAction }
                let username = url.host ?? String(url.absoluteString.dropFirst("gcmention://".count))
                if !username.isEmpty { onTapUsername(username) }
                return .handled
            })
    }

    private var attributed: AttributedString {
        guard let regex = Self.mentionRegex, !text.isEmpty else {
            return plain(text)
        }
        let ns = text as NSString
        var out = AttributedString("")
        var cursor = 0
        for match in regex.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            if match.range.location > cursor {
                let before = ns.substring(with: NSRange(location: cursor, length: match.range.location - cursor))
                out += plain(before)
            }
            out += mentionChunk(ns.substring(with: match.range)) // "@username"
            cursor = match.range.location + match.range.length
        }
        if cursor < ns.length {
            out += plain(ns.substring(from: cursor))
        }
        return out
    }

    private func plain(_ s: String) -> AttributedString {
        var a = AttributedString(s)
        a.font = Self.baseFont
        a.foregroundColor = GymCircleTheme.ColorToken.primaryText
        return a
    }

    private func mentionChunk(_ mention: String) -> AttributedString {
        var a = AttributedString(mention)
        a.font = Self.baseFont.weight(.heavy)
        a.foregroundColor = GymCircleTheme.ColorToken.cyan
        a.link = URL(string: "gcmention://\(mention.dropFirst().lowercased())")
        return a
    }
}

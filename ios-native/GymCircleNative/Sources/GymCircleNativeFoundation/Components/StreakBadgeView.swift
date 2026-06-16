import SwiftUI

/// StreakBadge — paridade do `StreakBadge` web: chip de vidro escuro com um
/// ícone POR NÍVEL (sparkles/chama/escudo/coroa) num anel + "{N}d".
/// Usado nos stories (xs) e no header do post (sm).
public struct StreakBadgeView: View {
    public enum Size { case xs, sm }

    private let streak: Int
    private let size: Size

    public init(streak: Int, size: Size = .sm) {
        self.streak = streak
        self.size = size
    }

    private var level: StreakLevelId { StreakLevel.current(for: streak).id }

    /// Ícone por nível (espelha levelIcon do web).
    private var icon: String {
        switch level {
        case .iniciante: return "sparkles"
        case .consistente: return "flame.fill"
        case .elite: return "shield.fill"
        case .lendario: return "crown.fill"
        }
    }

    /// Cor por nível (rampa de consistência do web: daily/month/mid/year).
    private var tone: Color {
        switch level {
        case .iniciante: return GymCircleTheme.ColorToken.cyan                   // #8cfbff
        case .consistente: return GymCircleTheme.ColorToken.electricBlue         // #30d5ff
        case .elite: return Color(red: 0.0, green: 0.616, blue: 1.0)             // #009dff
        case .lendario: return GymCircleTheme.ColorToken.deepBlue                // #0066ff
        }
    }

    private var ringSize: CGFloat { size == .xs ? 16 : 18 }
    private var iconSize: CGFloat { size == .xs ? 8 : 9 }
    private var textSize: CGFloat { size == .xs ? 9.5 : 11 }

    public var body: some View {
        HStack(spacing: 4) {
            ZStack {
                Circle().fill(Color(red: 0.035, green: 0.043, blue: 0.047)) // #090b0c
                Image(systemName: icon)
                    .font(.system(size: iconSize, weight: .bold))
                    .foregroundStyle(tone)
            }
            .frame(width: ringSize, height: ringSize)
            .overlay(Circle().strokeBorder(tone.opacity(0.65), lineWidth: 1.5))

            Text("\(streak)d")
                .font(.system(size: textSize, weight: .black, design: .default))
                .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
        }
        .padding(.leading, 3)
        .padding(.trailing, 7)
        .padding(.vertical, 2)
        .background(Capsule().fill(Color.white.opacity(0.06)))
        .overlay(Capsule().strokeBorder(Color.white.opacity(0.10), lineWidth: 1))
        .accessibilityLabel(Loc.t("\(streak)-day streak", "\(streak) dias de streak"))
    }
}

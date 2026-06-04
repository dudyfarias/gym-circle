import SwiftUI

// MARK: - BadgeIconNativeView (Sprint 8.2)

/// Renderiza badge icon usando SF Symbol nativo + cor temática.
/// Paridade com BadgeIcon TS (Lucide icons + tinta).
///
/// SF Symbol mapping:
///   trophy   → "trophy.fill"
///   flame    → "flame.fill"
///   calendar → "calendar"
///   users    → "person.2.fill"
///   share    → "square.and.arrow.up"
///   shield   → "shield.fill"
///   sunrise  → "sunrise.fill"
///   moon     → "moon.fill"
///   shuffle  → "shuffle"
///   compass  → "safari.fill"
public struct BadgeIconNativeView: View {
    public let iconKey: BadgeIconKey
    public let earned: Bool
    public let size: CGFloat

    public init(iconKey: BadgeIconKey, earned: Bool = true, size: CGFloat = 28) {
        self.iconKey = iconKey
        self.earned = earned
        self.size = size
    }

    public var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(backgroundColor)

            Image(systemName: sfSymbol)
                .font(.system(size: size * 0.50, weight: .semibold))
                .foregroundColor(foregroundColor)
                .symbolRenderingMode(.hierarchical)
        }
        .frame(width: size, height: size)
    }

    private var sfSymbol: String {
        switch iconKey {
        case .trophy: return "trophy.fill"
        case .flame: return "flame.fill"
        case .calendar: return "calendar"
        case .users: return "person.2.fill"
        case .share: return "square.and.arrow.up.fill"
        case .shield: return "shield.fill"
        case .sunrise: return "sunrise.fill"
        case .moon: return "moon.fill"
        case .shuffle: return "shuffle"
        case .compass: return "safari.fill"
        }
    }

    private var foregroundColor: Color {
        guard earned else {
            return GymCircleTheme.ColorToken.secondaryText.opacity(0.6)
        }
        return tintColor
    }

    private var backgroundColor: Color {
        guard earned else {
            return Color.white.opacity(0.04)
        }
        return tintColor.opacity(0.16)
    }

    /// Cor temática única por iconKey — paridade web ICON_MAP.
    private var tintColor: Color {
        switch iconKey {
        case .trophy: return GymCircleTheme.ColorToken.cyan
        case .flame: return GymCircleTheme.ColorToken.electricBlue
        case .calendar: return GymCircleTheme.ColorToken.deepBlue
        case .users: return Color(red: 0.66, green: 0.55, blue: 0.98)   // purple
        case .share: return Color(red: 0.20, green: 0.83, blue: 0.60)    // green
        case .shield: return Color(red: 0.98, green: 0.75, blue: 0.14)   // gold
        case .sunrise: return Color(red: 0.98, green: 0.57, blue: 0.24)  // orange
        case .moon: return Color(red: 0.51, green: 0.55, blue: 0.97)     // indigo
        case .shuffle: return Color(red: 0.96, green: 0.45, blue: 0.71)  // pink
        case .compass: return Color(red: 0.13, green: 0.83, blue: 0.93)  // cyan-lighter
        }
    }
}

#if DEBUG
struct BadgeIconNativeView_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            HStack(spacing: 12) {
                ForEach([BadgeIconKey.trophy, .flame, .calendar, .users, .share], id: \.self) {
                    BadgeIconNativeView(iconKey: $0, earned: true, size: 44)
                }
            }
            HStack(spacing: 12) {
                ForEach([BadgeIconKey.shield, .sunrise, .moon, .shuffle, .compass], id: \.self) {
                    BadgeIconNativeView(iconKey: $0, earned: true, size: 44)
                }
            }
            HStack(spacing: 12) {
                BadgeIconNativeView(iconKey: .trophy, earned: false, size: 44)
                BadgeIconNativeView(iconKey: .flame, earned: false, size: 44)
            }
        }
        .padding(32)
        .background(Color.black)
        .previewLayout(.sizeThatFits)
    }
}
#endif

import SwiftUI

public struct GCText: View {
    public enum Style {
        case title
        case headline
        case body
        case caption
        case number
    }

    private let text: String
    private let style: Style
    private let color: Color

    public init(_ text: String, style: Style = .body, color: Color = GymCircleTheme.ColorToken.primaryText) {
        self.text = text
        self.style = style
        self.color = color
    }

    public var body: some View {
        Text(text)
            .font(font)
            .fontWeight(weight)
            .foregroundStyle(color)
            .lineLimit(style == .caption ? 2 : nil)
    }

    private var font: Font {
        switch style {
        case .title:
            return .system(size: 28, design: .rounded)
        case .headline:
            return .system(size: 20, design: .rounded)
        case .body:
            return .system(size: 16, design: .rounded)
        case .caption:
            return .system(size: 13, design: .rounded)
        case .number:
            return .system(size: 48, design: .rounded)
        }
    }

    private var weight: Font.Weight {
        switch style {
        case .title, .number:
            return .black
        case .headline:
            return .bold
        case .body:
            return .semibold
        case .caption:
            return .bold
        }
    }
}

public struct GCButton: View {
    private let title: String
    private let systemImage: String?
    private let action: () -> Void

    public init(_ title: String, systemImage: String? = nil, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(title)
            }
            .font(.system(size: 15, weight: .black, design: .rounded))
            .foregroundStyle(Color.black)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(GymCircleTheme.ColorToken.cyan)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

public struct GCCard<Content: View>: View {
    private let content: Content

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        content
            .padding(GymCircleTheme.Spacing.lg)
            .background(GymCircleTheme.ColorToken.card)
            .clipShape(RoundedRectangle(cornerRadius: GymCircleTheme.Radius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: GymCircleTheme.Radius.card, style: .continuous)
                    .stroke(GymCircleTheme.ColorToken.separator, lineWidth: 1)
            }
            .shadow(color: Color.black.opacity(0.42), radius: 24, y: 14)
    }
}

public struct GCGlassPanel<Content: View>: View {
    private let content: Content

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        content
            .padding(GymCircleTheme.Spacing.lg)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: GymCircleTheme.Radius.panel, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: GymCircleTheme.Radius.panel, style: .continuous)
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
            }
    }
}

public struct GCAvatar: View {
    private let url: String?
    private let fallback: String
    private let size: CGFloat

    public init(url: String?, fallback: String, size: CGFloat = 48) {
        self.url = url
        self.fallback = fallback
        self.size = size
    }

    public var body: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [GymCircleTheme.ColorToken.cyan, GymCircleTheme.ColorToken.deepBlue],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            if let url, let imageURL = URL(string: url) {
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    default:
                        fallbackText
                    }
                }
            } else {
                fallbackText
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }

    private var fallbackText: some View {
        Text(String(fallback.prefix(1)).uppercased())
            .font(.system(size: max(14, size * 0.34), weight: .black, design: .rounded))
            .foregroundStyle(Color.black)
    }
}

public struct GCLoadingView: View {
    private let title: String

    public init(_ title: String = "Carregando") {
        self.title = title
    }

    public var body: some View {
        VStack(spacing: 12) {
            ProgressView()
                .tint(GymCircleTheme.ColorToken.cyan)
            GCText(title, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
        }
        .frame(maxWidth: .infinity, minHeight: 160)
    }
}

public struct GCErrorState: View {
    private let title: String
    private let subtitle: String
    private let retryTitle: String?
    private let onRetry: (() -> Void)?

    public init(
        title: String,
        subtitle: String,
        retryTitle: String? = nil,
        onRetry: (() -> Void)? = nil
    ) {
        self.title = title
        self.subtitle = subtitle
        self.retryTitle = retryTitle
        self.onRetry = onRetry
    }

    public var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 30, weight: .bold))
                .foregroundStyle(GymCircleTheme.ColorToken.cyan)

            VStack(spacing: 6) {
                GCText(title, style: .headline)
                GCText(subtitle, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                    .multilineTextAlignment(.center)
            }

            if let retryTitle, let onRetry {
                Button(action: onRetry) {
                    Text(retryTitle)
                        .font(.system(size: 14, weight: .black, design: .rounded))
                        .foregroundStyle(Color.black)
                        .padding(.horizontal, 18)
                        .frame(height: 40)
                        .background(GymCircleTheme.ColorToken.cyan)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 180)
        .padding()
    }
}

public struct GCSkeletonBlock: View {
    private let height: CGFloat
    private let radius: CGFloat

    public init(height: CGFloat, radius: CGFloat = 18) {
        self.height = height
        self.radius = radius
    }

    public var body: some View {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [
                        GymCircleTheme.ColorToken.elevatedCard,
                        GymCircleTheme.ColorToken.card,
                        GymCircleTheme.ColorToken.elevatedCard
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .frame(height: height)
            .redacted(reason: .placeholder)
    }
}

public struct GCEmptyState: View {
    private let title: String
    private let subtitle: String

    public init(title: String, subtitle: String) {
        self.title = title
        self.subtitle = subtitle
    }

    public var body: some View {
        VStack(spacing: 10) {
            GCText(title, style: .headline)
            GCText(subtitle, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, minHeight: 180)
        .padding()
    }
}

import SwiftUI

public struct GCText: View {
    public enum Style {
        case title
        case headline
        case body
        case caption
        case number
        /// Punch-list #1 — section label do web: 11px font-heavy UPPERCASE
        /// tracking 0.8, cor terciária. Usado nos cabeçalhos de seção.
        case sectionLabel
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
        Text(style == .sectionLabel ? text.uppercased() : text)
            .font(font)
            .fontWeight(weight)
            .tracking(style == .sectionLabel ? 0.8 : 0)
            .foregroundStyle(style == .sectionLabel ? GymCircleTheme.ColorToken.tertiaryText : color)
            .lineLimit(style == .caption ? 2 : nil)
    }

    private var font: Font {
        switch style {
        case .title:
            return .system(size: 28, design: .default)
        case .headline:
            return .system(size: 20, design: .default)
        case .body:
            return .system(size: 16, design: .default)
        case .caption:
            return .system(size: 13, design: .default)
        case .number:
            return .system(size: 48, design: .default)
        case .sectionLabel:
            return .system(size: 11, design: .default)
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
        case .sectionLabel:
            return .heavy
        }
    }
}

/// Punch-list #6 — skeleton shimmer (paridade FeedSkeleton web). Barra
/// com gradiente que varre da esquerda pra direita em loop.
public struct GCSkeleton: View {
    private let height: CGFloat
    private let cornerRadius: CGFloat
    @State private var phase: CGFloat = -1

    public init(height: CGFloat = 14, cornerRadius: CGFloat = 8) {
        self.height = height
        self.cornerRadius = cornerRadius
    }

    public var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(GymCircleTheme.ColorToken.elevatedCard)
            .frame(height: height)
            .overlay {
                GeometryReader { geo in
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    .clear,
                                    GymCircleTheme.ColorToken.cyan.opacity(0.14),
                                    .clear,
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .offset(x: phase * geo.size.width)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .onAppear {
                withAnimation(.linear(duration: 1.1).repeatForever(autoreverses: false)) {
                    phase = 1.4
                }
            }
    }
}

/// Skeleton de um card de post do feed (avatar + linhas + mídia).
public struct GCFeedSkeleton: View {
    public init() {}
    public var body: some View {
        VStack(spacing: 20) {
            ForEach(0..<3, id: \.self) { _ in
                VStack(spacing: 0) {
                    HStack(spacing: 12) {
                        Circle()
                            .fill(GymCircleTheme.ColorToken.elevatedCard)
                            .frame(width: 44, height: 44)
                        VStack(alignment: .leading, spacing: 6) {
                            GCSkeleton(height: 12).frame(width: 120)
                            GCSkeleton(height: 10).frame(width: 70)
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    // Mídia edge-to-edge square (paridade card novo).
                    GCSkeleton(height: 320, cornerRadius: 0)
                    GCSkeleton(height: 12)
                        .frame(width: 180)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                }
                .background(GymCircleTheme.ColorToken.postCard)
                .clipShape(RoundedRectangle(cornerRadius: GymCircleTheme.Radius.postCard, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: GymCircleTheme.Radius.postCard, style: .continuous)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
            }
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
            .font(.system(size: 15, weight: .black, design: .default))
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
                // GCRemoteImage: cache memória+disco; cache-hit aparece na hora
                // (sem o "sem foto → pisca → carrega" do AsyncImage cru).
                GCRemoteImage(url: imageURL) { fallbackText }
            } else {
                fallbackText
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }

    private var fallbackText: some View {
        Text(String(fallback.prefix(1)).uppercased())
            .font(.system(size: max(14, size * 0.34), weight: .black, design: .default))
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

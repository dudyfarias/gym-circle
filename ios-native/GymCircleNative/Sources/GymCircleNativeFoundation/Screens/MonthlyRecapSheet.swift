import SwiftUI
import UIKit

/// MonthlyRecapSheet — Sprint 8.13.8 (paridade MonthlyRecapSheet.tsx web).
///
/// Poster compartilhável do recap mensal. Estilo iPhone fitness widget:
///   - Foto cover (escolhida via RecapCoverPickerSheet OU auto-pick) ocupa
///     100% do canvas
///   - Stats overlay top-left: até 4 cards minimalistas verticalmente
///     alinhados (Treinos / Sequência / Tipo+ / Lugar+)
///   - Username pill bottom-right
///   - Botão "Trocar foto" abre RecapCoverPickerSheet
///   - Botão "Compartilhar" renderiza UIImage via ImageRenderer +
///     UIActivityViewController
public struct MonthlyRecapSheet: View {
    public let data: RecapData
    public let onChangeCover: () -> Void
    public let onShare: (UIImage) -> Void
    public let onClose: () -> Void

    public struct RecapData: Sendable {
        public let monthLabel: String       // "Junho 2026"
        public let shortMonthLabel: String  // "Junho" (sem ano)
        public let username: String
        public let displayName: String
        public let coverImageURL: URL?
        public let workoutsCount: Int
        public let bestStreak: Int
        public let topWorkoutType: String?
        public let topGymName: String?
        /// Sprint 9.7.2 — progress dos 3 anéis (0.0..1.0).
        public let weekProgress: Double
        public let monthProgress: Double
        public let yearProgress: Double

        public init(
            monthLabel: String,
            shortMonthLabel: String? = nil,
            username: String,
            displayName: String,
            coverImageURL: URL? = nil,
            workoutsCount: Int,
            bestStreak: Int,
            topWorkoutType: String? = nil,
            topGymName: String? = nil,
            weekProgress: Double = 0,
            monthProgress: Double = 0,
            yearProgress: Double = 0
        ) {
            self.monthLabel = monthLabel
            self.shortMonthLabel = shortMonthLabel ?? monthLabel.split(separator: " ").first.map(String.init) ?? monthLabel
            self.username = username
            self.displayName = displayName
            self.coverImageURL = coverImageURL
            self.workoutsCount = workoutsCount
            self.bestStreak = bestStreak
            self.topWorkoutType = topWorkoutType
            self.topGymName = topGymName
            self.weekProgress = weekProgress
            self.monthProgress = monthProgress
            self.yearProgress = yearProgress
        }
    }

    @State private var sharing: Bool = false

    public init(
        data: RecapData,
        onChangeCover: @escaping () -> Void,
        onShare: @escaping (UIImage) -> Void,
        onClose: @escaping () -> Void
    ) {
        self.data = data
        self.onChangeCover = onChangeCover
        self.onShare = onShare
        self.onClose = onClose
    }

    public var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                header
                Divider().background(Color.white.opacity(0.06))
                ScrollView {
                    VStack(spacing: 14) {
                        posterCanvas
                            .padding(.horizontal, 20)
                            .padding(.top, 16)
                        changeCoverButton
                            .padding(.horizontal, 20)
                        hintText
                            .padding(.horizontal, 20)
                        Spacer(minLength: 24)
                    }
                }
                Divider().background(Color.white.opacity(0.06))
                footerActions
            }
        }
        .accessibilityAddTraits(.isModal)
    }

    // MARK: - Header (Sprint 9.7.2 — eyebrow + title estilo paridade web)

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(L10n.recapEyebrow.string.uppercased())
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(1.2)
                    .foregroundColor(.white.opacity(0.36))
                Text(L10n.recapTitle.string)
                    .font(.system(size: 19, weight: .heavy))
                    .foregroundColor(.white)
            }
            Spacer()
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .heavy))
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(Color.white.opacity(0.06)))
                    .foregroundColor(.white)
            }
            .accessibilityLabel(Text(L10n.commonClose.string))
        }
        .padding(16)
    }

    private var hintText: some View {
        Text(L10n.recapHint.string)
            .font(.system(size: 12, weight: .heavy))
            .foregroundColor(.white.opacity(0.42))
            .multilineTextAlignment(.center)
            .frame(maxWidth: 310)
    }

    private var changeCoverButton: some View {
        Button(action: onChangeCover) {
            HStack(spacing: 6) {
                Image(systemName: "camera.fill")
                    .font(.system(size: 11, weight: .heavy))
                Text(L10n.recapCoverPickerTitle.string)
                    .font(.system(size: 12, weight: .heavy))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Capsule().fill(Color.white.opacity(0.06)))
            .foregroundColor(.white.opacity(0.82))
        }
        .buttonStyle(PressableButtonStyle())
    }

    // MARK: - Poster (renderable)

    /// View pública pra screenshot via ImageRenderer. Aspecto vertical
    /// 4:5 (paridade Insta story aproximada).
    @MainActor
    public var posterCanvas: some View {
        ZStack(alignment: .topLeading) {
            // Background: foto cover ou gradient cyan fallback
            if let coverURL = data.coverImageURL {
                AsyncImage(url: coverURL) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().aspectRatio(contentMode: .fill)
                    default:
                        gradientFallback
                    }
                }
                .aspectRatio(4/5, contentMode: .fill)
                .clipped()
            } else {
                gradientFallback
                    .aspectRatio(4/5, contentMode: .fill)
            }

            // Sprint 9.7.2 — scrim duplo paridade web Sprint 5.5c
            // (top escuro pra stats / meio respirando / bottom escuro pra brand)
            LinearGradient(
                stops: [
                    .init(color: Color.black.opacity(0.62), location: 0),
                    .init(color: Color.black.opacity(0.18), location: 0.45),
                    .init(color: Color.black.opacity(0.16), location: 0.55),
                    .init(color: Color.black.opacity(0.78), location: 1)
                ],
                startPoint: .top,
                endPoint: .bottom
            )

            // Top: stats à esquerda + RecapRings à direita
            HStack(alignment: .top, spacing: 12) {
                statsStack
                Spacer()
                recapRingsView
            }
            .padding(20)

            // Bottom: BrandMark + tagline (esq) + @username pill (dir)
            VStack {
                Spacer()
                HStack(alignment: .bottom) {
                    brandStack
                    Spacer()
                    usernameStack
                }
            }
            .padding(20)
        }
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    // MARK: - Poster components

    // Sprint 9.7.2 — stats agora com Hero treatment + suffix paridade web.
    private var statsStack: some View {
        VStack(alignment: .leading, spacing: 14) {
            // Hero: mês + workout count 44pt brand + "DIAS DE TREINO EM XXX"
            heroStat
            if let type = data.topWorkoutType, !type.isEmpty {
                normalStat(label: L10n.recapStatTopType.string, value: type)
            }
            if let gym = data.topGymName, !gym.isEmpty {
                normalStat(label: L10n.recapStatTopGym.string, value: gym)
            }
            normalStat(label: L10n.recapStatStreak.string, value: "\(data.bestStreak)d")
        }
    }

    private var heroStat: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(data.shortMonthLabel.uppercased())
                .font(.system(size: 11, weight: .heavy))
                .tracking(1.2)
                .foregroundColor(.white.opacity(0.74))
                .shadow(color: .black.opacity(0.72), radius: 4, y: 1)
            Text("\(data.workoutsCount)")
                .font(.system(size: 44, weight: .black))
                .foregroundColor(Color(red: 0.5490, green: 0.9843, blue: 1.0)) // #8CFBFF
                .shadow(color: .black.opacity(0.72), radius: 8, y: 2)
            Text(L10n.recapHeroSuffix.string.uppercased())
                .font(.system(size: 11, weight: .heavy))
                .tracking(0.8)
                .foregroundColor(.white.opacity(0.86))
                .shadow(color: .black.opacity(0.72), radius: 4, y: 1)
        }
    }

    private func normalStat(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .heavy))
                .tracking(0.8)
                .foregroundColor(.white.opacity(0.74))
                .shadow(color: .black.opacity(0.72), radius: 4, y: 1)
            Text(value)
                .font(.system(size: 18, weight: .black))
                .foregroundColor(.white)
                .shadow(color: .black.opacity(0.72), radius: 4, y: 1)
                .lineLimit(1)
        }
    }

    /// Sprint 9.7.2 — 3 anéis aninhados (Apple Fitness idiom).
    private var recapRingsView: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(.black.opacity(0.42))
            ZStack {
                RecapRingArc(progress: data.yearProgress, color: GymCircleTheme.ColorToken.deepBlue, radius: 32, lineWidth: 6)
                RecapRingArc(progress: data.monthProgress, color: GymCircleTheme.ColorToken.electricBlue, radius: 22, lineWidth: 6)
                RecapRingArc(progress: data.weekProgress, color: Color(red: 0.5490, green: 0.9843, blue: 1.0), radius: 12, lineWidth: 6)
            }
            .padding(8)
        }
        .frame(width: 84, height: 84)
    }

    // Sprint 9.7.2 — BrandMark substituto: círculo electric blue com seta interna.
    private var brandStack: some View {
        HStack(spacing: 8) {
            ZStack {
                Circle()
                    .fill(GymCircleTheme.ColorToken.electricBlue)
                    .frame(width: 24, height: 24)
                Image(systemName: "circle.dashed")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundColor(.black)
            }
            Text(L10n.recapTagline.string.uppercased())
                .font(.system(size: 10, weight: .heavy))
                .tracking(1.4)
                .foregroundColor(.white.opacity(0.74))
                .shadow(color: .black.opacity(0.72), radius: 4, y: 1)
        }
    }

    private var usernameStack: some View {
        Text("@\(data.username)")
            .font(.system(size: 10, weight: .heavy))
            .foregroundColor(.white.opacity(0.86))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Capsule().fill(.black.opacity(0.52)))
    }

    private var gradientFallback: some View {
        LinearGradient(
            colors: [
                GymCircleTheme.ColorToken.electricBlue.opacity(0.7),
                Color(red: 0.04, green: 0.08, blue: 0.18)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    // MARK: - Footer — Share (capsule) + Download (circle) — paridade web

    private var footerActions: some View {
        HStack(spacing: 8) {
            // Share principal
            Button(action: { renderAndShare(direct: false) }) {
                HStack(spacing: 8) {
                    if sharing {
                        ProgressView().tint(.black).scaleEffect(0.7)
                    } else {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 14, weight: .heavy))
                    }
                    Text(sharing
                         ? L10n.recapShareGenerating.string
                         : L10n.recapShare.string)
                        .font(.system(size: 13, weight: .heavy))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Capsule().fill(GymCircleTheme.ColorToken.electricBlue.opacity(sharing ? 0.6 : 1.0)))
                .foregroundColor(.black)
            }
            .buttonStyle(PressableButtonStyle())
            .disabled(sharing)
            .accessibilityLabel(Text(L10n.recapShare.string))

            // Download separate (paridade web)
            Button(action: { renderAndShare(direct: true) }) {
                Image(systemName: "arrow.down.to.line")
                    .font(.system(size: 14, weight: .heavy))
                    .frame(width: 48, height: 48)
                    .background(
                        Circle()
                            .fill(Color.white.opacity(0.05))
                            .overlay(Circle().stroke(Color.white.opacity(0.1), lineWidth: 1))
                    )
                    .foregroundColor(.white)
            }
            .buttonStyle(PressableButtonStyle())
            .disabled(sharing)
            .accessibilityLabel(Text(L10n.recapDownload.string))
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
    }

    @MainActor
    private func renderAndShare(direct: Bool) {
        guard !sharing else { return }
        Haptics.impactLight()
        sharing = true
        let renderer = ImageRenderer(content: posterCanvas
            .frame(width: 1080, height: 1350) // 4:5 high-res pra share
        )
        renderer.scale = UIScreen.main.scale
        Task { @MainActor in
            // Pequeno delay pra UI mostrar "Gerando..." (UX feedback)
            try? await Task.sleep(nanoseconds: 200_000_000)
            if let image = renderer.uiImage {
                onShare(image)
            }
            sharing = false
        }
    }
}

/// Sprint 9.7.2 — Ring arc desenhado via Shape Path.
/// Origem topo (12h = -π/2), sentido horário. Paridade web RingArc SVG.
private struct RecapRingArc: View {
    let progress: Double // 0..1
    let color: Color
    let radius: CGFloat
    let lineWidth: CGFloat

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.18), lineWidth: lineWidth)
                .frame(width: radius * 2, height: radius * 2)
            Circle()
                .trim(from: 0, to: min(1, max(0, progress)))
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .frame(width: radius * 2, height: radius * 2)
                .rotationEffect(.degrees(-90))
        }
    }
}

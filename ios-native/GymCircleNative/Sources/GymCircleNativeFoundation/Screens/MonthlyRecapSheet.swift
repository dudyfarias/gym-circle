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
        public let username: String
        public let displayName: String
        public let coverImageURL: URL?
        public let workoutsCount: Int
        public let bestStreak: Int
        public let topWorkoutType: String?
        public let topGymName: String?

        public init(
            monthLabel: String,
            username: String,
            displayName: String,
            coverImageURL: URL? = nil,
            workoutsCount: Int,
            bestStreak: Int,
            topWorkoutType: String? = nil,
            topGymName: String? = nil
        ) {
            self.monthLabel = monthLabel
            self.username = username
            self.displayName = displayName
            self.coverImageURL = coverImageURL
            self.workoutsCount = workoutsCount
            self.bestStreak = bestStreak
            self.topWorkoutType = topWorkoutType
            self.topGymName = topGymName
        }
    }

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
                ScrollView {
                    VStack(spacing: 16) {
                        posterCanvas
                            .padding(.horizontal, 20)
                            .padding(.top, 16)
                        actionButtons
                            .padding(.horizontal, 20)
                            .padding(.top, 8)
                        Spacer(minLength: 24)
                    }
                }
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .heavy))
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Color.white.opacity(0.06)))
                    .foregroundColor(.white)
            }
            Spacer()
            Text(data.monthLabel)
                .font(.system(size: 15, weight: .heavy))
                .foregroundColor(.white)
            Spacer()
            Spacer().frame(width: 36)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
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

            // Scrim sutil pra legibilidade das stats
            LinearGradient(
                colors: [
                    Color.black.opacity(0.6),
                    Color.black.opacity(0.0),
                    Color.black.opacity(0.0),
                    Color.black.opacity(0.5)
                ],
                startPoint: .top,
                endPoint: .bottom
            )

            // Stats top-left
            VStack(alignment: .leading, spacing: 18) {
                Text(data.monthLabel.uppercased())
                    .font(.system(size: 12, weight: .heavy))
                    .tracking(1.2)
                    .foregroundColor(.white.opacity(0.82))

                statCard(
                    label: L10n.recapStatWorkouts.string,
                    value: "\(data.workoutsCount)"
                )
                statCard(
                    label: L10n.recapStatStreak.string,
                    value: "\(data.bestStreak)d"
                )
                if let type = data.topWorkoutType, !type.isEmpty {
                    statCard(
                        label: L10n.recapStatTopType.string,
                        value: type
                    )
                }
                if let gym = data.topGymName, !gym.isEmpty {
                    statCard(
                        label: L10n.recapStatTopGym.string,
                        value: gym
                    )
                }
            }
            .padding(20)

            // Username pill bottom-right
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    Text("@\(data.username)")
                        .font(.system(size: 12, weight: .heavy))
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(Capsule().fill(.black.opacity(0.5)))
                }
            }
            .padding(20)
        }
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    private func statCard(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .heavy))
                .tracking(0.8)
                .foregroundColor(.white.opacity(0.72))
            Text(value)
                .font(.system(size: 28, weight: .black))
                .foregroundColor(.white)
        }
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

    // MARK: - Action buttons

    private var actionButtons: some View {
        VStack(spacing: 10) {
            Button(action: onChangeCover) {
                HStack(spacing: 8) {
                    Image(systemName: "photo")
                        .font(.system(size: 14, weight: .heavy))
                    Text(L10n.recapChangeCover.string)
                        .font(.system(size: 13, weight: .heavy))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Capsule().fill(Color.white.opacity(0.08)))
                .foregroundColor(.white)
            }
            .buttonStyle(.plain)

            Button(action: renderAndShare) {
                HStack(spacing: 8) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 14, weight: .heavy))
                    Text(L10n.recapShare.string)
                        .font(.system(size: 13, weight: .heavy))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Capsule().fill(GymCircleTheme.ColorToken.electricBlue))
                .foregroundColor(.black)
            }
            .buttonStyle(.plain)
        }
    }

    @MainActor
    private func renderAndShare() {
        let renderer = ImageRenderer(content: posterCanvas
            .frame(width: 1080, height: 1350) // 4:5 high-res pra share
        )
        renderer.scale = UIScreen.main.scale
        if let image = renderer.uiImage {
            onShare(image)
        }
    }
}

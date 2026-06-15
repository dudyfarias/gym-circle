import SwiftUI

/// FeaturedAchievementsRowView — Sprint 20.1 (paridade 15.5 web,
/// `FeaturedAchievementsRow.tsx`).
///
/// Row "Conquistas em destaque": header com botão pill cinza (ChevronRight)
/// no canto superior direito que abre o Hall da Fama, + grid de até 3 cards
/// (paleta por kind, mesma do KIND_TONE web). Com lista vazia E onOpenHall
/// presente, a seção continua visível (hint) — a entrada do Hall nunca some.
///
/// Compartilhado: MyCircleView (substitui o badgeHighlight da 5.9) e, na
/// próxima etapa da 20.1, ProfileView migra pra cá (dedup da row local).
public struct FeaturedAchievementsRowView: View {
    public let achievements: [Achievement]
    public let onOpenDetail: ((Achievement) -> Void)?
    public let onOpenHall: (() -> Void)?

    public init(
        achievements: [Achievement],
        onOpenDetail: ((Achievement) -> Void)? = nil,
        onOpenHall: (() -> Void)? = nil
    ) {
        self.achievements = achievements
        self.onOpenDetail = onOpenDetail
        self.onOpenHall = onOpenHall
    }

    public var body: some View {
        if achievements.isEmpty && onOpenHall == nil {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 12) {
                header
                if achievements.isEmpty {
                    emptyHint
                } else {
                    cardsGrid
                }
            }
        }
    }

    private var header: some View {
        HStack {
            GCText(
                L10n.featuredAchievementsTitle.string.uppercased(),
                style: .caption,
                color: GymCircleTheme.ColorToken.secondaryText
            )
            Spacer()
            if let onOpenHall {
                Button(action: onOpenHall) {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.72))
                        .frame(width: 32, height: 32)
                        .background(Circle().fill(Color.white.opacity(0.06)))
                }
                .buttonStyle(PressableButtonStyle())
                .accessibilityLabel(L10n.featuredAchievementsOpenHall.string)
            }
        }
    }

    private var emptyHint: some View {
        GCText(
            L10n.featuredAchievementsEmpty.string,
            style: .caption,
            color: GymCircleTheme.ColorToken.secondaryText
        )
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.white.opacity(0.025))
        )
    }

    private var cardsGrid: some View {
        HStack(spacing: 8) {
            ForEach(achievements.prefix(3)) { achievement in
                card(achievement)
            }
        }
    }

    @ViewBuilder
    private func card(_ achievement: Achievement) -> some View {
        let content = VStack(spacing: 6) {
            AchievementArtifactView(achievement: achievement, size: 36)
            GCText(
                achievement.label,
                style: .caption,
                color: achievement.earned ? .white : Color.white.opacity(0.56)
            )
            .lineLimit(2)
            .multilineTextAlignment(.center)
            .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(1, contentMode: .fit)
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(kindBackground(achievement))
        )

        if let onOpenDetail {
            Button(action: { onOpenDetail(achievement) }) { content }
                .buttonStyle(PressableButtonStyle())
                .accessibilityLabel(achievement.label)
        } else {
            content
        }
    }

    /// Paleta por kind — paridade `KIND_TONE` (FeaturedAchievementsRow.tsx)
    /// via tokens do tema (mesma tabela do featuredCardBackground do
    /// ProfileView, Sprint 8.12.1/9.6.3).
    private func kindBackground(_ a: Achievement) -> Color {
        guard a.earned else { return Color.white.opacity(0.025) }
        switch a.kind {
        case .relic:     return GymCircleTheme.ColorToken.rarityEpic.opacity(0.12)
        case .trophy:    return GymCircleTheme.ColorToken.electricBlue.opacity(0.14)
        case .medal:     return GymCircleTheme.ColorToken.rarityLegendary.opacity(0.14)
        case .badge:     return Color.white.opacity(0.06)
        case .challenge: return GymCircleTheme.ColorToken.rarityUncommon.opacity(0.12)
        }
    }
}

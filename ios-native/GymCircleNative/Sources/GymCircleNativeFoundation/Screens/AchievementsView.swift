import SwiftUI

/// AchievementsView — Hall da Fama estilo Apple Fitness "Prêmios".
///
/// Fase 21 (réplica da Sprint 15 web, SEM os artefatos 3D — os GLB do
/// Rodin entram num passe futuro; artwork atual é o BadgeIconNativeView):
///   - Overview: header "X de Y" + hero "Próximo prêmio" + card destaque
///     com strip de minis + grid 2-col de categorias
///   - Vista de categoria/todos: grid 3-col ordenado earned → progresso →
///     locked, secretos por último (título vira "???" até ganhar)
public struct AchievementsView: View {
    public let achievements: [Achievement]
    public let onTap: (Achievement) -> Void
    public let onClose: () -> Void

    private enum Mode: Equatable {
        case overview
        case all
        case category(AchievementRarity)
    }

    @State private var mode: Mode = .overview

    public init(
        achievements: [Achievement],
        onTap: @escaping (Achievement) -> Void,
        onClose: @escaping () -> Void
    ) {
        self.achievements = achievements
        self.onTap = onTap
        self.onClose = onClose
    }

    private var earnedCount: Int { achievements.filter(\.earned).count }

    private var nextUp: Achievement? {
        AchievementSuggester.nextAchievement(achievements: achievements)
    }

    private var featured: [Achievement] {
        AchievementSuggester.suggestFeatured(achievements: achievements, count: 7)
    }

    public var body: some View {
        ZStack {
            GymCircleTheme.ColorToken.appBackground.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header
                    switch mode {
                    case .overview:
                        overview
                    case .all:
                        gridView(
                            title: Loc.allPrizes,
                            subtitle: Loc.allPrizesSubtitle,
                            items: achievements
                        )
                    case .category(let rarity):
                        gridView(
                            title: Self.rarityTitle(rarity),
                            subtitle: Self.rarityDescription(rarity),
                            items: achievements.filter { Self.rarityOf($0) == rarity }
                        )
                    }
                }
                .padding(20)
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 12) {
            if mode != .overview {
                Button {
                    withAnimation(.easeOut(duration: 0.18)) { mode = .overview }
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                        .padding(8)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Loc.back)
            }
            VStack(alignment: .leading, spacing: 2) {
                GCText(Loc.hallTitle, style: .title)
                GCText(
                    Loc.earnedOf(earnedCount, achievements.count),
                    style: .caption,
                    color: GymCircleTheme.ColorToken.secondaryText
                )
            }
            Spacer()
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                    .padding(9)
                    .background(Circle().fill(GymCircleTheme.ColorToken.elevatedCard))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text(L10n.commonClose.string))
        }
    }

    // MARK: - Overview

    @ViewBuilder
    private var overview: some View {
        if let nextUp {
            heroCard(nextUp)
        }
        if let star = featured.first {
            featuredCard(star)
        }
        categoryGrid
    }

    /// Hero "Próximo prêmio" — o mais perto de desbloquear, com barra.
    private func heroCard(_ achievement: Achievement) -> some View {
        Button {
            onTap(achievement)
        } label: {
            GCCard {
                HStack(spacing: 14) {
                    AchievementArtifactView(achievement: achievement, size: 52, glow: true)
                    VStack(alignment: .leading, spacing: 4) {
                        GCText(Loc.nextPrize, style: .caption, color: GymCircleTheme.ColorToken.cyan)
                        GCText(secretSafeLabel(achievement), style: .headline)
                        if !achievement.secret {
                            GCText(achievement.description, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                                .lineLimit(2)
                        }
                        if let progress = achievement.progress, !achievement.secret {
                            VStack(alignment: .leading, spacing: 4) {
                                GeometryReader { geo in
                                    ZStack(alignment: .leading) {
                                        Capsule().fill(Color.white.opacity(0.1))
                                        Capsule()
                                            .fill(GymCircleTheme.ColorToken.cyan)
                                            .frame(width: geo.size.width * progress.percent)
                                    }
                                }
                                .frame(height: 5)
                                GCText(
                                    Loc.progressOf(progress.current, progress.target),
                                    style: .caption,
                                    color: GymCircleTheme.ColorToken.secondaryText
                                )
                            }
                            .padding(.top, 2)
                        }
                    }
                    Spacer()
                }
            }
        }
        .buttonStyle(PressableButtonStyle())
    }

    /// Destaque grande — melhor conquista earned + strip de minis.
    private func featuredCard(_ star: Achievement) -> some View {
        GCCard {
            VStack(spacing: 14) {
                AchievementArtifactView(achievement: star, size: 96, glow: true)
                    .onTapGesture { onTap(star) }
                GCText(star.label, style: .headline)
                GCText(Loc.featuredOne, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)

                let minis = Array(featured.dropFirst().prefix(3))
                if !minis.isEmpty {
                    HStack(spacing: 16) {
                        ForEach(minis) { mini in
                            Button {
                                onTap(mini)
                            } label: {
                                AchievementArtifactView(achievement: mini, size: 38)
                            }
                            .buttonStyle(.plain)
                        }
                        if earnedCount > 4 {
                            Button {
                                withAnimation(.easeOut(duration: 0.18)) { mode = .all }
                            } label: {
                                GCText("+\(earnedCount - 4)", style: .caption, color: GymCircleTheme.ColorToken.cyan)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 8)
                                    .background(Capsule().fill(GymCircleTheme.ColorToken.elevatedCard))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Button {
                    withAnimation(.easeOut(duration: 0.18)) { mode = .all }
                } label: {
                    GCText(Loc.showAll, style: .caption, color: GymCircleTheme.ColorToken.cyan)
                }
                .buttonStyle(.plain)
            }
            .frame(maxWidth: .infinity)
        }
    }

    /// Grid 2-col por RARIDADE (Sprint 22: mais raro → mais comum).
    private var categoryGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            ForEach(Self.rarityOrder, id: \.self) { rarity in
                categoryCard(rarity)
            }
        }
    }

    private func categoryCard(_ rarity: AchievementRarity) -> some View {
        let items = achievements.filter { Self.rarityOf($0) == rarity }
        let earned = items.filter(\.earned)
        // Melhor earned como capa; sem earned → primeiro item apagado.
        let cover = earned.first ?? items.first

        return Button {
            withAnimation(.easeOut(duration: 0.18)) { mode = .category(rarity) }
        } label: {
            GCCard {
                VStack(alignment: .leading, spacing: 10) {
                    if let cover {
                        AchievementArtifactView(achievement: cover, size: 56)
                    }
                    GCText(Self.rarityTitle(rarity), style: .headline)
                    GCText(
                        Loc.countOf(earned.count, items.count),
                        style: .caption,
                        color: GymCircleTheme.ColorToken.secondaryText
                    )
                    HStack(spacing: 8) {
                        ForEach(Array(earned.prefix(3))) { mini in
                            AchievementArtifactView(achievement: mini, size: 24)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                    }
                    .frame(minHeight: 24)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .buttonStyle(PressableButtonStyle())
    }

    // MARK: - Category / All grid (3-col estilo Apple)

    private func gridView(title: String, subtitle: String, items: [Achievement]) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                GCText(title, style: .title)
                GCText(subtitle, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                GCText(
                    Loc.countOf(items.filter(\.earned).count, items.count),
                    style: .caption,
                    color: GymCircleTheme.ColorToken.secondaryText
                )
            }

            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3),
                spacing: 16
            ) {
                ForEach(Self.sorted(items)) { achievement in
                    Button {
                        onTap(achievement)
                    } label: {
                        VStack(spacing: 6) {
                            AchievementArtifactView(achievement: achievement, size: 56)
                            GCText(secretSafeLabel(achievement), style: .caption)
                                .lineLimit(2)
                                .multilineTextAlignment(.center)
                            GCText(
                                subInfo(achievement),
                                style: .caption,
                                color: GymCircleTheme.ColorToken.secondaryText
                            )
                        }
                        .frame(maxWidth: .infinity)
                        .opacity(achievement.earned ? 1 : 0.55)
                    }
                    .buttonStyle(PressableButtonStyle())
                }
            }
        }
    }

    // MARK: - Helpers

    /// Secreto não-ganho não vaza título (paridade guard da Sprint 15).
    private func secretSafeLabel(_ achievement: Achievement) -> String {
        achievement.secret && !achievement.earned ? "???" : achievement.label
    }

    private func subInfo(_ achievement: Achievement) -> String {
        if achievement.earned { return Loc.earned }
        if achievement.secret { return "???" }
        if let progress = achievement.progress {
            return Loc.progressOf(progress.current, progress.target)
        }
        return Loc.locked
    }

    /// Ordenação Apple: earned primeiro, depois em progresso (% desc),
    /// depois locked; secretos não-ganhos por último.
    static func sorted(_ items: [Achievement]) -> [Achievement] {
        items.sorted { a, b in
            func rank(_ x: Achievement) -> Int {
                if x.earned { return 0 }
                if x.secret { return 3 }
                if (x.progress?.percent ?? 0) > 0 { return 1 }
                return 2
            }
            let ra = rank(a)
            let rb = rank(b)
            if ra != rb { return ra < rb }
            if ra == 1 {
                return (a.progress?.percent ?? 0) > (b.progress?.percent ?? 0)
            }
            return a.label < b.label
        }
    }

    // Sprint 22 — agrupamento por RARIDADE (mais raro → mais comum).
    static let rarityOrder: [AchievementRarity] = [.legendary, .epic, .rare, .uncommon, .common]

    static func rarityOf(_ achievement: Achievement) -> AchievementRarity {
        achievement.rarity ?? .common
    }

    static func rarityTitle(_ rarity: AchievementRarity) -> String {
        switch rarity {
        case .common: return Loc.rarityCommonTitle
        case .uncommon: return Loc.rarityUncommonTitle
        case .rare: return Loc.rarityRareTitle
        case .epic: return Loc.rarityEpicTitle
        case .legendary: return Loc.rarityLegendaryTitle
        }
    }

    static func rarityDescription(_ rarity: AchievementRarity) -> String {
        switch rarity {
        case .common: return Loc.rarityCommonDesc
        case .uncommon: return Loc.rarityUncommonDesc
        case .rare: return Loc.rarityRareDesc
        case .epic: return Loc.rarityEpicDesc
        case .legendary: return Loc.rarityLegendaryDesc
        }
    }
}

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
        case category(AchievementKind)
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
                            title: "Todos os prêmios",
                            subtitle: "Tudo que dá pra conquistar no Gym Circle.",
                            items: achievements
                        )
                    case .category(let kind):
                        gridView(
                            title: Self.kindTitle(kind),
                            subtitle: Self.kindDescription(kind),
                            items: achievements.filter { $0.kind == kind }
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
                .accessibilityLabel("Voltar")
            }
            VStack(alignment: .leading, spacing: 2) {
                GCText("Hall da Fama", style: .title)
                GCText(
                    "\(earnedCount) de \(achievements.count) conquistadas",
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
                    BadgeIconNativeView(
                        iconKey: achievement.iconKey,
                        earned: false,
                        size: 52
                    )
                    VStack(alignment: .leading, spacing: 4) {
                        GCText("PRÓXIMO PRÊMIO", style: .caption, color: GymCircleTheme.ColorToken.cyan)
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
                                    "\(progress.current) de \(progress.target)",
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
                BadgeIconNativeView(iconKey: star.iconKey, earned: true, size: 96)
                    .onTapGesture { onTap(star) }
                GCText(star.label, style: .headline)
                GCText("Sua conquista em destaque", style: .caption, color: GymCircleTheme.ColorToken.secondaryText)

                let minis = Array(featured.dropFirst().prefix(3))
                if !minis.isEmpty {
                    HStack(spacing: 16) {
                        ForEach(minis) { mini in
                            Button {
                                onTap(mini)
                            } label: {
                                BadgeIconNativeView(iconKey: mini.iconKey, earned: true, size: 38)
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
                    GCText("Mostrar tudo", style: .caption, color: GymCircleTheme.ColorToken.cyan)
                }
                .buttonStyle(.plain)
            }
            .frame(maxWidth: .infinity)
        }
    }

    /// Grid 2-col de categorias (paridade Sprint 15: 5 kinds).
    private var categoryGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            ForEach(AchievementKind.allCases, id: \.self) { kind in
                categoryCard(kind)
            }
        }
    }

    private func categoryCard(_ kind: AchievementKind) -> some View {
        let items = achievements.filter { $0.kind == kind }
        let earned = items.filter(\.earned)
        // Melhor earned como capa; sem earned → primeiro item apagado.
        let cover = earned.first ?? items.first

        return Button {
            withAnimation(.easeOut(duration: 0.18)) { mode = .category(kind) }
        } label: {
            GCCard {
                VStack(alignment: .leading, spacing: 10) {
                    if let cover {
                        BadgeIconNativeView(
                            iconKey: cover.iconKey,
                            earned: cover.earned,
                            size: 56
                        )
                    }
                    GCText(Self.kindTitle(kind), style: .headline)
                    GCText(
                        "\(earned.count) de \(items.count)",
                        style: .caption,
                        color: GymCircleTheme.ColorToken.secondaryText
                    )
                    HStack(spacing: 8) {
                        ForEach(Array(earned.prefix(3))) { mini in
                            BadgeIconNativeView(iconKey: mini.iconKey, earned: true, size: 24)
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
                    "\(items.filter(\.earned).count) de \(items.count)",
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
                            BadgeIconNativeView(
                                iconKey: achievement.iconKey,
                                earned: achievement.earned,
                                size: 56
                            )
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
        if achievement.earned { return "Conquistado" }
        if achievement.secret { return "???" }
        if let progress = achievement.progress {
            return "\(progress.current) de \(progress.target)"
        }
        return "Bloqueado"
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

    static func kindTitle(_ kind: AchievementKind) -> String {
        switch kind {
        case .badge: return "Badges"
        case .medal: return "Medalhas"
        case .trophy: return "Troféus"
        case .relic: return "Relíquias"
        case .challenge: return "Desafios"
        }
    }

    static func kindDescription(_ kind: AchievementKind) -> String {
        switch kind {
        case .badge: return "As conquistas de entrada da sua jornada."
        case .medal: return "Marcos históricos de streak e constância."
        case .trophy: return "Feitos sociais e recordes do circle."
        case .relic: return "Raridades míticas — pouquíssimos têm."
        case .challenge: return "Os desafios temáticos de cada mês."
        }
    }
}

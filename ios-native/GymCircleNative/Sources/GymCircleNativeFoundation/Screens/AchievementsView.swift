import SwiftUI

/// AchievementsView — Sprint 8.6 (paridade web Sprint 7.5.4 Hall da Fama).
///
/// Tela completa de conquistas com 6 tabs (Tudo + 5 categorias) + sub-
/// seções por estado (Conquistados / Próximos / Bloqueados).
public struct AchievementsView: View {
    public let achievements: [Achievement]
    public let onTap: (Achievement) -> Void
    public let onClose: () -> Void

    @State private var activeTab: TabKey = .all

    public init(
        achievements: [Achievement],
        onTap: @escaping (Achievement) -> Void,
        onClose: @escaping () -> Void
    ) {
        self.achievements = achievements
        self.onTap = onTap
        self.onClose = onClose
    }

    enum TabKey: Hashable {
        case all
        case kind(AchievementKind)
    }

    private var earnedCount: Int { achievements.filter(\.earned).count }
    private var totalCount: Int { achievements.count }
    private var progressPct: Double {
        totalCount == 0 ? 0 : Double(earnedCount) / Double(totalCount)
    }

    private var filteredByTab: [Achievement] {
        switch activeTab {
        case .all: return achievements
        case .kind(let kind): return achievements.filter { $0.kind == kind }
        }
    }

    private var sections: (earned: [Achievement], next: [Achievement], locked: [Achievement]) {
        let earned = filteredByTab.filter(\.earned)
        let next = filteredByTab.filter { !$0.earned && !$0.secret && $0.progress != nil }
        let locked = filteredByTab.filter { !$0.earned && ($0.secret || $0.progress == nil) }
        return (earned, next, locked)
    }

    public var body: some View {
        // Sprint 9.6.1 — a11y modal trait pra VoiceOver reconhecer overlay.
        accessibleBody
            .accessibilityAddTraits(.isModal)
    }

    private var accessibleBody: some View {
        ZStack(alignment: .top) {
            GymCircleTheme.ColorToken.appBackground.ignoresSafeArea()

            VStack(spacing: 0) {
                header
                progressBar
                tabChips
                Divider().background(Color.white.opacity(0.06))

                ScrollView {
                    VStack(spacing: 24) {
                        if filteredByTab.isEmpty {
                            emptyState
                        } else {
                            sectionGroup(title: L10n.achievementsConquistados.string, items: sections.earned)
                            sectionGroup(title: L10n.achievementsProximos.string, items: sections.next)
                            sectionGroup(title: L10n.achievementsBloqueados.string, items: sections.locked)
                        }
                        Spacer(minLength: 32)
                    }
                    .padding(20)
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
            .accessibilityLabel(Text(L10n.commonClose.string))
            Spacer()
            Text(L10n.achievementsHallFama.string)
                .font(.system(size: 15, weight: .heavy))
                .foregroundColor(.white)
            Spacer()
            Spacer().frame(width: 36)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }

    // MARK: - Progress bar

    private var progressBar: some View {
        VStack(spacing: 8) {
            HStack {
                Text(L10n.achievementsXdeY(earned: earnedCount, total: totalCount).string)
                    .font(.system(size: 13, weight: .heavy))
                    .foregroundColor(.white)
                Spacer()
                Text("\(Int(progressPct * 100))%")
                    .font(.system(size: 11, weight: .heavy))
                    .foregroundColor(.white.opacity(0.52))
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.06))
                    // Sprint 9.7.3 — 3-stop gradient paridade web (#8CFBFF→#30D5FF→#0066FF)
                    Capsule()
                        .fill(LinearGradient(
                            colors: [
                                Color(red: 0.5490, green: 0.9843, blue: 1.0),    // #8CFBFF
                                GymCircleTheme.ColorToken.electricBlue,           // #30D5FF
                                Color(red: 0.0, green: 0.4, blue: 1.0)            // #0066FF
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        ))
                        .frame(width: proxy.size.width * progressPct)
                }
            }
            .frame(height: 6)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 12)
    }

    // MARK: - Tabs

    private var tabChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                tabChip(.all, label: L10n.achievementsTudo.string)
                tabChip(.kind(.badge), label: L10n.achievementsBadges.string)
                tabChip(.kind(.medal), label: L10n.achievementsMedalhas.string)
                tabChip(.kind(.trophy), label: L10n.achievementsTrofeus.string)
                tabChip(.kind(.relic), label: L10n.achievementsReliquias.string)
                tabChip(.kind(.challenge), label: L10n.achievementsDesafios.string)
            }
            .padding(.horizontal, 20)
        }
        .padding(.bottom, 12)
    }

    private func tabChip(_ tab: TabKey, label: String) -> some View {
        let isActive = activeTab == tab
        return Button(action: {
            if !isActive { Haptics.selection() } // Sprint 9.6.2
            activeTab = tab
        }) {
            Text(label.uppercased())
                .font(.system(size: 11, weight: .heavy))
                .tracking(0.6)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    Capsule().fill(isActive ? GymCircleTheme.ColorToken.electricBlue : Color.white.opacity(0.04))
                )
                .foregroundColor(isActive ? .black : .white.opacity(0.68))
        }
        .buttonStyle(PressableButtonStyle())
    }

    // MARK: - Section groups

    @ViewBuilder
    private func sectionGroup(title: String, items: [Achievement]) -> some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("\(title) · \(items.count)".uppercased())
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.6)
                    .foregroundColor(.white.opacity(0.44))

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    ForEach(items) { achievement in
                        achievementCard(achievement)
                    }
                }
            }
        }
    }

    private func achievementCard(_ achievement: Achievement) -> some View {
        Button(action: { onTap(achievement) }) {
            VStack(alignment: .leading, spacing: 8) {
                if achievement.isMysterySecret {
                    ZStack {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Color.white.opacity(0.06))
                            .frame(width: 40, height: 40)
                        Image(systemName: "questionmark")
                            .font(.system(size: 18, weight: .heavy))
                            .foregroundColor(.white.opacity(0.4))
                    }
                } else {
                    BadgeIconNativeView(
                        iconKey: achievement.iconKey,
                        earned: achievement.earned,
                        size: 40
                    )
                }

                // Sprint 9.7.3 — KindBadge chip ao lado do label (paridade web)
                HStack(spacing: 6) {
                    Text(achievement.isMysterySecret ? "???" : achievement.label)
                        .font(.system(size: 13, weight: .heavy))
                        .foregroundColor(achievement.earned ? .white : .white.opacity(0.72))
                        .lineLimit(1)
                    if !achievement.isMysterySecret {
                        kindBadge(achievement.kind)
                    }
                }

                Text(achievement.isMysterySecret ? L10n.detailDescubraDesbloquear.string : achievement.description)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.white.opacity(0.52))
                    .lineLimit(2)

                if let progress = achievement.progress, !achievement.earned, !achievement.isMysterySecret {
                    HStack {
                        Text("\(progress.current)/\(progress.target)")
                            .font(.system(size: 10, weight: .heavy))
                            .foregroundColor(.white.opacity(0.42))
                        Spacer()
                        Text("\(Int(progress.percent * 100))%")
                            .font(.system(size: 10, weight: .heavy))
                            .foregroundColor(.white.opacity(0.42))
                    }
                    GeometryReader { proxy in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.white.opacity(0.06))
                            Capsule()
                                .fill(GymCircleTheme.ColorToken.electricBlue.opacity(0.72))
                                .frame(width: proxy.size.width * progress.percent)
                        }
                    }
                    .frame(height: 4)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(cardBackground(achievement))
            )
        }
        .buttonStyle(PressableButtonStyle())
    }

    private func cardBackground(_ a: Achievement) -> Color {
        if a.isMysterySecret { return Color.white.opacity(0.03) }
        if a.earned { return Color.white.opacity(0.05) }
        return Color.white.opacity(0.025)
    }

    // Sprint 9.7.3 — KindBadge mini-chip por categoria (paridade web KIND_TONE).
    // BADGE = white, MEDAL = gold, TROPHY = brand, RELIC = purple, CHALLENGE = green.
    @ViewBuilder
    private func kindBadge(_ kind: AchievementKind) -> some View {
        let (label, color) = kindBadgeInfo(kind)
        Text(label)
            .font(.system(size: 8.5, weight: .heavy))
            .tracking(0.4)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Capsule().fill(color.opacity(0.16)))
            .foregroundColor(color)
    }

    private func kindBadgeInfo(_ kind: AchievementKind) -> (String, Color) {
        switch kind {
        case .badge:     return (L10n.achievementsBadges.string.uppercased(), Color.white.opacity(0.68))
        case .medal:     return (L10n.achievementsMedalhas.string.uppercased(), GymCircleTheme.ColorToken.rarityLegendary)
        case .trophy:    return (L10n.achievementsTrofeus.string.uppercased(), GymCircleTheme.ColorToken.electricBlue)
        case .relic:     return (L10n.achievementsReliquias.string.uppercased(), GymCircleTheme.ColorToken.rarityEpic)
        case .challenge: return (L10n.achievementsDesafios.string.uppercased(), GymCircleTheme.ColorToken.rarityUncommon)
        }
    }

    // MARK: - Empty

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "trophy")
                .font(.system(size: 32))
                .foregroundColor(.white.opacity(0.32))
            Text(L10n.achievementsVazio.string)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.white.opacity(0.52))
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, 64)
        .frame(maxWidth: .infinity)
    }
}

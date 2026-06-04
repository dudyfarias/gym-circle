import SwiftUI

/// MyCircleView — Sprint 8.2 (paridade web Sprint 7.5).
///
/// Surface principal de progresso + gamification, nativa via SwiftUI.
/// Apresentada via Capacitor Plugin Bridge (Sprint 8.1) ou standalone
/// pelo MainTabView. Sprint 8.3 conecta com API real — por ora consome
/// `MyCircleViewData` que pode vir de `.demo()` ou estado app.
///
/// Estrutura (top → bottom):
///   A. Header — rings + nome + chip nível + chip streak
///   B. Resumo — grid 2x3 com contagens
///   C. Consistência — week/month/year com mini-progress bars
///   D. Calendário mensal — grid 7-col com dias treinados
///   E. Níveis — 4 chips (Iniciante/Consistente/Elite/Lendário)
///   F. Badge highlight — card único + counter "X de Y"
///   G. Monthly Challenges — 4 desafios com progress (Sprint 7.5.6+10)
///   H. Monthly Recap CTA — placeholder (Sprint 8.x)
public struct MyCircleView: View {
    public let data: MyCircleViewData
    public let onClose: (() -> Void)?
    public let onTapBadgeHighlight: (() -> Void)?
    public let onTapChallenge: ((MonthlyChallenge) -> Void)?
    public let onTapRecap: (() -> Void)?

    public init(
        data: MyCircleViewData,
        onClose: (() -> Void)? = nil,
        onTapBadgeHighlight: (() -> Void)? = nil,
        onTapChallenge: ((MonthlyChallenge) -> Void)? = nil,
        onTapRecap: (() -> Void)? = nil
    ) {
        self.data = data
        self.onClose = onClose
        self.onTapBadgeHighlight = onTapBadgeHighlight
        self.onTapChallenge = onTapChallenge
        self.onTapRecap = onTapRecap
    }

    public var body: some View {
        ZStack(alignment: .top) {
            GymCircleTheme.ColorToken.appBackground
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 28) {
                    headerSection
                    summaryGrid
                    consistencySection
                    calendarSection
                    levelsSection
                    if data.isOwn, let badge = data.highlightBadge {
                        badgeHighlightSection(badge: badge)
                    }
                    if data.isOwn, !data.monthlyChallenges.isEmpty {
                        monthlyChallengesSection
                    }
                    if data.isOwn {
                        recapCTASection
                    }
                    Spacer(minLength: 32)
                }
                .padding(.horizontal, 20)
                .padding(.top, 80) // Espaço pra close button overlay
                .padding(.bottom, 24)
            }

            if let onClose {
                closeButtonOverlay(action: onClose)
            }
        }
    }

    // MARK: - A. Header

    private var headerSection: some View {
        VStack(spacing: 12) {
            ActivityRingsView(rings: ConsistencyRings(
                workoutsThisWeek: data.stats.workoutsThisWeek,
                workoutsThisMonth: data.stats.workoutsThisMonth,
                workoutsThisYear: data.stats.workoutsThisYear
            ))
            .frame(width: 130, height: 130)

            VStack(spacing: 4) {
                GCText(data.displayName, style: .title, color: GymCircleTheme.ColorToken.primaryText)
                GCText("@\(data.username)", style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
            }

            HStack(spacing: 8) {
                streakBadge
                levelBadge
            }
        }
    }

    private var streakBadge: some View {
        HStack(spacing: 6) {
            Image(systemName: "flame.fill")
                .font(.system(size: 12, weight: .heavy))
            Text("\(data.stats.currentStreak) dias")
                .font(.system(size: 12, weight: .heavy))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Capsule().fill(GymCircleTheme.ColorToken.electricBlue.opacity(0.16)))
        .foregroundColor(GymCircleTheme.ColorToken.electricBlue)
    }

    private var levelBadge: some View {
        Text(data.currentLevel.shortLabel.uppercased())
            .font(.system(size: 10, weight: .heavy))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Capsule().fill(Color.white.opacity(0.06)))
            .foregroundColor(GymCircleTheme.ColorToken.primaryText.opacity(0.82))
    }

    // MARK: - B. Summary Grid 2x3

    private var summaryGrid: some View {
        LazyVGrid(
            columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)],
            spacing: 8
        ) {
            SummaryStatCardView(label: "Streak atual", value: "\(data.stats.currentStreak)d")
            SummaryStatCardView(label: "Maior streak", value: "\(data.stats.bestStreak)d")
            SummaryStatCardView(label: "Treinos no mês", value: "\(data.stats.workoutsThisMonth)")
            SummaryStatCardView(label: "Dias no ano", value: "\(data.stats.workoutsThisYear)")
            SummaryStatCardView(label: "Conquistas", value: "\(data.earnedCount)")
            SummaryStatCardView(label: "Total", value: "\(data.totalAchievements)")
        }
    }

    // MARK: - C. Consistência

    private var consistencySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Sua Consistência")

            VStack(spacing: 14) {
                RingProgressRowView(
                    label: "Semana",
                    value: "\(data.stats.workoutsThisWeek)/7",
                    progressPercent: Double(data.stats.workoutsThisWeek) / 7.0,
                    color: GymCircleTheme.ColorToken.cyan
                )
                RingProgressRowView(
                    label: "Mês",
                    value: "\(data.stats.workoutsThisMonth)",
                    progressPercent: Double(data.stats.workoutsThisMonth) / 30.0,
                    color: GymCircleTheme.ColorToken.electricBlue
                )
                RingProgressRowView(
                    label: "Ano",
                    value: "\(data.stats.workoutsThisYear)",
                    progressPercent: Double(data.stats.workoutsThisYear) / 365.0,
                    color: GymCircleTheme.ColorToken.deepBlue
                )
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(Color.white.opacity(0.035))
            )
        }
    }

    // MARK: - D. Calendar

    private var calendarSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Calendário do mês")
            MonthlyCalendarGridView(days: data.calendarDays, todayKey: todayKey)
        }
    }

    private var todayKey: String {
        let formatter = ISO8601DateFormatter()
        return String(formatter.string(from: .now).prefix(10))
    }

    // MARK: - E. Levels

    private var levelsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Níveis")

            VStack(spacing: 8) {
                ForEach(data.allLevels) { level in
                    LevelChipView(
                        level: level,
                        isCurrent: level.id == data.currentLevel.id,
                        isPast: data.stats.currentStreak >= level.minDays
                    )
                }
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(Color.white.opacity(0.035))
            )
        }
    }

    // MARK: - F. Badge highlight

    @ViewBuilder
    private func badgeHighlightSection(badge: Achievement) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                sectionTitle("Conquistas")
                Spacer()
                GCText("\(data.earnedCount)/\(data.totalAchievements)", style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
            }

            BadgeHighlightCardView(
                badge: badge,
                isNext: !badge.earned,
                action: { onTapBadgeHighlight?() }
            )
        }
    }

    // MARK: - G. Monthly Challenges

    private var monthlyChallengesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Desafios do mês")

            VStack(spacing: 8) {
                ForEach(data.monthlyChallenges) { challenge in
                    Button(action: { onTapChallenge?(challenge) }) {
                        MonthlyChallengeRowView(challenge: challenge)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - H. Recap CTA

    private var recapCTASection: some View {
        Button(action: { onTapRecap?() }) {
            HStack(spacing: 12) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 18, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .background(
                        Circle().fill(GymCircleTheme.ColorToken.electricBlue.opacity(0.14))
                    )
                    .foregroundColor(GymCircleTheme.ColorToken.electricBlue)

                VStack(alignment: .leading, spacing: 4) {
                    GCText("Compartilhar resumo", style: .body, color: GymCircleTheme.ColorToken.primaryText)
                    GCText("Você escolhe a foto da capa", style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white.opacity(0.42))
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                GymCircleTheme.ColorToken.electricBlue.opacity(0.08),
                                Color.white.opacity(0.02),
                                Color.clear
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Helpers

    private func sectionTitle(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 13, weight: .heavy))
            .tracking(0.6)
            .foregroundColor(GymCircleTheme.ColorToken.secondaryText.opacity(0.7))
    }

    private func closeButtonOverlay(action: @escaping () -> Void) -> some View {
        HStack {
            Spacer()
            Button(action: action) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .heavy))
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Color.white.opacity(0.08)))
                    .foregroundColor(.white)
            }
            .padding(.top, 16)
            .padding(.trailing, 20)
        }
    }
}

#if DEBUG
struct MyCircleView_Previews: PreviewProvider {
    static var previews: some View {
        MyCircleView(
            data: MyCircleViewData.demo(userId: "u1", isOwn: true),
            onClose: {},
            onTapBadgeHighlight: {},
            onTapChallenge: { _ in },
            onTapRecap: {}
        )
        .preferredColorScheme(.dark)
    }
}
#endif

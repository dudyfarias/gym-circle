import SwiftUI

// MARK: - CompetitionSectionView (Sprint 19 — paridade web CompetitionSection)

/// Competição no MyCircle: ranking por pontos, escolhível por escopo
/// (Amigos/Geral) e recorte (Semana/Mês/Ano). Substitui o placeholder
/// "Em breve". Carrega sob demanda via `onLoad` (o pai injeta o AppModel).
public struct CompetitionSectionView: View {
    public let currentUserId: String
    public let onLoad: (RankingScope, RankingPeriod) async -> [CircleRankingRow]

    @State private var scope: RankingScope = .circle
    @State private var period: RankingPeriod = .week
    @State private var rows: [CircleRankingRow] = []
    @State private var loading = false

    public init(
        currentUserId: String,
        onLoad: @escaping (RankingScope, RankingPeriod) async -> [CircleRankingRow]
    ) {
        self.currentUserId = currentUserId
        self.onLoad = onLoad
    }

    private struct Selection: Equatable { let scope: RankingScope; let period: RankingPeriod }

    private var me: CircleRankingRow? { rows.first { $0.userId == currentUserId } }
    private var showEmpty: Bool { !loading && rows.count <= 1 }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label {
                    GCText(Loc.competitionTitle, style: .sectionLabel)
                } icon: {
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                }
                Spacer()
                pills(RankingScope.allCases, selected: scope, label: scopeLabel) { scope = $0 }
            }

            pills(RankingPeriod.allCases, selected: period, label: periodLabel, fullWidth: true) { period = $0 }

            if let me {
                yourPointsCard(me)
            }

            if loading && rows.isEmpty {
                skeleton
            } else if showEmpty {
                GCText(
                    scope == .circle ? Loc.competitionEmptyCircle : Loc.competitionEmptyGlobal,
                    style: .caption,
                    color: GymCircleTheme.ColorToken.secondaryText
                )
                .frame(maxWidth: .infinity)
                .padding(.vertical, 22)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color.white.opacity(0.02))
                )
            } else {
                VStack(spacing: 6) {
                    ForEach(rows) { row in
                        rankingRow(row)
                    }
                }
            }
        }
        .task(id: Selection(scope: scope, period: period)) {
            loading = true
            let result = await onLoad(scope, period)
            rows = result
            loading = false
        }
    }

    // MARK: - Segmented pills

    @ViewBuilder
    private func pills<T: Hashable>(
        _ options: [T],
        selected: T,
        label: @escaping (T) -> String,
        fullWidth: Bool = false,
        onSelect: @escaping (T) -> Void
    ) -> some View {
        HStack(spacing: 4) {
            ForEach(options, id: \.self) { option in
                let active = option == selected
                Button {
                    if !active {
                        Haptics.selection()
                        onSelect(option)
                    }
                } label: {
                    GCText(label(option), style: .caption, color: active ? .black : GymCircleTheme.ColorToken.primaryText)
                        .frame(maxWidth: fullWidth ? .infinity : nil)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            Capsule().fill(active ? GymCircleTheme.ColorToken.cyan : Color.clear)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .frame(maxWidth: fullWidth ? .infinity : nil)
        .background(Capsule().fill(Color.white.opacity(0.05)))
    }

    private func scopeLabel(_ s: RankingScope) -> String {
        s == .circle ? Loc.competitionScopeCircle : Loc.competitionScopeGlobal
    }

    private func periodLabel(_ p: RankingPeriod) -> String {
        switch p {
        case .week: return Loc.competitionPeriodWeek
        case .month: return Loc.competitionPeriodMonth
        case .year: return Loc.competitionPeriodYear
        }
    }

    // MARK: - Your points card

    private func yourPointsCard(_ row: CircleRankingRow) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 2) {
                    GCText(Loc.competitionYourPoints, style: .sectionLabel)
                    GCText("\(row.totalPoints)", style: .title, color: GymCircleTheme.ColorToken.cyan)
                }
                Spacer()
                GCText(Loc.competitionRankBadge(row.rank), style: .caption, color: GymCircleTheme.ColorToken.primaryText)
            }
            HStack(spacing: 8) {
                breakdownCell(row.workoutPoints, Loc.competitionBreakdownWorkouts)
                breakdownCell(row.bonusPoints, Loc.competitionBreakdownBonus)
                breakdownCell(row.achievementPoints, Loc.competitionBreakdownAchievements)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(GymCircleTheme.ColorToken.cyan.opacity(0.06))
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(GymCircleTheme.ColorToken.cyan.opacity(0.24), lineWidth: 1)
                )
        )
    }

    private func breakdownCell(_ value: Int, _ label: String) -> some View {
        VStack(spacing: 2) {
            GCText("\(value)", style: .headline)
            GCText(label, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.white.opacity(0.04)))
    }

    // MARK: - Ranking row

    private func rankingRow(_ row: CircleRankingRow) -> some View {
        let isMe = row.userId == currentUserId
        return HStack(spacing: 12) {
            ZStack {
                Circle().fill(medalBackground(row.rank))
                GCText("\(row.rank)", style: .caption, color: medalForeground(row.rank))
            }
            .frame(width: 28, height: 28)

            avatar(row)

            VStack(alignment: .leading, spacing: 2) {
                GCText(row.name, style: .headline).lineLimit(1)
                HStack(spacing: 4) {
                    Image(systemName: "flame.fill")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(row.badgeIsActiveToday ? GymCircleTheme.ColorToken.pink : GymCircleTheme.ColorToken.secondaryText)
                    GCText(
                        "\(row.currentStreak)d · \(Loc.competitionWorkoutsCount(row.workoutDays))",
                        style: .caption,
                        color: GymCircleTheme.ColorToken.secondaryText
                    )
                }
            }
            Spacer()
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                GCText("\(row.totalPoints)", style: .headline, color: GymCircleTheme.ColorToken.cyan)
                GCText(Loc.competitionPts, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(isMe ? GymCircleTheme.ColorToken.cyan.opacity(0.07) : Color.white.opacity(0.035))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(isMe ? GymCircleTheme.ColorToken.cyan.opacity(0.32) : Color.clear, lineWidth: 1)
                )
        )
    }

    private func avatar(_ row: CircleRankingRow) -> some View {
        Group {
            if let urlString = row.avatarUrl, let url = URL(string: urlString) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    avatarFallback(row.name)
                }
            } else {
                avatarFallback(row.name)
            }
        }
        .frame(width: 36, height: 36)
        .clipShape(Circle())
    }

    private func avatarFallback(_ name: String) -> some View {
        ZStack {
            Circle().fill(Color.white.opacity(0.08))
            GCText(String(name.trimmingCharacters(in: .whitespaces).prefix(1)).uppercased(), style: .caption)
        }
    }

    private func medalBackground(_ rank: Int) -> Color {
        switch rank {
        case 1: return Color(red: 0.98, green: 0.75, blue: 0.14).opacity(0.20)
        case 2: return Color(red: 0.80, green: 0.84, blue: 0.88).opacity(0.20)
        case 3: return Color(red: 0.85, green: 0.47, blue: 0.02).opacity(0.20)
        default: return Color.white.opacity(0.06)
        }
    }

    private func medalForeground(_ rank: Int) -> Color {
        switch rank {
        case 1: return Color(red: 0.98, green: 0.75, blue: 0.14)
        case 2: return Color(red: 0.80, green: 0.84, blue: 0.88)
        case 3: return Color(red: 0.96, green: 0.62, blue: 0.04)
        default: return GymCircleTheme.ColorToken.secondaryText
        }
    }

    // MARK: - Skeleton

    private var skeleton: some View {
        VStack(spacing: 6) {
            ForEach(0..<4, id: \.self) { _ in
                HStack(spacing: 12) {
                    Circle().fill(Color.white.opacity(0.06)).frame(width: 28, height: 28)
                    Circle().fill(Color.white.opacity(0.06)).frame(width: 36, height: 36)
                    Capsule().fill(Color.white.opacity(0.06)).frame(height: 12)
                    Spacer()
                    Capsule().fill(Color.white.opacity(0.06)).frame(width: 32, height: 14)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.white.opacity(0.035)))
            }
        }
    }
}

import SwiftUI

// MARK: - Sprint 8.2 components pro MyCircleView

/// Card de resumo numérico (label + value grande). Usado no grid 2x3
/// "Streak atual / Maior streak / Treinos no mês / Dias no ano / Posts /
/// Restauradores".
public struct SummaryStatCardView: View {
    public let label: String
    public let value: String

    public init(label: String, value: String) {
        self.label = label
        self.value = value
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            GCText(value, style: .title, color: GymCircleTheme.ColorToken.primaryText)
            GCText(label.uppercased(), style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                .lineLimit(1)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white.opacity(0.04))
        )
    }
}

/// Row do anel de consistência (semana / mês / ano) com label, valor
/// e mini progress bar.
public struct RingProgressRowView: View {
    public let label: String
    public let value: String
    public let progressPercent: Double
    public let color: Color

    public init(label: String, value: String, progressPercent: Double, color: Color) {
        self.label = label
        self.value = value
        self.progressPercent = max(0, min(1, progressPercent))
        self.color = color
    }

    public var body: some View {
        VStack(spacing: 6) {
            HStack {
                GCText(label, style: .body, color: GymCircleTheme.ColorToken.primaryText)
                Spacer()
                GCText(value, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.white.opacity(0.06))
                    Capsule()
                        .fill(color)
                        .frame(width: proxy.size.width * progressPercent)
                }
            }
            .frame(height: 8)
        }
    }
}

/// Chip de level (Iniciante / Consistente / Elite / Lendário).
public struct LevelChipView: View {
    public let level: StreakLevel
    public let isCurrent: Bool
    public let isPast: Bool

    public init(level: StreakLevel, isCurrent: Bool, isPast: Bool) {
        self.level = level
        self.isCurrent = isCurrent
        self.isPast = isPast
    }

    public var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(indicatorColor)
                .frame(width: 8, height: 8)

            GCText(level.label, style: .body, color: textColor)

            Spacer()

            GCText(rangeText, style: .caption, color: textColor.opacity(0.7))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(backgroundColor)
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(isCurrent ? GymCircleTheme.ColorToken.electricBlue.opacity(0.4) : Color.clear, lineWidth: 1)
                )
        )
    }

    private var indicatorColor: Color {
        if isCurrent { return GymCircleTheme.ColorToken.electricBlue }
        if isPast { return Color.white.opacity(0.72) }
        return Color.white.opacity(0.24)
    }

    private var textColor: Color {
        if isCurrent { return GymCircleTheme.ColorToken.primaryText }
        if isPast { return GymCircleTheme.ColorToken.primaryText.opacity(0.82) }
        return GymCircleTheme.ColorToken.primaryText.opacity(0.42)
    }

    private var backgroundColor: Color {
        if isCurrent { return GymCircleTheme.ColorToken.electricBlue.opacity(0.12) }
        if isPast { return Color.white.opacity(0.05) }
        return Color.white.opacity(0.025)
    }

    private var rangeText: String {
        if let next = level.nextLevelAt {
            return "\(level.minDays)–\(next - 1)d"
        }
        return "\(level.minDays)d+"
    }
}

/// Card único com badge de destaque (Sprint 7.5.9 redesign). Tap abre
/// AchievementsView (Sprint 8.5).
public struct BadgeHighlightCardView: View {
    public let badge: Achievement
    public let isNext: Bool
    public let action: () -> Void

    public init(badge: Achievement, isNext: Bool = false, action: @escaping () -> Void) {
        self.badge = badge
        self.isNext = isNext
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                BadgeIconNativeView(iconKey: badge.iconKey, earned: badge.earned, size: 56)

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        GCText(badge.label, style: .headline, color: GymCircleTheme.ColorToken.primaryText)
                        statusChip
                    }
                    GCText(badge.description, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                        .lineLimit(2)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white.opacity(0.42))
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(Color.white.opacity(0.035))
                    .overlay(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .stroke(Color.white.opacity(0.06), lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var statusChip: some View {
        let (text, tone) = statusInfo
        Text(text)
            .font(.system(size: 10, weight: .heavy, design: .default))
            .textCase(.uppercase)
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(
                Capsule()
                    .fill(tone.opacity(0.16))
            )
            .foregroundColor(tone)
    }

    private var statusInfo: (String, Color) {
        if badge.earned {
            return ("Conquistado", GymCircleTheme.ColorToken.electricBlue)
        }
        if isNext {
            return ("Próximo", GymCircleTheme.ColorToken.electricBlue.opacity(0.8))
        }
        return ("Bloqueado", Color.white.opacity(0.52))
    }
}

/// Row de monthly challenge (Sprint 7.5.6+10). Suporta secret (mostra ???
/// até completar) e completed (highlight tone + check icon).
public struct MonthlyChallengeRowView: View {
    public let challenge: MonthlyChallenge

    public init(challenge: MonthlyChallenge) {
        self.challenge = challenge
    }

    public var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 12) {
                iconView

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        GCText(displayTitle, style: .body, color: titleColor)
                        difficultyChip
                    }
                    GCText(displayDescription, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                        .lineLimit(1)
                }

                Spacer()

                if !challenge.isMystery {
                    GCText("\(challenge.progress)/\(challenge.goalTarget)", style: .caption, color: GymCircleTheme.ColorToken.primaryText)
                }
            }

            if !challenge.isCompleted, !challenge.isMystery {
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.white.opacity(0.06))
                        Capsule()
                            .fill(difficultyTone.opacity(0.72))
                            .frame(width: proxy.size.width * challenge.progressFraction)
                    }
                }
                .frame(height: 6)
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(challenge.isCompleted ? difficultyTone.opacity(0.08) : Color.white.opacity(0.035))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Color.white.opacity(0.06), lineWidth: 1)
                )
        )
    }

    @ViewBuilder
    private var iconView: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(iconBackground)
                .frame(width: 40, height: 40)

            Image(systemName: iconName)
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(iconForeground)
        }
    }

    private var iconName: String {
        if challenge.isCompleted { return "checkmark" }
        if challenge.isMystery { return "questionmark" }
        return "trophy.fill"
    }

    private var iconForeground: Color {
        if challenge.isCompleted { return difficultyTone }
        if challenge.isMystery { return Color.white.opacity(0.4) }
        return Color.white.opacity(0.64)
    }

    private var iconBackground: Color {
        if challenge.isCompleted { return difficultyTone.opacity(0.20) }
        if challenge.isMystery { return Color.white.opacity(0.04) }
        return Color.white.opacity(0.06)
    }

    private var displayTitle: String {
        challenge.isMystery ? "???" : challenge.title
    }

    private var displayDescription: String {
        challenge.isMystery ? "Desafio secreto — descubra como conquistar." : challenge.description
    }

    private var titleColor: Color {
        challenge.isMystery ? GymCircleTheme.ColorToken.primaryText.opacity(0.56) : GymCircleTheme.ColorToken.primaryText
    }

    @ViewBuilder
    private var difficultyChip: some View {
        Text(difficultyLabel.uppercased())
            .font(.system(size: 9.5, weight: .heavy))
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .background(
                Capsule()
                    .fill(difficultyTone.opacity(0.16))
            )
            .foregroundColor(difficultyTone)
    }

    private var difficultyLabel: String {
        switch challenge.difficulty {
        case .easy: return "Fácil"
        case .medium: return "Médio"
        case .hard: return "Difícil"
        case .legendary: return "Lendário"
        }
    }

    private var difficultyTone: Color {
        switch challenge.difficulty {
        case .easy: return GymCircleTheme.ColorToken.difficultyEasy
        case .medium: return GymCircleTheme.ColorToken.difficultyMedium
        case .hard: return GymCircleTheme.ColorToken.difficultyHard
        case .legendary: return GymCircleTheme.ColorToken.difficultyLegendary
        }
    }
}

// MARK: - Mini Calendar Grid (Sprint 8.2)

/// Grid 7-col simplificado do calendário mensal. Sprint 8.x posterior
/// adiciona mini-fotos clickáveis (paridade Sprint 5.8).
public struct MonthlyCalendarGridView: View {
    public let days: [CalendarDay]
    public let todayKey: String

    public init(days: [CalendarDay], todayKey: String) {
        self.days = days
        self.todayKey = todayKey
    }

    private let weekdaysShort = ["S", "T", "Q", "Q", "S", "S", "D"]

    public var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 4) {
                ForEach(weekdaysShort, id: \.self) { day in
                    Text(day)
                        .font(.system(size: 10, weight: .heavy))
                        .foregroundColor(GymCircleTheme.ColorToken.secondaryText.opacity(0.6))
                        .frame(maxWidth: .infinity)
                }
            }

            let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)
            LazyVGrid(columns: columns, spacing: 4) {
                ForEach(leadingBlanks(), id: \.self) { _ in
                    Color.clear.frame(height: 32)
                }
                ForEach(days) { day in
                    dayCell(day)
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color.white.opacity(0.035))
        )
    }

    @ViewBuilder
    private func dayCell(_ day: CalendarDay) -> some View {
        let isToday = day.dateKey == todayKey

        // Sprint 8.13.1 — mini-foto como bg quando há thumbnailURL.
        // Paridade Gym Rats style (web Sprint 5.2).
        ZStack {
            if let thumb = day.thumbnailURL {
                AsyncImage(url: thumb) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().aspectRatio(contentMode: .fill)
                    default:
                        Color.white.opacity(0.04)
                    }
                }
                .frame(height: 32)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(
                    // Scrim gradient pra legibilidade do número
                    LinearGradient(
                        colors: [Color.black.opacity(0.04), Color.black.opacity(0.42)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                )
            } else {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(cellBackground(day))
                    .frame(height: 32)
            }

            // Today highlight ring (sempre, mesmo com foto)
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(isToday ? GymCircleTheme.ColorToken.electricBlue.opacity(0.72) : Color.clear, lineWidth: 2)
                .frame(height: 32)

            Text("\(day.day)")
                .font(.system(size: 11, weight: .heavy))
                .foregroundColor(cellForeground(day))
                .shadow(color: day.thumbnailURL != nil ? .black.opacity(0.6) : .clear, radius: 1.5, y: 1)
        }
    }

    private func cellBackground(_ day: CalendarDay) -> Color {
        if day.trained { return GymCircleTheme.ColorToken.electricBlue.opacity(0.22) }
        return Color.white.opacity(0.04)
    }

    private func cellForeground(_ day: CalendarDay) -> Color {
        // Com foto: texto branco com shadow
        if day.thumbnailURL != nil { return .white }
        if day.trained { return GymCircleTheme.ColorToken.electricBlue }
        return Color.white.opacity(0.36)
    }

    /// Quantidade de blanks no início pra alinhar o dia 1 com seu weekday.
    /// Base segunda-feira (S=0).
    private func leadingBlanks() -> [Int] {
        guard let first = days.first else { return [] }
        let parts = first.dateKey.split(separator: "-")
        guard parts.count == 3,
              let year = Int(parts[0]),
              let month = Int(parts[1]),
              let day = Int(parts[2]) else { return [] }

        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = day
        var calendar = Calendar(identifier: .gregorian)
        if let tz = TimeZone(identifier: "America/Sao_Paulo") {
            calendar.timeZone = tz
        }
        guard let date = calendar.date(from: components) else { return [] }
        let weekday = calendar.component(.weekday, from: date) // 1=Sunday
        // Converte pra base segunda (0=Mon, 6=Sun)
        let monBased = (weekday + 5) % 7
        return Array(0..<monBased)
    }
}

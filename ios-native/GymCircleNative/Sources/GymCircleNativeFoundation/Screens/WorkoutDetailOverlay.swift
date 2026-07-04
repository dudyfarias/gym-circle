import SwiftUI

/// Detalhe do treino (estilo Apple Atividades) — aberto ao tocar no
/// cabeçalho/stats de uma entrada de atividade no feed. Mostra o que temos
/// (grid de métricas coloridas + mini-mapa da rota); parciais/segmentos/
/// gráfico de FC ficam de fora (não gravamos série temporal).
public struct WorkoutDetailOverlay: View {
    private let activity: FeedActivity
    private let onClose: () -> Void

    public init(activity: FeedActivity, onClose: @escaping () -> Void) {
        self.activity = activity
        self.onClose = onClose
    }

    // Paleta Apple Atividades (números coloridos por métrica).
    private enum Tone {
        static let time = Color(red: 1.0, green: 0.84, blue: 0.04)      // amarelo
        static let distance = Color(red: 0.20, green: 0.78, blue: 1.0)  // azul
        static let calories = Color(red: 1.0, green: 0.22, blue: 0.37)  // rosa
        static let pace = GymCircleTheme.ColorToken.cyan
        static let heart = Color(red: 1.0, green: 0.27, blue: 0.23)     // laranja/vermelho
        static let elevation = Color(red: 0.30, green: 0.85, blue: 0.39) // verde
    }

    private var kind: WorkoutActivityKind {
        WorkoutActivityKind(rawValue: activity.activityType) ?? .other
    }

    private var paceSecPerKm: Int? {
        guard let distance = activity.distanceM, distance > 50 else { return nil }
        let seconds = Double(activity.movingS ?? activity.elapsedS)
        guard seconds > 0 else { return nil }
        return Int((seconds / (distance / 1000)).rounded())
    }

    /// Ritmo estilo Apple "38'10''/km".
    private func appleePace(_ secPerKm: Int) -> String {
        "\(secPerKm / 60)'" + String(format: "%02d", secPerKm % 60) + "''/km"
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header
                    detailsSection
                    if let route = activity.route, route.count >= 2 {
                        mapSection(route: route)
                    }
                    if let caption = activity.caption, !caption.isEmpty {
                        Text(caption)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.white.opacity(0.8))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(20)
            }
            .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle(activity.longDateLabel)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        onClose()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color.white.opacity(0.82))
                            .frame(width: 32, height: 32)
                            .background(Circle().fill(Color.white.opacity(0.08)))
                    }
                    .accessibilityLabel(Loc.close)
                }
            }
        }
    }

    // MARK: - Header (ícone + tipo + horário + local)

    private var header: some View {
        HStack(spacing: 14) {
            Image(systemName: kind.icon)
                .font(.system(size: 26, weight: .bold))
                .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                .frame(width: 64, height: 64)
                .background(Circle().fill(GymCircleTheme.ColorToken.cyan.opacity(0.14)))
            VStack(alignment: .leading, spacing: 3) {
                Text(kind.label)
                    .font(.system(size: 22, weight: .black))
                    .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                if !activity.timeRangeLabel.isEmpty {
                    Text(activity.timeRangeLabel)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.white.opacity(0.5))
                }
                if let location = activity.locationLabel {
                    HStack(spacing: 4) {
                        Image(systemName: "location.fill")
                            .font(.system(size: 10, weight: .bold))
                        Text(location)
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundStyle(Color.white.opacity(0.5))
                }
            }
            Spacer(minLength: 0)
        }
    }

    // MARK: - Grid de métricas (estilo "Detalhes do Exercício")

    private struct Stat: Identifiable {
        let id = UUID()
        let label: String
        let value: String
        let color: Color
    }

    private var stats: [Stat] {
        var out: [Stat] = []
        if let moving = activity.movingS, moving > 0 {
            out.append(Stat(label: Loc.t("Workout Time", "Tempo de Exercício"),
                            value: gymCircleFormatElapsed(moving), color: Tone.time))
        }
        out.append(Stat(label: Loc.t("Duration", "Duração"),
                        value: gymCircleFormatElapsed(activity.elapsedS), color: Tone.time))
        if let distance = activity.distanceM, distance > 0 {
            out.append(Stat(label: Loc.t("Distance", "Distância"),
                            value: gymCircleFormatKm(distance), color: Tone.distance))
        }
        if let active = activity.activeCalories {
            out.append(Stat(label: Loc.t("Active Calories", "Calorias Ativas"),
                            value: "\(Int(active.rounded())) cal", color: Tone.calories))
        }
        if let total = activity.totalCalories {
            out.append(Stat(label: Loc.t("Total Calories", "Total de Calorias"),
                            value: "\(Int(total.rounded())) cal", color: Tone.calories))
        }
        if let pace = paceSecPerKm {
            out.append(Stat(label: Loc.t("Avg. Pace", "Ritmo Médio"),
                            value: appleePace(pace), color: Tone.pace))
        }
        if let gain = activity.elevationGainM, gain >= 1 {
            out.append(Stat(label: Loc.t("Elevation Gain", "Ganho de Elevação"),
                            value: "\(Int(gain.rounded())) m", color: Tone.elevation))
        }
        if let hr = activity.avgHr {
            out.append(Stat(label: Loc.t("Avg. Heart Rate", "Batimentos Médios"),
                            value: "\(hr) bpm", color: Tone.heart))
        }
        return out
    }

    private var detailsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(Loc.t("Workout Details", "Detalhes do Exercício"))
                .font(.system(size: 20, weight: .black))
                .foregroundStyle(GymCircleTheme.ColorToken.primaryText)

            let rows = stride(from: 0, to: stats.count, by: 2).map { i -> [Stat] in
                Array(stats[i..<min(i + 2, stats.count)])
            }
            VStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.offset) { index, pair in
                    HStack(alignment: .top, spacing: 0) {
                        statCell(pair[0])
                        if pair.count > 1 {
                            statCell(pair[1])
                        } else {
                            Color.clear.frame(maxWidth: .infinity)
                        }
                    }
                    .padding(.vertical, 14)
                    if index < rows.count - 1 {
                        Rectangle()
                            .fill(Color.white.opacity(0.07))
                            .frame(height: 1)
                    }
                }
            }
            .padding(.horizontal, 16)
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Color.white.opacity(0.04))
            )
        }
    }

    private func statCell(_ stat: Stat) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(stat.label)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.white.opacity(0.62))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(stat.value)
                .font(.system(size: 26, weight: .heavy, design: .rounded))
                .foregroundStyle(stat.color)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Mapa (sketch da rota)

    private func mapSection(route: [[Double]]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(Loc.t("Map", "Mapa"))
                .font(.system(size: 20, weight: .black))
                .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
            RouteSketchView(points: route)
                .frame(height: 200)
                .frame(maxWidth: .infinity)
                .background(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .fill(GymCircleTheme.ColorToken.cyan.opacity(0.05))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .stroke(GymCircleTheme.ColorToken.cyan.opacity(0.12), lineWidth: 1)
                )
        }
    }
}

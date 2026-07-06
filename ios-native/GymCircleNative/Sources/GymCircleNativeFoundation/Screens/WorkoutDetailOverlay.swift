import SwiftUI
import MapKit

/// Detalhe do treino (estilo Apple Atividades) — aberto ao tocar no
/// cabeçalho/stats de uma entrada de atividade no feed. Mostra o que temos
/// (grid de métricas coloridas + mini-mapa da rota); parciais/segmentos/
/// gráfico de FC ficam de fora (não gravamos série temporal).
public struct WorkoutDetailOverlay: View {
    private let detail: WorkoutDetailData
    private let onClose: () -> Void

    public init(detail: WorkoutDetailData, onClose: @escaping () -> Void) {
        self.detail = detail
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
        WorkoutActivityKind(rawValue: detail.activityType) ?? .other
    }

    private var paceSecPerKm: Int? {
        guard let distance = detail.distanceM, distance > 50 else { return nil }
        let seconds = Double(detail.movingS ?? detail.elapsedS)
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
                    if let sets = detail.strengthSets, !sets.isEmpty {
                        setsSection(sets: sets)
                    }
                    if let route = detail.route, route.count >= 2 {
                        mapSection(route: route)
                    }
                    if let caption = detail.caption, !caption.isEmpty {
                        Text(caption)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.white.opacity(0.8))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(20)
            }
            .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle(detail.longDateLabel)
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
                if !detail.timeRangeLabel.isEmpty {
                    Text(detail.timeRangeLabel)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.white.opacity(0.5))
                }
                if let location = detail.locationLabel {
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
        if let moving = detail.movingS, moving > 0 {
            out.append(Stat(label: Loc.t("Workout Time", "Tempo de Exercício"),
                            value: gymCircleFormatElapsed(moving), color: Tone.time))
        }
        out.append(Stat(label: Loc.t("Duration", "Duração"),
                        value: gymCircleFormatElapsed(detail.elapsedS), color: Tone.time))
        if let distance = detail.distanceM, distance > 0 {
            out.append(Stat(label: Loc.t("Distance", "Distância"),
                            value: gymCircleFormatKm(distance), color: Tone.distance))
        }
        if let active = detail.activeCalories {
            out.append(Stat(label: Loc.t("Active Calories", "Calorias Ativas"),
                            value: "\(Int(active.rounded())) cal", color: Tone.calories))
        }
        if let total = detail.totalCalories {
            out.append(Stat(label: Loc.t("Total Calories", "Total de Calorias"),
                            value: "\(Int(total.rounded())) cal", color: Tone.calories))
        }
        if let pace = paceSecPerKm {
            out.append(Stat(label: Loc.t("Avg. Pace", "Ritmo Médio"),
                            value: appleePace(pace), color: Tone.pace))
        }
        if let gain = detail.elevationGainM, gain >= 1 {
            out.append(Stat(label: Loc.t("Elevation Gain", "Ganho de Elevação"),
                            value: "\(Int(gain.rounded())) m", color: Tone.elevation))
        }
        if let hr = detail.avgHr {
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

    // MARK: - Séries de musculação (só treino de força)

    private func setsSection(sets: [WorkoutStrengthSet]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(Loc.t("Sets", "Séries"))
                .font(.system(size: 20, weight: .black))
                .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
            VStack(spacing: 0) {
                ForEach(Array(sets.enumerated()), id: \.offset) { index, set in
                    VStack(alignment: .leading, spacing: 5) {
                        if let exercise = set.exercise,
                           index == 0 || sets[index - 1].exercise != exercise {
                            Text(exercise)
                                .font(.system(size: 14.5, weight: .black))
                                .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                                .padding(.top, index == 0 ? 0 : 8)
                        }
                        HStack {
                            let number = Self.setNumber(at: index, in: sets)
                            Text(Loc.t("Set \(number)", "Série \(number)"))
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.white.opacity(0.62))
                            Spacer()
                            Text(Self.setLabel(set))
                                .font(.system(size: 15, weight: .heavy, design: .rounded))
                                .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                        }
                    }
                    .padding(.vertical, 12)
                    if index < sets.count - 1 {
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

    static func setLabel(_ set: WorkoutStrengthSet) -> String {
        let reps = "\(set.reps) reps"
        guard let weight = set.weightKg else {
            return "\(reps) · " + Loc.t("bodyweight", "peso do corpo")
        }
        let weightStr = weight == weight.rounded()
            ? String(Int(weight))
            : String(format: "%.1f", weight)
        return "\(reps) · \(weightStr) kg"
    }

    private static func setNumber(
        at index: Int,
        in sets: [WorkoutStrengthSet]
    ) -> Int {
        guard index > 0 else { return 1 }
        let exercise = sets[index].exercise
        var count = 1
        var cursor = index - 1
        while cursor >= 0, sets[cursor].exercise == exercise {
            count += 1
            cursor -= 1
        }
        return count
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

    // MARK: - Mapa geográfico da rota

    private func mapSection(route: [[Double]]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(Loc.t("Map", "Mapa"))
                .font(.system(size: 20, weight: .black))
                .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
            WorkoutRouteMapView(points: route)
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

private struct WorkoutRouteMapView: UIViewRepresentable {
    let points: [[Double]]

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView(frame: .zero)
        map.delegate = context.coordinator
        map.overrideUserInterfaceStyle = .dark
        map.isRotateEnabled = false
        map.pointOfInterestFilter = .excludingAll
        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        let coordinates = points.compactMap { point -> CLLocationCoordinate2D? in
            guard point.count >= 2,
                  (-90...90).contains(point[0]),
                  (-180...180).contains(point[1]) else { return nil }
            return CLLocationCoordinate2D(latitude: point[0], longitude: point[1])
        }
        guard coordinates.count >= 2 else { return }

        map.removeOverlays(map.overlays)
        map.removeAnnotations(map.annotations)

        let polyline = MKPolyline(coordinates: coordinates, count: coordinates.count)
        map.addOverlay(polyline)

        let start = MKPointAnnotation()
        start.coordinate = coordinates[0]
        start.title = "start"
        let end = MKPointAnnotation()
        end.coordinate = coordinates[coordinates.count - 1]
        end.title = "end"
        map.addAnnotations([start, end])

        map.setVisibleMapRect(
            polyline.boundingMapRect,
            edgePadding: UIEdgeInsets(top: 34, left: 34, bottom: 34, right: 34),
            animated: false
        )
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            guard let polyline = overlay as? MKPolyline else {
                return MKOverlayRenderer(overlay: overlay)
            }
            let renderer = MKPolylineRenderer(polyline: polyline)
            renderer.strokeColor = UIColor(
                red: 0.20,
                green: 0.78,
                blue: 1.0,
                alpha: 1
            )
            renderer.lineWidth = 5
            renderer.lineCap = .round
            renderer.lineJoin = .round
            return renderer
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            let identifier = "WorkoutRouteEndpoint"
            let view = mapView.dequeueReusableAnnotationView(withIdentifier: identifier)
                ?? MKMarkerAnnotationView(annotation: annotation, reuseIdentifier: identifier)
            view.annotation = annotation
            guard let marker = view as? MKMarkerAnnotationView else { return view }
            marker.glyphImage = UIImage(systemName: annotation.title == "start" ? "figure.walk" : "flag.fill")
            marker.markerTintColor = annotation.title == "start"
                ? UIColor(red: 0.20, green: 0.78, blue: 1.0, alpha: 1)
                : .white
            marker.glyphTintColor = .black
            marker.displayPriority = .required
            return marker
        }
    }
}

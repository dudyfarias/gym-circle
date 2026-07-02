import SwiftUI

/// Buscador de academia (paridade web `GymSearchSheet`): busca por nome +
/// "usar minha localização" (academias cadastradas próximas + lugares do Apple
/// Maps pra cadastrar) + ÚLTIMAS USADAS. Retorna o GymOption via `onSelect`.
/// Reaproveita a mesma lógica do CheckInView (locate/nearby/catalog).
public struct NativeGymSearchSheet: View {
    @ObservedObject private var model: GymCircleAppModel
    private let onSelect: (GymOption) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var results: [GymOption] = []
    @State private var mapResults: [NativePlaceCandidate] = []
    @State private var recent: [GymOption] = []
    @State private var nearbyGyms: [GymOption] = []
    @State private var nearbyPlaces: [NativePlaceCandidate] = []
    @State private var isLocating = false
    @State private var feedback: String?
    @State private var searchTask: Task<Void, Never>?

    public init(model: GymCircleAppModel, onSelect: @escaping (GymOption) -> Void) {
        self.model = model
        self.onSelect = onSelect
    }

    private var isSearching: Bool {
        query.trimmingCharacters(in: .whitespaces).count >= 2
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    searchField
                    locationButton
                    if let feedback {
                        GCText(feedback, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                    }

                    if isSearching {
                        gymsSection(
                            Loc.t("Results", "Resultados"),
                            gyms: results,
                            emptyHint: Loc.t("Nothing found.", "Nada encontrado.")
                        )
                        if !mapResults.isEmpty {
                            placesSection(
                                Loc.t("New places from Apple Maps", "Novos lugares do Apple Maps"),
                                places: mapResults
                            )
                        }
                    } else {
                        if !recent.isEmpty {
                            gymsSection(Loc.t("Recent", "Recentes"), gyms: recent)
                        }
                        if !nearbyGyms.isEmpty {
                            gymsSection(Loc.registeredGymsNearby, gyms: nearbyGyms)
                        }
                        if !nearbyPlaces.isEmpty {
                            placesSection("Apple Maps", places: nearbyPlaces)
                        }
                    }
                }
                .padding(20)
            }
            .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle(Loc.t("Find gym", "Buscar academia"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(Loc.close) { dismiss() }
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                }
            }
        }
        .preferredColorScheme(.dark)
        .task {
            if recent.isEmpty { recent = await model.recentGyms() }
        }
        .onChange(of: query) { value in
            searchTask?.cancel()
            searchTask = Task {
                try? await Task.sleep(nanoseconds: 300_000_000)
                guard !Task.isCancelled else { return }
                let q = value.trimmingCharacters(in: .whitespaces)
                guard q.count >= 2 else {
                    results = []
                    mapResults = []
                    return
                }
                async let saved = model.searchGyms(query: q)
                async let apple = AppleMapsLocationProvider.shared.searchPlaces(
                    query: q,
                    near: nil
                )
                results = await saved
                mapResults = (try? await apple) ?? []
            }
        }
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
            TextField(Loc.gymNamePlaceholder, text: $query)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(GymCircleTheme.ColorToken.elevatedCard)
        )
    }

    private var locationButton: some View {
        Button { Task { await locateNearby() } } label: {
            HStack(spacing: 10) {
                Image(systemName: "location.fill")
                Text(isLocating ? Loc.searchingNearby : Loc.useMyLocation)
                    .fontWeight(.bold)
                Spacer()
                if isLocating { ProgressView().tint(GymCircleTheme.ColorToken.cyan) }
            }
            .foregroundStyle(GymCircleTheme.ColorToken.cyan)
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(GymCircleTheme.ColorToken.elevatedCard)
            )
        }
        .buttonStyle(.plain)
        .disabled(isLocating)
    }

    @ViewBuilder
    private func gymsSection(_ title: String, gyms: [GymOption], emptyHint: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            GCText(title, style: .sectionLabel)
            if gyms.isEmpty, let emptyHint {
                GCText(emptyHint, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
            } else {
                ForEach(gyms) { gym in gymRow(gym) }
            }
        }
    }

    private func placesSection(
        _ title: String,
        places: [NativePlaceCandidate]
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            GCText(title, style: .sectionLabel)
            ForEach(places.prefix(8)) { place in
                Button { Task { await selectPlace(place) } } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "mappin.circle")
                            .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                        VStack(alignment: .leading, spacing: 2) {
                            GCText(place.name, style: .body)
                            if !place.subtitle.isEmpty {
                                GCText(place.subtitle, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                            }
                        }
                        Spacer()
                        GCText(Loc.register, style: .caption, color: GymCircleTheme.ColorToken.cyan)
                    }
                    .padding(.vertical, 8)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func gymRow(_ gym: GymOption) -> some View {
        Button {
            onSelect(gym)
            Haptics.selection()
            dismiss()
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "mappin.circle.fill")
                    .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                VStack(alignment: .leading, spacing: 2) {
                    GCText(gym.name, style: .body)
                    if !gym.subtitle.isEmpty {
                        GCText(gym.subtitle, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                    }
                }
                Spacer()
            }
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
    }

    private func locateNearby() async {
        isLocating = true
        feedback = nil
        defer { isLocating = false }
        do {
            let coordinate = try await AppleMapsLocationProvider.shared.currentPosition()
            async let dbGyms = model.nearbyGyms(coordinate: coordinate)
            async let mapPlaces = AppleMapsLocationProvider.shared.nearbyPlaces(near: coordinate)
            nearbyGyms = await dbGyms
            nearbyPlaces = (try? await mapPlaces) ?? []
            if nearbyGyms.isEmpty && nearbyPlaces.isEmpty { feedback = Loc.noNearbyGyms }
        } catch {
            Haptics.error()
            feedback = Loc.locationDenied
        }
    }

    private func selectPlace(_ place: NativePlaceCandidate) async {
        feedback = nil
        if let gym = await model.catalogPlace(place) {
            onSelect(gym)
            Haptics.selection()
            dismiss()
        } else {
            feedback = model.error ?? Loc.couldNotRegisterPlace
        }
    }
}

import SwiftUI

public struct CheckInView: View {
    @ObservedObject private var model: GymCircleAppModel

    @State private var query = ""
    @State private var results: [GymOption] = []
    @State private var nearbyGyms: [GymOption] = []
    @State private var nearbyPlaces: [NativePlaceCandidate] = []
    @State private var selectedGym: GymOption?
    @State private var isLocating = false
    @State private var isCheckingIn = false
    @State private var feedback: String?
    @State private var searchTask: Task<Void, Never>?

    public init(model: GymCircleAppModel) {
        self.model = model
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                selectedSection
                searchSection
                nearbySection
                if let feedback {
                    GCText(feedback, style: .caption, color: GymCircleTheme.ColorToken.cyan)
                }
            }
            .padding(20)
        }
        .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
        .navigationTitle("Check-in")
        .onChange(of: query) { value in
            searchTask?.cancel()
            searchTask = Task {
                try? await Task.sleep(nanoseconds: 300_000_000)
                guard !Task.isCancelled else { return }
                results = await model.searchGyms(query: value)
            }
        }
    }

    private var header: some View {
        GCGlassPanel {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 10) {
                    Image(systemName: "mappin.and.ellipse")
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                    GCText("Marque onde voce treinou", style: .headline)
                }
                GCText(
                    "Use uma academia cadastrada ou encontre lugares próximos pelo Apple Maps.",
                    style: .caption,
                    color: GymCircleTheme.ColorToken.secondaryText
                )
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private var selectedSection: some View {
        if let selectedGym {
            GCCard {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            GCText(selectedGym.name, style: .headline)
                            if !selectedGym.subtitle.isEmpty {
                                GCText(selectedGym.subtitle, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                            }
                        }
                        Spacer()
                        Button {
                            self.selectedGym = nil
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                        }
                        .buttonStyle(.plain)
                    }

                    Button {
                        Task { await submitCheckIn() }
                    } label: {
                        HStack {
                            if isCheckingIn {
                                ProgressView().tint(.black)
                            } else {
                                Image(systemName: "checkmark.circle.fill")
                                Text("Confirmar check-in")
                                    .fontWeight(.black)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(GymCircleTheme.ColorToken.cyan)
                        )
                        .foregroundStyle(.black)
                    }
                    .buttonStyle(.plain)
                    .disabled(isCheckingIn)
                }
            }
        }
    }

    private var searchSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            GCText("Buscar academia", style: .headline)
            TextField("Nome da academia", text: $query)
                .textInputAutocapitalization(.words)
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(GymCircleTheme.ColorToken.elevatedCard)
                )

            ForEach(results.prefix(8)) { gym in
                gymRow(gym)
            }
        }
    }

    private var nearbySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                Task { await locateNearby() }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "location.fill")
                    Text(isLocating ? "Buscando perto de você..." : "Usar minha localização")
                        .fontWeight(.bold)
                    Spacer()
                    if isLocating {
                        ProgressView().tint(GymCircleTheme.ColorToken.cyan)
                    }
                }
                .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                .padding(14)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(GymCircleTheme.ColorToken.elevatedCard)
                )
            }
            .buttonStyle(.plain)
            .disabled(isLocating)

            if !nearbyGyms.isEmpty {
                GCText("Academias cadastradas perto de você", style: .headline)
                ForEach(nearbyGyms.prefix(6)) { gym in
                    gymRow(gym)
                }
            }

            if !nearbyPlaces.isEmpty {
                GCText("Apple Maps", style: .headline)
                ForEach(nearbyPlaces.prefix(6)) { place in
                    Button {
                        Task { await catalogAndSelect(place) }
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                GCText(place.name, style: .body)
                                if !place.subtitle.isEmpty {
                                    GCText(place.subtitle, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                                }
                            }
                            Spacer()
                            GCText("Cadastrar", style: .caption, color: GymCircleTheme.ColorToken.cyan)
                        }
                        .padding(.vertical, 7)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func gymRow(_ gym: GymOption) -> some View {
        Button {
            selectedGym = gym
            Haptics.selection()
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    GCText(gym.name, style: .body)
                    if !gym.subtitle.isEmpty {
                        GCText(gym.subtitle, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                    }
                }
                Spacer()
            }
            .padding(.vertical, 7)
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
            if nearbyGyms.isEmpty && nearbyPlaces.isEmpty {
                feedback = "Não encontramos academias próximas. Tente buscar pelo nome."
            }
        } catch {
            Haptics.error()
            feedback = "Não foi possível acessar sua localização."
        }
    }

    private func catalogAndSelect(_ place: NativePlaceCandidate) async {
        feedback = nil
        if let gym = await model.catalogPlace(place) {
            selectedGym = gym
            Haptics.selection()
        } else {
            feedback = model.error ?? "Não foi possível cadastrar este local."
        }
    }

    private func submitCheckIn() async {
        guard let selectedGym else { return }
        isCheckingIn = true
        defer { isCheckingIn = false }
        let ok = await model.checkIn(gym: selectedGym)
        feedback = ok ? "Check-in confirmado. Seu circle sabe que você treinou." : (model.error ?? "Não foi possível fazer check-in.")
    }
}

import SwiftUI

/// Check-in "lugar vivo" — paridade com o web `CheckInScreen`.
///
/// - Tela default: card grande da ÚLTIMA academia treinada (com check-in
///   rápido) ou hero vazio; lugares perto auto-buscados por GPS; amigos que
///   treinaram lá.
/// - Tela de detalhe (academia selecionada): header + check-in + "Pessoas"
///   com toggle Hoje/Semana + grid de posts recentes.
/// - Busca via `NativeGymSearchSheet` (paridade `GymSearchSheet`).
public struct CheckInView: View {
    @ObservedObject private var model: GymCircleAppModel

    @State private var lastGym: GymOption?
    @State private var selectedGym: GymOption?
    @State private var nearbyGyms: [GymOption] = []
    @State private var nearbyPlaces: [NativePlaceCandidate] = []
    @State private var viewerCoordinate: GymCircleCoordinate?
    @State private var gymPosts: [GymCheckInPost] = []
    @State private var followingIds: Set<String> = []
    @State private var peopleFilter: PeopleFilter = .today

    @State private var isLocating = false
    @State private var isCheckingIn = false
    @State private var feedback: String?
    @State private var loaded = false

    @State private var searchPresented = false
    @State private var openedProfile: OtherProfileSummary?

    public init(model: GymCircleAppModel, initialGym: GymOption? = nil) {
        self.model = model
        _selectedGym = State(initialValue: initialGym)
    }

    private enum PeopleFilter { case today, week }

    private var activeGym: GymOption? { selectedGym ?? lastGym }
    private var isViewingDetail: Bool { selectedGym != nil }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if isViewingDetail, let gym = selectedGym {
                    selectedGymView(gym)
                } else {
                    defaultView
                }
                if let feedback {
                    GCText(feedback, style: .caption, color: GymCircleTheme.ColorToken.cyan)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
            }
            .padding(20)
        }
        .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
        .navigationTitle(activeGym?.name ?? Loc.checkIn)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            guard !loaded else { return }
            loaded = true
            await initialLoad()
        }
        .onChange(of: selectedGym?.id) { _ in
            Task { await reloadGymPosts() }
        }
        .sheet(isPresented: $searchPresented) {
            NativeGymSearchSheet(model: model) { gym in
                select(gym)
            }
        }
        .sheet(item: $openedProfile) { summary in
            OtherProfileHostView(model: model, summary: summary)
        }
    }

    // MARK: - Default view

    @ViewBuilder
    private var defaultView: some View {
        if let lastGym {
            lastGymCard(lastGym)
        } else {
            emptyHero
        }

        nearbyList

        let friends = friendsAtLastGym
        if lastGym != nil, !friends.isEmpty {
            sectionHeader(Loc.t("Friends at \(lastGym?.name ?? "")", "Amigos em \(lastGym?.name ?? "")"))
            VStack(spacing: 8) {
                ForEach(friends) { post in personRow(post) }
            }
        }
    }

    private func lastGymCard(_ gym: GymOption) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            GCText(Loc.t("Last gym", "Última academia"), style: .sectionLabel)

            Button {
                select(gym)
            } label: {
                HStack(alignment: .top, spacing: 12) {
                    gymPin(size: 48, large: true)
                    VStack(alignment: .leading, spacing: 3) {
                        GCText(gym.name, style: .title)
                        if !gym.subtitle.isEmpty {
                            GCText(gym.subtitle, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                        }
                    }
                    Spacer(minLength: 0)
                }
            }
            .buttonStyle(.plain)

            HStack(spacing: 10) {
                checkInButton(gym: gym, large: false)
                Button { select(gym) } label: {
                    Image(systemName: "arrow.right")
                        .fontWeight(.black)
                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                        .frame(width: 48, height: 48)
                        .background(
                            Circle().fill(GymCircleTheme.ColorToken.elevatedCard)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            GymCircleTheme.ColorToken.cyan.opacity(0.10),
                            GymCircleTheme.ColorToken.elevatedCard.opacity(0.30),
                            Color.clear
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
    }

    private var emptyHero: some View {
        VStack(spacing: 12) {
            gymPin(size: 56, large: true)
            GCText(Loc.t("Where did you train?", "Onde você treinou?"), style: .headline)
            GCText(
                Loc.t("Find your gym to check in and see who else is there.",
                      "Encontre sua academia pra fazer check-in e ver quem treina lá."),
                style: .caption,
                color: GymCircleTheme.ColorToken.secondaryText
            )
            .multilineTextAlignment(.center)

            Button { searchPresented = true } label: {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                    Text(Loc.t("Find gym", "Buscar academia")).fontWeight(.black)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(GymCircleTheme.ColorToken.cyan))
                .foregroundStyle(.black)
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(22)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(GymCircleTheme.ColorToken.elevatedCard.opacity(0.4))
        )
    }

    private var nearbyList: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                GCText(Loc.t("Nearby", "Perto de você"), style: .sectionLabel)
                Spacer()
                Button(Loc.t("Search", "Buscar")) { searchPresented = true }
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(GymCircleTheme.ColorToken.cyan)
            }

            if isLocating && nearbyGyms.isEmpty && nearbyPlaces.isEmpty {
                HStack(spacing: 8) {
                    ProgressView().tint(GymCircleTheme.ColorToken.cyan)
                    GCText(Loc.searchingNearby, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 18)
                .background(RoundedRectangle(cornerRadius: 16).fill(GymCircleTheme.ColorToken.elevatedCard.opacity(0.5)))
            }

            ForEach(nearbyGyms.prefix(5)) { gym in
                Button { select(gym) } label: {
                    placeRow(
                        name: gym.name,
                        subtitle: gym.subtitle,
                        distance: distanceLabel(for: gym),
                        registered: true
                    )
                }
                    .buttonStyle(.plain)
            }
            ForEach(nearbyPlaces.prefix(5)) { place in
                Button { Task { await catalogAndSelect(place) } } label: {
                    placeRow(
                        name: place.name,
                        subtitle: place.subtitle,
                        distance: distanceLabel(to: place.coordinate),
                        registered: false
                    )
                }
                .buttonStyle(.plain)
            }

            if !isLocating && nearbyGyms.isEmpty && nearbyPlaces.isEmpty {
                GCText(Loc.t("No gyms found near you.", "Nenhuma academia perto de você."),
                       style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
            }
        }
    }

    // MARK: - Selected gym detail

    @ViewBuilder
    private func selectedGymView(_ gym: GymOption) -> some View {
        HStack(alignment: .top, spacing: 12) {
            gymPin(size: 48, large: false)
            VStack(alignment: .leading, spacing: 3) {
                GCText(gym.name, style: .headline)
                if !gym.subtitle.isEmpty {
                    GCText(gym.subtitle, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                }
                if let distance = distanceLabel(for: gym) {
                    GCText(
                        Loc.t("\(distance) away", "\(distance) de você"),
                        style: .caption,
                        color: GymCircleTheme.ColorToken.cyan
                    )
                }
            }
            Spacer(minLength: 0)
            Button { selectedGym = nil; feedback = nil } label: {
                Image(systemName: "xmark")
                    .fontWeight(.bold)
                    .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(GymCircleTheme.ColorToken.elevatedCard))
            }
            .buttonStyle(.plain)
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(GymCircleTheme.ColorToken.elevatedCard.opacity(0.4)))

        Link(destination: mapsURL(for: gym)) {
            Label(Loc.t("View on map", "Ver no mapa"), systemImage: "location.fill")
                .font(.system(size: 14, weight: .black))
                .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(GymCircleTheme.ColorToken.cyan.opacity(0.10))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(GymCircleTheme.ColorToken.cyan.opacity(0.28), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)

        checkInButton(gym: gym, large: true)

        // Pessoas (hoje/semana)
        HStack {
            GCText(Loc.t("People", "Pessoas"), style: .headline)
            Spacer()
            peopleToggle
        }
        .padding(.top, 4)

        let people = peopleAtGym
        if people.isEmpty {
            GCText(
                peopleFilter == .today
                    ? Loc.t("No one has trained here today yet.", "Ninguém treinou aqui hoje ainda.")
                    : Loc.t("No one has trained here this week.", "Ninguém treinou aqui essa semana."),
                style: .caption,
                color: GymCircleTheme.ColorToken.secondaryText
            )
        } else {
            VStack(spacing: 8) {
                ForEach(people) { post in personRow(post) }
            }
        }

        // Posts recentes
        let recent = recentPosts
        if !recent.isEmpty {
            sectionHeader(Loc.t("Recent posts", "Posts recentes"))
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 3), spacing: 2) {
                ForEach(recent) { post in postThumb(post) }
            }
        }
    }

    private var peopleToggle: some View {
        HStack(spacing: 0) {
            toggleChip(Loc.t("Today", "Hoje"), active: peopleFilter == .today) { peopleFilter = .today }
            toggleChip(Loc.t("Week", "Semana"), active: peopleFilter == .week) { peopleFilter = .week }
        }
        .padding(2)
        .background(Capsule().fill(GymCircleTheme.ColorToken.elevatedCard))
    }

    private func toggleChip(_ title: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 12, weight: .black))
                .foregroundStyle(active ? Color.black : GymCircleTheme.ColorToken.secondaryText)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(active ? AnyShapeStyle(Color.white) : AnyShapeStyle(Color.clear), in: Capsule())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Rows / cells

    private func personRow(_ post: GymCheckInPost) -> some View {
        Button { openProfile(userId: post.userId) } label: {
            HStack(spacing: 12) {
                GCAvatar(url: post.avatarURL, fallback: post.username ?? "u", size: 44)
                VStack(alignment: .leading, spacing: 2) {
                    GCText(post.displayedName, style: .body)
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                            .font(.system(size: 9, weight: .bold))
                        GCText(metaLine(for: post), style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                    }
                    .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                }
                Spacer(minLength: 0)
            }
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(GymCircleTheme.ColorToken.elevatedCard.opacity(0.5)))
        }
        .buttonStyle(.plain)
    }

    private func postThumb(_ post: GymCheckInPost) -> some View {
        Button { openProfile(userId: post.userId) } label: {
            Color.clear
                .aspectRatio(1, contentMode: .fit)
                .overlay {
                    GCRemoteImage(url: post.thumbnailURL.flatMap(URL.init(string:)), animateOnLoad: false) {
                        Rectangle().fill(GymCircleTheme.ColorToken.elevatedCard)
                    }
                }
                .overlay(alignment: .bottomTrailing) {
                    Image(systemName: post.isVideo ? "play.fill" : "camera.fill")
                        .font(.system(size: 8, weight: .black))
                        .foregroundStyle(.white)
                        .padding(4)
                        .background(Circle().fill(Color.black.opacity(0.55)))
                        .padding(4)
                }
                .clipped()
        }
        .buttonStyle(.plain)
    }

    private func placeRow(
        name: String,
        subtitle: String,
        distance: String?,
        registered: Bool
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: registered ? "mappin.circle.fill" : "mappin.circle")
                .foregroundStyle(registered ? GymCircleTheme.ColorToken.cyan : GymCircleTheme.ColorToken.secondaryText)
            VStack(alignment: .leading, spacing: 2) {
                GCText(name, style: .body)
                if !subtitle.isEmpty {
                    GCText(subtitle, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                }
                if let distance {
                    GCText(
                        Loc.t("\(distance) away", "\(distance) de você"),
                        style: .caption,
                        color: GymCircleTheme.ColorToken.cyan
                    )
                }
            }
            Spacer(minLength: 0)
            if !registered {
                GCText(Loc.register, style: .caption, color: GymCircleTheme.ColorToken.cyan)
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(GymCircleTheme.ColorToken.elevatedCard.opacity(0.5)))
    }

    private func sectionHeader(_ title: String) -> some View {
        GCText(title, style: .sectionLabel).padding(.top, 6)
    }

    private func gymPin(size: CGFloat, large: Bool) -> some View {
        Image(systemName: "mappin.and.ellipse")
            .font(.system(size: size * 0.42, weight: .bold))
            .foregroundStyle(GymCircleTheme.ColorToken.cyan)
            .frame(width: size, height: size)
            .background(Circle().fill(GymCircleTheme.ColorToken.cyan.opacity(0.14)))
    }

    private func checkInButton(gym: GymOption, large: Bool) -> some View {
        Button { Task { await submitCheckIn(gym) } } label: {
            HStack(spacing: 8) {
                if isCheckingIn {
                    ProgressView().tint(.black)
                } else {
                    Image(systemName: "checkmark.circle.fill")
                    Text(Loc.t("Check in", "Fazer check-in")).fontWeight(.black)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, large ? 16 : 13)
            .background(RoundedRectangle(cornerRadius: large ? 18 : 16, style: .continuous).fill(GymCircleTheme.ColorToken.cyan))
            .foregroundStyle(.black)
        }
        .buttonStyle(.plain)
        .disabled(isCheckingIn)
    }

    // MARK: - Derived data

    private var friendsAtLastGym: [GymCheckInPost] {
        let myId = model.currentUserId?.lowercased()
        return distinctByUser(gymPosts.filter {
            $0.userId.lowercased() != myId && followingIds.contains($0.userId)
        }).prefix(8).map { $0 }
    }

    private var peopleAtGym: [GymCheckInPost] {
        let filtered = gymPosts.filter { post in
            guard let date = parseDate(post.createdAtISO) else { return false }
            return peopleFilter == .today ? isToday(date) : isWithin7(date)
        }
        return distinctByUser(filtered).prefix(12).map { $0 }
    }

    private var recentPosts: [GymCheckInPost] {
        gymPosts.filter { $0.thumbnailURL != nil }.prefix(9).map { $0 }
    }

    /// 1 post (o mais recente) por usuário. `gymPosts` já vem desc por data.
    private func distinctByUser(_ posts: [GymCheckInPost]) -> [GymCheckInPost] {
        var seen = Set<String>()
        var out: [GymCheckInPost] = []
        for post in posts where !seen.contains(post.userId) {
            seen.insert(post.userId)
            out.append(post)
        }
        return out
    }

    private func metaLine(for post: GymCheckInPost) -> String {
        var parts: [String] = []
        if let date = parseDate(post.createdAtISO) { parts.append(relativeLabel(date)) }
        if let workout = post.workoutType, !workout.isEmpty { parts.append(workout) }
        return parts.joined(separator: " · ")
    }

    // MARK: - Actions

    private func initialLoad() async {
        async let recents = model.recentGyms()
        async let follows = model.followingUserIds()
        let recentList = await recents
        followingIds = await follows
        lastGym = recentList.first
        await reloadGymPosts()
        await locateNearby(silent: true)
    }

    private func reloadGymPosts() async {
        guard let gymId = activeGym?.id else { gymPosts = []; return }
        gymPosts = await model.gymPosts(gymId: gymId)
    }

    private func select(_ gym: GymOption) {
        Haptics.selection()
        feedback = nil
        selectedGym = gym
        peopleFilter = .today
    }

    private func locateNearby(silent: Bool) async {
        isLocating = true
        if !silent { feedback = nil }
        defer { isLocating = false }
        do {
            let coordinate = try await AppleMapsLocationProvider.shared.currentPosition()
            viewerCoordinate = coordinate
            async let dbGyms = model.nearbyGyms(coordinate: coordinate)
            async let mapPlaces = AppleMapsLocationProvider.shared.nearbyPlaces(near: coordinate)
            nearbyGyms = await dbGyms
            nearbyPlaces = (try? await mapPlaces) ?? []
            if !silent, nearbyGyms.isEmpty, nearbyPlaces.isEmpty { feedback = Loc.noNearbyGyms }
        } catch {
            if !silent {
                Haptics.error()
                feedback = Loc.locationDenied
            }
        }
    }

    private func catalogAndSelect(_ place: NativePlaceCandidate) async {
        feedback = nil
        if let gym = await model.catalogPlace(place) {
            select(gym)
        } else {
            feedback = model.error ?? Loc.couldNotRegisterPlace
        }
    }

    private func submitCheckIn(_ gym: GymOption) async {
        isCheckingIn = true
        defer { isCheckingIn = false }
        let ok = await model.checkIn(gym: gym)
        feedback = ok
            ? Loc.t("Checked in at \(gym.name)", "Check-in em \(gym.name)")
            : (model.error ?? Loc.checkInFailed)
        if ok { await reloadGymPosts() }
    }

    private func openProfile(userId: String) {
        guard !userId.isEmpty,
              userId.lowercased() != model.currentUserId?.lowercased() else { return }
        Task {
            if let summary = await model.fetchOtherProfileSummary(userId: userId) {
                openedProfile = summary
            }
        }
    }

    private func distanceLabel(for gym: GymOption) -> String? {
        guard let latitude = gym.latitude, let longitude = gym.longitude else { return nil }
        return distanceLabel(to: GymCircleCoordinate(
            latitude: latitude,
            longitude: longitude
        ))
    }

    private func distanceLabel(to coordinate: GymCircleCoordinate) -> String? {
        guard let viewerCoordinate else { return nil }
        return NativeLocationProvider.formattedDistanceKm(
            NativeLocationProvider.distanceKm(from: viewerCoordinate, to: coordinate)
        )
    }

    private func mapsURL(for gym: GymOption) -> URL {
        var components = URLComponents(string: "https://www.google.com/maps/search/")
        let query: String
        if let latitude = gym.latitude, let longitude = gym.longitude {
            query = "\(latitude),\(longitude)"
        } else {
            query = [gym.name, gym.address, gym.city, gym.state]
                .compactMap { $0 }
                .filter { !$0.isEmpty }
                .joined(separator: ", ")
        }
        components?.queryItems = [
            URLQueryItem(name: "api", value: "1"),
            URLQueryItem(name: "query", value: query),
        ]
        return components?.url ?? URL(string: "https://maps.google.com")!
    }

    // MARK: - Date helpers (America/Sao_Paulo, igual ao web)

    private static let spCalendar: Calendar = {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/Sao_Paulo") ?? .current
        return cal
    }()

    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoPlain = ISO8601DateFormatter()

    private func parseDate(_ iso: String) -> Date? {
        Self.isoFractional.date(from: iso) ?? Self.isoPlain.date(from: iso)
    }

    private func isToday(_ date: Date) -> Bool {
        Self.spCalendar.isDateInToday(date)
    }

    private func isWithin7(_ date: Date) -> Bool {
        date.timeIntervalSinceNow > -7 * 24 * 60 * 60
    }

    private func relativeLabel(_ date: Date) -> String {
        let cal = Self.spCalendar
        if cal.isDateInToday(date) {
            let tf = DateFormatter()
            tf.locale = .current
            tf.timeZone = cal.timeZone
            tf.dateFormat = "HH:mm"
            return tf.string(from: date)
        }
        let days = cal.dateComponents([.day], from: cal.startOfDay(for: date), to: cal.startOfDay(for: Date())).day ?? 0
        if days <= 1 { return Loc.t("yesterday", "ontem") }
        if days <= 7 { return Loc.t("\(days)d ago", "há \(days)d") }
        let df = DateFormatter()
        df.locale = .current
        df.timeZone = cal.timeZone
        df.dateFormat = "d MMM"
        return df.string(from: date)
    }
}

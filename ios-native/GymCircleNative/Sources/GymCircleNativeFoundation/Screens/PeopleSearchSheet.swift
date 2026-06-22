import SwiftUI

/// PeopleSearchSheet — Sprint 20.3c (busca de pessoas, RPC search_profiles).
///
/// Tap num resultado abre o OtherProfileView completo (summary agregado
/// via AppModel.fetchOtherProfileSummary — mesmo caminho do bridge).
public struct PeopleSearchSheet: View {
    @ObservedObject private var model: GymCircleAppModel

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var results: [DiscoveredProfile] = []
    @State private var suggestions: [DiscoveredProfile] = []
    @State private var isSearching = false
    @State private var openedSummary: OtherProfileSummary?
    @State private var searchTask: Task<Void, Never>?

    public init(model: GymCircleAppModel) {
        self.model = model
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                    TextField(Loc.searchPeoplePlaceholder, text: $query)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(GymCircleTheme.ColorToken.elevatedCard)
                )
                .padding(16)

                if isSearching {
                    Spacer()
                    ProgressView().tint(GymCircleTheme.ColorToken.cyan)
                    Spacer()
                } else if results.isEmpty && !query.isEmpty {
                    Spacer()
                    GCEmptyState(
                        title: Loc.noneFoundTitle,
                        subtitle: Loc.noneFoundSubtitle
                    )
                    Spacer()
                } else if query.isEmpty && !suggestions.isEmpty {
                    // Sugestões (get_user_suggestions) — estado inicial,
                    // paridade discovery web.
                    List {
                        Section {
                            ForEach(suggestions) { person in
                                personRow(person)
                            }
                            .listRowBackground(GymCircleTheme.ColorToken.appBackground)
                            .listRowSeparator(.hidden)
                        } header: {
                            GCText(
                                Loc.suggestionsForYou,
                                style: .caption,
                                color: GymCircleTheme.ColorToken.secondaryText
                            )
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                } else {
                    List(results) { person in
                        Button {
                            Task { await openProfile(person) }
                        } label: {
                            HStack(spacing: 12) {
                                GCAvatar(url: person.avatarURL, fallback: person.username ?? "u")
                                VStack(alignment: .leading, spacing: 2) {
                                    GCText(person.displayedName, style: .body)
                                    GCText(
                                        "@\(person.username ?? "user")",
                                        style: .caption,
                                        color: GymCircleTheme.ColorToken.secondaryText
                                    )
                                }
                                Spacer()
                                if let streak = person.currentStreak, streak > 0 {
                                    GCText("\(streak)d", style: .caption, color: GymCircleTheme.ColorToken.cyan)
                                }
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                            }
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(GymCircleTheme.ColorToken.appBackground)
                        .listRowSeparator(.hidden)
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle(Loc.search)
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
            suggestions = await model.fetchSuggestions()
        }
        .onChange(of: query) { newQuery in
            // Debounce 350ms — paridade com o input de busca web.
            searchTask?.cancel()
            searchTask = Task {
                try? await Task.sleep(nanoseconds: 350_000_000)
                guard !Task.isCancelled else { return }
                isSearching = true
                results = await model.searchProfiles(query: newQuery)
                isSearching = false
            }
        }
        .sheet(item: $openedSummary) { summary in
            OtherProfileHostView(model: model, summary: summary)
        }
    }

    private func openProfile(_ person: DiscoveredProfile) async {
        if let summary = await model.fetchOtherProfileSummary(userId: person.userId) {
            openedSummary = summary
        }
    }

    /// Linha reusada pelas sugestões (mesma da lista de resultados).
    private func personRow(_ person: DiscoveredProfile) -> some View {
        Button {
            Task { await openProfile(person) }
        } label: {
            HStack(spacing: 12) {
                GCAvatar(url: person.avatarURL, fallback: person.username ?? "u")
                VStack(alignment: .leading, spacing: 2) {
                    GCText(person.displayedName, style: .body)
                    GCText(
                        "@\(person.username ?? "user")",
                        style: .caption,
                        color: GymCircleTheme.ColorToken.secondaryText
                    )
                }
                Spacer()
                if let streak = person.currentStreak, streak > 0 {
                    GCText("\(streak)d", style: .caption, color: GymCircleTheme.ColorToken.cyan)
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
            }
        }
        .buttonStyle(.plain)
    }
}

/// Host fino que liga o OtherProfileView (data-injected) nas ações do
/// model (follow toggle/report/block básicos). Sprint 20.3c.
struct OtherProfileHostView: View {
    @ObservedObject var model: GymCircleAppModel
    let summary: OtherProfileSummary

    @Environment(\.dismiss) private var dismiss
    @State private var isFollowing: Bool
    @State private var followersPresented = false
    @State private var followingPresented = false
    // MyCircle do user-alvo (aberto pelo tap no avatar).
    @State private var otherCircle: OtherMyCircleBox?
    @State private var loadingCircle = false

    init(model: GymCircleAppModel, summary: OtherProfileSummary) {
        self.model = model
        self.summary = summary
        _isFollowing = State(initialValue: summary.isFollowingAuthor)
    }

    var body: some View {
        OtherProfileView(
            profile: summary.profile,
            posts: summary.posts,
            latestPost: summary.posts.first,
            followState: isFollowing ? .accepted : .none,
            canSeePosts: !summary.profile.isPrivate || isFollowing,
            postsCount: summary.postsCount,
            followersCount: summary.followersCount,
            followingCount: summary.followingCount,
            realCurrentStreak: summary.currentStreak,
            realBestStreak: summary.bestStreak,
            onToggleFollow: {
                Task {
                    isFollowing = await model.toggleFollow(targetUserId: summary.profile.userId)
                }
            },
            onMessage: {},
            onReport: {},
            onBlock: {},
            onClose: { dismiss() },
            loadRings: { await model.fetchConsistencyRings(userId: $0) },
            loadStoryRing: { await model.fetchStoryRingState(userId: $0) },
            onOpenMyCircle: { openOtherCircle() },
            onOpenFollowers: { followersPresented = true },
            onOpenFollowing: { followingPresented = true }
        )
        .sheet(isPresented: $followersPresented) {
            FollowListSheet(model: model, userId: summary.profile.userId, mode: .followers)
        }
        .sheet(isPresented: $followingPresented) {
            FollowListSheet(model: model, userId: summary.profile.userId, mode: .following)
        }
        .sheet(item: $otherCircle) { box in
            NavigationStack {
                MyCircleView(data: box.data)
                    .navigationTitle(Loc.myCircle)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button(Loc.close) { otherCircle = nil }
                                .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                        }
                    }
            }
            .preferredColorScheme(.dark)
        }
    }

    private func openOtherCircle() {
        guard !loadingCircle else { return }
        loadingCircle = true
        Task {
            if let data = await model.fetchOtherMyCircle(userId: summary.profile.userId) {
                otherCircle = OtherMyCircleBox(data: data)
            }
            loadingCircle = false
        }
    }
}

/// Wrapper Identifiable pra apresentar o MyCircle de outro user via sheet(item:).
private struct OtherMyCircleBox: Identifiable {
    let id = UUID()
    let data: MyCircleViewData
}

extension OtherProfileSummary: Identifiable {
    public var id: String { profile.userId }
}

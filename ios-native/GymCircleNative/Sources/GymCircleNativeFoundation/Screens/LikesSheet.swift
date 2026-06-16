import SwiftUI

/// LikesSheet — Sprint 20.3c ("quem curtiu", paridade do likes overlay web).
public struct LikesSheet: View {
    private let post: FeedPost
    private let fetch: (String) async -> [PostParticipant]
    /// Pra abrir o perfil de quem curtiu (tap na linha). Apresenta a partir
    /// desta sheet (evita conflito de sheet aninhada).
    private let model: GymCircleAppModel?

    @Environment(\.dismiss) private var dismiss
    @State private var likers: [PostParticipant] = []
    @State private var isLoading = true
    @State private var openedProfile: OtherProfileSummary?

    public init(
        post: FeedPost,
        model: GymCircleAppModel? = nil,
        fetch: @escaping (String) async -> [PostParticipant]
    ) {
        self.post = post
        self.model = model
        self.fetch = fetch
    }

    private func openProfile(userId: String) {
        guard let model, userId != model.currentUserId else { return }
        Task {
            if let summary = await model.fetchOtherProfileSummary(userId: userId) {
                openedProfile = summary
            }
        }
    }

    public var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    GCLoadingView(Loc.loadingLikes)
                } else if likers.isEmpty {
                    GCEmptyState(
                        title: Loc.noLikesTitle,
                        subtitle: Loc.noLikesSubtitle
                    )
                } else {
                    List(likers) { liker in
                        Button { openProfile(userId: liker.taggedUserId) } label: {
                            HStack(spacing: 12) {
                                GCAvatar(url: liker.avatarURL, fallback: liker.username)
                                VStack(alignment: .leading, spacing: 2) {
                                    GCText(liker.displayedName, style: .body)
                                    GCText(
                                        "@\(liker.username)",
                                        style: .caption,
                                        color: GymCircleTheme.ColorToken.secondaryText
                                    )
                                }
                                Spacer()
                                Image(systemName: "heart.fill")
                                    .foregroundStyle(GymCircleTheme.ColorToken.pink)
                            }
                        }
                        .buttonStyle(.plain)
                        .disabled(model == nil)
                        .listRowBackground(GymCircleTheme.ColorToken.appBackground)
                        .listRowSeparator(.hidden)
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle(Loc.likesTitle)
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
            likers = await fetch(post.id)
            isLoading = false
        }
        .sheet(item: $openedProfile) { summary in
            if let model {
                OtherProfileHostView(model: model, summary: summary)
            }
        }
    }
}

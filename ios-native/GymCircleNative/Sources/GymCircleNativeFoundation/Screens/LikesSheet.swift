import SwiftUI

/// LikesSheet — Sprint 20.3c ("quem curtiu", paridade do likes overlay web).
public struct LikesSheet: View {
    private let post: FeedPost
    private let fetch: (String) async -> [PostParticipant]

    @Environment(\.dismiss) private var dismiss
    @State private var likers: [PostParticipant] = []
    @State private var isLoading = true

    public init(post: FeedPost, fetch: @escaping (String) async -> [PostParticipant]) {
        self.post = post
        self.fetch = fetch
    }

    public var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    GCLoadingView("Carregando curtidas")
                } else if likers.isEmpty {
                    GCEmptyState(
                        title: "Nenhuma curtida ainda",
                        subtitle: "Seja o primeiro a curtir este treino."
                    )
                } else {
                    List(likers) { liker in
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
                        .listRowBackground(GymCircleTheme.ColorToken.appBackground)
                        .listRowSeparator(.hidden)
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle("Curtidas")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fechar") { dismiss() }
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                }
            }
        }
        .preferredColorScheme(.dark)
        .task {
            likers = await fetch(post.id)
            isLoading = false
        }
    }
}

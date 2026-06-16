import SwiftUI

/// FollowListSheet — lista de Seguidores ou Seguindo de um user (paridade web:
/// os números do perfil são clicáveis e abrem a lista). Cada linha abre o
/// perfil daquela pessoa (apresenta de si mesma pra evitar sheet aninhada).
public struct FollowListSheet: View {
    public enum Mode { case followers, following }

    @ObservedObject private var model: GymCircleAppModel
    private let userId: String
    private let mode: Mode

    @Environment(\.dismiss) private var dismiss
    @State private var people: [DiscoveredProfile] = []
    @State private var isLoading = true
    @State private var openedProfile: OtherProfileSummary?

    public init(model: GymCircleAppModel, userId: String, mode: Mode) {
        self.model = model
        self.userId = userId
        self.mode = mode
    }

    private var title: String {
        mode == .followers ? L10n.profileFollowers.string : L10n.profileFollowing.string
    }

    public var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    GCLoadingView(Loc.t("Loading…", "Carregando…"))
                } else if people.isEmpty {
                    GCEmptyState(
                        title: mode == .followers
                            ? Loc.t("No followers yet", "Ainda sem seguidores")
                            : Loc.t("Not following anyone yet", "Ainda não segue ninguém"),
                        subtitle: mode == .followers
                            ? Loc.t("People who follow show up here.", "Quem te segue aparece aqui.")
                            : Loc.t("People you follow show up here.", "Quem você segue aparece aqui.")
                    )
                } else {
                    List(people) { person in
                        Button { openProfile(person.userId) } label: {
                            HStack(spacing: 12) {
                                GCAvatar(url: person.avatarURL, fallback: person.username ?? "u")
                                VStack(alignment: .leading, spacing: 2) {
                                    GCText(person.displayedName, style: .body)
                                    GCText(
                                        "@\(person.username ?? "")",
                                        style: .caption,
                                        color: GymCircleTheme.ColorToken.secondaryText
                                    )
                                }
                                Spacer()
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
            .navigationTitle(title)
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
            people = mode == .followers
                ? await model.fetchFollowers(userId: userId)
                : await model.fetchFollowing(userId: userId)
            isLoading = false
        }
        .sheet(item: $openedProfile) { summary in
            OtherProfileHostView(model: model, summary: summary)
        }
    }

    private func openProfile(_ uid: String) {
        guard uid.lowercased() != model.currentUserId?.lowercased() else { return }
        Task {
            if let summary = await model.fetchOtherProfileSummary(userId: uid) {
                openedProfile = summary
            }
        }
    }
}

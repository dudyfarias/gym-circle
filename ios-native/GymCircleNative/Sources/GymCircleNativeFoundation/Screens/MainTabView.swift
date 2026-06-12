import SwiftUI

public struct MainTabView: View {
    // Sprint 20.3a — o feed virou interativo (like/refresh/paginação),
    // então a tab Home observa o model direto; as demais seguem
    // data-injected até suas fases.
    @ObservedObject private var model: GymCircleAppModel
    private let profile: UserProfile?
    private let profilePosts: [ProfilePost]
    private let myCircle: MyCircleViewData

    public init(
        model: GymCircleAppModel,
        profile: UserProfile?,
        profilePosts: [ProfilePost],
        myCircle: MyCircleViewData
    ) {
        self.model = model
        self.profile = profile
        self.profilePosts = profilePosts
        self.myCircle = myCircle
    }

    public var body: some View {
        TabView {
            NavigationStack {
                FeedView(model: model)
            }
            .tabItem {
                Label("Home", systemImage: "house.fill")
            }

            NavigationStack {
                // Sprint 8.3 — MyCircleViewData injetado pelo AppModel
                // (já hidratado via MyCircleService quando autenticado).
                MyCircleView(data: myCircle)
                    .navigationTitle("Meu Circle")
            }
            .tabItem {
                Label("Circle", systemImage: "flame")
            }

            NavigationStack {
                // Sprint 20.4a — composer real substitui o placeholder.
                ComposerView(model: model)
            }
            .tabItem {
                Label("Criar", systemImage: "camera.fill")
            }

            NavigationStack {
                GCEmptyState(title: "Chat", subtitle: "Mensagens nativas ficam para uma fase futura.")
                    .background(GymCircleTheme.ColorToken.appBackground)
            }
            .tabItem {
                Label("Chat", systemImage: "bubble.left.and.bubble.right")
            }

            NavigationStack {
                // Sprint 20.1/20.2 — row compartilhada + Hall + Settings.
                ProfileView(
                    model: model,
                    profile: profile,
                    posts: profilePosts,
                    featuredAchievements: myCircle.featuredAchievements,
                    allAchievements: myCircle.allAchievements
                )
            }
            .tabItem {
                Label("Perfil", systemImage: "person.crop.circle")
            }
        }
        .tint(GymCircleTheme.ColorToken.cyan)
    }
}

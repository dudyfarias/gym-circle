import SwiftUI

/// MainTabView — paridade TOTAL com o BottomNav web (decisão 12/jun:
/// 100% igual em design/UI/UX):
///   Início (feed) · Conversas (badge) · Postar · Mapa (check-in) · Perfil
/// O MyCircle deixa de ser tab e vira SHEET aberta pelo anel de streak
/// no feed — mesmo gesto do web.
public struct MainTabView: View {
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
                FeedView(model: model, myCircle: myCircle)
            }
            .tabItem {
                Label("Início", systemImage: "house.fill")
            }

            NavigationStack {
                ChatListView(model: model)
            }
            .tabItem {
                Label("Conversas", systemImage: "bubble.left.and.bubble.right")
            }
            .badge(model.unreadMessages > 0 ? model.unreadMessages : 0)

            NavigationStack {
                ComposerView(model: model)
            }
            .tabItem {
                Label("Postar", systemImage: "camera.fill")
            }

            NavigationStack {
                CheckInView(model: model)
            }
            .tabItem {
                Label("Mapa", systemImage: "mappin.and.ellipse")
            }

            NavigationStack {
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

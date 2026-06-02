import SwiftUI

public struct MainTabView: View {
    private let posts: [FeedPost]
    private let stories: [StoryAuthorGroup]
    private let profile: UserProfile?
    private let profilePosts: [ProfilePost]
    private let myCircle: MyCircleSummary

    public init(
        posts: [FeedPost],
        stories: [StoryAuthorGroup],
        profile: UserProfile?,
        profilePosts: [ProfilePost],
        myCircle: MyCircleSummary
    ) {
        self.posts = posts
        self.stories = stories
        self.profile = profile
        self.profilePosts = profilePosts
        self.myCircle = myCircle
    }

    public var body: some View {
        TabView {
            NavigationStack {
                FeedView(posts: posts)
            }
            .tabItem {
                Label("Home", systemImage: "house.fill")
            }

            NavigationStack {
                MyCircleView(summary: myCircle)
            }
            .tabItem {
                Label("Circle", systemImage: "flame")
            }

            NavigationStack {
                GCEmptyState(title: "Criar treino", subtitle: "Composer nativo fica para a proxima sprint.")
                    .background(GymCircleTheme.ColorToken.appBackground)
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
                ProfileView(profile: profile, posts: profilePosts)
            }
            .tabItem {
                Label("Perfil", systemImage: "person.crop.circle")
            }
        }
        .tint(GymCircleTheme.ColorToken.cyan)
    }
}

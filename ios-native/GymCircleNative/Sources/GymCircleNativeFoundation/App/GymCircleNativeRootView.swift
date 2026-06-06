import SwiftUI

@MainActor
public struct GymCircleNativeRootView: View {
    @StateObject private var model: GymCircleAppModel

    public init() {
        _model = StateObject(wrappedValue: GymCircleAppModel())
    }

    public init(model: GymCircleAppModel) {
        _model = StateObject(wrappedValue: model)
    }

    public var body: some View {
        Group {
            if model.isBootstrapping {
                GCLoadingView("Abrindo Gym Circle")
                    .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            } else if let configurationError = model.configurationError {
                GCErrorState(
                    title: "Configuracao nativa pendente",
                    subtitle: configurationError
                )
                .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            } else if model.isAuthenticated {
                MainTabView(
                    posts: model.posts,
                    stories: model.stories,
                    profile: model.profile,
                    profilePosts: model.profilePosts,
                    myCircle: model.myCircleSummary,
                    isFeedLoading: model.isFeedLoading,
                    isStoriesLoading: model.isStoriesLoading,
                    isProfileLoading: model.isProfileLoading,
                    isMyCircleLoading: model.isMyCircleLoading,
                    feedError: model.feedError,
                    storiesError: model.storiesError,
                    profileError: model.profileError,
                    myCircleError: model.myCircleError,
                    onRefresh: {
                        Task { await model.refreshHome() }
                    },
                    onSignOut: {
                        Task { await model.signOut() }
                    },
                    loadStoryItems: { authorId in
                        try await model.loadStoryItems(authorId: authorId)
                    }
                )
            } else {
                LoginView(error: model.authError) { email, password in
                    try await model.signIn(email: email, password: password)
                }
            }
        }
        .preferredColorScheme(.dark)
        .task {
            await model.bootstrap()
        }
    }
}

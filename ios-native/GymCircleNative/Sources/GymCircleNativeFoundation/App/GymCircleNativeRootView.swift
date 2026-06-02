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
            if model.isAuthenticated {
                MainTabView(
                    posts: model.posts,
                    stories: model.stories,
                    profile: model.profile,
                    profilePosts: model.profilePosts,
                    myCircle: model.myCircleSummary
                )
            } else {
                LoginView { email, password in
                    try await model.signIn(email: email, password: password)
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}

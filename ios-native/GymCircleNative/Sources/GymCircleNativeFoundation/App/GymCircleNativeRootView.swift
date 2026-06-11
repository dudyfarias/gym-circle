import SwiftUI

@MainActor
public struct GymCircleNativeRootView: View {
    @StateObject private var model: GymCircleAppModel

    public init() {
        // Sprint 20.0 — o standalone agora resolve a config real
        // (env de dev → Info.plist via xcconfig) e cria o AppModel com
        // services Supabase de verdade. Antes este init criava o model
        // SEM services e o app inteiro bootava em modo demo. Sem config
        // (Secrets.xcconfig ausente), o fallback demo continua — útil
        // pra preview/clone sem credenciais.
        if let provider = SupabaseClientProvider.resolved() {
            _model = StateObject(wrappedValue: GymCircleAppModel(client: provider.client))
        } else {
            _model = StateObject(wrappedValue: GymCircleAppModel())
        }
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
                    // Sprint 8.3 — usa MyCircleViewData real quando disponível
                    // (fetchado via MyCircleService no boot), demo como fallback.
                    myCircle: model.myCircleData ?? MyCircleViewData.demo(
                        userId: model.profile?.userId ?? "demo-user",
                        isOwn: true
                    )
                )
            } else {
                LoginView { email, password in
                    try await model.signIn(email: email, password: password)
                }
            }
        }
        .preferredColorScheme(.dark)
        .task {
            // Sprint 8.3 — boot dispara restoreSession + loadInitialSurfaces +
            // loadMyCircle. Quando ok, isAuthenticated vira true e MainTabView
            // recebe dados reais via @Published.
            await model.boot()
        }
    }
}

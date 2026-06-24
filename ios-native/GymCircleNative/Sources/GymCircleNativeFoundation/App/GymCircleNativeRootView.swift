import SwiftUI

@MainActor
public struct GymCircleNativeRootView: View {
    @StateObject private var model: GymCircleAppModel
    // Sprint 20.7 — deep links (universal links /post/* e /u/* +
    // scheme gymcircle://). O entitlement applinks já está no target.
    @State private var deepLinkPost: FeedPost?
    @State private var deepLinkProfile: OtherProfileSummary?
    // Sprint 22.2 — idioma do app (independente do iPhone). Observado aqui pra
    // re-renderizar a árvore quando o usuário troca em Ajustes.
    @ObservedObject private var localization = LocalizationStore.shared

    public init() {
        // Configura o cache de imagens (URLCache disco+memória) ANTES de
        // qualquer requisição — fotos voltam do disco entre sessões.
        ImageCacheBootstrap.configure()
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
        // O ZStack tem identidade ESTÁVEL: o `.task`/sheets ficam aqui e rodam
        // 1x. Só o `authContent` interno leva `.id(idioma)`, então a troca de
        // idioma re-renderiza as strings SEM re-disparar o boot/recarregar feed.
        ZStack {
            authContent
                .id(localization.language)
        }
        .environment(\.locale, localization.locale)
        .preferredColorScheme(.dark)
        .task {
            // Sprint 8.3 — boot dispara restoreSession + loadInitialSurfaces +
            // loadMyCircle. Quando ok, isAuthenticated vira true e MainTabView
            // recebe dados reais via @Published.
            await model.boot()
        }
        // Universal links (https://gym-circle-rust.vercel.app/post/* e /u/*)
        // chegam como NSUserActivity; o scheme custom chega como URL.
        .onOpenURL { url in
            Task { await route(url) }
        }
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
            guard let url = activity.webpageURL else { return }
            Task { await route(url) }
        }
        .sheet(item: $deepLinkPost) { post in
            NavigationStack {
                ScrollView {
                    FeedPostCard(
                        post: post,
                        currentUserId: model.currentUserId,
                        onLike: { Task { await model.toggleLike(postId: post.id) } }
                    )
                    .padding(20)
                }
                .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
                .navigationTitle("Post")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Fechar") { deepLinkPost = nil }
                            .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                    }
                }
            }
            .preferredColorScheme(.dark)
        }
        .sheet(item: $deepLinkProfile) { summary in
            OtherProfileHostView(model: model, summary: summary)
        }
    }

    /// Conteúdo autenticado vs login. Levado num `.id(idioma)` no body pra
    /// re-renderizar as strings quando o usuário troca o idioma em Ajustes.
    @ViewBuilder
    private var authContent: some View {
        if !model.hasBooted {
            // Splash enquanto restaura a sessão — sem isto, a tela de login
            // piscava ~1s antes de cair no feed.
            SplashView()
        } else if model.isAuthenticated {
            MainTabView(
                // Sprint 20.3a — feed interativo observa o model direto.
                model: model,
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
            LoginView { identifier, password in
                try await model.signIn(identifier: identifier, password: password)
            }
        }
    }

    /// Roteia /post/<id>, /u/<username> e /convite/<username> (AASA da
    /// Sprint 19). Username resolve via busca exata; falha é silenciosa —
    /// o app só abre na home, igual link quebrado no web.
    private func route(_ url: URL) async {
        let parts = url.path.split(separator: "/").map(String.init)
        guard parts.count >= 2, model.isAuthenticated else { return }
        switch parts[0] {
        case "post":
            if let post = await model.fetchPost(postId: parts[1]) {
                deepLinkPost = post
            }
        case "u", "convite":
            let username = parts[1].lowercased()
            let matches = await model.searchProfiles(query: username)
            if let match = matches.first(where: { $0.username?.lowercased() == username }),
               let summary = await model.fetchOtherProfileSummary(userId: match.userId) {
                deepLinkProfile = summary
            }
        default:
            break
        }
    }
}

/// Splash exibido enquanto a sessão restaura do Keychain (boot). Usa a MESMA
/// arte da splash do web (asset `Splash`: logo + "GYM CIRCLE" + "Train together."
/// sobre fundo preto), com um spinner discreto no rodapé pra dar feedback de
/// carregamento durante a restauração da sessão.
private struct SplashView: View {
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            Image("Splash")
                .resizable()
                .scaledToFill()
                .ignoresSafeArea()
            VStack {
                Spacer()
                ProgressView()
                    .tint(GymCircleTheme.ColorToken.cyan)
                    .padding(.bottom, 64)
            }
        }
    }
}

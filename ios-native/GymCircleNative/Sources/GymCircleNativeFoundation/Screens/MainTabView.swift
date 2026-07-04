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

    // Paridade BottomTabBar web (build 12): barra customizada em pílula de
    // vidro, ícones-only, ativo = cápsula cyan. A barra do sistema é escondida
    // e a custom entra via safeAreaInset (mantém estado/nav + insets do conteúdo).
    @State private var selection: Tab = .feed
    // Incrementa ao tocar na aba do feed JÁ estando no feed → FeedView sobe ao
    // topo + dá refresh (paridade web: tap no ícone ativo).
    @State private var feedReselectTick = 0
    // Rastreio de treino — o "+" central abre o hub (Iniciar treino / Postar
    // treino / Check-in), paridade CreateHubSheet web.
    @State private var createHubPresented = false
    @State private var workoutPresented = false
    // Treino encerrado → composer com o contexto da activity (entrada no feed).
    @State private var composerActivity: ActivityComposerContext?

    enum Tab: Int, CaseIterable, Identifiable {
        case feed, chats, post, map, profile
        var id: Int { rawValue }

        var icon: String {
            switch self {
            case .feed: return "house.fill"
            case .chats: return "bubble.left.and.bubble.right.fill"
            case .post: return "plus"
            case .map: return "mappin.and.ellipse"
            case .profile: return "person.crop.circle.fill"
            }
        }

        var label: String {
            switch self {
            case .feed: return Loc.t("Home", "Início")
            case .chats: return Loc.t("Chats", "Conversas")
            case .post: return Loc.t("Create", "Criar")
            case .map: return Loc.t("Map", "Mapa")
            case .profile: return Loc.profile
            }
        }
    }

    public var body: some View {
        TabView(selection: $selection) {
            NavigationStack {
                FeedView(model: model, myCircle: myCircle, scrollToTopSignal: feedReselectTick)
            }
            .tag(Tab.feed)
            .toolbar(.hidden, for: .tabBar)

            NavigationStack {
                ChatListView(model: model)
            }
            .tag(Tab.chats)
            .toolbar(.hidden, for: .tabBar)

            NavigationStack {
                ComposerView(model: model)
            }
            .tag(Tab.post)
            .toolbar(.hidden, for: .tabBar)

            NavigationStack {
                CheckInView(model: model)
            }
            .tag(Tab.map)
            .toolbar(.hidden, for: .tabBar)

            NavigationStack {
                ProfileView(
                    model: model,
                    profile: profile,
                    posts: profilePosts,
                    myCircle: myCircle,
                    featuredAchievements: myCircle.featuredAchievements,
                    allAchievements: myCircle.allAchievements
                )
            }
            .tag(Tab.profile)
            .toolbar(.hidden, for: .tabBar)
        }
        .tint(GymCircleTheme.ColorToken.cyan)
        .safeAreaInset(edge: .bottom) {
            floatingTabBar
        }
        // Hub do "+": iniciar treino / postar treino / check-in.
        .sheet(isPresented: $createHubPresented) {
            CreateHubSheet(
                onStartWorkout: {
                    createHubPresented = false
                    workoutPresented = true
                },
                onPostWorkout: {
                    createHubPresented = false
                    selection = .post
                },
                onCheckIn: {
                    createHubPresented = false
                    selection = .map
                }
            )
            .presentationDetents([.height(380), .medium])
            .presentationDragIndicator(.visible)
        }
        // Treino ao vivo (cronômetro + descanso + Apple Saúde).
        .fullScreenCover(isPresented: $workoutPresented) {
            NativeWorkoutFlowView(
                model: model,
                onCompose: { context in
                    workoutPresented = false
                    composerActivity = context
                },
                onClose: { workoutPresented = false }
            )
        }
        // Encerrado → composer completa a ENTRADA (legenda/tags/local) ou
        // promove a post com foto.
        .sheet(item: $composerActivity) { context in
            NavigationStack {
                ComposerView(
                    model: model,
                    activityContext: context,
                    onPublished: { composerActivity = nil }
                )
            }
        }
    }

    private var floatingTabBar: some View {
        HStack(spacing: 4) {
            ForEach(Tab.allCases) { tab in
                Button {
                    Haptics.impactLight()
                    // O "+" central abre o hub de criação (não troca de tab).
                    if tab == .post {
                        createHubPresented = true
                        return
                    }
                    // Tocar na aba do feed já estando no feed → subir + refresh.
                    if tab == .feed && selection == .feed {
                        feedReselectTick += 1
                    }
                    selection = tab
                } label: {
                    Image(systemName: tab.icon)
                        .font(.system(size: 19, weight: .semibold))
                        .foregroundStyle(
                            selection == tab ? Color.black : Color.white.opacity(0.55)
                        )
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background {
                            if selection == tab {
                                Capsule()
                                    .fill(GymCircleTheme.ColorToken.cyan)
                                    .shadow(color: GymCircleTheme.ColorToken.cyan.opacity(0.28), radius: 12)
                            }
                        }
                        .overlay(alignment: .topTrailing) {
                            if tab == .chats && model.unreadMessages > 0 {
                                Text("\(model.unreadMessages)")
                                    .font(.system(size: 10, weight: .black, design: .default))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 1)
                                    .background(Capsule().fill(GymCircleTheme.ColorToken.pink))
                                    .offset(x: -4, y: 3)
                            }
                        }
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.label)
            }
        }
        .padding(4)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(Color.white.opacity(0.08), lineWidth: 1))
        .padding(.horizontal, 24)
        .padding(.bottom, 2)
        // Fica no fundo quando o teclado sobe (coberto), em vez de flutuar.
        .ignoresSafeArea(.keyboard, edges: .bottom)
    }
}

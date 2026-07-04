import SwiftUI
import AVKit

private enum HomeFeedItem: Identifiable {
    case post(FeedPost)
    case checkin(FeedCheckin)
    case activity(FeedActivity)

    var id: String {
        switch self {
        case .post(let post): return "post:\(post.id)"
        case .checkin(let checkin): return "checkin:\(checkin.id)"
        case .activity(let activity): return "activity:\(activity.id)"
        }
    }

    var createdAt: String {
        switch self {
        case .post(let post): return post.createdAt
        case .checkin(let checkin): return checkin.createdAt
        case .activity(let activity): return activity.createdAt
        }
    }
}

private func gymCircleFeedTimeLabel(_ iso: String) -> String {
    let parser = ISO8601DateFormatter()
    parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let date = parser.date(from: iso)
        ?? { let fallback = ISO8601DateFormatter(); return fallback.date(from: iso) }()
    guard let date else { return "" }

    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone =
        TimeZone(identifier: "America/Sao_Paulo") ?? .current
    if calendar.isDateInToday(date) {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }
    let days = calendar.dateComponents(
        [.day],
        from: calendar.startOfDay(for: date),
        to: calendar.startOfDay(for: Date())
    ).day ?? 0
    return days <= 0 ? Loc.t("now", "agora") : "\(days)d"
}

/// FeedView — Sprint 20.3a/b/c (feed interativo completo).
///
///   - 20.3a: carrossel + dots, curtir otimista, pull-to-refresh, paginação
///   - 20.3b: sheet de comentários (replies/likes/delete)
///   - 20.3c: menu do post (silenciar/denunciar/apagar), likes overlay,
///     participantes de grupo com aceite, vídeo em player fullscreen,
///     busca de pessoas na toolbar
public struct FeedView: View {
    @ObservedObject private var model: GymCircleAppModel
    // Paridade BottomNav web: MyCircle não é tab — abre como sheet pelo
    // anel de streak no topo do feed.
    private let myCircle: MyCircleViewData
    @State private var myCirclePresented = false
    @State private var commentsPost: FeedPost?
    @State private var likesPost: FeedPost?
    @State private var editingPost: FeedPost?
    @State private var editingCheckin: FeedCheckin?
    // Rastreio de treino: "Adicionar fotos" na entrada → composer com o
    // contexto da activity (promove a post via source_activity_id).
    @State private var composerActivity: ActivityComposerContext?
    // Tocar nos stats do treino (entrada) OU no header de um post promovido
    // de treino → overlay de detalhes (estilo Apple Atividades).
    @State private var detailWorkout: WorkoutDetailData?
    @State private var sharingPost: FeedPost?
    @State private var searchPresented = false
    @State private var notificationsPresented = false
    @State private var playingVideo: PlayableVideo?
    // Sprint 20.5 — autor cujo story foi aberto na tray.
    @State private var openedStoryGroup: StoryAuthorGroup?
    // Build 13 — sugestões inline (paridade web) + card de distância.
    @State private var suggestions: [DiscoveredProfile] = []
    @State private var followedSuggestions: Set<String> = []
    @State private var distanceCardDismissed = false
    // Perfil aberto ao tocar num nome/avatar (autor do post, participante,
    // story, sugestão). Tap em qualquer user → perfil dele.
    @State private var openedProfile: OtherProfileSummary?
    @State private var openedGym: GymOption?
    // "Registrar treino": dia treinado sem mídia no calendário → composer.
    @State private var registerTarget: RegisterWorkoutTarget?

    /// Incrementa quando o usuário toca na aba do feed JÁ estando no feed
    /// (MainTabView): reação = subir ao topo + dar refresh (paridade web
    /// scrollFeedToTop). 0 = inicial (não dispara).
    private let scrollToTopSignal: Int

    /// Âncora invisível no topo da lista pro ScrollViewReader.
    private let topAnchorID = "feed_top"

    private var feedItems: [HomeFeedItem] {
        (
            model.posts.map(HomeFeedItem.post)
                + model.checkins.map(HomeFeedItem.checkin)
                + model.activities.map(HomeFeedItem.activity)
        )
        .sorted { $0.createdAt > $1.createdAt }
    }

    public init(model: GymCircleAppModel, myCircle: MyCircleViewData, scrollToTopSignal: Int = 0) {
        self.model = model
        self.myCircle = myCircle
        self.scrollToTopSignal = scrollToTopSignal
    }

    // Card de permissão de distância (paridade DistancePermissionCard web).
    private var distancePermissionCard: some View {
        HStack(spacing: 12) {
            Image(systemName: "location.fill")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(GymCircleTheme.ColorToken.cyan)
            VStack(alignment: .leading, spacing: 2) {
                Text(Loc.t("See workout distance", "Veja a distância dos treinos"))
                    .font(.system(size: 14, weight: .black, design: .default))
                    .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                Text(Loc.t("Allow location to show how far each gym is.",
                           "Permita a localização pra ver a distância de cada academia."))
                    .font(.system(size: 12, weight: .bold, design: .default))
                    .foregroundStyle(Color.white.opacity(0.46))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 4)
            Button {
                distanceCardDismissed = true
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
            }
            .buttonStyle(.plain)
        }
        .padding(14)
        .background(GymCircleTheme.ColorToken.postCard)
        .clipShape(RoundedRectangle(cornerRadius: GymCircleTheme.Radius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: GymCircleTheme.Radius.card, style: .continuous)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
        .onTapGesture {
            Task { await model.requestViewerLocation() }
        }
    }

    // Linha "Sugestões pra você" (paridade DiscoveryUserCard web).
    private var suggestionsRow: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(Loc.t("Suggestions for you", "Sugestões pra você"))
                .font(.system(size: 17, weight: .black, design: .default))
                .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(suggestions.prefix(5)) { person in
                        suggestionCard(person)
                    }
                }
            }
        }
    }

    private func suggestionCard(_ person: DiscoveredProfile) -> some View {
        let isFollowing = followedSuggestions.contains(person.userId)
        return VStack(spacing: 8) {
            Button {
                openProfile(userId: person.userId)
            } label: {
                VStack(spacing: 8) {
                    GCAvatar(url: person.avatarURL, fallback: person.username ?? "user", size: 56)
                    Text(person.displayedName)
                        .font(.system(size: 13, weight: .black, design: .default))
                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                        .lineLimit(1)
                }
            }
            .buttonStyle(.plain)
            Button {
                Task {
                    _ = await model.toggleFollow(targetUserId: person.userId)
                    followedSuggestions.insert(person.userId)
                    Haptics.impactLight()
                }
            } label: {
                Text(isFollowing ? Loc.t("Following", "Seguindo") : Loc.t("Follow", "Seguir"))
                    .font(.system(size: 12, weight: .black, design: .default))
                    .foregroundStyle(isFollowing ? GymCircleTheme.ColorToken.primaryText : .black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 7)
                    .background(
                        Capsule().fill(isFollowing
                            ? Color.white.opacity(0.08)
                            : GymCircleTheme.ColorToken.cyan)
                    )
            }
            .buttonStyle(.plain)
            .disabled(isFollowing)
        }
        .frame(width: 132)
        .padding(12)
        .background(GymCircleTheme.ColorToken.postCard)
        .clipShape(RoundedRectangle(cornerRadius: GymCircleTheme.Radius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: GymCircleTheme.Radius.card, style: .continuous)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
    }

    public var body: some View {
        ScrollViewReader { proxy in
        ScrollView {
            LazyVStack(spacing: 20) {
                // Âncora invisível de topo: re-tap na aba do feed sobe até aqui.
                Color.clear.frame(height: 0).id(topAnchorID)
                StoriesTrayView(groups: model.stories, isLoading: false) { group in
                    openedStoryGroup = group
                }

                // Card de permissão de distância (paridade DistancePermissionCard
                // web): só quando há posts com local e ainda não temos a posição.
                if !distanceCardDismissed,
                   model.viewerCoordinate == nil,
                   model.posts.contains(where: { $0.coordinate != nil }) {
                    distancePermissionCard
                }

                if model.isLoading && feedItems.isEmpty {
                    GCFeedSkeleton()
                } else if model.error != nil && feedItems.isEmpty {
                    // Boot do feed falhou: em vez de mostrar o empty-state genérico
                    // (que confunde "deu erro" com "sem posts"), mostra erro +
                    // "Tentar de novo". Espelha o fix web (LiveHomeWrapper retry).
                    VStack(spacing: 14) {
                        GCText(Loc.feedErrorTitle, style: .headline)
                        GCText(Loc.feedErrorSubtitle, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                            .multilineTextAlignment(.center)
                        GCButton(Loc.tryAgain, systemImage: "arrow.clockwise") {
                            Task { await model.refreshFeed() }
                        }
                        .frame(maxWidth: 240)
                        .padding(.top, 4)
                    }
                    .padding(.horizontal, 32)
                    .padding(.vertical, 48)
                    .frame(maxWidth: .infinity)
                } else if feedItems.isEmpty {
                    GCEmptyState(
                        title: Loc.feedEmptyTitle,
                        subtitle: Loc.feedEmptySubtitle
                    )
                } else {
                    ForEach(Array(feedItems.enumerated()), id: \.element.id) { index, item in
                        // Linha "Sugestões pra seguir" injetada após o 2º post (web).
                        if index == 2, !suggestions.isEmpty {
                            suggestionsRow
                        }
                        switch item {
                        case .post(let post):
                            FeedPostCard(
                                post: post,
                                currentUserId: model.currentUserId,
                                viewerCoordinate: model.viewerCoordinate,
                                onLike: {
                                    Haptics.impactLight()
                                    Task { await model.toggleLike(postId: post.id) }
                                },
                                onComments: { commentsPost = post },
                                onOpenLikes: { likesPost = post },
                                onMute: {
                                    Task { await model.muteAuthor(authorId: post.userId) }
                                },
                                onReport: {
                                    Haptics.success()
                                    Task {
                                        await model.reportPost(
                                            postId: post.id,
                                            authorId: post.userId
                                        )
                                    }
                                },
                                onDelete: {
                                    Task { await model.deletePost(postId: post.id) }
                                },
                                onEdit: { editingPost = post },
                                onRespondInvite: { accepted in
                                    Haptics.impactLight()
                                    Task {
                                        await model.respondToInvite(
                                            postId: post.id,
                                            accepted: accepted
                                        )
                                    }
                                },
                                onPlayVideo: { url in
                                    playingVideo = PlayableVideo(url: url)
                                },
                                onShare: { sharingPost = post },
                                onOpenGym: {
                                    Task {
                                        openedGym = await model.fetchGym(id: post.gymId ?? "")
                                            ?? post.gymId.map {
                                                GymOption(
                                                    id: $0,
                                                    name: post.locationName ?? "Academia",
                                                    latitude: post.locationLatitude,
                                                    longitude: post.locationLongitude
                                                )
                                            }
                                    }
                                },
                                onOpenProfile: { openProfile(userId: $0) },
                                onOpenMention: { openMention(username: $0) },
                                onOpenWorkoutDetail: post.workoutDetail.map { detail in
                                    { detailWorkout = detail }
                                }
                            )
                            .onAppear {
                                // Dispara o load more no penúltimo post (espelho
                                // do IntersectionObserver da web).
                                let posts = model.posts
                                if posts.count >= 2,
                                   post.id == posts[posts.count - 2].id {
                                    Task { await model.loadMoreFeed() }
                                }
                            }
                        case .checkin(let checkin):
                            FeedCheckinCard(
                                checkin: checkin,
                                currentUserId: model.currentUserId,
                                onEdit: { editingCheckin = checkin },
                                onOpenGym: {
                                    Task {
                                        openedGym = await model.fetchGym(
                                            id: checkin.gymId
                                        ) ?? GymOption(
                                            id: checkin.gymId,
                                            name: checkin.gymName,
                                            address: checkin.gymAddress,
                                            city: checkin.gymCity,
                                            state: checkin.gymState,
                                            latitude: checkin.gymLatitude,
                                            longitude: checkin.gymLongitude
                                        )
                                    }
                                },
                                onOpenProfile: { openProfile(userId: $0) }
                            )
                        case .activity(let activity):
                            FeedActivityCard(
                                activity: activity,
                                currentUserId: model.currentUserId,
                                onAddPhotos: {
                                    composerActivity = ActivityComposerContext(
                                        id: activity.id,
                                        kind: WorkoutActivityKind(
                                            rawValue: activity.activityType
                                        ) ?? .other,
                                        elapsedS: activity.elapsedS,
                                        workoutDate: activity.workoutDate,
                                        avgHr: activity.avgHr,
                                        activeCalories: activity.activeCalories
                                    )
                                },
                                onOpenGym: activity.gymId == nil ? nil : {
                                    Task {
                                        openedGym = await model.fetchGym(
                                            id: activity.gymId ?? ""
                                        ) ?? activity.gymId.map {
                                            GymOption(
                                                id: $0,
                                                name: activity.gymName ?? "Academia",
                                                latitude: activity.locationLatitude,
                                                longitude: activity.locationLongitude
                                            )
                                        }
                                    }
                                },
                                onOpenProfile: { openProfile(userId: $0) },
                                onOpenDetails: { detailWorkout = activity.workoutDetail }
                            )
                        }
                    }

                    if model.isLoadingMoreFeed {
                        ProgressView()
                            .tint(GymCircleTheme.ColorToken.cyan)
                            .padding(.vertical, 8)
                    }
                }
            }
            .padding(20)
            // Folga pra a barra inferior flutuante não tapar o último post.
            .padding(.bottom, 64)
        }
        // Botão flutuante "Postar treino" removido — a tab central da barra
        // inferior (MainTabView · Tab.post) é a entrada do composer.
        .refreshable {
            await model.refreshFeed()
        }
        // "Adicionar fotos" na entrada de atividade → composer promove a post.
        .sheet(item: $composerActivity) { context in
            NavigationStack {
                ComposerView(
                    model: model,
                    activityContext: context,
                    onPublished: { composerActivity = nil }
                )
            }
        }
        // Tocar nos stats do treino (entrada ou post) → detalhes estilo Apple.
        .sheet(item: $detailWorkout) { detail in
            WorkoutDetailOverlay(detail: detail) { detailWorkout = nil }
        }
        // Re-tap na aba do feed (MainTabView) já estando no feed: sobe ao topo
        // + dá refresh (paridade web scrollFeedToTop + refresh).
        .onChange(of: scrollToTopSignal) { _ in
            withAnimation(.easeOut(duration: 0.3)) {
                proxy.scrollTo(topAnchorID, anchor: .top)
            }
            Task { await model.refreshFeed() }
        }
        } // ScrollViewReader
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                // Anel de streak abre o MyCircle (gesto idêntico ao web).
                Button {
                    myCirclePresented = true
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "flame.fill")
                            .foregroundStyle(
                                myCircle.streakLitToday
                                    ? GymCircleTheme.ColorToken.cyan
                                    : GymCircleTheme.ColorToken.secondaryText
                            )
                        Text("\(myCircle.stats.currentStreak)")
                            .font(.system(size: 15, weight: .black, design: .default))
                            .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                    }
                    .padding(.horizontal, 11)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(GymCircleTheme.ColorToken.elevatedCard))
                }
                .accessibilityLabel(Loc.myCircle)
            }
            // Marca "GYM CIRCLE" no centro (paridade web) — o botão de fogo
            // (atalho do MyCircle) fica à esquerda.
            ToolbarItem(placement: .principal) {
                Text("GYM CIRCLE")
                    .font(.system(size: 11, weight: .black, design: .default))
                    .tracking(2)
                    .foregroundStyle(Color.white.opacity(0.44))
                    .accessibilityHidden(true)
            }
            // Busca + sino em 2 CÍRCULOS separados (paridade web; busca à esquerda),
            // num único ToolbarItem pra o iOS não agrupar num pill só.
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 10) {
                    Button {
                        searchPresented = true
                    } label: {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                            .frame(width: 38, height: 38)
                            .background(Circle().fill(GymCircleTheme.ColorToken.elevatedCard))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(Loc.searchPeople)

                    Button {
                        notificationsPresented = true
                    } label: {
                        Image(systemName: "bell")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                            .frame(width: 38, height: 38)
                            .background(Circle().fill(GymCircleTheme.ColorToken.elevatedCard))
                            .overlay(alignment: .topTrailing) {
                                if model.unreadNotifications > 0 {
                                    Circle()
                                        .fill(GymCircleTheme.ColorToken.pink)
                                        .frame(width: 9, height: 9)
                                        .offset(x: -2, y: 2)
                                }
                            }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(Loc.notifications)
                }
            }
        }
        // Paridade web: título grande "Hoje" (antes vinha "Today" hardcoded).
        .navigationTitle(Loc.t("Today", "Hoje"))
        .sheet(isPresented: $notificationsPresented) {
            NotificationsSheet(model: model)
        }
        .task {
            await model.refreshUnreadNotifications()
            await model.refreshUnreadMessages()
            await model.requestViewerLocation()
            if suggestions.isEmpty {
                suggestions = await model.fetchSuggestions()
            }
        }
        .sheet(item: $commentsPost) { post in
            CommentsSheet(
                post: post,
                service: model.commentsService,
                currentUserId: model.currentUserId,
                onCountDelta: { delta in
                    model.adjustCommentsCount(postId: post.id, delta: delta)
                },
                model: model
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(item: $openedGym) { gym in
            NavigationStack {
                CheckInView(model: model, initialGym: gym)
            }
        }
        .sheet(item: $likesPost) { post in
            LikesSheet(post: post, model: model) { postId in
                await model.fetchPostLikers(postId: postId)
            }
            .presentationDetents([.medium, .large])
        }
        .sheet(item: $openedProfile) { summary in
            OtherProfileHostView(model: model, summary: summary)
        }
        .sheet(isPresented: $searchPresented) {
            PeopleSearchSheet(model: model)
        }
        .sheet(item: $sharingPost) { post in
            SharePostSheet(post: post, model: model)
                .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $myCirclePresented) {
            NavigationStack {
                MyCircleView(
                    data: myCircle,
                    onChangeMonth: { offset in
                        Task { await model.loadCalendarForMonth(offset: offset) }
                    },
                    onLoadRanking: { scope, period in
                        await model.loadRanking(scope, period)
                    },
                    onRegisterWorkout: { dateKey in
                        myCirclePresented = false
                        Task {
                            try? await Task.sleep(nanoseconds: 350_000_000)
                            registerTarget = RegisterWorkoutTarget(dateKey: dateKey)
                        }
                    }
                )
                    .navigationTitle(Loc.myCircle)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button(Loc.close) { myCirclePresented = false }
                                .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                        }
                    }
            }
            .preferredColorScheme(.dark)
        }
        .sheet(item: $registerTarget) { target in
            NavigationStack {
                ComposerView(
                    model: model,
                    workoutDate: target.dateKey,
                    onPublished: { registerTarget = nil }
                )
                .navigationTitle(Loc.t("Log workout", "Registrar treino"))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button(Loc.close) { registerTarget = nil }
                            .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                    }
                }
            }
            .preferredColorScheme(.dark)
        }
        .sheet(item: $editingPost) { post in
            EditPostSheet(model: model, post: post)
        }
        .sheet(item: $editingCheckin) { checkin in
            EditPostSheet(model: model, checkin: checkin)
        }
        .fullScreenCover(item: $playingVideo) { video in
            VideoPlayerScreen(url: video.url)
        }
        .fullScreenCover(item: $openedStoryGroup) { group in
            // Sprint 20.5 — viewer com continuidade entre TODOS os
            // autores da tray, começando no tocado.
            StoryViewerScreen(
                model: model,
                groups: model.stories,
                startAuthorId: group.authorId
            )
        }
        .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
        .navigationTitle(Loc.t("Today", "Hoje"))
    }

    /// Abre o perfil de um user (tap em nome/avatar). Ignora o próprio user
    /// (no web, clicar em si mesmo não navega). Busca o summary e apresenta.
    private func openProfile(userId: String) {
        guard !userId.isEmpty,
              userId.lowercased() != model.currentUserId?.lowercased() else { return }
        Task {
            if let summary = await model.fetchOtherProfileSummary(userId: userId) {
                openedProfile = summary
            }
        }
    }

    /// Tap numa @menção: resolve o username → perfil e apresenta.
    private func openMention(username: String) {
        Task {
            if let summary = await model.fetchOtherProfileSummary(username: username) {
                openedProfile = summary
            }
        }
    }
}

struct PlayableVideo: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

/// Player fullscreen simples (20.3c) — AVKit cuida de controles/AirPlay.
struct VideoPlayerScreen: View {
    let url: URL
    @Environment(\.dismiss) private var dismiss
    @State private var player: AVPlayer?

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()
            if let player {
                VideoPlayer(player: player)
                    .ignoresSafeArea()
            }
            Button {
                player?.pause()
                dismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 30))
                    .foregroundStyle(.white.opacity(0.85))
                    .padding(16)
            }
        }
        .onAppear {
            let avPlayer = AVPlayer(url: url)
            player = avPlayer
            avPlayer.play()
        }
        .onDisappear {
            player?.pause()
        }
    }
}

public struct FeedCheckinCard: View {
    private let checkin: FeedCheckin
    private let currentUserId: String?
    private let onEdit: (() -> Void)?
    private let onOpenGym: (() -> Void)?
    private let onOpenProfile: ((String) -> Void)?

    public init(
        checkin: FeedCheckin,
        currentUserId: String? = nil,
        onEdit: (() -> Void)? = nil,
        onOpenGym: (() -> Void)? = nil,
        onOpenProfile: ((String) -> Void)? = nil
    ) {
        self.checkin = checkin
        self.currentUserId = currentUserId
        self.onEdit = onEdit
        self.onOpenGym = onOpenGym
        self.onOpenProfile = onOpenProfile
    }

    private var isOwnCheckin: Bool {
        currentUserId != nil && checkin.userId == currentUserId
    }

    private var timeLabel: String {
        gymCircleFeedTimeLabel(checkin.createdAt)
    }

    public var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                Button {
                    onOpenProfile?(checkin.userId)
                } label: {
                    GCAvatar(
                        url: checkin.avatarURL,
                        fallback: checkin.username
                    )
                }
                .buttonStyle(.plain)
                .disabled(onOpenProfile == nil)

                VStack(alignment: .leading, spacing: 2) {
                    Button {
                        onOpenProfile?(checkin.userId)
                    } label: {
                        HStack(spacing: 6) {
                            Text(checkin.displayAuthorName)
                                .font(.system(size: 15, weight: .black))
                                .foregroundStyle(
                                    GymCircleTheme.ColorToken.primaryText
                                )
                                .lineLimit(1)
                            if let streak = checkin.authorCurrentStreak,
                               streak > 0 {
                                StreakBadgeView(streak: streak, size: .sm)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .disabled(onOpenProfile == nil)

                    Text("@\(checkin.username) · \(timeLabel)")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.46))
                }

                Spacer()

                Text(Loc.t("Check-in", "Check-in"))
                    .font(.system(size: 10, weight: .black))
                    .tracking(0.8)
                    .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        Capsule().fill(
                            GymCircleTheme.ColorToken.cyan.opacity(0.10)
                        )
                    )
            }

            locationCard

            if isOwnCheckin, let onEdit {
                Button {
                    onEdit()
                } label: {
                    Label(
                        Loc.t(
                            "Add photos and details",
                            "Adicionar fotos e detalhes"
                        ),
                        systemImage: "photo.badge.plus"
                    )
                    .font(.system(size: 13, weight: .black))
                    .foregroundStyle(.black)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(
                        Capsule().fill(GymCircleTheme.ColorToken.cyan)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .background(GymCircleTheme.ColorToken.postCard)
        .clipShape(
            RoundedRectangle(
                cornerRadius: GymCircleTheme.Radius.postCard,
                style: .continuous
            )
        )
        .overlay(
            RoundedRectangle(
                cornerRadius: GymCircleTheme.Radius.postCard,
                style: .continuous
            )
            .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.48), radius: 24, x: 0, y: 16)
    }

    @ViewBuilder
    private var locationCard: some View {
        let content = HStack(spacing: 12) {
            Image(systemName: "mappin.and.ellipse")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(.black)
                .frame(width: 48, height: 48)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(GymCircleTheme.ColorToken.cyan)
                )

            VStack(alignment: .leading, spacing: 2) {
                Text(Loc.t("Checked in at", "Fez check-in em"))
                    .font(.system(size: 11, weight: .black))
                    .textCase(.uppercase)
                    .tracking(0.8)
                    .foregroundStyle(Color.white.opacity(0.42))
                Text(checkin.gymName)
                    .font(.system(size: 16, weight: .black))
                    .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                    .lineLimit(1)
                if !checkin.locationSubtitle.isEmpty {
                    Text(checkin.locationSubtitle)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.46))
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(GymCircleTheme.ColorToken.cyan.opacity(0.055))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(
                    GymCircleTheme.ColorToken.cyan.opacity(0.12),
                    lineWidth: 1
                )
        )

        if let onOpenGym {
            Button(action: onOpenGym) { content }
                .buttonStyle(.plain)
                .accessibilityLabel(
                    Loc.t(
                        "Open \(checkin.gymName) details",
                        "Abrir detalhes de \(checkin.gymName)"
                    )
                )
        } else if let mapsURL = checkin.mapsURL {
            Link(destination: mapsURL) { content }
                .buttonStyle(.plain)
                .accessibilityLabel(
                    Loc.t(
                        "Open \(checkin.gymName) in Maps",
                        "Abrir \(checkin.gymName) no mapa"
                    )
                )
        } else {
            content
        }
    }
}

/// Entrada de atividade no feed (espelho do FeedCheckinCard): treino gravado
/// sem foto, com as mesmas infos de post — legenda, local, tags. "Adicionar
/// fotos" promove a post/carrossel (source_activity_id).
public struct FeedActivityCard: View {
    private let activity: FeedActivity
    private let currentUserId: String?
    private let onAddPhotos: (() -> Void)?
    private let onOpenGym: (() -> Void)?
    private let onOpenProfile: ((String) -> Void)?
    /// Tocar nos stats (área sem botões) → overlay de detalhes (Apple).
    private let onOpenDetails: (() -> Void)?

    public init(
        activity: FeedActivity,
        currentUserId: String? = nil,
        onAddPhotos: (() -> Void)? = nil,
        onOpenGym: (() -> Void)? = nil,
        onOpenProfile: ((String) -> Void)? = nil,
        onOpenDetails: (() -> Void)? = nil
    ) {
        self.activity = activity
        self.currentUserId = currentUserId
        self.onAddPhotos = onAddPhotos
        self.onOpenGym = onOpenGym
        self.onOpenProfile = onOpenProfile
        self.onOpenDetails = onOpenDetails
    }

    private var isOwnActivity: Bool {
        currentUserId != nil && activity.userId == currentUserId
    }

    private var kindLabel: String {
        (WorkoutActivityKind(rawValue: activity.activityType) ?? .other).label
    }

    /// Fase 2: rota gravada → destaque vira distância (e o tempo desce
    /// pra linha secundária junto de ritmo/elevação).
    private var isRouteActivity: Bool {
        (activity.distanceM ?? 0) > 0
    }

    /// Linha secundária: tempo/ritmo/elevação (rota) + bpm/kcal (Saúde).
    private var healthLine: String? {
        var parts: [String] = []
        if isRouteActivity {
            parts.append(gymCircleFormatElapsed(activity.elapsedS))
            if let distance = activity.distanceM {
                let seconds = activity.movingS ?? activity.elapsedS
                if distance > 50, seconds > 0 {
                    parts.append(
                        gymCircleFormatPace(Int((Double(seconds) / (distance / 1000)).rounded()))
                    )
                }
            }
            if let gain = activity.elevationGainM, gain >= 1 {
                parts.append("\(Int(gain.rounded())) m")
            }
        }
        if let avgHr = activity.avgHr { parts.append("\(avgHr) bpm") }
        if let kcal = activity.totalCalories ?? activity.activeCalories {
            parts.append("\(Int(kcal.rounded())) kcal")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Button {
                    onOpenProfile?(activity.userId)
                } label: {
                    GCAvatar(
                        url: activity.avatarURL,
                        fallback: activity.username
                    )
                }
                .buttonStyle(.plain)
                .disabled(onOpenProfile == nil)

                VStack(alignment: .leading, spacing: 2) {
                    Button {
                        onOpenProfile?(activity.userId)
                    } label: {
                        HStack(spacing: 6) {
                            Text(activity.displayAuthorName)
                                .font(.system(size: 15, weight: .black))
                                .foregroundStyle(
                                    GymCircleTheme.ColorToken.primaryText
                                )
                                .lineLimit(1)
                            if let streak = activity.authorCurrentStreak,
                               streak > 0 {
                                StreakBadgeView(streak: streak, size: .sm)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .disabled(onOpenProfile == nil)

                    Text("@\(activity.username) · \(gymCircleFeedTimeLabel(activity.createdAt))")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.46))
                }

                Spacer()

                Text(Loc.t("Workout", "Treino"))
                    .font(.system(size: 10, weight: .black))
                    .tracking(0.8)
                    .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        Capsule().fill(
                            GymCircleTheme.ColorToken.cyan.opacity(0.10)
                        )
                    )
            }

            if let onOpenDetails {
                Button(action: onOpenDetails) {
                    statsCard
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Loc.t("Workout details", "Detalhes do treino"))
            } else {
                statsCard
            }

            // Mini-mapa (sketch da rota) — polyline, sem tiles: consistente
            // com o web e sem dependência de mapa.
            if let route = activity.route, route.count >= 2 {
                RouteSketchView(points: route)
                    .frame(height: 96)
                    .frame(maxWidth: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .fill(GymCircleTheme.ColorToken.cyan.opacity(0.045))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .stroke(GymCircleTheme.ColorToken.cyan.opacity(0.10), lineWidth: 1)
                    )
            }

            if let caption = activity.caption, !caption.isEmpty {
                (
                    Text(activity.username)
                        .font(.system(size: 13.5, weight: .black))
                    + Text(" \(caption)")
                        .font(.system(size: 13.5, weight: .semibold))
                )
                .foregroundStyle(Color.white.opacity(0.86))
                .fixedSize(horizontal: false, vertical: true)
            }

            if let locationLabel = activity.locationLabel {
                locationRow(locationLabel)
            }

            if isOwnActivity, let onAddPhotos {
                Button {
                    onAddPhotos()
                } label: {
                    Label(
                        Loc.t("Add photos", "Adicionar fotos"),
                        systemImage: "photo.badge.plus"
                    )
                    .font(.system(size: 13, weight: .black))
                    .foregroundStyle(.black)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(
                        Capsule().fill(GymCircleTheme.ColorToken.cyan)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .background(GymCircleTheme.ColorToken.postCard)
        .clipShape(
            RoundedRectangle(
                cornerRadius: GymCircleTheme.Radius.postCard,
                style: .continuous
            )
        )
        .overlay(
            RoundedRectangle(
                cornerRadius: GymCircleTheme.Radius.postCard,
                style: .continuous
            )
            .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.48), radius: 24, x: 0, y: 16)
    }

    private var statsCard: some View {
        HStack(spacing: 12) {
            Image(systemName: "timer")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(.black)
                .frame(width: 48, height: 48)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(GymCircleTheme.ColorToken.cyan)
                )

            VStack(alignment: .leading, spacing: 2) {
                Text(kindLabel)
                    .font(.system(size: 11, weight: .black))
                    .textCase(.uppercase)
                    .tracking(0.8)
                    .foregroundStyle(Color.white.opacity(0.42))
                Text(
                    isRouteActivity && activity.distanceM != nil
                        ? gymCircleFormatKm(activity.distanceM ?? 0)
                        : gymCircleFormatElapsed(activity.elapsedS)
                )
                    .font(.system(size: 20, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                if let healthLine {
                    Text(healthLine)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.46))
                }
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(GymCircleTheme.ColorToken.cyan.opacity(0.055))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(
                    GymCircleTheme.ColorToken.cyan.opacity(0.12),
                    lineWidth: 1
                )
        )
    }

    @ViewBuilder
    private func locationRow(_ label: String) -> some View {
        let content = HStack(spacing: 6) {
            Image(systemName: "mappin.and.ellipse")
                .font(.system(size: 12, weight: .bold))
            Text(label)
                .font(.system(size: 12, weight: .bold))
                .lineLimit(1)
        }
        .foregroundStyle(Color.white.opacity(0.48))

        if let onOpenGym {
            Button(action: onOpenGym) { content }
                .buttonStyle(.plain)
                .accessibilityLabel(
                    Loc.t("Open \(label) details", "Abrir detalhes de \(label)")
                )
        } else {
            content
        }
    }
}

/// Sketch da rota (Fase 2): polyline normalizada, traço cyan + pontos de
/// início/fim. Sem tiles de mapa de propósito — leve e igual ao web.
struct RouteSketchView: View {
    let points: [[Double]]

    var body: some View {
        Canvas { context, size in
            let coords = points.compactMap { pair -> (lat: Double, lng: Double)? in
                guard pair.count >= 2 else { return nil }
                return (pair[0], pair[1])
            }
            guard coords.count >= 2,
                  let minLat = coords.map(\.lat).min(),
                  let maxLat = coords.map(\.lat).max(),
                  let minLng = coords.map(\.lng).min(),
                  let maxLng = coords.map(\.lng).max()
            else { return }
            let spanLat = max(maxLat - minLat, 0.0001)
            let spanLng = max(maxLng - minLng, 0.0001)
            let padding: CGFloat = 14
            let drawW = size.width - padding * 2
            let drawH = size.height - padding * 2
            // Mantém a proporção da rota (sem esticar).
            let scale = min(drawW / spanLng, drawH / spanLat)
            let offsetX = padding + (drawW - spanLng * scale) / 2
            let offsetY = padding + (drawH - spanLat * scale) / 2

            func point(_ coord: (lat: Double, lng: Double)) -> CGPoint {
                CGPoint(
                    x: offsetX + (coord.lng - minLng) * scale,
                    y: offsetY + (maxLat - coord.lat) * scale
                )
            }

            var path = Path()
            path.move(to: point(coords[0]))
            for coord in coords.dropFirst() {
                path.addLine(to: point(coord))
            }
            context.stroke(
                path,
                with: .color(GymCircleTheme.ColorToken.cyan),
                style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round)
            )
            let start = point(coords[0])
            let end = point(coords[coords.count - 1])
            context.fill(
                Path(ellipseIn: CGRect(x: start.x - 3.5, y: start.y - 3.5, width: 7, height: 7)),
                with: .color(GymCircleTheme.ColorToken.cyan)
            )
            context.fill(
                Path(ellipseIn: CGRect(x: end.x - 3.5, y: end.y - 3.5, width: 7, height: 7)),
                with: .color(.white)
            )
        }
        .accessibilityLabel(Loc.t("Workout route", "Rota do treino"))
    }
}

public struct FeedPostCard: View {
    private let post: FeedPost
    private let currentUserId: String?
    private let viewerCoordinate: GymCircleCoordinate?
    private let onLike: (() -> Void)?
    private let onComments: (() -> Void)?
    private let onOpenLikes: (() -> Void)?
    private let onMute: (() -> Void)?
    private let onReport: (() -> Void)?
    private let onDelete: (() -> Void)?
    private let onEdit: (() -> Void)?
    private let onRespondInvite: ((Bool) -> Void)?
    private let onPlayVideo: ((URL) -> Void)?
    private let onShare: (() -> Void)?
    private let onOpenGym: (() -> Void)?
    private let onOpenProfile: ((String) -> Void)?
    private let onOpenMention: ((String) -> Void)?
    /// P0.1 — post promovido de treino: abre o overlay de detalhes (Apple).
    private let onOpenWorkoutDetail: (() -> Void)?

    @State private var confirmDelete = false
    // Double-tap-to-like (Instagram): coração estoura no centro da mídia.
    @State private var heartBurst = false

    public init(
        post: FeedPost,
        currentUserId: String? = nil,
        viewerCoordinate: GymCircleCoordinate? = nil,
        onLike: (() -> Void)? = nil,
        onComments: (() -> Void)? = nil,
        onOpenLikes: (() -> Void)? = nil,
        onMute: (() -> Void)? = nil,
        onReport: (() -> Void)? = nil,
        onDelete: (() -> Void)? = nil,
        onEdit: (() -> Void)? = nil,
        onRespondInvite: ((Bool) -> Void)? = nil,
        onPlayVideo: ((URL) -> Void)? = nil,
        onShare: (() -> Void)? = nil,
        onOpenGym: (() -> Void)? = nil,
        onOpenProfile: ((String) -> Void)? = nil,
        onOpenMention: ((String) -> Void)? = nil,
        onOpenWorkoutDetail: (() -> Void)? = nil
    ) {
        self.post = post
        self.currentUserId = currentUserId
        self.viewerCoordinate = viewerCoordinate
        self.onLike = onLike
        self.onComments = onComments
        self.onOpenLikes = onOpenLikes
        self.onMute = onMute
        self.onReport = onReport
        self.onDelete = onDelete
        self.onEdit = onEdit
        self.onRespondInvite = onRespondInvite
        self.onPlayVideo = onPlayVideo
        self.onShare = onShare
        self.onOpenGym = onOpenGym
        self.onOpenProfile = onOpenProfile
        self.onOpenMention = onOpenMention
        self.onOpenWorkoutDetail = onOpenWorkoutDetail
    }

    private var isOwnPost: Bool {
        currentUserId != nil && post.userId == currentUserId
    }

    /// Sprint 20.7 — anexa a distância do viewer ao local (quando há coords +
    /// permissão). Paridade web FeedScreen distance.
    private func distanceSuffixed(_ location: String) -> String {
        guard let viewerCoordinate, let postCoordinate = post.coordinate else { return location }
        let km = NativeLocationProvider.distanceKm(from: viewerCoordinate, to: postCoordinate)
        return "\(location) · \(NativeLocationProvider.formattedDistanceKm(km))"
    }

    /// Hora do post (paridade formatTime web): HH:mm se hoje, senão "Nd".
    private var postTimeLabel: String {
        gymCircleFeedTimeLabel(post.createdAt)
    }

    public var body: some View {
        // Paridade SocialPostCard web (Fase 2): card edge-to-edge — mídia colada
        // nas bordas, header/ações com padding próprio (px-4 py-3.5 = 16/14),
        // raio 32, bg #0c0d0e, borda branca 8% e shadow. (Antes: GCCard padded,
        // mídia flutuando dentro.)
        VStack(spacing: 0) {
            header
                .padding(.horizontal, 16)
                .padding(.vertical, 14)

            // P0.1 — post promovido de treino: faixa tocável (área sem botões)
            // → overlay de detalhes estilo Apple. Só quando há métricas.
            if let detail = post.workoutDetail, let onOpenWorkoutDetail {
                Button(action: onOpenWorkoutDetail) {
                    HStack(spacing: 12) {
                        Image(systemName: (detail.distanceM ?? 0) > 0 ? "map.fill" : "timer")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(.black)
                            .frame(width: 34, height: 34)
                            .background(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(GymCircleTheme.ColorToken.cyan)
                            )
                        Text(
                            (detail.distanceM ?? 0) > 0
                                ? gymCircleFormatKm(detail.distanceM ?? 0)
                                : gymCircleFormatElapsed(detail.elapsedS)
                        )
                        .font(.system(size: 13, weight: .black))
                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                        Text(Loc.t("Workout Details", "Detalhes do Exercício"))
                            .font(.system(size: 12.5, weight: .bold))
                            .foregroundStyle(Color.white.opacity(0.45))
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .black))
                            .foregroundStyle(Color.white.opacity(0.4))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(GymCircleTheme.ColorToken.cyan.opacity(0.06))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(GymCircleTheme.ColorToken.cyan.opacity(0.12), lineWidth: 1)
                    )
                    .padding(.horizontal, 16)
                    .padding(.bottom, 12)
                }
                .buttonStyle(.plain)
            }

            // Double-tap-to-like (Instagram, paridade web): duplo toque na mídia
            // curte (só curte, nunca descurte) e estoura o coração electric blue.
            ZStack {
                PostCarouselView(
                    items: post.carouselItems,
                    aspectRatio: mediaAspectRatio,
                    onPlayVideo: onPlayVideo
                )
                if heartBurst {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 96, weight: .bold))
                        .foregroundStyle(GymCircleTheme.ColorToken.electricBlue)
                        .shadow(
                            color: GymCircleTheme.ColorToken.electricBlue.opacity(0.6),
                            radius: 28
                        )
                        .transition(.scale(scale: 0.5).combined(with: .opacity))
                        .allowsHitTesting(false)
                }
            }
            // highPriority: o duplo-toque vence o tap-de-pausa do vídeo / paging
            // do carrossel; o toque ÚNICO continua passando pro player.
            .highPriorityGesture(
                TapGesture(count: 2).onEnded { likeFromDoubleTap() }
            )

            VStack(alignment: .leading, spacing: 12) {
                participantsRow
                pendingInviteBanner
                actionsRow
                // Curtidas → legenda → último comentário → "ver todos" (ordem do
                // card web, estilo Instagram).
                VStack(alignment: .leading, spacing: 4) {
                    likesLine
                    if let caption = post.caption, !caption.isEmpty {
                        // @menções realçadas + clicáveis (paridade web MentionText).
                        MentionText(text: caption) { onOpenMention?($0) }
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    commentPreviewLine
                    commentsLine
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
        .background(GymCircleTheme.ColorToken.postCard)
        .clipShape(RoundedRectangle(cornerRadius: GymCircleTheme.Radius.postCard, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: GymCircleTheme.Radius.postCard, style: .continuous)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.48), radius: 24, x: 0, y: 16)
        .confirmationDialog(Loc.deletePostConfirm, isPresented: $confirmDelete, titleVisibility: .visible) {
            Button(Loc.deletePost, role: .destructive) { onDelete?() }
            Button(Loc.cancel, role: .cancel) {}
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            // Avatar abre o perfil do autor (paridade web onSelectUser).
            Button { onOpenProfile?(post.userId) } label: {
                GCAvatar(url: post.avatarURL, fallback: post.username)
            }
            .buttonStyle(.plain)
            .disabled(onOpenProfile == nil)

            VStack(alignment: .leading, spacing: 2) {
                // Nome + streak abrem o perfil.
                Button { onOpenProfile?(post.userId) } label: {
                    HStack(spacing: 6) {
                        // Paridade web: nome 15px font-black.
                        Text(post.displayAuthorName)
                            .font(.system(size: 15, weight: .black, design: .default))
                            .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                            .lineLimit(1)
                        // StreakBadge (ícone por nível + "{N}d") AO LADO do nome,
                        // componente compartilhado com os stories (paridade web).
                        if let streak = post.authorCurrentStreak, streak > 0 {
                            StreakBadgeView(streak: streak, size: .sm)
                        }
                    }
                }
                .buttonStyle(.plain)
                .disabled(onOpenProfile == nil)

                // Meta: "📍 local · distância · hora". O local vira link do Google
                // Maps quando há URL (paridade web — link separado, fora do botão
                // de perfil); a hora sempre aparece, o pin só quando há local.
                metaRow
            }

            Spacer()

            // Sprint 20.3c — menu do post (paridade PostMenuSheet web).
            Menu {
                if isOwnPost {
                    Button {
                        onEdit?()
                    } label: {
                        Label(Loc.editPost, systemImage: "pencil")
                    }
                    Button(role: .destructive) {
                        confirmDelete = true
                    } label: {
                        Label(Loc.deletePost, systemImage: "trash")
                    }
                } else {
                    Button {
                        onMute?()
                    } label: {
                        Label(Loc.muteUser(post.username), systemImage: "speaker.slash")
                    }
                    Button(role: .destructive) {
                        onReport?()
                    } label: {
                        Label(Loc.reportPost, systemImage: "exclamationmark.bubble")
                    }
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                    .frame(width: 38, height: 38)
                    .background(Circle().fill(Color.white.opacity(0.055)))
                    .overlay(Circle().strokeBorder(Color.white.opacity(0.08), lineWidth: 1))
            }
        }
    }

    /// Linha de meta do header: local (link do Maps quando há URL) · distância · hora.
    private var metaRow: some View {
        HStack(spacing: 4) {
            if let location = post.locationName, !location.isEmpty {
                locationLabel(location)
                Text("·").foregroundStyle(Color.white.opacity(0.28))
            }
            Text(postTimeLabel)
        }
        .font(.system(size: 12, weight: .bold, design: .default))
        .foregroundStyle(Color.white.opacity(0.46))
    }

    /// O label do local: vira `Link` do Google Maps quando o post tem URL,
    /// senão texto simples (paridade web — a localização abre o mapa).
    @ViewBuilder
    private func locationLabel(_ location: String) -> some View {
        let content = HStack(spacing: 4) {
            Image(systemName: "mappin.and.ellipse")
                .font(.system(size: 10, weight: .bold))
            Text(distanceSuffixed(location))
                .lineLimit(1)
        }
        if post.gymId != nil, let onOpenGym {
            Button(action: onOpenGym) { content }
                .buttonStyle(.plain)
        } else if let urlString = post.locationGoogleMapsUrl, let url = URL(string: urlString) {
            Link(destination: url) { content }
        } else {
            content
        }
    }

    @ViewBuilder
    private var participantsRow: some View {
        let accepted = post.acceptedParticipants
        if !accepted.isEmpty {
            HStack(spacing: 6) {
                Image(systemName: "person.2.fill")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                GCText(
                    Loc.withPeople(accepted.map(\.displayedName).joined(separator: ", ")),
                    style: .caption,
                    color: GymCircleTheme.ColorToken.secondaryText
                )
            }
        }
    }

    @ViewBuilder
    private var pendingInviteBanner: some View {
        if post.pendingInvite(for: currentUserId) != nil {
            HStack(spacing: 10) {
                GCText(Loc.taggedInWorkout, style: .caption)
                Spacer()
                Button(Loc.accept) { onRespondInvite?(true) }
                    .font(.system(size: 13, weight: .black, design: .default))
                    .foregroundStyle(.black)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(GymCircleTheme.ColorToken.cyan))
                Button(Loc.decline) { onRespondInvite?(false) }
                    .font(.system(size: 13, weight: .bold, design: .default))
                    .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
            }
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(GymCircleTheme.ColorToken.quietBlue)
            )
            .buttonStyle(.plain)
        }
    }

    // Paridade web: action row só com ÍCONES (44px, gap 8), contadores viram
    // linhas estilo Instagram abaixo. workoutType = chip pill.
    private var actionsRow: some View {
        HStack(spacing: 8) {
            Button {
                onLike?()
            } label: {
                Image(systemName: post.likedByMe == true ? "heart.fill" : "heart")
                    .foregroundStyle(
                        post.likedByMe == true
                            ? GymCircleTheme.ColorToken.electricBlue
                            : GymCircleTheme.ColorToken.primaryText
                    )
                    // curtido = azul (--gc-blue) com glow, como no web.
                    .shadow(
                        color: post.likedByMe == true
                            ? GymCircleTheme.ColorToken.electricBlue.opacity(0.55)
                            : .clear,
                        radius: 9
                    )
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Color.white.opacity(0.055)))
                    .overlay(Circle().strokeBorder(Color.white.opacity(0.08), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(post.likedByMe == true ? Loc.unlike : Loc.like)

            Button {
                onComments?()
            } label: {
                Image(systemName: "message")
                    .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Color.white.opacity(0.055)))
                    .overlay(Circle().strokeBorder(Color.white.opacity(0.08), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Loc.comments)

            // Paridade web: compartilhar o post por mensagem (Send/paperplane).
            Button {
                onShare?()
            } label: {
                Image(systemName: "paperplane")
                    .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Color.white.opacity(0.055)))
                    .overlay(Circle().strokeBorder(Color.white.opacity(0.08), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Loc.t("Share workout", "Compartilhar treino"))

            Spacer()
            if let workoutType = post.workoutType, !workoutType.isEmpty {
                Text(workoutType)
                    .font(.system(size: 12, weight: .bold, design: .default))
                    .foregroundStyle(Color.white.opacity(0.72))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Color.white.opacity(0.06)))
            }
        }
        .font(.system(size: 19, weight: .medium, design: .default))
    }

    /// Linha "N curtidas" (estilo Instagram, paridade web) — até 3 avatares
    /// sobrepostos de quem curtiu (RPC liked_by_preview) + o contador; abre
    /// quem curtiu.
    @ViewBuilder
    private var likesLine: some View {
        if post.likesCount > 0 {
            Button {
                onOpenLikes?()
            } label: {
                HStack(spacing: 6) {
                    if let likers = post.likedByPreview, !likers.isEmpty {
                        HStack(spacing: -8) {
                            ForEach(likers.prefix(3)) { liker in
                                GCAvatar(url: liker.avatarURL, fallback: liker.username, size: 20)
                                    .overlay(
                                        Circle().strokeBorder(GymCircleTheme.ColorToken.postCard, lineWidth: 2)
                                    )
                            }
                        }
                    }
                    Text(
                        post.likesCount == 1
                            ? Loc.t("1 like", "1 curtida")
                            : Loc.t("\(post.likesCount) likes", "\(post.likesCount) curtidas")
                    )
                    .font(.system(size: 13, weight: .black, design: .default))
                    .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Loc.seeWhoLiked)
        }
    }

    /// Preview do último comentário (paridade web: "username corpo", abre o
    /// sheet de comentários). Vem do RPC (comment_previews).
    @ViewBuilder
    private var commentPreviewLine: some View {
        if let preview = post.commentPreviews?.last {
            Button {
                onComments?()
            } label: {
                (
                    Text(preview.username)
                        .font(.system(size: 14, weight: .black, design: .default))
                        .foregroundColor(GymCircleTheme.ColorToken.primaryText)
                    + Text(" ")
                    + Text(preview.body)
                        .font(.system(size: 14, weight: .semibold, design: .default))
                        .foregroundColor(Color.white.opacity(0.92))
                )
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(preview.username): \(preview.body)")
        }
    }

    /// Linha "Ver os N comentários" (paridade web) — abre o sheet de comentários.
    @ViewBuilder
    private var commentsLine: some View {
        if post.commentsCount > 0 {
            Button {
                onComments?()
            } label: {
                Text(
                    post.commentsCount == 1
                        ? Loc.t("View 1 comment", "Ver 1 comentário")
                        : Loc.t("View all \(post.commentsCount) comments", "Ver os \(post.commentsCount) comentários")
                )
                .font(.system(size: 13, weight: .bold, design: .default))
                .foregroundStyle(Color.white.opacity(0.46))
            }
            .buttonStyle(.plain)
        }
    }

    /// Duplo-toque na mídia = curtir (estilo Instagram). SÓ curte (nunca
    /// descurte no duplo-toque); o coração estoura sempre como feedback.
    private func likeFromDoubleTap() {
        Haptics.success()
        if post.likedByMe != true { onLike?() }
        withAnimation(.spring(response: 0.32, dampingFraction: 0.6)) { heartBurst = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.55) {
            withAnimation(.easeOut(duration: 0.28)) { heartBurst = false }
        }
    }

    private var mediaAspectRatio: CGFloat {
        // Carrossel: frame fixo 4:5 (Sprint 13 — o trilho não pula entre
        // slides de aspectos diferentes). Mídia única adota o natural.
        if post.carouselItems.count > 1 { return 4 / 5 }
        guard let width = post.mediaWidth, let height = post.mediaHeight, height > 0 else {
            return 4 / 5
        }
        return CGFloat(width) / CGFloat(height)
    }
}

/// Carrossel de mídias com dots ABAIXO (estilo Instagram, paridade
/// Sprint 14 web). 1 item = render direto sem paging nem dots.
public struct PostCarouselView: View {
    private let items: [PostMediaItem]
    private let aspectRatio: CGFloat
    private let onPlayVideo: ((URL) -> Void)?
    @State private var currentIndex = 0

    public init(
        items: [PostMediaItem],
        aspectRatio: CGFloat,
        onPlayVideo: ((URL) -> Void)? = nil
    ) {
        self.items = items
        self.aspectRatio = aspectRatio
        self.onPlayVideo = onPlayVideo
    }

    public var body: some View {
        if items.count <= 1 {
            mediaView(for: items.first)
        } else {
            VStack(spacing: 10) {
                TabView(selection: $currentIndex) {
                    ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                        mediaView(for: item)
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .aspectRatio(aspectRatio, contentMode: .fit)
                // Contador "N/total" no topo-direito (paridade MediaCarousel web).
                .overlay(alignment: .topTrailing) {
                    Text("\(currentIndex + 1)/\(items.count)")
                        .font(.system(size: 11, weight: .black, design: .default))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(Color.black.opacity(0.56)))
                        .padding(12)
                }

                HStack(spacing: 5) {
                    ForEach(items.indices, id: \.self) { index in
                        Circle()
                            .fill(
                                index == currentIndex
                                    ? GymCircleTheme.ColorToken.cyan
                                    : GymCircleTheme.ColorToken.secondaryText.opacity(0.35)
                            )
                            .frame(width: 6, height: 6)
                            .animation(.easeOut(duration: 0.18), value: currentIndex)
                    }
                }
                .frame(maxWidth: .infinity)
                .accessibilityLabel(Loc.mediaOf(currentIndex + 1, items.count))
            }
        }
    }

    @ViewBuilder
    private func mediaView(for item: PostMediaItem?) -> some View {
        // Vídeo toca INLINE (paridade web/Instagram): autoplay quando visível,
        // pausa ao sair da tela, tap pausa, começa mudo + botão de som. Antes
        // mostrava poster + tap abria player fullscreen.
        if item?.mediaType == .video, let item, let videoURL = URL(string: item.imageURL) {
            InlineVideoPlayerView(
                videoURL: videoURL,
                posterURL: item.posterURL ?? item.thumbnailURL,
                aspectRatio: aspectRatio
            )
        } else {
            mediaImage(for: item)
        }
    }

    @ViewBuilder
    private func mediaImage(for item: PostMediaItem?) -> some View {
        // Progressivo: thumbnail (displayURL ≈720px) aparece rápido e o
        // original (feedURL ≈1600px) entra por cima com fade-in suave.
        MediaView(
            thumbURL: item?.displayURL ?? "",
            fullURL: item?.feedURL ?? "",
            aspectRatio: aspectRatio,
            isVideo: false
        )
    }
}

/// Pinch-to-"peek" zoom (paridade PinchZoomImage web): a pinça amplia a foto
/// de 1→3 e ao soltar volta suave pra escala 1 — não é zoom persistente.
/// Só em imagem; vídeo mantém o tap-to-play. MagnificationGesture roda no
/// iOS 16+ (deploy target do app).
///
/// IMPORTANTE (bug de device, Sprint 22.x): NÃO usar DragGesture pra pan. Um
/// DragGesture (mesmo via simultaneousGesture e no-op em repouso) captura o
/// toque de 1 dedo e TRAVA o scroll vertical do feed e o swipe horizontal do
/// carrossel (TabView). A pinça é 2 dedos e não conflita com gestos de 1 dedo,
/// então só ela fica. Sem pan: o zoom é centralizado e volta ao soltar (peek),
/// como o feed do Instagram — o pan ampliado é sacrificado pra não quebrar o
/// scroll/swipe.
private struct PinchToPeekModifier: ViewModifier {
    let enabled: Bool
    @State private var scale: CGFloat = 1

    private let maxScale: CGFloat = 3

    func body(content: Content) -> some View {
        guard enabled else { return AnyView(content) }
        return AnyView(
            content
                .scaleEffect(scale, anchor: .center)
                .gesture(
                    MagnificationGesture()
                        .onChanged { value in
                            // value começa em 1 e cresce; como sempre voltamos
                            // pra 1 ao soltar, ele mapeia direto pra escala
                            // absoluta. Trava em [1, 3] (= MIN/MAX_SCALE web).
                            scale = min(max(value, 1), maxScale)
                        }
                        .onEnded { _ in
                            withAnimation(.spring(response: 0.32, dampingFraction: 0.82)) {
                                scale = 1
                            }
                        }
                )
        )
    }
}

extension View {
    /// Habilita o pinch-to-peek (zoom temporário) numa mídia de imagem.
    func pinchToPeek(enabled: Bool) -> some View {
        modifier(PinchToPeekModifier(enabled: enabled))
    }
}

/// Carregamento PROGRESSIVO (paridade web blur→thumb→full): o thumbnail
/// (~720px) aparece quase na hora e segura a imagem; o original (~1600px)
/// entra por cima com fade-in suave quando termina de carregar. Se não há
/// thumb distinta, cai num único load (sem requisição duplicada).
public struct MediaView: View {
    private let thumbURL: String
    private let fullURL: String
    private let aspectRatio: CGFloat
    private let isVideo: Bool

    public init(thumbURL: String, fullURL: String, aspectRatio: CGFloat, isVideo: Bool = false) {
        self.thumbURL = thumbURL
        self.fullURL = fullURL
        self.aspectRatio = aspectRatio
        self.isVideo = isVideo
    }

    /// Conveniência (grids/composer/stories): uma URL só, sem progressivo.
    public init(url: String, aspectRatio: CGFloat, isVideo: Bool = false) {
        self.init(thumbURL: url, fullURL: url, aspectRatio: aspectRatio, isVideo: isVideo)
    }

    private var hasDistinctFull: Bool {
        !fullURL.isEmpty && fullURL != thumbURL
    }

    public var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 0, style: .continuous)
                .fill(GymCircleTheme.ColorToken.elevatedCard)

            // Base: thumbnail (carrega rápido). Quando não há thumb distinta,
            // esta é a própria imagem original. Cache memória+disco via
            // GCRemoteImage (não pisca ao rolar de volta).
            if let thumb = URL(string: thumbURL), !thumbURL.isEmpty {
                GCRemoteImage(url: thumb, animateOnLoad: false) {
                    Image(systemName: "photo")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                }
            }

            // Original por cima — fade-in suave ao terminar de carregar.
            if hasDistinctFull, let full = URL(string: fullURL) {
                GCRemoteImage(url: full) { Color.clear }
            }

            if isVideo {
                Image(systemName: "play.circle.fill")
                    .font(.system(size: 44, weight: .bold))
                    .foregroundStyle(.white.opacity(0.9))
                    .shadow(radius: 8)
            }
        }
        // Zoom temporário (pinch-to-peek) só em imagem. Aplicado ANTES do
        // aspectRatio/clip pra a foto ampliada ficar recortada no retângulo
        // da mídia (não vaza pro card).
        .pinchToPeek(enabled: !isVideo)
        .aspectRatio(aspectRatio, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 0, style: .continuous))
        .clipped()
    }
}

/// Picker de destinatário pra compartilhar o post por mensagem (paridade do
/// share sheet do SocialPostCard web). Lista quem você segue; tap envia a DM.
public struct SharePostSheet: View {
    private let post: FeedPost
    @ObservedObject private var model: GymCircleAppModel
    @Environment(\.dismiss) private var dismiss

    @State private var people: [DiscoveredProfile] = []
    @State private var isLoading = true
    @State private var sendingTo: String?
    @State private var sentTo: Set<String> = []

    public init(post: FeedPost, model: GymCircleAppModel) {
        self.post = post
        self.model = model
    }

    public var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView().tint(GymCircleTheme.ColorToken.cyan)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if people.isEmpty {
                    GCEmptyState(
                        title: Loc.t("No one to send to", "Ninguém pra enviar"),
                        subtitle: Loc.t("Follow people to share workouts by message.",
                                        "Siga pessoas pra enviar treinos por mensagem.")
                    )
                } else {
                    List(people) { person in
                        Button {
                            Task { await send(to: person) }
                        } label: {
                            HStack(spacing: 12) {
                                GCAvatar(url: person.avatarURL, fallback: person.username ?? "user", size: 40)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(person.displayedName)
                                        .font(.system(size: 15, weight: .black, design: .default))
                                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                                    if let username = person.username {
                                        Text("@\(username)")
                                            .font(.system(size: 12, weight: .bold, design: .default))
                                            .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                                    }
                                }
                                Spacer()
                                if sentTo.contains(person.userId) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                                } else if sendingTo == person.userId {
                                    ProgressView().tint(GymCircleTheme.ColorToken.cyan)
                                } else {
                                    Image(systemName: "paperplane.fill")
                                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                                }
                            }
                        }
                        .disabled(sendingTo != nil || sentTo.contains(person.userId))
                        .listRowBackground(GymCircleTheme.ColorToken.card)
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle(Loc.t("Send to", "Enviar para"))
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
            people = await model.loadFollowingProfiles()
            isLoading = false
        }
    }

    private func send(to person: DiscoveredProfile) async {
        sendingTo = person.userId
        let ok = await model.sharePostToChat(post: post, receiverId: person.userId)
        sendingTo = nil
        if ok {
            sentTo.insert(person.userId)
            Haptics.success()
        }
    }
}

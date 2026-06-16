import SwiftUI
import AVKit

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
    @State private var sharingPost: FeedPost?
    @State private var searchPresented = false
    @State private var notificationsPresented = false
    @State private var composerPresented = false
    @State private var playingVideo: PlayableVideo?
    // Sprint 20.5 — autor cujo story foi aberto na tray.
    @State private var openedStoryGroup: StoryAuthorGroup?

    public init(model: GymCircleAppModel, myCircle: MyCircleViewData) {
        self.model = model
        self.myCircle = myCircle
    }

    public var body: some View {
        ScrollView {
            LazyVStack(spacing: 18) {
                StoriesTrayView(groups: model.stories, isLoading: false) { group in
                    openedStoryGroup = group
                }

                if model.isLoading && model.posts.isEmpty {
                    GCFeedSkeleton()
                } else if model.posts.isEmpty {
                    GCEmptyState(
                        title: Loc.feedEmptyTitle,
                        subtitle: Loc.feedEmptySubtitle
                    )
                } else {
                    ForEach(model.posts) { post in
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
                                Task { await model.reportPost(postId: post.id, authorId: post.userId) }
                            },
                            onDelete: {
                                Task { await model.deletePost(postId: post.id) }
                            },
                            onEdit: { editingPost = post },
                            onRespondInvite: { accepted in
                                Haptics.impactLight()
                                Task { await model.respondToInvite(postId: post.id, accepted: accepted) }
                            },
                            onPlayVideo: { url in
                                playingVideo = PlayableVideo(url: url)
                            },
                            onShare: { sharingPost = post }
                        )
                        .onAppear {
                            // Dispara o load more no penúltimo post (espelho
                            // do IntersectionObserver da web).
                            let posts = model.posts
                            if posts.count >= 2, post.id == posts[posts.count - 2].id {
                                Task { await model.loadMoreFeed() }
                            }
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
            // Paridade web FloatingCreatePostButton: espaço pro botão não tapar
            // o último post.
            .padding(.bottom, 64)
        }
        // Botão flutuante "Postar treino" (paridade web) — cyan, glow, abre o composer.
        .overlay(alignment: .bottom) {
            Button {
                composerPresented = true
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 16, weight: .heavy))
                    Text(Loc.t("Post workout", "Postar treino"))
                        .font(.system(size: 14, weight: .black, design: .default))
                }
                .foregroundStyle(.black)
                .padding(.horizontal, 20)
                .frame(height: 52)
                .background(Capsule().fill(GymCircleTheme.ColorToken.cyan))
                .shadow(color: GymCircleTheme.ColorToken.cyan.opacity(0.28), radius: 18, x: 0, y: 8)
                .shadow(color: .black.opacity(0.42), radius: 20, x: 0, y: 12)
            }
            .buttonStyle(PressableButtonStyle())
            .padding(.bottom, 14)
        }
        .sheet(isPresented: $composerPresented) {
            NavigationStack { ComposerView(model: model) }
                .preferredColorScheme(.dark)
        }
        .refreshable {
            await model.refreshFeed()
        }
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
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    notificationsPresented = true
                } label: {
                    Image(systemName: "bell")
                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                        .overlay(alignment: .topTrailing) {
                            if model.unreadNotifications > 0 {
                                Circle()
                                    .fill(GymCircleTheme.ColorToken.pink)
                                    .frame(width: 9, height: 9)
                                    .offset(x: 3, y: -3)
                            }
                        }
                }
                .accessibilityLabel(Loc.notifications)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    searchPresented = true
                } label: {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                }
                .accessibilityLabel(Loc.searchPeople)
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
        }
        .sheet(item: $commentsPost) { post in
            CommentsSheet(
                post: post,
                service: model.commentsService,
                currentUserId: model.currentUserId,
                onCountDelta: { delta in
                    model.adjustCommentsCount(postId: post.id, delta: delta)
                }
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(item: $likesPost) { post in
            LikesSheet(post: post) { postId in
                await model.fetchPostLikers(postId: postId)
            }
            .presentationDetents([.medium, .large])
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
                    onLoadRanking: { scope, period in
                        await model.loadRanking(scope, period)
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
        .sheet(item: $editingPost) { post in
            EditPostSheet(model: model, post: post)
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

    @State private var confirmDelete = false

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
        onShare: (() -> Void)? = nil
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

    public var body: some View {
        // Paridade SocialPostCard web (Fase 2): card edge-to-edge — mídia colada
        // nas bordas, header/ações com padding próprio (px-4 py-3.5 = 16/14),
        // raio 32, bg #0c0d0e, borda branca 8% e shadow. (Antes: GCCard padded,
        // mídia flutuando dentro.)
        VStack(spacing: 0) {
            header
                .padding(.horizontal, 16)
                .padding(.vertical, 14)

            PostCarouselView(
                items: post.carouselItems,
                aspectRatio: mediaAspectRatio,
                onPlayVideo: onPlayVideo
            )

            VStack(alignment: .leading, spacing: 12) {
                participantsRow
                pendingInviteBanner
                actionsRow
                // Curtidas/comentários/legenda agrupados tight (estilo Instagram).
                VStack(alignment: .leading, spacing: 4) {
                    likesLine
                    commentsLine
                    if let caption = post.caption, !caption.isEmpty {
                        GCText(caption, style: .body)
                    }
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
            GCAvatar(url: post.avatarURL, fallback: post.username)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    // Paridade web: nome 15px font-black.
                    Text(post.displayAuthorName)
                        .font(.system(size: 15, weight: .black, design: .default))
                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                        .lineLimit(1)
                    // StreakBadge xs (chama + número) AO LADO do nome, como no web
                    // (antes ficava solto na direita).
                    if let streak = post.authorCurrentStreak, streak > 0 {
                        HStack(spacing: 2) {
                            Image(systemName: "flame.fill")
                                .font(.system(size: 9, weight: .bold))
                            Text("\(streak)")
                                .font(.system(size: 11, weight: .black, design: .default))
                        }
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(GymCircleTheme.ColorToken.cyan.opacity(0.12)))
                    }
                }
                if let location = post.locationName {
                    // Paridade web: meta 12px font-bold white/46.
                    Text(distanceSuffixed(location))
                        .font(.system(size: 12, weight: .bold, design: .default))
                        .foregroundStyle(Color.white.opacity(0.46))
                        .lineLimit(1)
                }
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
                    .padding(.vertical, 8)
                    .padding(.leading, 8)
            }
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

    /// Linha "N curtidas" (estilo Instagram, paridade web) — abre quem curtiu.
    @ViewBuilder
    private var likesLine: some View {
        if post.likesCount > 0 {
            Button {
                onOpenLikes?()
            } label: {
                Text(
                    post.likesCount == 1
                        ? Loc.t("1 like", "1 curtida")
                        : Loc.t("\(post.likesCount) likes", "\(post.likesCount) curtidas")
                )
                .font(.system(size: 13, weight: .black, design: .default))
                .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Loc.seeWhoLiked)
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
        let isVideo = item?.mediaType == .video
        MediaView(
            // feedURL = original full-res na foto (≈1600px); displayURL (720px)
            // ficou só pra grids. Antes o feed mostrava o thumbnail borrado.
            url: item?.feedURL ?? "",
            aspectRatio: aspectRatio,
            isVideo: isVideo
        )
        .onTapGesture {
            // Sprint 20.3c — vídeo abre player fullscreen (image_url é a
            // URL do arquivo de vídeo; displayURL é o poster).
            if isVideo, let item, let url = URL(string: item.imageURL) {
                onPlayVideo?(url)
            }
        }
    }
}

public struct MediaView: View {
    private let url: String
    private let aspectRatio: CGFloat
    private let isVideo: Bool

    public init(url: String, aspectRatio: CGFloat, isVideo: Bool = false) {
        self.url = url
        self.aspectRatio = aspectRatio
        self.isVideo = isVideo
    }

    public var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 0, style: .continuous)
                .fill(GymCircleTheme.ColorToken.elevatedCard)

            if let imageURL = URL(string: url) {
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    default:
                        Image(systemName: "photo")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                    }
                }
            }

            if isVideo {
                Image(systemName: "play.circle.fill")
                    .font(.system(size: 44, weight: .bold))
                    .foregroundStyle(.white.opacity(0.9))
                    .shadow(radius: 8)
            }
        }
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

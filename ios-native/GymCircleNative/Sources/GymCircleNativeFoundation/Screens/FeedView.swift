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
    @State private var commentsPost: FeedPost?
    @State private var likesPost: FeedPost?
    @State private var editingPost: FeedPost?
    @State private var searchPresented = false
    @State private var playingVideo: PlayableVideo?
    // Sprint 20.5 — autor cujo story foi aberto na tray.
    @State private var openedStoryGroup: StoryAuthorGroup?

    public init(model: GymCircleAppModel) {
        self.model = model
    }

    public var body: some View {
        ScrollView {
            LazyVStack(spacing: 18) {
                StoriesTrayView(groups: model.stories, isLoading: false) { group in
                    openedStoryGroup = group
                }

                if model.isLoading && model.posts.isEmpty {
                    GCLoadingView("Carregando feed")
                } else if model.posts.isEmpty {
                    GCEmptyState(
                        title: "Seu circle esta quieto",
                        subtitle: "Quando as pessoas que voce segue postarem, os treinos aparecem aqui."
                    )
                } else {
                    ForEach(model.posts) { post in
                        FeedPostCard(
                            post: post,
                            currentUserId: model.currentUserId,
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
                            }
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
        }
        .refreshable {
            await model.refreshFeed()
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    searchPresented = true
                } label: {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                }
                .accessibilityLabel("Buscar pessoas")
            }
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
        .sheet(item: $editingPost) { post in
            EditPostSheet(post: post) { caption, tags in
                await model.updatePost(postId: post.id, caption: caption, workoutTypes: tags)
            }
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
        .navigationTitle("Hoje")
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
    private let onLike: (() -> Void)?
    private let onComments: (() -> Void)?
    private let onOpenLikes: (() -> Void)?
    private let onMute: (() -> Void)?
    private let onReport: (() -> Void)?
    private let onDelete: (() -> Void)?
    private let onEdit: (() -> Void)?
    private let onRespondInvite: ((Bool) -> Void)?
    private let onPlayVideo: ((URL) -> Void)?

    @State private var confirmDelete = false

    public init(
        post: FeedPost,
        currentUserId: String? = nil,
        onLike: (() -> Void)? = nil,
        onComments: (() -> Void)? = nil,
        onOpenLikes: (() -> Void)? = nil,
        onMute: (() -> Void)? = nil,
        onReport: (() -> Void)? = nil,
        onDelete: (() -> Void)? = nil,
        onEdit: (() -> Void)? = nil,
        onRespondInvite: ((Bool) -> Void)? = nil,
        onPlayVideo: ((URL) -> Void)? = nil
    ) {
        self.post = post
        self.currentUserId = currentUserId
        self.onLike = onLike
        self.onComments = onComments
        self.onOpenLikes = onOpenLikes
        self.onMute = onMute
        self.onReport = onReport
        self.onDelete = onDelete
        self.onEdit = onEdit
        self.onRespondInvite = onRespondInvite
        self.onPlayVideo = onPlayVideo
    }

    private var isOwnPost: Bool {
        currentUserId != nil && post.userId == currentUserId
    }

    public var body: some View {
        GCCard {
            VStack(alignment: .leading, spacing: 14) {
                header
                PostCarouselView(
                    items: post.carouselItems,
                    aspectRatio: mediaAspectRatio,
                    onPlayVideo: onPlayVideo
                )
                participantsRow
                pendingInviteBanner
                actionsRow
                if let caption = post.caption, !caption.isEmpty {
                    GCText(caption, style: .body)
                }
            }
        }
        .confirmationDialog("Apagar este post?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Apagar post", role: .destructive) { onDelete?() }
            Button("Cancelar", role: .cancel) {}
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            GCAvatar(url: post.avatarURL, fallback: post.username)
            VStack(alignment: .leading, spacing: 2) {
                GCText(post.displayAuthorName, style: .body)
                if let location = post.locationName {
                    GCText(location, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                }
            }
            Spacer()
            GCText("\(post.authorCurrentStreak ?? 0)d", style: .caption, color: GymCircleTheme.ColorToken.cyan)

            // Sprint 20.3c — menu do post (paridade PostMenuSheet web).
            Menu {
                if isOwnPost {
                    Button {
                        onEdit?()
                    } label: {
                        Label("Editar post", systemImage: "pencil")
                    }
                    Button(role: .destructive) {
                        confirmDelete = true
                    } label: {
                        Label("Apagar post", systemImage: "trash")
                    }
                } else {
                    Button {
                        onMute?()
                    } label: {
                        Label("Silenciar @\(post.username)", systemImage: "speaker.slash")
                    }
                    Button(role: .destructive) {
                        onReport?()
                    } label: {
                        Label("Denunciar post", systemImage: "exclamationmark.bubble")
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
                    "com \(accepted.map(\.displayedName).joined(separator: ", "))",
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
                GCText("Te marcaram neste treino", style: .caption)
                Spacer()
                Button("Aceitar") { onRespondInvite?(true) }
                    .font(.system(size: 13, weight: .black, design: .rounded))
                    .foregroundStyle(.black)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(GymCircleTheme.ColorToken.cyan))
                Button("Recusar") { onRespondInvite?(false) }
                    .font(.system(size: 13, weight: .bold, design: .rounded))
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

    private var actionsRow: some View {
        HStack(spacing: 18) {
            HStack(spacing: 6) {
                Button {
                    onLike?()
                } label: {
                    Image(systemName: post.likedByMe == true ? "heart.fill" : "heart")
                        .foregroundStyle(
                            post.likedByMe == true
                                ? GymCircleTheme.ColorToken.pink
                                : GymCircleTheme.ColorToken.primaryText
                        )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(post.likedByMe == true ? "Descurtir" : "Curtir")

                // Sprint 20.3c — o NÚMERO abre o "quem curtiu".
                Button {
                    onOpenLikes?()
                } label: {
                    Text("\(post.likesCount)")
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Ver quem curtiu")
            }

            Button {
                onComments?()
            } label: {
                Label("\(post.commentsCount)", systemImage: "bubble.right")
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Comentarios")

            Spacer()
            if let workoutType = post.workoutType, !workoutType.isEmpty {
                GCText(workoutType, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
            }
        }
        .font(.system(size: 15, weight: .bold, design: .rounded))
        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
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
                .accessibilityLabel("Mídia \(currentIndex + 1) de \(items.count)")
            }
        }
    }

    @ViewBuilder
    private func mediaView(for item: PostMediaItem?) -> some View {
        let isVideo = item?.mediaType == .video
        MediaView(
            url: item?.displayURL ?? "",
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
            RoundedRectangle(cornerRadius: 22, style: .continuous)
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
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .clipped()
    }
}

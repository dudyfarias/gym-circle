import SwiftUI

/// FeedView — Sprint 20.3a (feed interativo).
///
/// Ganhos vs a versão read-only da Sprint 3:
///   - carrossel multi-mídia com dots ABAIXO da mídia (paridade Sprint 14)
///   - curtir com update otimista + haptic
///   - pull-to-refresh + paginação infinita por cursor
///   - stories tray com dados reais (antes recebia [])
public struct FeedView: View {
    @ObservedObject private var model: GymCircleAppModel
    // Sprint 20.3b — post com sheet de comentários aberta.
    @State private var commentsPost: FeedPost?

    public init(model: GymCircleAppModel) {
        self.model = model
    }

    public var body: some View {
        ScrollView {
            LazyVStack(spacing: 18) {
                StoriesTrayView(groups: model.stories, isLoading: false)

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
                            onLike: {
                                Haptics.impactLight()
                                Task { await model.toggleLike(postId: post.id) }
                            },
                            onComments: { commentsPost = post }
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
        .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
        .navigationTitle("Hoje")
    }
}

public struct FeedPostCard: View {
    private let post: FeedPost
    private let onLike: (() -> Void)?
    private let onComments: (() -> Void)?

    public init(
        post: FeedPost,
        onLike: (() -> Void)? = nil,
        onComments: (() -> Void)? = nil
    ) {
        self.post = post
        self.onLike = onLike
        self.onComments = onComments
    }

    public var body: some View {
        GCCard {
            VStack(alignment: .leading, spacing: 14) {
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
                }

                PostCarouselView(items: post.carouselItems, aspectRatio: mediaAspectRatio)

                HStack(spacing: 18) {
                    Button {
                        onLike?()
                    } label: {
                        Label("\(post.likesCount)", systemImage: post.likedByMe == true ? "heart.fill" : "heart")
                            .foregroundStyle(
                                post.likedByMe == true
                                    ? GymCircleTheme.ColorToken.pink
                                    : GymCircleTheme.ColorToken.primaryText
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(post.likedByMe == true ? "Descurtir" : "Curtir")

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

                if let caption = post.caption, !caption.isEmpty {
                    GCText(caption, style: .body)
                }
            }
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
    @State private var currentIndex = 0

    public init(items: [PostMediaItem], aspectRatio: CGFloat) {
        self.items = items
        self.aspectRatio = aspectRatio
    }

    public var body: some View {
        if items.count <= 1 {
            MediaView(
                url: items.first?.displayURL ?? "",
                aspectRatio: aspectRatio,
                isVideo: items.first?.mediaType == .video
            )
        } else {
            VStack(spacing: 10) {
                TabView(selection: $currentIndex) {
                    ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                        MediaView(
                            url: item.displayURL,
                            aspectRatio: aspectRatio,
                            isVideo: item.mediaType == .video
                        )
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

            // Sprint 20.3a — vídeo no feed ainda renderiza o poster com o
            // badge de play; playback inline fica pra 20.3b (AVPlayer).
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

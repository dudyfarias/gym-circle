import SwiftUI

/// PostDetailSheet — paridade web `PostDetailOverlay`.
///
/// Abre um post (vindo do grid do perfil, do calendário do MyCircle, ou do
/// perfil de outra pessoa) com o card COMPLETO e TODAS as ações: curtir,
/// comentar, ver quem curtiu, menu (silenciar/denunciar/apagar/editar),
/// compartilhar, tocar no autor e play de vídeo inline.
///
/// Antes, abrir um post pelo grid mostrava o `FeedPostCard` só com `onLike`
/// fiado — não dava pra comentar/ver curtidas/menu/share/vídeo. Centralizando o
/// wiring aqui (DRY) todos os pontos de entrada ganham paridade com o feed.
public struct PostDetailSheet: View {
    @ObservedObject private var model: GymCircleAppModel
    @Environment(\.dismiss) private var dismiss

    // Cópia local: o card do detalhe não está no model.posts, então likes/
    // comentários são sincronizados aqui de forma otimista.
    @State private var post: FeedPost
    @State private var commentsPost: FeedPost?
    @State private var likesPost: FeedPost?
    @State private var sharingPost: FeedPost?
    @State private var editingPost: FeedPost?
    @State private var playingVideo: PlayableVideo?
    @State private var openedProfile: OtherProfileSummary?
    @State private var detailWorkout: WorkoutDetailData?

    public init(model: GymCircleAppModel, post: FeedPost) {
        self.model = model
        _post = State(initialValue: post)
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                FeedPostCard(
                    post: post,
                    currentUserId: model.currentUserId,
                    viewerCoordinate: model.viewerCoordinate,
                    onLike: {
                        Haptics.impactLight()
                        // Otimista local (cópia fora do model.posts).
                        let liked = !(post.likedByMe ?? false)
                        post.likedByMe = liked
                        post.likesCount = max(0, post.likesCount + (liked ? 1 : -1))
                        Task { await model.toggleLike(postId: post.id) }
                    },
                    onComments: { commentsPost = post },
                    onOpenLikes: { likesPost = post },
                    onMute: { Task { await model.muteAuthor(authorId: post.userId) } },
                    onReport: {
                        Haptics.success()
                        Task { await model.reportPost(postId: post.id, authorId: post.userId) }
                    },
                    onDelete: {
                        Task {
                            await model.deletePost(postId: post.id)
                            dismiss()
                        }
                    },
                    onEdit: { editingPost = post },
                    onRespondInvite: { accepted in
                        Haptics.impactLight()
                        Task { await model.respondToInvite(postId: post.id, accepted: accepted) }
                    },
                    onPlayVideo: { url in playingVideo = PlayableVideo(url: url) },
                    onShare: { sharingPost = post },
                    onOpenProfile: { openProfile(userId: $0) },
                    onOpenMention: { openMention(username: $0) },
                    onOpenWorkoutDetail: {
                        detailWorkout = post.workoutDetail
                    }
                )
                .padding(20)
            }
            .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle(Loc.post)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(Loc.close) { dismiss() }
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                }
            }
            // Re-hidrata ao abrir: garante carrossel + curtidas/comentários
            // frescos (o post do grid pode vir sem as mídias do post_media).
            .task {
                if let fresh = await model.fetchPost(postId: post.id) {
                    post = fresh
                }
            }
            .sheet(item: $commentsPost) { p in
                CommentsSheet(
                    post: p,
                    service: model.commentsService,
                    currentUserId: model.currentUserId,
                    onCountDelta: { delta in
                        post.commentsCount = max(0, post.commentsCount + delta)
                        model.adjustCommentsCount(postId: p.id, delta: delta)
                    },
                    model: model
                )
                .presentationDetents([.medium, .large])
            }
            .sheet(item: $likesPost) { p in
                LikesSheet(post: p, model: model) { postId in
                    await model.fetchPostLikers(postId: postId)
                }
                .presentationDetents([.medium, .large])
            }
            .sheet(item: $sharingPost) { p in
                SharePostSheet(post: p, model: model)
                    .presentationDetents([.medium, .large])
            }
            .sheet(item: $editingPost) { p in
                EditPostSheet(model: model, post: p)
            }
            .sheet(item: $openedProfile) { summary in
                OtherProfileHostView(model: model, summary: summary)
            }
            .fullScreenCover(item: $playingVideo) { video in
                VideoPlayerScreen(url: video.url)
            }
            .fullScreenCover(item: $detailWorkout) { detail in
                WorkoutDetailOverlay(detail: detail) {
                    detailWorkout = nil
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func openProfile(userId: String) {
        guard !userId.isEmpty,
              userId.lowercased() != model.currentUserId?.lowercased() else { return }
        Task {
            if let summary = await model.fetchOtherProfileSummary(userId: userId) {
                openedProfile = summary
            }
        }
    }

    private func openMention(username: String) {
        Task {
            if let summary = await model.fetchOtherProfileSummary(username: username) {
                openedProfile = summary
            }
        }
    }
}

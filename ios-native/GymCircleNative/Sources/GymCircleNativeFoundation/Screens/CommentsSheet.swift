import SwiftUI

/// CommentsSheet — Sprint 20.3b (paridade Sprint 12.1 web).
///
/// Sheet auto-carregável: lista top-level + replies aninhadas, like com
/// contador, swipe-delete dos próprios comentários, input com contexto
/// de reply ("Respondendo @user").
public struct CommentsSheet: View {
    private let post: FeedPost
    private let service: CommentsService?
    private let currentUserId: String?
    /// Delta aplicado no commentsCount do card do feed (+1 add, -1 delete).
    private let onCountDelta: (Int) -> Void
    /// Necessário pra abrir o perfil do autor de um comentário (tap no
    /// nome/avatar). Apresenta a partir desta sheet (evita sheet aninhada).
    private let model: GymCircleAppModel?

    @Environment(\.dismiss) private var dismiss
    @State private var comments: [PostComment] = []
    @State private var isLoading = true
    @State private var draft = ""
    @State private var replyingTo: PostComment?
    @State private var isSending = false
    @State private var openedProfile: OtherProfileSummary?
    @FocusState private var inputFocused: Bool

    public init(
        post: FeedPost,
        service: CommentsService?,
        currentUserId: String?,
        onCountDelta: @escaping (Int) -> Void,
        model: GymCircleAppModel? = nil
    ) {
        self.post = post
        self.service = service
        self.currentUserId = currentUserId
        self.onCountDelta = onCountDelta
        self.model = model
    }

    /// Abre o perfil do autor do comentário (ignora o próprio user).
    private func openProfile(userId: String) {
        guard let model, userId != currentUserId else { return }
        Task {
            if let summary = await model.fetchOtherProfileSummary(userId: userId) {
                openedProfile = summary
            }
        }
    }

    /// Tap numa @menção no comentário: resolve o username → perfil e apresenta.
    private func openMention(username: String) {
        guard let model else { return }
        Task {
            if let summary = await model.fetchOtherProfileSummary(username: username) {
                openedProfile = summary
            }
        }
    }

    private var topLevel: [PostComment] {
        comments.filter { $0.parentCommentId == nil }
    }

    private func replies(of comment: PostComment) -> [PostComment] {
        comments.filter { $0.parentCommentId == comment.id }
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if isLoading {
                    Spacer()
                    GCLoadingView(Loc.loadingComments)
                    Spacer()
                } else if comments.isEmpty {
                    Spacer()
                    GCEmptyState(
                        title: Loc.noCommentsTitle,
                        subtitle: Loc.noCommentsSubtitle
                    )
                    Spacer()
                } else {
                    List {
                        ForEach(topLevel) { comment in
                            commentRow(comment, isReply: false)
                            ForEach(replies(of: comment)) { reply in
                                commentRow(reply, isReply: true)
                            }
                        }
                        .listRowBackground(GymCircleTheme.ColorToken.appBackground)
                        .listRowSeparator(.hidden)
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }

                inputBar
            }
            .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle(Loc.comments)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(Loc.close) { dismiss() }
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                }
            }
        }
        .preferredColorScheme(.dark)
        .task { await load() }
        .sheet(item: $openedProfile) { summary in
            if let model {
                OtherProfileHostView(model: model, summary: summary)
            }
        }
    }

    // MARK: - Rows

    @ViewBuilder
    private func commentRow(_ comment: PostComment, isReply: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Button { openProfile(userId: comment.userId) } label: {
                GCAvatar(url: comment.authorAvatarURL, fallback: comment.authorUsername)
                    .scaleEffect(isReply ? 0.8 : 1)
            }
            .buttonStyle(.plain)
            .disabled(model == nil)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Button { openProfile(userId: comment.userId) } label: {
                        GCText(comment.displayAuthorName, style: .caption)
                    }
                    .buttonStyle(.plain)
                    .disabled(model == nil)
                    GCText(
                        Self.relativeTime(from: comment.createdAt),
                        style: .caption,
                        color: GymCircleTheme.ColorToken.secondaryText
                    )
                }
                // @menções realçadas + clicáveis (paridade web MentionText).
                MentionText(text: comment.body) { openMention(username: $0) }
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button {
                    replyingTo = comment.parentCommentId == nil ? comment : topLevel.first {
                        $0.id == comment.parentCommentId
                    }
                    inputFocused = true
                } label: {
                    GCText(Loc.reply, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                }
                .buttonStyle(.plain)
            }
            Spacer()
            Button {
                Haptics.impactLight()
                Task { await toggleLike(comment) }
            } label: {
                VStack(spacing: 2) {
                    Image(systemName: comment.likedByMe ? "heart.fill" : "heart")
                        .foregroundStyle(
                            comment.likedByMe
                                ? GymCircleTheme.ColorToken.pink
                                : GymCircleTheme.ColorToken.secondaryText
                        )
                    if comment.likesCount > 0 {
                        GCText("\(comment.likesCount)", style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                    }
                }
            }
            .buttonStyle(.plain)
        }
        .padding(.leading, isReply ? 38 : 0)
        .padding(.vertical, 6)
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            if comment.userId == currentUserId {
                Button(role: .destructive) {
                    Task { await delete(comment) }
                } label: {
                    Label(Loc.delete, systemImage: "trash")
                }
            }
        }
    }

    private var inputBar: some View {
        VStack(spacing: 6) {
            if let replyingTo {
                HStack {
                    GCText(
                        Loc.replyingTo(replyingTo.authorUsername),
                        style: .caption,
                        color: GymCircleTheme.ColorToken.cyan
                    )
                    Spacer()
                    Button {
                        self.replyingTo = nil
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 16)
            }
            HStack(spacing: 10) {
                TextField(Loc.commentPlaceholder, text: $draft, axis: .vertical)
                    .lineLimit(1...4)
                    .focused($inputFocused)
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(
                        Capsule().fill(GymCircleTheme.ColorToken.elevatedCard)
                    )
                Button {
                    Task { await send() }
                } label: {
                    if isSending {
                        ProgressView().tint(GymCircleTheme.ColorToken.cyan)
                    } else {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 30))
                            .foregroundStyle(
                                draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                    ? GymCircleTheme.ColorToken.secondaryText
                                    : GymCircleTheme.ColorToken.cyan
                            )
                    }
                }
                .buttonStyle(.plain)
                .disabled(isSending || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 10)
        }
        .padding(.top, 6)
        .background(GymCircleTheme.ColorToken.card)
    }

    // MARK: - Actions

    private func load() async {
        guard let service, let currentUserId else {
            isLoading = false
            return
        }
        do {
            comments = try await service.listComments(postId: post.id, currentUserId: currentUserId)
        } catch {
            comments = []
        }
        isLoading = false
    }

    private func send() async {
        guard let service, let currentUserId else { return }
        let body = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }
        isSending = true
        defer { isSending = false }
        do {
            try await service.addComment(
                postId: post.id,
                userId: currentUserId,
                body: body,
                parentCommentId: replyingTo?.id
            )
            draft = ""
            replyingTo = nil
            Haptics.success()
            onCountDelta(1)
            await load()
        } catch {
            Haptics.error()
        }
    }

    private func delete(_ comment: PostComment) async {
        guard let service, let currentUserId else { return }
        do {
            try await service.deleteComment(commentId: comment.id, userId: currentUserId)
            // Replies do comentário somem junto (FK cascade) — recontagem
            // pelo diff da lista recarregada mantém o badge do feed exato.
            let before = comments.count
            await load()
            onCountDelta(comments.count - before)
        } catch {
            Haptics.error()
        }
    }

    private func toggleLike(_ comment: PostComment) async {
        guard let service, let currentUserId,
              let index = comments.firstIndex(where: { $0.id == comment.id }) else { return }
        let wasLiked = comments[index].likedByMe
        comments[index].likedByMe = !wasLiked
        comments[index].likesCount = max(0, comments[index].likesCount + (wasLiked ? -1 : 1))
        do {
            try await service.setCommentLike(
                commentId: comment.id,
                userId: currentUserId,
                liked: !wasLiked
            )
        } catch {
            if let revert = comments.firstIndex(where: { $0.id == comment.id }) {
                comments[revert].likedByMe = wasLiked
                comments[revert].likesCount = max(0, comments[revert].likesCount + (wasLiked ? 1 : -1))
            }
        }
    }

    /// "agora", "5min", "2h", "3d" — mesmo tom do formatTime web.
    static func relativeTime(from isoString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: isoString) ?? {
            formatter.formatOptions = [.withInternetDateTime]
            return formatter.date(from: isoString) ?? .now
        }()
        let seconds = Date.now.timeIntervalSince(date)
        if seconds < 60 { return Loc.t("now", "agora") }
        if seconds < 3600 { return "\(Int(seconds / 60))min" }
        if seconds < 86400 { return "\(Int(seconds / 3600))h" }
        return "\(Int(seconds / 86400))d"
    }
}

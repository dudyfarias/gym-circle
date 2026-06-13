import SwiftUI

/// StoriesViews — Sprint 3 (tray) + Sprint 20.5 (viewer completo).
///
/// 20.5: bolhas da tray finalmente ABREM o viewer (antes eram estáticas);
/// viewer Instagram-style com progress timer, tap zones, continuidade
/// entre autores, like e marcação de visto. Reply por DM chega junto do
/// Chat (20.6); share fica anotado na matriz.
public struct StoriesTrayView: View {
    private let groups: [StoryAuthorGroup]
    private let isLoading: Bool
    private let onOpen: ((StoryAuthorGroup) -> Void)?

    public init(
        groups: [StoryAuthorGroup],
        isLoading: Bool = false,
        onOpen: ((StoryAuthorGroup) -> Void)? = nil
    ) {
        self.groups = groups
        self.isLoading = isLoading
        self.onOpen = onOpen
    }

    public var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 16) {
                if isLoading {
                    ForEach(0..<4, id: \.self) { _ in
                        storySkeleton
                    }
                } else {
                    ForEach(groups) { group in
                        Button {
                            onOpen?(group)
                        } label: {
                            StoryBubble(group: group)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.vertical, 6)
        }
    }

    private var storySkeleton: some View {
        VStack(spacing: 8) {
            Circle()
                .fill(GymCircleTheme.ColorToken.elevatedCard)
                .frame(width: 64, height: 64)
            Capsule()
                .fill(GymCircleTheme.ColorToken.elevatedCard)
                .frame(width: 48, height: 10)
        }
    }
}

public struct StoryBubble: View {
    private let group: StoryAuthorGroup

    public init(group: StoryAuthorGroup) {
        self.group = group
    }

    public var body: some View {
        VStack(spacing: 8) {
            GCAvatar(url: group.avatarURL, fallback: group.username, size: 64)
                .padding(3)
                .overlay {
                    Circle()
                        .stroke(
                            group.hasUnseen
                                ? GymCircleTheme.ColorToken.electricBlue
                                : GymCircleTheme.ColorToken.separator,
                            lineWidth: 3
                        )
                }
            GCText(group.username, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                .lineLimit(1)
                .frame(width: 76)
        }
    }
}

/// Viewer fullscreen — Sprint 20.5 (paridade do StoryViewer web).
///
/// Timer de 5s por story (vídeo usa a duração real quando conhecida),
/// tap direito avança / esquerdo volta, hold pausa, swipe down fecha;
/// terminar o último story do autor pula pro PRÓXIMO autor da tray.
public struct StoryViewerScreen: View {
    @ObservedObject private var model: GymCircleAppModel
    private let groups: [StoryAuthorGroup]
    @State private var authorIndex: Int

    @Environment(\.dismiss) private var dismiss
    @State private var items: [StoryItem] = []
    @State private var itemIndex = 0
    @State private var progress: Double = 0
    @State private var isPaused = false
    @State private var isLoading = true
    @State private var likedOverrides: [String: Bool] = [:]
    // Sprint 20.6 — reply por DM.
    @State private var replyDraft = ""
    @State private var confirmMute = false
    @FocusState private var replyFocused: Bool

    private let tick: Double = 0.05

    public init(model: GymCircleAppModel, groups: [StoryAuthorGroup], startAuthorId: String) {
        self.model = model
        self.groups = groups
        _authorIndex = State(initialValue: groups.firstIndex { $0.authorId == startAuthorId } ?? 0)
    }

    private var currentGroup: StoryAuthorGroup? {
        groups.indices.contains(authorIndex) ? groups[authorIndex] : nil
    }

    private var currentItem: StoryItem? {
        items.indices.contains(itemIndex) ? items[itemIndex] : nil
    }

    private var currentDuration: Double {
        guard let item = currentItem else { return 5 }
        if item.mediaType == .video, let d = item.mediaDurationSeconds, d > 0 {
            return min(d, 30)
        }
        return 5
    }

    private var isLiked: Bool {
        guard let item = currentItem else { return false }
        return likedOverrides[item.storyId] ?? (item.viewerHasLiked ?? false)
    }

    public var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if isLoading {
                ProgressView().tint(GymCircleTheme.ColorToken.cyan)
            } else if let item = currentItem {
                MediaView(
                    url: item.displayMediaURL,
                    aspectRatio: 9 / 16,
                    isVideo: item.mediaType == .video
                )
                .ignoresSafeArea(edges: .bottom)

                // Tap zones: 1/3 esquerdo volta, 2/3 direito avança.
                HStack(spacing: 0) {
                    Rectangle()
                        .fill(.clear)
                        .contentShape(Rectangle())
                        .frame(maxWidth: .infinity)
                        .onTapGesture { goBack() }
                    Rectangle()
                        .fill(.clear)
                        .contentShape(Rectangle())
                        .frame(maxWidth: .infinity)
                        .frame(maxWidth: .infinity)
                        .onTapGesture { advance() }
                }
                .onLongPressGesture(minimumDuration: 0.15, pressing: { pressing in
                    isPaused = pressing
                }, perform: {})

                overlayChrome(item: item)
            } else {
                GCEmptyState(title: "Sem stories", subtitle: "Esse story expirou ou nao esta mais disponivel.")
            }
        }
        .task(id: authorIndex) {
            await loadAuthor()
        }
        .task(id: "\(authorIndex)-\(itemIndex)") {
            await runTimer()
        }
        .gesture(
            DragGesture(minimumDistance: 40).onEnded { value in
                if value.translation.height > 60 { dismiss() }
            }
        )
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private func overlayChrome(item: StoryItem) -> some View {
        VStack(spacing: 10) {
            // Barras segmentadas com a fração do story corrente.
            HStack(spacing: 4) {
                ForEach(items.indices, id: \.self) { index in
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(.white.opacity(0.25))
                            Capsule()
                                .fill(.white)
                                .frame(
                                    width: geo.size.width * (
                                        index < itemIndex ? 1 : (index == itemIndex ? progress : 0)
                                    )
                                )
                        }
                    }
                    .frame(height: 3)
                }
            }
            .padding(.horizontal, 12)
            .padding(.top, 8)

            HStack(spacing: 10) {
                if let group = currentGroup {
                    GCAvatar(url: group.avatarURL, fallback: group.username, size: 34)
                    GCText(group.username, style: .caption, color: .white)
                }
                Spacer()
                if let url = URL(string: item.mediaURL) {
                    ShareLink(item: url) {
                        Image(systemName: "paperplane")
                            .font(.system(size: 17, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(8)
                    }
                }
                Menu {
                    Button(role: .destructive) {
                        confirmMute = true
                    } label: {
                        Label("Silenciar stories", systemImage: "speaker.slash")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(8)
                }
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(8)
                }
            }
            .padding(.horizontal, 12)
            .confirmationDialog(
                "Silenciar stories desse usuário?",
                isPresented: $confirmMute,
                titleVisibility: .visible
            ) {
                Button("Silenciar", role: .destructive) {
                    Task { await muteCurrentAuthor() }
                }
                Button("Cancelar", role: .cancel) {}
            }

            Spacer()

            if let caption = item.caption, !caption.isEmpty {
                GCText(caption, style: .body, color: .white)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
            }

            // Sprint 20.6 — reply por DM (send_direct_message com
            // story_id + reply_to_story) + like.
            HStack(spacing: 10) {
                TextField("Responder...", text: $replyDraft)
                    .focused($replyFocused)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(Capsule().fill(.white.opacity(0.14)))
                    .foregroundStyle(.white)
                if !replyDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Button {
                        Task { await sendReply() }
                    } label: {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 28))
                            .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                    }
                    .buttonStyle(.plain)
                }
                Button {
                    Haptics.impactLight()
                    Task { await toggleLike() }
                } label: {
                    Image(systemName: isLiked ? "heart.fill" : "heart")
                        .font(.system(size: 26, weight: .bold))
                        .foregroundStyle(isLiked ? GymCircleTheme.ColorToken.pink : .white)
                        .padding(6)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
            .onChange(of: replyFocused) { focused in
                isPaused = focused
            }
        }
    }

    private func sendReply() async {
        guard let item = currentItem, let group = currentGroup else { return }
        let text = replyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        let ok = await model.sendStoryReply(
            authorId: group.authorId,
            storyId: item.storyId,
            previewURL: item.thumbnailURL ?? item.posterURL,
            text: text
        )
        if ok {
            replyDraft = ""
            replyFocused = false
            Haptics.success()
        } else {
            Haptics.error()
        }
    }

    // MARK: - Flow

    private func loadAuthor() async {
        guard let group = currentGroup else { return }
        isLoading = true
        itemIndex = 0
        progress = 0
        items = await model.fetchStoryItems(authorId: group.authorId)
        isLoading = false
        await markCurrentSeen()
    }

    private func runTimer() async {
        progress = 0
        guard !isLoading, currentItem != nil else { return }
        let duration = currentDuration
        while progress < 1 {
            try? await Task.sleep(nanoseconds: UInt64(tick * 1_000_000_000))
            if Task.isCancelled { return }
            if !isPaused {
                progress = min(1, progress + tick / duration)
            }
        }
        advance()
    }

    private func advance() {
        if itemIndex < items.count - 1 {
            itemIndex += 1
            progress = 0
            Task { await markCurrentSeen() }
        } else if authorIndex < groups.count - 1 {
            // Continuidade: próximo autor da tray.
            authorIndex += 1
        } else {
            dismiss()
        }
    }

    private func goBack() {
        if itemIndex > 0 {
            itemIndex -= 1
            progress = 0
        } else if authorIndex > 0 {
            authorIndex -= 1
        }
    }

    private func markCurrentSeen() async {
        guard let item = currentItem else { return }
        await model.markStorySeen(storyId: item.storyId)
    }

    private func toggleLike() async {
        guard let item = currentItem else { return }
        let newValue = !isLiked
        likedOverrides[item.storyId] = newValue
        let ok = await model.setStoryLike(storyId: item.storyId, liked: newValue)
        if !ok {
            likedOverrides[item.storyId] = !newValue
        }
    }

    private func muteCurrentAuthor() async {
        guard let group = currentGroup else { return }
        let ok = await model.muteStoryAuthor(authorId: group.authorId)
        if ok {
            if authorIndex < groups.count - 1 {
                authorIndex += 1
            } else {
                dismiss()
            }
        }
    }
}

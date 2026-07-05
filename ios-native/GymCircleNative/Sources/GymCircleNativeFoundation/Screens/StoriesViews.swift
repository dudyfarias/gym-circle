import SwiftUI
import AVKit
import AVFoundation

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
                    // Punch-list #10 — ring gradiente brand→deep do web
                    // (não-visto); visto cai pro separator sólido.
                    if group.hasUnseen {
                        Circle()
                            .stroke(
                                AngularGradient(
                                    colors: [
                                        GymCircleTheme.ColorToken.cyan,
                                        GymCircleTheme.ColorToken.electricBlue,
                                        GymCircleTheme.ColorToken.cyan,
                                    ],
                                    center: .center
                                ),
                                lineWidth: 3
                            )
                    } else {
                        Circle()
                            .stroke(GymCircleTheme.ColorToken.separator, lineWidth: 3)
                    }
                }
                // StreakBadge sobreposto no fundo do avatar (paridade StoryBubbles web).
                .overlay(alignment: .bottom) {
                    if group.currentStreak > 0 {
                        StreakBadgeView(streak: group.currentStreak, size: .xs)
                            .offset(y: 9)
                    }
                }
            GCText(group.username, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                .lineLimit(1)
                .frame(width: 76)
                .padding(.top, 6)
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
    // Vídeo começa MUDO (tap no alto-falante ativa o som) — paridade IG/web.
    @State private var storyMuted = true
    @State private var likedOverrides: [String: Bool] = [:]
    // Sprint 20.6 — reply por DM.
    @State private var replyDraft = ""
    @State private var confirmMute = false
    // Sprint 21 P1 — paridade web: dono apaga a própria story; outro denuncia.
    @State private var confirmDelete = false
    @State private var confirmReport = false
    // Perfil aberto ao tocar no header do autor (pausa o story enquanto aberto).
    @State private var openedProfile: OtherProfileSummary?
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

    /// Story do próprio user (dono vê contagem de curtidas em vez do campo de
    /// resposta — não dá pra responder a própria story, igual web/IG).
    private var isOwnStory: Bool {
        currentItem?.userId == model.currentUserId
    }

    private var currentIsVideo: Bool {
        currentItem?.mediaType == .video
    }

    public var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if isLoading {
                ProgressView().tint(GymCircleTheme.ColorToken.cyan)
            } else if let item = currentItem {
                // Mídia full-bleed (cover) ATRÁS, ignorando safe area.
                mediaLayer(item: item)
                    .ignoresSafeArea()

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
                        .onTapGesture { advance() }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .onLongPressGesture(minimumDuration: 0.15, pressing: { pressing in
                    isPaused = pressing
                }, perform: {})
            } else {
                GCEmptyState(title: Loc.noStoriesTitle, subtitle: Loc.noStoriesSubtitle)
            }
        }
        // Chrome DENTRO da safe area: barras/header no topo seguro (abaixo da
        // Dynamic Island) e resposta no rodapé seguro (acima do home indicator).
        // safeAreaInset também sobe o rodapé junto com o teclado — corrige de uma
        // vez o "fora da tela" e o campo escondido pelo teclado.
        .safeAreaInset(edge: .top, spacing: 0) {
            if !isLoading, currentItem != nil { topChrome }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if !isLoading, let item = currentItem { bottomChrome(item: item) }
        }
        .task(id: authorIndex) {
            await loadAuthor()
        }
        .task(id: "\(authorIndex)-\(itemIndex)") {
            await runTimer()
        }
        .sheet(item: $openedProfile, onDismiss: { isPaused = false }) { summary in
            OtherProfileHostView(model: model, summary: summary)
        }
        .gesture(
            DragGesture(minimumDistance: 40).onEnded { value in
                if value.translation.height > 60 { dismiss() }
            }
        )
        .preferredColorScheme(.dark)
    }

    /// Mídia da story: vídeo toca de verdade (loop, com som) — antes mostrava só
    /// um poster congelado com ícone de play (paridade web <video autoPlay>).
    @ViewBuilder
    private func mediaLayer(item: StoryItem) -> some View {
        if item.mediaType == .video, let url = URL(string: item.mediaURL) {
            StoryVideoView(
                url: url,
                posterURL: item.posterURL ?? item.thumbnailURL,
                isPaused: isPaused,
                muted: storyMuted
            )
            .id(item.storyId)
        } else {
            AsyncImage(url: URL(string: item.mediaURL)) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Color.clear
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .clipped()
        }
    }

    // MARK: - Chrome (topo / rodapé) — cada um na sua safe area

    private var topChrome: some View {
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
                    Button { openProfile(userId: group.authorId) } label: {
                        HStack(spacing: 6) {
                            GCAvatar(url: group.avatarURL, fallback: group.username, size: 34)
                            GCText(group.username, style: .caption, color: .white)
                            // Idade da story (paridade web formatStoryAge).
                            if let item = currentItem {
                                Text("· \(storyAge(item.createdAt))")
                                    .font(.system(size: 12, weight: .semibold, design: .default))
                                    .foregroundStyle(.white.opacity(0.6))
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
                // Som do vídeo (começa mudo; tap ativa) — só pra vídeo.
                if currentIsVideo {
                    Button { storyMuted.toggle() } label: {
                        Image(systemName: storyMuted ? "speaker.slash.fill" : "speaker.wave.2.fill")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(8)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(storyMuted
                        ? Loc.t("Unmute", "Ativar som")
                        : Loc.t("Mute", "Silenciar"))
                }
                Menu {
                    if isOwnStory {
                        Button(role: .destructive) {
                            confirmDelete = true
                        } label: {
                            Label(Loc.t("Delete story", "Apagar story"), systemImage: "trash")
                        }
                    } else {
                        Button(role: .destructive) {
                            confirmReport = true
                        } label: {
                            Label(Loc.t("Report story", "Denunciar story"), systemImage: "flag")
                        }
                        Button(role: .destructive) {
                            confirmMute = true
                        } label: {
                            Label(Loc.t("Mute stories", "Silenciar stories"), systemImage: "speaker.slash")
                        }
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
                Loc.muteStoriesConfirm,
                isPresented: $confirmMute,
                titleVisibility: .visible
            ) {
                Button(Loc.mute, role: .destructive) {
                    Task { await muteCurrentAuthor() }
                }
                Button(Loc.cancel, role: .cancel) {}
            }
            .confirmationDialog(
                Loc.t("Delete this story?", "Apagar esta story?"),
                isPresented: $confirmDelete,
                titleVisibility: .visible
            ) {
                Button(Loc.t("Delete", "Apagar"), role: .destructive) {
                    Task { await deleteCurrentStory() }
                }
                Button(Loc.cancel, role: .cancel) {}
            }
            .confirmationDialog(
                Loc.t("Report this story?", "Denunciar esta story?"),
                isPresented: $confirmReport,
                titleVisibility: .visible
            ) {
                Button(Loc.t("Report", "Denunciar"), role: .destructive) {
                    Task { await reportCurrentStory() }
                }
                Button(Loc.cancel, role: .cancel) {}
            }
        }
        .padding(.bottom, 6)
        // Gradiente sutil pra legibilidade do chrome sobre mídia clara.
        .background(
            LinearGradient(
                colors: [.black.opacity(0.42), .clear],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea(edges: .top)
        )
    }

    private func bottomChrome(item: StoryItem) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            // Stickers: local (igual ao pin do IG) + tipo de treino (paridade web).
            if item.locationName?.isEmpty == false || item.workoutType?.isEmpty == false {
                HStack(spacing: 8) {
                    if let location = item.locationName, !location.isEmpty {
                        stickerPill(icon: "mappin.circle.fill", text: location)
                    }
                    if let workout = item.workoutType, !workout.isEmpty {
                        stickerPill(icon: "figure.run", text: workout)
                    }
                }
            }

            if let caption = item.caption, !caption.isEmpty {
                GCText(caption, style: .body, color: .white)
                    .lineLimit(3)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            if isOwnStory {
                // Dono: contagem de curtidas (não dá pra responder à própria
                // story — paridade web/IG).
                HStack(spacing: 8) {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(GymCircleTheme.ColorToken.pink)
                    GCText(ownLikesLabel(item: item), style: .body, color: .white)
                    Spacer()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                // Visitante: responder por DM (send_direct_message com story_id +
                // reply_to_story) + curtir + compartilhar (paperplane no rodapé,
                // ao lado do coração, igual IG).
                HStack(spacing: 10) {
                    TextField(Loc.replyPlaceholder, text: $replyDraft)
                        .focused($replyFocused)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .background(Capsule().fill(.white.opacity(0.14)))
                        .overlay(Capsule().strokeBorder(.white.opacity(0.22), lineWidth: 1))
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
                            .padding(4)
                    }
                    .buttonStyle(.plain)
                    if let url = URL(string: item.mediaURL) {
                        ShareLink(item: url) {
                            Image(systemName: "paperplane")
                                .font(.system(size: 23, weight: .semibold))
                                .foregroundStyle(.white)
                                .padding(4)
                        }
                    }
                }
                .onChange(of: replyFocused) { focused in
                    isPaused = focused
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 8)
        .background(
            LinearGradient(
                colors: [.clear, .black.opacity(0.5)],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea(edges: .bottom)
        )
    }

    private func stickerPill(icon: String, text: String) -> some View {
        HStack(spacing: 5) {
            Image(systemName: icon).font(.system(size: 12, weight: .bold))
            Text(text)
                .font(.system(size: 13, weight: .bold, design: .default))
                .lineLimit(1)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(Capsule().fill(.black.opacity(0.45)))
    }

    /// "N curtidas" pro dono (paridade web formatStoryLikesCount).
    private func ownLikesLabel(item: StoryItem) -> String {
        let n = item.likesCount ?? 0
        if n == 0 { return Loc.t("No likes yet", "Nenhuma curtida ainda") }
        return n == 1
            ? Loc.t("1 like", "1 curtida")
            : Loc.t("\(n) likes", "\(n) curtidas")
    }

    /// Idade da story (paridade web formatStoryAge): agora / Nmin / Nh / Nd.
    private func storyAge(_ iso: String) -> String {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = withFraction.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return "" }
        let secs = max(0, Date().timeIntervalSince(date))
        if secs < 60 { return Loc.t("now", "agora") }
        if secs < 3600 { return "\(Int(secs / 60))min" }
        if secs < 86_400 { return "\(Int(secs / 3600))h" }
        return "\(Int(secs / 86_400))d"
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

    /// Abre o perfil do autor do story (tap no header). Pausa o story
    /// enquanto o perfil estiver aberto; despausa no onDismiss da sheet.
    private func openProfile(userId: String) {
        guard userId != model.currentUserId else { return }
        isPaused = true
        Task {
            if let summary = await model.fetchOtherProfileSummary(userId: userId) {
                openedProfile = summary
            } else {
                isPaused = false
            }
        }
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

    /// Dono apaga a própria story — fecha o viewer (paridade web deleteStory,
    /// que zera o selectedStoryId).
    private func deleteCurrentStory() async {
        guard let item = currentItem else { return }
        let ok = await model.deleteStory(storyId: item.storyId)
        if ok { dismiss() }
    }

    /// Denúncia da story do autor atual (paridade web reportStory).
    private func reportCurrentStory() async {
        guard let item = currentItem, let group = currentGroup else { return }
        _ = await model.reportStory(storyId: item.storyId, authorId: group.authorId)
    }
}

// MARK: - Vídeo da story (full-bleed cover, loop, com som)

/// Player de vídeo da story (paridade web `<video autoPlay muted playsInline
/// object-cover>`, mas COM som, estilo IG). Loop infinito via AVPlayerLooper;
/// pausa/retoma seguindo `isPaused` (hold pra pausar, perfil aberto, teclado);
/// poster até o 1º frame renderizar. `resizeAspectFill` = cover.
private struct StoryVideoView: View {
    private let posterURL: String?
    let isPaused: Bool
    let muted: Bool

    @State private var player: AVQueuePlayer
    @State private var looper: AVPlayerLooper
    @State private var isPlaying = false

    init(url: URL, posterURL: String?, isPaused: Bool, muted: Bool) {
        self.posterURL = posterURL
        self.isPaused = isPaused
        self.muted = muted
        let queue = AVQueuePlayer()
        queue.isMuted = muted
        queue.actionAtItemEnd = .none
        _player = State(initialValue: queue)
        _looper = State(initialValue: AVPlayerLooper(player: queue, templateItem: AVPlayerItem(url: url)))
    }

    var body: some View {
        ZStack {
            Color.black
            StoryPlayerLayerView(player: player)
            if !isPlaying, let posterURL, let url = URL(string: posterURL) {
                GCRemoteImage(url: url, animateOnLoad: false) { Color.black }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
        .onAppear {
            applyMute()
            if !isPaused { player.play() }
        }
        .onChange(of: isPaused) { paused in
            if paused { player.pause() } else { player.play() }
        }
        // Tap no alto-falante (no chrome) liga/desliga o som deste vídeo.
        .onChange(of: muted) { _ in applyMute() }
        .onReceive(player.publisher(for: \.timeControlStatus)) { status in
            isPlaying = (status == .playing)
        }
        .onDisappear { player.pause() }
    }

    /// Aplica o mute; ao ATIVAR som, ativa a sessão .playback pra tocar mesmo
    /// com o switch de silêncio (igual IG).
    private func applyMute() {
        player.isMuted = muted
        if !muted {
            try? AVAudioSession.sharedInstance().setCategory(.playback, options: [])
            try? AVAudioSession.sharedInstance().setActive(true)
        }
    }
}

/// AVPlayerLayer puro (sem controles), resizeAspectFill = cover (object-cover).
private struct StoryPlayerLayerView: UIViewRepresentable {
    let player: AVPlayer

    func makeUIView(context: Context) -> Container {
        let view = Container()
        view.playerLayer.player = player
        view.playerLayer.videoGravity = .resizeAspectFill
        view.backgroundColor = .black
        return view
    }

    func updateUIView(_ uiView: Container, context: Context) {
        uiView.playerLayer.player = player
    }

    final class Container: UIView {
        override class var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
    }
}

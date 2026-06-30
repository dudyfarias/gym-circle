import SwiftUI
import PhotosUI
import AVKit
import UniformTypeIdentifiers

/// ChatViews — Sprint 20.6. Mata o placeholder "fase futura" da tab Chat.
///
/// ChatListView: conversas 1:1 + grupo (summaries RPC), unread badge,
/// swipe delete-for-me, nova mensagem a partir de quem eu sigo.
/// ConversationView: bolhas, envio (direct cria a conversa via RPC),
/// mark-read ao abrir. Mídia no chat e criação de grupo ficam na matriz.
public struct ChatListView: View {
    @ObservedObject private var model: GymCircleAppModel

    @State private var threads: [ChatThread] = []
    @State private var isLoading = true
    @State private var searchText = ""
    // Busca remota de pessoas pra iniciar conversa nova (paridade web).
    @State private var searchedUsers: [DiscoveredProfile] = []
    @State private var openedThread: ChatThread?
    @State private var newMessagePresented = false
    @State private var following: [DiscoveredProfile] = []
    @State private var groupMode = false
    @State private var groupName = ""
    @State private var selectedGroupMemberIds: Set<String> = []
    @State private var isCreatingGroup = false
    // Novo chat: estado próprio (recarrega "seguindo" ao abrir o sheet — evita o
    // race do .task da tab que rodava antes da sessão e ficava vazio pra sempre)
    // + busca de pessoas como fallback (nunca fica num beco sem saída).
    @State private var loadingFollowing = false
    @State private var newChatQuery = ""
    @State private var newChatResults: [DiscoveredProfile] = []

    public init(model: GymCircleAppModel) {
        self.model = model
    }

    public var body: some View {
        Group {
            if isLoading {
                GCLoadingView(Loc.loadingConversations)
            } else if threads.isEmpty {
                GCEmptyState(
                    title: Loc.noConversationsTitle,
                    subtitle: Loc.noConversationsSubtitle
                )
            } else {
                List {
                    ForEach(filteredThreads) { thread in
                        Button {
                            openedThread = thread
                        } label: {
                            threadRow(thread)
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(GymCircleTheme.ColorToken.appBackground)
                        .listRowSeparator(.hidden)
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                Task {
                                    await model.deleteConversationForMe(
                                        conversationId: thread.summary.conversationId
                                    )
                                    threads.removeAll { $0.id == thread.id }
                                }
                            } label: {
                                Label(Loc.deleteForMe, systemImage: "trash")
                            }
                        }
                    }

                    // Pessoas (busca remota) — iniciar conversa nova com quem não
                    // está nas conversas ainda (paridade web).
                    if !peopleResults.isEmpty {
                        Section(Loc.t("People", "Pessoas")) {
                            ForEach(peopleResults) { person in
                                Button { openNewChat(with: person) } label: {
                                    HStack(spacing: 12) {
                                        GCAvatar(url: person.avatarURL, fallback: person.username ?? "u")
                                        VStack(alignment: .leading, spacing: 2) {
                                            GCText(person.displayedName, style: .body)
                                            if let username = person.username, !username.isEmpty {
                                                GCText("@\(username)", style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                                            }
                                        }
                                        Spacer()
                                        Image(systemName: "square.and.pencil")
                                            .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                                    }
                                }
                                .buttonStyle(.plain)
                                .listRowBackground(GymCircleTheme.ColorToken.appBackground)
                                .listRowSeparator(.hidden)
                            }
                        }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .overlay {
                    if filteredThreads.isEmpty && peopleResults.isEmpty {
                        GCEmptyState(
                            title: Loc.t("No results", "Nenhum resultado"),
                            subtitle: Loc.t("Try another name.", "Tente outro nome.")
                        )
                    }
                }
            }
        }
        .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
        .searchable(text: $searchText, prompt: Loc.t("Search conversations", "Buscar conversas"))
        .task(id: searchText) { await runUserSearch() }
        .navigationTitle(Loc.chat)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    newMessagePresented = true
                } label: {
                    Image(systemName: "square.and.pencil")
                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                }
                .accessibilityLabel(Loc.newMessage)
            }
        }
        .task {
            await reload()
            following = await model.loadFollowingProfiles()
        }
        .refreshable { await reload() }
        .sheet(item: $openedThread) { thread in
            ConversationView(
                model: model,
                conversationId: thread.summary.conversationId,
                title: thread.displayName,
                isGroup: thread.summary.isGroup,
                peerUserId: thread.peerUserId,
                avatarURL: thread.avatarURL,
                peerUsername: thread.peerUsername,
                peerBadgeActive: thread.peerBadgeActive,
                memberCount: thread.memberCount,
                memberAvatarURLs: thread.memberAvatarURLs
            )
            .onDisappear { Task { await reload() } }
        }
        .sheet(isPresented: $newMessagePresented) {
            newMessageSheet
        }
    }

    /// Filtro local da lista por nome da conversa (paridade web — busca de
    /// conversas). A busca remota de users pra iniciar conversa nova fica no
    /// botão de "nova mensagem".
    private var filteredThreads: [ChatThread] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return threads }
        return threads.filter { $0.displayName.lowercased().contains(query) }
    }

    /// Pessoas da busca remota, sem o próprio user e sem quem já tem conversa
    /// (essas já aparecem em filteredThreads).
    private var peopleResults: [DiscoveredProfile] {
        guard !searchedUsers.isEmpty else { return [] }
        let existingPeers = Set(threads.compactMap { $0.peerUserId })
        let myId = model.currentUserId
        return searchedUsers.filter { $0.userId != myId && !existingPeers.contains($0.userId) }
    }

    /// Busca de pessoas (debounce 300ms via cancelamento do .task(id:)).
    private func runUserSearch() async {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard query.count >= 2 else { searchedUsers = []; return }
        try? await Task.sleep(nanoseconds: 300_000_000)
        if Task.isCancelled { return }
        searchedUsers = await model.searchProfiles(query: query)
    }

    /// Abre conversa nova com alguém da busca (id sintético "new:<peer>").
    private func openNewChat(with person: DiscoveredProfile) {
        searchText = ""
        searchedUsers = []
        openedThread = ChatThread(
            summary: placeholderSummary(peer: person),
            displayName: person.displayedName,
            avatarURL: person.avatarURL,
            peerUserId: person.userId,
            peerUsername: person.username
        )
    }

    private func reload() async {
        threads = await model.fetchChatThreads()
        isLoading = false
    }

    private func threadRow(_ thread: ChatThread) -> some View {
        let unread = thread.summary.unreadCount ?? 0
        return HStack(spacing: 12) {
            if thread.summary.isGroup {
                GroupAvatarView(avatarURLs: thread.memberAvatarURLs, size: 48)
            } else {
                GCAvatar(url: thread.avatarURL, fallback: thread.displayName)
            }
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(thread.displayName)
                        .font(.system(size: 15, weight: .black, design: .default))
                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                        .lineLimit(1)
                    if thread.summary.isGroup {
                        Image(systemName: "person.3.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                    }
                }
                // Preview da última mensagem (paridade web) — mais forte quando
                // há não-lidas.
                Text(thread.summary.lastMessagePreview)
                    .font(.system(size: 12, weight: unread > 0 ? .black : .bold, design: .default))
                    .foregroundStyle(Color.white.opacity(unread > 0 ? 0.9 : 0.44))
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 5) {
                if let last = thread.summary.lastMessageAt {
                    Text(CommentsSheet.relativeTime(from: last))
                        .font(.system(size: 11, weight: .bold, design: .default))
                        .foregroundStyle(Color.white.opacity(0.3))
                }
                if unread > 0 {
                    Text("\(unread)")
                        .font(.system(size: 11, weight: .black, design: .default))
                        .foregroundStyle(.black)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(GymCircleTheme.ColorToken.cyan))
                }
            }
        }
        .padding(.vertical, 6)
    }

    // Pessoas a mostrar no novo chat: busca quando há query (≥2), senão "seguindo".
    private var newChatPeople: [DiscoveredProfile] {
        let myId = model.currentUserId
        let query = newChatQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        let base = query.isEmpty ? following : newChatResults
        return base.filter { $0.userId != myId }
    }

    private func runNewChatSearch() async {
        let query = newChatQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard query.count >= 2 else { newChatResults = []; return }
        newChatResults = await model.searchProfiles(query: query)
    }

    private var newMessageSheet: some View {
        NavigationStack {
            Group {
                if loadingFollowing && newChatPeople.isEmpty && newChatQuery.isEmpty {
                    GCLoadingView(Loc.t("Loading…", "Carregando…"))
                } else if newChatPeople.isEmpty {
                    GCEmptyState(
                        title: newChatQuery.isEmpty
                            ? Loc.noFollowsTitle
                            : Loc.t("No one found", "Ninguém encontrado"),
                        subtitle: newChatQuery.isEmpty
                            ? Loc.noFollowsSubtitle
                            : Loc.t("Try another name or @username", "Tente outro nome ou @usuário")
                    )
                } else {
                    List {
                        if groupMode {
                            TextField(Loc.groupName, text: $groupName)
                                .padding(.vertical, 8)
                                .listRowBackground(GymCircleTheme.ColorToken.card)
                        }
                        ForEach(newChatPeople) { person in
                            Button {
                                if groupMode {
                                    toggleGroupMember(person.userId)
                                } else {
                                    newMessagePresented = false
                                    openedThread = ChatThread(
                                        summary: placeholderSummary(peer: person),
                                        displayName: person.displayedName,
                                        avatarURL: person.avatarURL,
                                        peerUserId: person.userId,
                                        peerUsername: person.username
                                    )
                                }
                            } label: {
                                HStack(spacing: 12) {
                                    GCAvatar(url: person.avatarURL, fallback: person.username ?? "u")
                                    GCText(person.displayedName, style: .body)
                                    Spacer()
                                    if groupMode {
                                        Image(systemName: selectedGroupMemberIds.contains(person.userId) ? "checkmark.circle.fill" : "circle")
                                            .foregroundStyle(
                                                selectedGroupMemberIds.contains(person.userId)
                                                    ? GymCircleTheme.ColorToken.cyan
                                                    : GymCircleTheme.ColorToken.secondaryText
                                            )
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                            .listRowBackground(GymCircleTheme.ColorToken.appBackground)
                            .listRowSeparator(.hidden)
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle(Loc.newMessage)
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $newChatQuery, prompt: Loc.t("Search people", "Buscar pessoas"))
            .task(id: newChatQuery) { await runNewChatSearch() }
            // Recarrega "seguindo" SEMPRE que o sheet abre (não depende do .task
            // da tab, que podia ter rodado antes da sessão e ficado vazio).
            .task {
                loadingFollowing = true
                following = await model.loadFollowingProfiles()
                loadingFollowing = false
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(groupMode ? Loc.directChat : Loc.group) {
                        groupMode.toggle()
                        selectedGroupMemberIds = []
                    }
                    .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                }
                if groupMode {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            Task { await createGroup() }
                        } label: {
                            if isCreatingGroup {
                                ProgressView().tint(GymCircleTheme.ColorToken.cyan)
                            } else {
                                Text(Loc.create).bold()
                            }
                        }
                        .disabled(selectedGroupMemberIds.isEmpty || isCreatingGroup)
                    }
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func toggleGroupMember(_ userId: String) {
        if selectedGroupMemberIds.contains(userId) {
            selectedGroupMemberIds.remove(userId)
        } else {
            selectedGroupMemberIds.insert(userId)
            Haptics.selection()
        }
    }

    private func createGroup() async {
        isCreatingGroup = true
        defer { isCreatingGroup = false }
        guard let conversationId = await model.createGroupConversation(
            name: groupName,
            memberIds: Array(selectedGroupMemberIds)
        ) else {
            Haptics.error()
            return
        }
        Haptics.success()
        let displayName = groupName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "Grupo Gym Circle"
            : groupName.trimmingCharacters(in: .whitespacesAndNewlines)
        newMessagePresented = false
        openedThread = ChatThread(
            summary: placeholderGroupSummary(conversationId: conversationId),
            displayName: displayName,
            avatarURL: nil,
            peerUserId: nil
        )
        groupName = ""
        selectedGroupMemberIds = []
        groupMode = false
    }

    /// Conversa 1:1 ainda inexistente: o id sintético "new:<peer>" sinaliza
    /// ao ConversationView que o 1º send_direct_message cria a conversa.
    private func placeholderSummary(peer: DiscoveredProfile) -> ConversationSummary {
        let json = """
        {"conversation_id":"new:\(peer.userId)","type":"direct","participants":[]}
        """
        // Decodável garantido pelo init tolerante do ConversationSummary.
        return try! JSONDecoder().decode(
            ConversationSummary.self,
            from: Data(json.utf8)
        )
    }

    private func placeholderGroupSummary(conversationId: String) -> ConversationSummary {
        let json = """
        {"conversation_id":"\(conversationId)","type":"group","participants":[]}
        """
        return try! JSONDecoder().decode(
            ConversationSummary.self,
            from: Data(json.utf8)
        )
    }
}

/// Conversa aberta — Sprint 20.6.
public struct ConversationView: View {
    @ObservedObject private var model: GymCircleAppModel
    private let initialConversationId: String
    private let title: String
    private let isGroup: Bool
    private let peerUserId: String?
    private let avatarURL: String?
    private let peerUsername: String?
    private let peerBadgeActive: Bool?
    private let memberCount: Int
    private let memberAvatarURLs: [String]

    @Environment(\.dismiss) private var dismiss
    @State private var conversationId: String?
    @State private var messages: [ChatMessage] = []
    @State private var draft = ""
    @State private var isSending = false
    @State private var isLoading = true
    @State private var pickedImage: PhotosPickerItem?
    /// Cache de remetentes (userId minúsculo → perfil) pra rotular bolhas em
    /// grupo com `@username` (paridade web). Resolvido lazy: só os senderIds
    /// que aparecem na thread, só uma vez cada.
    @State private var senderChips: [String: DiscoveredProfile] = [:]
    // Perfil aberto ao tocar no título (1:1) ou no @username (grupo).
    @State private var openedProfile: OtherProfileSummary?

    public init(
        model: GymCircleAppModel,
        conversationId: String,
        title: String,
        isGroup: Bool,
        peerUserId: String?,
        avatarURL: String? = nil,
        peerUsername: String? = nil,
        peerBadgeActive: Bool? = nil,
        memberCount: Int = 0,
        memberAvatarURLs: [String] = []
    ) {
        self.model = model
        self.initialConversationId = conversationId
        self.title = title
        self.isGroup = isGroup
        self.peerUserId = peerUserId
        self.avatarURL = avatarURL
        self.peerUsername = peerUsername
        self.peerBadgeActive = peerBadgeActive
        self.memberCount = memberCount
        self.memberAvatarURLs = memberAvatarURLs
        _conversationId = State(
            initialValue: conversationId.hasPrefix("new:") ? nil : conversationId
        )
    }

    /// Subtítulo do header (paridade web): 1:1 = "@username · treinou hoje/não";
    /// grupo = "N membros".
    private var headerSubtitle: String? {
        if isGroup {
            guard memberCount > 0 else { return nil }
            return memberCount == 1
                ? Loc.t("1 member", "1 membro")
                : Loc.t("\(memberCount) members", "\(memberCount) membros")
        }
        guard let username = peerUsername, !username.isEmpty else { return nil }
        let status = peerBadgeActive == true
            ? Loc.t("trained today", "treinou hoje")
            : Loc.t("not trained yet", "ainda não treinou")
        return "@\(username) · \(status)"
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if isLoading {
                    Spacer()
                    GCLoadingView(Loc.loadingMessages)
                    Spacer()
                } else if messages.isEmpty {
                    Spacer()
                    GCEmptyState(title: Loc.startChatTitle, subtitle: Loc.startChatSubtitle)
                    Spacer()
                } else {
                    ScrollViewReader { proxy in
                        ScrollView {
                            LazyVStack(spacing: 8) {
                                ForEach(messages) { message in
                                    bubble(message)
                                        .id(message.id)
                                }
                            }
                            .padding(16)
                        }
                        .onChange(of: messages.count) { _ in
                            if let last = messages.last {
                                proxy.scrollTo(last.id, anchor: .bottom)
                            }
                        }
                        .onAppear {
                            if let last = messages.last {
                                proxy.scrollTo(last.id, anchor: .bottom)
                            }
                        }
                    }
                }

                inputBar
            }
            .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                // Header: avatar + nome (paridade web). No 1:1 o conjunto abre o
                // perfil do peer; no grupo é só rótulo.
                ToolbarItem(placement: .principal) {
                    Button {
                        if !isGroup, let peerUserId { openProfile(userId: peerUserId) }
                    } label: {
                        HStack(spacing: 8) {
                            if isGroup {
                                GroupAvatarView(avatarURLs: memberAvatarURLs, size: 32)
                            } else {
                                GCAvatar(url: avatarURL, fallback: title, size: 32)
                            }
                            VStack(alignment: .leading, spacing: 1) {
                                Text(title)
                                    .font(.system(size: 15, weight: .heavy))
                                    .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                                    .lineLimit(1)
                                if let subtitle = headerSubtitle {
                                    Text(subtitle)
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundStyle(Color.white.opacity(0.5))
                                        .lineLimit(1)
                                }
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .disabled(isGroup || peerUserId == nil)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(Loc.close) { dismiss() }
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                }
            }
        }
        .preferredColorScheme(.dark)
        .task { await load() }
        .task(id: conversationId) { await pollForUpdates() }
        .sheet(item: $openedProfile) { summary in
            OtherProfileHostView(model: model, summary: summary)
        }
    }

    /// Abre o perfil de um user da conversa (peer no 1:1, remetente no grupo).
    private func openProfile(userId: String) {
        guard userId.lowercased() != model.currentUserId?.lowercased() else { return }
        Task {
            if let summary = await model.fetchOtherProfileSummary(userId: userId) {
                openedProfile = summary
            }
        }
    }

    @ViewBuilder
    private func bubble(_ message: ChatMessage) -> some View {
        let isMine = message.senderId == model.currentUserId
        HStack {
            if isMine { Spacer(minLength: 48) }
            VStack(alignment: .leading, spacing: 4) {
                // Em grupo, rotula a bolha do outro com @username (paridade web).
                if isGroup, !isMine,
                   let chip = senderChips[message.senderId.lowercased()],
                   let username = chip.username, !username.isEmpty {
                    Button { openProfile(userId: message.senderId) } label: {
                        Text("@\(username)")
                            .font(.system(size: 10, weight: .black, design: .default))
                            .foregroundStyle(Color.white.opacity(0.34))
                    }
                    .buttonStyle(.plain)
                }
                // Resposta a story: mostra a MINIATURA do story + label (paridade
                // web — antes só aparecia o texto "Respondeu ao story").
                if message.storyId != nil || message.replyToStory == true {
                    storyReplyPreview(message, isMine: isMine)
                }
                if let body = message.body, !body.isEmpty {
                    Text(body)
                        .font(.system(size: 14, weight: .bold, design: .default))
                        .foregroundStyle(isMine ? .black : GymCircleTheme.ColorToken.primaryText)
                }
                if let mediaURL = message.mediaURL,
                   message.mediaType == "image",
                   let url = URL(string: mediaURL) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFill()
                        case .failure:
                            Image(systemName: "photo")
                                .foregroundStyle(isMine ? .black.opacity(0.55) : GymCircleTheme.ColorToken.secondaryText)
                        default:
                            ProgressView()
                                .tint(isMine ? .black : GymCircleTheme.ColorToken.cyan)
                        }
                    }
                    .frame(width: 196, height: 196)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                if let mediaURL = message.mediaURL,
                   message.mediaType == "video",
                   let url = URL(string: mediaURL) {
                    VideoPlayer(player: AVPlayer(url: url))
                        .frame(width: 196, height: 196)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                Text(CommentsSheet.relativeTime(from: message.createdAt))
                    .font(.system(size: 10, weight: .black, design: .default))
                    .foregroundStyle(isMine ? Color.black.opacity(0.42) : Color.white.opacity(0.32))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                // Bolha com "rabinho" no canto inferior do lado do remetente
                // (paridade web: rounded-24 + canto 8).
                UnevenRoundedRectangle(
                    topLeadingRadius: 24,
                    bottomLeadingRadius: isMine ? 24 : 8,
                    bottomTrailingRadius: isMine ? 8 : 24,
                    topTrailingRadius: 24,
                    style: .continuous
                )
                .fill(
                    isMine
                        ? AnyShapeStyle(GymCircleTheme.ColorToken.cyan)
                        : AnyShapeStyle(Color.white.opacity(0.09))
                )
            )
            .shadow(color: .black.opacity(0.18), radius: 8, x: 0, y: 5)
            if !isMine { Spacer(minLength: 48) }
        }
    }

    /// Preview de resposta a story dentro da bolha: miniatura (story_preview_url)
    /// + label "Respondeu ao story" (paridade web).
    @ViewBuilder
    private func storyReplyPreview(_ message: ChatMessage, isMine: Bool) -> some View {
        HStack(spacing: 8) {
            if let preview = message.storyPreviewURL, let url = URL(string: preview) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Rectangle().fill(Color.white.opacity(0.12))
                }
                .frame(width: 34, height: 48)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            GCText(
                Loc.repliedToStory,
                style: .caption,
                color: isMine ? .black.opacity(0.62) : GymCircleTheme.ColorToken.secondaryText
            )
        }
        .padding(6)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(isMine ? Color.black.opacity(0.10) : Color.white.opacity(0.06))
        )
    }

    private var inputBar: some View {
        HStack(spacing: 10) {
            PhotosPicker(selection: $pickedImage, matching: .any(of: [.images, .videos])) {
                Image(systemName: "photo")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(GymCircleTheme.ColorToken.cyan)
            }
            .buttonStyle(.plain)
            .disabled(isSending)
            TextField(Loc.messagePlaceholder, text: $draft, axis: .vertical)
                .lineLimit(1...4)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Capsule().fill(GymCircleTheme.ColorToken.elevatedCard))
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
        .padding(.vertical, 10)
        .background(GymCircleTheme.ColorToken.card)
        .onChange(of: pickedImage?.itemIdentifier) { _ in
            guard let item = pickedImage else { return }
            Task { await sendImage(item) }
        }
    }

    private func load() async {
        guard let conversationId else {
            isLoading = false
            return
        }
        messages = await model.fetchChatMessages(conversationId: conversationId)
        isLoading = false
        await refreshSenderChips()
        await model.markConversationRead(conversationId: conversationId)
    }

    /// Resolve os remetentes de grupo ainda não cacheados (exclui eu mesmo).
    /// No-op fora de grupo ou quando todos já estão em cache — não bate na
    /// rede à toa.
    private func refreshSenderChips() async {
        guard isGroup else { return }
        let myId = model.currentUserId?.lowercased()
        let needed = Set(messages.map { $0.senderId.lowercased() })
            .subtracting(myId.map { [$0] } ?? [])
            .subtracting(senderChips.keys)
        guard !needed.isEmpty else { return }
        let chips = await model.fetchChatSenderChips(userIds: Array(needed))
        for chip in chips {
            senderChips[chip.userId.lowercased()] = chip
        }
    }

    private func send() async {
        let body = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }
        isSending = true
        defer { isSending = false }

        let sent: ChatMessage?
        if let conversationId, isGroup {
            sent = await model.sendGroupMessage(conversationId: conversationId, body: body)
        } else if let peerUserId {
            sent = await model.sendDirectMessage(receiverId: peerUserId, body: body)
        } else if let conversationId {
            // Direct existente sem peer resolvido (fallback raro): manda
            // como grupo — o RPC valida a participação de qualquer forma.
            sent = await model.sendGroupMessage(conversationId: conversationId, body: body)
        } else {
            sent = nil
        }

        guard let sent else {
            Haptics.error()
            return
        }
        draft = ""
        Haptics.impactLight()
        if conversationId == nil {
            conversationId = sent.conversationId
        }
        if let conversationId {
            messages = await model.fetchChatMessages(conversationId: conversationId)
        }
    }

    private func sendImage(_ item: PhotosPickerItem) async {
        guard !isSending else { return }
        isSending = true
        defer {
            isSending = false
            pickedImage = nil
        }
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            Haptics.error()
            return
        }
        let isVideo = item.supportedContentTypes.contains { $0.conforms(to: .movie) }

        let sent = await model.sendChatImage(
            conversationId: conversationId,
            peerUserId: peerUserId,
            isGroup: isGroup,
            imageData: data,
            isVideo: isVideo
        )
        guard let sent else {
            Haptics.error()
            return
        }
        Haptics.impactLight()
        if conversationId == nil {
            conversationId = sent.conversationId
        }
        if let conversationId {
            messages = await model.fetchChatMessages(conversationId: conversationId)
        }
    }

    private func pollForUpdates() async {
        guard conversationId != nil else { return }
        while !Task.isCancelled {
            try? await Task.sleep(nanoseconds: 7_000_000_000)
            guard let conversationId, !isSending else { continue }
            let latest = await model.fetchChatMessages(conversationId: conversationId)
            if latest != messages {
                messages = latest
                await refreshSenderChips()
            }
        }
    }
}

/// GroupAvatarView — avatar de grupo em mosaico 2x2 dos membros (paridade web
/// GroupAvatar). 1 membro = avatar único; 0 = ícone de grupo.
public struct GroupAvatarView: View {
    private let avatarURLs: [String]
    private let size: CGFloat

    public init(avatarURLs: [String], size: CGFloat = 48) {
        self.avatarURLs = avatarURLs
        self.size = size
    }

    public var body: some View {
        let urls = Array(avatarURLs.prefix(4))
        Group {
            if urls.isEmpty {
                ZStack {
                    Circle().fill(Color.white.opacity(0.08))
                    Image(systemName: "person.3.fill")
                        .font(.system(size: size * 0.38, weight: .bold))
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                }
            } else if urls.count == 1 {
                cell(urls[0], side: size)
            } else {
                let half = size / 2
                VStack(spacing: 1) {
                    HStack(spacing: 1) {
                        cell(urls[0], side: half)
                        cell(urls.count > 1 ? urls[1] : nil, side: half)
                    }
                    HStack(spacing: 1) {
                        cell(urls.count > 2 ? urls[2] : nil, side: half)
                        cell(urls.count > 3 ? urls[3] : nil, side: half)
                    }
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(Color.white.opacity(0.10), lineWidth: 1))
    }

    @ViewBuilder
    private func cell(_ url: String?, side: CGFloat) -> some View {
        if let url, let resolved = URL(string: url) {
            AsyncImage(url: resolved) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Rectangle().fill(Color.white.opacity(0.10))
            }
            .frame(width: side, height: side)
            .clipped()
        } else {
            Rectangle().fill(Color.white.opacity(0.06)).frame(width: side, height: side)
        }
    }
}

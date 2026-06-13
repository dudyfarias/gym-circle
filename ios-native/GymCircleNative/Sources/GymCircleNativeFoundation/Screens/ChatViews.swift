import SwiftUI
import PhotosUI

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
    @State private var openedThread: ChatThread?
    @State private var newMessagePresented = false
    @State private var following: [DiscoveredProfile] = []
    @State private var groupMode = false
    @State private var groupName = ""
    @State private var selectedGroupMemberIds: Set<String> = []
    @State private var isCreatingGroup = false

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
                    ForEach(threads) { thread in
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
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
        }
        .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
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
                peerUserId: thread.peerUserId
            )
            .onDisappear { Task { await reload() } }
        }
        .sheet(isPresented: $newMessagePresented) {
            newMessageSheet
        }
    }

    private func reload() async {
        threads = await model.fetchChatThreads()
        isLoading = false
    }

    private func threadRow(_ thread: ChatThread) -> some View {
        HStack(spacing: 12) {
            GCAvatar(url: thread.avatarURL, fallback: thread.displayName)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    GCText(thread.displayName, style: .body)
                    if thread.summary.isGroup {
                        Image(systemName: "person.3.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                    }
                }
                if let last = thread.summary.lastMessageAt {
                    GCText(
                        CommentsSheet.relativeTime(from: last),
                        style: .caption,
                        color: GymCircleTheme.ColorToken.secondaryText
                    )
                }
            }
            Spacer()
            if let unread = thread.summary.unreadCount, unread > 0 {
                GCText("\(unread)", style: .caption, color: .black)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(GymCircleTheme.ColorToken.cyan))
            }
        }
        .padding(.vertical, 6)
    }

    private var newMessageSheet: some View {
        NavigationStack {
            Group {
                if following.isEmpty {
                    GCEmptyState(
                        title: Loc.noFollowsTitle,
                        subtitle: Loc.noFollowsSubtitle
                    )
                } else {
                    List {
                        if groupMode {
                            TextField(Loc.groupName, text: $groupName)
                                .padding(.vertical, 8)
                                .listRowBackground(GymCircleTheme.ColorToken.card)
                        }
                        ForEach(following) { person in
                            Button {
                                if groupMode {
                                    toggleGroupMember(person.userId)
                                } else {
                                    newMessagePresented = false
                                    openedThread = ChatThread(
                                        summary: placeholderSummary(peer: person),
                                        displayName: person.displayedName,
                                        avatarURL: person.avatarURL,
                                        peerUserId: person.userId
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

    @Environment(\.dismiss) private var dismiss
    @State private var conversationId: String?
    @State private var messages: [ChatMessage] = []
    @State private var draft = ""
    @State private var isSending = false
    @State private var isLoading = true
    @State private var pickedImage: PhotosPickerItem?

    public init(
        model: GymCircleAppModel,
        conversationId: String,
        title: String,
        isGroup: Bool,
        peerUserId: String?
    ) {
        self.model = model
        self.initialConversationId = conversationId
        self.title = title
        self.isGroup = isGroup
        self.peerUserId = peerUserId
        _conversationId = State(
            initialValue: conversationId.hasPrefix("new:") ? nil : conversationId
        )
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
            .navigationTitle(title)
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
        .task(id: conversationId) { await pollForUpdates() }
    }

    @ViewBuilder
    private func bubble(_ message: ChatMessage) -> some View {
        let isMine = message.senderId == model.currentUserId
        HStack {
            if isMine { Spacer(minLength: 48) }
            VStack(alignment: .leading, spacing: 4) {
                if message.replyToStory == true {
                    GCText(
                        Loc.repliedToStory,
                        style: .caption,
                        color: isMine ? .black.opacity(0.6) : GymCircleTheme.ColorToken.secondaryText
                    )
                }
                if let body = message.body, !body.isEmpty {
                    Text(body)
                        .font(.system(size: 15, design: .rounded))
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
                    .frame(width: 180, height: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                GCText(
                    CommentsSheet.relativeTime(from: message.createdAt),
                    style: .caption,
                    color: isMine ? .black.opacity(0.5) : GymCircleTheme.ColorToken.secondaryText
                )
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(
                        isMine
                            ? AnyShapeStyle(GymCircleTheme.ColorToken.cyan)
                            : AnyShapeStyle(GymCircleTheme.ColorToken.elevatedCard)
                    )
            )
            if !isMine { Spacer(minLength: 48) }
        }
    }

    private var inputBar: some View {
        HStack(spacing: 10) {
            PhotosPicker(selection: $pickedImage, matching: .images) {
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
        await model.markConversationRead(conversationId: conversationId)
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

        let sent = await model.sendChatImage(
            conversationId: conversationId,
            peerUserId: peerUserId,
            isGroup: isGroup,
            imageData: data
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
            }
        }
    }
}

import SwiftUI

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

    public init(model: GymCircleAppModel) {
        self.model = model
    }

    public var body: some View {
        Group {
            if isLoading {
                GCLoadingView("Carregando conversas")
            } else if threads.isEmpty {
                GCEmptyState(
                    title: "Nenhuma conversa",
                    subtitle: "Chama alguem do circle pra trocar ideia sobre treino."
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
                                Label("Apagar pra mim", systemImage: "trash")
                            }
                        }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
        }
        .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
        .navigationTitle("Chat")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    newMessagePresented = true
                } label: {
                    Image(systemName: "square.and.pencil")
                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                }
                .accessibilityLabel("Nova mensagem")
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
                        title: "Voce ainda nao segue ninguem",
                        subtitle: "Siga pessoas pra puxar conversa."
                    )
                } else {
                    List(following) { person in
                        Button {
                            newMessagePresented = false
                            openedThread = ChatThread(
                                summary: placeholderSummary(peer: person),
                                displayName: person.displayedName,
                                avatarURL: person.avatarURL,
                                peerUserId: person.userId
                            )
                        } label: {
                            HStack(spacing: 12) {
                                GCAvatar(url: person.avatarURL, fallback: person.username ?? "u")
                                GCText(person.displayedName, style: .body)
                                Spacer()
                            }
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(GymCircleTheme.ColorToken.appBackground)
                        .listRowSeparator(.hidden)
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle("Nova mensagem")
            .navigationBarTitleDisplayMode(.inline)
        }
        .preferredColorScheme(.dark)
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
                    GCLoadingView("Carregando mensagens")
                    Spacer()
                } else if messages.isEmpty {
                    Spacer()
                    GCEmptyState(title: "Comeca o papo", subtitle: "Manda a primeira mensagem.")
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
                    Button("Fechar") { dismiss() }
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                }
            }
        }
        .preferredColorScheme(.dark)
        .task { await load() }
    }

    @ViewBuilder
    private func bubble(_ message: ChatMessage) -> some View {
        let isMine = message.senderId == model.currentUserId
        HStack {
            if isMine { Spacer(minLength: 48) }
            VStack(alignment: .leading, spacing: 4) {
                if message.replyToStory == true {
                    GCText(
                        "Respondeu ao story",
                        style: .caption,
                        color: isMine ? .black.opacity(0.6) : GymCircleTheme.ColorToken.secondaryText
                    )
                }
                if let body = message.body, !body.isEmpty {
                    Text(body)
                        .font(.system(size: 15, design: .rounded))
                        .foregroundStyle(isMine ? .black : GymCircleTheme.ColorToken.primaryText)
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
            TextField("Mensagem...", text: $draft, axis: .vertical)
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
}

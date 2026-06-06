import SwiftUI

public struct StoriesTrayView: View {
    private let groups: [StoryAuthorGroup]
    private let isLoading: Bool
    private let error: String?
    private let onOpenStory: (StoryAuthorGroup) -> Void

    public init(
        groups: [StoryAuthorGroup],
        isLoading: Bool = false,
        error: String? = nil,
        onOpenStory: @escaping (StoryAuthorGroup) -> Void = { _ in }
    ) {
        self.groups = groups
        self.isLoading = isLoading
        self.error = error
        self.onOpenStory = onOpenStory
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let error {
                GCText(error, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 16) {
                    if isLoading && groups.isEmpty {
                        ForEach(0..<4, id: \.self) { _ in
                            storySkeleton
                        }
                    } else {
                        ForEach(groups) { group in
                            Button {
                                onOpenStory(group)
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

public struct StoryViewerView: View {
    private let group: StoryAuthorGroup
    private let stories: [StoryItem]
    private let isLoading: Bool
    private let error: String?
    private let onRetry: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var index = 0

    public init(
        group: StoryAuthorGroup,
        stories: [StoryItem],
        isLoading: Bool = false,
        error: String? = nil,
        onRetry: @escaping () -> Void = {}
    ) {
        self.group = group
        self.stories = stories
        self.isLoading = isLoading
        self.error = error
        self.onRetry = onRetry
    }

    public var body: some View {
        ZStack {
            GymCircleTheme.ColorToken.appBackground.ignoresSafeArea()

            if isLoading {
                GCLoadingView("Abrindo story")
            } else if let error {
                GCErrorState(
                    title: "Story indisponivel",
                    subtitle: error,
                    retryTitle: "Tentar de novo",
                    onRetry: onRetry
                )
            } else if stories.isEmpty {
                GCEmptyState(title: "Sem stories", subtitle: "Esse story expirou ou nao esta mais disponivel.")
            } else {
                VStack(spacing: 16) {
                    topBar
                    storyProgress

                    MediaView(url: stories[safe: index]?.displayMediaURL ?? "", aspectRatio: 9 / 16)
                        .frame(maxHeight: 620)
                        .onTapGesture {
                            advance()
                        }

                    HStack {
                        GCButton("Voltar", systemImage: "chevron.left") {
                            index = max(index - 1, 0)
                        }
                        GCButton("Avancar", systemImage: "chevron.right") {
                            advance()
                        }
                    }
                }
                .padding(20)
            }
        }
    }

    private var topBar: some View {
        HStack(spacing: 10) {
            GCAvatar(url: group.avatarURL, fallback: group.username, size: 38)
            VStack(alignment: .leading, spacing: 2) {
                GCText(group.displayName ?? group.username, style: .body)
                GCText("@\(group.username)", style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
            }
            Spacer()
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .black))
                    .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                    .frame(width: 44, height: 44)
                    .background(GymCircleTheme.ColorToken.elevatedCard)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
        }
    }

    private var storyProgress: some View {
        HStack(spacing: 5) {
            ForEach(stories.indices, id: \.self) { itemIndex in
                Capsule()
                    .fill(itemIndex <= index ? GymCircleTheme.ColorToken.cyan : Color.white.opacity(0.16))
                    .frame(height: 3)
            }
        }
    }

    private func advance() {
        if index >= stories.count - 1 {
            dismiss()
        } else {
            index += 1
        }
    }
}

private extension Array {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

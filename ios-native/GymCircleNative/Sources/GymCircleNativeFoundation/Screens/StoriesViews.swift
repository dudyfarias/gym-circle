import SwiftUI

public struct StoriesTrayView: View {
    private let groups: [StoryAuthorGroup]
    private let isLoading: Bool

    public init(groups: [StoryAuthorGroup], isLoading: Bool = false) {
        self.groups = groups
        self.isLoading = isLoading
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
                        StoryBubble(group: group)
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

public struct StoryViewerView: View {
    private let stories: [StoryItem]
    @State private var index = 0

    public init(stories: [StoryItem]) {
        self.stories = stories
    }

    public var body: some View {
        ZStack {
            GymCircleTheme.ColorToken.appBackground.ignoresSafeArea()

            if stories.isEmpty {
                GCEmptyState(title: "Sem stories", subtitle: "Esse story expirou ou nao esta mais disponivel.")
            } else {
                VStack(spacing: 16) {
                    storyProgress

                    MediaView(url: stories[index].displayMediaURL, aspectRatio: 9 / 16)
                        .frame(maxHeight: 620)

                    HStack {
                        GCButton("Voltar", systemImage: "chevron.left") {
                            index = max(index - 1, 0)
                        }
                        GCButton("Avancar", systemImage: "chevron.right") {
                            index = min(index + 1, stories.count - 1)
                        }
                    }
                }
                .padding(20)
            }
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
}

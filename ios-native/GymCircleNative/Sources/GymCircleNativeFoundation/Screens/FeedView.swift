import SwiftUI

public struct FeedView: View {
    private let posts: [FeedPost]
    private let stories: [StoryAuthorGroup]
    private let isFeedLoading: Bool
    private let isStoriesLoading: Bool
    private let feedError: String?
    private let storiesError: String?
    private let onRetry: () -> Void
    private let onOpenStory: (StoryAuthorGroup) -> Void

    public init(
        posts: [FeedPost],
        stories: [StoryAuthorGroup] = [],
        isFeedLoading: Bool = false,
        isStoriesLoading: Bool = false,
        feedError: String? = nil,
        storiesError: String? = nil,
        onRetry: @escaping () -> Void = {},
        onOpenStory: @escaping (StoryAuthorGroup) -> Void = { _ in }
    ) {
        self.posts = posts
        self.stories = stories
        self.isFeedLoading = isFeedLoading
        self.isStoriesLoading = isStoriesLoading
        self.feedError = feedError
        self.storiesError = storiesError
        self.onRetry = onRetry
        self.onOpenStory = onOpenStory
    }

    public var body: some View {
        ScrollView {
            LazyVStack(spacing: 18) {
                StoriesTrayView(
                    groups: stories,
                    isLoading: isStoriesLoading,
                    error: storiesError,
                    onOpenStory: onOpenStory
                )

                if isFeedLoading && posts.isEmpty {
                    feedSkeleton
                } else if let feedError {
                    GCErrorState(
                        title: "Feed indisponivel",
                        subtitle: feedError,
                        retryTitle: "Tentar de novo",
                        onRetry: onRetry
                    )
                } else if posts.isEmpty {
                    GCEmptyState(
                        title: "Seu circle esta quieto",
                        subtitle: "Quando as pessoas que voce segue postarem, os treinos aparecem aqui."
                    )
                } else {
                    ForEach(posts) { post in
                        FeedPostCard(post: post)
                    }
                }
            }
            .padding(20)
        }
        .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
        .navigationTitle("Hoje")
        .refreshable {
            onRetry()
        }
    }

    private var feedSkeleton: some View {
        VStack(spacing: 18) {
            ForEach(0..<3, id: \.self) { _ in
                GCCard {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack(spacing: 12) {
                            Circle()
                                .fill(GymCircleTheme.ColorToken.elevatedCard)
                                .frame(width: 48, height: 48)
                            VStack(alignment: .leading, spacing: 8) {
                                GCSkeletonBlock(height: 12, radius: 6)
                                    .frame(width: 130)
                                GCSkeletonBlock(height: 10, radius: 5)
                                    .frame(width: 90)
                            }
                            Spacer()
                        }
                        GCSkeletonBlock(height: 360, radius: 22)
                        GCSkeletonBlock(height: 14, radius: 7)
                            .frame(width: 220)
                    }
                }
            }
        }
    }
}

public struct FeedPostCard: View {
    private let post: FeedPost

    public init(post: FeedPost) {
        self.post = post
    }

    public var body: some View {
        GCCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    GCAvatar(url: post.avatarURL, fallback: post.username)
                    VStack(alignment: .leading, spacing: 2) {
                        GCText(post.displayAuthorName, style: .body)
                        HStack(spacing: 5) {
                            GCText("@\(post.username)", style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                            GCText("•", style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                            GCText(post.relativeCreatedAt, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                        }
                        if let location = post.locationName, !location.isEmpty {
                            GCText(location, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                        }
                    }
                    Spacer()
                    if let streak = post.authorCurrentStreak, streak > 0 {
                        GCText("\(streak)d", style: .caption, color: GymCircleTheme.ColorToken.cyan)
                            .padding(.horizontal, 10)
                            .frame(height: 28)
                            .background(GymCircleTheme.ColorToken.cyan.opacity(0.12))
                            .clipShape(Capsule())
                    }
                }

                MediaView(url: post.displayMediaURL, aspectRatio: mediaAspectRatio)

                HStack(spacing: 18) {
                    Label("\(post.likesCount)", systemImage: post.likedByMe == true ? "heart.fill" : "heart")
                    Label("\(post.commentsCount)", systemImage: "bubble.right")
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
        guard let width = post.mediaWidth, let height = post.mediaHeight, height > 0 else {
            return 4 / 5
        }
        return min(max(CGFloat(width) / CGFloat(height), 0.75), 1.45)
    }
}

public struct MediaView: View {
    private let url: String
    private let aspectRatio: CGFloat

    public init(url: String, aspectRatio: CGFloat) {
        self.url = url
        self.aspectRatio = aspectRatio
    }

    public var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(GymCircleTheme.ColorToken.elevatedCard)

            if let imageURL = URL(string: url), !url.isEmpty {
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        unavailableMedia
                    default:
                        ProgressView()
                            .tint(GymCircleTheme.ColorToken.cyan)
                    }
                }
            } else {
                unavailableMedia
            }
        }
        .aspectRatio(aspectRatio, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .clipped()
    }

    private var unavailableMedia: some View {
        VStack(spacing: 8) {
            Image(systemName: "photo")
                .font(.system(size: 28, weight: .bold))
            GCText("Midia indisponivel", style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
        }
        .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
    }
}

private extension FeedPost {
    var relativeCreatedAt: String {
        guard let date = Self.isoFormatterWithFractionalSeconds.date(from: createdAt) ?? Self.isoFormatter.date(from: createdAt) else {
            return "agora"
        }

        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        formatter.locale = Locale(identifier: "pt_BR")
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    static let isoFormatterWithFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}

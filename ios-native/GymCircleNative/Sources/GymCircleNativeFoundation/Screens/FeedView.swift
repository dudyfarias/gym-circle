import SwiftUI

public struct FeedView: View {
    private let posts: [FeedPost]
    private let isLoading: Bool

    public init(posts: [FeedPost], isLoading: Bool = false) {
        self.posts = posts
        self.isLoading = isLoading
    }

    public var body: some View {
        ScrollView {
            LazyVStack(spacing: 18) {
                StoriesTrayView(groups: [], isLoading: false)

                if isLoading {
                    GCLoadingView("Carregando feed")
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
                        if let location = post.locationName {
                            GCText(location, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                        }
                    }
                    Spacer()
                    GCText("\(post.authorCurrentStreak ?? 0)d", style: .caption, color: GymCircleTheme.ColorToken.cyan)
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
        return CGFloat(width) / CGFloat(height)
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

            if let imageURL = URL(string: url) {
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    default:
                        Image(systemName: "photo")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                    }
                }
            }
        }
        .aspectRatio(aspectRatio, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .clipped()
    }
}

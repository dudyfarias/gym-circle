import SwiftUI

/// ProfilePostsGridView — grid de posts estilo Instagram, compartilhado pelo
/// ProfileView (própria aba) e OtherProfileView (paridade ProfilePostsGrid web).
///
/// Full-bleed (gap 2px, SEM border-radius — visual edge-to-edge), badge de
/// play em vídeo no canto, e empty-state com câmera (card tracejado).
///
/// Assume container com 20pt de padding horizontal: o grid cancela com -20
/// pra ir até a borda da tela (equivalente ao `-mx-5` do web). O empty-state
/// fica dentro do padding (não é full-bleed), igual ao web.
public struct ProfilePostsGridView: View {
    private let posts: [ProfilePost]
    private let emptyTitle: String
    private let onOpenPost: (ProfilePost) -> Void

    public init(
        posts: [ProfilePost],
        emptyTitle: String,
        onOpenPost: @escaping (ProfilePost) -> Void
    ) {
        self.posts = posts
        self.emptyTitle = emptyTitle
        self.onOpenPost = onOpenPost
    }

    public var body: some View {
        if posts.isEmpty {
            emptyState
        } else {
            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 3),
                spacing: 2
            ) {
                ForEach(posts) { post in
                    Button { onOpenPost(post) } label: { thumb(post) }
                        .buttonStyle(PressableButtonStyle())
                }
            }
            .padding(.horizontal, -20) // full-bleed (cancela o padding do container)
        }
    }

    private func thumb(_ post: ProfilePost) -> some View {
        MediaView(url: post.displayMediaURL, aspectRatio: 1)
            .overlay(alignment: .topTrailing) {
                if post.mediaType == .video {
                    Image(systemName: "play.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 24, height: 24)
                        .background(Circle().fill(Color.black.opacity(0.58)))
                        .padding(6)
                }
            }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "camera")
                .font(.system(size: 28, weight: .regular))
                .foregroundStyle(Color.white.opacity(0.32))
            Text(emptyTitle)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color.white.opacity(0.52))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 56)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color.white.opacity(0.02))
                .overlay(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .strokeBorder(
                            Color.white.opacity(0.08),
                            style: StrokeStyle(lineWidth: 1, dash: [5])
                        )
                )
        )
        .padding(.top, 4)
    }
}

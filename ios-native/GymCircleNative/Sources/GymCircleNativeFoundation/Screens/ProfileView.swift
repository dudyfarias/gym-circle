import SwiftUI

public struct ProfileView: View {
    private let profile: UserProfile?
    private let posts: [ProfilePost]
    private let isLoading: Bool
    private let error: String?
    private let onRetry: () -> Void
    private let onSignOut: () -> Void

    public init(
        profile: UserProfile?,
        posts: [ProfilePost] = [],
        isLoading: Bool = false,
        error: String? = nil,
        onRetry: @escaping () -> Void = {},
        onSignOut: @escaping () -> Void = {}
    ) {
        self.profile = profile
        self.posts = posts
        self.isLoading = isLoading
        self.error = error
        self.onRetry = onRetry
        self.onSignOut = onSignOut
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                if isLoading && profile == nil {
                    profileSkeleton
                } else if let error {
                    GCErrorState(
                        title: "Perfil indisponivel",
                        subtitle: error,
                        retryTitle: "Tentar de novo",
                        onRetry: onRetry
                    )
                } else if let profile {
                    header(profile)
                    postsGrid
                } else {
                    GCEmptyState(
                        title: "Perfil indisponivel",
                        subtitle: "Entre na conta para ver seu perfil nativo."
                    )
                }
            }
            .padding(20)
        }
        .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
        .navigationTitle("Perfil")
    }

    private var profileSkeleton: some View {
        VStack(spacing: 18) {
            GCGlassPanel {
                VStack(spacing: 14) {
                    Circle()
                        .fill(GymCircleTheme.ColorToken.elevatedCard)
                        .frame(width: 96, height: 96)
                    GCSkeletonBlock(height: 18, radius: 9)
                        .frame(width: 160)
                    GCSkeletonBlock(height: 12, radius: 6)
                        .frame(width: 110)
                    GCSkeletonBlock(height: 64, radius: 18)
                }
                .frame(maxWidth: .infinity)
            }
            GCSkeletonBlock(height: 260, radius: 18)
        }
    }

    private func header(_ profile: UserProfile) -> some View {
        GCGlassPanel {
            VStack(spacing: 16) {
                GCAvatar(url: profile.avatarURL, fallback: profile.username, size: 96)

                VStack(spacing: 4) {
                    GCText(profile.displayName ?? profile.username, style: .title)
                    GCText("@\(profile.username)", style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                }

                if let bio = profile.bio, !bio.isEmpty {
                    GCText(bio, style: .body)
                        .multilineTextAlignment(.center)
                }

                HStack(spacing: 12) {
                    stat("Streak", value: "\(profile.currentStreak)d")
                    stat("Maior", value: "\(profile.bestStreak)d")
                    stat("Posts", value: "\(posts.count)")
                }

                GCButton("Sair", systemImage: "rectangle.portrait.and.arrow.right") {
                    onSignOut()
                }
            }
            .frame(maxWidth: .infinity)
        }
    }

    private func stat(_ title: String, value: String) -> some View {
        VStack(spacing: 4) {
            GCText(value, style: .headline, color: GymCircleTheme.ColorToken.cyan)
            GCText(title, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
        }
        .frame(maxWidth: .infinity)
    }

    private var postsGrid: some View {
        Group {
            if posts.isEmpty {
                GCEmptyState(
                    title: "Sem posts ainda",
                    subtitle: "Seus treinos publicados vao aparecer aqui."
                )
            } else {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 3), spacing: 2) {
                    ForEach(posts) { post in
                        MediaView(url: post.displayMediaURL, aspectRatio: 1)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
        }
    }
}

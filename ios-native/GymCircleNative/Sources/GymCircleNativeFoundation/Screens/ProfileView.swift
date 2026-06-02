import SwiftUI

public struct ProfileView: View {
    private let profile: UserProfile?
    private let posts: [ProfilePost]

    public init(profile: UserProfile?, posts: [ProfilePost] = []) {
        self.profile = profile
        self.posts = posts
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                if let profile {
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
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 3), spacing: 2) {
            ForEach(posts) { post in
                MediaView(url: post.displayMediaURL, aspectRatio: 1)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

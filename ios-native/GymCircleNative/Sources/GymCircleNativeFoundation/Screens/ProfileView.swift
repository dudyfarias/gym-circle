import SwiftUI

/// ProfileView — Sprint 8.8 + 20.1/20.2.
///
/// 20.1: migra a row 2D antiga pra FeaturedAchievementsRowView (a mesma
/// do MyCircle, com botão pro Hall — entrada nunca some).
/// 20.2: engrenagem de Settings + tap no grid abre o post completo.
public struct ProfileView: View {
    @ObservedObject private var model: GymCircleAppModel
    private let profile: UserProfile?
    private let posts: [ProfilePost]
    private let featuredAchievements: [Achievement]
    private let allAchievements: [Achievement]

    @State private var settingsPresented = false
    @State private var hallPresented = false
    @State private var hallDetailAchievement: Achievement?
    @State private var openedPost: FeedPost?

    public init(
        model: GymCircleAppModel,
        profile: UserProfile?,
        posts: [ProfilePost] = [],
        featuredAchievements: [Achievement] = [],
        allAchievements: [Achievement] = []
    ) {
        self.model = model
        self.profile = profile
        self.posts = posts
        self.featuredAchievements = featuredAchievements
        self.allAchievements = allAchievements
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                if let profile {
                    header(profile)
                    // Sprint 20.1 — row compartilhada (paridade 15.5 web):
                    // 3 cards por kind + pill que abre o Hall.
                    FeaturedAchievementsRowView(
                        achievements: featuredAchievements,
                        onOpenDetail: { hallDetailAchievement = $0 },
                        onOpenHall: { hallPresented = true }
                    )
                    postsGrid
                } else {
                    GCEmptyState(
                        title: L10n.profileIndisponivel.string,
                        subtitle: L10n.profileEntreParaVer.string
                    )
                }
            }
            .padding(20)
        }
        .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
        .navigationTitle("Perfil")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    settingsPresented = true
                } label: {
                    Image(systemName: "gearshape.fill")
                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                }
                .accessibilityLabel("Configurações")
            }
        }
        .sheet(isPresented: $settingsPresented) {
            SettingsSheet(model: model)
        }
        .sheet(isPresented: $hallPresented) {
            AchievementsView(
                achievements: allAchievements,
                onTap: { hallDetailAchievement = $0 },
                onClose: { hallPresented = false }
            )
            .sheet(item: $hallDetailAchievement) { achievement in
                AchievementDetailView(
                    achievement: achievement,
                    onClose: { hallDetailAchievement = nil }
                )
            }
        }
        .sheet(item: $openedPost) { post in
            // Sprint 20.2 — post completo do grid (card com curtir/
            // comentários do próprio feed pipeline).
            NavigationStack {
                ScrollView {
                    FeedPostCard(
                        post: post,
                        currentUserId: model.currentUserId,
                        onLike: {
                            Task { await model.toggleLike(postId: post.id) }
                        }
                    )
                    .padding(20)
                }
                .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
                .navigationTitle("Post")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Fechar") { openedPost = nil }
                            .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                    }
                }
            }
            .preferredColorScheme(.dark)
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
                    stat(L10n.profileStreak.string, value: "\(profile.currentStreak)d")
                    stat(L10n.profileMaior.string, value: "\(profile.bestStreak)d")
                    stat(L10n.profilePosts.string, value: "\(posts.count)")
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
                Button {
                    openedPost = post
                } label: {
                    MediaView(url: post.displayMediaURL, aspectRatio: 1)
                }
                .buttonStyle(.plain)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

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
    private let myCircle: MyCircleViewData
    private let featuredAchievements: [Achievement]
    private let allAchievements: [Achievement]

    @State private var settingsPresented = false
    @State private var hallPresented = false
    @State private var hallDetailAchievement: Achievement?
    @State private var openedPost: FeedPost?
    @State private var editPresented = false
    @State private var followersCount = 0
    @State private var followingCount = 0

    public init(
        model: GymCircleAppModel,
        profile: UserProfile?,
        posts: [ProfilePost] = [],
        myCircle: MyCircleViewData,
        featuredAchievements: [Achievement] = [],
        allAchievements: [Achievement] = []
    ) {
        self.model = model
        self.profile = profile
        self.posts = posts
        self.myCircle = myCircle
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
        .navigationTitle(Loc.profile)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    settingsPresented = true
                } label: {
                    Image(systemName: "gearshape.fill")
                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                }
                .accessibilityLabel(Loc.settings)
            }
        }
        .task {
            // Counts de seguidores/seguindo do próprio user (paridade web).
            let counts = await model.fetchFollowCounts()
            followersCount = counts.followers
            followingCount = counts.following
        }
        .sheet(isPresented: $settingsPresented) {
            SettingsSheet(model: model)
        }
        .sheet(isPresented: $editPresented) {
            if let profile {
                EditProfileSheet(
                    profile: profile,
                    onSave: { updated in
                        await model.saveProfile(
                            displayName: updated.displayName,
                            bio: updated.bio,
                            fitnessGoal: updated.fitnessGoal,
                            isPrivate: updated.isPrivate,
                            instagramUsername: updated.instagramUsername,
                            birthDate: updated.birthDate,
                            sports: updated.sports,
                            preferredTrainingTimes: updated.preferredTrainingTimes
                        )
                    },
                    onUploadAvatar: { data in await model.uploadAvatar(imageData: data) },
                    onClose: { editPresented = false }
                )
            }
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
                .navigationTitle(Loc.post)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button(Loc.close) { openedPost = nil }
                            .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                    }
                }
            }
            .preferredColorScheme(.dark)
        }
    }

    // Header paridade web (ProfileIdentity): anéis de consistência com a foto
    // no centro · nome/@ · chips (streak/nível) · bio · stats
    // (posts/seguidores/seguindo) · botão Editar perfil.
    private func header(_ profile: UserProfile) -> some View {
        VStack(spacing: 0) {
            AvatarConsistencyRings(
                rings: ConsistencyRings(
                    workoutsThisWeek: myCircle.stats.workoutsThisWeek,
                    workoutsThisMonth: myCircle.stats.workoutsThisMonth,
                    workoutsThisYear: myCircle.stats.workoutsThisYear
                ),
                avatarURL: profile.avatarURL,
                fallback: profile.username,
                size: 150,
                hasStory: myCircle.hasStory,
                storyViewed: myCircle.storyViewed
            )

            VStack(spacing: 2) {
                HStack(spacing: 6) {
                    Text(profile.displayName ?? profile.username)
                        .font(.system(size: 22, weight: .black))
                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                        .lineLimit(1)
                    if profile.isPrivate {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.white.opacity(0.52))
                    }
                }
                Text("@\(profile.username)")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.white.opacity(0.52))
            }
            .padding(.top, 16)

            chipsRow(profile)
                .padding(.top, 12)

            if let bio = profile.bio, !bio.isEmpty {
                Text(bio)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.white.opacity(0.86))
                    .multilineTextAlignment(.center)
                    .padding(.top, 12)
            }

            statsRow
                .padding(.top, 16)

            Button {
                editPresented = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "pencil")
                        .font(.system(size: 13, weight: .bold))
                    Text(L10n.editProfileTitle.string)
                        .font(.system(size: 13, weight: .black))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.white.opacity(0.06)))
                .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
            }
            .buttonStyle(.plain)
            .padding(.top, 16)
        }
        .frame(maxWidth: .infinity)
    }

    // Chips streak + nível (paridade web). Academia fica de fora (sem fonte
    // de dados no perfil nativo ainda).
    @ViewBuilder
    private func chipsRow(_ profile: UserProfile) -> some View {
        let lit = profile.badgeIsActiveToday
        let hasStreak = profile.currentStreak > 0 || lit
        if hasStreak {
            let level = StreakLevel.current(for: profile.currentStreak)
            HStack(spacing: 6) {
                HStack(spacing: 4) {
                    Image(systemName: lit ? "flame.fill" : "flame")
                        .font(.system(size: 11, weight: .bold))
                    Text("\(profile.currentStreak)d")
                        .font(.system(size: 11, weight: .black))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Capsule().fill(lit ? GymCircleTheme.ColorToken.cyan.opacity(0.14) : Color.white.opacity(0.06)))
                .foregroundStyle(lit ? GymCircleTheme.ColorToken.cyan : Color.white.opacity(0.72))

                Text(level.shortLabel)
                    .font(.system(size: 11, weight: .black))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Capsule().fill(Color.white.opacity(0.06)))
                    .foregroundStyle(Color.white.opacity(0.72))
            }
        }
    }

    private var statsRow: some View {
        HStack(spacing: 4) {
            statCol(value: posts.count, label: L10n.profilePosts.string)
            statCol(value: followersCount, label: L10n.profileFollowers.string)
            statCol(value: followingCount, label: L10n.profileFollowing.string)
        }
        .frame(maxWidth: 320)
    }

    private func statCol(value: Int, label: String) -> some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(.system(size: 18, weight: .black))
                .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
            Text(label)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.white.opacity(0.52))
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

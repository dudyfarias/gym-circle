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
    @State private var myCirclePresented = false
    @State private var hallPresented = false
    @State private var hallDetailAchievement: Achievement?
    @State private var openedPost: FeedPost?
    @State private var editPresented = false
    @State private var followersCount = 0
    @State private var followingCount = 0
    @State private var followersPresented = false
    @State private var followingPresented = false
    @State private var streakRestore: MyCircleService.StreakRestoreInfo?
    // Nome da academia principal (pro chip do header, paridade web).
    @State private var gymName: String?
    // Chips de completar perfil já dispensados (tracking local em UserDefaults,
    // como o first-visit hint — single-device).
    @State private var dismissedHints: Set<String> = []

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
                    completionSection(profile)
                    if let restore = streakRestore, restore.canRestore {
                        streakRestoreCard(restore)
                    }
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
            streakRestore = await model.fetchStreakRestoreInfo()
            if let gymId = profile?.mainGymId {
                gymName = await model.fetchGym(id: gymId)?.name
            }
            dismissedHints = Set(Self.completionIDs.filter {
                UserDefaults.standard.bool(forKey: "profile-complete-seen-\($0)")
            })
        }
        .sheet(isPresented: $settingsPresented) {
            SettingsSheet(model: model)
        }
        .sheet(isPresented: $myCirclePresented) {
            NavigationStack {
                MyCircleView(
                    data: myCircle,
                    onChangeMonth: { offset in
                        Task { await model.loadCalendarForMonth(offset: offset) }
                    },
                    onLoadRanking: { scope, period in
                        await model.loadRanking(scope, period)
                    },
                    onOpenPost: { postId in
                        // Fecha o MyCircle e abre o post (evita sheet aninhado).
                        myCirclePresented = false
                        Task {
                            if let post = await model.fetchPost(postId: postId) {
                                try? await Task.sleep(nanoseconds: 350_000_000)
                                openedPost = post
                            }
                        }
                    }
                )
                .navigationTitle(Loc.myCircle)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button(Loc.close) { myCirclePresented = false }
                            .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                    }
                }
            }
            .preferredColorScheme(.dark)
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
                            preferredTrainingTimes: updated.preferredTrainingTimes,
                            mainGymId: updated.mainGymId
                        )
                    },
                    onUploadAvatar: { data in await model.uploadAvatar(imageData: data) },
                    onClose: { editPresented = false },
                    searchGyms: { await model.searchGyms(query: $0) },
                    loadGymName: { await model.fetchGym(id: $0) }
                )
            }
        }
        .sheet(isPresented: $followersPresented) {
            if let profile {
                FollowListSheet(model: model, userId: profile.userId, mode: .followers)
            }
        }
        .sheet(isPresented: $followingPresented) {
            if let profile {
                FollowListSheet(model: model, userId: profile.userId, mode: .following)
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
            // Tap na própria foto abre o My Circle (paridade web: rings → hub).
            .contentShape(Circle())
            .onTapGesture { myCirclePresented = true }
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel(Loc.myCircle)

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
        // Streak/nível vêm de myCircle.stats (user_stats_live), não do
        // UserProfile (profiles não tem current_streak → vinha 0, sumia o chip).
        let lit = myCircle.streakLitToday
        let streak = myCircle.stats.currentStreak
        let hasStreak = streak > 0 || lit
        // Paridade web: a row aparece quando há streak OU academia.
        if hasStreak || gymName != nil {
            let level = StreakLevel.current(for: streak)
            HStack(spacing: 6) {
                if hasStreak {
                    HStack(spacing: 4) {
                        Image(systemName: lit ? "flame.fill" : "flame")
                            .font(.system(size: 11, weight: .bold))
                        Text("\(streak)d")
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
                if let gymName {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.and.ellipse")
                            .font(.system(size: 11, weight: .bold))
                        Text(gymName)
                            .font(.system(size: 11, weight: .black))
                            .lineLimit(1)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Capsule().fill(Color.white.opacity(0.06)))
                    .foregroundStyle(Color.white.opacity(0.72))
                }
            }
        }
    }

    private var statsRow: some View {
        HStack(spacing: 4) {
            statCol(value: posts.count, label: L10n.profilePosts.string)
            statCol(value: followersCount, label: L10n.profileFollowers.string) { followersPresented = true }
            statCol(value: followingCount, label: L10n.profileFollowing.string) { followingPresented = true }
        }
        .frame(maxWidth: 320)
    }

    @ViewBuilder
    private func statCol(value: Int, label: String, action: (() -> Void)? = nil) -> some View {
        if let action {
            Button(action: action) { statColContent(value: value, label: label) }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
        } else {
            statColContent(value: value, label: label)
                .frame(maxWidth: .infinity)
        }
    }

    private func statColContent(value: Int, label: String) -> some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(.system(size: 18, weight: .black))
                .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
            Text(label)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.white.opacity(0.52))
        }
    }

    // Card de restaurar streak (paridade ProfileScreen web) — só aparece quando
    // há restaurador disponível e o prazo ainda não venceu.
    private func streakRestoreCard(_ restore: MyCircleService.StreakRestoreInfo) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "lifepreserver")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                .frame(width: 40, height: 40)
                .background(Circle().fill(GymCircleTheme.ColorToken.cyan.opacity(0.14)))

            VStack(alignment: .leading, spacing: 4) {
                Text(Loc.t("Restore streak?", "Restaurar streak?"))
                    .font(.system(size: 14, weight: .black))
                    .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                Text(Loc.t("Use 1 restore to save yesterday's missed day.", "Use 1 restaurador para proteger o dia que passou."))
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.white.opacity(0.58))
                    .fixedSize(horizontal: false, vertical: true)
                if let countdown = restoreCountdown(restore.deadlineAt) {
                    HStack(spacing: 4) {
                        Image(systemName: "clock").font(.system(size: 11, weight: .bold))
                        Text(countdown).font(.system(size: 11, weight: .black))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Color.black.opacity(0.24)))
                    .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                    .padding(.top, 2)
                }
            }
            Spacer(minLength: 8)
            Button {
                Task {
                    await model.useStreakRestore()
                    streakRestore = await model.fetchStreakRestoreInfo()
                }
            } label: {
                Text(Loc.t("Restore", "Restaurar"))
                    .font(.system(size: 12, weight: .black))
                    .foregroundStyle(.black)
                    .padding(.horizontal, 16)
                    .frame(height: 36)
                    .background(Capsule().fill(GymCircleTheme.ColorToken.cyan))
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(GymCircleTheme.ColorToken.cyan.opacity(0.07))
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(GymCircleTheme.ColorToken.cyan.opacity(0.2), lineWidth: 1)
                )
        )
    }

    /// Espelha formatRestoreCountdown do web: "Restam Xh" ou "Restam Xmin".
    private func restoreCountdown(_ deadline: Date?) -> String? {
        guard let deadline else { return nil }
        let diff = deadline.timeIntervalSinceNow
        guard diff > 0 else { return nil }
        let hours = Int(diff / 3600)
        let minutes = max(1, Int((diff.truncatingRemainder(dividingBy: 3600) / 60).rounded(.up)))
        if hours <= 0 {
            return Loc.t("\(minutes)min left", "Restam \(minutes)min")
        }
        return Loc.t("\(hours)h left", "Restam \(hours)h")
    }

    // MARK: - Completar perfil (paridade ProfileScreen web)

    private struct CompletionItem: Identifiable {
        let id: String
        let label: String
        let icon: String
        let weight: Int
        let complete: Bool
    }

    private static let completionIDs = ["identity", "avatar", "gym", "goal", "bio", "preferredTimes"]

    private func calculateCompletion(_ p: UserProfile) -> (percentage: Int, missing: [CompletionItem]) {
        func hasText(_ s: String?) -> Bool {
            !(s ?? "").trimmingCharacters(in: .whitespaces).isEmpty
        }
        // Itens idênticos ao web (pesos 40/15/15/10/10/10 = 100).
        let items: [CompletionItem] = [
            CompletionItem(id: "identity", label: Loc.t("Name and username", "Nome e username"), icon: "person.crop.circle", weight: 40,
                           complete: hasText(p.displayName) && p.displayName != "—" && hasText(p.username) && p.username != "—"),
            CompletionItem(id: "avatar", label: Loc.t("Profile photo", "Foto de perfil"), icon: "camera", weight: 15, complete: hasText(p.avatarURL)),
            CompletionItem(id: "gym", label: Loc.t("Gym", "Academia"), icon: "mappin.and.ellipse", weight: 15, complete: hasText(p.mainGymId)),
            CompletionItem(id: "goal", label: Loc.t("Fitness goal", "Objetivo fitness"), icon: "target", weight: 10, complete: hasText(p.fitnessGoal)),
            CompletionItem(id: "bio", label: Loc.t("Bio", "Bio"), icon: "person", weight: 10, complete: hasText(p.bio)),
            CompletionItem(id: "preferredTimes", label: Loc.t("Workout times", "Horários de treino"), icon: "clock", weight: 10, complete: !p.preferredTrainingTimes.isEmpty),
        ]
        let total = items.reduce(0) { $0 + $1.weight }
        let earned = items.reduce(0) { $0 + ($1.complete ? $1.weight : 0) }
        let pct = total > 0 ? Int((Double(earned) / Double(total) * 100).rounded()) : 0
        return (pct, items.filter { !$0.complete })
    }

    @ViewBuilder
    private func completionSection(_ profile: UserProfile) -> some View {
        let result = calculateCompletion(profile)
        let pending = result.missing
            .filter { !dismissedHints.contains($0.id) }
            .sorted { $0.weight > $1.weight }
            .prefix(2)
        if result.percentage < 100, !pending.isEmpty {
            VStack(spacing: 6) {
                // Mini barra de progresso (paridade web).
                HStack(spacing: 8) {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.white.opacity(0.06))
                            Capsule()
                                .fill(LinearGradient(
                                    colors: [GymCircleTheme.ColorToken.cyan, GymCircleTheme.ColorToken.electricBlue, GymCircleTheme.ColorToken.deepBlue],
                                    startPoint: .leading, endPoint: .trailing
                                ))
                                .frame(width: geo.size.width * CGFloat(result.percentage) / 100)
                        }
                    }
                    .frame(height: 4)
                    Text("\(result.percentage)%")
                        .font(.system(size: 10, weight: .black))
                        .foregroundStyle(Color.white.opacity(0.52))
                }
                .padding(.horizontal, 2)

                ForEach(Array(pending)) { item in completionChip(item) }
            }
        }
    }

    private func completionChip(_ item: CompletionItem) -> some View {
        HStack(spacing: 8) {
            Button { editPresented = true } label: {
                HStack(spacing: 10) {
                    Image(systemName: item.icon)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                        .frame(width: 28, height: 28)
                        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(GymCircleTheme.ColorToken.cyan.opacity(0.12)))
                    Text(item.label)
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.86))
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    Text("→")
                        .font(.system(size: 14, weight: .black))
                        .foregroundStyle(Color.white.opacity(0.52))
                }
            }
            .buttonStyle(.plain)
            Button { dismissHint(item.id) } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color.white.opacity(0.4))
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white.opacity(0.04)))
    }

    private func dismissHint(_ id: String) {
        UserDefaults.standard.set(true, forKey: "profile-complete-seen-\(id)")
        dismissedHints.insert(id)
    }

    private var postsGrid: some View {
        ProfilePostsGridView(
            posts: posts,
            emptyTitle: Loc.t("Your workouts will show up here", "Seus treinos vão aparecer aqui"),
            onOpenPost: { openedPost = $0 }
        )
    }
}

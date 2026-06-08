import SwiftUI

public struct ProfileView: View {
    private let profile: UserProfile?
    private let posts: [ProfilePost]
    private let featuredAchievements: [Achievement]
    private let onTapAchievement: ((Achievement) -> Void)?

    public init(
        profile: UserProfile?,
        posts: [ProfilePost] = [],
        featuredAchievements: [Achievement] = [],
        onTapAchievement: ((Achievement) -> Void)? = nil
    ) {
        self.profile = profile
        self.posts = posts
        self.featuredAchievements = featuredAchievements
        self.onTapAchievement = onTapAchievement
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                if let profile {
                    header(profile)
                    if !featuredAchievements.isEmpty {
                        featuredRow
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
                    stat(L10n.profileStreak.string, value: "\(profile.currentStreak)d")
                    stat(L10n.profileMaior.string, value: "\(profile.bestStreak)d")
                    stat(L10n.profilePosts.string, value: "\(posts.count)")
                }
            }
            .frame(maxWidth: .infinity)
        }
    }

    // Sprint 8.8 — Featured Achievements row (paridade Sprint 7.5.5 web)
    private var featuredRow: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(L10n.profileConquistasDestaque.string)
                .font(.system(size: 11, weight: .heavy))
                .tracking(0.8)
                .foregroundColor(.white.opacity(0.44))
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 10) {
                ForEach(Array(featuredAchievements.prefix(3).enumerated()), id: \.element.id) { _, achievement in
                    featuredCard(achievement)
                }
            }
        }
    }

    private func featuredCard(_ achievement: Achievement) -> some View {
        Button(action: { onTapAchievement?(achievement) }) {
            VStack(spacing: 8) {
                BadgeIconNativeView(
                    iconKey: achievement.iconKey,
                    earned: achievement.earned,
                    size: 56
                )
                .padding(.top, 6)

                Text(achievement.label)
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundColor(achievement.earned ? .white : .white.opacity(0.56))
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 4)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(featuredCardBackground(achievement))
            )
        }
        .buttonStyle(.plain)
    }

    /// Sprint 8.12.1 — paleta por **kind** (não rarity), paridade `KIND_TONE`
    /// em `FeaturedAchievementsRow.tsx` web:
    ///   - relic    → purple #A78BFA (mítico)
    ///   - trophy   → brand cyan (achievement social)
    ///   - medal    → gold #FBBF24 (streak histórico)
    ///   - badge    → white sutil (entry-level)
    ///   - challenge→ green #34D399 (mensal temático)
    /// Locked cards usam fundo neutro 0.025.
    private func featuredCardBackground(_ a: Achievement) -> Color {
        guard a.earned else { return Color.white.opacity(0.025) }
        // Sprint 9.6.3 — usa tokens GymCircleTheme pra eliminar drift de cor.
        switch a.kind {
        case .relic:     return GymCircleTheme.ColorToken.rarityEpic.opacity(0.12)
        case .trophy:    return GymCircleTheme.ColorToken.electricBlue.opacity(0.14)
        case .medal:     return GymCircleTheme.ColorToken.rarityLegendary.opacity(0.14)
        case .badge:     return Color.white.opacity(0.06)
        case .challenge: return GymCircleTheme.ColorToken.rarityUncommon.opacity(0.12)
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

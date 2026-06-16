import SwiftUI

/// OtherProfileView — Sprint 8.13.6 (paridade ProfileSheet.tsx web).
///
/// Tela de perfil de **outros users** (visitando alguém pelo feed/lista).
/// Difere de ProfileView (próprio) em:
///   - Action row 4 botões: Follow / Mensagem / Reportar / Bloquear
///   - LatestPostPreview em destaque antes do grid (UX de "conhecer pelo
///     último treino")
///   - PrivateLockedNotice quando perfil privado e follow não aprovado
///   - Sem edit profile, sem featured row priority (read-only)
///
/// Privacy: respeita `canSeeDetails` (calculado pelo caller via
/// `isOwn || !isPrivate || followStatus == accepted`).
public struct OtherProfileView: View {
    public enum FollowState: String, Sendable {
        case none
        case pending
        case accepted
    }

    public let profile: UserProfile
    public let posts: [ProfilePost]
    public let latestPost: ProfilePost?
    public let followState: FollowState
    public let canSeePosts: Bool
    // Sprint 11.1 — contadores reais (antes vinham 0 sempre)
    public let postsCount: Int
    public let followersCount: Int
    public let followingCount: Int
    public let realCurrentStreak: Int
    public let realBestStreak: Int
    public let onToggleFollow: () -> Void
    public let onMessage: () -> Void
    public let onReport: () -> Void
    public let onBlock: () -> Void
    public let onOpenPost: ((String) -> Void)?
    public let onClose: () -> Void
    /// Sprint 22.x — carrega os anéis de consistência do user (paridade web).
    /// Opcional/fail-soft: nil → header cai no avatar simples.
    public let loadRings: ((String) async -> ConsistencyRings?)?
    /// Sprint 22.x — stats clicáveis (host apresenta a lista). nil → não-tap.
    public let onOpenFollowers: (() -> Void)?
    public let onOpenFollowing: (() -> Void)?

    @State private var rings: ConsistencyRings?

    public init(
        profile: UserProfile,
        posts: [ProfilePost] = [],
        latestPost: ProfilePost? = nil,
        followState: FollowState = .none,
        canSeePosts: Bool = true,
        postsCount: Int = 0,
        followersCount: Int = 0,
        followingCount: Int = 0,
        realCurrentStreak: Int = 0,
        realBestStreak: Int = 0,
        onToggleFollow: @escaping () -> Void,
        onMessage: @escaping () -> Void,
        onReport: @escaping () -> Void,
        onBlock: @escaping () -> Void,
        onOpenPost: ((String) -> Void)? = nil,
        onClose: @escaping () -> Void,
        loadRings: ((String) async -> ConsistencyRings?)? = nil,
        onOpenFollowers: (() -> Void)? = nil,
        onOpenFollowing: (() -> Void)? = nil
    ) {
        self.profile = profile
        self.posts = posts
        self.latestPost = latestPost
        self.followState = followState
        self.canSeePosts = canSeePosts
        self.postsCount = postsCount
        self.followersCount = followersCount
        self.followingCount = followingCount
        self.realCurrentStreak = realCurrentStreak
        self.realBestStreak = realBestStreak
        self.onToggleFollow = onToggleFollow
        self.onMessage = onMessage
        self.onReport = onReport
        self.onBlock = onBlock
        self.onOpenPost = onOpenPost
        self.onClose = onClose
        self.loadRings = loadRings
        self.onOpenFollowers = onOpenFollowers
        self.onOpenFollowing = onOpenFollowing
    }

    public var body: some View {
        accessibleBody
            .accessibilityAddTraits(.isModal) // Sprint 9.8.5
            .task {
                // Anéis só quando posso ver os posts (mesma porta da RLS de
                // user_activity_days). Perfil privado não-seguido → fica no
                // avatar simples.
                if canSeePosts, rings == nil, let loadRings {
                    rings = await loadRings(profile.userId)
                }
            }
    }

    private var accessibleBody: some View {
        ZStack(alignment: .top) {
            GymCircleTheme.ColorToken.appBackground.ignoresSafeArea()

            VStack(spacing: 0) {
                header

                ScrollView {
                    VStack(spacing: 20) {
                        identitySection
                        actionRow
                        if !canSeePosts {
                            privateLockedNotice
                        } else {
                            if let latest = latestPost {
                                latestPostPreview(latest)
                            }
                            postsGrid
                        }
                        Spacer(minLength: 32)
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 16)
                    .padding(.bottom, 24)
                }
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .heavy))
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Color.white.opacity(0.06)))
                    .foregroundColor(.white)
            }
            .accessibilityLabel(Text(L10n.commonClose.string))
            Spacer()
            Text("@\(profile.username)")
                .font(.system(size: 14, weight: .heavy))
                .foregroundColor(.white.opacity(0.82))
                .lineLimit(1)
            Spacer()
            Spacer().frame(width: 36)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }

    // MARK: - Identity

    private var identitySection: some View {
        VStack(spacing: 12) {
            // Anéis de consistência com a foto (paridade web). Cai no avatar
            // simples quando os anéis não carregaram (privado não-seguido).
            Group {
                if let rings {
                    AvatarConsistencyRings(
                        rings: rings,
                        avatarURL: profile.avatarURL,
                        fallback: profile.username,
                        size: 132
                    )
                } else {
                    GCAvatar(url: profile.avatarURL, fallback: profile.username, size: 96)
                }
            }

            VStack(spacing: 4) {
                HStack(spacing: 6) {
                    Text(profile.displayName ?? profile.username)
                        .font(.system(size: 22, weight: .black))
                        .foregroundColor(.white)
                        .lineLimit(1)
                    if profile.isPrivate {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white.opacity(0.52))
                    }
                }
                Text("@\(profile.username)")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.white.opacity(0.52))
            }

            chipsRow

            if let bio = profile.bio, !bio.isEmpty {
                Text(bio)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white.opacity(0.86))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }

            // Stats Instagram-style: Posts · Seguidores · Seguindo (clicáveis).
            HStack(spacing: 16) {
                stat(L10n.profilePosts.string, value: formatCount(postsCount))
                statButton(L10n.profileFollowers.string, value: formatCount(followersCount), action: onOpenFollowers)
                statButton(L10n.profileFollowing.string, value: formatCount(followingCount), action: onOpenFollowing)
            }
            .padding(.top, 4)
        }
    }

    // Chips streak + nível (paridade ProfileIdentity web).
    @ViewBuilder
    private var chipsRow: some View {
        let lit = profile.badgeIsActiveToday
        let hasStreak = realCurrentStreak > 0 || lit
        if hasStreak {
            let level = StreakLevel.current(for: realCurrentStreak)
            HStack(spacing: 6) {
                HStack(spacing: 4) {
                    Image(systemName: lit ? "flame.fill" : "flame")
                        .font(.system(size: 11, weight: .bold))
                    Text("\(realCurrentStreak)d")
                        .font(.system(size: 11, weight: .black))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Capsule().fill(lit ? GymCircleTheme.ColorToken.cyan.opacity(0.14) : Color.white.opacity(0.06)))
                .foregroundColor(lit ? GymCircleTheme.ColorToken.cyan : Color.white.opacity(0.72))

                Text(level.shortLabel)
                    .font(.system(size: 11, weight: .black))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Capsule().fill(Color.white.opacity(0.06)))
                    .foregroundColor(.white.opacity(0.72))
            }
        }
    }

    /// Sprint 11.1 — formato compacto pra contadores grandes (1.2k em vez de 1234).
    private func formatCount(_ n: Int) -> String {
        if n >= 1_000_000 {
            return String(format: "%.1fM", Double(n) / 1_000_000).replacingOccurrences(of: ".0M", with: "M")
        }
        if n >= 1_000 {
            return String(format: "%.1fk", Double(n) / 1_000).replacingOccurrences(of: ".0k", with: "k")
        }
        return "\(n)"
    }

    private func stat(_ title: String, value: String) -> some View {
        VStack(spacing: 4) {
            GCText(value, style: .headline, color: GymCircleTheme.ColorToken.cyan)
            GCText(title, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
        }
        .frame(minWidth: 72)
    }

    @ViewBuilder
    private func statButton(_ title: String, value: String, action: (() -> Void)?) -> some View {
        if let action {
            Button(action: action) { stat(title, value: value) }
                .buttonStyle(.plain)
        } else {
            stat(title, value: value)
        }
    }

    // MARK: - Action row (Follow / Message / Report / Block)

    private var actionRow: some View {
        HStack(spacing: 8) {
            // Follow CTA (largura flex)
            Button(action: onToggleFollow) {
                HStack(spacing: 6) {
                    Image(systemName: followIcon)
                        .font(.system(size: 13, weight: .heavy))
                    Text(followLabel)
                        .font(.system(size: 13, weight: .heavy))
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Capsule().fill(followBgColor))
                .foregroundColor(followFgColor)
            }
            .buttonStyle(PressableButtonStyle())

            Button(action: onMessage) {
                HStack(spacing: 6) {
                    Image(systemName: "message.fill")
                        .font(.system(size: 13, weight: .heavy))
                    Text(L10n.profileMessage.string)
                        .font(.system(size: 13, weight: .heavy))
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Capsule().fill(Color.white.opacity(0.06)))
                .foregroundColor(.white)
            }
            .buttonStyle(PressableButtonStyle())

            iconCircleButton(systemName: "flag", color: .white.opacity(0.62), action: onReport)
            iconCircleButton(systemName: "nosign", color: Color(red: 1, green: 0.42, blue: 0.42), action: onBlock)
        }
    }

    private func iconCircleButton(systemName: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 14, weight: .heavy))
                .frame(width: 40, height: 40)
                .background(Circle().fill(Color.white.opacity(0.04)).overlay(Circle().stroke(Color.white.opacity(0.1), lineWidth: 1)))
                .foregroundColor(color)
        }
        .buttonStyle(PressableButtonStyle())
    }

    private var followIcon: String {
        switch followState {
        case .accepted: return "person.fill.checkmark"
        case .pending:  return "clock.fill"
        case .none:     return profile.isPrivate ? "lock.fill" : "person.fill.badge.plus"
        }
    }

    private var followLabel: String {
        switch followState {
        case .accepted: return L10n.profileFollowing.string
        case .pending:  return L10n.profileFollowRequested.string
        case .none:     return profile.isPrivate ? L10n.profileRequestFollow.string : L10n.profileFollow.string
        }
    }

    private var followBgColor: Color {
        switch followState {
        case .accepted: return Color.white
        case .pending:  return Color.white.opacity(0.06)
        case .none:     return GymCircleTheme.ColorToken.electricBlue
        }
    }

    private var followFgColor: Color {
        switch followState {
        case .accepted: return .black
        case .pending:  return .white.opacity(0.72)
        case .none:     return .black
        }
    }

    // MARK: - Private locked

    private var privateLockedNotice: some View {
        VStack(spacing: 12) {
            Image(systemName: "lock.fill")
                .font(.system(size: 22, weight: .heavy))
                .frame(width: 56, height: 56)
                .background(Circle().fill(GymCircleTheme.ColorToken.electricBlue.opacity(0.14)))
                .foregroundColor(GymCircleTheme.ColorToken.electricBlue)

            Text(L10n.myCirclePrivacyTitle.string)
                .font(.system(size: 16, weight: .heavy))
                .foregroundColor(.white)

            Text(L10n.myCirclePrivacyBody.string)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundColor(.white.opacity(0.56))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 12)

            // Sprint 9.8.4 — latestPost preview (paridade UX "público vê só último treino")
            if let latest = latestPost {
                privateLatestPostPreview(latest)
                    .padding(.top, 8)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color.white.opacity(0.03))
                .overlay(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
        )
    }

    /// Sprint 9.8.4 — preview do último post no PrivateLockedNotice.
    /// Permite o user ter um "vislumbre" antes de solicitar follow.
    private func privateLatestPostPreview(_ post: ProfilePost) -> some View {
        ZStack(alignment: .bottomLeading) {
            AsyncImage(url: URL(string: post.displayMediaURL)) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fill)
                default:
                    Color.white.opacity(0.04)
                }
            }
            .frame(width: 220, height: 220)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

            LinearGradient(
                colors: [.clear, .black.opacity(0.55)],
                startPoint: .center,
                endPoint: .bottom
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

            Text(L10n.profileLastPost.string)
                .font(.system(size: 10, weight: .heavy))
                .tracking(0.8)
                .foregroundColor(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Capsule().fill(.black.opacity(0.5)))
                .padding(10)
        }
        .frame(width: 220, height: 220)
    }

    // MARK: - Latest post preview

    private func latestPostPreview(_ post: ProfilePost) -> some View {
        Button(action: { onOpenPost?(post.id) }) {
            ZStack(alignment: .bottomLeading) {
                AsyncImage(url: URL(string: post.displayMediaURL)) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().aspectRatio(contentMode: .fill)
                    default:
                        Color.white.opacity(0.04)
                    }
                }
                .frame(maxWidth: .infinity)
                .aspectRatio(1.4, contentMode: .fill)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))

                LinearGradient(
                    colors: [.clear, .black.opacity(0.6)],
                    startPoint: .center,
                    endPoint: .bottom
                )
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))

                Text(L10n.profileLastPost.string)
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(1.0)
                    .foregroundColor(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(.black.opacity(0.4)))
                    .padding(12)
            }
        }
        .buttonStyle(PressableButtonStyle())
    }

    // MARK: - Posts grid

    private var postsGrid: some View {
        ProfilePostsGridView(
            posts: posts,
            emptyTitle: Loc.t("No workouts posted yet", "Nenhum treino publicado ainda"),
            onOpenPost: { onOpenPost?($0.id) }
        )
    }
}

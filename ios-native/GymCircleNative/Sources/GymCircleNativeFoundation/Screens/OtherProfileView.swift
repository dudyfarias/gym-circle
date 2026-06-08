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
    public let onToggleFollow: () -> Void
    public let onMessage: () -> Void
    public let onReport: () -> Void
    public let onBlock: () -> Void
    public let onOpenPost: ((String) -> Void)?
    public let onClose: () -> Void

    public init(
        profile: UserProfile,
        posts: [ProfilePost] = [],
        latestPost: ProfilePost? = nil,
        followState: FollowState = .none,
        canSeePosts: Bool = true,
        onToggleFollow: @escaping () -> Void,
        onMessage: @escaping () -> Void,
        onReport: @escaping () -> Void,
        onBlock: @escaping () -> Void,
        onOpenPost: ((String) -> Void)? = nil,
        onClose: @escaping () -> Void
    ) {
        self.profile = profile
        self.posts = posts
        self.latestPost = latestPost
        self.followState = followState
        self.canSeePosts = canSeePosts
        self.onToggleFollow = onToggleFollow
        self.onMessage = onMessage
        self.onReport = onReport
        self.onBlock = onBlock
        self.onOpenPost = onOpenPost
        self.onClose = onClose
    }

    public var body: some View {
        accessibleBody
            .accessibilityAddTraits(.isModal) // Sprint 9.8.5
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
            .accessibilityLabel(Text("Fechar"))
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
            GCAvatar(url: profile.avatarURL, fallback: profile.username, size: 96)

            VStack(spacing: 4) {
                HStack(spacing: 6) {
                    GCText(profile.displayName ?? profile.username, style: .title)
                    if profile.isPrivate {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 11, weight: .heavy))
                            .foregroundColor(.white.opacity(0.52))
                    }
                }
                GCText("@\(profile.username)", style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
            }

            if let bio = profile.bio, !bio.isEmpty {
                GCText(bio, style: .body)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }

            HStack(spacing: 16) {
                stat(L10n.profileStreak.string, value: "\(profile.currentStreak)d")
                stat(L10n.profileMaior.string, value: "\(profile.bestStreak)d")
                stat(L10n.profilePosts.string, value: "\(posts.count)")
            }
            .padding(.top, 4)
        }
    }

    private func stat(_ title: String, value: String) -> some View {
        VStack(spacing: 4) {
            GCText(value, style: .headline, color: GymCircleTheme.ColorToken.cyan)
            GCText(title, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
        }
        .frame(minWidth: 72)
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
            .buttonStyle(.plain)

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
            .buttonStyle(.plain)

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
        .buttonStyle(.plain)
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
        .buttonStyle(.plain)
    }

    // MARK: - Posts grid

    private var postsGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 3), spacing: 2) {
            ForEach(posts) { post in
                Button(action: { onOpenPost?(post.id) }) {
                    MediaView(url: post.displayMediaURL, aspectRatio: 1)
                }
                .buttonStyle(.plain)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

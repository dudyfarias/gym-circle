import SwiftUI

/// NotificationsSheet — Sprint 20.7 (paridade NotificationsSheet web).
///
/// Lista do sino com ator + texto por kind + ponto de não-lida; abre o
/// post (kinds de post) ou o perfil do ator (kinds de follow). Mark-all-
/// read ao abrir, igual à web.
public struct NotificationsSheet: View {
    @ObservedObject private var model: GymCircleAppModel

    @Environment(\.dismiss) private var dismiss
    @State private var notifications: [AppNotification] = []
    @State private var isLoading = true
    @State private var openedPost: FeedPost?
    @State private var openedProfile: OtherProfileSummary?
    // Ações inline (paridade web): quem eu já sigo (baseline pro follow-back),
    // atores que segui agora, e decisões de marcação aceitas/recusadas.
    @State private var followingIds: Set<String> = []
    @State private var followedActors: Set<String> = []
    @State private var tagDecisions: [String: Bool] = [:]

    public init(model: GymCircleAppModel) {
        self.model = model
    }

    public var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    GCLoadingView(Loc.loadingNotifications)
                } else if notifications.isEmpty {
                    GCEmptyState(
                        title: Loc.noNotificationsTitle,
                        subtitle: Loc.noNotificationsSubtitle
                    )
                } else {
                    List(notifications) { notification in
                        notificationRow(notification)
                            .listRowBackground(
                                notification.isUnread
                                    ? GymCircleTheme.ColorToken.cyan.opacity(0.07)
                                    : GymCircleTheme.ColorToken.appBackground
                            )
                            .listRowSeparator(.hidden)
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle(Loc.notifications)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(Loc.close) { dismiss() }
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                }
            }
        }
        .preferredColorScheme(.dark)
        .task {
            notifications = await model.fetchNotifications()
            // Baseline pro CTA follow-back: quem eu já sigo não mostra o botão.
            followingIds = Set(await model.loadFollowingProfiles().map(\.userId))
            isLoading = false
            // Paridade web: abrir o sino zera o badge.
            await model.markNotificationsRead()
        }
        .sheet(item: $openedPost) { post in
            NavigationStack {
                ScrollView {
                    FeedPostCard(
                        post: post,
                        currentUserId: model.currentUserId,
                        onLike: { Task { await model.toggleLike(postId: post.id) } }
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
        .sheet(item: $openedProfile) { summary in
            OtherProfileHostView(model: model, summary: summary)
        }
    }

    private func notificationRow(_ notification: AppNotification) -> some View {
        HStack(spacing: 12) {
            // Avatar + texto: abre o post / perfil (tappable independente dos
            // botões de ação ao lado — não dá pra aninhar Button no SwiftUI).
            Button {
                Task { await open(notification) }
            } label: {
                HStack(spacing: 12) {
                    GCAvatar(url: notification.actorAvatarURL, fallback: notification.actorUsername)
                    VStack(alignment: .leading, spacing: 2) {
                        (
                            Text(notification.displayedActorName).bold()
                            + Text(" \(notification.message)")
                        )
                        .font(.system(size: 14, design: .default))
                        .foregroundStyle(GymCircleTheme.ColorToken.primaryText)
                        .multilineTextAlignment(.leading)
                        GCText(
                            CommentsSheet.relativeTime(from: notification.createdAt),
                            style: .caption,
                            color: GymCircleTheme.ColorToken.secondaryText
                        )
                    }
                }
            }
            .buttonStyle(.plain)

            Spacer(minLength: 8)

            actionButtons(notification)

            if notification.isUnread {
                Circle()
                    .fill(GymCircleTheme.ColorToken.cyan)
                    .frame(width: 8, height: 8)
            }
        }
        .padding(.vertical, 6)
    }

    /// Botões inline por kind (paridade web): follow-back e aceitar/recusar
    /// marcação de post. (Follow request e story tag não têm backend nativo
    /// ainda — abrem o perfil/post ao tocar.)
    @ViewBuilder
    private func actionButtons(_ notification: AppNotification) -> some View {
        if notification.kind == "follow",
           let actorId = notification.actorId,
           !followingIds.contains(actorId), !followedActors.contains(actorId) {
            Button {
                Task {
                    _ = await model.toggleFollow(targetUserId: actorId)
                    followedActors.insert(actorId)
                    Haptics.success()
                }
            } label: {
                Text(Loc.t("Follow back", "Seguir de volta"))
                    .font(.system(size: 12, weight: .black, design: .default))
                    .foregroundStyle(.black)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(Capsule().fill(GymCircleTheme.ColorToken.cyan))
            }
            .buttonStyle(.plain)
        } else if notification.kind == "post_tag", let postId = notification.postId {
            if let decision = tagDecisions[notification.id] {
                GCText(
                    decision ? Loc.t("Accepted", "Aceito") : Loc.t("Declined", "Recusado"),
                    style: .caption,
                    color: GymCircleTheme.ColorToken.secondaryText
                )
            } else {
                HStack(spacing: 6) {
                    Button { respondTag(notification, postId: postId, accepted: true) } label: {
                        Text(Loc.accept)
                            .font(.system(size: 12, weight: .black, design: .default))
                            .foregroundStyle(.black)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(Capsule().fill(GymCircleTheme.ColorToken.cyan))
                    }
                    .buttonStyle(.plain)
                    Button { respondTag(notification, postId: postId, accepted: false) } label: {
                        Text(Loc.t("Decline", "Recusar"))
                            .font(.system(size: 12, weight: .bold, design: .default))
                            .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(Capsule().fill(Color.white.opacity(0.08)))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func respondTag(_ notification: AppNotification, postId: String, accepted: Bool) {
        Task {
            if await model.respondToPostTag(postId: postId, accepted: accepted) {
                tagDecisions[notification.id] = accepted
                Haptics.success()
            } else {
                Haptics.error()
            }
        }
    }

    /// Routing por kind (paridade Sprints 11.2/11.4 web): post abre o
    /// post; follow abre o perfil do ator.
    private func open(_ notification: AppNotification) async {
        if let postId = notification.postId,
           let post = await model.fetchPost(postId: postId) {
            openedPost = post
            return
        }
        if let actorId = notification.actorId,
           let summary = await model.fetchOtherProfileSummary(userId: actorId) {
            openedProfile = summary
        }
    }
}

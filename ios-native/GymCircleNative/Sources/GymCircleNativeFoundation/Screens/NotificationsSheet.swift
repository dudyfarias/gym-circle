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
                        Button {
                            Task { await open(notification) }
                        } label: {
                            row(notification)
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(GymCircleTheme.ColorToken.appBackground)
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

    private func row(_ notification: AppNotification) -> some View {
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
            Spacer()
            if notification.isUnread {
                Circle()
                    .fill(GymCircleTheme.ColorToken.cyan)
                    .frame(width: 8, height: 8)
            }
        }
        .padding(.vertical, 6)
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

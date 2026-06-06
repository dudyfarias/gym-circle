import SwiftUI

public struct MainTabView: View {
    private let posts: [FeedPost]
    private let stories: [StoryAuthorGroup]
    private let profile: UserProfile?
    private let profilePosts: [ProfilePost]
    private let myCircle: MyCircleSummary
    private let isFeedLoading: Bool
    private let isStoriesLoading: Bool
    private let isProfileLoading: Bool
    private let isMyCircleLoading: Bool
    private let feedError: String?
    private let storiesError: String?
    private let profileError: String?
    private let myCircleError: String?
    private let onRefresh: () -> Void
    private let onSignOut: () -> Void
    private let loadStoryItems: (String) async throws -> [StoryItem]

    @State private var selectedStoryGroup: StoryAuthorGroup?
    @State private var storyItems: [StoryItem] = []
    @State private var isStoryViewerLoading = false
    @State private var storyViewerError: String?

    public init(
        posts: [FeedPost],
        stories: [StoryAuthorGroup],
        profile: UserProfile?,
        profilePosts: [ProfilePost],
        myCircle: MyCircleSummary,
        isFeedLoading: Bool = false,
        isStoriesLoading: Bool = false,
        isProfileLoading: Bool = false,
        isMyCircleLoading: Bool = false,
        feedError: String? = nil,
        storiesError: String? = nil,
        profileError: String? = nil,
        myCircleError: String? = nil,
        onRefresh: @escaping () -> Void = {},
        onSignOut: @escaping () -> Void = {},
        loadStoryItems: @escaping (String) async throws -> [StoryItem] = { _ in [] }
    ) {
        self.posts = posts
        self.stories = stories
        self.profile = profile
        self.profilePosts = profilePosts
        self.myCircle = myCircle
        self.isFeedLoading = isFeedLoading
        self.isStoriesLoading = isStoriesLoading
        self.isProfileLoading = isProfileLoading
        self.isMyCircleLoading = isMyCircleLoading
        self.feedError = feedError
        self.storiesError = storiesError
        self.profileError = profileError
        self.myCircleError = myCircleError
        self.onRefresh = onRefresh
        self.onSignOut = onSignOut
        self.loadStoryItems = loadStoryItems
    }

    public var body: some View {
        TabView {
            NavigationStack {
                FeedView(
                    posts: posts,
                    stories: stories,
                    isFeedLoading: isFeedLoading,
                    isStoriesLoading: isStoriesLoading,
                    feedError: feedError,
                    storiesError: storiesError,
                    onRetry: onRefresh,
                    onOpenStory: openStory
                )
            }
            .tabItem {
                Label("Home", systemImage: "house.fill")
            }

            NavigationStack {
                MyCircleView(
                    summary: myCircle,
                    isLoading: isMyCircleLoading,
                    error: myCircleError,
                    onRetry: onRefresh
                )
            }
            .tabItem {
                Label("Circle", systemImage: "flame")
            }

            NavigationStack {
                GCEmptyState(title: "Criar treino", subtitle: "Composer nativo fica para a proxima sprint.")
                    .background(GymCircleTheme.ColorToken.appBackground)
            }
            .tabItem {
                Label("Criar", systemImage: "camera.fill")
            }

            NavigationStack {
                GCEmptyState(title: "Chat", subtitle: "Mensagens nativas ficam para uma fase futura.")
                    .background(GymCircleTheme.ColorToken.appBackground)
            }
            .tabItem {
                Label("Chat", systemImage: "bubble.left.and.bubble.right")
            }

            NavigationStack {
                ProfileView(
                    profile: profile,
                    posts: profilePosts,
                    isLoading: isProfileLoading,
                    error: profileError,
                    onRetry: onRefresh,
                    onSignOut: onSignOut
                )
            }
            .tabItem {
                Label("Perfil", systemImage: "person.crop.circle")
            }
        }
        .tint(GymCircleTheme.ColorToken.cyan)
        .sheet(item: $selectedStoryGroup) { group in
            StoryViewerView(
                group: group,
                stories: storyItems,
                isLoading: isStoryViewerLoading,
                error: storyViewerError,
                onRetry: { openStory(group) }
            )
        }
    }

    private func openStory(_ group: StoryAuthorGroup) {
        selectedStoryGroup = group
        storyItems = []
        storyViewerError = nil
        isStoryViewerLoading = true

        Task {
            do {
                let items = try await loadStoryItems(group.authorId)
                await MainActor.run {
                    storyItems = items
                    isStoryViewerLoading = false
                }
            } catch {
                await MainActor.run {
                    storyViewerError = "Nao foi possivel abrir esse story."
                    isStoryViewerLoading = false
                }
            }
        }
    }
}

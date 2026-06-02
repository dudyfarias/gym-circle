import Foundation

@MainActor
public final class GymCircleAppModel: ObservableObject {
    @Published public private(set) var isAuthenticated = false
    @Published public private(set) var isLoading = false
    @Published public private(set) var error: String?
    @Published public private(set) var posts: [FeedPost] = []
    @Published public private(set) var stories: [StoryAuthorGroup] = []
    @Published public private(set) var profile: UserProfile?
    @Published public private(set) var profilePosts: [ProfilePost] = []

    private let api: GymCircleAPI?

    public init(api: GymCircleAPI? = nil) {
        self.api = api
    }

    public func signIn(email: String, password: String) async throws {
        guard let api else {
            isAuthenticated = true
            loadDemoData()
            return
        }

        try await api.signIn(email: email, password: password)
        isAuthenticated = true
        await loadInitialSurfaces()
    }

    public func loadInitialSurfaces() async {
        guard let api else {
            loadDemoData()
            return
        }

        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            async let feed = api.homeFeed()
            async let tray = api.storyTray()
            posts = try await feed
            stories = try await tray
        } catch {
            self.error = error.localizedDescription
        }
    }

    public var myCircleSummary: MyCircleSummary {
        let stats = GymCircleStats(
            currentStreak: profile?.currentStreak ?? 0,
            bestStreak: profile?.bestStreak ?? 0,
            workoutsThisWeek: 0,
            workoutsThisMonth: 0,
            workoutsThisYear: 0
        )

        return MyCircleSummary(stats: stats)
    }

    private func loadDemoData() {
        let demoProfile = UserProfile(
            id: "demo-profile",
            userId: "demo-user",
            username: "dudy",
            displayName: "Dudy",
            avatarURL: nil,
            bio: "Fundacao SwiftUI do Gym Circle.",
            currentStreak: 7,
            bestStreak: 21,
            badgeIsActiveToday: true
        )
        profile = demoProfile
        posts = []
        stories = []
        profilePosts = []
        isAuthenticated = true
    }
}

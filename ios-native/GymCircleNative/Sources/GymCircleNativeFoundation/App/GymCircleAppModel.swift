import Foundation

@MainActor
public final class GymCircleAppModel: ObservableObject {
    @Published public private(set) var isBootstrapping = true
    @Published public private(set) var isAuthenticated = false
    @Published public private(set) var configurationError: String?
    @Published public private(set) var authError: String?

    @Published public private(set) var isFeedLoading = false
    @Published public private(set) var isStoriesLoading = false
    @Published public private(set) var isProfileLoading = false
    @Published public private(set) var isMyCircleLoading = false

    @Published public private(set) var feedError: String?
    @Published public private(set) var storiesError: String?
    @Published public private(set) var profileError: String?
    @Published public private(set) var myCircleError: String?

    @Published public private(set) var posts: [FeedPost] = []
    @Published public private(set) var stories: [StoryAuthorGroup] = []
    @Published public private(set) var profile: UserProfile?
    @Published public private(set) var profilePosts: [ProfilePost] = []
    @Published public private(set) var myCircleSummary = MyCircleSummary(stats: GymCircleStats())

    private let api: GymCircleAPI?
    private let myCircleService: MyCircleService?
    private let sessionStore: SessionStore?
    private var didBootstrap = false

    public init(
        api: GymCircleAPI? = nil,
        myCircleService: MyCircleService? = nil,
        sessionStore: SessionStore? = nil
    ) {
        if let api, let myCircleService, let sessionStore {
            self.api = api
            self.myCircleService = myCircleService
            self.sessionStore = sessionStore
            return
        }

        do {
            let provider = try SupabaseClientProvider.fromEnvironment()
            self.api = GymCircleAPI(client: provider.client)
            self.myCircleService = MyCircleService(client: provider.client)
            self.sessionStore = SessionStore(authService: AuthService(client: provider.client))
        } catch {
            self.api = nil
            self.myCircleService = nil
            self.sessionStore = nil
            self.configurationError = "Configure SUPABASE_URL e SUPABASE_ANON_KEY localmente para rodar o app nativo."
        }
    }

    public func bootstrap() async {
        guard !didBootstrap else {
            return
        }

        didBootstrap = true
        isBootstrapping = true
        defer { isBootstrapping = false }

        guard let sessionStore else {
            isAuthenticated = false
            return
        }

        await sessionStore.restoreSession()
        isAuthenticated = sessionStore.isAuthenticated
        authError = sessionStore.authError

        if isAuthenticated {
            await loadInitialSurfaces()
        }
    }

    public func signIn(email: String, password: String) async throws {
        guard let sessionStore else {
            throw GymCircleNativeError.missingConfiguration
        }

        do {
            try await sessionStore.signIn(email: email, password: password)
            isAuthenticated = sessionStore.isAuthenticated
            authError = nil
            await loadInitialSurfaces()
        } catch {
            authError = sessionStore.authError ?? SessionStore.friendlyAuthError(error)
            throw error
        }
    }

    public func signOut() async {
        await sessionStore?.signOut()
        clearSurfaces()
        isAuthenticated = false
    }

    public func refreshHome() async {
        await loadInitialSurfaces()
    }

    public func loadStoryItems(authorId: String) async throws -> [StoryItem] {
        guard let api else {
            throw GymCircleNativeError.missingConfiguration
        }

        return try await api.storyViewerItems(authorId: authorId)
    }

    private func loadInitialSurfaces() async {
        guard let api, let myCircleService, let userId = sessionStore?.currentUserId else {
            return
        }

        isFeedLoading = true
        isStoriesLoading = true
        isProfileLoading = true
        isMyCircleLoading = true

        feedError = nil
        storiesError = nil
        profileError = nil
        myCircleError = nil

        async let feedResult = result { try await api.homeFeed() }
        async let storiesResult = result { try await api.storyTray() }
        async let profileResult = result { try await api.currentProfile(userId: userId) }
        async let profilePostsResult = result { try await api.profilePosts(userId: userId, limit: 18) }
        async let myCircleResult = result { try await myCircleService.getSummary(userId: userId) }

        applyFeedResult(await feedResult)
        applyStoriesResult(await storiesResult)
        applyProfileResult(await profileResult)
        applyProfilePostsResult(await profilePostsResult)
        applyMyCircleResult(await myCircleResult)
    }

    private func applyFeedResult(_ result: Result<[FeedPost], Error>) {
        isFeedLoading = false
        switch result {
        case .success(let posts):
            self.posts = posts
        case .failure(let error):
            feedError = friendlyDataError(error, fallback: "Feed indisponivel agora.")
        }
    }

    private func applyStoriesResult(_ result: Result<[StoryAuthorGroup], Error>) {
        isStoriesLoading = false
        switch result {
        case .success(let stories):
            self.stories = stories
        case .failure(let error):
            storiesError = friendlyDataError(error, fallback: "Stories indisponiveis agora.")
        }
    }

    private func applyProfileResult(_ result: Result<UserProfile, Error>) {
        isProfileLoading = false
        switch result {
        case .success(let profile):
            self.profile = profile
        case .failure(let error):
            profileError = friendlyDataError(error, fallback: "Perfil indisponivel agora.")
        }
    }

    private func applyProfilePostsResult(_ result: Result<[FeedPost], Error>) {
        switch result {
        case .success(let posts):
            self.profilePosts = posts
        case .failure:
            break
        }
    }

    private func applyMyCircleResult(_ result: Result<MyCircleSummary, Error>) {
        isMyCircleLoading = false
        switch result {
        case .success(let summary):
            myCircleSummary = summary
        case .failure(let error):
            myCircleError = friendlyDataError(error, fallback: "Meu Circle indisponivel agora.")
        }
    }

    private func result<T>(_ operation: () async throws -> T) async -> Result<T, Error> {
        do {
            return .success(try await operation())
        } catch {
            return .failure(error)
        }
    }

    private func friendlyDataError(_ error: Error, fallback: String) -> String {
        let message = error.localizedDescription
        if message.localizedCaseInsensitiveContains("network") {
            return "Conexao instavel. Tente novamente."
        }
        if message.localizedCaseInsensitiveContains("JWT") ||
            message.localizedCaseInsensitiveContains("auth") {
            return "Sua sessao precisa ser renovada. Entre novamente."
        }
        return fallback
    }

    private func clearSurfaces() {
        posts = []
        stories = []
        profile = nil
        profilePosts = []
        myCircleSummary = MyCircleSummary(stats: GymCircleStats())
        feedError = nil
        storiesError = nil
        profileError = nil
        myCircleError = nil
    }
}

import XCTest
@testable import GymCircleNative

final class NativeModelsTests: XCTestCase {
    func testFeedPostUsesThumbnailBeforePosterAndOriginalMedia() {
        let post = makePost(thumbnailURL: "https://cdn.gymcircle.test/thumb.jpg", posterURL: "https://cdn.gymcircle.test/poster.jpg")

        XCTAssertEqual(post.displayMediaURL, "https://cdn.gymcircle.test/thumb.jpg")
    }

    func testFeedPostFallsBackToPosterThenOriginalMedia() {
        let posterPost = makePost(thumbnailURL: nil, posterURL: "https://cdn.gymcircle.test/poster.jpg")
        let originalPost = makePost(thumbnailURL: nil, posterURL: nil)

        XCTAssertEqual(posterPost.displayMediaURL, "https://cdn.gymcircle.test/poster.jpg")
        XCTAssertEqual(originalPost.displayMediaURL, "https://cdn.gymcircle.test/original.jpg")
    }

    func testConsistencyRingsClampProgress() {
        let date = DateComponents(calendar: .current, year: 2026, month: 6, day: 2).date!
        let rings = ConsistencyRings(workoutsThisWeek: 8, workoutsThisMonth: 40, workoutsThisYear: 500, date: date)

        XCTAssertEqual(rings.week, 1)
        XCTAssertEqual(rings.month, 1)
        XCTAssertEqual(rings.year, 1)
    }

    private func makePost(thumbnailURL: String?, posterURL: String?) -> FeedPost {
        FeedPost(
            id: "post-1",
            userId: "user-1",
            imageURL: "https://cdn.gymcircle.test/original.jpg",
            thumbnailURL: thumbnailURL,
            posterURL: posterURL,
            mediaWidth: 1080,
            mediaHeight: 1350,
            mediaDurationSeconds: nil,
            blurDataURL: nil,
            mediaType: .image,
            caption: "Treino feito.",
            gymId: nil,
            workoutType: nil,
            workoutDate: nil,
            createdAt: "2026-06-02T10:00:00Z",
            locationSource: nil,
            locationName: nil,
            likesCount: 1,
            commentsCount: 0,
            username: "dudy",
            displayName: "Dudy",
            avatarURL: nil,
            authorCurrentStreak: 3,
            authorBestStreak: 8,
            authorBadgeActive: true,
            likedByMe: false,
            isFollowingAuthor: true,
            visibility: "visible"
        )
    }
}

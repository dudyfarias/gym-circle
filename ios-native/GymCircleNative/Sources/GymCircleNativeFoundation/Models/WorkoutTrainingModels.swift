import Foundation

public struct WorkoutPlanExercise: Codable, Equatable, Hashable, Sendable, Identifiable {
    public var id: UUID = UUID()
    public var name: String
    public var sets: Int?
    public var reps: Int?

    public init(
        id: UUID = UUID(),
        name: String,
        sets: Int?,
        reps: Int?
    ) {
        self.id = id
        self.name = name
        self.sets = sets
        self.reps = reps
    }

    enum CodingKeys: String, CodingKey {
        case name, sets, reps
    }
}

public struct WorkoutPlan: Codable, Equatable, Hashable, Sendable, Identifiable {
    public let id: UUID
    public var name: String
    public var exercises: [WorkoutPlanExercise]
    public let updatedAt: String

    public init(
        id: UUID,
        name: String,
        exercises: [WorkoutPlanExercise],
        updatedAt: String
    ) {
        self.id = id
        self.name = name
        self.exercises = exercises
        self.updatedAt = updatedAt
    }

    enum CodingKeys: String, CodingKey {
        case id, name, exercises
        case updatedAt = "updated_at"
    }
}

public enum PersonalRecordMetric: String, Codable, Sendable {
    case strengthWeight = "strength_weight"
    case run5KTime = "run_5k_time"
    case run10KTime = "run_10k_time"
}

public struct PersonalRecord: Codable, Equatable, Hashable, Sendable, Identifiable {
    public let id: UUID
    public let userId: UUID
    public let activityId: UUID
    public let metric: PersonalRecordMetric
    public let exerciseKey: String
    public let exerciseName: String?
    public let value: Double
    public let unit: String
    public let reps: Int?
    public let isEstimated: Bool
    public let achievedAt: String

    enum CodingKeys: String, CodingKey {
        case id = "record_id"
        case userId = "user_id"
        case activityId = "activity_id"
        case metric = "metric_key"
        case exerciseKey = "exercise_key"
        case exerciseName = "exercise_name"
        case value, unit, reps
        case isEstimated = "is_estimated"
        case achievedAt = "achieved_at"
    }
}

public struct PersonalRecordLeaderboardRow: Codable, Equatable, Hashable, Sendable, Identifiable {
    public var id: UUID { userId }
    public let userId: UUID
    public let username: String
    public let displayName: String
    public let avatarURL: String?
    public let value: Double
    public let unit: String
    public let reps: Int?
    public let isEstimated: Bool
    public let achievedAt: String
    public let rank: Int

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case username
        case displayName = "display_name"
        case avatarURL = "avatar_url"
        case value, unit, reps, rank
        case isEstimated = "is_estimated"
        case achievedAt = "achieved_at"
    }
}

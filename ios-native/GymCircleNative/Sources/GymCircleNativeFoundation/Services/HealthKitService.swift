import Foundation

#if canImport(HealthKit) && os(iOS)
import HealthKit
#endif

public struct HealthWorkoutSummary: Identifiable, Hashable, Sendable {
    public let id: String
    public let startDate: Date
    public let endDate: Date
    public let durationSeconds: TimeInterval
    public let activeEnergyKilocalories: Double?
    public let workoutActivityType: String

    public init(
        id: String,
        startDate: Date,
        endDate: Date,
        durationSeconds: TimeInterval,
        activeEnergyKilocalories: Double?,
        workoutActivityType: String
    ) {
        self.id = id
        self.startDate = startDate
        self.endDate = endDate
        self.durationSeconds = durationSeconds
        self.activeEnergyKilocalories = activeEnergyKilocalories
        self.workoutActivityType = workoutActivityType
    }
}

public protocol HealthKitProviding {
    var isAvailable: Bool { get }
    func requestReadAuthorization() async throws
    func workouts(from startDate: Date, to endDate: Date) async throws -> [HealthWorkoutSummary]
}

public enum HealthKitServiceError: Error, LocalizedError {
    case unavailable
    case authorizationDenied

    public var errorDescription: String? {
        switch self {
        case .unavailable:
            return "Apple Saúde não está disponível neste dispositivo."
        case .authorizationDenied:
            return "Permissão do Apple Saúde não foi concedida."
        }
    }
}

#if canImport(HealthKit) && os(iOS)
public final class AppleHealthKitProvider: HealthKitProviding {
    private let store = HKHealthStore()

    public init() {}

    public var isAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    public func requestReadAuthorization() async throws {
        guard isAvailable else { throw HealthKitServiceError.unavailable }
        var readTypes: Set<HKObjectType> = [HKObjectType.workoutType()]
        if let activeEnergy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
            readTypes.insert(activeEnergy)
        }
        try await store.requestAuthorization(toShare: [], read: readTypes)
    }

    public func workouts(from startDate: Date, to endDate: Date) async throws -> [HealthWorkoutSummary] {
        guard isAvailable else { throw HealthKitServiceError.unavailable }
        let predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: [.strictStartDate]
        )
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: HKObjectType.workoutType(),
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [sort]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let workouts = (samples as? [HKWorkout] ?? []).map { workout in
                    HealthWorkoutSummary(
                        id: workout.uuid.uuidString,
                        startDate: workout.startDate,
                        endDate: workout.endDate,
                        durationSeconds: workout.duration,
                        activeEnergyKilocalories: workout.totalEnergyBurned?
                            .doubleValue(for: .kilocalorie()),
                        workoutActivityType: Self.activityName(workout.workoutActivityType)
                    )
                }
                continuation.resume(returning: workouts)
            }
            store.execute(query)
        }
    }

    private static func activityName(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .running: return "Corrida"
        case .walking: return "Caminhada"
        case .cycling: return "Bike"
        case .traditionalStrengthTraining: return "Musculação"
        case .functionalStrengthTraining: return "Funcional"
        case .yoga: return "Yoga"
        case .swimming: return "Natação"
        case .highIntensityIntervalTraining: return "HIIT"
        default: return "Treino"
        }
    }
}
#else
public final class AppleHealthKitProvider: HealthKitProviding {
    public init() {}
    public var isAvailable: Bool { false }
    public func requestReadAuthorization() async throws {
        throw HealthKitServiceError.unavailable
    }
    public func workouts(from startDate: Date, to endDate: Date) async throws -> [HealthWorkoutSummary] {
        throw HealthKitServiceError.unavailable
    }
}
#endif

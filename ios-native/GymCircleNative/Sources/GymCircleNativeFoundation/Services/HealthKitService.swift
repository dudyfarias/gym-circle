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

/// FC média + calorias ativas registradas na janela da sessão (ex.: Apple
/// Watch gravando em paralelo). nil = sem amostras no período.
public struct WorkoutSessionHealthStats: Sendable {
    public let averageHeartRate: Int?
    public let activeKilocalories: Double?

    public init(averageHeartRate: Int?, activeKilocalories: Double?) {
        self.averageHeartRate = averageHeartRate
        self.activeKilocalories = activeKilocalories
    }
}

public protocol HealthKitProviding {
    var isAvailable: Bool { get }
    func requestReadAuthorization() async throws
    func workouts(from startDate: Date, to endDate: Date) async throws -> [HealthWorkoutSummary]
    /// Rastreio de treino: escrita do HKWorkout + leitura de FC/energia.
    func requestWorkoutSessionAuthorization() async throws
    /// Salva a sessão encerrada como treino no Apple Saúde.
    func saveWorkout(activityKind: String, start: Date, end: Date) async throws
    /// Estatísticas da janela da sessão (fail-soft: nil sem amostras/permissão).
    func sessionStats(from startDate: Date, to endDate: Date) async -> WorkoutSessionHealthStats
}

// Defaults: conformances existentes (mocks/testes) seguem compilando.
public extension HealthKitProviding {
    func requestWorkoutSessionAuthorization() async throws {
        throw HealthKitServiceError.unavailable
    }

    func saveWorkout(activityKind: String, start: Date, end: Date) async throws {
        throw HealthKitServiceError.unavailable
    }

    func sessionStats(from startDate: Date, to endDate: Date) async -> WorkoutSessionHealthStats {
        WorkoutSessionHealthStats(averageHeartRate: nil, activeKilocalories: nil)
    }
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

    public func requestWorkoutSessionAuthorization() async throws {
        guard isAvailable else { throw HealthKitServiceError.unavailable }
        var readTypes: Set<HKObjectType> = [HKObjectType.workoutType()]
        if let heartRate = HKObjectType.quantityType(forIdentifier: .heartRate) {
            readTypes.insert(heartRate)
        }
        if let activeEnergy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
            readTypes.insert(activeEnergy)
        }
        try await store.requestAuthorization(
            toShare: [HKObjectType.workoutType()],
            read: readTypes
        )
    }

    public func saveWorkout(activityKind: String, start: Date, end: Date) async throws {
        guard isAvailable else { throw HealthKitServiceError.unavailable }
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = Self.hkActivityType(for: activityKind)
        let builder = HKWorkoutBuilder(
            healthStore: store,
            configuration: configuration,
            device: .local()
        )
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            builder.beginCollection(withStart: start) { _, error in
                if let error { continuation.resume(throwing: error) } else { continuation.resume() }
            }
        }
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            builder.endCollection(withEnd: end) { _, error in
                if let error { continuation.resume(throwing: error) } else { continuation.resume() }
            }
        }
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            builder.finishWorkout { _, error in
                if let error { continuation.resume(throwing: error) } else { continuation.resume() }
            }
        }
    }

    public func sessionStats(from startDate: Date, to endDate: Date) async -> WorkoutSessionHealthStats {
        guard isAvailable else {
            return WorkoutSessionHealthStats(averageHeartRate: nil, activeKilocalories: nil)
        }
        let heartRateStats = await quantityStatistics(
            for: .heartRate,
            options: .discreteAverage,
            start: startDate,
            end: endDate
        )
        let energyStats = await quantityStatistics(
            for: .activeEnergyBurned,
            options: .cumulativeSum,
            start: startDate,
            end: endDate
        )
        let bpm = heartRateStats?.averageQuantity()?
            .doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
        let kilocalories = energyStats?.sumQuantity()?
            .doubleValue(for: .kilocalorie())
        return WorkoutSessionHealthStats(
            averageHeartRate: bpm.map { Int($0.rounded()) },
            activeKilocalories: kilocalories
        )
    }

    private func quantityStatistics(
        for identifier: HKQuantityTypeIdentifier,
        options: HKStatisticsOptions,
        start: Date,
        end: Date
    ) async -> HKStatistics? {
        guard let type = HKObjectType.quantityType(forIdentifier: identifier) else { return nil }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        return await withCheckedContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: options
            ) { _, statistics, _ in
                continuation.resume(returning: statistics)
            }
            store.execute(query)
        }
    }

    private static func hkActivityType(for kind: String) -> HKWorkoutActivityType {
        switch kind {
        case "strength": return .traditionalStrengthTraining
        case "run": return .running
        case "walk": return .walking
        case "ride": return .cycling
        default: return .other
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

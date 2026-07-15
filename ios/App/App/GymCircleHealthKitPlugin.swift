import Foundation
import Capacitor
import HealthKit
import CoreLocation

/// Ponte read-only entre o app Capacitor e o Apple Saúde.
///
/// O usuário escolhe explicitamente o treino que deseja importar. O UUID do
/// HKWorkout é enviado como `externalId`, permitindo que o índice já existente
/// em activities impeça importações duplicadas por usuário.
@objc(GymCircleHealthKitPlugin)
public final class GymCircleHealthKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GymCircleHealthKitPlugin"
    public let jsName = "GymCircleHealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "permissionState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestHealthPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listWorkouts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getWorkout", returnType: CAPPluginReturnPromise),
    ]

    private let healthStore = HKHealthStore()
    private let permissionRequestedKey = "gc.capacitor.healthKit.permissionRequested.v1"

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func permissionState(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["state": "unsupported"])
            return
        }

        healthStore.getRequestStatusForAuthorization(
            toShare: Set<HKSampleType>(),
            read: readTypes
        ) { [weak self] status, error in
            if let error {
                call.reject("Não foi possível consultar a permissão do Apple Saúde", nil, error)
                return
            }
            let requested = UserDefaults.standard.bool(
                forKey: self?.permissionRequestedKey ?? ""
            )
            let state = status == .shouldRequest && !requested
                ? "not-requested"
                : "granted"
            call.resolve(["state": state])
        }
    }

    @objc func requestHealthPermissions(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["state": "unsupported"])
            return
        }

        healthStore.requestAuthorization(
            toShare: Set<HKSampleType>(),
            read: readTypes
        ) { [weak self] success, error in
            if let error {
                call.reject("Não foi possível autorizar o Apple Saúde", nil, error)
                return
            }
            guard success else {
                call.resolve(["state": "denied"])
                return
            }
            if let key = self?.permissionRequestedKey {
                UserDefaults.standard.set(true, forKey: key)
            }
            // Por privacidade, o HealthKit não informa quais tipos de leitura
            // foram negados. A query vazia é tratada pela UI com instrução para
            // revisar o acesso no app Saúde.
            call.resolve(["state": "granted"])
        }
    }

    @objc func listWorkouts(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit não está disponível")
            return
        }

        let now = Date()
        let from = date(from: call.getString("from"))
            ?? Calendar.current.date(byAdding: .day, value: -30, to: now)!
        let to = date(from: call.getString("to")) ?? now
        let limit = min(max(call.getInt("limit") ?? 50, 1), 100)
        let predicate = HKQuery.predicateForSamples(
            withStart: from,
            end: to,
            options: [.strictEndDate]
        )
        let sort = NSSortDescriptor(
            key: HKSampleSortIdentifierStartDate,
            ascending: false
        )
        let query = HKSampleQuery(
            sampleType: HKObjectType.workoutType(),
            predicate: predicate,
            limit: limit,
            sortDescriptors: [sort]
        ) { [weak self] _, samples, error in
            if let error {
                call.reject("Não foi possível carregar os treinos do Apple Saúde", nil, error)
                return
            }
            let ownBundleId = Bundle.main.bundleIdentifier
            let workouts = (samples as? [HKWorkout] ?? [])
                .filter { $0.sourceRevision.source.bundleIdentifier != ownBundleId }
                .map { self?.payload(for: $0, route: nil) ?? [:] }
            call.resolve(["workouts": workouts])
        }
        healthStore.execute(query)
    }

    @objc func getWorkout(_ call: CAPPluginCall) {
        guard let rawId = call.getString("externalId"),
              let workoutId = UUID(uuidString: rawId) else {
            call.reject("Identificador do treino inválido")
            return
        }
        let predicate = HKQuery.predicateForObject(with: workoutId)
        let query = HKSampleQuery(
            sampleType: HKObjectType.workoutType(),
            predicate: predicate,
            limit: 1,
            sortDescriptors: nil
        ) { [weak self] _, samples, error in
            if let error {
                call.reject("Não foi possível abrir o treino do Apple Saúde", nil, error)
                return
            }
            guard let self, let workout = (samples as? [HKWorkout])?.first else {
                call.reject("Treino não encontrado no Apple Saúde")
                return
            }
            self.loadRoute(for: workout) { route in
                call.resolve(self.payload(for: workout, route: route))
            }
        }
        healthStore.execute(query)
    }

    private var readTypes: Set<HKObjectType> {
        var types: Set<HKObjectType> = [
            HKObjectType.workoutType(),
            HKSeriesType.workoutRoute(),
        ]
        let identifiers: [HKQuantityTypeIdentifier] = [
            .heartRate,
            .activeEnergyBurned,
            .distanceWalkingRunning,
            .distanceCycling,
            .distanceSwimming,
            .distanceWheelchair,
        ]
        for identifier in identifiers {
            if let type = HKObjectType.quantityType(forIdentifier: identifier) {
                types.insert(type)
            }
        }
        return types
    }

    private func payload(for workout: HKWorkout, route: [[Double]]?) -> [String: Any] {
        var result: [String: Any] = [
            "provider": "apple-healthkit",
            "externalId": workout.uuid.uuidString.lowercased(),
            "sourceApp": workout.sourceRevision.source.name,
            "sourceBundleId": workout.sourceRevision.source.bundleIdentifier,
            "startedAt": isoString(workout.startDate),
            "endedAt": isoString(workout.endDate),
            "workoutType": workoutType(workout.workoutActivityType),
            "elapsedS": max(0, Int(workout.duration.rounded())),
        ]
        if let distance = distanceMeters(for: workout), distance > 0 {
            result["distanceM"] = distance
        }
        if let calories = quantity(
            for: workout,
            identifier: .activeEnergyBurned,
            option: .cumulativeSum,
            unit: .kilocalorie()
        ), calories > 0 {
            result["activeCalories"] = calories
        }
        let bpm = HKUnit.count().unitDivided(by: .minute())
        if let averageHeartRate = quantity(
            for: workout,
            identifier: .heartRate,
            option: .discreteAverage,
            unit: bpm
        ), averageHeartRate > 0 {
            result["avgHr"] = averageHeartRate
        }
        if let maximumHeartRate = quantity(
            for: workout,
            identifier: .heartRate,
            option: .discreteMax,
            unit: bpm
        ), maximumHeartRate > 0 {
            result["maxHr"] = maximumHeartRate
        }
        if let route, route.count >= 2 {
            result["route"] = route
        }
        return result
    }

    private func workoutType(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .traditionalStrengthTraining,
             .functionalStrengthTraining,
             .coreTraining,
             .crossTraining:
            return "strength"
        case .running:
            return "running"
        case .walking, .hiking:
            return "walking"
        case .cycling, .handCycling:
            return "cycling"
        case .highIntensityIntervalTraining:
            return "hiit"
        case .flexibility, .mindAndBody, .yoga, .pilates:
            return "mobility"
        default:
            return "other"
        }
    }

    private func distanceMeters(for workout: HKWorkout) -> Double? {
        let identifier: HKQuantityTypeIdentifier?
        switch workout.workoutActivityType {
        case .walking, .running, .hiking:
            identifier = .distanceWalkingRunning
        case .cycling, .handCycling:
            identifier = .distanceCycling
        case .swimming:
            identifier = .distanceSwimming
        case .wheelchairRunPace, .wheelchairWalkPace:
            identifier = .distanceWheelchair
        default:
            identifier = nil
        }
        guard let identifier else { return nil }
        return quantity(
            for: workout,
            identifier: identifier,
            option: .cumulativeSum,
            unit: .meter()
        )
    }

    private func quantity(
        for workout: HKWorkout,
        identifier: HKQuantityTypeIdentifier,
        option: HKStatisticsOptions,
        unit: HKUnit
    ) -> Double? {
        if #available(iOS 16.0, *) {
            guard let type = HKObjectType.quantityType(forIdentifier: identifier),
                  let statistics = workout.statistics(for: type) else { return nil }
            let value: HKQuantity?
            switch option {
            case .cumulativeSum:
                value = statistics.sumQuantity()
            case .discreteAverage:
                value = statistics.averageQuantity()
            case .discreteMax:
                value = statistics.maximumQuantity()
            default:
                value = nil
            }
            return value?.doubleValue(for: unit)
        }

        // Compatibilidade com o deployment target iOS 15.6. FC média/máxima
        // fica ausente nesse sistema, mas distância e calorias continuam
        // importáveis pelos totais históricos do HKWorkout.
        if identifier == .activeEnergyBurned {
            return workout.totalEnergyBurned?.doubleValue(for: unit)
        }
        if identifier == .distanceWalkingRunning ||
            identifier == .distanceCycling ||
            identifier == .distanceSwimming ||
            identifier == .distanceWheelchair {
            return workout.totalDistance?.doubleValue(for: unit)
        }
        return nil
    }

    private func loadRoute(for workout: HKWorkout, completion: @escaping ([[Double]]?) -> Void) {
        let routeType = HKSeriesType.workoutRoute()
        let predicate = HKQuery.predicateForObjects(from: workout)
        let sampleQuery = HKSampleQuery(
            sampleType: routeType,
            predicate: predicate,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: nil
        ) { [weak self] _, samples, _ in
            guard let self,
                  let routes = samples as? [HKWorkoutRoute],
                  !routes.isEmpty else {
                completion(nil)
                return
            }

            let group = DispatchGroup()
            let lock = NSLock()
            var locations: [CLLocation] = []
            for route in routes {
                group.enter()
                let routeQuery = HKWorkoutRouteQuery(route: route) { _, batch, done, _ in
                    if let batch {
                        lock.lock()
                        locations.append(contentsOf: batch)
                        lock.unlock()
                    }
                    if done { group.leave() }
                }
                self.healthStore.execute(routeQuery)
            }
            group.notify(queue: .global(qos: .userInitiated)) {
                let ordered = locations.sorted { $0.timestamp < $1.timestamp }
                completion(self.compactRoute(ordered))
            }
        }
        healthStore.execute(sampleQuery)
    }

    private func compactRoute(_ locations: [CLLocation]) -> [[Double]]? {
        guard locations.count >= 2 else { return nil }
        let maximumPoints = 500
        let step = max(1, Int(ceil(Double(locations.count) / Double(maximumPoints))))
        var points = stride(from: 0, to: locations.count, by: step).map { index in
            [
                locations[index].coordinate.latitude,
                locations[index].coordinate.longitude,
            ]
        }
        if let last = locations.last {
            let final = [last.coordinate.latitude, last.coordinate.longitude]
            if points.last != final { points.append(final) }
        }
        return points.count >= 2 ? points : nil
    }

    private func date(from raw: String?) -> Date? {
        guard let raw else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: raw) ?? ISO8601DateFormatter().date(from: raw)
    }

    private func isoString(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
}

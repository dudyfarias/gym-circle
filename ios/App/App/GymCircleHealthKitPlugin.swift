import Foundation
import Capacitor
import HealthKit
import CoreLocation

private final class OnceGate {
    private let lock = NSLock()
    private var claimed = false

    func claim() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard !claimed else { return false }
        claimed = true
        return true
    }
}

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
            self.loadDetails(for: workout) { details in
                call.resolve(self.payload(
                    for: workout,
                    route: details.route,
                    heartRateSamples: details.heartRateSamples,
                    restingCalories: details.restingCalories,
                    workoutEffort: details.workoutEffort
                ))
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
            .basalEnergyBurned,
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
        if #available(iOS 18.0, *),
           let effortType = HKObjectType.quantityType(forIdentifier: .workoutEffortScore) {
            types.insert(effortType)
        }
        return types
    }

    private func payload(
        for workout: HKWorkout,
        route: [[Double]]?,
        heartRateSamples: [[String: Any]]? = nil,
        restingCalories: Double? = nil,
        workoutEffort: Double? = nil
    ) -> [String: Any] {
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
            if let restingCalories, restingCalories > 0 {
                result["totalCalories"] = calories + restingCalories
                // O Apple Saúde não expõe o valor visual de "Calorias totais"
                // do Fitness diretamente. A soma usa amostras reais de energia
                // ativa + basal no intervalo e fica marcada como estimativa.
                result["totalCaloriesEstimated"] = true
            }
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
        if let heartRateSamples, !heartRateSamples.isEmpty {
            result["heartRateSamples"] = heartRateSamples
            let values = heartRateSamples.compactMap { $0["bpm"] as? Double }
            if let minimum = values.min(), minimum > 0 {
                result["minHr"] = minimum
            }
        }
        if let workoutEffort, workoutEffort >= 1, workoutEffort <= 10 {
            result["workoutEffort"] = workoutEffort
        }
        appendWorkoutMetadata(workout, to: &result)
        if let route, route.count >= 2 {
            result["route"] = route
        }
        return result
    }

    private func appendWorkoutMetadata(
        _ workout: HKWorkout,
        to result: inout [String: Any]
    ) {
        let metadata = workout.metadata ?? [:]
        if let temperature = metadata[HKMetadataKeyWeatherTemperature] as? HKQuantity {
            result["temperatureC"] = temperature.doubleValue(for: .degreeCelsius())
        }
        if let humidity = metadata[HKMetadataKeyWeatherHumidity] as? HKQuantity {
            result["humidityPercent"] = humidity.doubleValue(for: .percent()) * 100
        } else if let humidity = metadata[HKMetadataKeyWeatherHumidity] as? NSNumber {
            let raw = humidity.doubleValue
            result["humidityPercent"] = raw <= 1 ? raw * 100 : raw
        }
        if let rawCondition = metadata[HKMetadataKeyWeatherCondition] as? NSNumber,
           let condition = HKWeatherCondition(rawValue: rawCondition.intValue) {
            result["weatherCondition"] = String(describing: condition)
        }
        if let indoor = metadata[HKMetadataKeyIndoorWorkout] as? NSNumber {
            result["isIndoor"] = indoor.boolValue
        }
        if let brand = metadata[HKMetadataKeyWorkoutBrandName] as? String,
           !brand.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            result["workoutBrandName"] = brand
        }
        if let mets = metadata[HKMetadataKeyAverageMETs] as? HKQuantity {
            result["averageMets"] = mets.doubleValue(for: HKUnit(from: "MET"))
        }
        if let elevation = metadata[HKMetadataKeyElevationAscended] as? HKQuantity {
            let meters = elevation.doubleValue(for: .meter())
            if meters > 0 { result["elevationGainM"] = meters }
        }
        if let device = workout.device {
            let components = [device.name, device.model]
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            if !components.isEmpty {
                result["sourceDevice"] = Array(NSOrderedSet(array: components))
                    .compactMap { $0 as? String }
                    .joined(separator: " · ")
            }
        }
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
        case .mixedCardio,
             .mixedMetabolicCardioTraining,
             .elliptical,
             .stairClimbing,
             .stairs,
             .stepTraining,
             .cardioDance:
            return "cardio"
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

    private struct WorkoutDetails {
        var route: [[Double]]?
        var heartRateSamples: [[String: Any]]?
        var restingCalories: Double?
        var workoutEffort: Double?
    }

    private func loadDetails(
        for workout: HKWorkout,
        completion: @escaping (WorkoutDetails) -> Void
    ) {
        let group = DispatchGroup()
        let lock = NSLock()
        let completionGate = OnceGate()
        var details = WorkoutDetails()

        group.enter()
        loadRoute(for: workout) { route in
            lock.lock(); details.route = route; lock.unlock()
            group.leave()
        }

        group.enter()
        loadHeartRateSamples(for: workout) { samples in
            lock.lock(); details.heartRateSamples = samples; lock.unlock()
            group.leave()
        }

        group.enter()
        loadRestingCalories(for: workout) { calories in
            lock.lock(); details.restingCalories = calories; lock.unlock()
            group.leave()
        }

        group.enter()
        loadWorkoutEffort(for: workout) { effort in
            lock.lock(); details.workoutEffort = effort; lock.unlock()
            group.leave()
        }

        group.notify(queue: .global(qos: .userInitiated)) {
            lock.lock(); let resolved = details; lock.unlock()
            if completionGate.claim() { completion(resolved) }
        }

        // Uma rota do HealthKit pode deixar de sinalizar `done` em caso de
        // erro. O resumo já disponível continua importável sem bloquear a UI.
        DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + 15) {
            lock.lock(); let resolved = details; lock.unlock()
            if completionGate.claim() { completion(resolved) }
        }
    }

    private func loadHeartRateSamples(
        for workout: HKWorkout,
        completion: @escaping ([[String: Any]]?) -> Void
    ) {
        guard let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate) else {
            completion(nil)
            return
        }
        let query = HKSampleQuery(
            sampleType: heartRateType,
            predicate: HKQuery.predicateForObjects(from: workout),
            limit: HKObjectQueryNoLimit,
            sortDescriptors: [NSSortDescriptor(
                key: HKSampleSortIdentifierStartDate,
                ascending: true
            )]
        ) { [weak self] _, samples, _ in
            guard let self else { completion(nil); return }
            let bpmUnit = HKUnit.count().unitDivided(by: .minute())
            let values = (samples as? [HKQuantitySample] ?? []).compactMap { sample -> (Date, Double)? in
                let bpm = sample.quantity.doubleValue(for: bpmUnit)
                return bpm >= 20 && bpm <= 260 ? (sample.startDate, bpm) : nil
            }
            guard !values.isEmpty else { completion(nil); return }
            let maximumPoints = 240
            let step = max(1, Int(ceil(Double(values.count) / Double(maximumPoints))))
            var compact = stride(from: 0, to: values.count, by: step).map { index in
                [
                    "timestamp": self.isoString(values[index].0),
                    "bpm": values[index].1,
                ] as [String: Any]
            }
            if let last = values.last,
               (compact.last?["timestamp"] as? String) != self.isoString(last.0) {
                compact.append([
                    "timestamp": self.isoString(last.0),
                    "bpm": last.1,
                ])
            }
            completion(compact)
        }
        healthStore.execute(query)
    }

    private func loadRestingCalories(
        for workout: HKWorkout,
        completion: @escaping (Double?) -> Void
    ) {
        guard let type = HKObjectType.quantityType(forIdentifier: .basalEnergyBurned) else {
            completion(nil)
            return
        }
        let predicate = HKQuery.predicateForSamples(
            withStart: workout.startDate,
            end: workout.endDate,
            options: []
        )
        let query = HKStatisticsQuery(
            quantityType: type,
            quantitySamplePredicate: predicate,
            options: .cumulativeSum
        ) { _, statistics, _ in
            let calories = statistics?.sumQuantity()?.doubleValue(for: .kilocalorie())
            completion(calories.flatMap { $0 > 0 ? $0 : nil })
        }
        healthStore.execute(query)
    }

    private func loadWorkoutEffort(
        for workout: HKWorkout,
        completion: @escaping (Double?) -> Void
    ) {
        guard #available(iOS 18.0, *),
              let effortType = HKObjectType.quantityType(forIdentifier: .workoutEffortScore) else {
            completion(nil)
            return
        }
        let query = HKSampleQuery(
            sampleType: effortType,
            predicate: HKQuery.predicateForObjects(from: workout),
            limit: 1,
            sortDescriptors: [NSSortDescriptor(
                key: HKSampleSortIdentifierStartDate,
                ascending: false
            )]
        ) { _, samples, _ in
            let effort = (samples as? [HKQuantitySample])?.first?.quantity
                .doubleValue(for: .count())
            completion(effort.flatMap { $0 >= 1 && $0 <= 10 ? $0 : nil })
        }
        healthStore.execute(query)
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
                let routeCompletionGate = OnceGate()
                let routeQuery = HKWorkoutRouteQuery(route: route) { _, batch, done, error in
                    if let batch {
                        lock.lock()
                        locations.append(contentsOf: batch)
                        lock.unlock()
                    }
                    if (done || error != nil) && routeCompletionGate.claim() {
                        group.leave()
                    }
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

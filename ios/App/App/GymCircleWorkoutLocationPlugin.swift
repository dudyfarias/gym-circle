import Foundation
import Capacitor
import CoreLocation

/// GPS nativo do shell Capacitor. Continua gravando quando o mostrador web é
/// minimizado ou o app vai para background e devolve uma polyline compacta.
@objc(GymCircleWorkoutLocationPlugin)
public final class GymCircleWorkoutLocationPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "GymCircleWorkoutLocationPlugin"
    public let jsName = "GymCircleWorkoutLocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pauseTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resumeTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "snapshot", returnType: CAPPluginReturnPromise),
    ]

    private struct StoredLocation: Codable {
        let latitude: Double
        let longitude: Double
        let altitude: Double
        let horizontalAccuracy: Double
        let verticalAccuracy: Double
        let timestamp: Date

        init(_ location: CLLocation) {
            latitude = location.coordinate.latitude
            longitude = location.coordinate.longitude
            altitude = location.altitude
            horizontalAccuracy = location.horizontalAccuracy
            verticalAccuracy = location.verticalAccuracy
            timestamp = location.timestamp
        }

        var location: CLLocation {
            CLLocation(
                coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
                altitude: altitude,
                horizontalAccuracy: horizontalAccuracy,
                verticalAccuracy: verticalAccuracy,
                timestamp: timestamp
            )
        }
    }

    private struct StoredState: Codable {
        var activityType: String
        var distanceM: Double
        var movingS: Double
        var elevationGainM: Double
        var points: [[Double]]
        var lastAccepted: StoredLocation?
        var lastKept: StoredLocation?
        var isRecording: Bool
        var hasSession: Bool
    }

    private let manager = CLLocationManager()
    private let maximumHorizontalAccuracyM = 100.0
    private let storageKey = "gc.capacitor.workoutLocation.v1"
    private var state = StoredState(
        activityType: "walk",
        distanceM: 0,
        movingS: 0,
        elevationGainM: 0,
        points: [],
        lastAccepted: nil,
        lastKept: nil,
        isRecording: false,
        hasSession: false
    )

    override public func load() {
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.distanceFilter = 3
        manager.activityType = .fitness
        if let data = UserDefaults.standard.data(forKey: storageKey),
           let restored = try? JSONDecoder().decode(StoredState.self, from: data) {
            state = restored
            // O processo pode ter sido recriado; o JS decide se deve retomar.
            state.isRecording = false
        }
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": CLLocationManager.locationServicesEnabled()])
    }

    @objc func startTracking(_ call: CAPPluginCall) {
        state = StoredState(
            activityType: call.getString("activityType") ?? "walk",
            distanceM: 0,
            movingS: 0,
            elevationGainM: 0,
            points: [],
            lastAccepted: nil,
            lastKept: nil,
            isRecording: true,
            hasSession: true
        )
        beginLocationUpdates(call)
    }

    @objc func pauseTracking(_ call: CAPPluginCall) {
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
        state.isRecording = false
        state.lastAccepted = nil
        persist()
        call.resolve(payload(includeRoute: true))
    }

    @objc func resumeTracking(_ call: CAPPluginCall) {
        if !state.hasSession {
            state = StoredState(
                activityType: call.getString("activityType") ?? "walk",
                distanceM: 0,
                movingS: 0,
                elevationGainM: 0,
                points: [],
                lastAccepted: nil,
                lastKept: nil,
                isRecording: true,
                hasSession: true
            )
        }
        state.isRecording = true
        state.lastAccepted = nil
        beginLocationUpdates(call)
    }

    @objc func stopTracking(_ call: CAPPluginCall) {
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
        state.isRecording = false
        appendFinalPoint()
        let result = payload(includeRoute: true)
        state.hasSession = false
        persist()
        UserDefaults.standard.removeObject(forKey: storageKey)
        call.resolve(result)
    }

    @objc func snapshot(_ call: CAPPluginCall) {
        call.resolve(payload(includeRoute: true))
    }

    private func beginLocationUpdates(_ call: CAPPluginCall) {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
            persist()
            call.resolve(payload(includeRoute: true))
        case .authorizedAlways, .authorizedWhenInUse:
            startManager()
            call.resolve(payload(includeRoute: true))
        case .denied, .restricted:
            state.isRecording = false
            persist()
            call.reject("Permissão de localização negada")
        @unknown default:
            state.isRecording = false
            persist()
            call.reject("Estado de localização desconhecido")
        }
    }

    private func startManager() {
        if manager.accuracyAuthorization == .reducedAccuracy {
            manager.requestTemporaryFullAccuracyAuthorization(
                withPurposeKey: "WorkoutRoute"
            ) { [weak self] _ in
                DispatchQueue.main.async {
                    self?.startLocationUpdates()
                }
            }
            return
        }
        startLocationUpdates()
    }

    private func startLocationUpdates() {
        manager.allowsBackgroundLocationUpdates = true
        manager.pausesLocationUpdatesAutomatically = false
        manager.showsBackgroundLocationIndicator = true
        manager.startUpdatingLocation()
        persist()
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard state.isRecording else { return }
        if manager.authorizationStatus == .authorizedAlways ||
            manager.authorizationStatus == .authorizedWhenInUse {
            startManager()
        } else if manager.authorizationStatus == .denied ||
                    manager.authorizationStatus == .restricted {
            state.isRecording = false
            persist()
            notifyListeners("workoutLocationError", data: ["code": "permission_denied"])
        }
    }

    public func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        guard state.isRecording else { return }
        for location in locations {
            accept(location)
        }
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        notifyListeners(
            "workoutLocationError",
            data: ["code": "location_failed", "message": error.localizedDescription]
        )
    }

    private func accept(_ location: CLLocation) {
        guard location.horizontalAccuracy > 0,
              location.horizontalAccuracy <= maximumHorizontalAccuracyM else { return }
        guard abs(location.timestamp.timeIntervalSinceNow) < 30 else { return }

        guard let previous = state.lastAccepted?.location else {
            state.lastAccepted = StoredLocation(location)
            keepPointIfNeeded(location)
            persistAndNotify()
            return
        }

        let dt = location.timestamp.timeIntervalSince(previous.timestamp)
        guard dt > 0 else { return }
        if dt >= 45 {
            state.lastAccepted = StoredLocation(location)
            keepPointIfNeeded(location)
            persistAndNotify()
            return
        }

        let segment = location.distance(from: previous)
        let averageAccuracy = (previous.horizontalAccuracy + location.horizontalAccuracy) / 2
        let minimumSegment = max(2, min(15, averageAccuracy * 0.25))
        // Não avança a âncora: passos pequenos acumulam até superar o limiar.
        guard segment >= minimumSegment else { return }

        let speed = segment / dt
        guard speed <= maximumSpeed else {
            state.lastAccepted = StoredLocation(location)
            persist()
            return
        }

        state.distanceM += segment
        if speed > 0.5 {
            state.movingS += dt
        }
        if previous.verticalAccuracy > 0,
           location.verticalAccuracy > 0,
           previous.verticalAccuracy <= 12,
           location.verticalAccuracy <= 12 {
            let delta = location.altitude - previous.altitude
            let noiseFloor = max(3, (previous.verticalAccuracy + location.verticalAccuracy) / 2)
            if delta > noiseFloor, delta < 30 {
                state.elevationGainM += delta
            }
        }

        state.lastAccepted = StoredLocation(location)
        keepPointIfNeeded(location)
        persistAndNotify()
    }

    private var maximumSpeed: Double {
        switch state.activityType {
        case "ride": return 45
        case "run": return 12
        default: return 8
        }
    }

    private func keepPointIfNeeded(_ location: CLLocation) {
        if let last = state.lastKept?.location, location.distance(from: last) < 10 {
            return
        }
        state.lastKept = StoredLocation(location)
        state.points.append([
            (location.coordinate.latitude * 100_000).rounded() / 100_000,
            (location.coordinate.longitude * 100_000).rounded() / 100_000,
        ])
        if state.points.count > 1_500 {
            state.points = state.points.enumerated().compactMap {
                $0.offset.isMultiple(of: 2) ? $0.element : nil
            }
        }
    }

    private func appendFinalPoint() {
        guard let last = state.lastAccepted?.location else { return }
        if let kept = state.lastKept?.location, last.distance(from: kept) < 1 {
            return
        }
        state.points.append([
            (last.coordinate.latitude * 100_000).rounded() / 100_000,
            (last.coordinate.longitude * 100_000).rounded() / 100_000,
        ])
    }

    private func payload(includeRoute: Bool) -> [String: Any] {
        [
            "isRecording": state.isRecording,
            "hasSession": state.hasSession,
            "distanceM": (state.distanceM * 10).rounded() / 10,
            "movingS": Int(state.movingS.rounded()),
            "elevationGainM": (state.elevationGainM * 10).rounded() / 10,
            "route": includeRoute && state.points.count >= 2 && state.distanceM >= 30
                ? state.points
                : [],
        ]
    }

    private func persistAndNotify() {
        persist()
        notifyListeners("workoutLocationUpdate", data: payload(includeRoute: false))
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(state) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }
}

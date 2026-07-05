import Foundation
import CoreLocation

/// Resultado da gravação de rota (Fase 2 — GPS outdoor). points no shape do
/// route jsonb: [[lat, lng], ...] downsampled (só pro sketch do mini-mapa).
public struct WorkoutRouteSummary: Sendable {
    public let distanceM: Double
    public let movingS: Int
    public let elevationGainM: Double
    public let points: [[Double]]
}

/// Gravador de rota do treino ao vivo (corrida/caminhada/bike). Filtra
/// leituras ruins (precisão > 50 m, saltos > 100 m), acumula distância,
/// tempo em movimento (> 0,5 m/s) e ganho de elevação (> +1 m por leitura
/// com precisão vertical decente). Criar e usar SEMPRE na main thread.
public final class WorkoutRouteRecorder: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published public private(set) var distanceM: Double = 0
    @Published public private(set) var movingS: Double = 0
    @Published public private(set) var elevationGainM: Double = 0
    @Published public private(set) var authorizationDenied = false
    @Published public private(set) var isRecording = false

    private let manager = CLLocationManager()
    private var lastAccepted: CLLocation?
    private var lastAltitude: Double?
    private var points: [[Double]] = []
    private var lastKeptPoint: CLLocation?
    private static let maxPoints = 1500

    override public init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.distanceFilter = 3
        manager.activityType = .fitness
    }

    /// Ritmo médio (s/km) sobre o tempo em movimento. nil até ter sinal
    /// suficiente (> 50 m) — evita ritmo maluco no comecinho.
    public var paceSecPerKm: Int? {
        guard distanceM > 50, movingS > 0 else { return nil }
        return Int((movingS / (distanceM / 1000)).rounded())
    }

    public func start() {
        distanceM = 0
        movingS = 0
        elevationGainM = 0
        points = []
        lastAccepted = nil
        lastAltitude = nil
        lastKeptPoint = nil
        authorizationDenied = false
        isRecording = true
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            authorizationDenied = true
            isRecording = false
            return
        default:
            break
        }
        // Segue gravando com a tela apagada (UIBackgroundModes: location).
        manager.allowsBackgroundLocationUpdates = true
        manager.pausesLocationUpdatesAutomatically = false
        manager.startUpdatingLocation()
    }

    /// Pausa sem apagar o trajeto acumulado. Ao retomar, a próxima leitura
    /// vira uma nova âncora para não somar o deslocamento ocorrido na pausa.
    public func pause() {
        guard isRecording else { return }
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
        isRecording = false
        lastAccepted = nil
        lastAltitude = nil
    }

    /// Retoma a mesma rota sem zerar distância, subida ou pontos.
    public func resume() {
        guard !isRecording, !authorizationDenied else { return }
        isRecording = true
        lastAccepted = nil
        lastAltitude = nil
        manager.allowsBackgroundLocationUpdates = true
        manager.startUpdatingLocation()
    }

    /// Para o GPS e devolve o resumo — nil quando não houve rota de verdade
    /// (< 2 pontos ou < 30 m: sessão indoor/permission negada vira session).
    @discardableResult
    public func stop() -> WorkoutRouteSummary? {
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
        isRecording = false
        guard points.count >= 2, distanceM >= 30 else { return nil }
        return WorkoutRouteSummary(
            distanceM: (distanceM * 10).rounded() / 10,
            movingS: Int(movingS.rounded()),
            elevationGainM: (elevationGainM * 10).rounded() / 10,
            points: points
        )
    }

    // MARK: - CLLocationManagerDelegate

    public func locationManager(
        _ manager: CLLocationManager,
        didChangeAuthorization status: CLAuthorizationStatus
    ) {
        if status == .denied || status == .restricted {
            authorizationDenied = true
            isRecording = false
        } else if isRecording && (status == .authorizedWhenInUse || status == .authorizedAlways) {
            manager.allowsBackgroundLocationUpdates = true
            manager.startUpdatingLocation()
        }
    }

    public func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        guard isRecording else { return }
        for location in locations {
            accept(location)
        }
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Fail-soft: sinal ruim/temporário não derruba o treino — a sessão
        // continua como cronômetro e a rota fica parcial.
    }

    private func accept(_ location: CLLocation) {
        let accuracy = location.horizontalAccuracy
        guard accuracy > 0, accuracy <= 50 else { return }
        guard abs(location.timestamp.timeIntervalSinceNow) < 30 else { return }

        guard let previous = lastAccepted else {
            lastAccepted = location
            keepPointIfNeeded(location)
            lastAltitude = location.verticalAccuracy <= 12 ? location.altitude : nil
            return
        }

        let dt = location.timestamp.timeIntervalSince(previous.timestamp)
        guard dt > 0 else { return }
        if dt >= 45 {
            lastAccepted = location
            keepPointIfNeeded(location)
            lastAltitude = location.verticalAccuracy <= 12 ? location.altitude : nil
            return
        }
        let segment = location.distance(from: previous)
        let minimumSegment = max(
            2,
            min(6, ((previous.horizontalAccuracy + location.horizontalAccuracy) / 2) * 0.25)
        )
        // Mantém a âncora: movimentos pequenos se acumulam até superar o
        // limiar, em vez de desaparecerem em leituras muito frequentes.
        guard segment >= minimumSegment else { return }
        // Salto de GPS (teleporte) — descarta o segmento e cria nova âncora.
        guard segment < 100, segment / dt < 15 else {
            lastAccepted = location
            return
        }

        distanceM += segment
        if segment / dt > 0.5 {
            movingS += dt
        }
        if location.verticalAccuracy > 0, location.verticalAccuracy <= 12 {
            if let lastAltitude {
                let delta = location.altitude - lastAltitude
                let noiseFloor = max(3, location.verticalAccuracy)
                if delta > noiseFloor, delta < 30 {
                    elevationGainM += delta
                }
            }
            lastAltitude = location.altitude
        }
        lastAccepted = location
        keepPointIfNeeded(location)
    }

    /// Downsample: guarda um ponto a cada ~10 m; passa do teto, afina 2×.
    private func keepPointIfNeeded(_ location: CLLocation) {
        if let lastKept = lastKeptPoint, location.distance(from: lastKept) < 10 {
            return
        }
        lastKeptPoint = location
        points.append([
            (location.coordinate.latitude * 100_000).rounded() / 100_000,
            (location.coordinate.longitude * 100_000).rounded() / 100_000,
        ])
        if points.count > Self.maxPoints {
            points = points.enumerated().compactMap { index, point in
                index.isMultiple(of: 2) ? point : nil
            }
        }
    }
}

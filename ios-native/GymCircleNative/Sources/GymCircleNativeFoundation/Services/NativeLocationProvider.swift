import Foundation
import CoreLocation
import MapKit

public struct GymCircleCoordinate: Codable, Hashable, Sendable {
    public let latitude: Double
    public let longitude: Double

    public init(latitude: Double, longitude: Double) {
        self.latitude = latitude
        self.longitude = longitude
    }
}

public struct NativePlaceCandidate: Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let address: String?
    public let neighborhood: String?
    public let city: String?
    public let state: String?
    public let coordinate: GymCircleCoordinate
    public let source: String

    public init(
        id: String,
        name: String,
        address: String? = nil,
        neighborhood: String? = nil,
        city: String? = nil,
        state: String? = nil,
        coordinate: GymCircleCoordinate,
        source: String = "apple_maps"
    ) {
        self.id = id
        self.name = name
        self.address = address
        self.neighborhood = neighborhood
        self.city = city
        self.state = state
        self.coordinate = coordinate
        self.source = source
    }

    public var subtitle: String {
        [address, neighborhood, city, state]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank }
            .joined(separator: " · ")
    }
}

public protocol NativeLocationProviding: AnyObject {
    func currentPosition() async throws -> GymCircleCoordinate
    func searchPlaces(query: String, near coordinate: GymCircleCoordinate?) async throws -> [NativePlaceCandidate]
    func nearbyPlaces(near coordinate: GymCircleCoordinate) async throws -> [NativePlaceCandidate]
    func reverseGeocode(_ coordinate: GymCircleCoordinate) async throws -> NativePlaceCandidate?
}

public enum NativeLocationProvider {
    public static func distanceKm(from: GymCircleCoordinate, to: GymCircleCoordinate) -> Double {
        let a = CLLocation(latitude: from.latitude, longitude: from.longitude)
        let b = CLLocation(latitude: to.latitude, longitude: to.longitude)
        return a.distance(from: b) / 1_000
    }

    public static func formattedDistanceKm(_ distance: Double) -> String {
        if distance < 1 {
            return "\(Int((distance * 1_000).rounded()))m"
        }
        if distance < 10 {
            return String(format: "%.1fkm", distance).replacingOccurrences(of: ".", with: ",")
        }
        return "\(Int(distance.rounded()))km"
    }
}

@MainActor
public final class AppleMapsLocationProvider: NSObject, NativeLocationProviding, CLLocationManagerDelegate {
    public static let shared = AppleMapsLocationProvider()

    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<GymCircleCoordinate, Error>?

    public override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    public func currentPosition() async throws -> GymCircleCoordinate {
        if let location = manager.location {
            return GymCircleCoordinate(
                latitude: location.coordinate.latitude,
                longitude: location.coordinate.longitude
            )
        }

        let status = manager.authorizationStatus
        if status == .notDetermined {
            manager.requestWhenInUseAuthorization()
        }

        guard status == .authorizedWhenInUse || status == .authorizedAlways || status == .notDetermined else {
            throw CLError(.denied)
        }

        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            manager.requestLocation()
        }
    }

    public func searchPlaces(
        query: String,
        near coordinate: GymCircleCoordinate? = nil
    ) async throws -> [NativePlaceCandidate] {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        if let coordinate {
            request.region = MKCoordinateRegion(
                center: CLLocationCoordinate2D(
                    latitude: coordinate.latitude,
                    longitude: coordinate.longitude
                ),
                latitudinalMeters: 8_000,
                longitudinalMeters: 8_000
            )
        }
        let response = try await MKLocalSearch(request: request).start()
        return response.mapItems.compactMap(Self.placeCandidate)
    }

    public func nearbyPlaces(near coordinate: GymCircleCoordinate) async throws -> [NativePlaceCandidate] {
        try await searchPlaces(query: "academia fitness gym", near: coordinate)
    }

    public func reverseGeocode(_ coordinate: GymCircleCoordinate) async throws -> NativePlaceCandidate? {
        let geocoder = CLGeocoder()
        let placemarks = try await geocoder.reverseGeocodeLocation(
            CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        )
        guard let placemark = placemarks.first else { return nil }
        let name = placemark.name ?? placemark.locality ?? "Localizacao atual"
        return NativePlaceCandidate(
            id: "reverse:\(coordinate.latitude):\(coordinate.longitude)",
            name: name,
            address: [placemark.thoroughfare, placemark.subThoroughfare]
                .compactMap { $0 }
                .joined(separator: ", ")
                .nilIfBlank,
            neighborhood: placemark.subLocality,
            city: placemark.locality,
            state: placemark.administrativeArea,
            coordinate: coordinate
        )
    }

    public nonisolated func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        guard let location = locations.last else { return }
        Task { @MainActor in
            continuation?.resume(returning: GymCircleCoordinate(
                latitude: location.coordinate.latitude,
                longitude: location.coordinate.longitude
            ))
            continuation = nil
        }
    }

    public nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            continuation?.resume(throwing: error)
            continuation = nil
        }
    }

    private static func placeCandidate(_ mapItem: MKMapItem) -> NativePlaceCandidate? {
        let coordinate = mapItem.placemark.coordinate
        guard coordinate.latitude.isFinite, coordinate.longitude.isFinite else { return nil }
        let id = [
            mapItem.name,
            mapItem.placemark.locality,
            "\(coordinate.latitude)",
            "\(coordinate.longitude)",
        ]
            .compactMap { $0 }
            .joined(separator: ":")
        return NativePlaceCandidate(
            id: id,
            name: mapItem.name ?? mapItem.placemark.name ?? "Local",
            address: [mapItem.placemark.thoroughfare, mapItem.placemark.subThoroughfare]
                .compactMap { $0 }
                .joined(separator: ", ")
                .nilIfBlank,
            neighborhood: mapItem.placemark.subLocality,
            city: mapItem.placemark.locality,
            state: mapItem.placemark.administrativeArea,
            coordinate: GymCircleCoordinate(
                latitude: coordinate.latitude,
                longitude: coordinate.longitude
            )
        )
    }
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

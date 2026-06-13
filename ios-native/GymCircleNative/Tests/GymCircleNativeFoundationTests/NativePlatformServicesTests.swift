import XCTest
@testable import GymCircleNative

final class NativePlatformServicesTests: XCTestCase {
    func testNativeDistanceFormattingUsesMetersBelowOneKm() {
        XCTAssertEqual(NativeLocationProvider.formattedDistanceKm(0.32), "320m")
    }

    func testNativeDistanceFormattingUsesPortugueseDecimalForNearKm() {
        XCTAssertEqual(NativeLocationProvider.formattedDistanceKm(1.24), "1,2km")
    }

    func testNativeDistanceBetweenCoordinatesIsApproximate() {
        let ibirapuera = GymCircleCoordinate(latitude: -23.5874, longitude: -46.6576)
        let paulista = GymCircleCoordinate(latitude: -23.5614, longitude: -46.6559)

        let distance = NativeLocationProvider.distanceKm(from: ibirapuera, to: paulista)

        XCTAssertGreaterThan(distance, 2.5)
        XCTAssertLessThan(distance, 3.5)
    }

    func testHealthKitProviderHasSafeAvailabilitySurface() {
        let provider = AppleHealthKitProvider()

        _ = provider.isAvailable
    }
}

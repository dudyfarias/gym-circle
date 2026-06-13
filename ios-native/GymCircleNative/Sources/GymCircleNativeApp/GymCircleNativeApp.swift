import SwiftUI

@main
struct GymCircleNativeApp: App {
    @UIApplicationDelegateAdaptor(GymCircleNativeAppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            GymCircleNativeRootView()
        }
    }
}

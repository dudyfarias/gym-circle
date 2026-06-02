// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "GymCircleNative",
    platforms: [
        .iOS(.v16),
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "GymCircleNativeFoundation",
            targets: ["GymCircleNativeFoundation"]
        ),
        .executable(
            name: "GymCircleNativePreview",
            targets: ["GymCircleNativePreview"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/supabase/supabase-swift.git", from: "2.0.0")
    ],
    targets: [
        .target(
            name: "GymCircleNativeFoundation",
            dependencies: [
                .product(name: "Supabase", package: "supabase-swift")
            ],
            path: "Sources/GymCircleNativeFoundation"
        ),
        .executableTarget(
            name: "GymCircleNativePreview",
            dependencies: ["GymCircleNativeFoundation"],
            path: "Sources/GymCircleNativePreview"
        )
    ]
)

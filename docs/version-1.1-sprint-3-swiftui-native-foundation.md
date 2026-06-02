# Gym Circle 1.1 - Sprint 3 - SwiftUI Native Foundation

Date: 2026-06-02

## Objective

Create a safe, parallel SwiftUI foundation for a future fully native iPhone app while keeping the current Next.js + Capacitor app as the production app.

This sprint does not replace the published app, does not remove Capacitor, does not create a new database, and does not change social rules.

## Decision

The native foundation lives in:

`ios-native/GymCircleNative`

This keeps `ios/App` untouched and protects the App Store/TestFlight build that is already working.

## Current iOS Audit

- `ios/App` is the Capacitor iOS shell.
- `capacitor.config.ts` uses `appId = com.gymcircle.app`, `webDir = native-fallback`, and `server.url = https://gym-circle-rust.vercel.app`.
- `ios/App/App/Info.plist` already contains camera, photo library, microphone, location, notification, portrait and encryption declarations for the Capacitor app.
- Push entitlement exists in `ios/App/App/App.entitlements`.
- The current app should continue to be built from `ios/App`.

## Reused From Current Product

- Supabase project `qajjpjmybmqqwflytcpr`.
- Existing tables, RLS, storage buckets and RPCs.
- Existing performance surface RPCs:
  - `get_home_feed`
  - `get_story_tray_lightweight`
  - `get_story_viewer_items`
  - `get_profile_posts`
  - `search_profiles`
  - `get_user_suggestions`
  - `get_conversation_summaries`
  - `get_conversation_messages`
- Product rules around feed visibility, stories, follows, private profiles, streaks and account status.
- Visual identity from `docs/design-system.md`.

## Rebuilt In SwiftUI

- SwiftUI app shell.
- Swift models for feed, story tray, profile posts and My Circle summaries.
- Supabase Swift SDK client provider.
- Read-only feed, stories, profile and My Circle screens.
- Gym Circle SwiftUI design tokens and base components.
- Native activity rings for week, month and year.

## Out Of Scope

- Posting.
- Story upload.
- Chat implementation.
- Push delivery.
- Camera/gallery.
- Apple Maps.
- HealthKit.
- Profile editing.
- Any database migration.
- Apple/Google login.

## Architecture

The SwiftUI foundation is organized as a Swift package:

- `Package.swift`
- `Sources/GymCircleNativeFoundation`
  - `App`
  - `Components`
  - `Config`
  - `Models`
  - `Screens`
  - `Services`
  - `Theme`
- `Sources/GymCircleNativePreview`
- `Config/Secrets.example.xcconfig`

The package is intentionally isolated from `ios/App`.

## Dependencies

- Swift
- SwiftUI
- Supabase Swift SDK via Swift Package Manager
- iOS 16+ target assumption

Supabase Swift docs confirm initialization through `SupabaseClient(supabaseURL:supabaseKey:)` and email/password sign-in through `supabase.auth.signIn(email:password:)`.

## Validation Status

- Web/Capacitor validation remains required after every native foundation change.
- XcodeGen `2.45.4` is installed locally.
- A separate SwiftUI `.xcodeproj` was generated at `ios-native/GymCircleNative/GymCircleNative.xcodeproj`.
- Debug simulator build passed with `xcodebuild -project GymCircleNative.xcodeproj -scheme GymCircleNative -configuration Debug -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build`.
- The generated project is intentionally isolated from `ios/App`, so it does not corrupt or replace the current Capacitor Xcode project.

## Risks

- Supabase Swift RPC decoding can drift if RPC return columns change.
- A real iOS app target still needs signing, bundle id and launch assets before TestFlight.
- SwiftUI screens are read-only and not yet a replacement for production.
- Secrets must be provided through local `.xcconfig` or Xcode build settings, never committed.

## Completion Criteria

- Native foundation exists in parallel.
- Current `ios/App` is untouched.
- `GymCircleNative.xcodeproj` builds for iOS Simulator.
- No secrets are committed.
- Docs explain how to continue.
- Web/Capacitor validation remains healthy.

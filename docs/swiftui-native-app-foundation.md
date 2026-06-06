# SwiftUI Native App Foundation

## Purpose

This document describes the first native SwiftUI foundation for Gym Circle. It is not the production app yet. It is a safe base for iterating toward a future iPhone-native experience.

## Folder

`ios-native/GymCircleNative`

## Why A Separate Folder

The current App Store build uses Capacitor in `ios/App`. Creating the SwiftUI foundation separately reduces risk:

- no changes to the published target,
- no signing churn,
- no provisioning profile changes,
- no accidental changes to Capacitor plugins,
- no production release disruption.

## Native Structure

```text
ios-native/GymCircleNative
  Package.swift
  Config
    Secrets.example.xcconfig
  Sources
    GymCircleNativeFoundation
      App
      Components
      Config
      Models
      Screens
      Services
      Theme
    GymCircleNativePreview
```

## Configuration

`Config/Secrets.example.xcconfig` documents the required local values:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

Real values must be added locally in Xcode or in an untracked `.xcconfig`.

## Supabase Layer

`SupabaseClientProvider` owns:

- Supabase URL,
- anon key,
- Swift SDK client,
- auth calls,
- RPC calls.

`AuthService` currently wraps:

- email/password sign-in,
- sign-out,
- current session,
- current user,
- session restore.

`SessionStore` centralizes:

- current user id,
- authenticated/signed-out/restoring state,
- logout,
- friendly auth errors.

`GymCircleAPI` currently wraps:

- `get_home_feed`,
- `get_story_tray_lightweight`,
- `get_story_viewer_items`,
- `get_profile_posts`,
- current profile loading.

`MyCircleService` currently wraps:

- `user_stats_live`,
- `user_activity_days`,
- week/month/year consistency calculations.

## Models

Initial Swift models map to current RPC rows:

- `UserProfile`
- `FeedPost`
- `StoryAuthorGroup`
- `StoryItem`
- `MyCircleSummary`
- `ConsistencyRings`
- `GymCircleStats`
- `Badge`
- `CommentPreview`

The native app should prefer RPC outputs instead of client-side joins.

## Design System

`GymCircleTheme.swift` translates the web design system:

- black background,
- dark cards,
- white primary text,
- grey secondary text,
- blue/cyan consistency palette,
- large corner radius,
- compact premium typography,
- soft glass panels.

Base components:

- `GCText`
- `GCButton`
- `GCCard`
- `GCAvatar`
- `GCLoadingView`
- `GCEmptyState`
- `GCGlassPanel`
- `GCTabBar`
- `ActivityRingsView`

## Read-only Screens

Implemented as native SwiftUI foundation screens:

- `LoginView`
- `FeedView`
- `StoriesTrayView`
- `StoryViewerView`
- `ProfileView`
- `MyCircleView`
- `MainTabView`

Create and Chat are placeholders in this sprint. Auth, feed, story tray, story viewer, profile and My Circle now use real Supabase surfaces when local anon-key configuration is present.

## Xcode Project

The runnable SwiftUI experiment is generated with XcodeGen:

```bash
cd ios-native/GymCircleNative
xcodegen generate --spec project.yml
open GymCircleNative.xcodeproj
```

The generated target uses bundle id `com.gymcircle.native.dev` and signing is disabled by default for local simulator builds. This keeps the production Capacitor app in `ios/App` untouched.

## Next Xcode Step

When ready to run or extend the native experiment:

1. Open `ios-native/GymCircleNative/GymCircleNative.xcodeproj`.
2. Add local Supabase secrets through Xcode build settings or an untracked `.xcconfig`.
3. Run the `GymCircleNative` scheme on an iPhone simulator.
4. Keep signing teams, provisioning profiles and secrets uncommitted.

## Guardrails

- Do not alter `ios/App` until the native app is explicitly promoted.
- Do not add migrations for native-only needs.
- Do not bypass RLS.
- Do not use service role keys.
- Do not re-enable Apple/Google login in this foundation.

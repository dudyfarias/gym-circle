# Gym Circle 1.1 - Sprint 3.1 - SwiftUI Auth + Feed Read-only

Date: 2026-06-02

## Objective

Turn the parallel SwiftUI foundation into a functional native experiment for the first time, without replacing the current Next.js + Capacitor production app.

## Scope

- Real Supabase email/password authentication.
- Session restore on app boot.
- Native app state through `SessionStore`.
- Read-only home feed through `get_home_feed`.
- Story tray through `get_story_tray_lightweight`.
- Story viewer through `get_story_viewer_items`.
- Own profile and profile grid through explicit profile columns plus `get_profile_posts`.
- My Circle summary through `user_stats_live` and `user_activity_days`.
- Premium loading and error states.
- Lightweight unit tests for deterministic native models.

## Out Of Scope

- Replacing `ios/App`.
- Posting.
- Story upload.
- Likes, comments, shares and saves.
- Chat implementation.
- Profile editing.
- Apple Login or Google Login.
- Supabase schema changes, migrations or RPC changes.
- Service Role usage.

## Supabase Auth

`AuthService.swift` wraps the Supabase Swift SDK:

- `signIn(email,password)`
- `signOut()`
- `currentSession()`
- `currentUser()`
- `restoreSession()`

`SessionStore.swift` owns native auth state:

- restoring
- signed out
- signed in with current user id

The app boot flow is:

1. `GymCircleNativeRootView` starts `model.bootstrap()`.
2. `SessionStore` attempts session restore.
3. If a valid session exists, the native shell opens.
4. If no session exists, the login screen appears.
5. Logout clears native surfaces and returns to login.

## RPCs And Tables Used

RPCs:

- `get_home_feed(cursor, limit)`
- `get_story_tray_lightweight(limit)`
- `get_story_viewer_items(author_id)`
- `get_profile_posts(user_id, cursor, limit)`

Tables/views:

- `profiles` with explicit columns only
- `user_stats_live`
- `user_activity_days`

No new RPCs, migrations or policies were created.

## Connected Screens

- `LoginView`: email/password only.
- `FeedView`: avatar, name, username, media, caption, relative date, likes count and comments count.
- `StoriesTrayView`: author avatar, name and viewed/unseen state.
- `StoryViewerView`: loads one author story group on demand.
- `ProfileView`: own profile, bio, stats and simple media grid.
- `MyCircleView`: week/month/year consistency rings from real activity days.
- `MainTabView`: Feed, Meu Circle, Create placeholder, Chat placeholder and Profile.

## Media Strategy

Feed and story media use the same priority as the web performance work:

1. `thumbnail_url`
2. `poster_url`
3. original media URL

Old posts without thumbnails/posters still render through the original media URL.

## Loading And Error States

Added/used:

- `GCLoadingView`
- `GCErrorState`
- `GCSkeletonBlock`
- feed skeleton cards
- story tray placeholders
- profile skeleton
- My Circle ring placeholder
- retry actions for failed surfaces

Errors are shown as friendly UI states. No `fatalError()` or raw JSON is shown.

## Security

- Uses anon key only.
- No Service Role.
- RLS remains enforced by Supabase.
- No secrets committed.
- No migrations or schema changes.
- No direct client-side joins for feed visibility.

## Validation

Required commands for this sprint:

```bash
npm run lint
npm run build
npm test -- --run
npx cap sync ios
git diff --check
cd ios-native/GymCircleNative
swift test
xcodegen generate --spec project.yml
xcodebuild -project GymCircleNative.xcodeproj -scheme GymCircleNative -configuration Debug -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build
```

## Limitations

- Native app requires local `SUPABASE_URL` and `SUPABASE_ANON_KEY` build settings or an untracked `.xcconfig`.
- Chat and Create remain placeholders.
- Story viewer is read-only.
- Profile is read-only.
- Auth test coverage is currently manual unless local test credentials are configured.

## Risks

- RPC return column changes can break Swift decoding.
- Supabase session persistence must be validated on a real iPhone once local secrets are configured.
- My Circle uses `user_activity_days` directly for week/month/year counts; future server-side summary RPC could reduce payload further.

## Next Steps

- Add native test credentials only through local, untracked configuration if automated auth tests are needed.
- Add native create-post camera foundation after read-only surfaces are stable.
- Add chat read-only summaries in a future sprint.
- Add pagination/load-more for feed/profile if the native experiment continues.

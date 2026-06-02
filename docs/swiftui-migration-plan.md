# SwiftUI Migration Plan

## Strategy

Gym Circle stays production on Next.js + Capacitor while the SwiftUI app matures in parallel. The native version only replaces production when it is more stable, faster and easier to maintain than the WebView build.

## Phase 1 - Native Foundation

- Create isolated SwiftUI foundation.
- Add Supabase Swift SDK.
- Map current RPC outputs to Swift models.
- Build read-only feed, story tray, profile and My Circle.
- Keep production app unchanged.

## Phase 2 - Auth Complete + Feed Read-only

- Harden email/password auth.
- Persist sessions safely.
- Add password reset/deep link handling.
- Add feed pagination.
- Add better loading and empty states.

## Phase 3 - Feed Interactive

- Like/unlike posts.
- Open likes overlay.
- Open comments read-only.
- Add comments create/delete later.
- Preserve existing RLS and notification rules.

## Phase 4 - Stories Continuous

- Native story viewer progress.
- Viewed state persistence.
- Story likes.
- Reply placeholder first, full chat reply later.

## Phase 5 - Post Composer

- Native camera/gallery.
- Image compression.
- Video poster generation.
- Upload progress and retry.
- Feed/story destination switch.

## Phase 6 - Profile + Editing

- FullProfile loader.
- Profile edit with dirty-field updates only.
- Followers/following overlays.
- Private profile rules.

## Phase 7 - Meu Circle Premium

- Native activity rings.
- Monthly calendar.
- Badges.
- Streak restore.
- Monthly recap sharing.

## Phase 8 - Chat

- Conversation summaries.
- Direct messages.
- Media messages.
- Delete-for-me.
- Group chat later.

## Phase 9 - Push

- APNs token lifecycle.
- Supabase device token table.
- Push via Edge Function/server.
- Deep links to surfaces.

## Phase 10 - Replace Capacitor If Better

Only replace the current app if:

- cold start is better on real iPhone,
- feed/stories/chat are smoother,
- feature parity is real,
- auth and recovery are reliable,
- App Store review risk is lower,
- maintenance cost is acceptable.

## Phase 11 - Android/Kotlin Future

Reuse:

- Supabase schema,
- RLS,
- RPCs,
- design tokens,
- product rules.

Rebuild:

- native Android UI,
- camera/gallery,
- push,
- maps,
- local cache.

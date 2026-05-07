# Future Expo Reuse Plan

The first Gym Circle version is a web/PWA validation build. The native App Store version should reuse the domain layer, not the web UI.

## Reuse Directly

- Supabase schema and RLS policies
- Auth service contracts
- Post service contracts
- Streak recalculation utilities
- Gym and user discovery services
- Shared TypeScript models
- Design token values
- Component contracts for `BottomTabBar`, `SocialPostCard`, `StreakCard`, `ActivityCircle`, `ProfileHeader`, `GymCheckInCard`, `StoryBubbles`, `FloatingCreatePostButton`, `StatsWidget` and `AchievementBadge`
- Social mock action contracts from `useGymCircleSocial`
- Streak calculation utilities from the social layer
- Consistency ring semantics: inner day, middle month and outer year

## Adapt Per Platform

- Supabase client creation
- File upload and image compression
- Push notifications
- Deep linking
- Camera and gallery access
- Native navigation
- Native component implementation using React Native views, Expo Image and Reanimated
- Native ring rendering using SVG/Reanimated, keeping the same progress values and blue/cyan token names

## Avoid In Core

- `window`
- `document`
- browser storage APIs
- Next.js imports
- DOM event types
- CSS class strings

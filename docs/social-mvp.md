# Gym Circle Social MVP

The MVP uses a local mock social layer so the product feels alive before Supabase is connected.

## Implemented Flows

- Smart feed populated with workout posts
- Fast workout post creation with preselected image
- Workout post validation through required photo
- Followers and following actions
- Likes and comments
- Stories with full-screen viewer
- Check-in feedback
- Current-user streak recalculation from workout days
- Public streak badge on feed names, story bubbles, story viewer, comments, like previews, profile and check-ins
- Social streak levels: beginner, consistent, elite and legendary
- Daily streak presence state: the badge lights up only after a feed photo or a fitness story that day
- Three-scale consistency rings: day, month and year progress in profile and streak views
- Nearby user discovery based on shared gyms
- Premium feedback toast and simulated haptics
- Elegant empty states for quiet feed/comments

## Local Architecture

- Social state and actions: `apps/web/src/components/gym-circle/social/useGymCircleSocial.ts`
- Fake users, posts and stories: `apps/web/src/components/gym-circle/social/mock-data.ts`
- Streak calculations: `apps/web/src/components/gym-circle/social/streak.ts`
- Haptic simulation: `apps/web/src/components/gym-circle/social/haptics.ts`
- Visual components: `apps/web/src/components/gym-circle/design-system`

## Product Rule

Gym Circle is social-first. Streak is not a private metric; it is a public reputation badge. Every person context should show the current streak when space allows, while keeping the feed familiar: stories first, large workout photos, action row, likes, caption and comments.

The badge has a daily presence state. A feed photo or fitness story lights it for the day. Without daily social presence, the same streak number stays visible but dimmed, with no glow and a partially open ring. This should feel like an invitation to post, not punishment.

The profile consistency circles represent lifestyle over time: the inner day ring lights when the user posts today, the middle month ring tracks this month's posting frequency, and the outer year ring shows longer-term active days. These rings are motivational status, not a technical dashboard.

## Supabase Migration

The mocked reducer actions map directly to future services:

- `publishWorkout` -> create post, upload image, register workout day, recalculate streak
- `likePost` -> upsert/delete `post_likes`
- `commentPost` -> insert `post_comments`
- `toggleFollow` -> insert/delete `follows`
- `openStory` -> read stories/check-ins
- `checkIn` -> insert `checkins`

Keep this split when wiring Supabase: components call hooks, hooks call services, services talk to Supabase.

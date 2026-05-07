# Core Hooks

Future hooks for auth, feed, posts, streaks, gyms and nearby users should call services from `packages/core/src/services`.

When the Expo app is added, hooks should remain portable and receive platform-specific clients through parameters or providers.

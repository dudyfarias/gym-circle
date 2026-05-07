export const gymCircleHierarchy = {
  screenPadding: 20,
  sectionGap: 24,
  cardGap: 12,
  touchTarget: 48,
  mobileContentWidth: 430,
  desktopPreviewWidth: 480,
} as const;

export const gymCircleBrand = {
  name: "Gym Circle",
  symbol: "Circular neon C",
  meaning: [
    "progresso",
    "movimento",
    "consistência",
    "círculo social",
    "evolução diária",
  ],
  principles: [
    "dark mode first",
    "clean",
    "premium",
    "social-first",
    "mobile-first",
    "iOS-native feel",
  ],
} as const;

export const gymCircleComponentSystem = [
  "BottomTabBar",
  "SocialPostCard",
  "StreakCard",
  "ActivityCircle",
  "ProfileHeader",
  "GymCheckInCard",
  "StoryBubbles",
  "FloatingCreatePostButton",
  "StatsWidget",
  "AchievementBadge",
] as const;

export const gymCircleReusableInExpo = [
  "Design tokens in packages/core/src/design",
  "Domain models and database types",
  "Business services for auth, posts, streaks, gyms, users, follows, comments and check-ins",
  "Pure streak calculation utilities",
  "Validation rules for workout posts and image-required streaks",
] as const;

export const gymCircleWebOnly = [
  "Next.js routing, metadata and server helpers",
  "DOM-specific image rendering",
  "CSS glassmorphism utilities",
  "PWA manifest and browser install affordances",
] as const;

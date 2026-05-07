# Gym Circle Design System

Gym Circle is dark mode first, mobile first and inspired by Apple Fitness, Apple Health, Instagram iOS and Arc Browser.

The official mark is the circular neon blue `C`. It represents progress, movement, consistency, social circles and daily evolution.

## Brand

- Product name: `Gym Circle`
- Primary symbol: circular neon `C`
- Symbol color: `#8AF7FF`
- Deep blue: `#30D5FF`
- Soft highlight: `#C7FCFF`
- Brand glow: `rgba(92,232,255,0.42)`
- Brand ink: `#061116`

## Color System

- App background: `#000000`
- Elevated background: `#050607`
- Base cards: `#111111`
- Elevated cards: `#1C1C1E`
- Soft cards: `#17181A`
- Glass surface: `rgba(28,28,30,0.72)`
- Strong glass: `rgba(18,20,22,0.84)`
- Separators: `rgba(255,255,255,0.06)`
- Strong separators: `rgba(255,255,255,0.1)`
- Primary text: `#FFFFFF`
- Secondary text: `#A1A1AA`
- Tertiary text: `rgba(255,255,255,0.52)`
- Activity blue: `#30D5FF`
- Highlight pink: `#FF2D55`
- Heat orange: `#FF9F0A`

## Consistency Palette

The consistency system is monochromatic blue/cyan. Do not use green, lime, pink or orange in streak rings, streak badges, activity circles or consistency calendars.

- Daily circle: `#8CFBFF`
- Monthly circle: `#30D5FF`
- Mid-depth blue: `#009DFF`
- Annual/deep circle: `#0066FF`
- Quiet fill: `rgba(48,213,255,0.12)`
- Glow: `rgba(48,213,255,0.30)`

## Consistency Rings

`ActivityCircle` is the official visual model for fitness consistency. It uses three SVG rings with Apple Fitness-like motion and must stay minimal, blue/cyan and social-first.

- Inner ring: day. Shows whether the user posted a feed photo or fitness story today. Bright cyan, complete when lit, partially open when pending.
- Middle ring: month. Shows current month frequency. Electric blue, accumulated from workout/photo days in the current month.
- Outer ring: year. Shows long-term annual consistency. Deep blue, quieter and more subtle than day/month.

The rings should animate with fluid stroke fill, a soft premium glow and no punitive copy. When the user posts, the day ring lights up, the month/year progress updates, and the badge state becomes active across profile, feed, stories, comments, likes and check-ins.

## Typography Scale

Use the system Apple stack as the SF Pro reference:

```css
-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif
```

- Hero: `44/48`, weight `850`
- Display: `40/44`, weight `800`
- Large title: `28/34`, weight `750`
- Title: `24/30`, weight `760`
- Headline: `20/26`, weight `700`
- Body: `16/22`, weight `500`
- Callout: `15/21`, weight `650`
- Caption: `13/18`, weight `600`
- Micro: `11/14`, weight `750`
- Number: `48/48`, weight `860`

Numbers should be large and strong. Labels should be compact and secondary. Avoid long explanatory paragraphs inside app screens.

## Shadows

- Hairline: `inset 0 1px 0 rgba(255,255,255,0.08)`
- Card: `0 18px 48px rgba(0,0,0,0.42)`
- Large card: `0 28px 72px rgba(0,0,0,0.56)`
- Floating: `0 18px 40px rgba(0,0,0,0.42), 0 0 30px rgba(92,232,255,0.2)`
- Brand glow: `0 0 34px rgba(92,232,255,0.38)`
- Consistency glow: `0 0 30px rgba(48,213,255,0.30)`

## Spacing

- Base scale: `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96`
- Screen padding: `20px`
- Section gap: `24px`
- Card gap: `12px`
- Minimum touch target: `48px`
- Main mobile width: `430px`
- Desktop preview width: `480px`

## Radius

- Small: `14px`
- Base: `18px`
- Controls: `20px`
- Cards: `24px`
- Large cards: `28px`
- Premium panels: `32px`
- Feature panels: `40px`
- Avatars and pills: `999px`

## Motion

- Instant feedback: `90ms`
- Fast feedback: `140ms`
- Default transitions: `220ms`
- Expressive transitions: `320ms`
- Screen/hero motion: `420ms`
- Default easing: `cubic-bezier(0.2, 0.9, 0.2, 1)`
- Spring-like easing: `cubic-bezier(0.16, 1, 0.3, 1)`
- Snap easing: `cubic-bezier(0.34, 1.56, 0.64, 1)`

## Components

Official reusable web components live in `apps/web/src/components/gym-circle/design-system`.

- `BrandMark`
- `BottomTabBar`
- `SocialPostCard`
- `StreakBadge`
- `StreakCard`
- `ActivityCircle`
- `ProfileHeader`
- `GymCheckInCard`
- `StoryBubbles`
- `FloatingCreatePostButton`
- `StatsWidget`
- `AchievementBadge`

All visual components should feel native to iOS: large radius, clear hierarchy, short labels, direct touch targets and subtle motion.

## Streak Levels

`StreakBadge` is the official reputation marker. Use it beside user names in social contexts.

- Beginner: `0+` days
- Consistent: `4+` days
- Elite: `14+` days
- Legendary: `30+` days

Use compact badges in feed headers, comments, likes and stories. Use level labels in profile, discovery cards, check-in and streak views.

## Streak Presence

The streak badge has two visual states:

- Lit: completed circular ring, blue breathing glow, active level color, smooth awake motion.
- Dim: blue-grey partial ring, no glow, reduced contrast, still readable.

Lit state is earned daily through one feed photo or one fitness story. Check-ins can display the state, but do not light it by themselves.

## Expo Reuse

Reusable later:

- `packages/core/src/design/*`
- domain types
- services
- hooks
- streak calculation utilities
- Supabase schema, RLS and storage structure
- component contracts and prop names

Rebuilt for Expo:

- visual components
- navigation
- image picker/camera
- CSS glass effects
- Next.js route/layout files

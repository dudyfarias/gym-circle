export const gymCircleColors = {
  brand: {
    mark: "#8AF7FF",
    markDeep: "#30D5FF",
    markSoft: "#C7FCFF",
    glow: "rgba(92, 232, 255, 0.42)",
    ink: "#061116",
  },
  background: {
    app: "#000000",
    appElevated: "#050607",
    card: "#111111",
    cardElevated: "#1C1C1E",
    cardSoft: "#17181A",
    glass: "rgba(28, 28, 30, 0.72)",
    glassStrong: "rgba(18, 20, 22, 0.84)",
    separator: "rgba(255,255,255,0.06)",
    separatorStrong: "rgba(255,255,255,0.1)",
  },
  text: {
    primary: "#FFFFFF",
    secondary: "#A1A1AA",
    tertiary: "rgba(255,255,255,0.52)",
    inverse: "#000000",
  },
  accent: {
    energy: "#8CFBFF",
    activityBlue: "#30D5FF",
    highlightPink: "#FF2D55",
    heatOrange: "#FF9F0A",
    streakGreen: "#30D5FF",
  },
  consistency: {
    daily: "#8CFBFF",
    monthly: "#30D5FF",
    mid: "#009DFF",
    annual: "#0066FF",
    quiet: "rgba(48,213,255,0.12)",
    glow: "rgba(48,213,255,0.30)",
  },
  state: {
    success: "#30D5FF",
    warning: "#FF9F0A",
    danger: "#FF2D55",
  },
  gradient: {
    brandRing:
      "conic-gradient(from 130deg, #C7FCFF, #8AF7FF, #30D5FF, rgba(48,213,255,0.18), #C7FCFF)",
    story:
      "conic-gradient(from 160deg, #0066FF, #009DFF, #30D5FF, #8CFBFF, #0066FF)",
    activity:
      "linear-gradient(135deg, #8CFBFF 0%, #30D5FF 42%, #009DFF 72%, #0066FF 100%)",
    consistency:
      "conic-gradient(from 120deg, #8CFBFF, #30D5FF, #009DFF, #0066FF, #8CFBFF)",
  },
} as const;

export const gymCircleSpacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const gymCircleRadii = {
  xs: 10,
  sm: 14,
  base: 18,
  md: 20,
  lg: 24,
  xl: 28,
  "2xl": 32,
  "3xl": 40,
  full: 999,
} as const;

export const gymCircleTypography = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif',
  hero: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: 850,
  },
  display: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: 800,
  },
  largeTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 750,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 760,
  },
  headline: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 500,
  },
  callout: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: 650,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 600,
  },
  micro: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 750,
  },
  number: {
    fontSize: 48,
    lineHeight: 48,
    fontWeight: 860,
  },
} as const;

export const gymCircleMotion = {
  duration: {
    instant: "90ms",
    fast: "140ms",
    base: "220ms",
    expressive: "320ms",
    slow: "420ms",
  },
  easing: {
    ios: "cubic-bezier(0.2, 0.9, 0.2, 1)",
    spring: "cubic-bezier(0.16, 1, 0.3, 1)",
    snap: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  scale: {
    pressed: 0.975,
    lifted: 1.015,
  },
} as const;

export const gymCircleShadows = {
  hairline: "inset 0 1px 0 rgba(255,255,255,0.08)",
  card: "0 18px 48px rgba(0,0,0,0.42)",
  cardLarge: "0 28px 72px rgba(0,0,0,0.56)",
  floating: "0 18px 40px rgba(0,0,0,0.42), 0 0 30px rgba(92,232,255,0.2)",
  glowBrand: "0 0 34px rgba(92,232,255,0.38)",
  glowConsistency: "0 0 30px rgba(48,213,255,0.30)",
  glowEnergy: "0 0 28px rgba(140,251,255,0.24)",
  glowBlue: "0 0 28px rgba(48,213,255,0.22)",
  glowPink: "0 0 28px rgba(255,45,85,0.22)",
  glowGreen: "0 0 28px rgba(48,213,255,0.24)",
} as const;

export const gymCircleTokens = {
  colors: gymCircleColors,
  spacing: gymCircleSpacing,
  radii: gymCircleRadii,
  typography: gymCircleTypography,
  motion: gymCircleMotion,
  shadows: gymCircleShadows,
} as const;

export type GymCircleTokens = typeof gymCircleTokens;

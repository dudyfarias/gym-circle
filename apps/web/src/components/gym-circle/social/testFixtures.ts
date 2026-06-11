import type { EnrichedUser } from "./types";

/**
 * Sprint 16 — fixture compartilhada de EnrichedUser pros testes.
 *
 * Antes cada suíte montava o user na mão e TODA evolução do tipo (Sprint
 * 3.5 workoutsThisWeek, 5.5 monthlyRecapCovers, 7C contextualHintsSeen,
 * 7.5 featuredAchievements…) quebrava 4 arquivos de teste — foi assim que
 * o baseline de 20 erros de tsc nasceu e virou ruído permanente. Um único
 * builder = um único lugar pra atualizar quando o tipo crescer.
 *
 * Defaults retratam um user novo/neutro; sobrescreva só o que o teste
 * exercita.
 */
export function makeEnrichedUser(
  overrides: Partial<EnrichedUser> & Pick<EnrichedUser, "id" | "username">,
): EnrichedUser {
  return {
    name: overrides.username,
    accent: "#30D5FF",
    avatarUrl: null,
    bio: "",
    goal: "",
    location: "",
    gyms: [],
    preferredTimes: [],
    currentStreak: 0,
    longestStreak: 0,
    lastWorkoutDate: "",
    workoutsThisWeek: 0,
    workoutsThisMonth: 0,
    activeDaysCount: 0,
    streakRestoresAvailable: 0,
    checkInsCount: 0,
    achievements: [],
    followersCount: 0,
    followingCount: 0,
    isFollowing: false,
    followStatus: "none",
    isPrivate: false,
    workoutDays: [],
    streakLitToday: false,
    streakPresenceSource: "none",
    ...overrides,
  };
}

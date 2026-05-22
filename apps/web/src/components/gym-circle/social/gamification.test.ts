import { describe, expect, it } from "vitest";
import {
  countEarnedBadges,
  getEarnedBadges,
  getNextBadge,
} from "./gamification";
import type { EnrichedUser } from "./types";

function makeUser(overrides: Partial<EnrichedUser> = {}): EnrichedUser {
  return {
    id: "user-test",
    name: "Test User",
    username: "test",
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
  } satisfies EnrichedUser;
}

describe("getEarnedBadges — Sprint 3.5.3", () => {
  it("retorna 11 badges sempre (todos bloqueados por padrão)", () => {
    const badges = getEarnedBadges({ user: makeUser(), postsCount: 0 });
    expect(badges).toHaveLength(11);
    expect(badges.every((b) => !b.earned)).toBe(true);
  });

  it("desbloqueia first-workout quando há pelo menos 1 post", () => {
    const badges = getEarnedBadges({ user: makeUser(), postsCount: 1 });
    expect(badges.find((b) => b.id === "first-workout")?.earned).toBe(true);
  });

  it("desbloqueia streaks na ordem 3 → 7 → 14 → 30 baseado em longestStreak", () => {
    const badges6 = getEarnedBadges({
      user: makeUser({ longestStreak: 6 }),
      postsCount: 0,
    });
    expect(badges6.find((b) => b.id === "streak-3")?.earned).toBe(true);
    expect(badges6.find((b) => b.id === "streak-7")?.earned).toBe(false);

    const badges14 = getEarnedBadges({
      user: makeUser({ longestStreak: 14 }),
      postsCount: 0,
    });
    expect(badges14.find((b) => b.id === "streak-3")?.earned).toBe(true);
    expect(badges14.find((b) => b.id === "streak-7")?.earned).toBe(true);
    expect(badges14.find((b) => b.id === "streak-14")?.earned).toBe(true);
    expect(badges14.find((b) => b.id === "streak-30")?.earned).toBe(false);
  });

  it("desbloqueia active-week com workoutsThisWeek >= 5", () => {
    const badges = getEarnedBadges({
      user: makeUser({ workoutsThisWeek: 5 }),
      postsCount: 0,
    });
    expect(badges.find((b) => b.id === "active-week")?.earned).toBe(true);
  });

  it("desbloqueia month-active com workoutsThisMonth >= 15", () => {
    const badges = getEarnedBadges({
      user: makeUser({ workoutsThisMonth: 15 }),
      postsCount: 0,
    });
    expect(badges.find((b) => b.id === "month-active")?.earned).toBe(true);
  });

  it("desbloqueia year-active com activeDaysCount >= 100", () => {
    const badges = getEarnedBadges({
      user: makeUser({ activeDaysCount: 100 }),
      postsCount: 0,
    });
    expect(badges.find((b) => b.id === "year-active")?.earned).toBe(true);
  });

  it("desbloqueia social (>=10) e popular (>=50) por followersCount", () => {
    const badges30 = getEarnedBadges({
      user: makeUser({ followersCount: 30 }),
      postsCount: 0,
    });
    expect(badges30.find((b) => b.id === "social")?.earned).toBe(true);
    expect(badges30.find((b) => b.id === "popular")?.earned).toBe(false);

    const badges60 = getEarnedBadges({
      user: makeUser({ followersCount: 60 }),
      postsCount: 0,
    });
    expect(badges60.find((b) => b.id === "social")?.earned).toBe(true);
    expect(badges60.find((b) => b.id === "popular")?.earned).toBe(true);
  });

  it("desbloqueia streak-recovered apenas quando hasUsedStreakRestore=true", () => {
    const badgesFalse = getEarnedBadges({
      user: makeUser(),
      postsCount: 0,
      hasUsedStreakRestore: false,
    });
    expect(badgesFalse.find((b) => b.id === "streak-recovered")?.earned).toBe(
      false,
    );

    const badgesTrue = getEarnedBadges({
      user: makeUser(),
      postsCount: 0,
      hasUsedStreakRestore: true,
    });
    expect(badgesTrue.find((b) => b.id === "streak-recovered")?.earned).toBe(
      true,
    );
  });

  it("Johnny (cenário 141d streak + 21 mês) desbloqueia tudo exceto popular/social/streak-recovered se aplicável", () => {
    const johnny = makeUser({
      currentStreak: 141,
      longestStreak: 141,
      workoutsThisWeek: 5, // semana atual: seg-qui
      workoutsThisMonth: 21,
      activeDaysCount: 141,
      followersCount: 5, // hipotético
    });
    const badges = getEarnedBadges({
      user: johnny,
      postsCount: 50,
      hasUsedStreakRestore: false,
    });
    const earnedIds = badges.filter((b) => b.earned).map((b) => b.id);
    expect(earnedIds).toContain("first-workout");
    expect(earnedIds).toContain("streak-3");
    expect(earnedIds).toContain("streak-7");
    expect(earnedIds).toContain("streak-14");
    expect(earnedIds).toContain("streak-30");
    expect(earnedIds).toContain("active-week");
    expect(earnedIds).toContain("month-active");
    expect(earnedIds).toContain("year-active");
    expect(earnedIds).not.toContain("social"); // 5 < 10
    expect(earnedIds).not.toContain("popular");
    expect(earnedIds).not.toContain("streak-recovered");
  });
});

describe("countEarnedBadges", () => {
  it("conta corretamente quantos badges foram conquistados", () => {
    const badges = getEarnedBadges({
      user: makeUser({ longestStreak: 7, followersCount: 12 }),
      postsCount: 3,
    });
    // first-workout (post>=1) + streak-3 + streak-7 + social (followers>=10) = 4
    expect(countEarnedBadges(badges)).toBe(4);
  });

  it("retorna 0 quando nenhum badge ganho", () => {
    const badges = getEarnedBadges({ user: makeUser(), postsCount: 0 });
    expect(countEarnedBadges(badges)).toBe(0);
  });
});

describe("getNextBadge", () => {
  it("retorna o primeiro badge bloqueado da lista", () => {
    const badges = getEarnedBadges({
      user: makeUser({ longestStreak: 4 }),
      postsCount: 1,
    });
    // first-workout ✓, streak-3 ✓ — próximo é streak-7
    const next = getNextBadge(badges);
    expect(next?.id).toBe("streak-7");
  });

  it("retorna null quando todos os badges foram conquistados", () => {
    const fully = makeUser({
      currentStreak: 200,
      longestStreak: 200,
      workoutsThisWeek: 7,
      workoutsThisMonth: 31,
      activeDaysCount: 200,
      followersCount: 100,
    });
    const badges = getEarnedBadges({
      user: fully,
      postsCount: 100,
      hasUsedStreakRestore: true,
    });
    expect(getNextBadge(badges)).toBeNull();
  });
});

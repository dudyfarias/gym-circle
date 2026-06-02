import { describe, expect, it } from "vitest";
import {
  countEarnedBadges,
  getEarnedBadges,
  getNextBadge,
  type GamificationPostSnapshot,
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

/**
 * Helper pra montar um post snapshot com hour específica em LOCAL time.
 * Usa data recente (poucas horas atrás) pra evitar problemas de timezone
 * em testes que precisam estar "dentro da janela".
 */
function makePostAt(hour: number, daysAgo = 0, overrides: Partial<GamificationPostSnapshot> = {}): GamificationPostSnapshot {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 0, 0, 0);
  return {
    createdAt: date.toISOString(),
    workoutType: "Musculação",
    gymId: "gym-1",
    ...overrides,
  };
}

describe("getEarnedBadges — Sprint 5.3 rich badges", () => {
  it("retorna 20 badges sempre (11 originais + 9 novas)", () => {
    const badges = getEarnedBadges({ user: makeUser(), postsCount: 0 });
    expect(badges).toHaveLength(20);
    expect(badges.every((b) => !b.earned)).toBe(true);
  });

  it("cada badge tem iconKey definido", () => {
    const badges = getEarnedBadges({ user: makeUser(), postsCount: 0 });
    expect(badges.every((b) => typeof b.iconKey === "string")).toBe(true);
  });

  it("4 badges secret estão presentes e bloqueadas por padrão", () => {
    const badges = getEarnedBadges({ user: makeUser(), postsCount: 0 });
    const secretIds = badges.filter((b) => b.secret).map((b) => b.id).sort();
    expect(secretIds).toEqual(["cross-trainer", "early-bird", "explorer", "night-owl"]);
    expect(badges.filter((b) => b.secret).every((b) => !b.earned)).toBe(true);
  });

  it("desbloqueia first-workout quando há pelo menos 1 post", () => {
    const badges = getEarnedBadges({ user: makeUser(), postsCount: 1 });
    expect(badges.find((b) => b.id === "first-workout")?.earned).toBe(true);
  });

  it("streak ladder completo: 3, 7, 14, 30, 60, 100", () => {
    const longest150 = makeUser({ longestStreak: 150 });
    const badges = getEarnedBadges({ user: longest150, postsCount: 0 });
    const streakIds = ["streak-3", "streak-7", "streak-14", "streak-30", "streak-60", "streak-100"];
    for (const id of streakIds) {
      expect(badges.find((b) => b.id === id)?.earned).toBe(true);
    }
  });

  it("badges com progress mostram current/target quando não-earned", () => {
    const badges = getEarnedBadges({
      user: makeUser({ longestStreak: 5 }),
      postsCount: 0,
    });
    const streak7 = badges.find((b) => b.id === "streak-7");
    expect(streak7?.earned).toBe(false);
    expect(streak7?.progress).toEqual({ current: 5, target: 7 });

    // Earned badge não tem progress
    const streak3 = badges.find((b) => b.id === "streak-3");
    expect(streak3?.earned).toBe(true);
    expect(streak3?.progress).toBeUndefined();
  });

  it("desbloqueia followers ladder: social → popular → network → community", () => {
    const badges250 = getEarnedBadges({
      user: makeUser({ followersCount: 250 }),
      postsCount: 0,
    });
    expect(badges250.find((b) => b.id === "social")?.earned).toBe(true);
    expect(badges250.find((b) => b.id === "popular")?.earned).toBe(true);
    expect(badges250.find((b) => b.id === "network")?.earned).toBe(true);
    expect(badges250.find((b) => b.id === "community")?.earned).toBe(true);
  });

  it("desbloqueia prolific com 50+ posts", () => {
    const badges = getEarnedBadges({ user: makeUser(), postsCount: 50 });
    expect(badges.find((b) => b.id === "prolific")?.earned).toBe(true);
  });

  it("desbloqueia streak-recovered apenas quando hasUsedStreakRestore=true", () => {
    const badges = getEarnedBadges({
      user: makeUser(),
      postsCount: 0,
      hasUsedStreakRestore: true,
    });
    expect(badges.find((b) => b.id === "streak-recovered")?.earned).toBe(true);
  });
});

describe("getEarnedBadges — Secret badges (Sprint 5.3)", () => {
  it("early-bird desbloqueia com post entre 5h e 7h", () => {
    const posts = [makePostAt(5)];
    const badges = getEarnedBadges({ user: makeUser(), postsCount: 1, posts });
    expect(badges.find((b) => b.id === "early-bird")?.earned).toBe(true);
  });

  it("early-bird NÃO desbloqueia com post às 8h", () => {
    const posts = [makePostAt(8)];
    const badges = getEarnedBadges({ user: makeUser(), postsCount: 1, posts });
    expect(badges.find((b) => b.id === "early-bird")?.earned).toBe(false);
  });

  it("night-owl desbloqueia com post depois das 23h", () => {
    const posts = [makePostAt(23)];
    const badges = getEarnedBadges({ user: makeUser(), postsCount: 1, posts });
    expect(badges.find((b) => b.id === "night-owl")?.earned).toBe(true);
  });

  it("cross-trainer desbloqueia com 3+ workout types em 7 dias", () => {
    const posts: GamificationPostSnapshot[] = [
      makePostAt(10, 0, { workoutType: "Musculação" }),
      makePostAt(10, 2, { workoutType: "Corrida" }),
      makePostAt(10, 4, { workoutType: "Bike" }),
    ];
    const badges = getEarnedBadges({ user: makeUser(), postsCount: 3, posts });
    expect(badges.find((b) => b.id === "cross-trainer")?.earned).toBe(true);
  });

  it("cross-trainer NÃO desbloqueia com só 2 workout types", () => {
    const posts: GamificationPostSnapshot[] = [
      makePostAt(10, 0, { workoutType: "Musculação" }),
      makePostAt(10, 2, { workoutType: "Corrida" }),
      makePostAt(10, 3, { workoutType: "Musculação" }),
    ];
    const badges = getEarnedBadges({ user: makeUser(), postsCount: 3, posts });
    expect(badges.find((b) => b.id === "cross-trainer")?.earned).toBe(false);
  });

  it("explorer desbloqueia com 5+ academias diferentes em 30 dias", () => {
    const posts: GamificationPostSnapshot[] = Array.from({ length: 5 }, (_, i) =>
      makePostAt(10, i * 2, { gymId: `gym-${i}` }),
    );
    const badges = getEarnedBadges({ user: makeUser(), postsCount: 5, posts });
    expect(badges.find((b) => b.id === "explorer")?.earned).toBe(true);
  });

  it("explorer NÃO desbloqueia com 4 academias", () => {
    const posts: GamificationPostSnapshot[] = Array.from({ length: 4 }, (_, i) =>
      makePostAt(10, i, { gymId: `gym-${i}` }),
    );
    const badges = getEarnedBadges({ user: makeUser(), postsCount: 4, posts });
    expect(badges.find((b) => b.id === "explorer")?.earned).toBe(false);
  });

  it("secret badges permanecem locked quando posts não é fornecido", () => {
    const badges = getEarnedBadges({ user: makeUser(), postsCount: 10 });
    const secrets = badges.filter((b) => b.secret);
    expect(secrets.every((b) => !b.earned)).toBe(true);
  });
});

describe("countEarnedBadges", () => {
  it("conta corretamente quantos badges foram conquistados", () => {
    const badges = getEarnedBadges({
      user: makeUser({ longestStreak: 7, followersCount: 12 }),
      postsCount: 3,
    });
    // first-workout + streak-3 + streak-7 + social = 4
    expect(countEarnedBadges(badges)).toBe(4);
  });

  it("retorna 0 quando nenhum badge ganho", () => {
    const badges = getEarnedBadges({ user: makeUser(), postsCount: 0 });
    expect(countEarnedBadges(badges)).toBe(0);
  });
});

describe("getNextBadge — Sprint 5.3 prioriza por proximidade", () => {
  it("retorna o badge com progress mais próximo de 100%", () => {
    // longestStreak 5: streak-7 = 71%, streak-14 = 36%, streak-30 = 17%
    const badges = getEarnedBadges({
      user: makeUser({ longestStreak: 5 }),
      postsCount: 1,
    });
    const next = getNextBadge(badges);
    expect(next?.id).toBe("streak-7");
  });

  it("ignora secret badges (mesmo earned ou locked)", () => {
    // Mesmo se secret badges fossem 'próximos', getNextBadge retorna público.
    const badges = getEarnedBadges({ user: makeUser(), postsCount: 1 });
    const next = getNextBadge(badges);
    expect(next?.secret).toBeFalsy();
  });

  it("retorna null quando todos os badges públicos foram conquistados", () => {
    const fully = makeUser({
      currentStreak: 200,
      longestStreak: 200,
      workoutsThisWeek: 7,
      workoutsThisMonth: 31,
      activeDaysCount: 200,
      followersCount: 250, // unlock community
    });
    const badges = getEarnedBadges({
      user: fully,
      postsCount: 100,
      hasUsedStreakRestore: true,
    });
    expect(getNextBadge(badges)).toBeNull();
  });
});

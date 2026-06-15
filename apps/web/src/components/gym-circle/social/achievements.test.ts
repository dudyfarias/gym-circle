import { describe, expect, it } from "vitest";
import {
  countEarnedAchievements,
  getAchievementCompositeId,
  getAllAchievements,
  getNextAchievement,
  parseAchievementCompositeId,
  suggestFeaturedAchievements,
  type Achievement,
} from "./achievements";
import type { EnrichedUser } from "./types";

const baseUser = {
  id: "u1",
  name: "Eduardo",
  username: "edu.fit",
  accent: "var(--gc-brand)",
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
} satisfies EnrichedUser;

describe("Sprint 7.5 — Achievement system", () => {
  describe("getAllAchievements", () => {
    it("cobre as 5 categorias mesmo com user zerado", () => {
      const all = getAllAchievements({ user: baseUser, postsCount: 0 });
      const kinds = new Set(all.map((a) => a.kind));
      // challenges só aparecem se monthlyChallenges é passado
      expect(kinds).toContain("badge");
      expect(kinds).toContain("medal");
      expect(kinds).toContain("trophy");
      expect(kinds).toContain("relic");
      expect(kinds.has("challenge")).toBe(false);
    });

    it("badges com first-workout não-earned quando postsCount=0", () => {
      const all = getAllAchievements({ user: baseUser, postsCount: 0 });
      const fw = all.find((a) => a.id === "first-workout");
      expect(fw?.earned).toBe(false);
    });

    it("badges com first-workout earned quando postsCount>=1", () => {
      const all = getAllAchievements({ user: baseUser, postsCount: 1 });
      const fw = all.find((a) => a.id === "first-workout");
      expect(fw?.earned).toBe(true);
    });

    it("medals streak-3 progress reflete longest streak", () => {
      const all = getAllAchievements({
        user: { ...baseUser, longestStreak: 2 },
        postsCount: 0,
      });
      const m = all.find((a) => a.kind === "medal" && a.id === "streak-3");
      expect(m?.earned).toBe(false);
      expect(m?.progress).toEqual({ current: 2, target: 3 });
    });

    it("relic unbreakable só earn em 100+ streak", () => {
      const at99 = getAllAchievements({
        user: { ...baseUser, longestStreak: 99 },
        postsCount: 0,
      });
      const at100 = getAllAchievements({
        user: { ...baseUser, longestStreak: 100 },
        postsCount: 0,
      });
      expect(at99.find((a) => a.id === "unbreakable")?.earned).toBe(false);
      expect(at100.find((a) => a.id === "unbreakable")?.earned).toBe(true);
    });

    it("secret badges (madrugador/coruja/versátil) só com posts param", () => {
      const semPosts = getAllAchievements({ user: baseUser, postsCount: 5 });
      const earlyBird = semPosts.find((a) => a.id === "early-bird");
      expect(earlyBird?.earned).toBe(false);

      const comPosts = getAllAchievements({
        user: baseUser,
        postsCount: 5,
        posts: [
          {
            // 6h → entre 5-7
            createdAt: new Date(new Date().setHours(6, 0, 0, 0)).toISOString(),
            workoutType: "Força",
          },
        ],
      });
      const earlyBird2 = comPosts.find((a) => a.id === "early-bird");
      expect(earlyBird2?.earned).toBe(true);
    });

    it("incluir challenges quando monthlyChallenges fornecidos", () => {
      const all = getAllAchievements({
        user: baseUser,
        postsCount: 0,
        monthlyChallenges: [
          {
            id: "projeto-verao-easy",
            periodKey: "2026-06",
            title: "Projeto Verão",
            description: "Treine 20 dias em junho.",
            rarity: "common",
            goalTarget: 20,
            trophyId: "trophy:projeto-verao-2026-06",
            progress: 10,
            completedAt: null,
          },
        ],
      });
      const challenge = all.find((a) => a.kind === "challenge");
      expect(challenge).toBeDefined();
      expect(challenge?.earned).toBe(false);
      expect(challenge?.progress).toEqual({ current: 10, target: 20 });
    });
  });

  describe("getAchievementCompositeId / parse", () => {
    it("encoda kind+id pra string composite", () => {
      const achievement: Achievement = {
        kind: "trophy",
        id: "perfect-month",
        label: "x",
        description: "",
        earned: true,
        iconKey: "trophy",
      };
      expect(getAchievementCompositeId(achievement)).toBe("trophy:perfect-month");
    });

    it("challenges incluem periodKey no composite ID", () => {
      const achievement: Achievement = {
        kind: "challenge",
        id: "projeto-verao",
        periodKey: "2026-06",
        label: "x",
        description: "",
        earned: false,
        iconKey: "trophy",
      };
      expect(getAchievementCompositeId(achievement)).toBe(
        "challenge:2026-06:projeto-verao",
      );
    });

    it("decoda composite ID de volta", () => {
      expect(parseAchievementCompositeId("badge:first-workout")).toEqual({
        kind: "badge",
        id: "first-workout",
      });
      expect(parseAchievementCompositeId("challenge:2026-06:projeto-verao")).toEqual({
        kind: "challenge",
        periodKey: "2026-06",
        id: "projeto-verao",
      });
    });

    it("retorna null pra composite ID malformado", () => {
      expect(parseAchievementCompositeId("invalid")).toBe(null);
    });
  });

  describe("getNextAchievement", () => {
    it("prioriza achievement com maior progresso proporcional", () => {
      const all = getAllAchievements({
        user: { ...baseUser, longestStreak: 12 }, // 12/14 = 86% pra streak-14
        postsCount: 1, // 1/50 = 2% pra workouts-50
      });
      const next = getNextAchievement(all);
      expect(next?.id).toBe("streak-14");
    });

    it("filtra por kind quando opcional", () => {
      const all = getAllAchievements({
        user: { ...baseUser, longestStreak: 12 },
        postsCount: 1,
      });
      const nextTrophy = getNextAchievement(all, { kind: "trophy" });
      expect(nextTrophy?.kind).toBe("trophy");
    });

    it("ignora secrets quando ainda não earned", () => {
      const all = getAllAchievements({ user: baseUser, postsCount: 0 });
      const next = getNextAchievement(all);
      expect(next?.secret).not.toBe(true);
    });
  });

  describe("countEarnedAchievements", () => {
    it("conta corretamente", () => {
      const all = getAllAchievements({
        user: { ...baseUser, longestStreak: 10 },
        postsCount: 5,
      });
      const earned = countEarnedAchievements(all);
      // earned: first-workout (postsCount>=1), streak-3 (10>=3), streak-7 (10>=7)
      expect(earned).toBeGreaterThanOrEqual(3);
    });
  });

  describe("suggestFeaturedAchievements", () => {
    it("prioriza Relic > Trophy > Medal > Badge na ordem", () => {
      const all = getAllAchievements({
        user: { ...baseUser, longestStreak: 100, followersCount: 50 },
        postsCount: 1,
      });
      const featured = suggestFeaturedAchievements(all, 3);
      expect(featured.length).toBeGreaterThan(0);
      // Primeiro deve ser relic (unbreakable está earned)
      expect(featured[0]?.kind).toBe("relic");
    });

    it("retorna no máximo N items", () => {
      const all = getAllAchievements({
        user: { ...baseUser, longestStreak: 100 },
        postsCount: 1,
      });
      const featured = suggestFeaturedAchievements(all, 2);
      expect(featured.length).toBeLessThanOrEqual(2);
    });
  });
});

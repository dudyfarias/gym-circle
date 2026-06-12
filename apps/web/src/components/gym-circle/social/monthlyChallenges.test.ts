import { describe, expect, it } from "vitest";
import {
  recomputeChallengeProgress,
  type ChallengePostSnapshot,
  type MonthlyChallengeData,
} from "./monthlyChallenges";

/**
 * Testes do recompute de desafios mensais — cobre o fix dos desafios que
 * não desbloqueavam:
 *   1. group_workouts: treino a dois (1 participante accepted) agora conta
 *      (antes exigia 2+ accepted = 3 pessoas).
 *   2. workout_type_specific / distinct_types: tags adicionais da Sprint 13
 *      (workout_types array) agora contam, não só a tag primária.
 */

function makeChallenge(
  overrides: Partial<MonthlyChallengeData>,
): MonthlyChallengeData {
  return {
    id: "ch-1",
    periodKey: "2026-06",
    title: "Teste",
    description: "Desc",
    difficulty: "easy",
    goalKind: "workouts_in_month",
    goalTarget: 3,
    trophyId: "trophy-1",
    progress: 0,
    completedAt: null,
    isSecret: false,
    goalConfig: {},
    ...overrides,
  };
}

function post(
  overrides: Partial<ChallengePostSnapshot>,
): ChallengePostSnapshot {
  return { workoutDate: "2026-06-05", workoutType: null, ...overrides };
}

describe("recomputeChallengeProgress", () => {
  describe("workouts_in_month", () => {
    it("conta dias distintos só do período", () => {
      const challenge = makeChallenge({ goalKind: "workouts_in_month" });
      const result = recomputeChallengeProgress(challenge, {
        workoutDays: ["2026-06-01", "2026-06-01", "2026-06-04", "2026-05-30"],
        posts: [],
      });
      expect(result.progress).toBe(2);
      expect(result.justCompleted).toBe(false);
    });
  });

  describe("group_workouts", () => {
    it("treino a dois conta: 1 participante accepted já é grupo", () => {
      const challenge = makeChallenge({
        goalKind: "group_workouts",
        goalTarget: 2,
      });
      const result = recomputeChallengeProgress(challenge, {
        workoutDays: [],
        posts: [
          post({ hasAcceptedGroup: true }),
          post({ workoutDate: "2026-06-08", hasAcceptedGroup: true }),
          post({ workoutDate: "2026-06-09", hasAcceptedGroup: false }),
        ],
      });
      expect(result.progress).toBe(2);
      expect(result.justCompleted).toBe(true);
    });

    it("post sem participante accepted não conta", () => {
      const challenge = makeChallenge({
        goalKind: "group_workouts",
        goalTarget: 1,
      });
      const result = recomputeChallengeProgress(challenge, {
        workoutDays: [],
        posts: [post({}), post({ hasAcceptedGroup: false })],
      });
      expect(result.progress).toBe(0);
      expect(result.justCompleted).toBe(false);
    });
  });

  describe("workout_type_specific", () => {
    const tennis = makeChallenge({
      goalKind: "workout_type_specific",
      goalTarget: 2,
      goalConfig: { workout_type: "tenis" },
    });

    it("tag primária com acento dá match (Tênis ↔ tenis)", () => {
      const result = recomputeChallengeProgress(tennis, {
        workoutDays: [],
        posts: [
          post({ workoutType: "Tênis" }),
          post({ workoutType: "Musculação" }),
        ],
      });
      expect(result.progress).toBe(1);
    });

    it("tag adicional (Sprint 13) também conta", () => {
      const result = recomputeChallengeProgress(tennis, {
        workoutDays: [],
        posts: [
          post({
            workoutType: "Musculação",
            workoutTypes: ["Musculação", "Tênis"],
          }),
          post({ workoutType: "Tênis" }),
        ],
      });
      expect(result.progress).toBe(2);
      expect(result.justCompleted).toBe(true);
    });

    it("post fora do período não conta", () => {
      const result = recomputeChallengeProgress(tennis, {
        workoutDays: [],
        posts: [post({ workoutDate: "2026-05-20", workoutType: "Tênis" })],
      });
      expect(result.progress).toBe(0);
    });
  });

  describe("distinct_types", () => {
    it("une tag primária + adicionais, deduplica normalizado", () => {
      const challenge = makeChallenge({
        goalKind: "distinct_types",
        goalTarget: 4,
      });
      const result = recomputeChallengeProgress(challenge, {
        workoutDays: [],
        posts: [
          // primária Sauna + tag extra Musculação → 2 tipos
          post({ workoutType: "Sauna", workoutTypes: ["Sauna", "Musculação"] }),
          // "musculacao" sem acento = mesmo tipo, não duplica
          post({ workoutType: "musculacao" }),
          post({ workoutType: "Cardio" }),
          post({ workoutType: "Corrida" }),
        ],
      });
      expect(result.progress).toBe(4);
      expect(result.justCompleted).toBe(true);
    });
  });

  describe("streak_in_month (Sprint 17 — B4)", () => {
    it("conta a maior sequência de dias consecutivos do período", () => {
      const challenge = makeChallenge({
        goalKind: "streak_in_month",
        goalTarget: 3,
      });
      const result = recomputeChallengeProgress(challenge, {
        // 01-02 (2) · gap · 04-05-06 (3) · fora do período ignorado
        workoutDays: [
          "2026-06-01",
          "2026-06-02",
          "2026-06-04",
          "2026-06-05",
          "2026-06-06",
          "2026-05-31",
        ],
        posts: [],
      });
      expect(result.progress).toBe(3);
      expect(result.justCompleted).toBe(true);
    });

    it("dia único conta como sequência 1; duplicatas não inflam", () => {
      const challenge = makeChallenge({
        goalKind: "streak_in_month",
        goalTarget: 5,
      });
      const result = recomputeChallengeProgress(challenge, {
        workoutDays: ["2026-06-10", "2026-06-10", "2026-06-12"],
        posts: [],
      });
      expect(result.progress).toBe(1);
    });
  });

  describe("perfect_month (Sprint 17 — B4)", () => {
    it("conta dias distintos; completa só quando atinge o target (nº de dias do mês)", () => {
      const challenge = makeChallenge({
        goalKind: "perfect_month",
        goalTarget: 30,
        progress: 0,
      });
      const result = recomputeChallengeProgress(challenge, {
        workoutDays: ["2026-06-01", "2026-06-02", "2026-06-03"],
        posts: [],
      });
      expect(result.progress).toBe(3);
      expect(result.justCompleted).toBe(false);
    });
  });

  describe("completion", () => {
    it("não re-completa desafio já completado", () => {
      const challenge = makeChallenge({
        goalKind: "workouts_in_month",
        goalTarget: 1,
        progress: 1,
        completedAt: "2026-06-02T12:00:00Z",
      });
      const result = recomputeChallengeProgress(challenge, {
        workoutDays: ["2026-06-01", "2026-06-02"],
        posts: [],
      });
      expect(result.progress).toBe(2);
      expect(result.justCompleted).toBe(false);
    });

    it("goal kind desconhecido preserva progress atual", () => {
      // Sprint 17 implementou streak_in_month/perfect_month — o "kind
      // desconhecido" do teste agora é um hipotético futuro.
      const challenge = makeChallenge({
        goalKind: "some_future_kind",
        goalTarget: 31,
        progress: 7,
      });
      const result = recomputeChallengeProgress(challenge, {
        workoutDays: ["2026-06-01"],
        posts: [],
      });
      expect(result.progress).toBe(7);
      expect(result.justCompleted).toBe(false);
    });
  });
});

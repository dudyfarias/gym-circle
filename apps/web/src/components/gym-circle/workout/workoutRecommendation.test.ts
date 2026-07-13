import { describe, expect, it } from "vitest";
import {
  buildWorkoutRecommendation,
  type WorkoutRecommendationHistoryItem,
  type WorkoutRecommendationPlan,
} from "./workoutRecommendation";

const plans: WorkoutRecommendationPlan[] = [
  { id: "push", name: "Push", updatedAt: "2026-07-01T10:00:00.000Z" },
  { id: "pull", name: "Pull", updatedAt: "2026-07-02T10:00:00.000Z" },
  { id: "legs", name: "Legs", updatedAt: "2026-07-03T10:00:00.000Z" },
];

function session(
  activityId: string,
  workoutPlanId: string | null,
  workoutDate: string,
): WorkoutRecommendationHistoryItem {
  return { activityId, workoutPlanId, workoutDate };
}

describe("buildWorkoutRecommendation", () => {
  it("prioriza o padrão pessoal do mesmo dia da semana", () => {
    const result = buildWorkoutRecommendation({
      plans,
      today: "2026-07-13", // segunda-feira
      history: [
        session("push-1", "push", "2026-06-22"),
        session("pull-1", "pull", "2026-06-23"),
        session("push-2", "push", "2026-06-29"),
        session("legs-1", "legs", "2026-07-01"),
        session("push-3", "push", "2026-07-06"),
        session("pull-2", "pull", "2026-07-07"),
      ],
    });

    expect(result.recommendation).toMatchObject({
      planId: "push",
      reasonCode: "weekday-pattern",
      evidence: { weekdayUseCount: 3 },
    });
    expect(result.recommendation!.components.weekday).toBe(44);
  });

  it("usa a sequência pessoal quando ela é o sinal mais forte", () => {
    const result = buildWorkoutRecommendation({
      plans,
      today: "2026-07-16",
      history: [
        session("push-1", "push", "2026-06-30"),
        session("pull-1", "pull", "2026-07-01"),
        session("push-2", "push", "2026-07-04"),
        session("pull-2", "pull", "2026-07-05"),
        session("push-3", "push", "2026-07-08"),
      ],
    });

    expect(result.recommendation).toMatchObject({
      planId: "pull",
      reasonCode: "sequence-pattern",
      evidence: { transitionCount: 2 },
    });
    expect(result.recommendation!.components.sequence).toBe(26);
  });

  it("não recomenda automaticamente repetir o treino de ontem", () => {
    const result = buildWorkoutRecommendation({
      plans: [plans[0], plans[1]],
      today: "2026-07-13",
      history: [
        session("push-old", "push", "2026-07-06"),
        session("pull-old", "pull", "2026-07-07"),
        session("push-yesterday", "push", "2026-07-12"),
      ],
    });

    const push = result.rankedPlans.find((plan) => plan.planId === "push")!;
    const pull = result.rankedPlans.find((plan) => plan.planId === "pull")!;
    expect(push.components.recency).toBe(0);
    expect(pull.components.recency).toBe(10);
  });

  it("usa favorito e treino atualizado como fallback sem alegar confiança", () => {
    const result = buildWorkoutRecommendation({
      plans: plans.map((plan) => ({ ...plan, isFavorite: plan.id === "legs" })),
      today: "2026-07-13",
      history: [],
    });

    expect(result.recommendation).toMatchObject({
      planId: "legs",
      confidence: 0.12,
      confidenceLevel: "low",
      reasonCode: "no-history-favorite",
    });
  });

  it("cai no treino atualizado mais recentemente quando não há favorito nem histórico", () => {
    const result = buildWorkoutRecommendation({
      plans,
      today: "2026-07-13",
      history: [],
    });
    expect(result.recommendation).toMatchObject({
      planId: "legs",
      reasonCode: "no-history-recent",
    });
  });

  it("limita a confiança com uma única sessão", () => {
    const result = buildWorkoutRecommendation({
      plans,
      today: "2026-07-13",
      history: [session("only", "push", "2026-07-06")],
    });
    expect(result.recommendation!.confidenceLevel).toBe("low");
    expect(result.recommendation!.confidence).toBeLessThan(0.42);
  });

  it("ignora atividades sem vínculo, datas inválidas e planos apagados", () => {
    const result = buildWorkoutRecommendation({
      plans,
      today: "2026-07-13",
      history: [
        session("unlinked", null, "2026-07-06"),
        session("deleted", "deleted-plan", "2026-07-06"),
        session("invalid", "push", "2026-02-30"),
        session("valid", "push", "2026-07-06"),
      ],
    });
    expect(result.linkedSessionCount).toBe(1);
    expect(result.ignoredSessionCount).toBe(3);
  });

  it("é determinístico inclusive em empates", () => {
    const input = {
      plans: [
        { id: "b", name: "B" },
        { id: "a", name: "A" },
      ],
      today: "2026-07-13",
      history: [session("history", "a", "2026-07-11")],
    };
    const first = buildWorkoutRecommendation(input);
    const second = buildWorkoutRecommendation(input);
    expect(first).toEqual(second);
  });

  it("retorna vazio quando não existem treinos salvos", () => {
    expect(
      buildWorkoutRecommendation({
        plans: [],
        history: [session("ignored", null, "2026-07-13")],
        today: "2026-07-13",
      }),
    ).toEqual({
      recommendation: null,
      rankedPlans: [],
      linkedSessionCount: 0,
      ignoredSessionCount: 1,
    });
  });
});

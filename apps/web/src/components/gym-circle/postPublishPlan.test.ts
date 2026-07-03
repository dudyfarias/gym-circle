import { describe, expect, it } from "vitest";
import { buildWorkoutPublishPlan } from "./postPublishPlan";

describe("buildWorkoutPublishPlan", () => {
  it("mantém o dia da atividade sem tratar a publicação como retroativa", () => {
    expect(
      buildWorkoutPublishPlan({
        sourceActivityId: "activity-1",
        workoutDate: "2026-07-02",
        destinations: { feed: true, story: true },
      }),
    ).toEqual({
      workoutDate: "2026-07-02",
      createdAt: undefined,
      destinations: { feed: true, story: true },
      isManualBackdate: false,
    });
  });

  it("força apenas feed quando o usuário registra um treino retroativo", () => {
    expect(
      buildWorkoutPublishPlan({
        workoutDate: "2026-06-24",
        destinations: { feed: false, story: true },
      }),
    ).toEqual({
      workoutDate: "2026-06-24",
      createdAt: "2026-06-24T12:00:00-03:00",
      destinations: { feed: true, story: false },
      isManualBackdate: true,
    });
  });

  it("usa os destinos padrão em um post comum", () => {
    expect(buildWorkoutPublishPlan({})).toEqual({
      workoutDate: null,
      createdAt: undefined,
      destinations: { feed: true, story: true },
      isManualBackdate: false,
    });
  });
});

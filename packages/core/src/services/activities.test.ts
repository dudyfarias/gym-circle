import { describe, expect, it, vi } from "vitest";
import { activityService } from "./activities";
import type { GymCircleClient } from "./supabase";
import type { ActivityRow } from "../domain/activity";

const baseRow: ActivityRow = {
  id: "a1",
  user_id: "u1",
  activity_type: "strength",
  mode: "session",
  origin: "web_timer",
  source_app: null,
  started_at: "2026-07-02T21:00:00Z",
  ended_at: "2026-07-02T21:58:00Z",
  elapsed_s: 3480,
  moving_s: null,
  distance_m: null,
  elevation_gain_m: null,
  route: null,
  strength_sets: null,
  avg_hr: null,
  max_hr: null,
  active_calories: null,
  total_calories: null,
  workout_date: "2026-07-02",
  created_at: "2026-07-02T21:58:01Z",
};

describe("activityService.create", () => {
  it("finaliza por RPC quando há clientSessionId", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: baseRow, error: null });
    const client = { rpc } as unknown as GymCircleClient;

    const activity = await activityService(client).create("u1", {
      clientSessionId: "00000000-0000-4000-8000-000000000001",
      activityType: "strength",
      mode: "session",
      origin: "web_timer",
      startedAt: "2026-07-02T21:00:00Z",
      endedAt: "2026-07-02T21:58:00Z",
      elapsedS: 3480,
    });

    expect(rpc).toHaveBeenCalledWith("finalize_workout_activity", {
      p_client_session_id: "00000000-0000-4000-8000-000000000001",
      p_payload: expect.objectContaining({
        user_id: "u1",
        activity_type: "strength",
      }),
    });
    expect(activity.id).toBe("a1");
  });

  it.each([
    ["strength", "session", null],
    ["run", "route", []],
    ["walk", "route", []],
    ["ride", "route", []],
    ["other", "session", null],
  ] as const)(
    "omite JSON nulo ao finalizar %s sem plano salvo",
    async (activityType, mode, route) => {
      const rpc = vi.fn().mockResolvedValue({
        data: {
          ...baseRow,
          activity_type: activityType,
          mode,
          route,
        },
        error: null,
      });
      const client = { rpc } as unknown as GymCircleClient;

      await activityService(client).create("u1", {
        clientSessionId: "00000000-0000-4000-8000-000000000002",
        activityType,
        mode,
        origin: "web_timer",
        startedAt: "2026-07-15T13:50:00Z",
        endedAt: "2026-07-15T14:13:00Z",
        elapsedS: 517,
        movingS: 517,
        distanceM: mode === "route" ? 10 : null,
        route,
        strengthSets: null,
        workoutPlanExercisesSnapshot: null,
      });

      const payload = rpc.mock.calls[0]?.[1]?.p_payload;
      expect(payload).toMatchObject({
        activity_type: activityType,
        mode,
      });
      if (route) expect(payload).toHaveProperty("route", []);
      else expect(payload).not.toHaveProperty("route");
      expect(payload).not.toHaveProperty("strength_sets");
      expect(payload).not.toHaveProperty("workout_plan_exercises_snapshot");
    },
  );

  it("preserva snapshots e séries quando há dados", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: baseRow, error: null });
    const client = { rpc } as unknown as GymCircleClient;

    await activityService(client).create("u1", {
      clientSessionId: "00000000-0000-4000-8000-000000000003",
      activityType: "strength",
      mode: "session",
      origin: "web_timer",
      startedAt: "2026-07-15T13:50:00Z",
      endedAt: "2026-07-15T14:13:00Z",
      elapsedS: 517,
      strengthSets: [{ reps: 12, weightKg: 20 }],
      workoutPlanExercisesSnapshot: [{ name: "Supino reto" }],
    });

    const payload = rpc.mock.calls[0]?.[1]?.p_payload;
    expect(payload).toMatchObject({
      strength_sets: [{ reps: 12, weight_kg: 20 }],
      workout_plan_exercises_snapshot: [{ name: "Supino reto" }],
    });
  });

  it("faz fallback temporário se a migration do RPC ainda não chegou", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "function not found" },
    });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: baseRow, error: null }),
      }),
    });
    const client = {
      rpc,
      from: vi.fn().mockReturnValue({ insert }),
    } as unknown as GymCircleClient;

    await activityService(client).create("u1", {
      clientSessionId: "00000000-0000-4000-8000-000000000001",
      activityType: "strength",
      mode: "session",
      origin: "web_timer",
      startedAt: "2026-07-02T21:00:00Z",
      endedAt: "2026-07-02T21:58:00Z",
      elapsedS: 3480,
    });

    expect(insert).toHaveBeenCalledOnce();
  });

  it("não mascara falha real do RPC idempotente", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "42501", message: "rls" },
      }),
    } as unknown as GymCircleClient;

    await expect(
      activityService(client).create("u1", {
        clientSessionId: "00000000-0000-4000-8000-000000000001",
        activityType: "strength",
        mode: "session",
        origin: "web_timer",
        startedAt: "2026-07-02T21:00:00Z",
        endedAt: "2026-07-02T21:58:00Z",
        elapsedS: 3480,
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("insere a row mapeada e devolve o domínio", async () => {
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: baseRow, error: null }),
      }),
    });
    const client = {
      from: vi.fn().mockReturnValue({ insert }),
    } as unknown as GymCircleClient;

    const activity = await activityService(client).create("u1", {
      activityType: "strength",
      mode: "session",
      origin: "web_timer",
      startedAt: "2026-07-02T21:00:00Z",
      endedAt: "2026-07-02T21:58:00Z",
      elapsedS: 3480,
    });

    expect(client.from).toHaveBeenCalledWith("activities");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u1",
        activity_type: "strength",
        origin: "web_timer",
        workout_date: "2026-07-02",
      }),
    );
    expect(activity.id).toBe("a1");
    expect(activity.elapsedS).toBe(3480);
  });

  it("repete uma vez sem health_metadata quando a migration ainda não chegou", async () => {
    const firstSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST204",
        message:
          "Could not find the 'health_metadata' column of 'activities' in the schema cache",
      },
    });
    const secondSingle = vi.fn().mockResolvedValue({
      data: { ...baseRow, origin: "imported", source_app: "Apple Watch" },
      error: null,
    });
    const firstInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: firstSingle }),
    });
    const secondInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: secondSingle }),
    });
    const insert = vi
      .fn()
      .mockImplementationOnce(firstInsert)
      .mockImplementationOnce(secondInsert);
    const client = {
      from: vi.fn().mockReturnValue({ insert }),
    } as unknown as GymCircleClient;

    const activity = await activityService(client).create("u1", {
      activityType: "strength",
      mode: "session",
      origin: "imported",
      externalId: "health-workout-1",
      sourceApp: "Apple Watch",
      startedAt: "2026-07-20T16:59:00Z",
      endedAt: "2026-07-20T17:45:03Z",
      elapsedS: 2763,
      avgHr: 91,
      activeCalories: 222,
      healthMetadata: {
        heartRateSamples: [
          { timestamp: "2026-07-20T17:00:00Z", bpm: 91 },
        ],
      },
    });

    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[0]?.[0]).toHaveProperty("health_metadata");
    expect(insert.mock.calls[1]?.[0]).not.toHaveProperty("health_metadata");
    expect(insert.mock.calls[1]?.[0]).toMatchObject({
      external_id: "health-workout-1",
      avg_hr: 91,
      active_calories: 222,
    });
    expect(activity.origin).toBe("imported");
  });

  it("não repete inserts por outros erros 400", async () => {
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "23514", message: "invalid activity" },
        }),
      }),
    });
    const client = {
      from: vi.fn().mockReturnValue({ insert }),
    } as unknown as GymCircleClient;

    await expect(
      activityService(client).create("u1", {
        activityType: "strength",
        mode: "session",
        origin: "imported",
        startedAt: "2026-07-20T16:59:00Z",
        endedAt: "2026-07-20T17:45:03Z",
        elapsedS: 2763,
      }),
    ).rejects.toMatchObject({ code: "23514" });
    expect(insert).toHaveBeenCalledOnce();
  });

  it("propaga erro do banco", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: null, error: new Error("rls") }),
          }),
        }),
      }),
    } as unknown as GymCircleClient;

    await expect(
      activityService(client).create("u1", {
        activityType: "strength",
        mode: "session",
        origin: "web_timer",
        startedAt: "2026-07-02T21:00:00Z",
        endedAt: "2026-07-02T21:58:00Z",
        elapsedS: 60,
      }),
    ).rejects.toThrow("rls");
  });
});

describe("activityService.detail", () => {
  it("hidrata o detalhe uma vez por activity/post via RPC sob RLS", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ...baseRow,
        origin: "imported",
        source_app: "Apple Watch",
        health_metadata: {
          schema_version: 1,
          workout_effort: 3,
          heart_rate_samples: [
            { timestamp: "2026-07-16T19:47:00.000Z", bpm: 117 },
          ],
        },
      },
      error: null,
    });
    const client = { rpc } as unknown as GymCircleClient;

    const detail = await activityService(client).detail({ postId: "post-1" });

    expect(rpc).toHaveBeenCalledWith("get_activity_detail_v2", {
      p_activity_id: null,
      p_post_id: "post-1",
    });
    expect(detail).toMatchObject({
      origin: "imported",
      sourceApp: "Apple Watch",
      healthMetadata: {
        workoutType: null,
        workoutEffort: 3,
        heartRateSamples: [
          { timestamp: "2026-07-16T19:47:00.000Z", bpm: 117 },
        ],
      },
    });
  });

  it("não faz request sem identificador", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GymCircleClient;
    await expect(activityService(client).detail({})).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("activityService post integration", () => {
  const activityRow = {
    id: "activity-2",
    activity_type: "other",
    elapsed_s: 900,
    moving_s: null,
    distance_m: null,
    elevation_gain_m: null,
    avg_hr: 92,
    total_calories: 80,
    started_at: "2026-07-20T18:00:00Z",
    ended_at: "2026-07-20T18:15:00Z",
  };

  it("hidrata separadamente todos os treinos integrados ao post", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { ...baseRow, id: "activity-1", activity_type: "strength" },
        {
          ...baseRow,
          id: "activity-2",
          activity_type: "other",
          health_metadata: { workout_type: "cardio" },
        },
      ],
      error: null,
    });
    const client = { rpc } as unknown as GymCircleClient;

    const details = await activityService(client).detailsForPost("post-1");

    expect(rpc).toHaveBeenCalledWith("get_post_activity_details", {
      p_post_id: "post-1",
    });
    expect(details).toHaveLength(2);
    expect(details[1]).toMatchObject({
      id: "activity-2",
      healthMetadata: { workoutType: "cardio" },
    });
  });

  it("lista atividades já integradas no post", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [activityRow],
      error: null,
    });
    const client = { rpc } as unknown as GymCircleClient;

    const linked = await activityService(client).linkedToPost("post-1");

    expect(rpc).toHaveBeenCalledWith("get_post_activities", {
      p_post_id: "post-1",
    });
    expect(linked).toEqual([
      expect.objectContaining({
        id: "activity-2",
        activityType: "other",
        elapsedS: 900,
        avgHr: 92,
      }),
    ]);
  });

  it("integra sem enviar dados de usuário pelo client", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = { rpc } as unknown as GymCircleClient;

    await activityService(client).mergeIntoPost("post-1", "activity-2");

    expect(rpc).toHaveBeenCalledWith("merge_activity_into_post", {
      p_post_id: "post-1",
      p_activity_id: "activity-2",
    });
  });
});

describe("activityService.updateWorkoutNotes", () => {
  it("atualiza apenas a activity filtrada e normaliza nota vazia", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const client = { from } as unknown as GymCircleClient;

    await activityService(client).updateWorkoutNotes("activity-1", {
      workoutNote: "  Ótimo treino  ",
    });

    expect(from).toHaveBeenCalledWith("activities");
    expect(update).toHaveBeenCalledWith({ workout_note: "Ótimo treino" });
    expect(eq).toHaveBeenCalledWith("id", "activity-1");
  });
});

describe("activityService.recentForUser", () => {
  it("lista ordenado por started_at desc com limite", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [baseRow], error: null });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const client = {
      from: vi.fn().mockReturnValue({ select }),
    } as unknown as GymCircleClient;

    const list = await activityService(client).recentForUser("u1", 10);

    expect(eq).toHaveBeenCalledWith("user_id", "u1");
    expect(order).toHaveBeenCalledWith("started_at", { ascending: false });
    expect(limit).toHaveBeenCalledWith(10);
    expect(list).toHaveLength(1);
    expect(list[0].userId).toBe("u1");
  });
});

describe("activityService.remove", () => {
  it("apaga a atividade pelo id", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockReturnValue({ eq });
    const client = {
      from: vi.fn().mockReturnValue({ delete: remove }),
    } as unknown as GymCircleClient;

    await activityService(client).remove("a1");

    expect(client.from).toHaveBeenCalledWith("activities");
    expect(remove).toHaveBeenCalledOnce();
    expect(eq).toHaveBeenCalledWith("id", "a1");
  });
});

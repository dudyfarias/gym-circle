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

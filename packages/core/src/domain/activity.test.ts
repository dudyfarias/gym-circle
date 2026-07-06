import { describe, expect, it } from "vitest";
import {
  activityInputToRow,
  activityRowToDomain,
  type ActivityRow,
} from "./activity";

describe("activityInputToRow", () => {
  it("sessão web_timer: só tempo, sem gps/hr", () => {
    const row = activityInputToRow(
      {
        activityType: "strength",
        mode: "session",
        origin: "web_timer",
        startedAt: "2026-07-02T21:00:00Z",
        endedAt: "2026-07-02T21:58:00Z",
        elapsedS: 3480,
      },
      "u1",
    );
    expect(row.user_id).toBe("u1");
    expect(row.origin).toBe("web_timer");
    expect(row.distance_m).toBeNull();
    expect(row.avg_hr).toBeNull();
    expect(row.source_app).toBeNull();
    // 21:00Z = 18:00 em São Paulo → mesmo dia
    expect(row.workout_date).toBe("2026-07-02");
  });

  it("workout_date usa o fuso de São Paulo (madrugada UTC = dia anterior SP)", () => {
    const row = activityInputToRow(
      {
        activityType: "run",
        mode: "route",
        origin: "live",
        startedAt: "2026-07-03T01:30:00Z", // 22:30 de 2/jul em SP
        endedAt: "2026-07-03T02:10:00Z",
        elapsedS: 2400,
      },
      "u1",
    );
    expect(row.workout_date).toBe("2026-07-02");
  });

  it("workoutDate explícito vence o derivado", () => {
    const row = activityInputToRow(
      {
        activityType: "other",
        mode: "session",
        origin: "imported",
        sourceApp: "Strava",
        startedAt: "2026-07-01T10:00:00Z",
        endedAt: "2026-07-01T11:00:00Z",
        elapsedS: 3600,
        workoutDate: "2026-06-30",
        distanceM: 8400,
        avgHr: 154,
      },
      "u2",
    );
    expect(row.workout_date).toBe("2026-06-30");
    expect(row.source_app).toBe("Strava");
    expect(row.distance_m).toBe(8400);
    expect(row.avg_hr).toBe(154);
  });
});

describe("activityRowToDomain", () => {
  it("mapeia snake_case → camelCase 1:1", () => {
    const row: ActivityRow = {
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
      avg_hr: 132,
      max_hr: 168,
      active_calories: 480,
      total_calories: 512,
      workout_date: "2026-07-02",
      created_at: "2026-07-02T21:58:01Z",
    };
    const activity = activityRowToDomain(row);
    expect(activity).toEqual({
      id: "a1",
      userId: "u1",
      activityType: "strength",
      mode: "session",
      origin: "web_timer",
      sourceApp: null,
      startedAt: "2026-07-02T21:00:00Z",
      endedAt: "2026-07-02T21:58:00Z",
      elapsedS: 3480,
      movingS: null,
      distanceM: null,
      elevationGainM: null,
      route: null,
      strengthSets: null,
      avgHr: 132,
      maxHr: 168,
      activeCalories: 480,
      totalCalories: 512,
      workoutDate: "2026-07-02",
      createdAt: "2026-07-02T21:58:01Z",
    });
  });
});

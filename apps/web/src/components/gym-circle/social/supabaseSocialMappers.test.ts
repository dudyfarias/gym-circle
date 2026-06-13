import { describe, expect, it } from "vitest";
import type { PostRow, UserStatsRow } from "@gym-circle/core";
import {
  accentForId,
  deriveAchievements,
  directMessageRowFromPartial,
  feedPostRowFromPostRow,
  mergeRowsByKey,
  mergeStatsArrays,
  mergeUserStatsRow,
  parseJsonValue,
  storyRowFromSurface,
} from "./supabaseSocialMappers";

function makeStats(overrides: Partial<UserStatsRow>): UserStatsRow {
  return {
    user_id: "u1",
    current_streak: 0,
    best_streak: 0,
    workouts_this_month: 0,
    active_days_this_year: 0,
    last_active_date: null,
    badge_is_active_today: false,
    streak_restores_available: null,
    last_streak_restore_used_at: null,
    last_streak_restore_earned_at: null,
    streak_restore_deadline_at: null,
    streak_restore_missed_date: null,
    streak_restore_status: null,
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  } as UserStatsRow;
}

describe("mergeUserStatsRow — Sprint 3.6.1 (partial nunca zera real)", () => {
  it("preserva o MAIOR contador (full não é derrubado por partial=0)", () => {
    const full = makeStats({
      current_streak: 5,
      best_streak: 5,
      workouts_this_month: 11,
      active_days_this_year: 11,
    });
    const partial = makeStats({
      current_streak: 5,
      best_streak: 5,
      workouts_this_month: 0,
      active_days_this_year: 0,
    });
    // Independente da ordem, os contadores reais sobrevivem.
    expect(mergeUserStatsRow(full, partial).workouts_this_month).toBe(11);
    expect(mergeUserStatsRow(partial, full).workouts_this_month).toBe(11);
    expect(mergeUserStatsRow(partial, full).active_days_this_year).toBe(11);
  });

  it("badge_is_active_today é OR (qualquer um aceso = aceso)", () => {
    const lit = makeStats({ badge_is_active_today: true });
    const dark = makeStats({ badge_is_active_today: false });
    expect(mergeUserStatsRow(dark, lit).badge_is_active_today).toBe(true);
    expect(mergeUserStatsRow(lit, dark).badge_is_active_today).toBe(true);
  });

  it("last_active_date prefere o valor não-null do incoming", () => {
    const withDate = makeStats({ last_active_date: "2026-06-12" });
    const noDate = makeStats({ last_active_date: null });
    expect(mergeUserStatsRow(withDate, noDate).last_active_date).toBe("2026-06-12");
  });
});

describe("mergeStatsArrays", () => {
  it("deduplica por user_id mergeando partial + full", () => {
    const partial = makeStats({ user_id: "u1", workouts_this_month: 0 });
    const full = makeStats({ user_id: "u1", workouts_this_month: 9 });
    const other = makeStats({ user_id: "u2", workouts_this_month: 3 });
    const result = mergeStatsArrays([partial], [full, other]);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.user_id === "u1")?.workouts_this_month).toBe(9);
    expect(result.find((r) => r.user_id === "u2")?.workouts_this_month).toBe(3);
  });
});

describe("mergeRowsByKey — last-wins genérico", () => {
  it("o último row vence no conflito de chave", () => {
    const a = { id: "x", v: 1 };
    const b = { id: "x", v: 2 };
    const c = { id: "y", v: 3 };
    const result = mergeRowsByKey([a], [b, c], (r) => r.id);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.id === "x")?.v).toBe(2);
  });
});

describe("accentForId", () => {
  it("é determinístico e sempre retorna uma cor da paleta", () => {
    const first = accentForId("user-abc");
    expect(accentForId("user-abc")).toBe(first);
    expect(first.startsWith("var(--gc-")).toBe(true);
  });
});

describe("deriveAchievements", () => {
  it("retorna [] sem stats", () => {
    expect(deriveAchievements(undefined)).toEqual([]);
  });
  it("classifica streak lendário e marca mês forte + aceso", () => {
    const out = deriveAchievements(
      makeStats({ best_streak: 30, workouts_this_month: 10, badge_is_active_today: true }),
    );
    expect(out[0]).toContain("lendário");
    expect(out).toContain("Mês forte");
    expect(out.length).toBeLessThanOrEqual(3);
  });
});

describe("feedPostRowFromPostRow — guard de location_source", () => {
  it("normaliza location_source inválido pra 'none'", () => {
    const row = {
      id: "p1",
      user_id: "u1",
      image_url: "x.jpg",
      media_type: "image",
      workout_date: "2026-06-12",
      created_at: "2026-06-12T10:00:00.000Z",
      location_source: "lixo",
    } as unknown as PostRow;
    expect(feedPostRowFromPostRow(row).location_source).toBe("none");
  });
  it("mantém location_source válido (gym)", () => {
    const row = {
      id: "p1",
      user_id: "u1",
      image_url: "x.jpg",
      media_type: "video",
      workout_date: "2026-06-12",
      created_at: "2026-06-12T10:00:00.000Z",
      location_source: "gym",
    } as unknown as PostRow;
    const mapped = feedPostRowFromPostRow(row);
    expect(mapped.location_source).toBe("gym");
    expect(mapped.media_type).toBe("video");
  });
});

describe("storyRowFromSurface — guard de campos obrigatórios", () => {
  it("retorna null quando falta media_url/expires_at/created_at", () => {
    expect(storyRowFromSurface({ id: "s1", user_id: "u1" })).toBeNull();
  });
  it("mapeia quando completo, resolvendo id via first_story_id", () => {
    const story = storyRowFromSurface({
      first_story_id: "s9",
      author_id: "u1",
      media_url: "m.jpg",
      media_type: "image",
      expires_at: "2026-06-13T10:00:00.000Z",
      created_at: "2026-06-12T10:00:00.000Z",
    });
    expect(story?.id).toBe("s9");
    expect(story?.user_id).toBe("u1");
  });
});

describe("directMessageRowFromPartial — guard", () => {
  it("retorna null sem id/sender_id/created_at", () => {
    expect(directMessageRowFromPartial({ body: "oi" })).toBeNull();
  });
  it("preenche defaults quando válido", () => {
    const msg = directMessageRowFromPartial({
      id: "m1",
      sender_id: "u1",
      created_at: "2026-06-12T10:00:00.000Z",
      body: "oi",
    });
    expect(msg?.reply_to_story).toBe(false);
    expect(msg?.receiver_id).toBeNull();
  });
});

describe("parseJsonValue", () => {
  it("faz parse de string JSON válida", () => {
    expect(parseJsonValue('{"a":1}', {})).toEqual({ a: 1 });
  });
  it("cai no fallback em JSON inválido", () => {
    expect(parseJsonValue("{quebrado", { ok: true })).toEqual({ ok: true });
  });
  it("retorna o próprio valor quando não é string", () => {
    const obj = { a: 1 };
    expect(parseJsonValue(obj, {})).toBe(obj);
  });
});

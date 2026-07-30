import { describe, expect, it, vi } from "vitest";
import type { GymCircleClient } from "./supabase";
import { runningLibraryService } from "./runningLibrary";

type QueryResult = { data: unknown; error: unknown };
type Op = [string, ...unknown[]];

/**
 * Mock encadeável do client: cada `from(table)` grava as ops chamadas e resolve
 * (via `.order()` ou `.maybeSingle()`) o resultado pré-configurado da tabela.
 */
function makeClient(resultsByTable: Record<string, QueryResult>) {
  const fromCalls: Array<{ table: string; ops: Op[] }> = [];
  const from = vi.fn((table: string) => {
    const record = { table, ops: [] as Op[] };
    fromCalls.push(record);
    const result = resultsByTable[table] ?? { data: [], error: null };
    const builder = {
      select: (...a: unknown[]) => (record.ops.push(["select", ...a]), builder),
      eq: (...a: unknown[]) => (record.ops.push(["eq", ...a]), builder),
      in: (...a: unknown[]) => (record.ops.push(["in", ...a]), builder),
      order: (...a: unknown[]) => (
        record.ops.push(["order", ...a]), Promise.resolve(result)
      ),
      maybeSingle: () => (record.ops.push(["maybeSingle"]), Promise.resolve(result)),
    };
    return builder;
  });
  const client = { from } as unknown as GymCircleClient;
  return { client, fromCalls };
}

const templateRow = {
  id: "t1",
  slug: "primeira-caminhada",
  owner_user_id: null,
  origin: "official",
  visibility: "public",
  title: "Primeira caminhada",
  description: null,
  estimated_duration_s: 1800,
  estimated_distance_m: null,
  primary_step_type: "walk",
  is_published: true,
  created_at: "2026-07-24T00:00:00Z",
  updated_at: "2026-07-24T00:00:00Z",
};

const stepRow = {
  id: "s1",
  session_template_id: "t1",
  position: 0,
  step_type: "walk",
  title: "Caminhar leve",
  instructions: null,
  repetitions: 1,
  repetitions_min: null,
  repetitions_max: null,
  target_basis: "duration",
  distance_m: null,
  distance_min_m: null,
  distance_max_m: null,
  duration_s: 1800,
  duration_min_s: null,
  duration_max_s: null,
  pace_min_s_per_km: null,
  pace_max_s_per_km: null,
  heart_rate_zone: null,
  recovery_type: "none",
  recovery_duration_s: null,
  recovery_distance_m: null,
  target_effort: "3",
  metadata: null,
};

const programRow = {
  id: "p1",
  slug: "primeiro-5k",
  owner_user_id: null,
  origin: "official",
  visibility: "public",
  title: "Primeiro 5 km",
  description: null,
  level: "beginner",
  goal: "first_5k",
  weeks: 6,
  sessions_per_week: 3,
  time_bucket: 30,
  suggested_spacing: "rest_day_between",
  is_published: true,
  created_at: "2026-07-24T00:00:00Z",
  updated_at: "2026-07-24T00:00:00Z",
};

describe("listPublishedSessionTemplates", () => {
  it("filtra is_published e mapeia template + steps (camelCase)", async () => {
    const { client, fromCalls } = makeClient({
      running_session_template: { data: [templateRow], error: null },
      running_session_template_step: { data: [stepRow], error: null },
    });
    const templates = await runningLibraryService(client)
      .listPublishedSessionTemplates();

    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({
      id: "t1",
      title: "Primeira caminhada",
      isPublished: true,
      ownerUserId: null,
      origin: "official",
    });
    expect(templates[0].steps).toHaveLength(1);
    expect(templates[0].steps[0]).toMatchObject({
      stepType: "walk",
      targetBasis: "duration",
      durationS: 1800,
      targetEffort: 3,
    });

    expect(fromCalls[0].table).toBe("running_session_template");
    expect(fromCalls[0].ops).toContainEqual(["eq", "is_published", true]);
    expect(fromCalls[1].table).toBe("running_session_template_step");
    expect(fromCalls[1].ops).toContainEqual([
      "in",
      "session_template_id",
      ["t1"],
    ]);
  });

  it("não busca steps quando não há templates", async () => {
    const { client, fromCalls } = makeClient({
      running_session_template: { data: [], error: null },
    });
    const templates = await runningLibraryService(client)
      .listPublishedSessionTemplates();
    expect(templates).toEqual([]);
    expect(fromCalls).toHaveLength(1); // só a query de templates, sem a de steps
  });

  it("propaga erro da query", async () => {
    const { client } = makeClient({
      running_session_template: { data: null, error: new Error("boom") },
    });
    await expect(
      runningLibraryService(client).listPublishedSessionTemplates(),
    ).rejects.toThrow("boom");
  });
});

describe("getSessionTemplate", () => {
  it("mapeia um template com steps via maybeSingle", async () => {
    const { client, fromCalls } = makeClient({
      running_session_template: { data: templateRow, error: null },
      running_session_template_step: { data: [stepRow], error: null },
    });
    const template = await runningLibraryService(client).getSessionTemplate("t1");
    expect(template?.id).toBe("t1");
    expect(template?.steps).toHaveLength(1);
    expect(fromCalls[0].ops).toContainEqual(["maybeSingle"]);
  });

  it("retorna null quando não encontra", async () => {
    const { client } = makeClient({
      running_session_template: { data: null, error: null },
    });
    expect(
      await runningLibraryService(client).getSessionTemplate("x"),
    ).toBeNull();
  });
});

describe("listPublishedPrograms", () => {
  it("aplica os filtros de faceta e mapeia", async () => {
    const { client, fromCalls } = makeClient({
      running_program: { data: [programRow], error: null },
    });
    const programs = await runningLibraryService(client).listPublishedPrograms({
      level: "beginner",
      goal: "first_5k",
      sessionsPerWeek: 3,
      timeBucket: 30,
    });

    expect(programs).toHaveLength(1);
    expect(programs[0]).toMatchObject({
      id: "p1",
      level: "beginner",
      goal: "first_5k",
      weeks: 6,
      sessionsPerWeek: 3,
      timeBucket: 30,
    });

    const ops = fromCalls[0].ops;
    expect(ops).toContainEqual(["eq", "is_published", true]);
    expect(ops).toContainEqual(["eq", "level", "beginner"]);
    expect(ops).toContainEqual(["eq", "goal", "first_5k"]);
    expect(ops).toContainEqual(["eq", "sessions_per_week", 3]);
    expect(ops).toContainEqual(["eq", "time_bucket", 30]);
  });

  it("sem filtro, só is_published", async () => {
    const { client, fromCalls } = makeClient({
      running_program: { data: [], error: null },
    });
    await runningLibraryService(client).listPublishedPrograms();
    const eqs = fromCalls[0].ops.filter((op) => op[0] === "eq");
    expect(eqs).toEqual([["eq", "is_published", true]]);
  });
});

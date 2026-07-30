import type { SupabaseClient } from "@supabase/supabase-js";
import type { RunningPlanGoal, RunningPlanLevel } from "../domain/running";
import {
  runningProgramFromRow,
  runningSessionTemplateFromRow,
  type RunningProgram,
  type RunningProgramRow,
  type RunningSessionTemplate,
  type RunningSessionTemplateRow,
  type RunningSessionTemplateStepRow,
} from "../domain/running-library";
import type { GymCircleClient } from "./supabase";

/**
 * Running Coach Library (Sprint D1) — leitura da biblioteca oficial.
 * Somente leitura: matrícula/conclusão (RPCs) entram na Fatia 3. A RLS é a
 * autoridade de visibilidade (oficial publicado OU próprio); o filtro explícito
 * `is_published = true` deixa a semântica de "browse" clara.
 */

const TEMPLATE_FIELDS = [
  "id",
  "slug",
  "owner_user_id",
  "origin",
  "visibility",
  "title",
  "description",
  "estimated_duration_s",
  "estimated_distance_m",
  "primary_step_type",
  "is_published",
  "created_at",
  "updated_at",
].join(",");

const TEMPLATE_STEP_FIELDS = [
  "id",
  "session_template_id",
  "position",
  "step_type",
  "title",
  "instructions",
  "repetitions",
  "repetitions_min",
  "repetitions_max",
  "target_basis",
  "distance_m",
  "distance_min_m",
  "distance_max_m",
  "duration_s",
  "duration_min_s",
  "duration_max_s",
  "pace_min_s_per_km",
  "pace_max_s_per_km",
  "heart_rate_zone",
  "recovery_type",
  "recovery_duration_s",
  "recovery_distance_m",
  "target_effort",
  "metadata",
].join(",");

const PROGRAM_FIELDS = [
  "id",
  "slug",
  "owner_user_id",
  "origin",
  "visibility",
  "title",
  "description",
  "level",
  "goal",
  "weeks",
  "sessions_per_week",
  "time_bucket",
  "suggested_spacing",
  "is_published",
  "created_at",
  "updated_at",
].join(",");

export type RunningProgramFacetFilter = {
  level?: RunningPlanLevel;
  goal?: RunningPlanGoal;
  sessionsPerWeek?: number;
  timeBucket?: number;
};

export function runningLibraryService(client: GymCircleClient) {
  const untyped = client as unknown as SupabaseClient;

  async function stepsForTemplates(templateIds: string[]) {
    const grouped = new Map<string, RunningSessionTemplateStepRow[]>();
    if (templateIds.length === 0) return grouped;
    const { data, error } = await untyped
      .from("running_session_template_step")
      .select(TEMPLATE_STEP_FIELDS)
      .in("session_template_id", templateIds)
      .order("position", { ascending: true });
    if (error) throw error;
    for (const row of (data ?? []) as unknown as RunningSessionTemplateStepRow[]) {
      const current = grouped.get(row.session_template_id) ?? [];
      current.push(row);
      grouped.set(row.session_template_id, current);
    }
    return grouped;
  }

  return {
    async listPublishedSessionTemplates(): Promise<RunningSessionTemplate[]> {
      const { data, error } = await untyped
        .from("running_session_template")
        .select(TEMPLATE_FIELDS)
        .eq("is_published", true)
        .order("title", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as unknown as RunningSessionTemplateRow[];
      const grouped = await stepsForTemplates(rows.map((row) => row.id));
      return rows.map((row) =>
        runningSessionTemplateFromRow(row, grouped.get(row.id) ?? []),
      );
    },

    async getSessionTemplate(
      id: string,
    ): Promise<RunningSessionTemplate | null> {
      const { data, error } = await untyped
        .from("running_session_template")
        .select(TEMPLATE_FIELDS)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const grouped = await stepsForTemplates([id]);
      return runningSessionTemplateFromRow(
        data as unknown as RunningSessionTemplateRow,
        grouped.get(id) ?? [],
      );
    },

    async listPublishedPrograms(
      filter: RunningProgramFacetFilter = {},
    ): Promise<RunningProgram[]> {
      let query = untyped
        .from("running_program")
        .select(PROGRAM_FIELDS)
        .eq("is_published", true);
      if (filter.level) query = query.eq("level", filter.level);
      if (filter.goal) query = query.eq("goal", filter.goal);
      if (filter.sessionsPerWeek != null) {
        query = query.eq("sessions_per_week", filter.sessionsPerWeek);
      }
      if (filter.timeBucket != null) {
        query = query.eq("time_bucket", filter.timeBucket);
      }
      const { data, error } = await query.order("title", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as RunningProgramRow[]).map(
        runningProgramFromRow,
      );
    },
  };
}

export type RunningLibraryService = ReturnType<typeof runningLibraryService>;

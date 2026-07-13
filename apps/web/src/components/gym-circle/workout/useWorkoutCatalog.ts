"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth, useGymCircleClient } from "@gym-circle/core/hooks";
import type {
  WorkoutExerciseCatalogItem,
  WorkoutMuscleGroup,
  WorkoutTechniqueCatalogItem,
} from "../social/types";

type MuscleGroupRow = {
  slug: string;
  name_pt: string;
  name_en: string;
  icon_key: string;
  sort_order: number;
};

type ExerciseRow = {
  id: string;
  slug: string;
  name_pt: string;
  name_en: string;
  aliases: string[] | null;
  primary_muscle_group_slug: string;
  secondary_muscle_group_slugs: string[] | null;
  equipment: string[] | null;
  description_pt: string;
  description_en: string;
  instructions_pt: string[] | null;
  instructions_en: string[] | null;
  video_url: string | null;
  video_search_query: string | null;
  status: "approved" | "community";
  parent_exercise_id?: string | null;
  movement_pattern?: string | null;
};

type TechniqueRow = {
  id: string;
  slug: string;
  name_pt: string;
  name_en: string;
  aliases: string[] | null;
  summary_pt: string;
  summary_en: string;
  instructions_pt: string[] | null;
  instructions_en: string[] | null;
  video_url: string | null;
  video_search_query: string | null;
  status: "approved" | "community";
};

export function isMissingWorkoutVariationColumns(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /parent_exercise_id|movement_pattern/i.test(error.message ?? "")
  );
}

function mapMuscleGroup(row: MuscleGroupRow): WorkoutMuscleGroup {
  return {
    slug: row.slug,
    namePt: row.name_pt,
    nameEn: row.name_en,
    iconKey: row.icon_key,
    sortOrder: row.sort_order,
  };
}

function mapExercise(row: ExerciseRow): WorkoutExerciseCatalogItem {
  return {
    id: row.id,
    slug: row.slug,
    namePt: row.name_pt,
    nameEn: row.name_en,
    aliases: row.aliases ?? [],
    primaryMuscleGroupSlug: row.primary_muscle_group_slug,
    secondaryMuscleGroupSlugs: row.secondary_muscle_group_slugs ?? [],
    equipment: row.equipment ?? [],
    descriptionPt: row.description_pt,
    descriptionEn: row.description_en,
    instructionsPt: row.instructions_pt ?? [],
    instructionsEn: row.instructions_en ?? [],
    videoUrl: row.video_url,
    videoSearchQuery: row.video_search_query,
    status: row.status,
    parentExerciseId: row.parent_exercise_id ?? null,
    movementPattern: row.movement_pattern ?? null,
    variations: [],
  };
}

/**
 * Liga somente relações explícitas do catálogo. Uma variação conhece o
 * exercício-base e suas irmãs; a base conhece todas as filhas.
 */
export function linkWorkoutCatalogVariations(
  exercises: WorkoutExerciseCatalogItem[],
): WorkoutExerciseCatalogItem[] {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const childrenByParent = new Map<string, WorkoutExerciseCatalogItem[]>();
  for (const exercise of exercises) {
    if (!exercise.parentExerciseId || !byId.has(exercise.parentExerciseId)) {
      continue;
    }
    const current = childrenByParent.get(exercise.parentExerciseId) ?? [];
    current.push(exercise);
    childrenByParent.set(exercise.parentExerciseId, current);
  }

  return exercises.map((exercise) => {
    const rootId =
      exercise.parentExerciseId && byId.has(exercise.parentExerciseId)
        ? exercise.parentExerciseId
        : exercise.id;
    const root = byId.get(rootId);
    const related = [root, ...(childrenByParent.get(rootId) ?? [])]
      .filter(
        (item): item is WorkoutExerciseCatalogItem =>
          Boolean(item) && item?.id !== exercise.id,
      )
      .map((item) => ({
        id: item.id,
        slug: item.slug,
        namePt: item.namePt,
        nameEn: item.nameEn,
        equipment: item.equipment,
      }));
    return { ...exercise, variations: related };
  });
}

function mapTechnique(row: TechniqueRow): WorkoutTechniqueCatalogItem {
  return {
    id: row.id,
    slug: row.slug,
    namePt: row.name_pt,
    nameEn: row.name_en,
    aliases: row.aliases ?? [],
    summaryPt: row.summary_pt,
    summaryEn: row.summary_en,
    instructionsPt: row.instructions_pt ?? [],
    instructionsEn: row.instructions_en ?? [],
    videoUrl: row.video_url,
    videoSearchQuery: row.video_search_query,
    status: row.status,
  };
}

export function normalizeWorkoutCatalogText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index];
    }
  }
  return previous[right.length];
}

function fuzzyCatalogMatch<T>(
  value: string,
  candidates: Array<{ item: T; names: string[] }>,
): T | null {
  const normalized = normalizeWorkoutCatalogText(value);
  if (normalized.length < 5) return null;
  let best: { item: T; similarity: number } | null = null;
  for (const candidate of candidates) {
    for (const name of candidate.names) {
      const normalizedName = normalizeWorkoutCatalogText(name);
      const longest = Math.max(normalized.length, normalizedName.length);
      if (longest === 0) continue;
      const similarity =
        1 - editDistance(normalized, normalizedName) / longest;
      if (!best || similarity > best.similarity) {
        best = { item: candidate.item, similarity };
      }
    }
  }
  return best && best.similarity >= 0.88 ? best.item : null;
}

export function useWorkoutCatalog() {
  const client = useGymCircleClient();
  const { user } = useAuth();
  const db = client as unknown as SupabaseClient;
  const [muscleGroups, setMuscleGroups] = useState<WorkoutMuscleGroup[]>([]);
  const [exercises, setExercises] = useState<WorkoutExerciseCatalogItem[]>([]);
  const [techniques, setTechniques] = useState<WorkoutTechniqueCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupsResult, initialExercisesResult, techniquesResult] =
        await Promise.all([
        db
          .from("workout_muscle_groups")
          .select("slug, name_pt, name_en, icon_key, sort_order")
          .order("sort_order", { ascending: true }),
        db
          .from("workout_exercise_catalog")
          .select(
            "id, slug, name_pt, name_en, aliases, primary_muscle_group_slug, secondary_muscle_group_slugs, equipment, description_pt, description_en, instructions_pt, instructions_en, video_url, video_search_query, status, parent_exercise_id, movement_pattern",
          )
          .order("name_pt", { ascending: true }),
        db
          .from("workout_technique_catalog")
          .select(
            "id, slug, name_pt, name_en, aliases, summary_pt, summary_en, instructions_pt, instructions_en, video_url, video_search_query, status",
          )
          .order("name_pt", { ascending: true }),
      ]);
      const exercisesResult =
        initialExercisesResult.error &&
        isMissingWorkoutVariationColumns(initialExercisesResult.error)
          ? await db
              .from("workout_exercise_catalog")
              .select(
                "id, slug, name_pt, name_en, aliases, primary_muscle_group_slug, secondary_muscle_group_slugs, equipment, description_pt, description_en, instructions_pt, instructions_en, video_url, video_search_query, status",
              )
              .order("name_pt", { ascending: true })
          : initialExercisesResult;
      if (groupsResult.error) throw groupsResult.error;
      if (exercisesResult.error) throw exercisesResult.error;
      if (techniquesResult.error) throw techniquesResult.error;
      setMuscleGroups(
        ((groupsResult.data ?? []) as MuscleGroupRow[]).map(mapMuscleGroup),
      );
      setExercises(
        linkWorkoutCatalogVariations(
          ((exercisesResult.data ?? []) as ExerciseRow[]).map(mapExercise),
        ),
      );
      setTechniques(
        ((techniquesResult.data ?? []) as TechniqueRow[]).map(mapTechnique),
      );
    } catch (queryError) {
      setError(
        queryError instanceof Error ? queryError.message : "catalog_load_failed",
      );
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    // Catálogo externo: a carga inicial precisa sincronizar o estado local.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const exerciseLookup = useMemo(() => {
    const lookup = new Map<string, WorkoutExerciseCatalogItem>();
    for (const exercise of exercises) {
      for (const value of [
        exercise.namePt,
        exercise.nameEn,
        ...exercise.aliases,
      ]) {
        const key = normalizeWorkoutCatalogText(value);
        if (key) lookup.set(key, exercise);
      }
    }
    return lookup;
  }, [exercises]);

  const techniqueLookup = useMemo(() => {
    const lookup = new Map<string, WorkoutTechniqueCatalogItem>();
    for (const technique of techniques) {
      for (const value of [
        technique.namePt,
        technique.nameEn,
        technique.slug,
        ...technique.aliases,
      ]) {
        const key = normalizeWorkoutCatalogText(value);
        if (key) lookup.set(key, technique);
      }
    }
    return lookup;
  }, [techniques]);

  const findExercise = useCallback(
    (name: string) =>
      exerciseLookup.get(normalizeWorkoutCatalogText(name)) ??
      fuzzyCatalogMatch(
        name,
        exercises.map((exercise) => ({
          item: exercise,
          names: [exercise.namePt, exercise.nameEn, ...exercise.aliases],
        })),
      ),
    [exerciseLookup, exercises],
  );

  const findTechnique = useCallback(
    (name: string) =>
      techniqueLookup.get(normalizeWorkoutCatalogText(name)) ?? null,
    [techniqueLookup],
  );

  const submitExercise = useCallback(
    async (input: {
      name: string;
      primaryMuscleGroupSlug?: string | null;
      description?: string | null;
    }) => {
      if (!user) throw new Error("auth_required");
      const existing = findExercise(input.name);
      if (existing) return existing;
      const { data, error: submitError } = await db
        .rpc("submit_workout_exercise", {
          p_name: input.name,
          p_primary_muscle_group_slug:
            input.primaryMuscleGroupSlug || "other",
          p_description: input.description ?? null,
        })
        .single();
      if (submitError) throw submitError;
      const created = mapExercise(data as ExerciseRow);
      setExercises((current) => {
        if (current.some((item) => item.id === created.id)) return current;
        return linkWorkoutCatalogVariations([...current, created]).sort((a, b) =>
          a.namePt.localeCompare(b.namePt, "pt-BR"),
        );
      });
      return created;
    },
    [db, findExercise, user],
  );

  const submitTechnique = useCallback(
    async (input: { name: string; summary?: string | null }) => {
      if (!user) throw new Error("auth_required");
      const existing = findTechnique(input.name);
      if (existing) return existing;
      const { data, error: submitError } = await db
        .rpc("submit_workout_technique", {
          p_name: input.name,
          p_summary: input.summary ?? null,
        })
        .single();
      if (submitError) throw submitError;
      const created = mapTechnique(data as TechniqueRow);
      setTechniques((current) =>
        current.some((item) => item.id === created.id)
          ? current
          : [...current, created].sort((a, b) =>
              a.namePt.localeCompare(b.namePt, "pt-BR"),
            ),
      );
      return created;
    },
    [db, findTechnique, user],
  );

  return {
    muscleGroups,
    exercises,
    techniques,
    loading,
    error,
    refresh,
    findExercise,
    findTechnique,
    submitExercise,
    submitTechnique,
  };
}

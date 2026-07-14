import type { WorkoutExerciseCatalogItem } from "../social/types";
import { normalizeWorkoutCatalogText } from "./useWorkoutCatalog";

export const ALL_WORKOUT_GROUPS = "__all__";

export type WorkoutCatalogQuickFilter = "all" | "recent" | "favorites";

export type WorkoutCatalogAdvancedFilters = {
  equipment?: string | null;
  loadType?: WorkoutExerciseCatalogItem["defaultLoadType"] | null;
  difficulty?: WorkoutExerciseCatalogItem["difficulty"] | null;
  movementPattern?: string | null;
  exerciseType?: WorkoutExerciseCatalogItem["exerciseType"] | null;
};

export type RankedWorkoutCatalogExercise = {
  exercise: WorkoutExerciseCatalogItem;
  score: number;
  muscleMatch: "primary" | "secondary" | "none";
};

export type WorkoutCatalogSections = {
  primary: RankedWorkoutCatalogExercise[];
  secondary: RankedWorkoutCatalogExercise[];
};

const EQUIPMENT_LABELS: Record<string, { pt: string; en: string }> = {
  "assisted-pull-up-machine": {
    pt: "máquina assistida",
    en: "assisted machine",
  },
  "assisted pull-up machine": {
    pt: "máquina assistida",
    en: "assisted machine",
  },
  barbell: { pt: "barra", en: "barbell" },
  bench: { pt: "banco", en: "bench" },
  bodyweight: { pt: "peso corporal", en: "bodyweight" },
  cable: { pt: "polia", en: "cable" },
  "decline bench": { pt: "banco declinado", en: "decline bench" },
  "decline-bench": { pt: "banco declinado", en: "decline bench" },
  dumbbell: { pt: "halter", en: "dumbbell" },
  dumbbells: { pt: "halteres", en: "dumbbells" },
  "ez bar": { pt: "barra W", en: "EZ bar" },
  "ez-bar": { pt: "barra W", en: "EZ bar" },
  "free weight": { pt: "peso livre", en: "free weight" },
  "free-weight": { pt: "peso livre", en: "free weight" },
  "incline bench": { pt: "banco inclinado", en: "incline bench" },
  "incline-bench": { pt: "banco inclinado", en: "incline bench" },
  "leg press": { pt: "leg press", en: "leg press" },
  "leg-press-machine": { pt: "leg press", en: "leg press" },
  kettlebell: { pt: "kettlebell", en: "kettlebell" },
  machine: { pt: "máquina", en: "machine" },
  plate: { pt: "anilha", en: "plate" },
  "pull-up bar": { pt: "barra fixa", en: "pull-up bar" },
  "pull-up-bar": { pt: "barra fixa", en: "pull-up bar" },
  rack: { pt: "rack", en: "rack" },
  rope: { pt: "corda", en: "rope" },
  "resistance-band": { pt: "elástico", en: "resistance band" },
  "no-equipment": { pt: "sem equipamento", en: "no equipment" },
  smith: { pt: "smith", en: "smith" },
};

export const STANDARD_WORKOUT_EQUIPMENT_FILTERS = [
  "bodyweight",
  "dumbbell",
  "barbell",
  "smith",
  "machine",
  "cable",
  "bench",
  "kettlebell",
  "resistance-band",
  "no-equipment",
] as const;

export function workoutEquipmentLabel(
  equipment: string,
  english: boolean,
): string {
  const key = equipment.trim().toLowerCase();
  const label = EQUIPMENT_LABELS[key];
  if (label) return english ? label.en : label.pt;
  return equipment.replace(/[-_]+/g, " ");
}

function queryMatchScore(
  exercise: WorkoutExerciseCatalogItem,
  normalizedQuery: string,
): number {
  if (!normalizedQuery) return 0;
  const values = [
    exercise.namePt,
    exercise.nameEn,
    exercise.movementPattern ?? "",
    ...exercise.aliases,
    ...exercise.variations.flatMap((variation) => [
      variation.namePt,
      variation.nameEn,
    ]),
  ].map(normalizeWorkoutCatalogText);
  if (values.some((value) => value === normalizedQuery)) return 48;
  if (values.some((value) => value.startsWith(normalizedQuery))) return 44;
  return values.some((value) => value.includes(normalizedQuery)) ? 40 : 0;
}

function matchesGroup(exercise: WorkoutExerciseCatalogItem, group: string) {
  return (
    group === ALL_WORKOUT_GROUPS ||
    exercise.primaryMuscleGroupSlug === group ||
    exercise.secondaryMuscleGroupSlugs.includes(group)
  );
}

/**
 * Quando há texto, a busca é global. Sem texto, o grupo continua sendo o
 * contexto principal. Equipamento é sempre um refinamento opcional.
 */
export function filterWorkoutCatalogExercises(
  exercises: WorkoutExerciseCatalogItem[],
  options: { group: string; query: string; equipment?: string | null },
) {
  const normalizedQuery = normalizeWorkoutCatalogText(options.query);
  return exercises.filter((exercise) => {
    if (normalizedQuery) {
      if (queryMatchScore(exercise, normalizedQuery) === 0) return false;
    } else if (!matchesGroup(exercise, options.group)) {
      return false;
    }
    return options.equipment
      ? exercise.compatibleEquipments.includes(options.equipment) ||
          exercise.equipment.includes(options.equipment)
      : true;
  });
}

function muscleMatch(
  exercise: WorkoutExerciseCatalogItem,
  group: string,
): RankedWorkoutCatalogExercise["muscleMatch"] {
  if (group === ALL_WORKOUT_GROUPS) return "none";
  if (exercise.primaryMuscleGroupSlug === group) return "primary";
  if (exercise.secondaryMuscleGroupSlugs.includes(group)) return "secondary";
  return "none";
}

/**
 * Primary and secondary muscle matches are deliberately split before sorting.
 * This makes it impossible for a popular compound exercise to outrank an
 * exercise whose primary muscle is the selected group.
 */
export function rankWorkoutCatalogExercises(
  exercises: WorkoutExerciseCatalogItem[],
  options: {
    group: string;
    query: string;
    quickFilter?: WorkoutCatalogQuickFilter;
    filters?: WorkoutCatalogAdvancedFilters;
    favoriteExerciseIds?: string[];
    recentExerciseIds?: string[];
    locale?: string;
  },
): WorkoutCatalogSections {
  const normalizedQuery = normalizeWorkoutCatalogText(options.query);
  const favoriteIds = new Set(options.favoriteExerciseIds ?? []);
  const recentIds = new Set(options.recentExerciseIds ?? []);
  const recentRank = new Map(
    (options.recentExerciseIds ?? []).map((id, index) => [id, index]),
  );
  const quickFilter = options.quickFilter ?? "all";
  const filters = options.filters ?? {};
  const locale = options.locale ?? "pt-BR";
  const ranked: RankedWorkoutCatalogExercise[] = [];

  for (const exercise of exercises) {
    if (exercise.reviewStatus === "deprecated") continue;
    const match = muscleMatch(exercise, options.group);
    const searchScore = queryMatchScore(exercise, normalizedQuery);
    if (normalizedQuery && searchScore === 0) continue;
    if (!normalizedQuery && options.group !== ALL_WORKOUT_GROUPS && match === "none") {
      continue;
    }
    if (quickFilter === "recent" && !recentIds.has(exercise.id)) continue;
    if (quickFilter === "favorites" && !favoriteIds.has(exercise.id)) continue;
    if (
      filters.equipment &&
      !exercise.compatibleEquipments.includes(filters.equipment) &&
      !exercise.equipment.includes(filters.equipment)
    ) {
      continue;
    }
    if (filters.loadType && exercise.defaultLoadType !== filters.loadType) {
      continue;
    }
    if (filters.difficulty && exercise.difficulty !== filters.difficulty) {
      continue;
    }
    if (
      filters.movementPattern &&
      exercise.movementPattern !== filters.movementPattern
    ) {
      continue;
    }
    if (filters.exerciseType && exercise.exerciseType !== filters.exerciseType) {
      continue;
    }

    let score = searchScore;
    if (match === "primary") score += 100;
    if (match === "secondary") score += 10;
    if (filters.equipment) score += 30;
    if (favoriteIds.has(exercise.id)) score += 20;
    if (recentIds.has(exercise.id)) {
      score += Math.max(1, 15 - (recentRank.get(exercise.id) ?? 14));
    }
    score += exercise.exercisePriorityScore / 10;
    ranked.push({ exercise, score, muscleMatch: match });
  }

  const sortRanked = (
    left: RankedWorkoutCatalogExercise,
    right: RankedWorkoutCatalogExercise,
  ) =>
    right.score - left.score ||
    left.exercise.namePt.localeCompare(right.exercise.namePt, locale);

  return {
    primary: ranked
      .filter((item) => item.muscleMatch !== "secondary")
      .sort(sortRanked),
    secondary: ranked
      .filter((item) => item.muscleMatch === "secondary")
      .sort(sortRanked),
  };
}

/** Equipamentos disponíveis no resultado atual antes do refinamento. */
export function workoutCatalogEquipmentOptions(
  exercises: WorkoutExerciseCatalogItem[],
  options: { group: string; query: string },
) {
  const base = filterWorkoutCatalogExercises(exercises, options);
  return Array.from(
    new Set(
      base.flatMap((exercise) =>
        exercise.compatibleEquipments.length > 0
          ? exercise.compatibleEquipments
          : exercise.equipment,
      ),
    ),
  ).sort((left, right) => left.localeCompare(right, "en"));
}

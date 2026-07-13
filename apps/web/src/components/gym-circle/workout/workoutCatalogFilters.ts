import type { WorkoutExerciseCatalogItem } from "../social/types";
import { normalizeWorkoutCatalogText } from "./useWorkoutCatalog";

export const ALL_WORKOUT_GROUPS = "__all__";

const EQUIPMENT_LABELS: Record<string, { pt: string; en: string }> = {
  "assisted pull-up machine": {
    pt: "máquina assistida",
    en: "assisted machine",
  },
  barbell: { pt: "barra", en: "barbell" },
  bench: { pt: "banco", en: "bench" },
  bodyweight: { pt: "peso corporal", en: "bodyweight" },
  cable: { pt: "polia", en: "cable" },
  "decline bench": { pt: "banco declinado", en: "decline bench" },
  dumbbell: { pt: "halter", en: "dumbbell" },
  dumbbells: { pt: "halteres", en: "dumbbells" },
  "ez bar": { pt: "barra W", en: "EZ bar" },
  "free weight": { pt: "peso livre", en: "free weight" },
  "incline bench": { pt: "banco inclinado", en: "incline bench" },
  "leg press": { pt: "leg press", en: "leg press" },
  machine: { pt: "máquina", en: "machine" },
  plate: { pt: "anilha", en: "plate" },
  "pull-up bar": { pt: "barra fixa", en: "pull-up bar" },
  rack: { pt: "rack", en: "rack" },
  rope: { pt: "corda", en: "rope" },
  smith: { pt: "smith", en: "smith" },
};

export function workoutEquipmentLabel(
  equipment: string,
  english: boolean,
): string {
  const key = equipment.trim().toLowerCase();
  const label = EQUIPMENT_LABELS[key];
  if (label) return english ? label.en : label.pt;
  return equipment.replace(/[-_]+/g, " ");
}

function matchesQuery(
  exercise: WorkoutExerciseCatalogItem,
  normalizedQuery: string,
) {
  if (!normalizedQuery) return true;
  return [
    exercise.namePt,
    exercise.nameEn,
    exercise.movementPattern ?? "",
    ...exercise.aliases,
    ...exercise.variations.flatMap((variation) => [
      variation.namePt,
      variation.nameEn,
    ]),
  ].some((value) =>
    normalizeWorkoutCatalogText(value).includes(normalizedQuery),
  );
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
      if (!matchesQuery(exercise, normalizedQuery)) return false;
    } else if (!matchesGroup(exercise, options.group)) {
      return false;
    }
    return options.equipment
      ? exercise.equipment.includes(options.equipment)
      : true;
  });
}

/** Equipamentos disponíveis no resultado atual antes do refinamento. */
export function workoutCatalogEquipmentOptions(
  exercises: WorkoutExerciseCatalogItem[],
  options: { group: string; query: string },
) {
  const base = filterWorkoutCatalogExercises(exercises, options);
  return Array.from(new Set(base.flatMap((exercise) => exercise.equipment))).sort(
    (left, right) => left.localeCompare(right, "en"),
  );
}

import { describe, expect, it } from "vitest";
import type { WorkoutExerciseCatalogItem } from "../social/types";
import {
  ALL_WORKOUT_GROUPS,
  filterWorkoutCatalogExercises,
  workoutCatalogEquipmentOptions,
  workoutEquipmentLabel,
} from "./workoutCatalogFilters";

function exercise(
  id: string,
  name: string,
  group: string,
  equipment: string[],
  secondary: string[] = [],
): WorkoutExerciseCatalogItem {
  return {
    id,
    slug: id,
    namePt: name,
    nameEn: name,
    aliases: [],
    primaryMuscleGroupSlug: group,
    secondaryMuscleGroupSlugs: secondary,
    equipment,
    descriptionPt: "Descrição",
    descriptionEn: "Description",
    instructionsPt: [],
    instructionsEn: [],
    videoUrl: null,
    videoSearchQuery: null,
    status: "approved",
    parentExerciseId: null,
    movementPattern: null,
    variations: [],
  };
}

const exercises = [
  exercise("supino", "Supino reto", "chest", ["barbell", "bench"]),
  exercise("remada", "Remada baixa", "back", ["cable"], ["biceps"]),
  exercise("agachamento", "Agachamento", "quadriceps", ["barbell"]),
];

describe("filterWorkoutCatalogExercises", () => {
  it("respeita o grupo quando a busca está vazia", () => {
    expect(
      filterWorkoutCatalogExercises(exercises, {
        group: "chest",
        query: "",
      }).map((item) => item.id),
    ).toEqual(["supino"]);
  });

  it("faz busca global quando há texto", () => {
    expect(
      filterWorkoutCatalogExercises(exercises, {
        group: "chest",
        query: "agachamento",
      }).map((item) => item.id),
    ).toEqual(["agachamento"]);
  });

  it("encontra a base pelo nome de uma variação ligada", () => {
    const base = exercise("press", "Supino reto", "chest", ["barbell"]);
    base.variations = [
      {
        id: "incline",
        slug: "incline",
        namePt: "Supino inclinado",
        nameEn: "Incline bench press",
        equipment: ["dumbbell"],
      },
    ];
    expect(
      filterWorkoutCatalogExercises([base], {
        group: ALL_WORKOUT_GROUPS,
        query: "incline bench",
      }).map((item) => item.id),
    ).toEqual(["press"]);
  });

  it("oferece Todos e permite refinar por equipamento", () => {
    expect(
      filterWorkoutCatalogExercises(exercises, {
        group: ALL_WORKOUT_GROUPS,
        query: "",
        equipment: "barbell",
      }).map((item) => item.id),
    ).toEqual(["supino", "agachamento"]);
    expect(
      workoutCatalogEquipmentOptions(exercises, {
        group: "back",
        query: "",
      }),
    ).toEqual(["cable"]);
  });
});

describe("workoutEquipmentLabel", () => {
  it("traduz equipamentos conhecidos e normaliza o fallback", () => {
    expect(workoutEquipmentLabel("barbell", false)).toBe("barra");
    expect(workoutEquipmentLabel("barbell", true)).toBe("barbell");
    expect(workoutEquipmentLabel("new-machine", false)).toBe("new machine");
  });
});

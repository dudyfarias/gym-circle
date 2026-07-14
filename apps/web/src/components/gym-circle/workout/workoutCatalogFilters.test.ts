import { describe, expect, it } from "vitest";
import type { WorkoutExerciseCatalogItem } from "../social/types";
import {
  ALL_WORKOUT_GROUPS,
  filterWorkoutCatalogExercises,
  rankWorkoutCatalogExercises,
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
    aliasesPt: [],
    aliasesEn: [],
    primaryMuscleGroupSlug: group,
    secondaryMuscleGroupSlugs: secondary,
    equipment,
    primaryEquipment: equipment[0] ?? null,
    compatibleEquipments: equipment,
    requiredEquipment: equipment.slice(0, 1),
    optionalEquipment: equipment.slice(1),
    descriptionPt: "Descrição",
    descriptionEn: "Description",
    instructionsPt: [],
    instructionsEn: [],
    commonMistakesPt: [],
    commonMistakesEn: [],
    videoUrl: null,
    videoSearchQuery: null,
    status: "approved",
    reviewStatus: "approved",
    exerciseType: secondary.length > 0 ? "compound" : "isolation",
    defaultLoadType: equipment.includes("bodyweight")
      ? "bodyweight"
      : "external",
    difficulty: "beginner",
    exercisePriorityScore: 50,
    defaultRestS: 75,
    defaultRpe: 7,
    defaultTargetKind: "reps",
    defaultReps: 12,
    defaultDurationS: null,
    defaultDistanceM: null,
    reviewedBy: null,
    reviewedAt: null,
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

describe("rankWorkoutCatalogExercises", () => {
  it("nunca deixa músculo secundário competir com o principal", () => {
    const directCurl = exercise(
      "rosca-direta",
      "Rosca direta",
      "biceps",
      ["barbell"],
      ["forearms"],
    );
    directCurl.exercisePriorityScore = 40;
    const pullUp = exercise(
      "barra-fixa",
      "Barra fixa",
      "back",
      ["bodyweight"],
      ["biceps"],
    );
    pullUp.exercisePriorityScore = 100;

    const result = rankWorkoutCatalogExercises([pullUp, directCurl], {
      group: "biceps",
      query: "",
    });

    expect(result.primary.map((item) => item.exercise.id)).toEqual([
      "rosca-direta",
    ]);
    expect(result.secondary.map((item) => item.exercise.id)).toEqual([
      "barra-fixa",
    ]);
  });

  it("combina busca, equipamento, favoritos e recentes sem quebrar seções", () => {
    const result = rankWorkoutCatalogExercises(exercises, {
      group: "back",
      query: "remada",
      filters: { equipment: "cable" },
      favoriteExerciseIds: ["remada"],
      recentExerciseIds: ["remada"],
    });
    expect(result.primary[0]).toMatchObject({
      exercise: { id: "remada" },
      muscleMatch: "primary",
    });
    expect(result.primary[0]?.score).toBeGreaterThanOrEqual(205);
  });

  it("usa a prioridade editorial dentro da seção principal", () => {
    const direct = exercise("direta", "Rosca direta", "biceps", ["barbell"]);
    direct.exercisePriorityScore = 99;
    const scott = exercise("scott", "Rosca Scott", "biceps", ["machine"]);
    scott.exercisePriorityScore = 97;
    const hammer = exercise("martelo", "Rosca martelo", "biceps", [
      "dumbbell",
    ]);
    hammer.exercisePriorityScore = 91;
    expect(
      rankWorkoutCatalogExercises([hammer, scott, direct], {
        group: "biceps",
        query: "",
      }).primary.map((item) => item.exercise.id),
    ).toEqual(["direta", "scott", "martelo"]);
  });

  it("aplica filtros rápidos de recentes e favoritos", () => {
    expect(
      rankWorkoutCatalogExercises(exercises, {
        group: ALL_WORKOUT_GROUPS,
        query: "",
        quickFilter: "recent",
        recentExerciseIds: ["agachamento"],
      }).primary.map((item) => item.exercise.id),
    ).toEqual(["agachamento"]);
    expect(
      rankWorkoutCatalogExercises(exercises, {
        group: ALL_WORKOUT_GROUPS,
        query: "",
        quickFilter: "favorites",
        favoriteExerciseIds: ["supino"],
      }).primary.map((item) => item.exercise.id),
    ).toEqual(["supino"]);
  });

  it("preserva a ordem de recência como desempate relevante", () => {
    const first = exercise("first", "Primeiro", "chest", ["machine"]);
    const second = exercise("second", "Segundo", "chest", ["machine"]);
    expect(
      rankWorkoutCatalogExercises([second, first], {
        group: ALL_WORKOUT_GROUPS,
        query: "",
        quickFilter: "recent",
        recentExerciseIds: ["first", "second"],
      }).primary.map((item) => item.exercise.id),
    ).toEqual(["first", "second"]);
  });
});

describe("workoutEquipmentLabel", () => {
  it("traduz equipamentos conhecidos e normaliza o fallback", () => {
    expect(workoutEquipmentLabel("barbell", false)).toBe("barra");
    expect(workoutEquipmentLabel("barbell", true)).toBe("barbell");
    expect(workoutEquipmentLabel("new-machine", false)).toBe("new machine");
  });
});

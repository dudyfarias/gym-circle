import { describe, expect, it } from "vitest";
import type { WorkoutExerciseCatalogItem } from "../social/types";
import {
  isMissingWorkoutVariationColumns,
  linkWorkoutCatalogVariations,
} from "./useWorkoutCatalog";

function exercise(
  id: string,
  parentExerciseId: string | null,
): WorkoutExerciseCatalogItem {
  return {
    id,
    slug: id,
    namePt: id,
    nameEn: `${id}-en`,
    aliases: [],
    aliasesPt: [],
    aliasesEn: [],
    primaryMuscleGroupSlug: "chest",
    secondaryMuscleGroupSlugs: [],
    equipment: [],
    primaryEquipment: null,
    compatibleEquipments: [],
    requiredEquipment: [],
    optionalEquipment: [],
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
    exerciseType: "compound",
    defaultLoadType: "external",
    difficulty: "beginner",
    exercisePriorityScore: 50,
    defaultRestS: 90,
    defaultRpe: 7,
    defaultTargetKind: "reps",
    defaultReps: 10,
    defaultDurationS: null,
    defaultDistanceM: null,
    reviewedBy: null,
    reviewedAt: null,
    parentExerciseId,
    movementPattern: "horizontal_push",
    variations: [],
  };
}

describe("linkWorkoutCatalogVariations", () => {
  it("liga a base às filhas e uma filha à base e às irmãs", () => {
    const linked = linkWorkoutCatalogVariations([
      exercise("bench-press", null),
      exercise("incline-press", "bench-press"),
      exercise("machine-press", "bench-press"),
      exercise("row", null),
    ]);

    expect(
      linked.find((item) => item.id === "bench-press")?.variations.map(
        (item) => item.id,
      ),
    ).toEqual(["incline-press", "machine-press"]);
    expect(
      linked.find((item) => item.id === "incline-press")?.variations.map(
        (item) => item.id,
      ),
    ).toEqual(["bench-press", "machine-press"]);
    expect(linked.find((item) => item.id === "row")?.variations).toEqual([]);
  });

  it("ignora parent órfão em vez de inferir relação pelo nome", () => {
    const linked = linkWorkoutCatalogVariations([
      exercise("orphan", "missing-parent"),
    ]);
    expect(linked[0]?.variations).toEqual([]);
  });
});

describe("isMissingWorkoutVariationColumns", () => {
  it("permite fallback durante o deploy anterior à migration", () => {
    expect(
      isMissingWorkoutVariationColumns({
        code: "42703",
        message: "column parent_exercise_id does not exist",
      }),
    ).toBe(true);
    expect(
      isMissingWorkoutVariationColumns({
        code: "PGRST204",
        message: "movement_pattern was not found",
      }),
    ).toBe(true);
  });

  it("não mascara outros erros do catálogo", () => {
    expect(
      isMissingWorkoutVariationColumns({
        code: "42501",
        message: "permission denied",
      }),
    ).toBe(false);
  });
});

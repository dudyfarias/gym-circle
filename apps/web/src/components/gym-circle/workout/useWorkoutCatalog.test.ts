import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasWorkoutCatalogIntelligenceSchema } from "./useWorkoutCatalog";

describe("workout catalog schema compatibility", () => {
  it("detects the legacy production catalog without issuing a missing-column query", () => {
    expect(
      hasWorkoutCatalogIntelligenceSchema([
        { id: "exercise-1", name_pt: "Supino reto", status: "approved" },
      ]),
    ).toBe(false);

    const source = readFileSync(
      fileURLToPath(new URL("./useWorkoutCatalog.ts", import.meta.url)),
      "utf8",
    );
    expect(source).toContain('.from("workout_exercise_catalog")');
    expect(source).toContain('.select("*")');
  });

  it("enables remote preferences only when the intelligence schema is present", () => {
    expect(
      hasWorkoutCatalogIntelligenceSchema([
        {
          id: "exercise-1",
          name_pt: "Supino reto",
          review_status: "approved",
        },
      ]),
    ).toBe(true);

    const source = readFileSync(
      fileURLToPath(new URL("./useWorkoutCatalog.ts", import.meta.url)),
      "utf8",
    );
    expect(source).toContain("catalogIntelligenceAvailable");
    expect(source).toContain("readLocalFavoriteExerciseIds");
  });
});

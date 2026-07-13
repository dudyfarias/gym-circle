import { describe, expect, it } from "vitest";
import {
  localizeWorkoutExercise,
  localizeWorkoutTechnique,
  localizeWorkoutVariationName,
  workoutMovementPatternLabel,
} from "./workoutCatalogLocalization";

const legacyExercise = {
  namePt: "Supino reto",
  nameEn: "Supino reto",
  descriptionPt: "Empurre a barra acima do peito.",
  descriptionEn: "Empurre a barra acima do peito.",
  instructionsPt: ["Apoie os pés."],
  instructionsEn: ["Apoie os pés."],
};

describe("localizeWorkoutExercise", () => {
  it("não apresenta conteúdo legado em português como tradução inglesa", () => {
    expect(localizeWorkoutExercise(legacyExercise, true)).toEqual({
      name: "Supino reto",
      description: "English description is not available yet.",
      instructions: [],
      usesOriginalName: true,
      translationPending: true,
    });
  });

  it("usa a tradução real quando ela existe", () => {
    expect(
      localizeWorkoutExercise(
        {
          ...legacyExercise,
          nameEn: "Barbell bench press",
          descriptionEn: "Press the bar above your chest.",
          instructionsEn: ["Keep your feet planted."],
        },
        true,
      ),
    ).toMatchObject({
      name: "Barbell bench press",
      description: "Press the bar above your chest.",
      instructions: ["Keep your feet planted."],
      usesOriginalName: false,
      translationPending: false,
    });
  });

  it("preserva o conteúdo português na interface em português", () => {
    expect(localizeWorkoutExercise(legacyExercise, false)).toMatchObject({
      name: "Supino reto",
      description: "Empurre a barra acima do peito.",
      instructions: ["Apoie os pés."],
      translationPending: false,
    });
  });
});

describe("localização de metadados", () => {
  it("marca o nome original de uma variação sem tradução", () => {
    expect(
      localizeWorkoutVariationName(
        { namePt: "Supino inclinado", nameEn: "Supino inclinado" },
        true,
      ),
    ).toEqual({ name: "Supino inclinado", usesOriginalName: true });
  });

  it("traduz padrões conhecidos e normaliza padrões futuros", () => {
    expect(workoutMovementPatternLabel("horizontal_push", false)).toBe(
      "Empurrada horizontal",
    );
    expect(workoutMovementPatternLabel("horizontal_push", true)).toBe(
      "Horizontal push",
    );
    expect(workoutMovementPatternLabel("calf-raise", true)).toBe(
      "Calf raise",
    );
  });

  it("não vaza explicação de técnica em português na interface inglesa", () => {
    expect(
      localizeWorkoutTechnique(
        {
          namePt: "Bi-set",
          nameEn: "Bi-set",
          summaryPt: "Dois exercícios sem descanso.",
          summaryEn: "Dois exercícios sem descanso.",
          instructionsPt: ["Faça em sequência."],
          instructionsEn: ["Faça em sequência."],
        },
        true,
      ),
    ).toMatchObject({
      name: "Bi-set",
      summary: "English explanation is not available yet.",
      instructions: [],
      usesOriginalName: true,
      translationPending: true,
    });
  });
});

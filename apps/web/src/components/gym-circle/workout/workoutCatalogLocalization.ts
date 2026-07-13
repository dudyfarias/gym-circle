import type {
  WorkoutExerciseCatalogItem,
  WorkoutTechniqueCatalogItem,
} from "../social/types";
import { normalizeWorkoutCatalogText } from "./useWorkoutCatalog";

function hasEnglishTranslation(portuguese: string, english: string): boolean {
  const translated = english.trim();
  if (!translated) return false;
  return (
    normalizeWorkoutCatalogText(translated) !==
    normalizeWorkoutCatalogText(portuguese)
  );
}

function arraysMatch(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every(
    (item, index) =>
      normalizeWorkoutCatalogText(item) ===
      normalizeWorkoutCatalogText(right[index] ?? ""),
  );
}

export type LocalizedWorkoutExercise = {
  name: string;
  description: string;
  instructions: string[];
  usesOriginalName: boolean;
  translationPending: boolean;
};

/**
 * Conteúdo legado muitas vezes repetia PT em name_en/description_en. Em EN,
 * mantemos apenas o nome original identificado como tal e nunca apresentamos
 * descrição/instruções em português como se fossem tradução.
 */
export function localizeWorkoutExercise(
  exercise: Pick<
    WorkoutExerciseCatalogItem,
    | "namePt"
    | "nameEn"
    | "descriptionPt"
    | "descriptionEn"
    | "instructionsPt"
    | "instructionsEn"
  >,
  english: boolean,
): LocalizedWorkoutExercise {
  if (!english) {
    return {
      name: exercise.namePt,
      description: exercise.descriptionPt,
      instructions: exercise.instructionsPt,
      usesOriginalName: false,
      translationPending: false,
    };
  }

  const translatedName = hasEnglishTranslation(
    exercise.namePt,
    exercise.nameEn,
  );
  const translatedDescription = hasEnglishTranslation(
    exercise.descriptionPt,
    exercise.descriptionEn,
  );
  const translatedInstructions =
    exercise.instructionsPt.length === 0 ||
    (exercise.instructionsEn.length > 0 &&
      !arraysMatch(exercise.instructionsPt, exercise.instructionsEn));

  return {
    name: translatedName ? exercise.nameEn : exercise.namePt,
    description: translatedDescription
      ? exercise.descriptionEn
      : "English description is not available yet.",
    instructions: translatedInstructions ? exercise.instructionsEn : [],
    usesOriginalName: !translatedName,
    translationPending:
      !translatedName || !translatedDescription || !translatedInstructions,
  };
}

export function localizeWorkoutVariationName(
  variation: Pick<WorkoutExerciseCatalogItem, "namePt" | "nameEn">,
  english: boolean,
) {
  if (!english) return { name: variation.namePt, usesOriginalName: false };
  const translated = hasEnglishTranslation(variation.namePt, variation.nameEn);
  return {
    name: translated ? variation.nameEn : variation.namePt,
    usesOriginalName: !translated,
  };
}

export function localizeWorkoutTechnique(
  technique: Pick<
    WorkoutTechniqueCatalogItem,
    | "namePt"
    | "nameEn"
    | "summaryPt"
    | "summaryEn"
    | "instructionsPt"
    | "instructionsEn"
  >,
  english: boolean,
) {
  if (!english) {
    return {
      name: technique.namePt,
      summary: technique.summaryPt,
      instructions: technique.instructionsPt,
      usesOriginalName: false,
      translationPending: false,
    };
  }
  const translatedName = hasEnglishTranslation(
    technique.namePt,
    technique.nameEn,
  );
  const translatedSummary = hasEnglishTranslation(
    technique.summaryPt,
    technique.summaryEn,
  );
  const translatedInstructions =
    technique.instructionsPt.length === 0 ||
    (technique.instructionsEn.length > 0 &&
      !arraysMatch(technique.instructionsPt, technique.instructionsEn));
  return {
    name: translatedName ? technique.nameEn : technique.namePt,
    summary: translatedSummary
      ? technique.summaryEn
      : "English explanation is not available yet.",
    instructions: translatedInstructions ? technique.instructionsEn : [],
    usesOriginalName: !translatedName,
    translationPending:
      !translatedName || !translatedSummary || !translatedInstructions,
  };
}

const MOVEMENT_PATTERN_LABELS: Record<string, { pt: string; en: string }> = {
  carry: { pt: "Transporte", en: "Carry" },
  core: { pt: "Core", en: "Core" },
  elbow_flexion: { pt: "Flexão de cotovelo", en: "Elbow flexion" },
  elbow_extension: { pt: "Extensão de cotovelo", en: "Elbow extension" },
  hinge: { pt: "Dobradiça de quadril", en: "Hip hinge" },
  horizontal_pull: { pt: "Puxada horizontal", en: "Horizontal pull" },
  horizontal_push: { pt: "Empurrada horizontal", en: "Horizontal push" },
  isolation: { pt: "Isolamento", en: "Isolation" },
  lunge: { pt: "Avanço", en: "Lunge" },
  squat: { pt: "Agachamento", en: "Squat" },
  vertical_pull: { pt: "Puxada vertical", en: "Vertical pull" },
  vertical_push: { pt: "Empurrada vertical", en: "Vertical push" },
};

export function workoutMovementPatternLabel(
  pattern: string,
  english: boolean,
): string {
  const normalized = pattern.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const known = MOVEMENT_PATTERN_LABELS[normalized];
  if (known) return english ? known.en : known.pt;
  return normalized
    .replace(/_/g, " ")
    .replace(/^./, (letter) => letter.toLocaleUpperCase(english ? "en" : "pt-BR"));
}

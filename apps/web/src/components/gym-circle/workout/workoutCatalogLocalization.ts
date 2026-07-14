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
  anti_extension: { pt: "Anti-extensão", en: "Anti-extension" },
  calf_raise: { pt: "Elevação de panturrilha", en: "Calf raise" },
  chest_complex: { pt: "Complexo de peitoral", en: "Chest complex" },
  chest_fly: { pt: "Crucifixo", en: "Chest fly" },
  elbow_flexion: { pt: "Flexão de cotovelo", en: "Elbow flexion" },
  elbow_extension: { pt: "Extensão de cotovelo", en: "Elbow extension" },
  hinge: { pt: "Dobradiça de quadril", en: "Hip hinge" },
  hip_abduction: { pt: "Abdução de quadril", en: "Hip abduction" },
  hip_adduction: { pt: "Adução de quadril", en: "Hip adduction" },
  hip_extension: { pt: "Extensão de quadril", en: "Hip extension" },
  horizontal_abduction: {
    pt: "Abdução horizontal",
    en: "Horizontal abduction",
  },
  horizontal_pull: { pt: "Puxada horizontal", en: "Horizontal pull" },
  horizontal_push: { pt: "Empurrada horizontal", en: "Horizontal push" },
  isolation: { pt: "Isolamento", en: "Isolation" },
  knee_extension: { pt: "Extensão de joelho", en: "Knee extension" },
  knee_flexion: { pt: "Flexão de joelho", en: "Knee flexion" },
  lunge: { pt: "Avanço", en: "Lunge" },
  squat: { pt: "Agachamento", en: "Squat" },
  scapular_elevation: { pt: "Elevação escapular", en: "Scapular elevation" },
  shoulder_abduction: { pt: "Abdução de ombro", en: "Shoulder abduction" },
  shoulder_extension: { pt: "Extensão de ombro", en: "Shoulder extension" },
  shoulder_flexion: { pt: "Flexão de ombro", en: "Shoulder flexion" },
  trunk_flexion: { pt: "Flexão de tronco", en: "Trunk flexion" },
  warmup: { pt: "Aquecimento", en: "Warm-up" },
  wrist_flexion: { pt: "Flexão de punho", en: "Wrist flexion" },
  forearm_rotation: { pt: "Rotação do antebraço", en: "Forearm rotation" },
  external_rotation: { pt: "Rotação externa", en: "External rotation" },
  face_pull: { pt: "Face pull", en: "Face pull" },
  mobility: { pt: "Mobilidade", en: "Mobility" },
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

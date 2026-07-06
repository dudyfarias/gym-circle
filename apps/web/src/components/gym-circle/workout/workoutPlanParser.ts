import type { WorkoutPlanExercise } from "../social/types";

export type ParsedWorkoutPlan = {
  name: string;
  exercises: WorkoutPlanExercise[];
  sourceText: string;
};

const HEADER_PATTERN =
  /^(exerc[ií]cio|exercise|movimento|s[eé]ries?|sets?|reps?|repeti[cç][oõ]es?|carga|peso)(\s+|$)/i;

function cleanLine(line: string): string {
  return line
    .replace(/^[\s•●▪◦*\-–—]+/, "")
    .replace(/^\d{1,3}[.)]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function boundedInt(value: string, max: number): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, max);
}

function exercise(
  name: string,
  sets: string,
  reps: string,
): WorkoutPlanExercise | null {
  const cleanedName = name
    .replace(/[\s:;,\-–—]+$/, "")
    .replace(/^(exerc[ií]cio|exercise)\s*[:\-–—]?\s*/i, "")
    .trim();
  if (!cleanedName || HEADER_PATTERN.test(cleanedName)) return null;
  const parsedSets = boundedInt(sets, 20);
  const parsedReps = boundedInt(reps, 999);
  if (!parsedSets || !parsedReps) return null;
  return { name: cleanedName, sets: parsedSets, reps: parsedReps };
}

function parseExerciseLine(line: string): WorkoutPlanExercise | null {
  const patterns: RegExp[] = [
    // Supino reto 4x10 / Supino reto — 4 × 10 reps
    /^(.+?)\s*(?:[-–—:]\s*)?(\d{1,2})\s*[x×]\s*(\d{1,3})(?:\s*(?:reps?|repeti[cç][oõ]es?))?.*$/i,
    // Supino reto — 4 séries de 10 repetições
    /^(.+?)\s*(?:[-–—:]\s*)?(\d{1,2})\s*(?:s[eé]ries?|sets?)\s*(?:de\s*)?(\d{1,3})(?:\s*(?:reps?|repeti[cç][oõ]es?))?.*$/i,
    // Supino reto  4  10 (colunas extraídas de tabela/PDF)
    /^(.+?)\s{2,}(\d{1,2})\s+(\d{1,3})(?:\s|$).*$/i,
    // pdf.js pode normalizar as colunas para um único espaço.
    /^(.+?)\s+(\d{1,2})\s+(\d{1,3})$/i,
    // Supino reto;4;10 / Supino reto,4,10
    /^(.+?)[;,]\s*(\d{1,2})\s*[;,]\s*(\d{1,3})(?:\s|$).*$/i,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) return exercise(match[1], match[2], match[3]);
  }
  return null;
}

function fallbackName(fileName?: string): string {
  const raw = fileName?.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return raw || "Minha planilha";
}

export function parseWorkoutPlanText(
  sourceText: string,
  fileName?: string,
): ParsedWorkoutPlan {
  const lines = sourceText
    .replace(/\r/g, "\n")
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);

  const exercises: WorkoutPlanExercise[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (HEADER_PATTERN.test(line)) continue;
    const parsed = parseExerciseLine(line);
    if (!parsed) continue;
    const key = `${parsed.name.toLocaleLowerCase("pt-BR")}|${parsed.sets}|${parsed.reps}`;
    if (seen.has(key)) continue;
    seen.add(key);
    exercises.push(parsed);
  }

  const firstTextLine = lines.find(
    (line) => !HEADER_PATTERN.test(line) && !parseExerciseLine(line),
  );

  return {
    name: firstTextLine?.slice(0, 80) || fallbackName(fileName),
    exercises,
    sourceText,
  };
}

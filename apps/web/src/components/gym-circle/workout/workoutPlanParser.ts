import type { WorkoutPlanExercise } from "../social/types";

export type ParsedWorkoutPlan = {
  name: string;
  exercises: WorkoutPlanExercise[];
  sourceText: string;
};

const HEADER_PATTERN =
  /^(exerc[ií]cios?|exercise|movimento|s\s*[x×]\s*r|s[eé]ries?|sets?|reps?|repeti[cç][oõ]es?|t[eé]cnica(?:\s+avan[cç]ada)?|carga|peso)(\s+|$)/i;
const FOOTER_PATTERN =
  /^(intervalo|descanso\s+entre|observa[cç][oõ]es?|treino\s+de\s+\d+\s*(?:min|h))/i;

function cleanLine(line: string): string {
  return line
    .replace(/[|[\]{}]+/g, " ")
    .replace(/^[\s•●▪◦*'`~=\-–—_]+/, "")
    .replace(/^\d{1,3}[.)]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function boundedInt(value: string, max: number): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, max);
}

function cleanExerciseName(name: string): string {
  return name
    .replace(/[\s:;,\-–—]+$/, "")
    .replace(/^(exerc[ií]cios?|exercise)\s*[:\-–—]?\s*/i, "")
    .trim();
}

function techniqueFromText(raw: string): {
  techniqueName?: string;
  techniqueNotes?: string;
} {
  const text = raw
    .replace(/^[\s+=,:;\-–—]+/, "")
    .replace(/[\s+=,:;\-–—]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return {};

  let techniqueName: string | undefined;
  if (/\bfst\s*[- ]?\s*7\b/i.test(text)) techniqueName = "FST-7";
  else if (/\bgvt\b/i.test(text)) techniqueName = "GVT";
  else if (/\bbi\s*[- ]?\s*set\b|\bsuperset\b|super\s*s[eé]rie/i.test(text)) {
    techniqueName = "Bi-Set";
  } else if (/\brest\s*(?:['’]?\s*n\s*['’]?\s*)?pause\b/i.test(text)) {
    techniqueName = "Rest ’n’ Pause";
  } else if (/\bdrop(?:s|\s*[- ]?\s*set)?\b/i.test(text)) {
    techniqueName = "Drop-Set";
  }

  return {
    ...(techniqueName ? { techniqueName } : {}),
    techniqueNotes: text,
  };
}

function exercise(
  name: string,
  sets: string,
  target: string,
  suffix = "",
): WorkoutPlanExercise | null {
  const cleanedName = cleanExerciseName(name);
  if (
    !cleanedName ||
    HEADER_PATTERN.test(cleanedName) ||
    FOOTER_PATTERN.test(cleanedName)
  ) {
    return null;
  }
  const parsedSets = boundedInt(sets, 20);
  if (!parsedSets) return null;

  const normalizedTarget = target.trim().toLocaleLowerCase("pt-BR");
  if (/^(f|falha|failure)$/.test(normalizedTarget)) {
    const technique = techniqueFromText(suffix);
    return {
      name: cleanedName,
      sets: parsedSets,
      reps: null,
      targetKind: "failure",
      techniqueName: technique.techniqueName ?? "Até a falha",
      ...(technique.techniqueNotes
        ? { techniqueNotes: technique.techniqueNotes }
        : {}),
    };
  }

  const durationMatch = normalizedTarget.match(/^(\d{1,4})\s*s(?:eg(?:undos?)?)?$/i);
  if (durationMatch) {
    const seconds = boundedInt(durationMatch[1], 3600);
    if (!seconds) return null;
    const technique = techniqueFromText(suffix);
    return {
      name: cleanedName,
      sets: parsedSets,
      reps: null,
      targetKind: "duration",
      durationSeconds: seconds,
      techniqueName: technique.techniqueName ?? "Por tempo",
      ...(technique.techniqueNotes
        ? { techniqueNotes: technique.techniqueNotes }
        : {}),
    };
  }

  const parsedReps = boundedInt(normalizedTarget, 999);
  if (!parsedReps) return null;
  const technique = techniqueFromText(suffix);
  return {
    name: cleanedName,
    sets: parsedSets,
    reps: parsedReps,
    ...(technique.techniqueName
      ? { techniqueName: technique.techniqueName }
      : {}),
    ...(technique.techniqueNotes
      ? { techniqueNotes: technique.techniqueNotes }
      : {}),
  };
}

function parseExerciseLine(line: string): WorkoutPlanExercise | null {
  const target = String.raw`(?:\d{1,4}\s*s(?:eg(?:undos?)?)?|[fF](?:alha)?|\d{1,3})`;
  const patterns: RegExp[] = [
    // Supino 4x10; Alongamento 3x30s; Mergulho 4xF; aceita técnica depois.
    new RegExp(
      String.raw`^(.+?)\s*(?:[-–—:]\s*)?(\d{1,2})\s*[x×]\s*(${target})(?:\s*(?:reps?\b|repeti[cç][oõ]es?))?(.*)$`,
      "i",
    ),
    // Supino — 4 séries de 10 repetições
    /^(.+?)\s*(?:[-–—:]\s*)?(\d{1,2})\s*(?:s[eé]ries?|sets?)\s*(?:de\s*)?(\d{1,3})(?:\s*(?:reps?\b|repeti[cç][oõ]es?))?(.*)$/i,
    // Supino  4  10 (colunas extraídas de tabela/PDF)
    /^(.+?)\s{2,}(\d{1,2})\s+(\d{1,3})(?:\s|$)(.*)$/i,
    // pdf.js pode normalizar as colunas para um único espaço.
    /^(.+?)\s+(\d{1,2})\s+(\d{1,3})$/i,
    // Supino;4;10 / Supino,4,10
    /^(.+?)[;,]\s*(\d{1,2})\s*[;,]\s*(\d{1,3})(?:\s|$)(.*)$/i,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) return exercise(match[1], match[2], match[3], match[4] ?? "");
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
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (HEADER_PATTERN.test(line) || FOOTER_PATTERN.test(line)) continue;
    let parsed = parseExerciseLine(line);

    // Alguns OCRs separam a prescrição em uma linha própria:
    // "Supino reto" + "4x10 Drop-Set".
    if (!parsed && index + 1 < lines.length) {
      const next = lines[index + 1];
      if (/^\d{1,2}\s*[x×]/i.test(next)) {
        parsed = parseExerciseLine(`${line} ${next}`);
        if (parsed) index += 1;
      }
    }

    if (!parsed) continue;
    const key = [
      parsed.name.toLocaleLowerCase("pt-BR"),
      parsed.sets,
      parsed.reps,
      parsed.targetKind ?? "reps",
      parsed.durationSeconds ?? "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    exercises.push(parsed);
  }

  const firstTextLine = lines.find(
    (line) =>
      !HEADER_PATTERN.test(line) &&
      !FOOTER_PATTERN.test(line) &&
      !parseExerciseLine(line) &&
      !/^\d{1,2}\s*[x×]/i.test(line),
  );

  return {
    name: firstTextLine?.slice(0, 80) || fallbackName(fileName),
    exercises,
    sourceText,
  };
}

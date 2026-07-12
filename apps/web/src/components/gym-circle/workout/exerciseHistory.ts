import type { StrengthSet } from "../social/types";

/**
 * Sprint 2 (Treinos) — histórico por exercício e comparação com o treino
 * anterior, calculados client-side a partir de `activities.strength_sets`
 * (jsonb, snake_case) do PRÓPRIO usuário. Dataset pequeno hoje; quando o
 * volume crescer, esta lógica migra pra RPC (`get_exercise_progress`).
 */

/** Row de activities como vem do banco (snake_case, jsonb livre). */
export type ExerciseHistoryActivityRow = {
  id: string;
  started_at: string | null;
  ended_at: string | null;
  strength_sets:
    | Array<{
        reps?: number | null;
        weight_kg?: number | null;
        exercise?: string | null;
        exercise_id?: string | null;
      }>
    | null;
};

export type ExerciseHistorySet = { reps: number; weightKg: number | null };

export type ExerciseHistoryEntry = {
  activityId: string;
  /** ISO — started_at (fallback ended_at). */
  performedAt: string;
  sets: ExerciseHistorySet[];
  /** Maior carga (desempate: mais reps); sem carga → série de mais reps. */
  bestSet: ExerciseHistorySet | null;
  maxWeightKg: number | null;
  totalReps: number;
  totalVolumeKg: number;
};

export type WorkoutComparison = {
  previousDate: string;
  deltaReps: number;
  deltaVolumeKg: number;
  /** Exercícios em comum cuja maior carga subiu vs o treino anterior. */
  improvedExercises: string[];
};

/**
 * Chave estável de agrupamento: exercise_id do catálogo quando existe
 * (produção: 100% dos sets têm), senão nome normalizado.
 */
export function exerciseHistoryKey(
  exerciseId: string | null | undefined,
  name: string | null | undefined,
): string | null {
  if (exerciseId) return exerciseId;
  const normalized = (name ?? "").trim().toLocaleLowerCase("pt-BR");
  return normalized ? `name:${normalized}` : null;
}

function betterSet(
  a: ExerciseHistorySet | null,
  b: ExerciseHistorySet,
): ExerciseHistorySet {
  if (!a) return b;
  const aW = a.weightKg ?? 0;
  const bW = b.weightKg ?? 0;
  if (bW !== aW) return bW > aW ? b : a;
  return b.reps > a.reps ? b : a;
}

function entryFromSets(
  activityId: string,
  performedAt: string,
  sets: ExerciseHistorySet[],
): ExerciseHistoryEntry {
  let bestSet: ExerciseHistorySet | null = null;
  let maxWeightKg: number | null = null;
  let totalReps = 0;
  let totalVolumeKg = 0;
  for (const set of sets) {
    bestSet = betterSet(bestSet, set);
    if (set.weightKg != null && set.weightKg > 0) {
      maxWeightKg = Math.max(maxWeightKg ?? 0, set.weightKg);
      totalVolumeKg += set.reps * set.weightKg;
    }
    totalReps += set.reps;
  }
  return {
    activityId,
    performedAt,
    sets,
    bestSet,
    maxWeightKg,
    totalReps,
    totalVolumeKg: Math.round(totalVolumeKg * 100) / 100,
  };
}

function rowSetsByKey(
  row: ExerciseHistoryActivityRow,
): Map<string, ExerciseHistorySet[]> {
  const byKey = new Map<string, ExerciseHistorySet[]>();
  for (const raw of row.strength_sets ?? []) {
    const reps = typeof raw.reps === "number" && raw.reps > 0 ? raw.reps : 0;
    if (reps <= 0) continue;
    const key = exerciseHistoryKey(raw.exercise_id, raw.exercise);
    if (!key) continue;
    const set: ExerciseHistorySet = {
      reps,
      weightKg:
        typeof raw.weight_kg === "number" && raw.weight_kg > 0
          ? raw.weight_kg
          : null,
    };
    const list = byKey.get(key);
    if (list) list.push(set);
    else byKey.set(key, [set]);
  }
  return byKey;
}

/**
 * Constrói o histórico por exercício. `rows` deve vir ordenado do mais
 * recente pro mais antigo (a ordem é preservada nas entries).
 */
export function buildExerciseHistory(
  rows: ExerciseHistoryActivityRow[],
): Map<string, ExerciseHistoryEntry[]> {
  const history = new Map<string, ExerciseHistoryEntry[]>();
  for (const row of rows) {
    const performedAt = row.started_at ?? row.ended_at;
    if (!performedAt) continue;
    for (const [key, sets] of rowSetsByKey(row)) {
      const entry = entryFromSets(row.id, performedAt, sets);
      const list = history.get(key);
      if (list) list.push(entry);
      else history.set(key, [entry]);
    }
  }
  return history;
}

/** "3×10 · 20 kg" (sem carga: "3×10"). Vazio quando não há séries. */
export function lastPerformanceLabel(entry: ExerciseHistoryEntry): string {
  if (!entry.bestSet) return "";
  const base = `${entry.sets.length}×${entry.bestSet.reps}`;
  const weight = entry.bestSet.weightKg;
  if (weight == null) return base;
  const label = Number.isInteger(weight)
    ? String(weight)
    : weight.toFixed(1).replace(/\.0$/, "");
  return `${base} · ${label} kg`;
}

function currentTotalsByKey(sets: StrengthSet[]) {
  const byKey = new Map<string, { name: string; maxWeightKg: number | null }>();
  let totalReps = 0;
  let totalVolumeKg = 0;
  for (const set of sets) {
    if (!set.reps || set.reps <= 0) continue;
    totalReps += set.reps;
    const weight = set.weightKg != null && set.weightKg > 0 ? set.weightKg : null;
    if (weight != null) totalVolumeKg += set.reps * weight;
    const key = exerciseHistoryKey(set.exerciseId, set.exercise);
    if (!key) continue;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, { name: set.exercise ?? "", maxWeightKg: weight });
    } else if (weight != null && weight > (current.maxWeightKg ?? 0)) {
      current.maxWeightKg = weight;
    }
  }
  return { byKey, totalReps, totalVolumeKg };
}

/**
 * Compara o treino recém-concluído (sets camelCase, já filtrados pra
 * concluídos) com a última sessão de força ANTERIOR (row do banco).
 * null quando não há treino anterior ou nada comparável.
 */
export function buildWorkoutComparison(
  currentSets: StrengthSet[],
  previous: ExerciseHistoryActivityRow | null | undefined,
): WorkoutComparison | null {
  if (!previous) return null;
  const previousDate = previous.started_at ?? previous.ended_at;
  if (!previousDate) return null;

  const current = currentTotalsByKey(currentSets);
  if (current.totalReps <= 0) return null;

  let previousReps = 0;
  let previousVolumeKg = 0;
  const previousMaxByKey = new Map<string, number>();
  for (const [key, sets] of rowSetsByKey(previous)) {
    for (const set of sets) {
      previousReps += set.reps;
      if (set.weightKg != null) {
        previousVolumeKg += set.reps * set.weightKg;
        previousMaxByKey.set(
          key,
          Math.max(previousMaxByKey.get(key) ?? 0, set.weightKg),
        );
      }
    }
  }
  if (previousReps <= 0) return null;

  const improvedExercises: string[] = [];
  for (const [key, info] of current.byKey) {
    const previousMax = previousMaxByKey.get(key);
    if (
      previousMax != null &&
      info.maxWeightKg != null &&
      info.maxWeightKg > previousMax &&
      info.name
    ) {
      improvedExercises.push(info.name);
    }
  }

  return {
    previousDate,
    deltaReps: current.totalReps - previousReps,
    deltaVolumeKg:
      Math.round((current.totalVolumeKg - previousVolumeKg) * 100) / 100,
    improvedExercises,
  };
}

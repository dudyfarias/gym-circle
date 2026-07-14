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
        target_kind?: "reps" | "failure" | "duration" | null;
        duration_seconds?: number | null;
      }>
    | null;
  workout_exercise_context?:
    | Array<{
        exercise?: string | null;
        exercise_id?: string | null;
        exerciseId?: string | null;
        note?: string | null;
      }>
    | null;
};

export type ExerciseHistorySet = {
  reps: number;
  weightKg: number | null;
  targetKind: "reps" | "failure" | "duration";
  durationSeconds: number | null;
};

export type ExerciseHistoryBestSet = {
  reps: number;
  weightKg: number | null;
};

export type ExerciseHistoryEntry = {
  activityId: string;
  /** ISO — started_at (fallback ended_at). */
  performedAt: string;
  sets: ExerciseHistorySet[];
  /** Maior carga (desempate: mais reps); sem carga → série de mais reps. */
  bestSet: ExerciseHistoryBestSet | null;
  maxWeightKg: number | null;
  totalReps: number;
  totalVolumeKg: number;
  totalDurationSeconds: number;
};

export type WorkoutComparison = {
  previousDate: string;
  deltaReps: number;
  deltaVolumeKg: number;
  deltaDurationSeconds: number;
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
  a: ExerciseHistoryBestSet | null,
  b: ExerciseHistorySet,
): ExerciseHistoryBestSet {
  const candidate = { reps: b.reps, weightKg: b.weightKg };
  if (!a) return candidate;
  const aW = a.weightKg ?? 0;
  const bW = b.weightKg ?? 0;
  if (bW !== aW) return bW > aW ? candidate : a;
  return b.reps > a.reps ? candidate : a;
}

function entryFromSets(
  activityId: string,
  performedAt: string,
  sets: ExerciseHistorySet[],
): ExerciseHistoryEntry {
  let bestSet: ExerciseHistoryBestSet | null = null;
  let maxWeightKg: number | null = null;
  let totalReps = 0;
  let totalVolumeKg = 0;
  let totalDurationSeconds = 0;
  for (const set of sets) {
    if (set.reps > 0) bestSet = betterSet(bestSet, set);
    if (set.weightKg != null && set.weightKg > 0) {
      maxWeightKg = Math.max(maxWeightKg ?? 0, set.weightKg);
      totalVolumeKg += set.reps * set.weightKg;
    }
    totalReps += set.reps;
    totalDurationSeconds += set.durationSeconds ?? 0;
  }
  return {
    activityId,
    performedAt,
    sets,
    bestSet,
    maxWeightKg,
    totalReps,
    totalVolumeKg: Math.round(totalVolumeKg * 100) / 100,
    totalDurationSeconds,
  };
}

function rowSetsByKey(
  row: ExerciseHistoryActivityRow,
): Map<string, ExerciseHistorySet[]> {
  const byKey = new Map<string, ExerciseHistorySet[]>();
  for (const raw of row.strength_sets ?? []) {
    const targetKind =
      raw.target_kind === "failure" || raw.target_kind === "duration"
        ? raw.target_kind
        : "reps";
    const reps = typeof raw.reps === "number" && raw.reps > 0 ? raw.reps : 0;
    const durationSeconds =
      typeof raw.duration_seconds === "number" && raw.duration_seconds > 0
        ? Math.round(raw.duration_seconds)
        : null;
    if (reps <= 0 && durationSeconds == null) continue;
    const key = exerciseHistoryKey(raw.exercise_id, raw.exercise);
    if (!key) continue;
    const set: ExerciseHistorySet = {
      reps,
      weightKg:
        typeof raw.weight_kg === "number" && raw.weight_kg > 0
          ? raw.weight_kg
          : null,
      targetKind,
      durationSeconds,
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

/** Última nota não vazia por exercício; rows devem vir do mais recente. */
export function buildLatestExerciseNotes(
  rows: ExerciseHistoryActivityRow[],
): Map<string, string> {
  const notes = new Map<string, string>();
  for (const row of rows) {
    for (const context of row.workout_exercise_context ?? []) {
      const key = exerciseHistoryKey(
        context.exercise_id ?? context.exerciseId,
        context.exercise,
      );
      const note = context.note?.trim();
      if (key && note && !notes.has(key)) notes.set(key, note);
    }
  }
  return notes;
}

/** Melhor série da sessão. Vazio quando o exercício foi apenas por duração. */
export function lastPerformanceLabel(entry: ExerciseHistoryEntry): string {
  if (!entry.bestSet) {
    return entry.totalDurationSeconds > 0
      ? `${entry.totalDurationSeconds}s`
      : "";
  }
  const base = `${entry.bestSet.reps} ×`;
  const weight = entry.bestSet.weightKg;
  if (weight == null) return `${entry.bestSet.reps} reps`;
  const label = Number.isInteger(weight)
    ? String(weight)
    : weight.toFixed(1).replace(/\.0$/, "");
  return `${base} ${label} kg`;
}

function currentTotalsByKey(sets: StrengthSet[]) {
  const byKey = new Map<
    string,
    {
      name: string;
      maxWeightKg: number | null;
      totalReps: number;
      totalVolumeKg: number;
      totalDurationSeconds: number;
    }
  >();
  for (const set of sets) {
    const durationSeconds =
      set.targetKind === "duration" &&
      set.durationSeconds != null &&
      set.durationSeconds > 0
        ? Math.round(set.durationSeconds)
        : 0;
    if ((!set.reps || set.reps <= 0) && durationSeconds <= 0) continue;
    const weight = set.weightKg != null && set.weightKg > 0 ? set.weightKg : null;
    const volume = weight != null ? set.reps * weight : 0;
    const key = exerciseHistoryKey(set.exerciseId, set.exercise);
    if (!key) continue;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, {
        name: set.exercise ?? "",
        maxWeightKg: weight,
        totalReps: set.reps,
        totalVolumeKg: volume,
        totalDurationSeconds: durationSeconds,
      });
    } else {
      current.totalReps += set.reps;
      current.totalVolumeKg += volume;
      current.totalDurationSeconds += durationSeconds;
      if (weight != null && weight > (current.maxWeightKg ?? 0)) {
        current.maxWeightKg = weight;
      }
    }
  }
  return byKey;
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

  const currentByKey = currentTotalsByKey(currentSets);
  if (currentByKey.size === 0) return null;

  const previousByKey = new Map<
    string,
    {
      totalReps: number;
      totalVolumeKg: number;
      totalDurationSeconds: number;
      maxWeightKg: number | null;
    }
  >();
  for (const [key, sets] of rowSetsByKey(previous)) {
    let totalReps = 0;
    let totalVolumeKg = 0;
    let totalDurationSeconds = 0;
    let maxWeightKg: number | null = null;
    for (const set of sets) {
      totalReps += set.reps;
      if (set.weightKg != null) {
        totalVolumeKg += set.reps * set.weightKg;
        maxWeightKg = Math.max(maxWeightKg ?? 0, set.weightKg);
      }
      totalDurationSeconds += set.durationSeconds ?? 0;
    }
    previousByKey.set(key, {
      totalReps,
      totalVolumeKg,
      totalDurationSeconds,
      maxWeightKg,
    });
  }

  let currentReps = 0;
  let currentVolumeKg = 0;
  let previousReps = 0;
  let previousVolumeKg = 0;
  let currentDurationSeconds = 0;
  let previousDurationSeconds = 0;
  let comparableExerciseCount = 0;
  const improvedExercises: string[] = [];
  for (const [key, info] of currentByKey) {
    const previousInfo = previousByKey.get(key);
    if (!previousInfo) continue;
    comparableExerciseCount += 1;
    currentReps += info.totalReps;
    currentVolumeKg += info.totalVolumeKg;
    previousReps += previousInfo.totalReps;
    previousVolumeKg += previousInfo.totalVolumeKg;
    currentDurationSeconds += info.totalDurationSeconds;
    previousDurationSeconds += previousInfo.totalDurationSeconds;
    const previousMax = previousInfo.maxWeightKg;
    if (
      previousMax != null &&
      info.maxWeightKg != null &&
      info.maxWeightKg > previousMax &&
      info.name
    ) {
      improvedExercises.push(info.name);
    }
  }

  if (comparableExerciseCount === 0) return null;
  if (
    currentReps <= 0 &&
    previousReps <= 0 &&
    currentDurationSeconds <= 0 &&
    previousDurationSeconds <= 0
  ) {
    return null;
  }

  return {
    previousDate,
    deltaReps: currentReps - previousReps,
    deltaVolumeKg:
      Math.round((currentVolumeKg - previousVolumeKg) * 100) / 100,
    deltaDurationSeconds: currentDurationSeconds - previousDurationSeconds,
    improvedExercises,
  };
}

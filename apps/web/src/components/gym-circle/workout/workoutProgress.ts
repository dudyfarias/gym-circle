import { getGymCircleDateKey } from "@gym-circle/core";

export const WORKOUT_PROGRESS_DAYS = 84;
export const WORKOUT_PROGRESS_ACTIVITY_LIMIT = 200;
export const WORKOUT_PROGRESS_WEEK_COUNT = 12;
export const UNKNOWN_MUSCLE_GROUP_SLUG = "other";

export type WorkoutProgressTargetKind = "reps" | "failure" | "duration";

export type WorkoutProgressStrengthSetRow = {
  reps?: number | string | null;
  weight_kg?: number | string | null;
  exercise?: string | null;
  exercise_id?: string | null;
  target_kind?: WorkoutProgressTargetKind | null;
  duration_seconds?: number | string | null;
};

/** Shape mínimo carregado de `activities` para os analytics de treino. */
export type WorkoutProgressActivityRow = {
  id: string;
  activity_type: string;
  workout_date: string;
  started_at: string | null;
  ended_at: string | null;
  elapsed_s: number | string | null;
  strength_sets: WorkoutProgressStrengthSetRow[] | null;
};

/** Shape mínimo do catálogo necessário para atribuir grupo muscular. */
export type WorkoutProgressCatalogRow = {
  id: string;
  primary_muscle_group_slug: string | null;
};

export type WorkoutProgressPoint = {
  activityId: string;
  performedAt: string;
  workoutDate: string;
  setCount: number;
  weightedSetCount: number;
  failureSetCount: number;
  durationSetCount: number;
  maxWeightKg: number | null;
  totalVolumeKg: number;
  totalReps: number;
  totalDurationSeconds: number;
};

export type WorkoutExerciseProgress = {
  key: string;
  exerciseId: string | null;
  exerciseName: string;
  primaryMuscleGroupSlug: string;
  sessionCount: number;
  setCount: number;
  weightedSetCount: number;
  maxWeightKg: number | null;
  totalVolumeKg: number;
  totalReps: number;
  totalDurationSeconds: number;
  lastPerformedAt: string;
  /** Ordem cronológica, pronta para gráfico. */
  points: WorkoutProgressPoint[];
};

export type WorkoutWeekProgress = {
  weekStart: string;
  weekEnd: string;
  sessionCount: number;
  strengthSessionCount: number;
  activeDays: number;
  totalDurationSeconds: number;
  totalSets: number;
  totalReps: number;
  totalVolumeKg: number;
  totalTimedExerciseSeconds: number;
};

export type WorkoutMuscleGroupProgress = {
  slug: string;
  sessionCount: number;
  exerciseCount: number;
  setCount: number;
  totalReps: number;
  totalVolumeKg: number;
  totalDurationSeconds: number;
};

export type WorkoutProgressOverview = {
  sessionCount: number;
  strengthSessionCount: number;
  activeDays: number;
  exerciseCount: number;
  totalDurationSeconds: number;
  totalSets: number;
  totalReps: number;
  totalVolumeKg: number;
  totalTimedExerciseSeconds: number;
};

export type WorkoutProgressSnapshot = {
  range: { from: string; to: string; days: number };
  overview: WorkoutProgressOverview;
  weeks: WorkoutWeekProgress[];
  exercises: WorkoutExerciseProgress[];
  muscleGroups: WorkoutMuscleGroupProgress[];
};

type NormalizedSet = {
  key: string;
  exerciseId: string | null;
  exerciseName: string;
  targetKind: WorkoutProgressTargetKind;
  reps: number;
  weightKg: number | null;
  durationSeconds: number;
};

type ExerciseAccumulator = {
  exerciseId: string | null;
  exerciseName: string;
  primaryMuscleGroupSlug: string;
  points: Map<string, WorkoutProgressPoint>;
};

type MuscleGroupAccumulator = {
  activityIds: Set<string>;
  exerciseKeys: Set<string>;
  setCount: number;
  totalReps: number;
  totalVolumeKg: number;
  totalDurationSeconds: number;
};

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function positiveNumber(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function dateFromKey(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addWorkoutProgressDays(
  value: string,
  amount: number,
): string {
  const date = dateFromKey(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() + amount);
  return dateKey(date);
}

export function workoutProgressRange(
  today = getGymCircleDateKey(),
  days = WORKOUT_PROGRESS_DAYS,
) {
  const safeDays = Math.max(1, Math.floor(days));
  return {
    from: addWorkoutProgressDays(today, -(safeDays - 1)),
    to: today,
    days: safeDays,
  };
}

export function workoutProgressExerciseKey(
  exerciseId: string | null | undefined,
  exerciseName: string | null | undefined,
): string | null {
  const id = exerciseId?.trim();
  if (id) return id;
  const name = exerciseName?.trim().toLocaleLowerCase("pt-BR");
  return name ? `name:${name}` : null;
}

function normalizeStrengthSet(
  raw: WorkoutProgressStrengthSetRow,
): NormalizedSet | null {
  const targetKind: WorkoutProgressTargetKind =
    raw.target_kind === "duration" || raw.target_kind === "failure"
      ? raw.target_kind
      : "reps";
  const exerciseId = raw.exercise_id?.trim() || null;
  const exerciseName = raw.exercise?.trim() || "";
  const key = workoutProgressExerciseKey(exerciseId, exerciseName);
  if (!key) return null;

  if (targetKind === "duration") {
    const duration = positiveNumber(raw.duration_seconds);
    if (duration === null) return null;
    return {
      key,
      exerciseId,
      exerciseName,
      targetKind,
      reps: 0,
      weightKg: null,
      durationSeconds: Math.round(duration),
    };
  }

  const reps = positiveNumber(raw.reps);
  if (reps === null) return null;
  return {
    key,
    exerciseId,
    exerciseName,
    targetKind,
    reps: Math.round(reps),
    weightKg: positiveNumber(raw.weight_kg),
    durationSeconds: 0,
  };
}

function mondayOf(dateValue: string): string {
  const date = dateFromKey(dateValue);
  if (!date) return dateValue;
  const day = date.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return dateKey(date);
}

function emptyWeek(weekStart: string): WorkoutWeekProgress {
  return {
    weekStart,
    weekEnd: addWorkoutProgressDays(weekStart, 6),
    sessionCount: 0,
    strengthSessionCount: 0,
    activeDays: 0,
    totalDurationSeconds: 0,
    totalSets: 0,
    totalReps: 0,
    totalVolumeKg: 0,
    totalTimedExerciseSeconds: 0,
  };
}

function createRecentWeeks(
  today: string,
  count = WORKOUT_PROGRESS_WEEK_COUNT,
) {
  const safeCount = Math.max(1, Math.floor(count));
  const currentWeek = mondayOf(today);
  return Array.from({ length: safeCount }, (_, index) =>
    emptyWeek(addWorkoutProgressDays(currentWeek, (index - safeCount + 1) * 7)),
  );
}

function performedAt(row: WorkoutProgressActivityRow): string {
  return (
    row.started_at ??
    row.ended_at ??
    `${row.workout_date || "1970-01-01"}T12:00:00.000Z`
  );
}

function addSetToPoint(
  point: WorkoutProgressPoint,
  set: NormalizedSet,
) {
  point.setCount += 1;
  point.totalReps += set.reps;
  point.totalDurationSeconds += set.durationSeconds;
  if (set.targetKind === "failure") point.failureSetCount += 1;
  if (set.targetKind === "duration") point.durationSetCount += 1;
  if (set.weightKg !== null) {
    point.weightedSetCount += 1;
    point.maxWeightKg = Math.max(point.maxWeightKg ?? 0, set.weightKg);
    point.totalVolumeKg += set.reps * set.weightKg;
  }
}

function pointFor(row: WorkoutProgressActivityRow): WorkoutProgressPoint {
  return {
    activityId: row.id,
    performedAt: performedAt(row),
    workoutDate: row.workout_date,
    setCount: 0,
    weightedSetCount: 0,
    failureSetCount: 0,
    durationSetCount: 0,
    maxWeightKg: null,
    totalVolumeKg: 0,
    totalReps: 0,
    totalDurationSeconds: 0,
  };
}

/**
 * Agrega o recorte limitado de atividades em métricas prontas para a Sprint 3.
 * O cálculo não inventa carga: zero/negativo/null viram ausência de peso.
 */
export function buildWorkoutProgress(
  activityRows: WorkoutProgressActivityRow[],
  catalogRows: WorkoutProgressCatalogRow[],
  options?: { today?: string; days?: number; weekCount?: number },
): WorkoutProgressSnapshot {
  const range = workoutProgressRange(options?.today, options?.days);
  const catalogById = new Map(
    catalogRows.map((item) => [item.id, item.primary_muscle_group_slug]),
  );
  const weeks = createRecentWeeks(
    range.to,
    options?.weekCount ?? WORKOUT_PROGRESS_WEEK_COUNT,
  );
  const weekByStart = new Map(weeks.map((week) => [week.weekStart, week]));
  const weekDays = new Map<string, Set<string>>();
  const exerciseAccumulators = new Map<string, ExerciseAccumulator>();
  const muscleAccumulators = new Map<string, MuscleGroupAccumulator>();
  const activeDays = new Set<string>();
  let sessionCount = 0;
  let strengthSessionCount = 0;
  let totalDurationSeconds = 0;
  let totalSets = 0;
  let totalReps = 0;
  let totalVolumeKg = 0;
  let totalTimedExerciseSeconds = 0;

  for (const row of activityRows) {
    if (
      !row.workout_date ||
      row.workout_date < range.from ||
      row.workout_date > range.to
    ) {
      continue;
    }
    sessionCount += 1;
    if (row.activity_type === "strength") strengthSessionCount += 1;
    activeDays.add(row.workout_date);
    const elapsed = positiveNumber(row.elapsed_s) ?? 0;
    totalDurationSeconds += Math.round(elapsed);

    const weekStart = mondayOf(row.workout_date);
    const week = weekByStart.get(weekStart);
    if (week) {
      week.sessionCount += 1;
      if (row.activity_type === "strength") week.strengthSessionCount += 1;
      week.totalDurationSeconds += Math.round(elapsed);
      const days = weekDays.get(weekStart) ?? new Set<string>();
      days.add(row.workout_date);
      weekDays.set(weekStart, days);
    }

    for (const rawSet of row.strength_sets ?? []) {
      const set = normalizeStrengthSet(rawSet);
      if (!set) continue;
      totalSets += 1;
      totalReps += set.reps;
      totalTimedExerciseSeconds += set.durationSeconds;
      const setVolume = set.weightKg === null ? 0 : set.reps * set.weightKg;
      totalVolumeKg += setVolume;
      if (week) {
        week.totalSets += 1;
        week.totalReps += set.reps;
        week.totalVolumeKg += setVolume;
        week.totalTimedExerciseSeconds += set.durationSeconds;
      }

      const groupSlug =
        (set.exerciseId ? catalogById.get(set.exerciseId) : null) ||
        UNKNOWN_MUSCLE_GROUP_SLUG;
      let muscle = muscleAccumulators.get(groupSlug);
      if (!muscle) {
        muscle = {
          activityIds: new Set<string>(),
          exerciseKeys: new Set<string>(),
          setCount: 0,
          totalReps: 0,
          totalVolumeKg: 0,
          totalDurationSeconds: 0,
        };
        muscleAccumulators.set(groupSlug, muscle);
      }
      muscle.activityIds.add(row.id);
      muscle.exerciseKeys.add(set.key);
      muscle.setCount += 1;
      muscle.totalReps += set.reps;
      muscle.totalVolumeKg += setVolume;
      muscle.totalDurationSeconds += set.durationSeconds;

      let exercise = exerciseAccumulators.get(set.key);
      if (!exercise) {
        exercise = {
          exerciseId: set.exerciseId,
          exerciseName: set.exerciseName,
          primaryMuscleGroupSlug: groupSlug,
          points: new Map<string, WorkoutProgressPoint>(),
        };
        exerciseAccumulators.set(set.key, exercise);
      } else if (!exercise.exerciseName && set.exerciseName) {
        exercise.exerciseName = set.exerciseName;
      }
      const point = exercise.points.get(row.id) ?? pointFor(row);
      addSetToPoint(point, set);
      exercise.points.set(row.id, point);
    }
  }

  for (const week of weeks) {
    week.activeDays = weekDays.get(week.weekStart)?.size ?? 0;
    week.totalVolumeKg = roundMetric(week.totalVolumeKg);
  }

  const exercises = Array.from(exerciseAccumulators, ([key, exercise]) => {
    const points = Array.from(exercise.points.values())
      .map((point) => ({
        ...point,
        totalVolumeKg: roundMetric(point.totalVolumeKg),
      }))
      .sort((left, right) =>
        left.performedAt.localeCompare(right.performedAt),
      );
    return {
      key,
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName || key.replace(/^name:/, ""),
      primaryMuscleGroupSlug: exercise.primaryMuscleGroupSlug,
      sessionCount: points.length,
      setCount: points.reduce((sum, point) => sum + point.setCount, 0),
      weightedSetCount: points.reduce(
        (sum, point) => sum + point.weightedSetCount,
        0,
      ),
      maxWeightKg:
        points.reduce<number | null>(
          (maximum, point) =>
            point.maxWeightKg === null
              ? maximum
              : Math.max(maximum ?? 0, point.maxWeightKg),
          null,
        ),
      totalVolumeKg: roundMetric(
        points.reduce((sum, point) => sum + point.totalVolumeKg, 0),
      ),
      totalReps: points.reduce((sum, point) => sum + point.totalReps, 0),
      totalDurationSeconds: points.reduce(
        (sum, point) => sum + point.totalDurationSeconds,
        0,
      ),
      lastPerformedAt: points.at(-1)?.performedAt ?? "",
      points,
    } satisfies WorkoutExerciseProgress;
  }).sort((left, right) =>
    right.lastPerformedAt.localeCompare(left.lastPerformedAt),
  );

  const muscleGroups = Array.from(
    muscleAccumulators,
    ([slug, muscle]) => ({
      slug,
      sessionCount: muscle.activityIds.size,
      exerciseCount: muscle.exerciseKeys.size,
      setCount: muscle.setCount,
      totalReps: muscle.totalReps,
      totalVolumeKg: roundMetric(muscle.totalVolumeKg),
      totalDurationSeconds: muscle.totalDurationSeconds,
    }),
  ).sort(
    (left, right) =>
      right.setCount - left.setCount || left.slug.localeCompare(right.slug),
  );

  return {
    range,
    overview: {
      sessionCount,
      strengthSessionCount,
      activeDays: activeDays.size,
      exerciseCount: exercises.length,
      totalDurationSeconds,
      totalSets,
      totalReps,
      totalVolumeKg: roundMetric(totalVolumeKg),
      totalTimedExerciseSeconds,
    },
    weeks,
    exercises,
    muscleGroups,
  };
}

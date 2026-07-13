import type {
  WorkoutExerciseProgress,
  WorkoutProgressPoint,
  WorkoutProgressSnapshot,
  WorkoutWeekProgress,
} from "./workoutProgress";

export type WorkoutInsightType =
  | "learning"
  | "progression"
  | "muscle-gap"
  | "weekly";

export type WorkoutLearningInsight = {
  id: "learning:workout-history";
  type: "learning";
  reason:
    | "no-exercises"
    | "insufficient-weighted-history"
    | "collecting-comparable-sessions";
  data: {
    exerciseCount: number;
    weightedExerciseCount: number;
    exercisesWithTwoWeightedSessions: number;
    requiredComparableSessions: 2;
    requiredWeightedSetsPerSession: 2;
  };
};

export type WorkoutProgressionInsight = {
  id: string;
  type: "progression";
  reason: "same-load-reps-maintained";
  action: "consider-next-load";
  data: {
    exerciseKey: string;
    exerciseId: string | null;
    exerciseName: string;
    previousActivityId: string;
    currentActivityId: string;
    previousWorkoutDate: string;
    currentWorkoutDate: string;
    maxWeightKg: number;
    weightedSetCount: number;
    previousTotalReps: number;
    currentTotalReps: number;
    deltaReps: number;
    previousVolumeKg: number;
    currentVolumeKg: number;
    deltaVolumeKg: number;
  };
};

export type WorkoutMuscleGapInsight = {
  id: string;
  type: "muscle-gap";
  reason: "absent-current-week-present-before";
  data: {
    muscleGroupSlug: string;
    currentWeekStart: string;
    currentWeekEnd: string;
    previousWeeksObserved: number;
    previousSessionCount: number;
    previousSetCount: number;
    lastWorkoutDate: string;
  };
};

export type WorkoutWeeklyInsight = {
  id: string;
  type: "weekly";
  reason: "current-vs-previous-week";
  trend: "up" | "down" | "steady";
  data: {
    currentWeekStart: string;
    currentWeekEnd: string;
    previousWeekStart: string;
    previousWeekEnd: string;
    currentWeekComplete: boolean;
    current: WorkoutWeekComparableMetrics;
    previous: WorkoutWeekComparableMetrics;
    delta: WorkoutWeekComparableMetrics;
  };
};

export type WorkoutInsight =
  | WorkoutLearningInsight
  | WorkoutProgressionInsight
  | WorkoutMuscleGapInsight
  | WorkoutWeeklyInsight;

export type WorkoutWeekComparableMetrics = {
  sessionCount: number;
  strengthSessionCount: number;
  activeDays: number;
  totalDurationSeconds: number;
  totalSets: number;
  totalReps: number;
  totalVolumeKg: number;
};

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function sameWeight(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.001;
}

function lastTwoPoints(exercise: WorkoutExerciseProgress) {
  if (exercise.points.length < 2) return null;
  return [
    exercise.points[exercise.points.length - 2],
    exercise.points[exercise.points.length - 1],
  ] as const;
}

function comparableProgressionPair(exercise: WorkoutExerciseProgress) {
  const pair = lastTwoPoints(exercise);
  if (!pair) return null;
  const [previous, current] = pair;
  if (
    previous.weightedSetCount < 2 ||
    current.weightedSetCount < 2 ||
    previous.weightedSetCount !== current.weightedSetCount ||
    previous.maxWeightKg === null ||
    current.maxWeightKg === null ||
    !sameWeight(previous.maxWeightKg, current.maxWeightKg) ||
    current.totalReps < previous.totalReps ||
    current.totalVolumeKg < previous.totalVolumeKg
  ) {
    return null;
  }
  return { previous, current };
}

export function buildProgressionInsights(
  snapshot: WorkoutProgressSnapshot,
): WorkoutProgressionInsight[] {
  return snapshot.exercises.flatMap((exercise) => {
    const pair = comparableProgressionPair(exercise);
    if (!pair) return [];
    const { previous, current } = pair;
    return [
      {
        id: `progression:${exercise.key}`,
        type: "progression",
        reason: "same-load-reps-maintained",
        action: "consider-next-load",
        data: {
          exerciseKey: exercise.key,
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          previousActivityId: previous.activityId,
          currentActivityId: current.activityId,
          previousWorkoutDate: previous.workoutDate,
          currentWorkoutDate: current.workoutDate,
          maxWeightKg: current.maxWeightKg!,
          weightedSetCount: current.weightedSetCount,
          previousTotalReps: previous.totalReps,
          currentTotalReps: current.totalReps,
          deltaReps: current.totalReps - previous.totalReps,
          previousVolumeKg: previous.totalVolumeKg,
          currentVolumeKg: current.totalVolumeKg,
          deltaVolumeKg: rounded(
            current.totalVolumeKg - previous.totalVolumeKg,
          ),
        },
      },
    ];
  });
}

function learningInsight(
  snapshot: WorkoutProgressSnapshot,
): WorkoutLearningInsight {
  const weightedExercises = snapshot.exercises.filter((exercise) =>
    exercise.points.some((point) => point.weightedSetCount > 0),
  );
  const exercisesWithTwoWeightedSessions = weightedExercises.filter(
    (exercise) =>
      exercise.points.filter((point) => point.weightedSetCount >= 2).length >= 2,
  ).length;
  const reason: WorkoutLearningInsight["reason"] =
    snapshot.exercises.length === 0
      ? "no-exercises"
      : weightedExercises.length === 0
        ? "insufficient-weighted-history"
        : "collecting-comparable-sessions";
  return {
    id: "learning:workout-history",
    type: "learning",
    reason,
    data: {
      exerciseCount: snapshot.exercises.length,
      weightedExerciseCount: weightedExercises.length,
      exercisesWithTwoWeightedSessions,
      requiredComparableSessions: 2,
      requiredWeightedSetsPerSession: 2,
    },
  };
}

function pointInWeek(point: WorkoutProgressPoint, week: WorkoutWeekProgress) {
  return (
    point.workoutDate >= week.weekStart && point.workoutDate <= week.weekEnd
  );
}

export function buildMuscleGapInsights(
  snapshot: WorkoutProgressSnapshot,
  previousWeekLimit = 4,
): WorkoutMuscleGapInsight[] {
  const currentWeek = snapshot.weeks.at(-1);
  if (!currentWeek) return [];
  const previousWeeks = snapshot.weeks.slice(
    Math.max(0, snapshot.weeks.length - 1 - Math.max(1, previousWeekLimit)),
    -1,
  );
  if (previousWeeks.length === 0) return [];

  const groups = new Map<
    string,
    {
      currentActivityIds: Set<string>;
      previousActivityIds: Set<string>;
      previousSetCount: number;
      lastWorkoutDate: string;
    }
  >();
  for (const exercise of snapshot.exercises) {
    const slug = exercise.primaryMuscleGroupSlug;
    if (!slug || slug === "other") continue;
    const group = groups.get(slug) ?? {
      currentActivityIds: new Set<string>(),
      previousActivityIds: new Set<string>(),
      previousSetCount: 0,
      lastWorkoutDate: "",
    };
    for (const point of exercise.points) {
      if (pointInWeek(point, currentWeek)) {
        group.currentActivityIds.add(point.activityId);
        continue;
      }
      if (previousWeeks.some((week) => pointInWeek(point, week))) {
        group.previousActivityIds.add(point.activityId);
        group.previousSetCount += point.setCount;
        if (point.workoutDate > group.lastWorkoutDate) {
          group.lastWorkoutDate = point.workoutDate;
        }
      }
    }
    groups.set(slug, group);
  }

  return Array.from(groups, ([muscleGroupSlug, group]) => {
    if (
      group.currentActivityIds.size > 0 ||
      group.previousActivityIds.size === 0
    ) {
      return null;
    }
    return {
      id: `muscle-gap:${muscleGroupSlug}:${currentWeek.weekStart}`,
      type: "muscle-gap",
      reason: "absent-current-week-present-before",
      data: {
        muscleGroupSlug,
        currentWeekStart: currentWeek.weekStart,
        currentWeekEnd: currentWeek.weekEnd,
        previousWeeksObserved: previousWeeks.length,
        previousSessionCount: group.previousActivityIds.size,
        previousSetCount: group.previousSetCount,
        lastWorkoutDate: group.lastWorkoutDate,
      },
    } satisfies WorkoutMuscleGapInsight;
  })
    .filter((insight): insight is WorkoutMuscleGapInsight => insight !== null)
    .sort(
      (left, right) =>
        right.data.lastWorkoutDate.localeCompare(left.data.lastWorkoutDate) ||
        left.data.muscleGroupSlug.localeCompare(right.data.muscleGroupSlug),
    );
}

function comparableWeek(week: WorkoutWeekProgress): WorkoutWeekComparableMetrics {
  return {
    sessionCount: week.sessionCount,
    strengthSessionCount: week.strengthSessionCount,
    activeDays: week.activeDays,
    totalDurationSeconds: week.totalDurationSeconds,
    totalSets: week.totalSets,
    totalReps: week.totalReps,
    totalVolumeKg: week.totalVolumeKg,
  };
}

function subtractWeek(
  current: WorkoutWeekComparableMetrics,
  previous: WorkoutWeekComparableMetrics,
): WorkoutWeekComparableMetrics {
  return {
    sessionCount: current.sessionCount - previous.sessionCount,
    strengthSessionCount:
      current.strengthSessionCount - previous.strengthSessionCount,
    activeDays: current.activeDays - previous.activeDays,
    totalDurationSeconds:
      current.totalDurationSeconds - previous.totalDurationSeconds,
    totalSets: current.totalSets - previous.totalSets,
    totalReps: current.totalReps - previous.totalReps,
    totalVolumeKg: rounded(current.totalVolumeKg - previous.totalVolumeKg),
  };
}

export function buildWeeklyInsight(
  snapshot: WorkoutProgressSnapshot,
): WorkoutWeeklyInsight | null {
  if (snapshot.weeks.length < 2) return null;
  const previousWeek = snapshot.weeks[snapshot.weeks.length - 2];
  const currentWeek = snapshot.weeks[snapshot.weeks.length - 1];
  const currentWeekComplete = snapshot.range.to >= currentWeek.weekEnd;
  // Não comparamos segunda/terça com uma semana inteira: isso produziria uma
  // queda artificial. O fechamento semanal aparece ao terminar o domingo.
  if (!currentWeekComplete) return null;
  const current = comparableWeek(currentWeek);
  const previous = comparableWeek(previousWeek);
  const delta = subtractWeek(current, previous);
  const trend =
    delta.sessionCount > 0
      ? "up"
      : delta.sessionCount < 0
        ? "down"
        : "steady";
  return {
    id: `weekly:${currentWeek.weekStart}`,
    type: "weekly",
    reason: "current-vs-previous-week",
    trend,
    data: {
      currentWeekStart: currentWeek.weekStart,
      currentWeekEnd: currentWeek.weekEnd,
      previousWeekStart: previousWeek.weekStart,
      previousWeekEnd: previousWeek.weekEnd,
      currentWeekComplete,
      current,
      previous,
      delta,
    },
  };
}

/**
 * Ordem de saída: progressões acionáveis, lacunas de grupo, comparativo semanal
 * e, quando nenhuma progressão é segura, um único estado de aprendizado.
 */
export function buildWorkoutInsights(
  snapshot: WorkoutProgressSnapshot,
): WorkoutInsight[] {
  const progression = buildProgressionInsights(snapshot);
  const muscleGaps = buildMuscleGapInsights(snapshot);
  const weekly = buildWeeklyInsight(snapshot);
  return [
    ...progression,
    ...muscleGaps,
    ...(weekly ? [weekly] : []),
    ...(progression.length === 0 ? [learningInsight(snapshot)] : []),
  ];
}

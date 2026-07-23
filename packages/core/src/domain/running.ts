export const RUNNING_PLAN_LEVELS = [
  "starting",
  "beginner",
  "intermediate",
  "advanced",
] as const;

export const RUNNING_PLAN_GOALS = [
  "start_running",
  "first_5k",
  "improve_5k",
  "first_10k",
  "improve_10k",
  "half_marathon",
  "marathon",
  "conditioning",
  "general",
] as const;

export const RUNNING_STEP_TYPES = [
  "warmup",
  "easy",
  "steady",
  "recovery",
  "interval",
  "tempo",
  "threshold",
  "progression",
  "long_run",
  "walk",
  "cooldown",
  "drill",
  "hill",
  "free",
] as const;

export const RUNNING_RECOVERY_TYPES = [
  "none",
  "standing",
  "walking",
  "easy_jog",
  "distance",
  "duration",
] as const;

export const RUNNING_TARGET_BASES = [
  "distance",
  "duration",
  "pace",
  "heart_rate",
  "effort",
  "free",
] as const;

export const RUNNING_PLAN_SOURCES = [
  "manual",
  "text",
  "image",
  "pdf",
  "professional",
  "ai",
] as const;

export type RunningPlanLevel = (typeof RUNNING_PLAN_LEVELS)[number];
export type RunningPlanGoal = (typeof RUNNING_PLAN_GOALS)[number];
export type RunningStepType = (typeof RUNNING_STEP_TYPES)[number];
export type RunningRecoveryType = (typeof RUNNING_RECOVERY_TYPES)[number];
export type RunningTargetBasis = (typeof RUNNING_TARGET_BASES)[number];
export type RunningPlanSource = (typeof RUNNING_PLAN_SOURCES)[number];

export type RunningWorkoutPlanStepDraft = {
  id?: string;
  position: number;
  stepType: RunningStepType;
  title: string;
  instructions?: string | null;
  repetitions: number;
  repetitionsMin?: number | null;
  repetitionsMax?: number | null;
  targetBasis: RunningTargetBasis;
  distanceM?: number | null;
  distanceMinM?: number | null;
  distanceMaxM?: number | null;
  durationS?: number | null;
  durationMinS?: number | null;
  durationMaxS?: number | null;
  paceMinSPerKm?: number | null;
  paceMaxSPerKm?: number | null;
  heartRateZone?: number | null;
  recoveryType: RunningRecoveryType;
  recoveryDurationS?: number | null;
  recoveryDistanceM?: number | null;
  targetEffort?: number | null;
  metadata?: Record<string, unknown>;
};

export type RunningWorkoutPlanDraft = {
  name: string;
  description?: string | null;
  level: RunningPlanLevel;
  goal: RunningPlanGoal;
  source: RunningPlanSource;
  sourceMetadata?: Record<string, unknown>;
  steps: RunningWorkoutPlanStepDraft[];
};

export type RunningWorkoutPlan = RunningWorkoutPlanDraft & {
  id: string;
  userId: string;
  sportType: "run";
  planVersion: number;
  isFavorite: boolean;
  estimatedDurationS: number | null;
  estimatedDistanceM: number | null;
  createdAt: string;
  updatedAt: string;
};

export type RunningPlanValidationIssue = {
  path: string;
  code:
    | "required"
    | "invalid_distance"
    | "invalid_duration"
    | "invalid_repetitions"
    | "invalid_repetition_range"
    | "invalid_distance_range"
    | "invalid_duration_range"
    | "invalid_pace"
    | "inverted_pace"
    | "invalid_heart_rate_zone"
    | "invalid_effort"
    | "missing_target"
    | "invalid_recovery"
    | "duplicate_position";
};

export type RunningPlanEstimate = {
  distanceM: number | null;
  distanceMinM: number | null;
  distanceMaxM: number | null;
  durationS: number | null;
  durationMinS: number | null;
  durationMaxS: number | null;
  blockCount: number;
  repetitionCount: number;
  recoveryDurationS: number;
  recoveryDistanceM: number;
  derivedDistance: boolean;
  derivedDuration: boolean;
  hasRanges: boolean;
  unknownTargetCount: number;
  distributionByType: Partial<Record<RunningStepType, number>>;
};

export type RunningPlanImportDraft = {
  sourceType: "text" | "image" | "pdf" | "professional" | "manual";
  rawText?: string;
  parsedPlan: RunningWorkoutPlanDraft;
  warnings: string[];
  confidence: number;
};

export type RunningSessionStepStatus =
  | "pending"
  | "active"
  | "paused"
  | "completed"
  | "skipped";

export type RunningSessionStepResult = {
  stepId: string;
  position: number;
  status: RunningSessionStepStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  elapsedS?: number | null;
  distanceM?: number | null;
  averagePaceSPerKm?: number | null;
  averageHeartRate?: number | null;
  effort?: number | null;
};

function positiveOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function integerOr(value: number | null | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.round(value))
    : fallback;
}

function orderedRange(
  first: number | null | undefined,
  second: number | null | undefined,
) {
  const low = positiveOrNull(first);
  const high = positiveOrNull(second);
  if (low && high && low > high) return [high, low] as const;
  return [low, high] as const;
}

export function normalizeRunningStep(
  input: RunningWorkoutPlanStepDraft,
  position = input.position,
): RunningWorkoutPlanStepDraft {
  const firstPace = positiveOrNull(input.paceMinSPerKm);
  const secondPace = positiveOrNull(input.paceMaxSPerKm);
  const normalizedPaces =
    firstPace && secondPace && firstPace > secondPace
      ? [secondPace, firstPace]
      : [firstPace, secondPace];
  const [distanceMinM, distanceMaxM] = orderedRange(
    input.distanceMinM,
    input.distanceMaxM,
  );
  const [durationMinS, durationMaxS] = orderedRange(
    input.durationMinS,
    input.durationMaxS,
  );
  const [repetitionsMin, repetitionsMax] = orderedRange(
    input.repetitionsMin,
    input.repetitionsMax,
  );
  return {
    ...input,
    position: Math.max(0, Math.round(position)),
    title: input.title.trim(),
    instructions: input.instructions?.trim() || null,
    repetitions: integerOr(input.repetitions, 1),
    repetitionsMin:
      repetitionsMin == null ? null : Math.max(1, Math.round(repetitionsMin)),
    repetitionsMax:
      repetitionsMax == null ? null : Math.max(1, Math.round(repetitionsMax)),
    distanceM: positiveOrNull(input.distanceM),
    distanceMinM,
    distanceMaxM,
    durationS: positiveOrNull(input.durationS),
    durationMinS,
    durationMaxS,
    paceMinSPerKm: normalizedPaces[0],
    paceMaxSPerKm: normalizedPaces[1],
    heartRateZone: positiveOrNull(input.heartRateZone),
    recoveryDurationS: positiveOrNull(input.recoveryDurationS),
    recoveryDistanceM: positiveOrNull(input.recoveryDistanceM),
    targetEffort: positiveOrNull(input.targetEffort),
    metadata: input.metadata ?? {},
  };
}

export function normalizeRunningPlan(
  input: RunningWorkoutPlanDraft,
): RunningWorkoutPlanDraft {
  return {
    ...input,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    sourceMetadata: input.sourceMetadata ?? {},
    steps: input.steps.map((step, index) =>
      normalizeRunningStep(step, index),
    ),
  };
}

export function validateRunningPlan(
  input: RunningWorkoutPlanDraft,
): RunningPlanValidationIssue[] {
  const plan = normalizeRunningPlan(input);
  const issues: RunningPlanValidationIssue[] = [];
  if (!plan.name) issues.push({ path: "name", code: "required" });
  if (plan.steps.length === 0) {
    issues.push({ path: "steps", code: "required" });
    return issues;
  }

  const positions = new Set<number>();
  plan.steps.forEach((step, index) => {
    const rawStep = input.steps[index];
    const path = `steps.${index}`;
    const rawPosition = rawStep?.position ?? step.position;
    if (positions.has(rawPosition)) {
      issues.push({ path: `${path}.position`, code: "duplicate_position" });
    }
    positions.add(rawPosition);
    if (!step.title) issues.push({ path: `${path}.title`, code: "required" });
    if (
      !Number.isInteger(rawStep?.repetitions) ||
      Number(rawStep?.repetitions) < 1
    ) {
      issues.push({
        path: `${path}.repetitions`,
        code: "invalid_repetitions",
      });
    }
    const repetitionRangeProvided =
      rawStep?.repetitionsMin != null || rawStep?.repetitionsMax != null;
    if (
      repetitionRangeProvided &&
      (!Number.isInteger(rawStep?.repetitionsMin) ||
        !Number.isInteger(rawStep?.repetitionsMax) ||
        Number(rawStep?.repetitionsMin) < 1 ||
        Number(rawStep?.repetitionsMax) <
          Number(rawStep?.repetitionsMin))
    ) {
      issues.push({
        path: `${path}.repetitionsRange`,
        code: "invalid_repetition_range",
      });
    }
    if (
      rawStep?.distanceM != null &&
      positiveOrNull(rawStep.distanceM) == null
    ) {
      issues.push({ path: `${path}.distanceM`, code: "invalid_distance" });
    }
    if (
      rawStep?.durationS != null &&
      positiveOrNull(rawStep.durationS) == null
    ) {
      issues.push({ path: `${path}.durationS`, code: "invalid_duration" });
    }
    const distanceRangeProvided =
      rawStep?.distanceMinM != null || rawStep?.distanceMaxM != null;
    if (
      distanceRangeProvided &&
      (positiveOrNull(rawStep?.distanceMinM) == null ||
        positiveOrNull(rawStep?.distanceMaxM) == null ||
        Number(rawStep?.distanceMinM) > Number(rawStep?.distanceMaxM) ||
        rawStep?.distanceM != null)
    ) {
      issues.push({
        path: `${path}.distanceRange`,
        code: "invalid_distance_range",
      });
    }
    const durationRangeProvided =
      rawStep?.durationMinS != null || rawStep?.durationMaxS != null;
    if (
      durationRangeProvided &&
      (positiveOrNull(rawStep?.durationMinS) == null ||
        positiveOrNull(rawStep?.durationMaxS) == null ||
        Number(rawStep?.durationMinS) > Number(rawStep?.durationMaxS) ||
        rawStep?.durationS != null)
    ) {
      issues.push({
        path: `${path}.durationRange`,
        code: "invalid_duration_range",
      });
    }
    if (
      rawStep?.paceMinSPerKm != null &&
      positiveOrNull(rawStep.paceMinSPerKm) == null
    ) {
      issues.push({ path: `${path}.paceMinSPerKm`, code: "invalid_pace" });
    }
    if (
      rawStep?.paceMaxSPerKm != null &&
      positiveOrNull(rawStep.paceMaxSPerKm) == null
    ) {
      issues.push({ path: `${path}.paceMaxSPerKm`, code: "invalid_pace" });
    }
    if (
      positiveOrNull(rawStep?.paceMinSPerKm) &&
      positiveOrNull(rawStep?.paceMaxSPerKm) &&
      Number(rawStep?.paceMinSPerKm) > Number(rawStep?.paceMaxSPerKm)
    ) {
      issues.push({ path: `${path}.pace`, code: "inverted_pace" });
    }
    if (
      rawStep?.heartRateZone != null &&
      (!Number.isInteger(rawStep.heartRateZone) ||
        rawStep.heartRateZone < 1 ||
        rawStep.heartRateZone > 5)
    ) {
      issues.push({
        path: `${path}.heartRateZone`,
        code: "invalid_heart_rate_zone",
      });
    }
    if (
      rawStep?.targetEffort != null &&
      (rawStep.targetEffort < 1 || rawStep.targetEffort > 10)
    ) {
      issues.push({ path: `${path}.targetEffort`, code: "invalid_effort" });
    }
    const hasDistance =
      positiveOrNull(step.distanceM) != null ||
      (positiveOrNull(step.distanceMinM) != null &&
        positiveOrNull(step.distanceMaxM) != null);
    const hasDuration =
      positiveOrNull(step.durationS) != null ||
      (positiveOrNull(step.durationMinS) != null &&
        positiveOrNull(step.durationMaxS) != null);
    const targetCanBeOpen =
      step.targetBasis === "free" ||
      step.stepType === "free" ||
      step.stepType === "drill";
    if (!hasDistance && !hasDuration && !targetCanBeOpen) {
      issues.push({ path, code: "missing_target" });
    }
    const recoveryCount = Math.max(step.repetitions - 1, 0);
    if (
      recoveryCount === 0 &&
      step.recoveryType !== "none"
    ) {
      issues.push({ path: `${path}.recoveryType`, code: "invalid_recovery" });
    }
    if (
      step.recoveryType === "distance" &&
      positiveOrNull(step.recoveryDistanceM) == null
    ) {
      issues.push({
        path: `${path}.recoveryDistanceM`,
        code: "invalid_recovery",
      });
    }
    if (
      step.recoveryType !== "none" &&
      step.recoveryType !== "distance" &&
      positiveOrNull(step.recoveryDurationS) == null
    ) {
      issues.push({
        path: `${path}.recoveryDurationS`,
        code: "invalid_recovery",
      });
    }
  });
  return issues;
}

function averagePace(step: RunningWorkoutPlanStepDraft) {
  const min = positiveOrNull(step.paceMinSPerKm);
  const max = positiveOrNull(step.paceMaxSPerKm);
  if (min && max) return (min + max) / 2;
  return min ?? max;
}

export function estimateRunningPlanTotals(
  input: RunningWorkoutPlanDraft,
): RunningPlanEstimate {
  const plan = normalizeRunningPlan(input);
  let distanceMinM = 0;
  let distanceMaxM = 0;
  let durationMinS = 0;
  let durationMaxS = 0;
  let hasDistance = false;
  let hasDuration = false;
  let derivedDistance = false;
  let derivedDuration = false;
  let hasRanges = false;
  let recoveryDurationS = 0;
  let recoveryDistanceM = 0;
  let unknownTargetCount = 0;
  let repetitionCount = 0;
  const distributionByType: Partial<Record<RunningStepType, number>> = {};

  for (const step of plan.steps) {
    const repetitionMin = Math.max(
      1,
      Math.round(step.repetitionsMin ?? step.repetitions),
    );
    const repetitionMax = Math.max(
      repetitionMin,
      Math.round(step.repetitionsMax ?? step.repetitions),
    );
    const repetitions = Math.max(1, step.repetitions);
    repetitionCount += repetitions;
    if (repetitionMin !== repetitionMax) hasRanges = true;
    distributionByType[step.stepType] =
      (distributionByType[step.stepType] ?? 0) + 1;
    const paceMin = positiveOrNull(step.paceMinSPerKm);
    const paceMax = positiveOrNull(step.paceMaxSPerKm);
    const pace = averagePace(step);
    const exactDistance = positiveOrNull(step.distanceM);
    const exactDuration = positiveOrNull(step.durationS);
    const stepDistanceMin =
      exactDistance ?? positiveOrNull(step.distanceMinM);
    const stepDistanceMax =
      exactDistance ?? positiveOrNull(step.distanceMaxM);
    const stepDurationMin =
      exactDuration ?? positiveOrNull(step.durationMinS);
    const stepDurationMax =
      exactDuration ?? positiveOrNull(step.durationMaxS);

    if (
      (stepDistanceMin && stepDistanceMax) &&
      (stepDistanceMin !== stepDistanceMax ||
        repetitionMin !== repetitionMax)
    ) {
      hasRanges = true;
    }
    if (
      (stepDurationMin && stepDurationMax) &&
      (stepDurationMin !== stepDurationMax ||
        repetitionMin !== repetitionMax)
    ) {
      hasRanges = true;
    }

    if (stepDistanceMin && stepDistanceMax) {
      distanceMinM += stepDistanceMin * repetitionMin;
      distanceMaxM += stepDistanceMax * repetitionMax;
      hasDistance = true;
    } else if (stepDurationMin && stepDurationMax && pace) {
      const slowPace = paceMax ?? pace;
      const fastPace = paceMin ?? pace;
      distanceMinM +=
        (stepDurationMin / slowPace) * 1000 * repetitionMin;
      distanceMaxM +=
        (stepDurationMax / fastPace) * 1000 * repetitionMax;
      hasDistance = true;
      derivedDistance = true;
    }

    if (stepDurationMin && stepDurationMax) {
      durationMinS += stepDurationMin * repetitionMin;
      durationMaxS += stepDurationMax * repetitionMax;
      hasDuration = true;
    } else if (stepDistanceMin && stepDistanceMax && pace) {
      const fastPace = paceMin ?? pace;
      const slowPace = paceMax ?? pace;
      durationMinS +=
        (stepDistanceMin / 1000) * fastPace * repetitionMin;
      durationMaxS +=
        (stepDistanceMax / 1000) * slowPace * repetitionMax;
      hasDuration = true;
      derivedDuration = true;
    }

    if (
      !(stepDistanceMin && stepDistanceMax) &&
      !(stepDurationMin && stepDurationMax)
    ) {
      unknownTargetCount += 1;
    }

    const minRecoveries = Math.max(repetitionMin - 1, 0);
    const maxRecoveries = Math.max(repetitionMax - 1, 0);
    const recoveryDuration = positiveOrNull(step.recoveryDurationS);
    const recoveryDistance = positiveOrNull(step.recoveryDistanceM);
    if (maxRecoveries > 0 && recoveryDuration) {
      const minTotal = recoveryDuration * minRecoveries;
      const maxTotal = recoveryDuration * maxRecoveries;
      recoveryDurationS += Math.round((minTotal + maxTotal) / 2);
      durationMinS += minTotal;
      durationMaxS += maxTotal;
      hasDuration = true;
    }
    if (maxRecoveries > 0 && recoveryDistance) {
      const minTotal = recoveryDistance * minRecoveries;
      const maxTotal = recoveryDistance * maxRecoveries;
      recoveryDistanceM += Math.round((minTotal + maxTotal) / 2);
      distanceMinM += minTotal;
      distanceMaxM += maxTotal;
      hasDistance = true;
    }
  }

  const roundedDistanceMin = hasDistance ? Math.round(distanceMinM) : null;
  const roundedDistanceMax = hasDistance ? Math.round(distanceMaxM) : null;
  const roundedDurationMin = hasDuration ? Math.round(durationMinS) : null;
  const roundedDurationMax = hasDuration ? Math.round(durationMaxS) : null;
  return {
    distanceM:
      roundedDistanceMin == null || roundedDistanceMax == null
        ? null
        : Math.round((roundedDistanceMin + roundedDistanceMax) / 2),
    distanceMinM: roundedDistanceMin,
    distanceMaxM: roundedDistanceMax,
    durationS:
      roundedDurationMin == null || roundedDurationMax == null
        ? null
        : Math.round((roundedDurationMin + roundedDurationMax) / 2),
    durationMinS: roundedDurationMin,
    durationMaxS: roundedDurationMax,
    blockCount: plan.steps.length,
    repetitionCount,
    recoveryDurationS: Math.round(recoveryDurationS),
    recoveryDistanceM: Math.round(recoveryDistanceM),
    derivedDistance,
    derivedDuration,
    hasRanges,
    unknownTargetCount,
    distributionByType,
  };
}

const preset = (
  value: Omit<RunningWorkoutPlanStepDraft, "position">,
): RunningWorkoutPlanStepDraft => ({ ...value, position: 0 });

export const RUNNING_STEP_PRESETS: readonly RunningWorkoutPlanStepDraft[] = [
  preset({
    stepType: "warmup",
    title: "Aquecimento",
    repetitions: 1,
    targetBasis: "duration",
    durationS: 600,
    recoveryType: "none",
  }),
  preset({
    stepType: "easy",
    title: "Corrida leve",
    repetitions: 1,
    targetBasis: "duration",
    durationS: 1200,
    recoveryType: "none",
  }),
  preset({
    stepType: "easy",
    title: "Corrida leve 5 km",
    repetitions: 1,
    targetBasis: "distance",
    distanceM: 5000,
    recoveryType: "none",
  }),
  preset({
    stepType: "interval",
    title: "6 × 400 m",
    repetitions: 6,
    targetBasis: "distance",
    distanceM: 400,
    recoveryType: "duration",
    recoveryDurationS: 60,
  }),
  preset({
    stepType: "tempo",
    title: "Tempo run",
    repetitions: 1,
    targetBasis: "duration",
    durationS: 1200,
    recoveryType: "none",
  }),
  preset({
    stepType: "long_run",
    title: "Longão 10 km",
    repetitions: 1,
    targetBasis: "distance",
    distanceM: 10000,
    recoveryType: "none",
  }),
  preset({
    stepType: "cooldown",
    title: "Desaquecimento",
    repetitions: 1,
    targetBasis: "duration",
    durationS: 300,
    recoveryType: "none",
  }),
  preset({
    stepType: "walk",
    title: "Caminhada",
    repetitions: 1,
    targetBasis: "duration",
    durationS: 180,
    recoveryType: "none",
  }),
  preset({
    stepType: "drill",
    title: "Educativo",
    repetitions: 3,
    targetBasis: "duration",
    durationS: 30,
    recoveryType: "duration",
    recoveryDurationS: 30,
  }),
] as const;

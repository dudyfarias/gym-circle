import type {
  RunningRecoveryType,
  RunningStepType,
  RunningTargetBasis,
  RunningWorkoutPlan,
  RunningWorkoutPlanStepDraft,
} from "./running";

export const RUNNING_SESSION_VERSION = 1 as const;

export type RunningSessionStatus =
  | "idle"
  | "starting"
  | "running"
  | "paused"
  | "step_completed"
  | "transition"
  | "finished"
  | "cancelled"
  | "error";

export type RunningSessionSegmentKind = "work" | "recovery";

export type RunningSessionSegmentStatus =
  | "pending"
  | "active"
  | "completed"
  | "skipped"
  | "paused";

export type RunningSessionPaceFeedback =
  | "unknown"
  | "on_target"
  | "too_fast"
  | "too_slow";

export type RunningSessionEventType =
  | "running_started"
  | "running_paused"
  | "running_resumed"
  | "step_started"
  | "step_completed"
  | "step_skipped"
  | "step_transition"
  | "pace_high"
  | "pace_low"
  | "interval_start"
  | "recovery_start"
  | "motivation"
  | "running_finished"
  | "workout_cancelled"
  | "running_error";

export type RunningSessionEvent = {
  id: string;
  type: RunningSessionEventType;
  atMs: number;
  segmentId: string | null;
  messageKey?: RunningMotivationMessageKey;
};

export type RunningMotivationMessageKey =
  | "started"
  | "warmup_completed"
  | "on_target"
  | "last_interval"
  | "last_500m"
  | "finished";

export type RunningSessionPlanSnapshot = {
  id: string;
  name: string;
  planVersion: number;
  estimatedDurationS: number | null;
  estimatedDistanceM: number | null;
  steps: RunningWorkoutPlanStepDraft[];
};

export type RunningSessionSegment = {
  id: string;
  sourceStepId: string | null;
  sourceStepIndex: number;
  sourceStepPosition: number;
  kind: RunningSessionSegmentKind;
  stepType: RunningStepType;
  title: string;
  instructions: string | null;
  repetitionIndex: number;
  repetitionCount: number;
  targetBasis: RunningTargetBasis;
  targetDistanceM: number | null;
  targetDurationS: number | null;
  paceMinSPerKm: number | null;
  paceMaxSPerKm: number | null;
  heartRateZone: number | null;
  targetEffort: number | null;
  recoveryType: RunningRecoveryType;
};

export type RunningSessionSegmentResult = {
  segmentId: string;
  sourceStepIndex: number;
  status: "completed" | "skipped";
  startedAtMs: number;
  endedAtMs: number;
  elapsedS: number;
  distanceM: number;
  averagePaceSPerKm: number | null;
};

export type RunningSessionObservation = {
  atMs: number;
  elapsedS: number;
  distanceM: number;
  currentPaceSPerKm?: number | null;
  heartRate?: number | null;
};

export type RunningSessionState = {
  version: typeof RUNNING_SESSION_VERSION;
  status: RunningSessionStatus;
  plan: RunningSessionPlanSnapshot;
  segments: RunningSessionSegment[];
  activeSegmentIndex: number;
  segmentStartedAtMs: number | null;
  segmentStartElapsedS: number;
  segmentStartDistanceM: number;
  startedAtMs: number | null;
  finishedAtMs: number | null;
  results: RunningSessionSegmentResult[];
  lastObservationAtMs: number | null;
  latestObservation: RunningSessionObservation | null;
  lastEvents: RunningSessionEvent[];
  emittedCueIds: string[];
  paceSampleCount: number;
  paceOnTargetSampleCount: number;
  paceSampleTotalSPerKm: number;
  bestPaceSPerKm: number | null;
  errorCode: string | null;
};

export type RunningSessionTransition = {
  state: RunningSessionState;
  events: RunningSessionEvent[];
};

export type RunningSessionProgress = {
  overall: number;
  segment: number;
  completedSegments: number;
  skippedSegments: number;
  totalSegments: number;
  segmentElapsedS: number;
  segmentDistanceM: number;
  remainingDurationS: number | null;
  remainingDistanceM: number | null;
  estimatedRemainingS: number | null;
  estimatedRemainingDistanceM: number | null;
};

export type RunningSessionSummary = {
  planId: string;
  planName: string;
  elapsedS: number;
  distanceM: number;
  averagePaceSPerKm: number | null;
  bestPaceSPerKm: number | null;
  completedSegments: number;
  skippedSegments: number;
  totalSegments: number;
  recoveryTimeS: number;
  runningTimeS: number;
  paceConsistencyPercent: number | null;
  estimatedDurationDeltaS: number | null;
  estimatedDistanceDeltaM: number | null;
};

function finiteNonNegative(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

function positiveOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function canonicalRangeTarget(
  exact: number | null | undefined,
  maximum: number | null | undefined,
) {
  return positiveOrNull(exact) ?? positiveOrNull(maximum);
}

function segmentTargetBasis(
  step: RunningWorkoutPlanStepDraft,
  distanceM: number | null,
  durationS: number | null,
): RunningTargetBasis {
  if (step.targetBasis === "distance" && distanceM) return "distance";
  if (step.targetBasis === "duration" && durationS) return "duration";
  if (distanceM) return "distance";
  if (durationS) return "duration";
  return step.targetBasis;
}

function workSegment(
  step: RunningWorkoutPlanStepDraft,
  stepIndex: number,
  repetitionIndex: number,
  repetitionCount: number,
): RunningSessionSegment {
  const targetDistanceM = canonicalRangeTarget(
    step.distanceM,
    step.distanceMaxM,
  );
  const targetDurationS = canonicalRangeTarget(
    step.durationS,
    step.durationMaxS,
  );
  return {
    id: `${step.id ?? `step-${stepIndex}`}:work:${repetitionIndex}`,
    sourceStepId: step.id ?? null,
    sourceStepIndex: stepIndex,
    sourceStepPosition: step.position,
    kind: "work",
    stepType: step.stepType,
    title: step.title,
    instructions: step.instructions ?? null,
    repetitionIndex,
    repetitionCount,
    targetBasis: segmentTargetBasis(step, targetDistanceM, targetDurationS),
    targetDistanceM,
    targetDurationS,
    paceMinSPerKm: positiveOrNull(step.paceMinSPerKm),
    paceMaxSPerKm: positiveOrNull(step.paceMaxSPerKm),
    heartRateZone: positiveOrNull(step.heartRateZone),
    targetEffort: positiveOrNull(step.targetEffort),
    recoveryType: "none",
  };
}

function recoverySegment(
  step: RunningWorkoutPlanStepDraft,
  stepIndex: number,
  repetitionIndex: number,
  repetitionCount: number,
): RunningSessionSegment | null {
  if (step.recoveryType === "none") return null;
  const targetDistanceM =
    step.recoveryType === "distance"
      ? positiveOrNull(step.recoveryDistanceM)
      : null;
  const targetDurationS =
    step.recoveryType === "distance"
      ? null
      : positiveOrNull(step.recoveryDurationS);
  if (!targetDistanceM && !targetDurationS) return null;
  return {
    id: `${step.id ?? `step-${stepIndex}`}:recovery:${repetitionIndex}`,
    sourceStepId: step.id ?? null,
    sourceStepIndex: stepIndex,
    sourceStepPosition: step.position,
    kind: "recovery",
    stepType: "recovery",
    title: "Recovery",
    instructions: null,
    repetitionIndex,
    repetitionCount,
    targetBasis: targetDistanceM ? "distance" : "duration",
    targetDistanceM,
    targetDurationS,
    paceMinSPerKm: null,
    paceMaxSPerKm: null,
    heartRateZone: null,
    targetEffort: null,
    recoveryType: step.recoveryType,
  };
}

export function expandRunningPlanSegments(
  plan: Pick<RunningWorkoutPlan, "steps">,
): RunningSessionSegment[] {
  return plan.steps.flatMap((step, stepIndex) => {
    const repetitions = Math.max(1, Math.round(step.repetitions || 1));
    const segments: RunningSessionSegment[] = [];
    for (let repetitionIndex = 1; repetitionIndex <= repetitions; repetitionIndex += 1) {
      segments.push(
        workSegment(step, stepIndex, repetitionIndex, repetitions),
      );
      if (repetitionIndex < repetitions) {
        const recovery = recoverySegment(
          step,
          stepIndex,
          repetitionIndex,
          repetitions,
        );
        if (recovery) segments.push(recovery);
      }
    }
    return segments;
  });
}

function planSnapshot(plan: RunningWorkoutPlan): RunningSessionPlanSnapshot {
  return {
    id: plan.id,
    name: plan.name,
    planVersion: plan.planVersion,
    estimatedDurationS: plan.estimatedDurationS,
    estimatedDistanceM: plan.estimatedDistanceM,
    steps: plan.steps,
  };
}

export function createRunningSessionState(
  plan: RunningWorkoutPlan,
): RunningSessionState {
  const segments = expandRunningPlanSegments(plan);
  return {
    version: RUNNING_SESSION_VERSION,
    status: segments.length > 0 ? "idle" : "error",
    plan: planSnapshot(plan),
    segments,
    activeSegmentIndex: 0,
    segmentStartedAtMs: null,
    segmentStartElapsedS: 0,
    segmentStartDistanceM: 0,
    startedAtMs: null,
    finishedAtMs: null,
    results: [],
    lastObservationAtMs: null,
    latestObservation: null,
    lastEvents: [],
    emittedCueIds: [],
    paceSampleCount: 0,
    paceOnTargetSampleCount: 0,
    paceSampleTotalSPerKm: 0,
    bestPaceSPerKm: null,
    errorCode: segments.length > 0 ? null : "empty_plan",
  };
}

function event(
  type: RunningSessionEventType,
  atMs: number,
  segmentId: string | null,
  suffix: string,
  messageKey?: RunningMotivationMessageKey,
): RunningSessionEvent {
  return {
    id: `${type}:${segmentId ?? "workout"}:${atMs}:${suffix}`,
    type,
    atMs,
    segmentId,
    messageKey,
  };
}

function withEvents(
  state: RunningSessionState,
  events: RunningSessionEvent[],
): RunningSessionTransition {
  return {
    state: { ...state, lastEvents: events },
    events,
  };
}

function activeSegment(state: RunningSessionState) {
  return state.segments[state.activeSegmentIndex] ?? null;
}

function observation(input: RunningSessionObservation) {
  return {
    atMs: Math.max(0, Math.round(input.atMs)),
    elapsedS: Math.max(0, Math.round(finiteNonNegative(input.elapsedS))),
    distanceM: finiteNonNegative(input.distanceM),
    currentPaceSPerKm: positiveOrNull(input.currentPaceSPerKm),
    heartRate: positiveOrNull(input.heartRate),
  };
}

export function startRunningSession(
  input: RunningSessionState,
  rawObservation: RunningSessionObservation,
): RunningSessionTransition {
  if (input.status !== "idle") return withEvents(input, []);
  const current = activeSegment(input);
  const snapshot = observation(rawObservation);
  if (!current) {
    return withEvents(
      { ...input, status: "error", errorCode: "empty_plan" },
      [event("running_error", snapshot.atMs, null, "empty")],
    );
  }
  const events = [
    event("running_started", snapshot.atMs, current.id, "start"),
    event("step_started", snapshot.atMs, current.id, "start"),
    event(
      current.kind === "recovery" ? "recovery_start" : "interval_start",
      snapshot.atMs,
      current.id,
      "start",
    ),
    event("motivation", snapshot.atMs, current.id, "start", "started"),
  ];
  return withEvents(
    {
      ...input,
      status: "running",
      startedAtMs: snapshot.atMs,
      segmentStartedAtMs: snapshot.atMs,
      segmentStartElapsedS: snapshot.elapsedS,
      segmentStartDistanceM: snapshot.distanceM,
      latestObservation: snapshot,
      lastObservationAtMs: snapshot.atMs,
      emittedCueIds: ["workout:started"],
    },
    events,
  );
}

export function runningSessionPaceFeedback(
  segment: RunningSessionSegment | null,
  currentPaceSPerKm: number | null | undefined,
): RunningSessionPaceFeedback {
  const pace = positiveOrNull(currentPaceSPerKm);
  if (!segment || !pace) return "unknown";
  const minimum = segment.paceMinSPerKm;
  const maximum = segment.paceMaxSPerKm;
  if (!minimum && !maximum) return "unknown";
  if (minimum && pace < minimum) return "too_fast";
  if (maximum && pace > maximum) return "too_slow";
  return "on_target";
}

function segmentMeasurements(
  state: RunningSessionState,
  snapshot: RunningSessionObservation,
) {
  return {
    elapsedS: Math.max(0, snapshot.elapsedS - state.segmentStartElapsedS),
    distanceM: Math.max(0, snapshot.distanceM - state.segmentStartDistanceM),
  };
}

function segmentIsComplete(
  segment: RunningSessionSegment,
  elapsedS: number,
  distanceM: number,
) {
  if (segment.targetBasis === "distance" && segment.targetDistanceM) {
    return distanceM >= segment.targetDistanceM;
  }
  if (segment.targetBasis === "duration" && segment.targetDurationS) {
    return elapsedS >= segment.targetDurationS;
  }
  if (segment.targetDistanceM) return distanceM >= segment.targetDistanceM;
  if (segment.targetDurationS) return elapsedS >= segment.targetDurationS;
  return false;
}

function resultForActive(
  state: RunningSessionState,
  snapshot: RunningSessionObservation,
  status: RunningSessionSegmentResult["status"],
): RunningSessionSegmentResult | null {
  const segment = activeSegment(state);
  if (!segment) return null;
  const measured = segmentMeasurements(state, snapshot);
  return {
    segmentId: segment.id,
    sourceStepIndex: segment.sourceStepIndex,
    status,
    startedAtMs: state.segmentStartedAtMs ?? snapshot.atMs,
    endedAtMs: snapshot.atMs,
    elapsedS: measured.elapsedS,
    distanceM: measured.distanceM,
    averagePaceSPerKm:
      measured.distanceM >= 50 && measured.elapsedS > 0
        ? Math.round(measured.elapsedS / (measured.distanceM / 1_000))
        : null,
  };
}

function cueEvents(
  state: RunningSessionState,
  snapshot: RunningSessionObservation,
  measured: { elapsedS: number; distanceM: number },
) {
  const segment = activeSegment(state);
  if (!segment) return { events: [] as RunningSessionEvent[], cueIds: [] as string[] };
  const emitted = new Set(state.emittedCueIds);
  const events: RunningSessionEvent[] = [];
  const cueIds: string[] = [];
  const addCue = (cueId: string, messageKey: RunningMotivationMessageKey) => {
    if (emitted.has(cueId)) return;
    emitted.add(cueId);
    cueIds.push(cueId);
    events.push(
      event("motivation", snapshot.atMs, segment.id, cueId, messageKey),
    );
  };

  const remainingDistance =
    segment.targetDistanceM == null
      ? null
      : Math.max(0, segment.targetDistanceM - measured.distanceM);
  if (
    remainingDistance != null &&
    remainingDistance > 0 &&
    remainingDistance <= 500
  ) {
    addCue(`${segment.id}:last-500m`, "last_500m");
  }

  const feedback = runningSessionPaceFeedback(
    segment,
    snapshot.currentPaceSPerKm,
  );
  if (feedback === "on_target" && measured.elapsedS >= 15) {
    addCue(`${segment.id}:on-target`, "on_target");
  }

  const remainingWorkSegments = state.segments
    .slice(state.activeSegmentIndex)
    .filter((candidate) => candidate.kind === "work");
  if (
    segment.kind === "work" &&
    remainingWorkSegments.length === 1 &&
    segment.repetitionCount > 1
  ) {
    addCue(`${segment.id}:last-interval`, "last_interval");
  }

  return { events, cueIds };
}

function paceEvents(
  state: RunningSessionState,
  snapshot: RunningSessionObservation,
) {
  const segment = activeSegment(state);
  const feedback = runningSessionPaceFeedback(
    segment,
    snapshot.currentPaceSPerKm,
  );
  const previousFeedback = runningSessionPaceFeedback(
    segment,
    state.latestObservation?.currentPaceSPerKm,
  );
  if (!segment || feedback === previousFeedback) return [];
  if (feedback === "too_fast") {
    return [event("pace_high", snapshot.atMs, segment.id, "fast")];
  }
  if (feedback === "too_slow") {
    return [event("pace_low", snapshot.atMs, segment.id, "slow")];
  }
  return [];
}

function samplePace(
  state: RunningSessionState,
  snapshot: RunningSessionObservation,
) {
  const pace = positiveOrNull(snapshot.currentPaceSPerKm);
  if (!pace) {
    return {
      paceSampleCount: state.paceSampleCount,
      paceOnTargetSampleCount: state.paceOnTargetSampleCount,
      paceSampleTotalSPerKm: state.paceSampleTotalSPerKm,
      bestPaceSPerKm: state.bestPaceSPerKm,
    };
  }
  const feedback = runningSessionPaceFeedback(activeSegment(state), pace);
  return {
    paceSampleCount: state.paceSampleCount + 1,
    paceOnTargetSampleCount:
      state.paceOnTargetSampleCount + (feedback === "on_target" ? 1 : 0),
    paceSampleTotalSPerKm: state.paceSampleTotalSPerKm + pace,
    bestPaceSPerKm:
      state.bestPaceSPerKm == null ? pace : Math.min(state.bestPaceSPerKm, pace),
  };
}

function completeActiveSegment(
  state: RunningSessionState,
  snapshot: RunningSessionObservation,
  status: RunningSessionSegmentResult["status"],
): RunningSessionTransition {
  const segment = activeSegment(state);
  const result = resultForActive(state, snapshot, status);
  if (!segment || !result) return withEvents(state, []);
  const completionEvent = event(
    status === "skipped" ? "step_skipped" : "step_completed",
    snapshot.atMs,
    segment.id,
    status,
  );
  const completedResults = [
    ...state.results.filter((item) => item.segmentId !== result.segmentId),
    result,
  ];
  const nextIndex = state.activeSegmentIndex + 1;
  if (nextIndex >= state.segments.length) {
    const events = [
      completionEvent,
      event("running_finished", snapshot.atMs, segment.id, "complete"),
      event("motivation", snapshot.atMs, segment.id, "finished", "finished"),
    ];
    return withEvents(
      {
        ...state,
        status: "finished",
        results: completedResults,
        finishedAtMs: snapshot.atMs,
        latestObservation: snapshot,
        lastObservationAtMs: snapshot.atMs,
      },
      events,
    );
  }

  const next = state.segments[nextIndex];
  const events = [
    completionEvent,
    event("step_transition", snapshot.atMs, next.id, `${segment.id}:${next.id}`),
  ];
  if (segment.stepType === "warmup" && status === "completed") {
    events.push(
      event(
        "motivation",
        snapshot.atMs,
        next.id,
        "warmup-completed",
        "warmup_completed",
      ),
    );
  }
  return withEvents(
    {
      ...state,
      status: "transition",
      activeSegmentIndex: nextIndex,
      segmentStartedAtMs: snapshot.atMs,
      segmentStartElapsedS: snapshot.elapsedS,
      segmentStartDistanceM: snapshot.distanceM,
      results: completedResults,
      latestObservation: snapshot,
      lastObservationAtMs: snapshot.atMs,
    },
    events,
  );
}

export function updateRunningSession(
  input: RunningSessionState,
  rawObservation: RunningSessionObservation,
): RunningSessionTransition {
  if (input.status !== "running") return withEvents(input, []);
  const snapshot = observation(rawObservation);
  if (
    input.lastObservationAtMs != null &&
    snapshot.atMs <= input.lastObservationAtMs
  ) {
    return withEvents(input, []);
  }
  const segment = activeSegment(input);
  if (!segment) {
    return withEvents(
      { ...input, status: "error", errorCode: "missing_active_segment" },
      [event("running_error", snapshot.atMs, null, "missing-segment")],
    );
  }

  const measured = segmentMeasurements(input, snapshot);
  const paceEventList = paceEvents(input, snapshot);
  const cues = cueEvents(input, snapshot, measured);
  const sampled = samplePace(input, snapshot);
  const next = {
    ...input,
    ...sampled,
    latestObservation: snapshot,
    lastObservationAtMs: snapshot.atMs,
    emittedCueIds: [...input.emittedCueIds, ...cues.cueIds],
  };

  if (segmentIsComplete(segment, measured.elapsedS, measured.distanceM)) {
    const completed = completeActiveSegment(next, snapshot, "completed");
    return withEvents(completed.state, [
      ...paceEventList,
      ...cues.events,
      ...completed.events,
    ]);
  }
  return withEvents(next, [...paceEventList, ...cues.events]);
}

export function settleRunningSessionTransition(
  input: RunningSessionState,
  rawObservation: RunningSessionObservation,
): RunningSessionTransition {
  if (input.status !== "transition" && input.status !== "step_completed") {
    return withEvents(input, []);
  }
  const snapshot = observation(rawObservation);
  const segment = activeSegment(input);
  if (!segment) return withEvents(input, []);
  const events = [
    event("step_started", snapshot.atMs, segment.id, "transition"),
    event(
      segment.kind === "recovery" ? "recovery_start" : "interval_start",
      snapshot.atMs,
      segment.id,
      "transition",
    ),
  ];
  return withEvents(
    {
      ...input,
      status: "running",
      segmentStartedAtMs: snapshot.atMs,
      segmentStartElapsedS: snapshot.elapsedS,
      segmentStartDistanceM: snapshot.distanceM,
      latestObservation: snapshot,
      lastObservationAtMs: snapshot.atMs,
    },
    events,
  );
}

export function pauseRunningSession(
  input: RunningSessionState,
  atMs: number,
): RunningSessionTransition {
  if (input.status !== "running" && input.status !== "transition") {
    return withEvents(input, []);
  }
  const segment = activeSegment(input);
  return withEvents(
    { ...input, status: "paused" },
    [event("running_paused", atMs, segment?.id ?? null, "pause")],
  );
}

export function resumeRunningSession(
  input: RunningSessionState,
  rawObservation: RunningSessionObservation,
): RunningSessionTransition {
  if (input.status !== "paused") return withEvents(input, []);
  const snapshot = observation(rawObservation);
  const segment = activeSegment(input);
  return withEvents(
    {
      ...input,
      status: "running",
      latestObservation: snapshot,
      lastObservationAtMs: snapshot.atMs,
    },
    [event("running_resumed", snapshot.atMs, segment?.id ?? null, "resume")],
  );
}

export function completeRunningSessionSegment(
  input: RunningSessionState,
  rawObservation: RunningSessionObservation,
): RunningSessionTransition {
  if (
    input.status !== "running" &&
    input.status !== "paused" &&
    input.status !== "transition"
  ) {
    return withEvents(input, []);
  }
  return completeActiveSegment(input, observation(rawObservation), "completed");
}

export function skipRunningSessionSegment(
  input: RunningSessionState,
  rawObservation: RunningSessionObservation,
): RunningSessionTransition {
  if (
    input.status !== "running" &&
    input.status !== "paused" &&
    input.status !== "transition"
  ) {
    return withEvents(input, []);
  }
  return completeActiveSegment(input, observation(rawObservation), "skipped");
}

export function previousRunningSessionSegment(
  input: RunningSessionState,
  rawObservation: RunningSessionObservation,
): RunningSessionTransition {
  if (input.activeSegmentIndex <= 0 || input.status === "finished") {
    return withEvents(input, []);
  }
  const snapshot = observation(rawObservation);
  const previousIndex = input.activeSegmentIndex - 1;
  const previous = input.segments[previousIndex];
  return withEvents(
    {
      ...input,
      status: "transition",
      activeSegmentIndex: previousIndex,
      segmentStartedAtMs: snapshot.atMs,
      segmentStartElapsedS: snapshot.elapsedS,
      segmentStartDistanceM: snapshot.distanceM,
      results: input.results.filter(
        (result) => result.segmentId !== previous.id,
      ),
      latestObservation: snapshot,
      lastObservationAtMs: snapshot.atMs,
    },
    [
      event(
        "step_transition",
        snapshot.atMs,
        previous.id,
        `previous:${previous.id}`,
      ),
    ],
  );
}

export function finishRunningSession(
  input: RunningSessionState,
  rawObservation: RunningSessionObservation,
): RunningSessionTransition {
  if (input.status === "finished") return withEvents(input, []);
  if (input.status === "cancelled" || input.status === "error") {
    return withEvents(input, []);
  }
  const snapshot = observation(rawObservation);
  const result = resultForActive(input, snapshot, "completed");
  const results = result
    ? [
        ...input.results.filter((item) => item.segmentId !== result.segmentId),
        result,
      ]
    : input.results;
  const segment = activeSegment(input);
  return withEvents(
    {
      ...input,
      status: "finished",
      results,
      finishedAtMs: snapshot.atMs,
      latestObservation: snapshot,
      lastObservationAtMs: snapshot.atMs,
    },
    [
      event("running_finished", snapshot.atMs, segment?.id ?? null, "manual"),
      event(
        "motivation",
        snapshot.atMs,
        segment?.id ?? null,
        "finished",
        "finished",
      ),
    ],
  );
}

export function cancelRunningSession(
  input: RunningSessionState,
  atMs: number,
): RunningSessionTransition {
  if (input.status === "finished" || input.status === "cancelled") {
    return withEvents(input, []);
  }
  const segment = activeSegment(input);
  return withEvents(
    { ...input, status: "cancelled", finishedAtMs: atMs },
    [event("workout_cancelled", atMs, segment?.id ?? null, "cancel")],
  );
}

export function getRunningSessionProgress(
  state: RunningSessionState,
  rawObservation = state.latestObservation,
): RunningSessionProgress {
  const snapshot = rawObservation
    ? observation(rawObservation)
    : {
        atMs: 0,
        elapsedS: state.segmentStartElapsedS,
        distanceM: state.segmentStartDistanceM,
        currentPaceSPerKm: null,
        heartRate: null,
      };
  const segment = activeSegment(state);
  const measured = segmentMeasurements(state, snapshot);
  const segmentProgress = segment
    ? segment.targetDistanceM
      ? Math.min(1, measured.distanceM / segment.targetDistanceM)
      : segment.targetDurationS
        ? Math.min(1, measured.elapsedS / segment.targetDurationS)
        : 0
    : 0;
  const completedSegments = state.results.filter(
    (result) => result.status === "completed",
  ).length;
  const skippedSegments = state.results.filter(
    (result) => result.status === "skipped",
  ).length;
  const totalSegments = state.segments.length;
  const settled = completedSegments + skippedSegments;
  const overall =
    totalSegments === 0
      ? 0
      : Math.min(1, (settled + segmentProgress) / totalSegments);
  const remainingDistanceM =
    segment?.targetDistanceM == null
      ? null
      : Math.max(0, segment.targetDistanceM - measured.distanceM);
  const remainingDurationS =
    segment?.targetDurationS == null
      ? null
      : Math.max(0, segment.targetDurationS - measured.elapsedS);
  const planRemaining =
    state.plan.estimatedDurationS == null
      ? null
      : Math.max(0, state.plan.estimatedDurationS - snapshot.elapsedS);
  const planRemainingDistance =
    state.plan.estimatedDistanceM == null
      ? null
      : Math.max(0, state.plan.estimatedDistanceM - snapshot.distanceM);
  return {
    overall,
    segment: segmentProgress,
    completedSegments,
    skippedSegments,
    totalSegments,
    segmentElapsedS: measured.elapsedS,
    segmentDistanceM: measured.distanceM,
    remainingDurationS,
    remainingDistanceM,
    estimatedRemainingS: planRemaining,
    estimatedRemainingDistanceM: planRemainingDistance,
  };
}

export function getRunningSessionSegmentStatus(
  state: RunningSessionState,
  segmentIndex: number,
): RunningSessionSegmentStatus {
  const segment = state.segments[segmentIndex];
  if (!segment) return "pending";
  const result = state.results.find((item) => item.segmentId === segment.id);
  if (result) return result.status;
  if (segmentIndex !== state.activeSegmentIndex) return "pending";
  return state.status === "paused" ? "paused" : "active";
}

export function summarizeRunningSession(
  state: RunningSessionState,
  rawObservation = state.latestObservation,
): RunningSessionSummary {
  const snapshot = rawObservation
    ? observation(rawObservation)
    : {
        atMs: state.finishedAtMs ?? state.startedAtMs ?? 0,
        elapsedS: 0,
        distanceM: 0,
        currentPaceSPerKm: null,
        heartRate: null,
      };
  const completedSegments = state.results.filter(
    (result) => result.status === "completed",
  ).length;
  const skippedSegments = state.results.filter(
    (result) => result.status === "skipped",
  ).length;
  const recoveryIds = new Set(
    state.segments
      .filter((segment) => segment.kind === "recovery")
      .map((segment) => segment.id),
  );
  const recoveryTimeS = state.results
    .filter((result) => recoveryIds.has(result.segmentId))
    .reduce((sum, result) => sum + result.elapsedS, 0);
  const averagePaceSPerKm =
    snapshot.distanceM >= 50 && snapshot.elapsedS > 0
      ? Math.round(snapshot.elapsedS / (snapshot.distanceM / 1_000))
      : null;
  return {
    planId: state.plan.id,
    planName: state.plan.name,
    elapsedS: snapshot.elapsedS,
    distanceM: snapshot.distanceM,
    averagePaceSPerKm,
    bestPaceSPerKm: state.bestPaceSPerKm,
    completedSegments,
    skippedSegments,
    totalSegments: state.segments.length,
    recoveryTimeS,
    runningTimeS: Math.max(0, snapshot.elapsedS - recoveryTimeS),
    paceConsistencyPercent:
      state.paceSampleCount > 0
        ? Math.round(
            (state.paceOnTargetSampleCount / state.paceSampleCount) * 100,
          )
        : null,
    estimatedDurationDeltaS:
      state.plan.estimatedDurationS == null
        ? null
        : snapshot.elapsedS - state.plan.estimatedDurationS,
    estimatedDistanceDeltaM:
      state.plan.estimatedDistanceM == null
        ? null
        : snapshot.distanceM - state.plan.estimatedDistanceM,
  };
}

export function restoreRunningSessionState(
  value: unknown,
): RunningSessionState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Partial<RunningSessionState>;
  if (
    state.version !== RUNNING_SESSION_VERSION ||
    !state.plan ||
    typeof state.plan.id !== "string" ||
    typeof state.plan.name !== "string" ||
    !Array.isArray(state.plan.steps) ||
    !Array.isArray(state.segments) ||
    state.segments.length === 0 ||
    !Array.isArray(state.results) ||
    typeof state.activeSegmentIndex !== "number" ||
    state.activeSegmentIndex < 0 ||
    state.activeSegmentIndex >= state.segments.length
  ) {
    return null;
  }
  const validStatuses: RunningSessionStatus[] = [
    "idle",
    "starting",
    "running",
    "paused",
    "step_completed",
    "transition",
    "finished",
    "cancelled",
    "error",
  ];
  if (!validStatuses.includes(state.status as RunningSessionStatus)) {
    return null;
  }
  return {
    ...(state as RunningSessionState),
    emittedCueIds: Array.isArray(state.emittedCueIds)
      ? state.emittedCueIds.filter((item): item is string => typeof item === "string")
      : [],
    lastEvents: Array.isArray(state.lastEvents) ? state.lastEvents : [],
    paceSampleCount: finiteNonNegative(state.paceSampleCount),
    paceOnTargetSampleCount: finiteNonNegative(
      state.paceOnTargetSampleCount,
    ),
    paceSampleTotalSPerKm: finiteNonNegative(
      state.paceSampleTotalSPerKm,
    ),
    bestPaceSPerKm: positiveOrNull(state.bestPaceSPerKm),
  };
}

import { describe, expect, it } from "vitest";
import type { RunningWorkoutPlan } from "./running";
import {
  cancelRunningSession,
  completeRunningSessionSegment,
  createRunningSessionState,
  expandRunningPlanSegments,
  finishRunningSession,
  getRunningSessionProgress,
  getRunningSessionSegmentStatus,
  pauseRunningSession,
  previousRunningSessionSegment,
  restoreRunningSessionState,
  resumeRunningSession,
  runningSessionPaceFeedback,
  settleRunningSessionTransition,
  skipRunningSessionSegment,
  startRunningSession,
  summarizeRunningSession,
  updateRunningSession,
} from "./running-session";

const plan: RunningWorkoutPlan = {
  id: "plan-1",
  userId: "user-1",
  name: "6 × 400 m",
  description: "Intervalado",
  level: "intermediate",
  goal: "improve_5k",
  source: "manual",
  sourceMetadata: {},
  sportType: "run",
  planVersion: 2,
  isFavorite: false,
  estimatedDurationS: 1_200,
  estimatedDistanceM: 2_800,
  createdAt: "2026-07-24T10:00:00.000Z",
  updatedAt: "2026-07-24T10:00:00.000Z",
  steps: [
    {
      id: "warmup",
      position: 0,
      stepType: "warmup",
      title: "Aquecimento",
      repetitions: 1,
      targetBasis: "duration",
      durationS: 120,
      recoveryType: "none",
    },
    {
      id: "interval",
      position: 1,
      stepType: "interval",
      title: "Tiro",
      repetitions: 2,
      targetBasis: "distance",
      distanceM: 400,
      paceMinSPerKm: 290,
      paceMaxSPerKm: 305,
      recoveryType: "walking",
      recoveryDurationS: 60,
    },
    {
      id: "cooldown",
      position: 2,
      stepType: "cooldown",
      title: "Desaquecimento",
      repetitions: 1,
      targetBasis: "duration",
      durationS: 60,
      recoveryType: "none",
    },
  ],
};

function sample(
  atMs: number,
  elapsedS: number,
  distanceM: number,
  currentPaceSPerKm: number | null = null,
) {
  return { atMs, elapsedS, distanceM, currentPaceSPerKm };
}

describe("running session plan expansion", () => {
  it("expands repetitions and recovery into deterministic segments", () => {
    const segments = expandRunningPlanSegments(plan);
    expect(segments.map((segment) => segment.id)).toEqual([
      "warmup:work:1",
      "interval:work:1",
      "interval:recovery:1",
      "interval:work:2",
      "cooldown:work:1",
    ]);
    expect(segments[2]).toMatchObject({
      kind: "recovery",
      targetDurationS: 60,
      recoveryType: "walking",
    });
  });

  it("uses the upper range as the safe automatic completion target", () => {
    const ranged = {
      ...plan,
      steps: [
        {
          ...plan.steps[0],
          durationS: null,
          durationMinS: 180,
          durationMaxS: 300,
        },
      ],
    };
    expect(expandRunningPlanSegments(ranged)[0].targetDurationS).toBe(300);
  });
});

describe("running session state machine", () => {
  it("starts, pauses, resumes and keeps explicit states", () => {
    const idle = createRunningSessionState(plan);
    const started = startRunningSession(idle, sample(1_000, 0, 0));
    expect(started.state.status).toBe("running");
    expect(started.events.map((item) => item.type)).toContain(
      "running_started",
    );

    const paused = pauseRunningSession(started.state, 2_000);
    expect(paused.state.status).toBe("paused");
    expect(getRunningSessionSegmentStatus(paused.state, 0)).toBe("paused");
    const resumed = resumeRunningSession(
      paused.state,
      sample(4_000, 1, 0),
    );
    expect(resumed.state.status).toBe("running");
    expect(getRunningSessionSegmentStatus(resumed.state, 0)).toBe("active");
    expect(getRunningSessionSegmentStatus(resumed.state, 1)).toBe("pending");
    expect(resumed.events[0].type).toBe("running_resumed");
  });

  it("automatically completes duration and distance targets", () => {
    const started = startRunningSession(
      createRunningSessionState(plan),
      sample(1_000, 0, 0),
    ).state;
    const warmupDone = updateRunningSession(
      started,
      sample(121_000, 120, 50),
    );
    expect(warmupDone.state.status).toBe("transition");
    expect(warmupDone.state.activeSegmentIndex).toBe(1);
    expect(getRunningSessionSegmentStatus(warmupDone.state, 0)).toBe(
      "completed",
    );

    const interval = settleRunningSessionTransition(
      warmupDone.state,
      sample(121_100, 120, 50),
    ).state;
    const intervalDone = updateRunningSession(
      interval,
      sample(241_100, 240, 450, 300),
    );
    expect(intervalDone.state.status).toBe("transition");
    expect(intervalDone.state.activeSegmentIndex).toBe(2);
  });

  it("does not double-apply a delayed or duplicated GPS observation", () => {
    const started = startRunningSession(
      createRunningSessionState(plan),
      sample(1_000, 0, 0),
    ).state;
    const first = updateRunningSession(
      started,
      sample(10_000, 9, 15),
    ).state;
    const duplicate = updateRunningSession(
      first,
      sample(10_000, 9, 15),
    ).state;
    expect(duplicate).toEqual(first);
  });

  it("supports manual completion, skip and previous step fallback", () => {
    const started = startRunningSession(
      createRunningSessionState(plan),
      sample(1_000, 0, 0),
    ).state;
    const completed = completeRunningSessionSegment(
      started,
      sample(31_000, 30, 20),
    ).state;
    expect(completed.results[0].status).toBe("completed");

    const interval = settleRunningSessionTransition(
      completed,
      sample(31_100, 30, 20),
    ).state;
    const skipped = skipRunningSessionSegment(
      interval,
      sample(40_000, 39, 40),
    ).state;
    expect(skipped.results.at(-1)?.status).toBe("skipped");

    const previous = previousRunningSessionSegment(
      skipped,
      sample(41_000, 40, 40),
    ).state;
    expect(previous.activeSegmentIndex).toBe(1);
    expect(
      previous.results.some(
        (result) => result.segmentId === "interval:work:1",
      ),
    ).toBe(false);
  });

  it("detects the last block and finishes the engine", () => {
    let state = startRunningSession(
      createRunningSessionState({
        ...plan,
        steps: [plan.steps[2]],
      }),
      sample(1_000, 0, 0),
    ).state;
    state = updateRunningSession(
      state,
      sample(61_000, 60, 100),
    ).state;
    expect(state.status).toBe("finished");
    expect(state.lastEvents.map((item) => item.type)).toContain(
      "running_finished",
    );
  });

  it("finishes or cancels manually without invalid transitions", () => {
    const started = startRunningSession(
      createRunningSessionState(plan),
      sample(1_000, 0, 0),
    ).state;
    expect(
      finishRunningSession(started, sample(50_000, 49, 300)).state.status,
    ).toBe("finished");
    expect(cancelRunningSession(started, 50_000).state.status).toBe(
      "cancelled",
    );
  });

  it("rejects an empty plan and an invalid restored payload", () => {
    const empty = createRunningSessionState({ ...plan, steps: [] });
    expect(empty.status).toBe("error");
    expect(restoreRunningSessionState({ version: 1 })).toBeNull();
  });
});

describe("running session pace, progress and summary", () => {
  it("classifies pace against the prescribed range", () => {
    const segment = expandRunningPlanSegments(plan)[1];
    expect(runningSessionPaceFeedback(segment, 280)).toBe("too_fast");
    expect(runningSessionPaceFeedback(segment, 298)).toBe("on_target");
    expect(runningSessionPaceFeedback(segment, 320)).toBe("too_slow");
  });

  it("calculates progress and remaining target", () => {
    const started = startRunningSession(
      createRunningSessionState(plan),
      sample(1_000, 0, 0),
    ).state;
    const progress = getRunningSessionProgress(
      started,
      sample(61_000, 60, 20),
    );
    expect(progress.segment).toBe(0.5);
    expect(progress.remainingDurationS).toBe(60);
    expect(progress.estimatedRemainingDistanceM).toBe(2_780);
    expect(progress.totalSegments).toBe(5);
  });

  it("summarizes completed/skipped blocks and recovery time", () => {
    let state = startRunningSession(
      createRunningSessionState(plan),
      sample(1_000, 0, 0),
    ).state;
    state = completeRunningSessionSegment(
      state,
      sample(121_000, 120, 50),
    ).state;
    state = settleRunningSessionTransition(
      state,
      sample(121_100, 120, 50),
    ).state;
    state = completeRunningSessionSegment(
      state,
      sample(241_000, 240, 450, 300),
    ).state;
    state = settleRunningSessionTransition(
      state,
      sample(241_100, 240, 450),
    ).state;
    state = completeRunningSessionSegment(
      state,
      sample(301_000, 300, 480),
    ).state;

    const summary = summarizeRunningSession(
      state,
      sample(301_000, 300, 480),
    );
    expect(summary.completedSegments).toBe(3);
    expect(summary.recoveryTimeS).toBe(60);
    expect(summary.runningTimeS).toBe(240);
    expect(summary.planId).toBe("plan-1");
    expect(summary.totalSegments).toBe(5);
  });
});

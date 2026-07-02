import { describe, expect, it } from "vitest";
import {
  REST_TIMER_INITIAL,
  restTimerReducer,
  type RestTimerState,
} from "./restTimer";
import { elapsedSecondsSince, formatElapsed } from "./workoutElapsed";

function run(state: RestTimerState, ticks: number): RestTimerState {
  let next = state;
  for (let i = 0; i < ticks; i += 1) next = restTimerReducer(next, { type: "tick" });
  return next;
}

describe("restTimerReducer", () => {
  it("start(90) → running com 90s; tick decrementa", () => {
    let s = restTimerReducer(REST_TIMER_INITIAL, { type: "start", presetS: 90 });
    expect(s).toMatchObject({ status: "running", presetS: 90, remainingS: 90 });
    s = restTimerReducer(s, { type: "tick" });
    expect(s.remainingS).toBe(89);
  });

  it("chega a zero → done (e ticks extras não passam de done)", () => {
    let s = restTimerReducer(REST_TIMER_INITIAL, { type: "start", presetS: 5 });
    s = run(s, 5);
    expect(s).toMatchObject({ status: "done", remainingS: 0 });
    s = restTimerReducer(s, { type: "tick" });
    expect(s.status).toBe("done");
  });

  it("pause congela, resume continua, reset re-arma no preset", () => {
    let s = restTimerReducer(REST_TIMER_INITIAL, { type: "start", presetS: 60 });
    s = run(s, 10);
    s = restTimerReducer(s, { type: "pause" });
    const frozen = s.remainingS;
    s = restTimerReducer(s, { type: "tick" });
    expect(s.remainingS).toBe(frozen);
    s = restTimerReducer(s, { type: "resume" });
    s = restTimerReducer(s, { type: "tick" });
    expect(s.remainingS).toBe(frozen - 1);
    s = restTimerReducer(s, { type: "reset" });
    expect(s).toMatchObject({ status: "idle", remainingS: 60 });
  });

  it("setPreset fora da contagem re-arma; durante a contagem só troca o preset", () => {
    let s = restTimerReducer(REST_TIMER_INITIAL, { type: "setPreset", presetS: 120 });
    expect(s).toMatchObject({ status: "idle", presetS: 120, remainingS: 120 });
    s = restTimerReducer(s, { type: "start" });
    s = run(s, 5);
    s = restTimerReducer(s, { type: "setPreset", presetS: 60 });
    expect(s.presetS).toBe(60);
    expect(s.remainingS).toBe(115);
    expect(s.status).toBe("running");
  });

  it("custom mínimo de 5s (não deixa timer de 0/negativo)", () => {
    const s = restTimerReducer(REST_TIMER_INITIAL, { type: "start", presetS: 1 });
    expect(s.presetS).toBe(5);
  });
});

describe("workoutElapsed", () => {
  it("elapsedSecondsSince deriva do relógio (floor, nunca negativo)", () => {
    expect(elapsedSecondsSince(1_000, 4_999)).toBe(3);
    expect(elapsedSecondsSince(5_000, 1_000)).toBe(0);
  });

  it("formatElapsed: mm:ss abaixo de 1h, h:mm:ss acima", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(61)).toBe("1:01");
    expect(formatElapsed(3480)).toBe("58:00");
    expect(formatElapsed(3723)).toBe("1:02:03");
  });
});

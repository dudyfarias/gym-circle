import { describe, expect, it } from "vitest";
import {
  REST_TIMER_INITIAL,
  restTimerReducer,
  type RestTimerState,
} from "./restTimer";
import { elapsedSecondsSince, formatElapsed } from "./workoutElapsed";

function run(
  state: RestTimerState,
  ticks: number,
  startNowMs = 0,
): RestTimerState {
  let next = state;
  for (let i = 1; i <= ticks; i += 1) {
    next = restTimerReducer(next, {
      type: "tick",
      nowMs: startNowMs + i * 1_000,
    });
  }
  return next;
}

describe("restTimerReducer", () => {
  it("start(90) → running com 90s; tick decrementa", () => {
    let s = restTimerReducer(REST_TIMER_INITIAL, {
      type: "start",
      presetS: 90,
      nowMs: 0,
    });
    expect(s).toMatchObject({ status: "running", presetS: 90, remainingS: 90 });
    s = restTimerReducer(s, { type: "tick", nowMs: 1_000 });
    expect(s.remainingS).toBe(89);
  });

  it("chega a zero → done (e ticks extras não passam de done)", () => {
    let s = restTimerReducer(REST_TIMER_INITIAL, {
      type: "start",
      presetS: 5,
      nowMs: 0,
    });
    s = run(s, 5);
    expect(s).toMatchObject({ status: "done", remainingS: 0 });
    s = restTimerReducer(s, { type: "tick", nowMs: 6_000 });
    expect(s.status).toBe("done");
  });

  it("pause congela, resume continua, reset re-arma no preset", () => {
    let s = restTimerReducer(REST_TIMER_INITIAL, {
      type: "start",
      presetS: 60,
      nowMs: 0,
    });
    s = run(s, 10);
    s = restTimerReducer(s, { type: "pause", nowMs: 10_000 });
    const frozen = s.remainingS;
    s = restTimerReducer(s, { type: "tick", nowMs: 20_000 });
    expect(s.remainingS).toBe(frozen);
    s = restTimerReducer(s, { type: "resume", nowMs: 20_000 });
    s = restTimerReducer(s, { type: "tick", nowMs: 21_000 });
    expect(s.remainingS).toBe(frozen - 1);
    s = restTimerReducer(s, { type: "reset" });
    expect(s).toMatchObject({ status: "idle", remainingS: 60 });
  });

  it("setPreset fora da contagem re-arma; durante a contagem só troca o preset", () => {
    let s = restTimerReducer(REST_TIMER_INITIAL, { type: "setPreset", presetS: 120 });
    expect(s).toMatchObject({ status: "idle", presetS: 120, remainingS: 120 });
    s = restTimerReducer(s, { type: "start", nowMs: 0 });
    s = run(s, 5);
    s = restTimerReducer(s, { type: "setPreset", presetS: 60 });
    expect(s.presetS).toBe(60);
    expect(s.remainingS).toBe(115);
    expect(s.status).toBe("running");
  });

  it("custom mínimo de 5s (não deixa timer de 0/negativo)", () => {
    const s = restTimerReducer(REST_TIMER_INITIAL, {
      type: "start",
      presetS: 1,
      nowMs: 0,
    });
    expect(s.presetS).toBe(5);
  });

  it("começa em 1:00 e ajusta em passos de 10s", () => {
    expect(REST_TIMER_INITIAL).toMatchObject({
      presetS: 60,
      remainingS: 60,
    });
    let s = restTimerReducer(REST_TIMER_INITIAL, {
      type: "adjust",
      deltaS: 10,
      nowMs: 0,
    });
    expect(s).toMatchObject({ presetS: 70, remainingS: 70 });
    s = restTimerReducer(s, {
      type: "adjust",
      deltaS: -10,
      nowMs: 0,
    });
    expect(s).toMatchObject({ presetS: 60, remainingS: 60 });
  });

  it("usa deadline absoluto depois de suspensão em background", () => {
    let s = restTimerReducer(REST_TIMER_INITIAL, {
      type: "start",
      presetS: 60,
      nowMs: 1_000,
    });
    s = restTimerReducer(s, { type: "tick", nowMs: 31_000 });
    expect(s.remainingS).toBe(30);
    s = restTimerReducer(s, { type: "tick", nowMs: 70_000 });
    expect(s).toMatchObject({ status: "done", remainingS: 0 });
  });

  it("restaura timer expirado como concluído", () => {
    const running = restTimerReducer(REST_TIMER_INITIAL, {
      type: "start",
      presetS: 30,
      nowMs: 5_000,
    });
    const restored = restTimerReducer(REST_TIMER_INITIAL, {
      type: "restore",
      state: running,
      nowMs: 40_000,
    });
    expect(restored).toMatchObject({ status: "done", remainingS: 0 });
  });

  it("ajusta a partir do restante real, não do último tick renderizado", () => {
    const running = restTimerReducer(REST_TIMER_INITIAL, {
      type: "start",
      presetS: 60,
      nowMs: 0,
    });
    const adjusted = restTimerReducer(running, {
      type: "adjust",
      deltaS: 10,
      nowMs: 30_000,
    });
    expect(adjusted).toMatchObject({ remainingS: 40, endsAtMs: 70_000 });
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

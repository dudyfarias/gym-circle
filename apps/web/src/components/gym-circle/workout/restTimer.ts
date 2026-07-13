/**
 * Timer de descanso do "Iniciar treino" (rastreio de treino, Fase 1).
 *
 * Lógica PURA (reducer) — o componente dispara `tick` a cada segundo via
 * setInterval; aqui só evolui o estado, então dá pra testar sem timers reais.
 */
export type RestTimerState = {
  status: "idle" | "running" | "paused" | "done";
  /** Duração escolhida (preset ou custom), em segundos. */
  presetS: number;
  /** Quanto falta, em segundos. */
  remainingS: number;
  /** Deadline absoluto; torna a contagem resiliente a background/suspensão. */
  endsAtMs: number | null;
};

export type RestTimerAction =
  | { type: "start"; presetS?: number; nowMs: number }
  | { type: "tick"; nowMs: number }
  | { type: "pause"; nowMs: number }
  | { type: "resume"; nowMs: number }
  | { type: "reset" }
  | { type: "adjust"; deltaS: number; nowMs: number }
  | { type: "setPreset"; presetS: number }
  | { type: "restore"; state: RestTimerState; nowMs: number };

export const REST_TIMER_INITIAL: RestTimerState = {
  status: "idle",
  presetS: 60,
  remainingS: 60,
  endsAtMs: null,
};

function remainingAt(state: RestTimerState, nowMs: number) {
  if (state.status !== "running" || state.endsAtMs === null) {
    return state.remainingS;
  }
  return Math.max(0, Math.ceil((state.endsAtMs - nowMs) / 1_000));
}

export function restTimerReducer(
  state: RestTimerState,
  action: RestTimerAction,
): RestTimerState {
  switch (action.type) {
    case "setPreset": {
      const presetS = Math.max(5, Math.floor(action.presetS));
      // Trocar o preset fora de uma contagem re-arma o timer.
      if (state.status === "running" || state.status === "paused") {
        return { ...state, presetS };
      }
      return { status: "idle", presetS, remainingS: presetS, endsAtMs: null };
    }
    case "start": {
      const presetS = Math.max(5, Math.floor(action.presetS ?? state.presetS));
      return {
        status: "running",
        presetS,
        remainingS: presetS,
        endsAtMs: action.nowMs + presetS * 1_000,
      };
    }
    case "tick": {
      if (state.status !== "running") return state;
      const remainingS = remainingAt(state, action.nowMs);
      if (remainingS <= 0) {
        return { ...state, status: "done", remainingS: 0, endsAtMs: null };
      }
      return { ...state, remainingS };
    }
    case "pause":
      return state.status === "running"
        ? {
            ...state,
            status: "paused",
            remainingS: remainingAt(state, action.nowMs),
            endsAtMs: null,
          }
        : state;
    case "resume":
      return state.status === "paused"
        ? {
            ...state,
            status: "running",
            endsAtMs: action.nowMs + state.remainingS * 1_000,
          }
        : state;
    case "adjust": {
      const deltaS = Math.trunc(action.deltaS);
      const presetS = Math.max(10, Math.min(15 * 60, state.presetS + deltaS));
      if (state.status === "running" || state.status === "paused") {
        const currentRemainingS = remainingAt(state, action.nowMs);
        const remainingS = Math.max(
          0,
          Math.min(15 * 60, currentRemainingS + deltaS),
        );
        return {
          ...state,
          presetS,
          remainingS,
          endsAtMs:
            state.status === "running"
              ? action.nowMs + remainingS * 1_000
              : null,
        };
      }
      return { status: "idle", presetS, remainingS: presetS, endsAtMs: null };
    }
    case "reset":
      return {
        status: "idle",
        presetS: state.presetS,
        remainingS: state.presetS,
        endsAtMs: null,
      };
    case "restore":
      return restTimerReducer(action.state, {
        type: "tick",
        nowMs: action.nowMs,
      });
    default:
      return state;
  }
}

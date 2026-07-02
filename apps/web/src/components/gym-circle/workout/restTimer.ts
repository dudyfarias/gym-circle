/**
 * Timer de descanso do "Iniciar treino" (rastreio de treino, Fase 1).
 *
 * Lógica PURA (reducer) — o componente dispara `tick` a cada segundo via
 * setInterval; aqui só evolui o estado, então dá pra testar sem timers reais.
 */
export const REST_PRESETS_S = [60, 90, 120] as const;

export type RestTimerState = {
  status: "idle" | "running" | "paused" | "done";
  /** Duração escolhida (preset ou custom), em segundos. */
  presetS: number;
  /** Quanto falta, em segundos. */
  remainingS: number;
};

export type RestTimerAction =
  | { type: "start"; presetS?: number }
  | { type: "tick" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "reset" }
  | { type: "setPreset"; presetS: number };

export const REST_TIMER_INITIAL: RestTimerState = {
  status: "idle",
  presetS: 90,
  remainingS: 90,
};

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
      return { status: "idle", presetS, remainingS: presetS };
    }
    case "start": {
      const presetS = Math.max(5, Math.floor(action.presetS ?? state.presetS));
      return { status: "running", presetS, remainingS: presetS };
    }
    case "tick": {
      if (state.status !== "running") return state;
      const remainingS = state.remainingS - 1;
      if (remainingS <= 0) {
        return { ...state, status: "done", remainingS: 0 };
      }
      return { ...state, remainingS };
    }
    case "pause":
      return state.status === "running"
        ? { ...state, status: "paused" }
        : state;
    case "resume":
      return state.status === "paused"
        ? { ...state, status: "running" }
        : state;
    case "reset":
      return { status: "idle", presetS: state.presetS, remainingS: state.presetS };
    default:
      return state;
  }
}

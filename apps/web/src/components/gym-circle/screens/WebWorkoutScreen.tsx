"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  Bike,
  Dumbbell,
  Footprints,
  MoveRight,
  Play,
  Smartphone,
  Square,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  ComposerActivityContext,
  FinishedWebActivity,
  WebActivityInput,
} from "../social/types";
import {
  REST_PRESETS_S,
  REST_TIMER_INITIAL,
  restTimerReducer,
} from "../workout/restTimer";
import { elapsedSecondsSince, formatElapsed } from "../workout/workoutElapsed";

type WorkoutType = WebActivityInput["activityType"];

type WebWorkoutScreenProps = {
  open: boolean;
  onClose: () => void;
  onFinish: (input: WebActivityInput) => Promise<FinishedWebActivity>;
  /** Encerrar → composer (legenda/local/tags); post sai mesmo sem foto. */
  onCompose: (activity: ComposerActivityContext) => void;
};

// Persistência anti-refresh: o cronômetro deriva SEMPRE de startedAt.
const STORAGE_KEY = "gc-web-workout";

type StoredWorkout = { startedAtMs: number; activityType: WorkoutType };

function readStored(): StoredWorkout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredWorkout;
    return typeof parsed.startedAtMs === "number" ? parsed : null;
  } catch {
    return null;
  }
}

// Seletor estilo Apple Exercício: academia primeiro (público principal).
const TYPE_CARDS: Array<{ type: WorkoutType; icon: typeof Dumbbell }> = [
  { type: "strength", icon: Dumbbell },
  { type: "run", icon: MoveRight },
  { type: "walk", icon: Footprints },
  { type: "ride", icon: Bike },
  { type: "other", icon: Play },
];

/**
 * Rastreio de treino (Fase 1) — "Iniciar treino" no web, versão enxuta:
 * seletor de tipo (cards estilo Apple Watch) → cronômetro + timer de
 * descanso + aviso de precisão → encerrar → composer (post mesmo sem foto).
 */
export function WebWorkoutScreen({
  open,
  onClose,
  onFinish,
  onCompose,
}: WebWorkoutScreenProps) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<"pick" | "live">("pick");
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [activityType, setActivityType] = useState<WorkoutType>("strength");
  const [elapsedS, setElapsedS] = useState(0);
  const [rest, dispatchRest] = useReducer(restTimerReducer, REST_TIMER_INITIAL);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const restDoneNotified = useRef(false);

  // Abrir: treino em andamento (refresh/reabriu) retoma direto no live;
  // senão começa no seletor de tipo. setTimeout(0) evita set-state-in-effect.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const stored = readStored();
      setFinishError(null);
      if (stored) {
        setStartedAtMs(stored.startedAtMs);
        setActivityType(stored.activityType);
        setElapsedS(elapsedSecondsSince(stored.startedAtMs, Date.now()));
        setStage("live");
      } else {
        setStartedAtMs(null);
        setElapsedS(0);
        setStage("pick");
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  // Tick de 1s: cronômetro (derivado do relógio) + timer de descanso.
  useEffect(() => {
    if (!open || stage !== "live" || startedAtMs === null) return;
    const id = window.setInterval(() => {
      setElapsedS(elapsedSecondsSince(startedAtMs, Date.now()));
      dispatchRest({ type: "tick" });
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, stage, startedAtMs]);

  // Descanso zerou → vibra (quando suportado), uma vez por contagem.
  useEffect(() => {
    if (rest.status === "done" && !restDoneNotified.current) {
      restDoneNotified.current = true;
      navigator.vibrate?.([180, 90, 180]);
    }
    if (rest.status !== "done") restDoneNotified.current = false;
  }, [rest.status]);

  const startWorkout = useCallback((type: WorkoutType) => {
    const startMs = Date.now();
    setActivityType(type);
    setStartedAtMs(startMs);
    setElapsedS(0);
    setStage("live");
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ startedAtMs: startMs, activityType: type } satisfies StoredWorkout),
    );
    navigator.vibrate?.(60);
  }, []);

  const handleFinish = useCallback(async () => {
    if (startedAtMs === null || finishing) return;
    setFinishing(true);
    setFinishError(null);
    try {
      const endedMs = Date.now();
      const activity = await onFinish({
        activityType,
        startedAt: new Date(startedAtMs).toISOString(),
        endedAt: new Date(endedMs).toISOString(),
        elapsedS: elapsedSecondsSince(startedAtMs, endedMs),
      });
      window.localStorage.removeItem(STORAGE_KEY);
      dispatchRest({ type: "reset" });
      // Direto pro composer: legenda, local, tags — post sai mesmo sem foto.
      onCompose({
        id: activity.id,
        activityType,
        elapsedS: activity.elapsedS,
        workoutDate: activity.workoutDate,
      });
    } catch (err) {
      setFinishError(err instanceof Error ? err.message : t("workout.errors.finish"));
    } finally {
      setFinishing(false);
    }
  }, [activityType, finishing, onCompose, onFinish, startedAtMs, t]);

  const handleDiscard = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    dispatchRest({ type: "reset" });
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex justify-center overflow-y-auto bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={t("workout.title")}
    >
      <div className="flex min-h-full w-full max-w-[480px] flex-col px-5 pb-[calc(var(--gc-safe-bottom)+24px)] pt-[calc(var(--gc-safe-top)+18px)]">
        {stage === "pick" ? (
          <>
            {/* Seletor de tipo — cards estilo Apple Exercício */}
            <header className="flex items-center justify-between">
              <h2 className="text-[26px] font-black text-white">{t("workout.title")}</h2>
              <button
                aria-label={t("common.close")}
                className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.06] text-white"
                onClick={onClose}
                type="button"
              >
                <X size={20} strokeWidth={2.4} />
              </button>
            </header>
            <div className="mt-4 space-y-3 pb-6">
              {TYPE_CARDS.map(({ type, icon: Icon }) => (
                <button
                  className="gc-pressable w-full rounded-[24px] border border-white/[0.07] bg-[#101214] px-5 py-5 text-left"
                  key={type}
                  onClick={() => startWorkout(type)}
                  type="button"
                >
                  <div className="flex items-start justify-between">
                    <Icon className="text-[var(--gc-blue)]" size={30} strokeWidth={2.2} />
                    <span className="grid size-12 place-items-center rounded-full bg-[var(--gc-blue)] text-black">
                      <Play className="ml-0.5" fill="currentColor" size={20} />
                    </span>
                  </div>
                  <p className="mt-3 text-[19px] font-black text-white">
                    {t(`workout.types.${type}`)}
                  </p>
                  <p className="mt-0.5 text-[12px] font-bold text-white/40">
                    {t(`workout.typeHints.${type}`)}
                  </p>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Ao vivo — data-first */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-2 text-[13px] font-black text-white">
                {t(`workout.types.${activityType}`)}
              </span>
              <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--gc-blue)]">
                {t("workout.liveBadge")}
              </span>
            </div>

            {/* Aviso: no app é mais preciso */}
            <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-[var(--gc-blue)]/24 bg-[var(--gc-blue)]/10 px-3.5 py-3">
              <Smartphone className="mt-0.5 shrink-0 text-[var(--gc-blue)]" size={17} />
              <p className="text-[12.5px] font-bold leading-snug text-[#bfe6f0]">
                {t("workout.precisionNotice")}
              </p>
            </div>

            {/* Cronômetro */}
            <div className="mt-7 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
                {t("workout.elapsed")}
              </p>
              <p className="mt-1 text-[64px] font-black leading-none tracking-tight text-[var(--gc-blue)]">
                {formatElapsed(elapsedS)}
              </p>
            </div>

            {/* Timer de descanso */}
            <div className="mt-7 rounded-[24px] border border-white/[0.08] bg-[#0c0d0e] px-5 py-5 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
                {t("workout.rest.title")}
              </p>
              <p
                className={[
                  "mt-2 text-[40px] font-black leading-none",
                  rest.status === "done" ? "text-emerald-400" : "text-white",
                ].join(" ")}
              >
                {rest.status === "done"
                  ? t("workout.rest.done")
                  : formatElapsed(rest.remainingS)}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {REST_PRESETS_S.map((preset) => (
                  <button
                    className={[
                      "gc-pressable rounded-full px-3.5 py-2 text-[12.5px] font-black",
                      rest.presetS === preset
                        ? "bg-[var(--gc-blue)]/15 text-[var(--gc-blue)]"
                        : "bg-white/[0.055] text-white/60",
                    ].join(" ")}
                    key={preset}
                    onClick={() => dispatchRest({ type: "setPreset", presetS: preset })}
                    type="button"
                  >
                    {preset}s
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-center gap-2">
                {rest.status === "running" ? (
                  <button
                    className="gc-pressable rounded-full bg-white/[0.08] px-5 py-2.5 text-[13px] font-black text-white"
                    onClick={() => dispatchRest({ type: "reset" })}
                    type="button"
                  >
                    {t("workout.rest.cancel")}
                  </button>
                ) : (
                  <button
                    className="gc-pressable rounded-full bg-[var(--gc-blue)] px-6 py-2.5 text-[13px] font-black text-black"
                    onClick={() => dispatchRest({ type: "start" })}
                    type="button"
                  >
                    {t("workout.rest.start")}
                  </button>
                )}
              </div>
            </div>

            {finishError ? (
              <p className="mt-4 text-center text-[12.5px] font-bold text-[var(--gc-pink)]">
                {finishError}
              </p>
            ) : null}

            {/* Encerrar (→ composer) / descartar */}
            <div className="mt-auto pt-8">
              <button
                className="gc-pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--gc-pink)] py-3.5 text-[15px] font-black text-white disabled:opacity-60"
                disabled={finishing}
                onClick={() => void handleFinish()}
                type="button"
              >
                <Square size={16} />
                {finishing ? t("workout.finishing") : t("workout.finish")}
              </button>
              <button
                className="gc-pressable mt-2 w-full py-3 text-center text-[13px] font-bold text-white/40"
                onClick={handleDiscard}
                type="button"
              >
                {t("workout.discard")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

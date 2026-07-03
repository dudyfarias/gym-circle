"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Camera, Check, Flame, Smartphone, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FinishedWebActivity, WebActivityInput } from "../social/types";
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
  /** Abre o composer já linkado à atividade ("Adicionar foto do treino"). */
  onAddPhoto: (activity: FinishedWebActivity) => void;
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

const TYPE_KEYS: WorkoutType[] = ["strength", "run", "walk", "ride", "other"];

/**
 * Rastreio de treino (Fase 1) — "Iniciar treino" no web, versão enxuta:
 * cronômetro + timer de descanso programável + aviso de que o app é mais
 * preciso (GPS/FC/calorias são nativos). Ao encerrar, a atividade marca o
 * dia/streak e o resumo oferece virar post com foto.
 */
export function WebWorkoutScreen({
  open,
  onClose,
  onFinish,
  onAddPhoto,
}: WebWorkoutScreenProps) {
  const { t } = useTranslation();
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [activityType, setActivityType] = useState<WorkoutType>("strength");
  const [elapsedS, setElapsedS] = useState(0);
  const [rest, dispatchRest] = useReducer(restTimerReducer, REST_TIMER_INITIAL);
  const [finished, setFinished] = useState<FinishedWebActivity | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const restDoneNotified = useRef(false);

  // Abrir = iniciar (retomando treino em andamento se houver). setTimeout(0)
  // evita o lint set-state-in-effect (mesmo padrão do EditPostSheet).
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const stored = readStored();
      const startMs = stored?.startedAtMs ?? Date.now();
      setStartedAtMs(startMs);
      if (stored?.activityType) setActivityType(stored.activityType);
      setFinished(null);
      setFinishError(null);
      setElapsedS(elapsedSecondsSince(startMs, Date.now()));
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          startedAtMs: startMs,
          activityType: stored?.activityType ?? "strength",
        } satisfies StoredWorkout),
      );
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  // Tick de 1s: cronômetro (derivado do relógio) + timer de descanso.
  useEffect(() => {
    if (!open || startedAtMs === null || finished) return;
    const id = window.setInterval(() => {
      setElapsedS(elapsedSecondsSince(startedAtMs, Date.now()));
      dispatchRest({ type: "tick" });
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, startedAtMs, finished]);

  // Descanso zerou → vibra (quando suportado), uma vez por contagem.
  useEffect(() => {
    if (rest.status === "done" && !restDoneNotified.current) {
      restDoneNotified.current = true;
      navigator.vibrate?.([180, 90, 180]);
    }
    if (rest.status !== "done") restDoneNotified.current = false;
  }, [rest.status]);

  const selectType = useCallback(
    (type: WorkoutType) => {
      setActivityType(type);
      if (startedAtMs !== null) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ startedAtMs, activityType: type } satisfies StoredWorkout),
        );
      }
    },
    [startedAtMs],
  );

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
      setFinished(activity);
    } catch (err) {
      setFinishError(err instanceof Error ? err.message : t("workout.errors.finish"));
    } finally {
      setFinishing(false);
    }
  }, [activityType, finishing, onFinish, startedAtMs, t]);

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
        {finished ? (
          <>
            {/* Resumo — treino concluído */}
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="grid size-14 place-items-center rounded-full bg-emerald-500/12 text-emerald-400">
                <Check size={30} />
              </div>
              <h2 className="mt-4 text-[20px] font-black text-white">
                {t("workout.summary.title")}
              </h2>
              <p className="mt-1 text-[13px] font-bold text-white/46">
                {t(`workout.types.${activityType}`)} · {formatElapsed(finished.elapsedS)}
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3.5 py-2.5 text-[12.5px] font-bold text-emerald-300">
                <Flame size={15} />
                {t("workout.summary.streakKept")}
              </div>
              <div className="mt-7 w-full rounded-[24px] border border-white/[0.08] bg-[#0c0d0e] px-5 py-5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
                  {t("workout.elapsed")}
                </p>
                <p className="mt-1 text-[34px] font-black leading-none text-white">
                  {formatElapsed(finished.elapsedS)}
                </p>
              </div>
            </div>
            <button
              className="gc-pressable mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--gc-blue)] py-3.5 text-[15px] font-black text-black"
              onClick={() => onAddPhoto(finished)}
              type="button"
            >
              <Camera size={18} />
              {t("workout.summary.addPhoto")}
            </button>
            <button
              className="gc-pressable mt-2 w-full py-3 text-center text-[13.5px] font-bold text-white/50"
              onClick={onClose}
              type="button"
            >
              {t("workout.summary.saveWithoutPhoto")}
            </button>
          </>
        ) : (
          <>
            {/* Tipo de exercício */}
            <h2 className="text-[22px] font-black text-white">{t("workout.title")}</h2>
            <div className="gc-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {TYPE_KEYS.map((type) => (
                <button
                  className={[
                    "gc-pressable shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-black",
                    type === activityType
                      ? "bg-[var(--gc-blue)]/15 text-[var(--gc-blue)]"
                      : "bg-white/[0.055] text-white/60",
                  ].join(" ")}
                  key={type}
                  onClick={() => selectType(type)}
                  type="button"
                >
                  {t(`workout.types.${type}`)}
                </button>
              ))}
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

            {/* Encerrar / descartar */}
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

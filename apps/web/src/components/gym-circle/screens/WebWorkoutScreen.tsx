"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  Bike,
  Check,
  ChevronDown,
  Dumbbell,
  Footprints,
  Info,
  MoveRight,
  Play,
  Timer,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmSheet } from "../ConfirmSheet";
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
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const restDoneNotified = useRef(false);

  // Abrir: treino em andamento (refresh/reabriu) retoma direto no live;
  // senão começa no seletor de tipo. setTimeout(0) evita set-state-in-effect.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const stored = readStored();
      setFinishError(null);
      setDiscardConfirmOpen(false);
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
    setDiscardConfirmOpen(false);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const restProgress =
    rest.presetS > 0
      ? Math.max(0, Math.min(100, (rest.remainingS / rest.presetS) * 100))
      : 0;

  return (
    <div
      className="fixed inset-0 z-[95] flex justify-center overflow-y-auto bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={t("workout.inProgress")}
    >
      <div className="flex min-h-full w-full max-w-[480px] flex-col px-5 pb-[calc(var(--gc-safe-bottom)+24px)] pt-[calc(var(--gc-safe-top)+18px)]">
        {stage === "pick" ? (
          <>
            <header className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[25px] font-black leading-tight text-white">
                  {t("workout.pickTitle")}
                </h2>
                <p className="mt-1 max-w-[320px] text-[13px] font-semibold leading-snug text-white/48">
                  {t("workout.pickHint")}
                </p>
              </div>
              <button
                aria-label={t("common.close")}
                className="gc-pressable grid size-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.055] text-white/82"
                onClick={onClose}
                type="button"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </header>
            <div className="mt-6 space-y-2.5 pb-6">
              {TYPE_CARDS.map(({ type, icon: Icon }) => (
                <button
                  className="gc-pressable flex w-full items-center gap-3.5 rounded-[22px] border border-white/[0.08] bg-white/[0.035] p-3.5 text-left"
                  key={type}
                  onClick={() => startWorkout(type)}
                  type="button"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-[16px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
                    <Icon size={22} strokeWidth={2.3} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-black text-white">
                      {t(`workout.types.${type}`)}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] font-bold text-white/42">
                      {t(`workout.typeHints.${type}`)}
                    </span>
                  </span>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)] text-[var(--gc-brand-ink)]">
                    <Play className="ml-0.5" fill="currentColor" size={16} />
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <header className="flex items-center gap-2">
              <span className="inline-flex min-w-0 items-center rounded-full border border-white/[0.08] bg-white/[0.055] px-3.5 py-2 text-[13px] font-black text-white">
                <span className="truncate">{t(`workout.types.${activityType}`)}</span>
              </span>
              <button
                aria-label={t("workout.minimize")}
                className="gc-pressable ml-auto grid size-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.055] text-white/82"
                onClick={onClose}
                type="button"
              >
                <ChevronDown size={19} strokeWidth={2.4} />
              </button>
            </header>

            <main className="flex flex-1 flex-col">
              <section className="pt-9 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">
                  {t("workout.elapsed")}
                </p>
                <p
                  aria-label={`${t("workout.elapsed")}: ${formatElapsed(elapsedS)}`}
                  className="mt-2 text-[72px] font-black leading-none tracking-[-0.06em] text-[var(--gc-brand)] tabular-nums"
                >
                  {formatElapsed(elapsedS)}
                </p>
              </section>

              <div className="mt-7 flex items-center justify-center gap-2 text-[11.5px] font-bold text-white/42">
                <Info className="shrink-0 text-[var(--gc-brand)]" size={15} />
                <span>{t("workout.precisionNotice")}</span>
              </div>

              <section className="mt-5 rounded-[28px] border border-white/[0.085] bg-[#0b0d0e] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-[14px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
                    <Timer size={19} strokeWidth={2.4} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-black text-white">
                      {t("workout.rest.title")}
                    </p>
                    <p className="text-[11.5px] font-bold text-white/38">
                      {t("workout.rest.subtitle")}
                    </p>
                  </div>
                  <p
                    className={[
                      "text-[34px] font-black leading-none tracking-tight tabular-nums",
                      rest.status === "done"
                        ? "text-[var(--gc-brand)]"
                        : rest.status === "running"
                          ? "text-white"
                          : "text-white/82",
                    ].join(" ")}
                  >
                    {rest.status === "done"
                      ? t("workout.rest.done")
                      : formatElapsed(rest.remainingS)}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 rounded-full bg-black/52 p-1">
                  {REST_PRESETS_S.map((preset) => (
                    <button
                      aria-pressed={rest.presetS === preset}
                      className={[
                        "gc-pressable h-10 rounded-full text-[12.5px] font-black disabled:opacity-45",
                        rest.presetS === preset
                          ? "bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]"
                          : "text-white/46",
                      ].join(" ")}
                      disabled={rest.status === "running"}
                      key={preset}
                      onClick={() => dispatchRest({ type: "setPreset", presetS: preset })}
                      type="button"
                    >
                      {formatElapsed(preset)}
                    </button>
                  ))}
                </div>

                {rest.status === "running" ? (
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-[var(--gc-brand)] transition-[width] duration-500"
                      style={{ width: `${restProgress}%` }}
                    />
                  </div>
                ) : null}

                {rest.status === "running" ? (
                  <button
                    className="gc-pressable mt-4 flex h-12 w-full items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.055] text-[13px] font-black text-white"
                    onClick={() => dispatchRest({ type: "reset" })}
                    type="button"
                  >
                    {t("workout.rest.cancel")}
                  </button>
                ) : (
                  <button
                    className="gc-pressable mt-4 flex h-12 w-full items-center justify-center rounded-full bg-[var(--gc-brand)] text-[13px] font-black text-[var(--gc-brand-ink)] shadow-[0_0_22px_rgba(92,232,255,0.2)]"
                    onClick={() => dispatchRest({ type: "start" })}
                    type="button"
                  >
                    {rest.status === "done"
                      ? t("workout.rest.restart")
                      : t("workout.rest.startFor", {
                          duration: formatElapsed(rest.presetS),
                        })}
                  </button>
                )}
              </section>

              {finishError ? (
                <p className="mt-4 text-center text-[12.5px] font-bold text-[var(--gc-pink)]">
                  {finishError}
                </p>
              ) : null}

              <footer className="mt-auto pt-8">
                <button
                  className="gc-pressable flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[15px] font-black text-[var(--gc-brand-ink)] shadow-[0_0_28px_rgba(92,232,255,0.22)] disabled:opacity-60"
                  disabled={finishing}
                  onClick={() => void handleFinish()}
                  type="button"
                >
                  <Check size={18} strokeWidth={2.8} />
                  {finishing ? t("workout.finishing") : t("workout.finish")}
                </button>
                <button
                  className="gc-pressable mt-2 w-full py-3 text-center text-[12.5px] font-black text-[var(--gc-pink)]/62"
                  onClick={() => setDiscardConfirmOpen(true)}
                  type="button"
                >
                  {t("workout.discard")}
                </button>
              </footer>
            </main>

            <ConfirmSheet
              cancelLabel={t("common.cancel")}
              confirmLabel={t("workout.discardConfirm.confirm")}
              description={t("workout.discardConfirm.description")}
              onClose={() => setDiscardConfirmOpen(false)}
              onConfirm={handleDiscard}
              open={discardConfirmOpen}
              title={t("workout.discardConfirm.title")}
              tone="destructive"
            />
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import {
  getRunningSessionProgress,
  runningSessionPaceFeedback,
  type RunningSessionState,
} from "@gym-circle/core/domain";
import {
  ArrowLeft,
  ArrowRight,
  CircleGauge,
  Clock3,
  Footprints,
  HeartPulse,
  Route,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatElapsed, formatPace } from "./workoutElapsed";
import {
  formatRunningDistance,
  formatRunningDuration,
  formatRunningPace,
} from "./RunningPlanPreview";

function motivationLabel(
  state: RunningSessionState,
  translate: (key: string) => string,
) {
  const event = [...state.lastEvents]
    .reverse()
    .find((candidate) => candidate.messageKey);
  return event?.messageKey
    ? translate(`workout.running.guided.motivation.${event.messageKey}`)
    : null;
}

function feedbackTone(
  feedback: ReturnType<typeof runningSessionPaceFeedback>,
) {
  if (feedback === "on_target") {
    return "border-[#30d158]/22 bg-[#30d158]/10 text-[#72f092]";
  }
  if (feedback === "too_fast") {
    return "border-[#ff9f0a]/22 bg-[#ff9f0a]/10 text-[#ffc15c]";
  }
  if (feedback === "too_slow") {
    return "border-[#ff375f]/22 bg-[#ff375f]/10 text-[#ff718b]";
  }
  return "border-white/[0.08] bg-white/[0.045] text-white/50";
}

export function GuidedRunningSession({
  currentPaceSPerKm,
  distanceM,
  elapsedS,
  onCompleteStep,
  onPreviousStep,
  onSkipStep,
  state,
}: {
  currentPaceSPerKm: number | null;
  distanceM: number;
  elapsedS: number;
  onCompleteStep: () => void;
  onPreviousStep: () => void;
  onSkipStep: () => void;
  state: RunningSessionState;
}) {
  const { t } = useTranslation();
  const active = state.segments[state.activeSegmentIndex] ?? null;
  const next = state.segments[state.activeSegmentIndex + 1] ?? null;
  const progress = getRunningSessionProgress(state, {
    atMs: state.latestObservation?.atMs ?? state.startedAtMs ?? 0,
    elapsedS,
    distanceM,
    currentPaceSPerKm,
  });
  const paceFeedback = runningSessionPaceFeedback(
    active,
    currentPaceSPerKm,
  );
  const remainingPrimary =
    progress.remainingDistanceM != null
      ? formatRunningDistance(progress.remainingDistanceM)
      : progress.remainingDurationS != null
        ? formatRunningDuration(progress.remainingDurationS)
        : formatElapsed(progress.segmentElapsedS);
  const targetPace =
    active?.paceMinSPerKm && active.paceMaxSPerKm
      ? `${formatRunningPace(active.paceMinSPerKm)?.replace("/km", "")}–${formatRunningPace(active.paceMaxSPerKm)}`
      : formatRunningPace(
          active?.paceMinSPerKm ?? active?.paceMaxSPerKm ?? null,
        );
  const message = motivationLabel(state, t);
  const statusLabel =
    state.status === "paused"
      ? t("workout.running.guided.paused")
      : state.status === "transition"
        ? t("workout.running.guided.transition")
        : active?.kind === "recovery"
          ? t("workout.running.guided.recovery")
          : t("workout.running.guided.active");

  if (!active) return null;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-[var(--gc-brand)]">
            {state.plan.name}
          </p>
          <p className="mt-1 text-[12px] font-black text-white/52">
            {t("workout.running.guided.stepProgress", {
              current: state.activeSegmentIndex + 1,
              total: state.segments.length,
            })}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--gc-brand)]/18 bg-[var(--gc-brand)]/[0.08] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[var(--gc-brand)]">
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-[28px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(92,232,255,0.12),rgba(10,13,15,0.98)_48%)] p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-[17px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
            {active.kind === "recovery" ? (
              <Clock3 size={22} strokeWidth={2.5} />
            ) : (
              <Footprints size={22} strokeWidth={2.5} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[21px] font-black leading-tight text-white">
              {active.kind === "recovery"
                ? t("workout.running.guided.recovery")
                : active.title}
            </p>
            {active.repetitionCount > 1 ? (
              <p className="mt-1 text-[11px] font-black text-white/42">
                {t("workout.running.guided.repetition", {
                  current: active.repetitionIndex,
                  total: active.repetitionCount,
                })}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-7 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
            {active.targetDistanceM != null ||
            active.targetDurationS != null
              ? t("workout.running.guided.remaining")
              : t("workout.running.guided.elapsedInStep")}
          </p>
          <p className="mt-1 text-[58px] font-black leading-none tracking-[-0.06em] text-white tabular-nums">
            {remainingPrimary}
          </p>
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full bg-[var(--gc-brand)] transition-[width] duration-500"
            style={{ width: `${Math.max(2, progress.segment * 100)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[9px] font-black uppercase tracking-[0.12em] text-white/28">
          <span>{Math.round(progress.segment * 100)}%</span>
          <span>{Math.round(progress.overall * 100)}% total</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.035] p-4">
          <CircleGauge className="text-[var(--gc-brand)]" size={18} />
          <p className="mt-4 text-[9px] font-black uppercase tracking-[0.13em] text-white/34">
            {t("workout.running.guided.currentPace")}
          </p>
          <p className="mt-1 text-[20px] font-black text-white tabular-nums">
            {currentPaceSPerKm ? formatPace(currentPaceSPerKm) : "—"}
          </p>
        </div>
        <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.035] p-4">
          <Route className="text-[#ffd60a]" size={18} />
          <p className="mt-4 text-[9px] font-black uppercase tracking-[0.13em] text-white/34">
            {t("workout.running.guided.targetPace")}
          </p>
          <p className="mt-1 text-[20px] font-black text-white tabular-nums">
            {targetPace ?? "—"}
          </p>
        </div>
      </div>

      <div
        className={`mt-2.5 flex min-h-12 items-center justify-between gap-3 rounded-[18px] border px-4 ${feedbackTone(
          paceFeedback,
        )}`}
      >
        <span className="text-[11px] font-black">
          {t(`workout.running.guided.paceFeedback.${paceFeedback}`)}
        </span>
        {active.heartRateZone ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-black">
            <HeartPulse size={13} />
            Z{active.heartRateZone}
          </span>
        ) : null}
      </div>

      {message ? (
        <div className="mt-3 flex items-start gap-3 rounded-[20px] border border-[var(--gc-brand)]/15 bg-[var(--gc-brand)]/[0.055] p-4">
          <Sparkles
            className="mt-0.5 shrink-0 text-[var(--gc-brand)]"
            size={17}
          />
          <p className="text-[12px] font-bold leading-relaxed text-white/72">
            {message}
          </p>
        </div>
      ) : null}

      {next ? (
        <div className="mt-3 flex items-center gap-3 rounded-[18px] bg-white/[0.035] px-4 py-3">
          <span className="text-[9px] font-black uppercase tracking-[0.13em] text-white/30">
            {t("workout.running.guided.next")}
          </span>
          <span className="min-w-0 flex-1 truncate text-right text-[11px] font-black text-white/65">
            {next.kind === "recovery"
              ? t("workout.running.guided.recovery")
              : next.title}
          </span>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <button
          className="gc-pressable flex h-12 items-center justify-center gap-2 rounded-full bg-white/[0.055] text-[11px] font-black text-white/58 disabled:opacity-25"
          disabled={state.activeSegmentIndex === 0}
          onClick={onPreviousStep}
          type="button"
        >
          <ArrowLeft size={15} />
          {t("workout.running.guided.previous")}
        </button>
        <button
          className="gc-pressable flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[11px] font-black text-[var(--gc-brand-ink)]"
          onClick={onCompleteStep}
          type="button"
        >
          {t("workout.running.guided.nextStep")}
          <ArrowRight size={15} />
        </button>
      </div>
      <button
        className="gc-pressable mt-2 h-9 w-full text-[10px] font-black text-white/35"
        onClick={onSkipStep}
        type="button"
      >
        {t("workout.running.guided.skipStep")}
      </button>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[17px] font-black text-white">
            {formatRunningDistance(distanceM)}
          </p>
          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/28">
            {t("workout.running.distance")}
          </p>
        </div>
        <div>
          <p className="text-[17px] font-black text-white">
            {formatElapsed(elapsedS)}
          </p>
          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/28">
            {t("workout.running.duration")}
          </p>
        </div>
        <div>
          <p className="text-[17px] font-black text-white">
            {progress.estimatedRemainingDistanceM != null
              ? formatRunningDistance(progress.estimatedRemainingDistanceM)
              : progress.estimatedRemainingS == null
                ? "—"
                : formatElapsed(progress.estimatedRemainingS)}
          </p>
          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/28">
            {progress.estimatedRemainingDistanceM != null
              ? t("workout.running.guided.estimatedDistanceRemaining")
              : t("workout.running.guided.estimatedRemaining")}
          </p>
        </div>
      </div>
    </section>
  );
}

"use client";

import {
  estimateRunningPlanTotals,
  type RunningWorkoutPlan,
  type RunningWorkoutPlanDraft,
  type RunningWorkoutPlanStepDraft,
} from "@gym-circle/core/domain";
import { ArrowLeft, Clock3, Footprints, Route } from "lucide-react";
import { useTranslation } from "react-i18next";

export function formatRunningDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}min`;
  return remaining > 0 ? `${minutes}:${String(remaining).padStart(2, "0")}` : `${minutes} min`;
}

export function formatRunningDistance(meters: number | null) {
  if (meters == null) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  })} km`;
}

export function formatRunningPace(seconds: number | null | undefined) {
  if (!seconds) return null;
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}/km`;
}

export function formatRunningRange(
  minimum: number | null | undefined,
  maximum: number | null | undefined,
  formatter: (value: number | null) => string,
) {
  if (minimum == null || maximum == null) return null;
  if (minimum === maximum) return formatter(minimum);
  return `${formatter(minimum)}–${formatter(maximum)}`;
}

export function describeRunningStep(step: RunningWorkoutPlanStepDraft) {
  const distanceRange = formatRunningRange(
    step.distanceMinM,
    step.distanceMaxM,
    formatRunningDistance,
  );
  const durationRange = formatRunningRange(
    step.durationMinS,
    step.durationMaxS,
    formatRunningDuration,
  );
  const target =
    distanceRange ??
    durationRange ??
    (step.distanceM
      ? formatRunningDistance(step.distanceM)
      : step.durationS
        ? formatRunningDuration(step.durationS)
        : "livre");
  const repetitions =
    step.repetitionsMin != null && step.repetitionsMax != null
      ? step.repetitionsMin === step.repetitionsMax
        ? String(step.repetitionsMin)
        : `${step.repetitionsMin}–${step.repetitionsMax}`
      : String(step.repetitions);
  const paceMin = formatRunningPace(step.paceMinSPerKm);
  const paceMax = formatRunningPace(step.paceMaxSPerKm);
  const pace =
    paceMin && paceMax
      ? `${paceMin.replace("/km", "")}–${paceMax}`
      : paceMin ?? paceMax;
  const main = `${
    step.repetitions > 1 ||
    step.repetitionsMin != null ||
    step.repetitionsMax != null
      ? `${repetitions} × `
      : ""
  }${target}`;
  const details = [
    pace ? `pace ${pace}` : null,
    step.heartRateZone ? `Z${step.heartRateZone}` : null,
    step.targetEffort ? `RPE ${step.targetEffort}` : null,
  ].filter(Boolean);
  return details.length > 0 ? `${main} · ${details.join(" · ")}` : main;
}

export function RunningPlanPreview({
  onBack,
  plan,
}: {
  onBack: () => void;
  plan: RunningWorkoutPlan | RunningWorkoutPlanDraft;
}) {
  const { t } = useTranslation();
  const estimate = estimateRunningPlanTotals(plan);
  const durationLabel =
    formatRunningRange(
      estimate.durationMinS,
      estimate.durationMaxS,
      formatRunningDuration,
    ) ?? formatRunningDuration(estimate.durationS);
  const distanceLabel =
    formatRunningRange(
      estimate.distanceMinM,
      estimate.distanceMaxM,
      formatRunningDistance,
    ) ?? formatRunningDistance(estimate.distanceM);
  return (
    <div>
      <button
        className="gc-pressable inline-flex items-center gap-2 text-[12px] font-black text-[var(--gc-brand)]"
        onClick={onBack}
        type="button"
      >
        <ArrowLeft size={15} />
        {t("workout.running.back")}
      </button>
      <div className="mt-5 rounded-[26px] border border-[var(--gc-brand)]/18 bg-[linear-gradient(145deg,rgba(92,232,255,0.13),rgba(10,14,16,0.98)_55%)] p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-[16px] bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
            <Footprints size={22} strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--gc-brand)]">
              {t("workout.running.structured")}
            </p>
            <h3 className="mt-1 text-[22px] font-black leading-tight text-white">
              {plan.name}
            </h3>
            {plan.description ? (
              <p className="mt-2 text-[12px] font-semibold leading-relaxed text-white/50">
                {plan.description}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-[18px] bg-black/25 p-3">
            <Clock3 className="text-[#ffd60a]" size={16} />
            <p className="mt-2 text-[17px] font-black text-white">
              {estimate.derivedDuration ? "≈ " : ""}
              {durationLabel}
            </p>
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/34">
              {t("workout.running.duration")}
            </p>
          </div>
          <div className="rounded-[18px] bg-black/25 p-3">
            <Route className="text-[var(--gc-brand)]" size={16} />
            <p className="mt-2 text-[17px] font-black text-white">
              {estimate.derivedDistance ? "≈ " : ""}
              {distanceLabel}
            </p>
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/34">
              {t("workout.running.distance")}
            </p>
          </div>
        </div>
      </div>

      <ol className="mt-5 space-y-2">
        {plan.steps.map((step, index) => (
          <li
            className="rounded-[20px] border border-white/[0.07] bg-[#0c0f11] p-4"
            key={step.id ?? `${step.position}-${index}`}
          >
            <div className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)]/12 text-[11px] font-black text-[var(--gc-brand)]">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-black text-white">{step.title}</p>
                <p className="mt-1 text-[11.5px] font-bold text-white/48">
                  {describeRunningStep(step)}
                </p>
                {step.recoveryType !== "none" ? (
                  <p className="mt-1 text-[10.5px] font-bold text-white/34">
                    {t("workout.running.recovery")}:{" "}
                    {step.recoveryDistanceM
                      ? formatRunningDistance(step.recoveryDistanceM)
                      : formatRunningDuration(step.recoveryDurationS ?? null)}
                  </p>
                ) : null}
                {step.instructions ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-white/42">
                    {step.instructions}
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-5 rounded-[18px] border border-dashed border-white/[0.1] p-4 text-center">
        <p className="text-[11px] font-bold text-white/42">
          {t("workout.running.guidedComingSoon")}
        </p>
      </div>
    </div>
  );
}

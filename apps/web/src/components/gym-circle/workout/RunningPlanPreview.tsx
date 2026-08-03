"use client";

import {
  buildRunningTimeline,
  estimateRunningPlanTotals,
  type RunningTimelineColorToken,
  type RunningWorkoutPlan,
  type RunningWorkoutPlanDraft,
  type RunningWorkoutPlanStepDraft,
} from "@gym-circle/core/domain";
import { ArrowLeft, Clock3, Footprints, Play, Route } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Timeline endurecida (Sprint D1): cor por fase da corrida. Aquecimento verde,
 * intervalado laranja, recovery azul (brand), desaquecimento rosa, resto neutro.
 * O token vem de buildRunningTimeline (lógica pura testada); aqui só mapeamos
 * token → cor CSS.
 */
const TIMELINE_TOKEN_COLOR: Record<RunningTimelineColorToken, string> = {
  start: "#34d399",
  work: "#f59e0b",
  recovery: "var(--gc-brand)",
  end: "var(--gc-pink)",
  neutral: "rgba(255,255,255,0.42)",
};

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

export function formatRunningPaceInput(
  seconds: number | null | undefined,
) {
  return formatRunningPace(seconds)?.replace("/km", "") ?? "";
}

export function parseRunningPaceInput(value: string) {
  const normalized = value.trim().replace(/[’´`]/g, "'");
  if (!normalized) return null;
  const clock = normalized.match(/^(\d{1,2})\s*[:'.,]\s*(\d{1,2})/);
  if (clock) {
    const minutes = Number.parseInt(clock[1], 10);
    const seconds = Number.parseInt(clock[2], 10);
    return seconds < 60 ? minutes * 60 + seconds : null;
  }
  const minutes = Number.parseInt(normalized, 10);
  return /^\d{1,2}$/.test(normalized) && minutes > 0
    ? minutes * 60
    : null;
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
  onStart,
  plan,
}: {
  onBack: () => void;
  onStart?: () => void;
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
  const timeline = buildRunningTimeline(plan.steps);
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

      <ol className="mt-5">
        {plan.steps.map((step, index) => {
          const node = timeline[index];
          if (!node) return null;
          const color = TIMELINE_TOKEN_COLOR[node.colorToken];
          const isLast = index === plan.steps.length - 1;
          return (
            <li
              className="flex gap-3"
              key={step.id ?? `${step.position}-${index}`}
            >
              <div className="flex w-4 shrink-0 flex-col items-center pt-4">
                <span
                  aria-hidden="true"
                  className="size-3.5 shrink-0 rounded-full ring-4 ring-black"
                  style={{ backgroundColor: color }}
                />
                {!isLast ? (
                  <span aria-hidden="true" className="mt-1 w-px flex-1 bg-white/10" />
                ) : null}
              </div>
              <div
                className="mb-2 min-w-0 flex-1 rounded-[20px] border border-white/[0.07] bg-[#0c0f11] p-4"
                style={{ borderLeftColor: color, borderLeftWidth: "2px" }}
              >
                <div className="flex items-center gap-2">
                  <p className="min-w-0 truncate text-[14px] font-black text-white">
                    {step.title}
                  </p>
                  {node.repetitions > 1 ? (
                    <span
                      className="shrink-0 rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-black tabular-nums"
                      style={{ color }}
                    >
                      {node.repetitions}×
                    </span>
                  ) : null}
                </div>
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
            </li>
          );
        })}
      </ol>
      {onStart ? (
        <button
          className="gc-pressable mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[13px] font-black text-[var(--gc-brand-ink)] shadow-[0_0_28px_rgba(92,232,255,0.15)]"
          onClick={onStart}
          type="button"
        >
          <Play fill="currentColor" size={18} />
          {t("workout.running.guided.start")}
        </button>
      ) : null}
    </div>
  );
}

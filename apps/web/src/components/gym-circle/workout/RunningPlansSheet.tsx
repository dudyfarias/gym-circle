"use client";

import {
  RUNNING_PLAN_GOALS,
  RUNNING_PLAN_LEVELS,
  RUNNING_RECOVERY_TYPES,
  RUNNING_STEP_PRESETS,
  RUNNING_STEP_TYPES,
  RUNNING_TARGET_BASES,
  estimateRunningPlanTotals,
  validateRunningPlan,
  type RunningWorkoutPlan,
  type RunningWorkoutPlanDraft,
  type RunningWorkoutPlanStepDraft,
} from "@gym-circle/core/domain";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  Edit3,
  Footprints,
  Play,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RunningPlanPreview,
  formatRunningDistance,
  formatRunningDuration,
  formatRunningRange,
} from "./RunningPlanPreview";
import { useRunningPlans } from "./useRunningPlans";

type View =
  | { type: "list" }
  | { type: "preview"; plan: RunningWorkoutPlan }
  | { type: "edit"; plan: RunningWorkoutPlan | null };

const emptyDraft = (): RunningWorkoutPlanDraft => ({
  name: "",
  description: null,
  level: "beginner",
  goal: "general",
  source: "manual",
  sourceMetadata: {},
  steps: [{ ...RUNNING_STEP_PRESETS[0], position: 0 }],
});

const planDraft = (plan: RunningWorkoutPlan): RunningWorkoutPlanDraft => ({
  name: plan.name,
  description: plan.description,
  level: plan.level,
  goal: plan.goal,
  source: plan.source,
  sourceMetadata: plan.sourceMetadata,
  steps: plan.steps.map((step) => ({ ...step })),
});

function numberValue(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function Editor({
  initial,
  onBack,
  onSave,
  saveError,
  saving,
}: {
  initial: RunningWorkoutPlanDraft;
  onBack: () => void;
  onSave: (draft: RunningWorkoutPlanDraft) => Promise<void>;
  saveError: boolean;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initial);
  const issues = useMemo(() => validateRunningPlan(draft), [draft]);
  const estimate = useMemo(
    () => estimateRunningPlanTotals(draft),
    [draft],
  );
  const durationEstimateLabel =
    formatRunningRange(
      estimate.durationMinS,
      estimate.durationMaxS,
      formatRunningDuration,
    ) ?? formatRunningDuration(estimate.durationS);
  const distanceEstimateLabel =
    formatRunningRange(
      estimate.distanceMinM,
      estimate.distanceMaxM,
      formatRunningDistance,
    ) ?? formatRunningDistance(estimate.distanceM);

  const updateStep = (
    index: number,
    patch: Partial<RunningWorkoutPlanStepDraft>,
  ) => {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...patch } : step,
      ),
    }));
  };
  const replaceSteps = (steps: RunningWorkoutPlanStepDraft[]) => {
    setDraft((current) => ({
      ...current,
      steps: steps.map((step, index) => ({ ...step, position: index })),
    }));
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button
          className="gc-pressable grid size-10 place-items-center rounded-full bg-white/[0.06] text-white"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft size={18} />
        </button>
        <h3 className="text-[18px] font-black text-white">
          {t("workout.running.editorTitle")}
        </h3>
        <button
          className="gc-pressable grid size-10 place-items-center rounded-full bg-[var(--gc-brand)] text-[var(--gc-brand-ink)] disabled:opacity-35"
          disabled={issues.length > 0 || saving}
          onClick={() => void onSave(draft)}
          type="button"
        >
          <Save size={17} />
        </button>
      </div>

      <div className="mt-5 space-y-3">
        <input
          className="h-12 w-full rounded-[16px] border border-white/[0.08] bg-white/[0.055] px-4 text-[14px] font-bold text-white outline-none"
          maxLength={120}
          onChange={(event) =>
            setDraft((current) => ({ ...current, name: event.target.value }))
          }
          placeholder={t("workout.running.planName")}
          value={draft.name}
        />
        <textarea
          className="min-h-20 w-full resize-none rounded-[16px] border border-white/[0.08] bg-white/[0.055] px-4 py-3 text-[13px] font-semibold text-white outline-none"
          maxLength={500}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          placeholder={t("workout.running.description")}
          value={draft.description ?? ""}
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            className="h-11 rounded-[14px] border border-white/[0.08] bg-[#171a1c] px-3 text-[12px] font-bold text-white"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                level: event.target.value as typeof current.level,
              }))
            }
            value={draft.level}
          >
            {RUNNING_PLAN_LEVELS.map((level) => (
              <option key={level} value={level}>
                {t(`workout.running.levels.${level}`)}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-[14px] border border-white/[0.08] bg-[#171a1c] px-3 text-[12px] font-bold text-white"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                goal: event.target.value as typeof current.goal,
              }))
            }
            value={draft.goal}
          >
            {RUNNING_PLAN_GOALS.map((goal) => (
              <option key={goal} value={goal}>
                {t(`workout.running.goals.${goal}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-[16px] bg-white/[0.045] p-3">
          <p className="text-[15px] font-black text-white">
            {estimate.derivedDuration ? "≈ " : ""}
            {durationEstimateLabel}
          </p>
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-white/34">
            {t("workout.running.duration")}
          </p>
        </div>
        <div className="rounded-[16px] bg-white/[0.045] p-3">
          <p className="text-[15px] font-black text-white">
            {estimate.derivedDistance ? "≈ " : ""}
            {distanceEstimateLabel}
          </p>
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-white/34">
            {t("workout.running.distance")}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/44">
          {t("workout.running.presets")}
        </p>
        <div className="gc-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-2">
          {RUNNING_STEP_PRESETS.map((preset) => (
            <button
              className="gc-pressable shrink-0 rounded-full bg-[var(--gc-brand)]/10 px-3 py-2 text-[10.5px] font-black text-[var(--gc-brand)]"
              key={`${preset.stepType}-${preset.title}`}
              onClick={() =>
                replaceSteps([
                  ...draft.steps,
                  { ...preset, position: draft.steps.length },
                ])
              }
              type="button"
            >
              + {preset.title}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {draft.steps.map((step, index) => (
          <article
            className="rounded-[20px] border border-white/[0.075] bg-[#0d1012] p-4"
            key={step.id ?? `${index}-${step.stepType}`}
          >
            <div className="flex items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)]/12 text-[10px] font-black text-[var(--gc-brand)]">
                {index + 1}
              </span>
              <input
                className="min-w-0 flex-1 bg-transparent text-[13px] font-black text-white outline-none"
                maxLength={120}
                onChange={(event) =>
                  updateStep(index, { title: event.target.value })
                }
                value={step.title}
              />
              <button
                disabled={index === 0}
                onClick={() => {
                  const steps = [...draft.steps];
                  [steps[index - 1], steps[index]] = [
                    steps[index],
                    steps[index - 1],
                  ];
                  replaceSteps(steps);
                }}
                type="button"
              >
                <ArrowUp size={15} />
              </button>
              <button
                disabled={index === draft.steps.length - 1}
                onClick={() => {
                  const steps = [...draft.steps];
                  [steps[index], steps[index + 1]] = [
                    steps[index + 1],
                    steps[index],
                  ];
                  replaceSteps(steps);
                }}
                type="button"
              >
                <ArrowDown size={15} />
              </button>
              <button
                onClick={() =>
                  replaceSteps([
                    ...draft.steps.slice(0, index + 1),
                    { ...step, id: undefined },
                    ...draft.steps.slice(index + 1),
                  ])
                }
                type="button"
              >
                <Copy size={14} />
              </button>
              <button
                className="text-[#ff5364]"
                disabled={draft.steps.length === 1}
                onClick={() =>
                  replaceSteps(
                    draft.steps.filter((_, stepIndex) => stepIndex !== index),
                  )
                }
                type="button"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <select
                className="h-10 rounded-[12px] bg-white/[0.055] px-2 text-[11px] font-bold text-white"
                onChange={(event) =>
                  updateStep(index, {
                    stepType: event.target
                      .value as RunningWorkoutPlanStepDraft["stepType"],
                  })
                }
                value={step.stepType}
              >
                {RUNNING_STEP_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`workout.running.steps.${type}`)}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-[12px] bg-white/[0.055] px-2 text-[11px] font-bold text-white"
                onChange={(event) =>
                  updateStep(index, {
                    targetBasis: event.target
                      .value as RunningWorkoutPlanStepDraft["targetBasis"],
                  })
                }
                value={step.targetBasis}
              >
                {RUNNING_TARGET_BASES.map((basis) => (
                  <option key={basis} value={basis}>
                    {t(`workout.running.targets.${basis}`)}
                  </option>
                ))}
              </select>
              <label className="text-[9px] font-black uppercase tracking-[0.08em] text-white/38">
                {t("workout.running.repetitions")}
                <input
                  className="mt-1 h-10 w-full rounded-[12px] bg-white/[0.055] px-3 text-[12px] text-white"
                  min={1}
                  onChange={(event) =>
                    updateStep(index, {
                      repetitions: Number(event.target.value),
                    })
                  }
                  type="number"
                  value={step.repetitions}
                />
              </label>
              <label className="text-[9px] font-black uppercase tracking-[0.08em] text-white/38">
                {t("workout.running.repetitionsMin")}
                <input
                  className="mt-1 h-10 w-full rounded-[12px] bg-white/[0.055] px-3 text-[12px] text-white"
                  min={1}
                  onChange={(event) => {
                    const value = numberValue(event.target.value);
                    updateStep(index, {
                      repetitions: value ?? step.repetitions,
                      repetitionsMin: value,
                    });
                  }}
                  type="number"
                  value={step.repetitionsMin ?? ""}
                />
              </label>
              <label className="text-[9px] font-black uppercase tracking-[0.08em] text-white/38">
                {t("workout.running.repetitionsMax")}
                <input
                  className="mt-1 h-10 w-full rounded-[12px] bg-white/[0.055] px-3 text-[12px] text-white"
                  min={1}
                  onChange={(event) =>
                    updateStep(index, {
                      repetitionsMax: numberValue(event.target.value),
                    })
                  }
                  type="number"
                  value={step.repetitionsMax ?? ""}
                />
              </label>
              <label className="text-[9px] font-black uppercase tracking-[0.08em] text-white/38">
                {t("workout.running.distanceMeters")}
                <input
                  className="mt-1 h-10 w-full rounded-[12px] bg-white/[0.055] px-3 text-[12px] text-white"
                  min={1}
                  onChange={(event) =>
                    updateStep(index, {
                      distanceM: numberValue(event.target.value),
                      distanceMinM: null,
                      distanceMaxM: null,
                    })
                  }
                  type="number"
                  value={step.distanceM ?? ""}
                />
              </label>
              <label className="text-[9px] font-black uppercase tracking-[0.08em] text-white/38">
                {t("workout.running.distanceMinMeters")}
                <input
                  className="mt-1 h-10 w-full rounded-[12px] bg-white/[0.055] px-3 text-[12px] text-white"
                  min={1}
                  onChange={(event) =>
                    updateStep(index, {
                      distanceM: null,
                      distanceMinM: numberValue(event.target.value),
                    })
                  }
                  type="number"
                  value={step.distanceMinM ?? ""}
                />
              </label>
              <label className="text-[9px] font-black uppercase tracking-[0.08em] text-white/38">
                {t("workout.running.distanceMaxMeters")}
                <input
                  className="mt-1 h-10 w-full rounded-[12px] bg-white/[0.055] px-3 text-[12px] text-white"
                  min={1}
                  onChange={(event) =>
                    updateStep(index, {
                      distanceM: null,
                      distanceMaxM: numberValue(event.target.value),
                    })
                  }
                  type="number"
                  value={step.distanceMaxM ?? ""}
                />
              </label>
              <label className="text-[9px] font-black uppercase tracking-[0.08em] text-white/38">
                {t("workout.running.durationSeconds")}
                <input
                  className="mt-1 h-10 w-full rounded-[12px] bg-white/[0.055] px-3 text-[12px] text-white"
                  min={1}
                  onChange={(event) =>
                    updateStep(index, {
                      durationS: numberValue(event.target.value),
                      durationMinS: null,
                      durationMaxS: null,
                    })
                  }
                  type="number"
                  value={step.durationS ?? ""}
                />
              </label>
              <label className="text-[9px] font-black uppercase tracking-[0.08em] text-white/38">
                {t("workout.running.durationMinSeconds")}
                <input
                  className="mt-1 h-10 w-full rounded-[12px] bg-white/[0.055] px-3 text-[12px] text-white"
                  min={1}
                  onChange={(event) =>
                    updateStep(index, {
                      durationS: null,
                      durationMinS: numberValue(event.target.value),
                    })
                  }
                  type="number"
                  value={step.durationMinS ?? ""}
                />
              </label>
              <label className="text-[9px] font-black uppercase tracking-[0.08em] text-white/38">
                {t("workout.running.durationMaxSeconds")}
                <input
                  className="mt-1 h-10 w-full rounded-[12px] bg-white/[0.055] px-3 text-[12px] text-white"
                  min={1}
                  onChange={(event) =>
                    updateStep(index, {
                      durationS: null,
                      durationMaxS: numberValue(event.target.value),
                    })
                  }
                  type="number"
                  value={step.durationMaxS ?? ""}
                />
              </label>
              <label className="text-[9px] font-black uppercase tracking-[0.08em] text-white/38">
                {t("workout.running.zone")}
                <input
                  className="mt-1 h-10 w-full rounded-[12px] bg-white/[0.055] px-3 text-[12px] text-white"
                  max={5}
                  min={1}
                  onChange={(event) =>
                    updateStep(index, {
                      heartRateZone: numberValue(event.target.value),
                    })
                  }
                  type="number"
                  value={step.heartRateZone ?? ""}
                />
              </label>
              <label className="text-[9px] font-black uppercase tracking-[0.08em] text-white/38">
                {t("workout.running.paceMin")}
                <input
                  className="mt-1 h-10 w-full rounded-[12px] bg-white/[0.055] px-3 text-[12px] text-white"
                  min={1}
                  onChange={(event) =>
                    updateStep(index, {
                      paceMinSPerKm: numberValue(event.target.value),
                    })
                  }
                  type="number"
                  value={step.paceMinSPerKm ?? ""}
                />
              </label>
              <label className="text-[9px] font-black uppercase tracking-[0.08em] text-white/38">
                {t("workout.running.paceMax")}
                <input
                  className="mt-1 h-10 w-full rounded-[12px] bg-white/[0.055] px-3 text-[12px] text-white"
                  min={1}
                  onChange={(event) =>
                    updateStep(index, {
                      paceMaxSPerKm: numberValue(event.target.value),
                    })
                  }
                  type="number"
                  value={step.paceMaxSPerKm ?? ""}
                />
              </label>
              <label className="text-[9px] font-black uppercase tracking-[0.08em] text-white/38">
                {t("workout.running.effort")}
                <input
                  className="mt-1 h-10 w-full rounded-[12px] bg-white/[0.055] px-3 text-[12px] text-white"
                  max={10}
                  min={1}
                  onChange={(event) =>
                    updateStep(index, {
                      targetEffort: numberValue(event.target.value),
                    })
                  }
                  type="number"
                  value={step.targetEffort ?? ""}
                />
              </label>
              <label className="text-[9px] font-black uppercase tracking-[0.08em] text-white/38">
                {t("workout.running.recovery")}
                <select
                  className="mt-1 h-10 w-full rounded-[12px] bg-white/[0.055] px-2 text-[11px] font-bold text-white"
                  onChange={(event) =>
                    updateStep(index, {
                      recoveryType: event.target
                        .value as RunningWorkoutPlanStepDraft["recoveryType"],
                      recoveryDistanceM: null,
                      recoveryDurationS: null,
                    })
                  }
                  value={step.recoveryType}
                >
                  {RUNNING_RECOVERY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`workout.running.recoveryTypes.${type}`)}
                    </option>
                  ))}
                </select>
              </label>
              {step.recoveryType !== "none" ? (
                <label className="text-[9px] font-black uppercase tracking-[0.08em] text-white/38">
                  {step.recoveryType === "distance"
                    ? t("workout.running.recoveryMeters")
                    : t("workout.running.recoverySeconds")}
                  <input
                    className="mt-1 h-10 w-full rounded-[12px] bg-white/[0.055] px-3 text-[12px] text-white"
                    min={1}
                    onChange={(event) =>
                      updateStep(
                        index,
                        step.recoveryType === "distance"
                          ? {
                              recoveryDistanceM: numberValue(
                                event.target.value,
                              ),
                            }
                          : {
                              recoveryDurationS: numberValue(
                                event.target.value,
                              ),
                            },
                      )
                    }
                    type="number"
                    value={
                      step.recoveryType === "distance"
                        ? (step.recoveryDistanceM ?? "")
                        : (step.recoveryDurationS ?? "")
                    }
                  />
                </label>
              ) : null}
            </div>
            <textarea
              className="mt-2 min-h-14 w-full resize-none rounded-[12px] bg-white/[0.045] px-3 py-2 text-[11px] text-white outline-none"
              maxLength={500}
              onChange={(event) =>
                updateStep(index, { instructions: event.target.value })
              }
              placeholder={t("workout.running.instructions")}
              value={step.instructions ?? ""}
            />
          </article>
        ))}
      </div>
      {issues.length > 0 ? (
        <p className="mt-4 rounded-[14px] bg-[#ff375f]/10 p-3 text-[11px] font-bold text-[#ff718b]">
          {t("workout.running.validationError")}
        </p>
      ) : null}
      {saveError ? (
        <p className="mt-4 rounded-[14px] bg-[#ff375f]/10 p-3 text-[11px] font-bold text-[#ff718b]">
          {t("workout.running.saveError")}
        </p>
      ) : null}
    </div>
  );
}

export function RunningPlansSheet({
  onClose,
  onStartFree,
  open,
}: {
  onClose: () => void;
  onStartFree: () => void;
  open: boolean;
}) {
  const { t } = useTranslation();
  const controller = useRunningPlans(open);
  const [view, setView] = useState<View>({ type: "list" });
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState(false);

  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setView({ type: "list" });
      setMutationError(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;
  const backToList = () => setView({ type: "list" });

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[115] overflow-y-auto bg-black"
      role="dialog"
    >
      <div className="mx-auto min-h-full w-full max-w-[480px] px-5 pb-[calc(var(--gc-safe-bottom)+28px)] pt-[calc(var(--gc-safe-top)+16px)]">
        {view.type === "preview" ? (
          <RunningPlanPreview onBack={backToList} plan={view.plan} />
        ) : view.type === "edit" ? (
          <Editor
            initial={view.plan ? planDraft(view.plan) : emptyDraft()}
            onBack={() => {
              setMutationError(false);
              backToList();
            }}
            onSave={async (draft) => {
              setSaving(true);
              setMutationError(false);
              try {
                if (view.plan) {
                  await controller.updatePlan(view.plan.id, draft);
                } else {
                  await controller.createPlan(draft);
                }
                backToList();
              } catch {
                setMutationError(true);
              } finally {
                setSaving(false);
              }
            }}
            saveError={mutationError}
            saving={saving}
          />
        ) : (
          <>
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--gc-brand)]">
                  {t("workout.running.libraryEyebrow")}
                </p>
                <h2 className="mt-1 text-[26px] font-black text-white">
                  {t("workout.running.libraryTitle")}
                </h2>
                <p className="mt-1 text-[12px] font-semibold text-white/45">
                  {t("workout.running.libraryHint")}
                </p>
              </div>
              <button
                aria-label={t("common.close")}
                className="gc-pressable grid size-11 shrink-0 place-items-center rounded-full bg-[#17191b] text-white"
                onClick={onClose}
                type="button"
              >
                <X size={18} />
              </button>
            </header>

            <button
              className="gc-pressable mt-6 flex w-full items-center gap-3 rounded-[22px] border border-[var(--gc-brand)]/18 bg-[var(--gc-brand)]/[0.08] p-4 text-left"
              onClick={onStartFree}
              type="button"
            >
              <span className="grid size-12 place-items-center rounded-[16px] bg-[var(--gc-brand)] text-[var(--gc-brand-ink)]">
                <Play fill="currentColor" size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-black text-white">
                  {t("workout.running.freeRun")}
                </span>
                <span className="mt-1 block text-[11px] font-bold text-white/42">
                  {t("workout.running.freeRunHint")}
                </span>
              </span>
            </button>

            <div className="mt-7 flex items-center justify-between">
              <h3 className="text-[16px] font-black text-white">
                {t("workout.running.myPlans")}
              </h3>
              <button
                className="gc-pressable inline-flex items-center gap-1.5 rounded-full bg-[var(--gc-brand)]/10 px-3 py-2 text-[11px] font-black text-[var(--gc-brand)]"
                onClick={() => setView({ type: "edit", plan: null })}
                type="button"
              >
                <Plus size={14} />
                {t("workout.running.create")}
              </button>
            </div>

            {controller.loading ? (
              <div className="mt-4 h-28 animate-pulse rounded-[22px] bg-white/[0.045]" />
            ) : controller.error ? (
              <div className="mt-4 rounded-[22px] border border-[#ff375f]/20 bg-[#ff375f]/[0.06] p-5 text-center">
                <p className="text-[12px] font-bold text-[#ff718b]">
                  {t("workout.running.loadError")}
                </p>
                <button
                  className="mt-3 text-[11px] font-black text-white"
                  onClick={() => void controller.refresh()}
                  type="button"
                >
                  {t("common.retry")}
                </button>
              </div>
            ) : controller.plans.length === 0 ? (
              <div className="mt-4 rounded-[22px] border border-dashed border-white/[0.1] p-7 text-center">
                <Footprints className="mx-auto text-white/25" size={28} />
                <p className="mt-3 text-[13px] font-black text-white/64">
                  {t("workout.running.empty")}
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {controller.plans.map((plan) => (
                  <article
                    className="rounded-[22px] border border-white/[0.075] bg-[#0d1012] p-4"
                    key={plan.id}
                  >
                    <button
                      className="w-full text-left"
                      onClick={() => setView({ type: "preview", plan })}
                      type="button"
                    >
                      <p className="text-[15px] font-black text-white">
                        {plan.name}
                      </p>
                      <p className="mt-1 text-[10.5px] font-bold text-white/40">
                        {formatRunningDistance(plan.estimatedDistanceM)} ·{" "}
                        {formatRunningDuration(plan.estimatedDurationS)} ·{" "}
                        {t("workout.running.blocks", {
                          count: plan.steps.length,
                        })}
                      </p>
                    </button>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <button
                        className="gc-pressable flex h-9 items-center justify-center gap-1 rounded-full bg-white/[0.06] text-[10.5px] font-black text-white/65"
                        onClick={() => setView({ type: "edit", plan })}
                        type="button"
                      >
                        <Edit3 size={13} />
                        {t("common.edit")}
                      </button>
                      <button
                        className="gc-pressable flex h-9 items-center justify-center gap-1 rounded-full bg-white/[0.06] text-[10.5px] font-black text-white/65"
                        onClick={() =>
                          void controller.duplicatePlan(plan.id)
                        }
                        type="button"
                      >
                        <Copy size={13} />
                        {t("workout.running.duplicate")}
                      </button>
                      <button
                        className="gc-pressable flex h-9 items-center justify-center gap-1 rounded-full bg-[#ff375f]/10 text-[10.5px] font-black text-[#ff718b]"
                        onClick={() => {
                          if (
                            window.confirm(
                              t("workout.running.deleteConfirmation"),
                            )
                          ) {
                            void controller.deletePlan(plan.id);
                          }
                        }}
                        type="button"
                      >
                        <Trash2 size={13} />
                        {t("common.delete")}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

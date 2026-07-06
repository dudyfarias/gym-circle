"use client";

import { useState } from "react";
import {
  ClipboardList,
  Download,
  FolderOpen,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WorkoutPlan, WorkoutPlanExercise } from "../social/types";
import { useWorkoutPlans } from "./useWorkoutPlans";

type WorkoutPlansFabProps = {
  /** Iniciar um treino de força com a planilha carregada. */
  onStartPlan: (plan: WorkoutPlan) => void;
  /** Importar treino (Apple Saúde) — só onde há suporte (app iOS). */
  onImport?: () => void;
};

type DraftExercise = { name: string; sets: string; reps: string };

const EMPTY_EXERCISE: DraftExercise = { name: "", sets: "", reps: "" };

function toDraft(exercises: WorkoutPlanExercise[]): DraftExercise[] {
  if (exercises.length === 0) return [{ ...EMPTY_EXERCISE }];
  return exercises.map((e) => ({
    name: e.name,
    sets: e.sets != null ? String(e.sets) : "",
    reps: e.reps != null ? String(e.reps) : "",
  }));
}

export function WorkoutPlansFab({ onStartPlan, onImport }: WorkoutPlansFabProps) {
  const { t } = useTranslation();
  const { plans, loading, savePlan, deletePlan } = useWorkoutPlans();

  const [menuOpen, setMenuOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  // null = editor fechado; objeto = editando (id undefined = nova planilha).
  const [editing, setEditing] = useState<{
    id?: string;
    name: string;
    exercises: DraftExercise[];
  } | null>(null);
  const [saving, setSaving] = useState(false);

  function openNewEditor() {
    setEditing({ name: "", exercises: [{ ...EMPTY_EXERCISE }] });
  }

  function openEditEditor(plan: WorkoutPlan) {
    setEditing({ id: plan.id, name: plan.name, exercises: toDraft(plan.exercises) });
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await savePlan({
        id: editing.id,
        name: editing.name,
        exercises: editing.exercises.map((e) => ({
          name: e.name,
          sets: Number.parseInt(e.sets, 10) || null,
          reps: Number.parseInt(e.reps, 10) || null,
        })),
      });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    editing != null &&
    editing.exercises.some((e) => e.name.trim().length > 0);

  return (
    <>
      {/* FAB "+" no canto inferior direito */}
      <button
        aria-label={t("workoutPlans.fab")}
        className="gc-pressable absolute bottom-[calc(var(--gc-safe-bottom)+22px)] right-5 z-[70] grid size-14 place-items-center rounded-full bg-[var(--gc-blue)] text-black shadow-[0_10px_30px_rgba(48,213,255,0.35)]"
        onClick={() => setMenuOpen(true)}
        type="button"
      >
        <Plus size={26} strokeWidth={2.8} />
      </button>

      {/* Menu de ações */}
      {menuOpen ? (
        <div
          className="fixed inset-0 z-[92] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="w-full max-w-[480px] rounded-t-[26px] border-t border-white/[0.08] bg-[#0b0d0e] px-4 pb-[calc(var(--gc-safe-bottom)+18px)] pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="grid gap-2">
              {onImport ? (
                <MenuRow
                  icon={<Download size={19} />}
                  label={t("workoutPlans.import")}
                  onClick={() => {
                    setMenuOpen(false);
                    onImport();
                  }}
                />
              ) : null}
              <MenuRow
                icon={<FolderOpen size={19} />}
                label={t("workoutPlans.open")}
                onClick={() => {
                  setMenuOpen(false);
                  setListOpen(true);
                }}
              />
              <MenuRow
                icon={<ClipboardList size={19} />}
                label={t("workoutPlans.create")}
                onClick={() => {
                  setMenuOpen(false);
                  openNewEditor();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Lista de planilhas */}
      {listOpen ? (
        <SheetShell title={t("workoutPlans.open")} onClose={() => setListOpen(false)}>
          {loading && plans.length === 0 ? (
            <p className="py-10 text-center text-[13px] font-semibold text-white/45">
              {t("common.loading")}
            </p>
          ) : plans.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[14px] font-semibold text-white/55">
                {t("workoutPlans.empty")}
              </p>
              <button
                className="gc-pressable mt-4 rounded-full bg-[var(--gc-blue)]/14 px-4 py-2.5 text-[13px] font-black text-[var(--gc-blue)]"
                onClick={() => {
                  setListOpen(false);
                  openNewEditor();
                }}
                type="button"
              >
                {t("workoutPlans.create")}
              </button>
            </div>
          ) : (
            <div className="grid gap-2.5">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-[18px] bg-white/[0.04] p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-[15px] font-black text-white">
                      {plan.name}
                    </p>
                    <button
                      aria-label={t("workoutPlans.edit")}
                      className="gc-pressable text-white/40"
                      onClick={() => {
                        setListOpen(false);
                        openEditEditor(plan);
                      }}
                      type="button"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      aria-label={t("workoutPlans.delete")}
                      className="gc-pressable text-white/40"
                      onClick={() => void deletePlan(plan.id)}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="mt-1 truncate text-[12.5px] font-semibold text-white/45">
                    {plan.exercises
                      .map((e) =>
                        e.sets && e.reps
                          ? `${e.name} ${e.sets}×${e.reps}`
                          : e.name,
                      )
                      .join(" · ") || t("workoutPlans.noExercises")}
                  </p>
                  <button
                    className="gc-pressable mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--gc-blue)] py-2.5 text-[13.5px] font-black text-black disabled:opacity-40"
                    disabled={plan.exercises.length === 0}
                    onClick={() => {
                      setListOpen(false);
                      onStartPlan(plan);
                    }}
                    type="button"
                  >
                    <Play fill="currentColor" size={14} />
                    {t("workoutPlans.start")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </SheetShell>
      ) : null}

      {/* Editor (cadastrar / editar planilha) */}
      {editing ? (
        <SheetShell
          title={
            editing.id ? t("workoutPlans.editTitle") : t("workoutPlans.createTitle")
          }
          onClose={() => setEditing(null)}
        >
          <input
            className="w-full rounded-xl bg-white/[0.06] px-4 py-3 text-[16px] font-black text-white outline-none placeholder:text-white/30"
            onChange={(e) =>
              setEditing((prev) => (prev ? { ...prev, name: e.target.value } : prev))
            }
            placeholder={t("workoutPlans.namePlaceholder")}
            value={editing.name}
          />

          <p className="mt-5 mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-white/40">
            {t("workoutPlans.exercises")}
          </p>
          <div className="grid gap-2">
            {editing.exercises.map((ex, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded-xl bg-white/[0.06] px-3 py-2.5 text-[14px] font-bold text-white outline-none placeholder:text-white/30"
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev
                        ? {
                            ...prev,
                            exercises: prev.exercises.map((x, i) =>
                              i === index ? { ...x, name: e.target.value } : x,
                            ),
                          }
                        : prev,
                    )
                  }
                  placeholder={t("workoutPlans.exerciseName")}
                  value={ex.name}
                />
                <input
                  aria-label={t("workoutPlans.setsShort")}
                  className="w-12 rounded-xl bg-white/[0.06] px-2 py-2.5 text-center text-[14px] font-black tabular-nums text-white outline-none placeholder:text-white/30"
                  inputMode="numeric"
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev
                        ? {
                            ...prev,
                            exercises: prev.exercises.map((x, i) =>
                              i === index
                                ? { ...x, sets: e.target.value.replace(/[^0-9]/g, "") }
                                : x,
                            ),
                          }
                        : prev,
                    )
                  }
                  placeholder={t("workoutPlans.setsShort")}
                  value={ex.sets}
                />
                <span className="text-[13px] font-black text-white/30">×</span>
                <input
                  aria-label={t("workoutPlans.repsShort")}
                  className="w-12 rounded-xl bg-white/[0.06] px-2 py-2.5 text-center text-[14px] font-black tabular-nums text-white outline-none placeholder:text-white/30"
                  inputMode="numeric"
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev
                        ? {
                            ...prev,
                            exercises: prev.exercises.map((x, i) =>
                              i === index
                                ? { ...x, reps: e.target.value.replace(/[^0-9]/g, "") }
                                : x,
                            ),
                          }
                        : prev,
                    )
                  }
                  placeholder={t("workoutPlans.repsShort")}
                  value={ex.reps}
                />
                <button
                  aria-label={t("workoutPlans.removeExercise")}
                  className="gc-pressable text-white/35"
                  onClick={() =>
                    setEditing((prev) =>
                      prev
                        ? {
                            ...prev,
                            exercises:
                              prev.exercises.length > 1
                                ? prev.exercises.filter((_, i) => i !== index)
                                : [{ ...EMPTY_EXERCISE }],
                          }
                        : prev,
                    )
                  }
                  type="button"
                >
                  <X size={16} strokeWidth={2.6} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="gc-pressable mt-2 flex items-center gap-1.5 text-[13px] font-black text-[var(--gc-blue)]"
            onClick={() =>
              setEditing((prev) =>
                prev
                  ? { ...prev, exercises: [...prev.exercises, { ...EMPTY_EXERCISE }] }
                  : prev,
              )
            }
            type="button"
          >
            <Plus size={16} strokeWidth={2.8} />
            {t("workoutPlans.addExercise")}
          </button>

          <button
            className="gc-pressable mt-6 w-full rounded-full bg-[var(--gc-blue)] py-3.5 text-[15px] font-black text-black disabled:opacity-40"
            disabled={!canSave || saving}
            onClick={handleSave}
            type="button"
          >
            {saving ? t("workoutPlans.saving") : t("workoutPlans.save")}
          </button>
        </SheetShell>
      ) : null}
    </>
  );
}

function MenuRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="gc-pressable flex items-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-3.5 text-left"
      onClick={onClick}
      type="button"
    >
      <span className="grid size-9 place-items-center rounded-full bg-[var(--gc-blue)]/14 text-[var(--gc-blue)]">
        {icon}
      </span>
      <span className="text-[15px] font-black text-white">{label}</span>
    </button>
  );
}

function SheetShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[94] flex justify-center overflow-y-auto bg-black/92 backdrop-blur-md">
      <div className="flex min-h-full w-full max-w-[480px] flex-col px-5 pb-[calc(var(--gc-safe-bottom)+24px)] pt-[calc(var(--gc-safe-top)+14px)]">
        <header className="mb-5 flex items-center justify-between">
          <p className="text-[19px] font-black text-white">{title}</p>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.08] text-white/82"
            onClick={onClose}
            type="button"
          >
            <X size={17} strokeWidth={2.4} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

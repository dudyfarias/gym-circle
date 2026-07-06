"use client";

import { useRef, useState } from "react";
import {
  ClipboardList,
  Download,
  Dumbbell,
  FileScan,
  FolderOpen,
  Info,
  Pencil,
  Play,
  Plus,
  Trophy,
  Trash2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WorkoutPlan, WorkoutPlanExercise } from "../social/types";
import { PersonalRecordsSheet } from "./PersonalRecordsSheet";
import {
  exerciseCatalogInfo,
  techniqueCatalogInfo,
  WorkoutCatalogInfoSheet,
  WorkoutExercisePicker,
  type WorkoutCatalogInfo,
} from "./WorkoutCatalogSheets";
import { useWorkoutCatalog } from "./useWorkoutCatalog";
import { useWorkoutPlans } from "./useWorkoutPlans";
import {
  importWorkoutPlanFile,
  WorkoutPlanImportError,
  type WorkoutPlanImportProgress,
} from "./workoutPlanImport";

type WorkoutPlansFabProps = {
  /** Iniciar um treino de força com a planilha carregada. */
  onStartPlan: (plan: WorkoutPlan) => void;
  /** Importar treino (Apple Saúde) — só onde há suporte (app iOS). */
  onImport?: () => void;
  catalog: ReturnType<typeof useWorkoutCatalog>;
};

type DraftExercise = {
  id: string;
  name: string;
  sets: string;
  target: string;
  exerciseId: string | null;
  muscleGroupSlug: string;
  techniqueId: string | null;
  techniqueName: string;
  techniqueNotes: string;
};

let draftSequence = 0;

function emptyExercise(): DraftExercise {
  draftSequence += 1;
  return {
    id: `draft-exercise-${draftSequence}`,
    name: "",
    sets: "",
    target: "",
    exerciseId: null,
    muscleGroupSlug: "other",
    techniqueId: null,
    techniqueName: "",
    techniqueNotes: "",
  };
}

function toDraft(exercises: WorkoutPlanExercise[]): DraftExercise[] {
  if (exercises.length === 0) return [emptyExercise()];
  return exercises.map((e) => ({
    id: emptyExercise().id,
    name: e.name,
    sets: e.sets != null ? String(e.sets) : "",
    target:
      e.targetKind === "failure"
        ? "F"
        : e.targetKind === "duration" && e.durationSeconds
          ? `${e.durationSeconds}s`
          : e.reps != null
            ? String(e.reps)
            : "",
    exerciseId: e.exerciseId ?? null,
    muscleGroupSlug: e.muscleGroupSlug ?? "other",
    techniqueId: e.techniqueId ?? null,
    techniqueName: e.techniqueName ?? "",
    techniqueNotes: e.techniqueNotes ?? "",
  }));
}

function targetFromDraft(target: string): Pick<
  WorkoutPlanExercise,
  "reps" | "targetKind" | "durationSeconds"
> {
  const normalized = target.trim().toLocaleLowerCase("pt-BR");
  if (/^(f|falha)$/.test(normalized)) {
    return { reps: null, targetKind: "failure", durationSeconds: null };
  }
  const duration = normalized.match(/^(\d{1,4})\s*s$/);
  if (duration) {
    return {
      reps: null,
      targetKind: "duration",
      durationSeconds: Number.parseInt(duration[1], 10) || null,
    };
  }
  return {
    reps: Number.parseInt(normalized, 10) || null,
    targetKind: "reps",
    durationSeconds: null,
  };
}

function planExerciseTarget(exercise: WorkoutPlanExercise): string {
  if (exercise.targetKind === "failure") return "F";
  if (exercise.targetKind === "duration" && exercise.durationSeconds) {
    return `${exercise.durationSeconds}s`;
  }
  return exercise.reps != null ? String(exercise.reps) : "—";
}

export function WorkoutPlansFab({
  onStartPlan,
  onImport,
  catalog,
}: WorkoutPlansFabProps) {
  const { i18n, t } = useTranslation();
  const {
    plans,
    loading,
    error: plansError,
    refresh,
    savePlan,
    deletePlan,
  } = useWorkoutPlans();
  const {
    muscleGroups,
    exercises: catalogExercises,
    techniques,
    findExercise,
    findTechnique,
    submitExercise,
    submitTechnique,
  } = catalog;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  // null = editor fechado; objeto = editando (id undefined = nova planilha).
  const [editing, setEditing] = useState<{
    id?: string;
    name: string;
    exercises: DraftExercise[];
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] =
    useState<WorkoutPlanImportProgress | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkoutPlan | null>(null);
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);
  const [catalogInfo, setCatalogInfo] = useState<WorkoutCatalogInfo | null>(null);

  function openNewEditor() {
    setImportedCount(null);
    setImportError(null);
    setEditing({ name: "", exercises: [emptyExercise()] });
  }

  function openEditEditor(plan: WorkoutPlan) {
    setImportedCount(null);
    setImportError(null);
    setEditing({ id: plan.id, name: plan.name, exercises: toDraft(plan.exercises) });
  }

  function openFilePicker() {
    setMenuOpen(false);
    setImportError(null);
    fileInputRef.current?.click();
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    setImportError(null);
    setImportProgress({ phase: "reading", progress: 0 });
    try {
      const parsed = await importWorkoutPlanFile(file, setImportProgress);
      const importedExercises = toDraft(parsed.exercises).map((draft) => {
        const catalogExercise = findExercise(draft.name);
        const catalogTechnique = draft.techniqueName
          ? findTechnique(draft.techniqueName)
          : null;
        return {
          ...draft,
          exerciseId: catalogExercise?.id ?? null,
          muscleGroupSlug:
            catalogExercise?.primaryMuscleGroupSlug ?? draft.muscleGroupSlug,
          techniqueId: catalogTechnique?.id ?? null,
          techniqueName:
            catalogTechnique?.namePt ?? draft.techniqueName,
        };
      });
      setEditing({
        name: parsed.name,
        exercises: importedExercises,
      });
      setImportedCount(parsed.exercises.length);
    } catch (error) {
      const code =
        error instanceof WorkoutPlanImportError ? error.code : "unreadable";
      setEditing((current) => current ?? {
        name: "",
        exercises: [emptyExercise()],
      });
      setImportError(t(`workoutPlans.importErrors.${code}`));
    } finally {
      setImporting(false);
      setImportProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setOperationError(null);
    try {
      const exercises = await Promise.all(
        editing.exercises
          .filter((exercise) => exercise.name.trim())
          .map(async (exercise) => {
            const catalogExercise =
              catalogExercises.find((item) => item.id === exercise.exerciseId) ??
              findExercise(exercise.name) ??
              (await submitExercise({
                name: exercise.name,
                primaryMuscleGroupSlug: exercise.muscleGroupSlug,
              }));
            const target = targetFromDraft(exercise.target);
            const techniqueName =
              exercise.techniqueName.trim() ||
              (target.targetKind === "failure"
                ? "Até a falha"
                : target.targetKind === "duration"
                  ? "Por tempo"
                  : "");
            const catalogTechnique = techniqueName
              ? techniques.find((item) => item.id === exercise.techniqueId) ??
                findTechnique(techniqueName) ??
                (await submitTechnique({ name: techniqueName }))
              : null;
            return {
              name: catalogExercise.namePt,
              sets: Number.parseInt(exercise.sets, 10) || null,
              ...target,
              exerciseId: catalogExercise.id,
              muscleGroupSlug: catalogExercise.primaryMuscleGroupSlug,
              techniqueId: catalogTechnique?.id ?? null,
              techniqueName:
                (catalogTechnique?.namePt ?? techniqueName) || null,
              techniqueNotes: exercise.techniqueNotes.trim() || null,
            } satisfies WorkoutPlanExercise;
          }),
      );
      await savePlan({
        id: editing.id,
        name: editing.name,
        exercises,
      });
      setEditing(null);
    } catch {
      setOperationError(t("workoutPlans.errors.save"));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setOperationError(null);
    try {
      await deletePlan(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      setOperationError(t("workoutPlans.errors.delete"));
    }
  }

  const canSave =
    editing != null &&
    editing.exercises.some((e) => e.name.trim().length > 0);

  return (
    <>
      <input
        accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
        ref={fileInputRef}
        type="file"
      />

      {catalogPickerOpen ? (
        <WorkoutExercisePicker
          exercises={catalogExercises}
          muscleGroups={muscleGroups}
          onClose={() => setCatalogPickerOpen(false)}
          onSelect={(exercise) => {
            const draft: DraftExercise = {
              ...emptyExercise(),
              name: exercise.namePt,
              exerciseId: exercise.id,
              muscleGroupSlug: exercise.primaryMuscleGroupSlug,
            };
            setEditing((current) => {
              if (!current) return current;
              const onlyBlank =
                current.exercises.length === 1 &&
                !current.exercises[0]?.name.trim();
              return {
                ...current,
                exercises: onlyBlank
                  ? [draft]
                  : [...current.exercises, draft],
              };
            });
            setCatalogPickerOpen(false);
          }}
        />
      ) : null}

      {catalogInfo ? (
        <WorkoutCatalogInfoSheet
          info={catalogInfo}
          onClose={() => setCatalogInfo(null)}
        />
      ) : null}

      {/* Ação persistente com rótulo: mais fácil de descobrir que um "+" solto. */}
      <button
        aria-label={t("workoutPlans.fab")}
        className="gc-pressable absolute bottom-[calc(var(--gc-safe-bottom)+22px)] right-5 z-[70] flex h-14 items-center gap-2 rounded-full bg-[var(--gc-blue)] px-5 text-[13px] font-black text-black shadow-[0_10px_30px_rgba(48,213,255,0.35)]"
        onClick={() => setMenuOpen(true)}
        type="button"
      >
        <Plus size={20} strokeWidth={2.8} />
        {t("workoutPlans.tools")}
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
              <MenuRow
                icon={<FileScan size={19} />}
                label={t("workoutPlans.importFile")}
                onClick={openFilePicker}
              />
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
              <MenuRow
                icon={<Trophy size={19} />}
                label={t("personalRecords.title")}
                onClick={() => {
                  setMenuOpen(false);
                  setRecordsOpen(true);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {importing ? (
        <div
          aria-live="polite"
          className="fixed inset-0 z-[98] grid place-items-center bg-black/88 px-8 backdrop-blur-md"
        >
          <div className="w-full max-w-sm rounded-[24px] border border-white/[0.08] bg-[#0b0d0e] p-5 text-center">
            <span className="mx-auto block size-8 animate-spin rounded-full border-2 border-white/15 border-t-[var(--gc-brand)]" />
            <p className="mt-4 text-[15px] font-black text-white">
              {t(`workoutPlans.importPhases.${importProgress?.phase ?? "reading"}`)}
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-[var(--gc-brand)] transition-[width] duration-300"
                style={{ width: `${(importProgress?.progress ?? 0) * 100}%` }}
              />
            </div>
            <p className="mt-3 text-[11.5px] font-bold text-white/42">
              {t("workoutPlans.importPrivacy")}
            </p>
          </div>
        </div>
      ) : null}

      {recordsOpen ? (
        <PersonalRecordsSheet onClose={() => setRecordsOpen(false)} />
      ) : null}

      {deleteTarget ? (
        <div
          aria-label={t("workoutPlans.deleteConfirm")}
          aria-modal="true"
          className="fixed inset-0 z-[98] flex items-end justify-center bg-black/72 px-4 pb-[calc(var(--gc-safe-bottom)+16px)] backdrop-blur-sm"
          role="alertdialog"
        >
          <div className="w-full max-w-[448px] rounded-[24px] border border-white/[0.08] bg-[#101214] p-5">
            <p className="text-[17px] font-black text-white">
              {t("workoutPlans.deleteConfirm")}
            </p>
            <p className="mt-1 text-[12.5px] font-bold text-white/45">
              {deleteTarget.name}
            </p>
            {operationError ? (
              <p
                aria-live="assertive"
                className="mt-3 rounded-[12px] bg-[var(--gc-pink)]/10 px-3 py-2 text-[11.5px] font-bold text-[var(--gc-pink)]"
              >
                {operationError}
              </p>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                className="gc-pressable rounded-full bg-white/[0.07] py-3 text-[13px] font-black text-white"
                onClick={() => setDeleteTarget(null)}
                type="button"
              >
                {t("common.cancel")}
              </button>
              <button
                className="gc-pressable rounded-full bg-[var(--gc-pink)] py-3 text-[13px] font-black text-white"
                onClick={() => void confirmDelete()}
                type="button"
              >
                {t("common.delete")}
              </button>
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
          ) : plansError ? (
            <button
              className="gc-pressable mx-auto my-10 rounded-full bg-white/[0.07] px-4 py-3 text-[13px] font-black text-white"
              onClick={() => void refresh()}
              type="button"
            >
              {t("common.retry")}
            </button>
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
                      onClick={() => setDeleteTarget(plan)}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="mt-1 truncate text-[12.5px] font-semibold text-white/45">
                    {plan.exercises
                      .map((e) =>
                        e.sets
                          ? `${e.name} ${e.sets}×${planExerciseTarget(e)}${
                              e.techniqueName ? ` · ${e.techniqueName}` : ""
                            }`
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
          <button
            className="gc-pressable mb-4 flex w-full items-center gap-3 rounded-[18px] border border-[var(--gc-brand)]/18 bg-[var(--gc-brand)]/[0.07] px-4 py-3 text-left"
            onClick={openFilePicker}
            type="button"
          >
            <span className="grid size-10 place-items-center rounded-[13px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
              <FileScan size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-black text-white">
                {t("workoutPlans.importFile")}
              </span>
              <span className="mt-0.5 block text-[11px] font-bold text-white/42">
                {t("workoutPlans.importHint")}
              </span>
            </span>
          </button>

          {importedCount != null ? (
            <p
              aria-live="polite"
              className="mb-4 rounded-[14px] bg-[#97ff00]/10 px-3 py-2.5 text-[11.5px] font-bold text-[#b9ff65]"
            >
              {t("workoutPlans.imported", { count: importedCount })}
            </p>
          ) : null}

          {importError ? (
            <p
              aria-live="assertive"
              className="mb-4 rounded-[14px] bg-[var(--gc-pink)]/10 px-3 py-2.5 text-[11.5px] font-bold text-[var(--gc-pink)]"
            >
              {importError}
            </p>
          ) : null}

          {operationError ? (
            <p
              aria-live="assertive"
              className="mb-4 rounded-[14px] bg-[var(--gc-pink)]/10 px-3 py-2.5 text-[11.5px] font-bold text-[var(--gc-pink)]"
            >
              {operationError}
            </p>
          ) : null}

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
          <button
            className="gc-pressable mb-3 flex w-full items-center justify-center gap-2 rounded-[16px] border border-[var(--gc-blue)]/20 bg-[var(--gc-blue)]/10 py-3 text-[13px] font-black text-[var(--gc-blue)]"
            onClick={() => setCatalogPickerOpen(true)}
            type="button"
          >
            <Dumbbell size={17} />
            {t("workoutCatalog.addFromCatalog")}
          </button>

          <div className="grid gap-3">
            {editing.exercises.map((ex, index) => {
              const catalogExercise =
                catalogExercises.find((item) => item.id === ex.exerciseId) ??
                findExercise(ex.name);
              const catalogTechnique =
                techniques.find((item) => item.id === ex.techniqueId) ??
                findTechnique(ex.techniqueName);
              return (
                <div
                  className="rounded-[18px] border border-white/[0.06] bg-white/[0.035] p-3"
                  key={ex.id}
                >
                  <div className="flex items-center gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-xl bg-white/[0.06] px-3 py-2.5 text-[14px] font-bold text-white outline-none placeholder:text-white/30"
                      onChange={(event) =>
                        setEditing((prev) =>
                          prev
                            ? {
                                ...prev,
                                exercises: prev.exercises.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        name: event.target.value,
                                        exerciseId: null,
                                      }
                                    : item,
                                ),
                              }
                            : prev,
                        )
                      }
                      placeholder={t("workoutPlans.exerciseName")}
                      value={ex.name}
                    />
                    {catalogExercise ? (
                      <button
                        aria-label={t("workoutCatalog.aboutExercise")}
                        className="gc-pressable grid size-9 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)]/10 text-[var(--gc-brand)]"
                        onClick={() => {
                          const group = muscleGroups.find(
                            (item) =>
                              item.slug ===
                              catalogExercise.primaryMuscleGroupSlug,
                          );
                          setCatalogInfo(
                            exerciseCatalogInfo(
                              catalogExercise,
                              i18n.language,
                              i18n.language.startsWith("en")
                                ? group?.nameEn
                                : group?.namePt,
                            ),
                          );
                        }}
                        type="button"
                      >
                        <Info size={16} />
                      </button>
                    ) : null}
                    <button
                      aria-label={t("workoutPlans.removeExercise")}
                      className="gc-pressable grid size-9 shrink-0 place-items-center text-white/35"
                      onClick={() =>
                        setEditing((prev) =>
                          prev
                            ? {
                                ...prev,
                                exercises:
                                  prev.exercises.length > 1
                                    ? prev.exercises.filter((_, i) => i !== index)
                                    : [emptyExercise()],
                              }
                            : prev,
                        )
                      }
                      type="button"
                    >
                      <X size={16} strokeWidth={2.6} />
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-[minmax(0,1fr)_74px_12px_90px] items-end gap-1.5">
                    <label className="min-w-0">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-white/30">
                        {t("workoutCatalog.muscleGroup")}
                      </span>
                      <select
                        className="h-[39px] w-full rounded-xl bg-white/[0.06] px-2 text-[11px] font-bold text-white outline-none"
                        onChange={(event) =>
                          setEditing((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  exercises: prev.exercises.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          muscleGroupSlug: event.target.value,
                                        }
                                      : item,
                                  ),
                                }
                              : prev,
                          )
                        }
                        value={ex.muscleGroupSlug}
                      >
                        {muscleGroups.map((group) => (
                          <option key={group.slug} value={group.slug}>
                            {i18n.language.startsWith("en")
                              ? group.nameEn
                              : group.namePt}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="mb-1 block text-center text-[9px] font-black uppercase tracking-[0.1em] text-white/30">
                        {t("workoutPlans.setsShort")}
                      </span>
                      <input
                        aria-label={t("workoutPlans.setsShort")}
                        className="w-full rounded-xl bg-white/[0.06] px-1 py-2.5 text-center text-[14px] font-black tabular-nums text-white outline-none placeholder:text-white/30"
                        inputMode="numeric"
                        onChange={(event) =>
                          setEditing((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  exercises: prev.exercises.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          sets: event.target.value.replace(
                                            /[^0-9]/g,
                                            "",
                                          ),
                                        }
                                      : item,
                                  ),
                                }
                              : prev,
                          )
                        }
                        placeholder="4"
                        value={ex.sets}
                      />
                    </label>
                    <span className="pb-2.5 text-center text-[13px] font-black text-white/30">
                      ×
                    </span>
                    <label>
                      <span className="mb-1 block text-center text-[9px] font-black uppercase tracking-[0.1em] text-white/30">
                        {t("workoutCatalog.target")}
                      </span>
                      <input
                        aria-label={t("workoutCatalog.target")}
                        className="w-full rounded-xl bg-white/[0.06] px-1 py-2.5 text-center text-[14px] font-black tabular-nums text-white outline-none placeholder:text-white/30"
                        inputMode="text"
                        onChange={(event) =>
                          setEditing((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  exercises: prev.exercises.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          target: event.target.value
                                            .replace(/[^0-9fFsS]/g, "")
                                            .slice(0, 5),
                                        }
                                      : item,
                                  ),
                                }
                              : prev,
                          )
                        }
                        placeholder="10 / F / 30s"
                        value={ex.target}
                      />
                    </label>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-xl bg-white/[0.06] px-3 py-2.5 text-[12px] font-bold text-white outline-none placeholder:text-white/30"
                      list="workout-techniques"
                      onChange={(event) => {
                        const found = findTechnique(event.target.value);
                        setEditing((prev) =>
                          prev
                            ? {
                                ...prev,
                                exercises: prev.exercises.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        techniqueId: found?.id ?? null,
                                        techniqueName: event.target.value,
                                      }
                                    : item,
                                ),
                              }
                            : prev,
                        );
                      }}
                      placeholder={t("workoutCatalog.techniqueOptional")}
                      value={ex.techniqueName}
                    />
                    {catalogTechnique ? (
                      <button
                        aria-label={t("workoutCatalog.aboutTechnique")}
                        className="gc-pressable grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white/65"
                        onClick={() =>
                          setCatalogInfo(
                            techniqueCatalogInfo(
                              catalogTechnique,
                              i18n.language,
                            ),
                          )
                        }
                        type="button"
                      >
                        <Info size={16} />
                      </button>
                    ) : null}
                  </div>
                  {ex.techniqueName ? (
                    <input
                      className="mt-2 w-full rounded-xl bg-white/[0.045] px-3 py-2.5 text-[11.5px] font-semibold text-white/75 outline-none placeholder:text-white/25"
                      onChange={(event) =>
                        setEditing((prev) =>
                          prev
                            ? {
                                ...prev,
                                exercises: prev.exercises.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        techniqueNotes: event.target.value,
                                      }
                                    : item,
                                ),
                              }
                            : prev,
                        )
                      }
                      placeholder={t("workoutCatalog.techniqueNotes")}
                      value={ex.techniqueNotes}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          <datalist id="workout-techniques">
            {techniques.map((technique) => (
              <option key={technique.id} value={technique.namePt} />
            ))}
          </datalist>
          <button
            className="gc-pressable mt-3 flex items-center gap-1.5 text-[13px] font-black text-white/55"
            onClick={() =>
              setEditing((prev) =>
                prev
                  ? { ...prev, exercises: [...prev.exercises, emptyExercise()] }
                  : prev,
              )
            }
            type="button"
          >
            <Plus size={16} strokeWidth={2.8} />
            {t("workoutCatalog.addManual")}
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

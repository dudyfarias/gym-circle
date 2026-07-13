"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dumbbell,
  ExternalLink,
  Info,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  WorkoutExerciseCatalogItem,
  WorkoutMuscleGroup,
  WorkoutTechniqueCatalogItem,
} from "../social/types";
import {
  ALL_WORKOUT_GROUPS,
  filterWorkoutCatalogExercises,
  workoutCatalogEquipmentOptions,
  workoutEquipmentLabel,
} from "./workoutCatalogFilters";
import {
  localizeWorkoutExercise,
  localizeWorkoutTechnique,
  localizeWorkoutVariationName,
  workoutMovementPatternLabel,
} from "./workoutCatalogLocalization";

export type WorkoutCatalogInfo = {
  kind: "exercise" | "technique";
  title: string;
  eyebrow?: string | null;
  summary: string;
  instructions: string[];
  videoUrl: string | null;
  videoSearchQuery: string | null;
  locale: "pt" | "en";
  movementPattern: string | null;
  translationPending: boolean;
  originalName: boolean;
  variations: Array<{
    id: string;
    title: string;
    equipment: string[];
    originalName: boolean;
  }>;
};

export function exerciseCatalogInfo(
  exercise: WorkoutExerciseCatalogItem,
  language: string,
  muscleGroupName?: string | null,
): WorkoutCatalogInfo {
  const english = language.toLowerCase().startsWith("en");
  const localized = localizeWorkoutExercise(exercise, english);
  return {
    kind: "exercise",
    title: localized.name,
    eyebrow: muscleGroupName ?? null,
    summary: localized.description,
    instructions: localized.instructions,
    videoUrl: exercise.videoUrl,
    videoSearchQuery: exercise.videoSearchQuery,
    locale: english ? "en" : "pt",
    movementPattern:
      exercise.variations.length > 0 && exercise.movementPattern
      ? workoutMovementPatternLabel(exercise.movementPattern, english)
      : null,
    translationPending: localized.translationPending,
    originalName: localized.usesOriginalName,
    variations: exercise.variations.map((variation) => {
      const variationName = localizeWorkoutVariationName(variation, english);
      return {
        id: variation.id,
        title: variationName.name,
        equipment: variation.equipment,
        originalName: variationName.usesOriginalName,
      };
    }),
  };
}

export function techniqueCatalogInfo(
  technique: WorkoutTechniqueCatalogItem,
  language: string,
): WorkoutCatalogInfo {
  const english = language.toLowerCase().startsWith("en");
  const localized = localizeWorkoutTechnique(technique, english);
  return {
    kind: "technique",
    title: localized.name,
    eyebrow: null,
    summary: localized.summary,
    instructions: localized.instructions,
    videoUrl: technique.videoUrl,
    videoSearchQuery: technique.videoSearchQuery,
    locale: english ? "en" : "pt",
    movementPattern: null,
    translationPending: localized.translationPending,
    originalName: localized.usesOriginalName,
    variations: [],
  };
}

export function WorkoutCatalogInfoSheet({
  info,
  onClose,
  primaryAction,
}: {
  info: WorkoutCatalogInfo;
  onClose: () => void;
  primaryAction?: { label: string; onClick: () => void };
}) {
  const { t } = useTranslation();
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
  const videoHref =
    info.videoUrl ||
    (info.videoSearchQuery
      ? `https://www.youtube.com/results?search_query=${encodeURIComponent(
          info.videoSearchQuery,
        )}`
      : null);

  return (
    <div
      aria-label={info.title}
      aria-modal="true"
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/76 px-3 backdrop-blur-md"
      role="dialog"
    >
      <div className="max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] border-t border-white/[0.09] bg-[#0b0d0e] px-5 pb-[calc(var(--gc-safe-bottom)+24px)] pt-4">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <header className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-[15px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
            {info.kind === "exercise" ? (
              <Dumbbell size={20} />
            ) : (
              <Info size={20} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            {info.eyebrow ? (
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--gc-brand)]">
                {info.eyebrow}
              </p>
            ) : null}
            <h2 className="text-[20px] font-black leading-tight text-white">
              {info.title}
            </h2>
            {info.originalName ? (
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-white/35">
                {t("workoutCatalog.originalName")}
              </p>
            ) : null}
          </div>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-11 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white/70"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </header>

        {info.movementPattern ? (
          <span className="mt-4 inline-flex rounded-full bg-[var(--gc-brand)]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[var(--gc-brand)]">
            {info.movementPattern}
          </span>
        ) : null}

        {info.locale === "en" && info.translationPending ? (
          <p className="mt-4 rounded-[14px] bg-white/[0.045] px-3 py-2 text-[10.5px] font-semibold leading-relaxed text-white/45">
            {t("workoutCatalog.translationPending")}
          </p>
        ) : null}

        <p className="mt-5 text-[14px] font-semibold leading-relaxed text-white/70">
          {info.summary}
        </p>

        {info.instructions.length > 0 ? (
          <ol className="mt-5 grid gap-2.5">
            {info.instructions.map((instruction, index) => (
              <li
                className="flex gap-3 rounded-[15px] bg-white/[0.04] px-3.5 py-3 text-[12.5px] font-semibold leading-relaxed text-white/68"
                key={`${instruction}-${index}`}
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)]/12 text-[10px] font-black text-[var(--gc-brand)]">
                  {index + 1}
                </span>
                {instruction}
              </li>
            ))}
          </ol>
        ) : null}

        {info.variations.length > 0 ? (
          <section
            aria-label={t("workoutCatalog.variations")}
            className="mt-5"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/38">
              {t("workoutCatalog.variations")}
            </p>
            <div className="mt-2 grid gap-2">
              {info.variations.map((variation) => (
                <div
                  className="rounded-[15px] bg-white/[0.04] px-3.5 py-3"
                  key={variation.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-[12.5px] font-black text-white/78">
                      {variation.title}
                    </p>
                    {variation.originalName ? (
                      <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-1 text-[8px] font-black uppercase tracking-[0.06em] text-white/35">
                        {t("workoutCatalog.original")}
                      </span>
                    ) : null}
                  </div>
                  {variation.equipment.length > 0 ? (
                    <p className="mt-1.5 text-[9.5px] font-bold text-white/35">
                      {variation.equipment
                        .slice(0, 3)
                        .map((item) =>
                          workoutEquipmentLabel(item, info.locale === "en"),
                        )
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {primaryAction ? (
          <button
            className="gc-pressable mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] px-4 text-[14px] font-black text-black"
            onClick={primaryAction.onClick}
            type="button"
          >
            <Plus size={17} />
            {primaryAction.label}
          </button>
        ) : null}

        {videoHref ? (
          <a
            className="gc-pressable mt-2.5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white/[0.07] px-4 text-[14px] font-black text-white"
            href={videoHref}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink size={17} />
            {t("workoutCatalog.watchVideo")}
          </a>
        ) : null}
        {!info.videoUrl && videoHref ? (
          <p className="mt-2 text-center text-[10.5px] font-semibold text-white/35">
            {t("workoutCatalog.videoSearchNotice")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function WorkoutExercisePicker({
  muscleGroups,
  exercises,
  onSelect,
  onClose,
  loading = false,
  error = null,
  onRetry,
}: {
  muscleGroups: WorkoutMuscleGroup[];
  exercises: WorkoutExerciseCatalogItem[];
  onSelect: (exercise: WorkoutExerciseCatalogItem) => void;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const { i18n, t } = useTranslation();
  const [group, setGroup] = useState(
    muscleGroups[0]?.slug ?? ALL_WORKOUT_GROUPS,
  );
  const [query, setQuery] = useState("");
  const [equipment, setEquipment] = useState<string | null>(null);
  const [previewExercise, setPreviewExercise] =
    useState<WorkoutExerciseCatalogItem | null>(null);
  const english = i18n.language.toLowerCase().startsWith("en");
  const equipmentOptions = useMemo(
    () => workoutCatalogEquipmentOptions(exercises, { group, query }),
    [exercises, group, query],
  );
  const activeEquipment =
    equipment && equipmentOptions.includes(equipment) ? equipment : null;
  const visible = useMemo(() => {
    return filterWorkoutCatalogExercises(exercises, {
      group,
      query,
      equipment: activeEquipment,
    })
      .sort((left, right) =>
        localizeWorkoutExercise(left, english).name.localeCompare(
          localizeWorkoutExercise(right, english).name,
          english ? "en" : "pt-BR",
        ),
      );
  }, [activeEquipment, english, exercises, group, query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !previewExercise) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, previewExercise]);

  const allLabel = t("workoutCatalog.allGroups");
  const equipmentTitle = t("workoutCatalog.equipment");
  const allEquipmentLabel = t("workoutCatalog.allEquipment");
  const communityLabel = t("workoutCatalog.community");
  const loadErrorLabel = t("workoutCatalog.loadError");

  return (
    <>
      <div
        aria-label={t("workoutCatalog.chooseExercise")}
        aria-modal="true"
        className="fixed inset-0 z-[108] flex justify-center overflow-y-auto bg-black/94 backdrop-blur-md"
        role="dialog"
      >
        <div className="flex min-h-full w-full max-w-[480px] flex-col px-5 pb-[calc(var(--gc-safe-bottom)+24px)] pt-[calc(var(--gc-safe-top)+14px)]">
        <header className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[19px] font-black text-white">
              {t("workoutCatalog.chooseExercise")}
            </p>
            <p className="mt-0.5 text-[11.5px] font-bold text-white/40">
              {t("workoutCatalog.chooseMuscle")}
            </p>
          </div>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.07] text-white/70"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </header>

        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.14em] text-white/38">
          {t("workoutCatalog.muscleGroup")}
        </p>
        <div className="gc-scrollbar -mx-5 mt-2 flex min-h-11 shrink-0 items-center gap-2 overflow-x-auto px-5 py-1">
          <button
            aria-pressed={group === ALL_WORKOUT_GROUPS}
            className={[
              "gc-pressable inline-flex h-11 shrink-0 items-center justify-center rounded-full px-4 text-[12px] font-black leading-none",
              group === ALL_WORKOUT_GROUPS
                ? "bg-[var(--gc-brand)] text-black"
                : "bg-white/[0.06] text-white/55",
            ].join(" ")}
            onClick={() => setGroup(ALL_WORKOUT_GROUPS)}
            type="button"
          >
            {allLabel}
          </button>
          {muscleGroups.map((item) => (
            <button
              aria-pressed={item.slug === group}
              className={[
                "gc-pressable inline-flex h-11 shrink-0 items-center justify-center rounded-full px-4 text-[12px] font-black leading-none",
                item.slug === group
                  ? "bg-[var(--gc-brand)] text-black"
                  : "bg-white/[0.06] text-white/55",
              ].join(" ")}
              key={item.slug}
              onClick={() => setGroup(item.slug)}
              type="button"
            >
              {english ? item.nameEn : item.namePt}
            </button>
          ))}
        </div>

        <label className="mt-4 flex shrink-0 items-center gap-2 rounded-[15px] bg-white/[0.06] px-3.5">
          <Search className="text-white/35" size={17} />
          <input
            aria-label={t("workoutCatalog.search")}
            className="min-w-0 flex-1 bg-transparent py-3 text-[14px] font-semibold text-white outline-none placeholder:text-white/30"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("workoutCatalog.search")}
            value={query}
          />
        </label>

        {equipmentOptions.length > 0 ? (
          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/38">
              {equipmentTitle}
            </p>
            <div className="gc-scrollbar -mx-5 mt-2 flex min-h-11 items-center gap-2 overflow-x-auto px-5">
              <button
                aria-pressed={activeEquipment === null}
                className={[
                  "gc-pressable h-11 shrink-0 rounded-full px-4 text-[11px] font-black",
                  activeEquipment === null
                    ? "bg-white text-black"
                    : "bg-white/[0.06] text-white/50",
                ].join(" ")}
                onClick={() => setEquipment(null)}
                type="button"
              >
                {allEquipmentLabel}
              </button>
              {equipmentOptions.map((item) => (
                <button
                  aria-pressed={activeEquipment === item}
                  className={[
                    "gc-pressable h-11 shrink-0 rounded-full px-4 text-[11px] font-black",
                    activeEquipment === item
                      ? "bg-white text-black"
                      : "bg-white/[0.06] text-white/50",
                  ].join(" ")}
                  key={item}
                  onClick={() => setEquipment(item)}
                  type="button"
                >
                  {workoutEquipmentLabel(item, english)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-[17px] border border-[var(--gc-pink)]/12 bg-[var(--gc-pink)]/[0.045] p-3 text-center">
            <p className="text-[12px] font-bold text-white/55">
              {loadErrorLabel}
            </p>
            {onRetry ? (
              <button
                className="gc-pressable mx-auto mt-2 flex h-11 items-center gap-2 rounded-full bg-white/[0.07] px-4 text-[12px] font-black text-white"
                onClick={onRetry}
                type="button"
              >
                <RefreshCw size={15} />
                {t("common.retry")}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-2">
          {loading && exercises.length === 0
            ? Array.from({ length: 5 }, (_, index) => (
                <div
                  aria-hidden="true"
                  className="h-[88px] animate-pulse rounded-[18px] bg-white/[0.045]"
                  key={index}
                />
              ))
            : visible.map((exercise) => {
                const localized = localizeWorkoutExercise(exercise, english);
                return (
                  <button
                    className="gc-pressable flex items-center gap-3 rounded-[18px] bg-white/[0.045] px-4 py-3.5 text-left"
                    key={exercise.id}
                    onClick={() => setPreviewExercise(exercise)}
                    type="button"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
                      <Dumbbell size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-black text-white">
                        {localized.name}
                      </span>
                      {localized.usesOriginalName ? (
                        <span className="mt-1 inline-flex rounded-full bg-white/[0.06] px-2 py-0.5 text-[8.5px] font-black uppercase tracking-[0.08em] text-white/35">
                          {t("workoutCatalog.originalName")}
                        </span>
                      ) : null}
                      {exercise.status === "community" ? (
                        <span className="mt-1 inline-flex rounded-full bg-[var(--gc-blue)]/10 px-2 py-0.5 text-[8.5px] font-black uppercase tracking-[0.08em] text-[var(--gc-blue)]">
                          {communityLabel}
                        </span>
                      ) : null}
                      <span className="mt-0.5 line-clamp-1 block text-[10.5px] font-semibold text-white/38">
                        {localized.description}
                      </span>
                      {exercise.variations.length > 0 ? (
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {exercise.variations.length > 0 &&
                          exercise.movementPattern ? (
                            <span className="rounded-full bg-[var(--gc-brand)]/10 px-2 py-0.5 text-[9px] font-black text-[var(--gc-brand)]">
                              {workoutMovementPatternLabel(
                                exercise.movementPattern,
                                english,
                              )}
                            </span>
                          ) : null}
                          {exercise.variations.length > 0 ? (
                            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] font-black text-white/42">
                              {t("workoutCatalog.variationCount", {
                                count: exercise.variations.length,
                              })}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                      {exercise.equipment.length > 0 ? (
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {exercise.equipment.slice(0, 3).map((item) => (
                            <span
                              className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9.5px] font-black uppercase tracking-[0.04em] text-white/42"
                              key={item}
                            >
                              {workoutEquipmentLabel(item, english)}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                    <Plus className="text-[var(--gc-brand)]" size={18} />
                  </button>
                );
              })}
          {!loading && !error && visible.length === 0 ? (
            <p className="py-12 text-center text-[13px] font-semibold text-white/42">
              {t("workoutCatalog.emptyGroup")}
            </p>
          ) : null}
          </div>
        </div>
      </div>
      {previewExercise ? (
        <WorkoutCatalogInfoSheet
          info={exerciseCatalogInfo(
            previewExercise,
            i18n.language,
            (() => {
              const muscleGroup = muscleGroups.find(
                (item) =>
                  item.slug === previewExercise.primaryMuscleGroupSlug,
              );
              return english ? muscleGroup?.nameEn : muscleGroup?.namePt;
            })(),
          )}
          onClose={() => setPreviewExercise(null)}
          primaryAction={{
            label: t("workoutCatalog.addToWorkout"),
            onClick: () => onSelect(previewExercise),
          }}
        />
      ) : null}
    </>
  );
}

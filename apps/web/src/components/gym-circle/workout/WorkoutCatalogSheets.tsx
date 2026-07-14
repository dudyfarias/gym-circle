"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clock3,
  Dumbbell,
  ExternalLink,
  Info,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
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
  STANDARD_WORKOUT_EQUIPMENT_FILTERS,
  type WorkoutCatalogAdvancedFilters,
  type WorkoutCatalogQuickFilter,
  rankWorkoutCatalogExercises,
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
  favoriteExerciseIds = [],
  recentExerciseIds = [],
  onToggleFavorite,
}: {
  muscleGroups: WorkoutMuscleGroup[];
  exercises: WorkoutExerciseCatalogItem[];
  onSelect: (exercise: WorkoutExerciseCatalogItem) => void;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  favoriteExerciseIds?: string[];
  recentExerciseIds?: string[];
  onToggleFavorite?: (exerciseId: string) => void | Promise<void>;
}) {
  const { i18n, t } = useTranslation();
  const [group, setGroup] = useState(ALL_WORKOUT_GROUPS);
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] =
    useState<WorkoutCatalogQuickFilter>("all");
  const [filters, setFilters] = useState<WorkoutCatalogAdvancedFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [previewExercise, setPreviewExercise] =
    useState<WorkoutExerciseCatalogItem | null>(null);
  const groupButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const english = i18n.language.toLowerCase().startsWith("en");
  const equipmentOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...STANDARD_WORKOUT_EQUIPMENT_FILTERS,
          ...workoutCatalogEquipmentOptions(exercises, { group, query }),
        ]),
      ),
    [exercises, group, query],
  );
  const filterSource = useMemo(() => {
    const unfilteredSections = rankWorkoutCatalogExercises(exercises, {
      group,
      query,
      favoriteExerciseIds,
      recentExerciseIds,
    });
    const ids = new Set(
      unfilteredSections.primary
        .concat(unfilteredSections.secondary)
        .map((item) => item.exercise.id),
    );
    return exercises.filter((exercise) => ids.has(exercise.id));
  }, [exercises, favoriteExerciseIds, group, query, recentExerciseIds]);
  const filterOptions = useMemo(
    () => ({
      loadTypes: Array.from(
        new Set(filterSource.map((item) => item.defaultLoadType).filter(Boolean)),
      ) as NonNullable<WorkoutExerciseCatalogItem["defaultLoadType"]>[],
      difficulties: Array.from(
        new Set(filterSource.map((item) => item.difficulty).filter(Boolean)),
      ) as NonNullable<WorkoutExerciseCatalogItem["difficulty"]>[],
      movementPatterns: Array.from(
        new Set(filterSource.map((item) => item.movementPattern).filter(Boolean)),
      ) as string[],
      exerciseTypes: Array.from(
        new Set(filterSource.map((item) => item.exerciseType).filter(Boolean)),
      ) as NonNullable<WorkoutExerciseCatalogItem["exerciseType"]>[],
    }),
    [filterSource],
  );
  const sections = useMemo(
    () =>
      rankWorkoutCatalogExercises(exercises, {
        group,
        query,
        quickFilter,
        filters,
        favoriteExerciseIds,
        recentExerciseIds,
        locale: english ? "en" : "pt-BR",
      }),
    [
      english,
      exercises,
      favoriteExerciseIds,
      filters,
      group,
      query,
      quickFilter,
      recentExerciseIds,
    ],
  );
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const visibleCount = sections.primary.length + sections.secondary.length;
  const recentSection = useMemo(() => {
    if (
      group !== ALL_WORKOUT_GROUPS ||
      query.trim() ||
      quickFilter !== "all" ||
      activeFilterCount > 0
    ) {
      return [];
    }
    const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
    return recentExerciseIds
      .map((id) => byId.get(id))
      .filter((item): item is WorkoutExerciseCatalogItem => Boolean(item))
      .slice(0, 5);
  }, [
    activeFilterCount,
    exercises,
    group,
    query,
    quickFilter,
    recentExerciseIds,
  ]);
  const displayedPrimary = useMemo(() => {
    if (recentSection.length === 0) return sections.primary;
    const recentIds = new Set(recentSection.map((exercise) => exercise.id));
    return sections.primary.filter((item) => !recentIds.has(item.exercise.id));
  }, [recentSection, sections.primary]);

  useEffect(() => {
    groupButtonRefs.current.get(group)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [group]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (previewExercise) setPreviewExercise(null);
      else if (filtersOpen) setFiltersOpen(false);
      else onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filtersOpen, onClose, previewExercise]);

  const allLabel = t("workoutCatalog.allGroups");
  const communityLabel = t("workoutCatalog.community");
  const loadErrorLabel = t("workoutCatalog.loadError");

  function filterValueLabel(kind: string, value: string) {
    if (kind === "loadType") return t(`workoutCatalog.loadTypes.${value}`);
    if (kind === "difficulty")
      return t(`workoutCatalog.difficulties.${value}`);
    if (kind === "exerciseType")
      return t(`workoutCatalog.exerciseTypes.${value}`);
    return workoutMovementPatternLabel(value, english);
  }

  function exerciseRow(
    exercise: WorkoutExerciseCatalogItem,
    options?: { compact?: boolean },
  ) {
    const localized = localizeWorkoutExercise(exercise, english);
    const favorite = favoriteExerciseIds.includes(exercise.id);
    const equipment =
      exercise.primaryEquipment ?? exercise.compatibleEquipments[0] ?? null;
    return (
      <article
        className={[
          "flex min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-[16px] bg-white/[0.045] px-3 transition-colors duration-200 hover:bg-white/[0.07]",
          options?.compact
            ? "w-[260px] min-w-[260px] py-2"
            : "w-full py-2.5",
        ].join(" ")}
        key={exercise.id}
      >
        <button
          className="gc-pressable flex min-w-0 flex-1 items-center gap-3 overflow-hidden text-left"
          onClick={() => setPreviewExercise(exercise)}
          type="button"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
            <Dumbbell size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-black text-white">
              {localized.name}
            </span>
            <span className="mt-0.5 line-clamp-1 block text-[10.5px] font-semibold text-white/38">
              {localized.description}
            </span>
            {equipment ? (
              <span className="mt-0.5 block truncate text-[9.5px] font-black uppercase tracking-[0.06em] text-[var(--gc-brand)]/70">
                {workoutEquipmentLabel(equipment, english)}
              </span>
            ) : null}
            {exercise.status === "community" ? (
              <span className="mt-1 inline-flex rounded-full bg-[var(--gc-blue)]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-[var(--gc-blue)]">
                {communityLabel}
              </span>
            ) : null}
          </span>
        </button>
        {onToggleFavorite ? (
          <button
            aria-label={
              favorite
                ? t("workoutCatalog.removeFavorite")
                : t("workoutCatalog.addFavorite")
            }
            aria-pressed={favorite}
            className="gc-pressable grid size-9 shrink-0 place-items-center rounded-full text-white/42"
            onClick={() => void onToggleFavorite(exercise.id)}
            type="button"
          >
            <Star
              className={favorite ? "fill-[var(--gc-brand)] text-[var(--gc-brand)]" : ""}
              size={16}
            />
          </button>
        ) : null}
        <button
          aria-label={`${t("workoutCatalog.addToWorkout")}: ${localized.name}`}
          className="gc-pressable grid size-10 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)] text-black"
          onClick={() => onSelect(exercise)}
          type="button"
        >
          <Plus size={18} strokeWidth={3} />
        </button>
      </article>
    );
  }

  return (
    <>
      <div
        aria-label={t("workoutCatalog.chooseExercise")}
        aria-modal="true"
        className="fixed inset-0 z-[108] flex touch-pan-y justify-center overflow-x-hidden overflow-y-auto overscroll-x-none bg-black/94 backdrop-blur-md"
        role="dialog"
      >
        <div className="flex min-h-full w-full min-w-0 max-w-[480px] flex-col overflow-x-hidden px-5 pb-[calc(var(--gc-safe-bottom)+24px)] pt-[calc(var(--gc-safe-top)+12px)]">
        <header className="flex min-w-0 items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[19px] font-black text-white">
              {t("workoutCatalog.chooseExercise")}
            </p>
            <p className="mt-0.5 text-[11px] font-bold text-white/40">
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

        <div className="relative -mx-5 mt-3 max-w-[calc(100%+2.5rem)] overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-7 bg-gradient-to-r from-black to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-7 bg-gradient-to-l from-black to-transparent" />
          <div className="gc-scrollbar flex min-h-9 w-full max-w-full shrink-0 items-center gap-1.5 overflow-x-auto px-5 py-1">
          <button
            aria-pressed={group === ALL_WORKOUT_GROUPS}
            ref={(node) => {
              if (node) groupButtonRefs.current.set(ALL_WORKOUT_GROUPS, node);
            }}
            className={[
              "gc-pressable inline-flex h-9 shrink-0 items-center justify-center rounded-full px-3.5 text-[11px] font-black leading-none transition-colors duration-200",
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
              ref={(node) => {
                if (node) groupButtonRefs.current.set(item.slug, node);
              }}
              className={[
                "gc-pressable inline-flex h-9 shrink-0 items-center justify-center rounded-full px-3.5 text-[11px] font-black leading-none transition-colors duration-200",
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
        </div>

        <label className="mt-3 flex w-full min-w-0 shrink-0 items-center gap-2 rounded-[14px] bg-white/[0.06] px-3.5">
          <Search className="text-white/35" size={17} />
          <input
            aria-label={t("workoutCatalog.search")}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] font-semibold text-white outline-none placeholder:text-white/30"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("workoutCatalog.search")}
            value={query}
          />
        </label>

        <div className="mt-2.5 flex w-full min-w-0 max-w-full items-center gap-1.5 overflow-x-auto">
          {(["all", "recent", "favorites"] as const).map((item) => (
            <button
              aria-pressed={quickFilter === item}
              className={[
                "gc-pressable inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[10.5px] font-black",
                quickFilter === item
                  ? "bg-white text-black"
                  : "bg-white/[0.055] text-white/48",
              ].join(" ")}
              key={item}
              onClick={() => setQuickFilter(item)}
              type="button"
            >
              {item === "recent" ? <Clock3 size={13} /> : null}
              {item === "favorites" ? <Star size={13} /> : null}
              {t(`workoutCatalog.quickFilters.${item}`)}
            </button>
          ))}
          <button
            className={[
              "gc-pressable ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[10.5px] font-black",
              activeFilterCount > 0
                ? "bg-[var(--gc-brand)] text-black"
                : "bg-white/[0.055] text-white/55",
            ].join(" ")}
            onClick={() => setFiltersOpen(true)}
            type="button"
          >
            <SlidersHorizontal size={14} />
            {t("workoutCatalog.filters")}
            {activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
          </button>
        </div>

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

        <div className="mt-3 grid min-w-0 max-w-full gap-2 overflow-x-hidden">
          {loading && exercises.length === 0
            ? Array.from({ length: 5 }, (_, index) => (
                <div
                  aria-hidden="true"
                  className="h-[68px] animate-pulse rounded-[16px] bg-white/[0.045]"
                  key={index}
                />
              ))
            : null}
          {!loading && recentSection.length > 0 ? (
            <section className="mb-1 min-w-0 max-w-full overflow-hidden">
              <p className="mb-2 text-[9.5px] font-black uppercase tracking-[0.14em] text-white/36">
                {t("workoutCatalog.usedRecently")}
              </p>
              <div className="gc-scrollbar -mx-5 flex max-w-[calc(100%+2.5rem)] gap-2 overflow-x-auto px-5">
                {recentSection.map((exercise) =>
                  exerciseRow(exercise, { compact: true }),
                )}
              </div>
            </section>
          ) : null}
          {!loading && displayedPrimary.length > 0 ? (
            <section className="grid min-w-0 max-w-full gap-2 overflow-hidden">
              <p className="mt-1 text-[9.5px] font-black uppercase tracking-[0.14em] text-white/36">
                {query.trim()
                  ? t("workoutCatalog.results")
                  : group === ALL_WORKOUT_GROUPS
                    ? t("workoutCatalog.exercises")
                    : t("workoutCatalog.primaryFocus")}
              </p>
              {displayedPrimary.map((item) => exerciseRow(item.exercise))}
            </section>
          ) : null}
          {!loading && sections.secondary.length > 0 ? (
            <section className="mt-3 grid min-w-0 max-w-full gap-2 overflow-hidden border-t border-white/[0.07] pt-4">
              <p className="text-[9.5px] font-black uppercase tracking-[0.14em] text-white/36">
                {t("workoutCatalog.alsoWorks")}
              </p>
              {sections.secondary.map((item) => exerciseRow(item.exercise))}
            </section>
          ) : null}
          {!loading && !error && visibleCount === 0 ? (
            <p className="py-12 text-center text-[13px] font-semibold text-white/42">
              {quickFilter === "favorites"
                ? t("workoutCatalog.emptyFavorites")
                : quickFilter === "recent"
                  ? t("workoutCatalog.emptyRecent")
                  : t("workoutCatalog.emptyGroup")}
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
      {filtersOpen ? (
        <div
          aria-label={t("workoutCatalog.filters")}
          aria-modal="true"
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/72 backdrop-blur-sm"
          role="dialog"
        >
          <button
            aria-label={t("common.close")}
            className="absolute inset-0 cursor-default"
            onClick={() => setFiltersOpen(false)}
            type="button"
          />
          <div className="relative max-h-[82dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] border-t border-white/[0.08] bg-[#0b0d0e] px-5 pb-[calc(var(--gc-safe-bottom)+18px)] pt-4 shadow-2xl">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-[17px] font-black text-white">
                  {t("workoutCatalog.filters")}
                </p>
                <p className="text-[10.5px] font-semibold text-white/38">
                  {t("workoutCatalog.filtersHint")}
                </p>
              </div>
              <button
                aria-label={t("common.close")}
                className="gc-pressable grid size-10 place-items-center rounded-full bg-white/[0.06] text-white/55"
                onClick={() => setFiltersOpen(false)}
                type="button"
              >
                <X size={16} />
              </button>
            </header>

            {[
              {
                key: "equipment" as const,
                label: t("workoutCatalog.equipment"),
                options: equipmentOptions,
              },
              {
                key: "loadType" as const,
                label: t("workoutCatalog.loadType"),
                options: filterOptions.loadTypes,
              },
              {
                key: "difficulty" as const,
                label: t("workoutCatalog.difficulty"),
                options: filterOptions.difficulties,
              },
              {
                key: "movementPattern" as const,
                label: t("workoutCatalog.movement"),
                options: filterOptions.movementPatterns,
              },
              {
                key: "exerciseType" as const,
                label: t("workoutCatalog.exerciseType"),
                options: filterOptions.exerciseTypes,
              },
            ].map((section) =>
              section.options.length > 0 ? (
                <section className="mt-5" key={section.key}>
                  <p className="text-[9.5px] font-black uppercase tracking-[0.14em] text-white/38">
                    {section.label}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {section.options.map((value) => {
                      const active = filters[section.key] === value;
                      return (
                        <button
                          aria-pressed={active}
                          className={[
                            "gc-pressable min-h-9 rounded-full px-3 text-[10.5px] font-black",
                            active
                              ? "bg-[var(--gc-brand)] text-black"
                              : "bg-white/[0.06] text-white/50",
                          ].join(" ")}
                          key={value}
                          onClick={() =>
                            setFilters((current) => ({
                              ...current,
                              [section.key]: active ? null : value,
                            }))
                          }
                          type="button"
                        >
                          {section.key === "equipment"
                            ? workoutEquipmentLabel(value, english)
                            : filterValueLabel(section.key, value)}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null,
            )}

            <div className="sticky bottom-0 mt-6 grid grid-cols-2 gap-2 bg-[#0b0d0e] pt-2">
              <button
                className="gc-pressable h-12 rounded-full bg-white/[0.06] text-[12px] font-black text-white/60"
                onClick={() => setFilters({})}
                type="button"
              >
                {t("workoutCatalog.clearFilters")}
              </button>
              <button
                className="gc-pressable h-12 rounded-full bg-[var(--gc-brand)] text-[12px] font-black text-black"
                onClick={() => setFiltersOpen(false)}
                type="button"
              >
                {t("workoutCatalog.showResults", { count: visibleCount })}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

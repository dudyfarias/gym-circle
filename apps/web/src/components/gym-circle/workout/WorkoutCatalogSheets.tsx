"use client";

import { useMemo, useState } from "react";
import {
  Dumbbell,
  ExternalLink,
  Info,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  WorkoutExerciseCatalogItem,
  WorkoutMuscleGroup,
  WorkoutTechniqueCatalogItem,
} from "../social/types";
import { normalizeWorkoutCatalogText } from "./useWorkoutCatalog";

export type WorkoutCatalogInfo = {
  kind: "exercise" | "technique";
  title: string;
  eyebrow?: string | null;
  summary: string;
  instructions: string[];
  videoUrl: string | null;
  videoSearchQuery: string | null;
};

export function exerciseCatalogInfo(
  exercise: WorkoutExerciseCatalogItem,
  language: string,
  muscleGroupName?: string | null,
): WorkoutCatalogInfo {
  const english = language.toLowerCase().startsWith("en");
  return {
    kind: "exercise",
    title: english ? exercise.nameEn : exercise.namePt,
    eyebrow: muscleGroupName ?? null,
    summary: english ? exercise.descriptionEn : exercise.descriptionPt,
    instructions: english ? exercise.instructionsEn : exercise.instructionsPt,
    videoUrl: exercise.videoUrl,
    videoSearchQuery: exercise.videoSearchQuery,
  };
}

export function techniqueCatalogInfo(
  technique: WorkoutTechniqueCatalogItem,
  language: string,
): WorkoutCatalogInfo {
  const english = language.toLowerCase().startsWith("en");
  return {
    kind: "technique",
    title: english ? technique.nameEn : technique.namePt,
    eyebrow: null,
    summary: english ? technique.summaryEn : technique.summaryPt,
    instructions: english
      ? technique.instructionsEn
      : technique.instructionsPt,
    videoUrl: technique.videoUrl,
    videoSearchQuery: technique.videoSearchQuery,
  };
}

export function WorkoutCatalogInfoSheet({
  info,
  onClose,
}: {
  info: WorkoutCatalogInfo;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const videoHref =
    info.videoUrl ||
    (info.videoSearchQuery
      ? `https://www.youtube.com/results?search_query=${encodeURIComponent(
          info.videoSearchQuery,
        )}`
      : null);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/76 px-3 backdrop-blur-md"
      role="dialog"
    >
      <div className="w-full max-w-[480px] rounded-t-[28px] border-t border-white/[0.09] bg-[#0b0d0e] px-5 pb-[calc(var(--gc-safe-bottom)+24px)] pt-4">
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
          </div>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white/70"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </header>

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

        {videoHref ? (
          <a
            className="gc-pressable mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] py-3.5 text-[14px] font-black text-black"
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
}: {
  muscleGroups: WorkoutMuscleGroup[];
  exercises: WorkoutExerciseCatalogItem[];
  onSelect: (exercise: WorkoutExerciseCatalogItem) => void;
  onClose: () => void;
}) {
  const { i18n, t } = useTranslation();
  const [group, setGroup] = useState(muscleGroups[0]?.slug ?? "shoulders");
  const [query, setQuery] = useState("");
  const english = i18n.language.toLowerCase().startsWith("en");
  const visible = useMemo(() => {
    const normalizedQuery = normalizeWorkoutCatalogText(query);
    return exercises.filter((exercise) => {
      const inGroup =
        exercise.primaryMuscleGroupSlug === group ||
        exercise.secondaryMuscleGroupSlugs.includes(group);
      if (!inGroup) return false;
      if (!normalizedQuery) return true;
      return [exercise.namePt, exercise.nameEn, ...exercise.aliases].some(
        (value) =>
          normalizeWorkoutCatalogText(value).includes(normalizedQuery),
      );
    });
  }, [exercises, group, query]);

  return (
    <div className="fixed inset-0 z-[108] flex justify-center overflow-y-auto bg-black/94 backdrop-blur-md">
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
            className="gc-pressable grid size-9 place-items-center rounded-full bg-white/[0.07] text-white/70"
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
          {muscleGroups.map((item) => (
            <button
              className={[
                "gc-pressable inline-flex h-9 shrink-0 items-center justify-center rounded-full px-3.5 text-[12px] font-black leading-none",
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
            className="min-w-0 flex-1 bg-transparent py-3 text-[14px] font-semibold text-white outline-none placeholder:text-white/30"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("workoutCatalog.search")}
            value={query}
          />
        </label>

        <div className="mt-4 grid gap-2">
          {visible.map((exercise) => (
            <button
              className="gc-pressable flex items-center gap-3 rounded-[18px] bg-white/[0.045] px-4 py-3.5 text-left"
              key={exercise.id}
              onClick={() => onSelect(exercise)}
              type="button"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-[#97ff00]/10 text-[#97ff00]">
                <Dumbbell size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-black text-white">
                  {english ? exercise.nameEn : exercise.namePt}
                </span>
                <span className="mt-0.5 line-clamp-1 block text-[10.5px] font-semibold text-white/38">
                  {english ? exercise.descriptionEn : exercise.descriptionPt}
                </span>
              </span>
              <Plus className="text-[var(--gc-brand)]" size={18} />
            </button>
          ))}
          {visible.length === 0 ? (
            <p className="py-12 text-center text-[13px] font-semibold text-white/42">
              {t("workoutCatalog.emptyGroup")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

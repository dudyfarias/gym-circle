"use client";

import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LiveStrengthSet } from "./workoutSession";

type WorkoutSetAdvancedFieldsProps = {
  onPatch: (patch: Partial<LiveStrengthSet>) => void;
  set: LiveStrengthSet;
  setNumber: number;
};

function optionalNumber(raw: string, minimum: number, maximum: number) {
  if (!raw.trim()) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value >= minimum && value <= maximum
    ? value
    : null;
}

export function WorkoutSetAdvancedFields({
  onPatch,
  set,
  setNumber,
}: WorkoutSetAdvancedFieldsProps) {
  const { t } = useTranslation();
  return (
    <details className="group px-1">
      <summary
        aria-label={t("workout.sets.advancedForSet", { number: setNumber })}
        className="gc-pressable flex min-h-7 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-1 text-[10px] font-black text-white/38"
      >
        <span className="flex items-center gap-1.5">
          <SlidersHorizontal size={12} />
          {t("workout.sets.details")}
        </span>
        <span className="flex min-w-0 items-center justify-end gap-1 overflow-hidden">
          {set.rpe != null ? (
            <span className="rounded-full bg-white/[0.055] px-1.5 py-0.5 text-[8.5px] text-white/52">
              RPE {set.rpe}
            </span>
          ) : null}
          {set.rir != null ? (
            <span className="rounded-full bg-white/[0.055] px-1.5 py-0.5 text-[8.5px] text-white/52">
              RIR {set.rir}
            </span>
          ) : null}
          {set.targetRestS != null ? (
            <span className="rounded-full bg-white/[0.055] px-1.5 py-0.5 text-[8.5px] text-white/52">
              {set.targetRestS}s
            </span>
          ) : null}
          {set.note ? (
            <span className="rounded-full bg-white/[0.055] px-1.5 py-0.5 text-[8.5px] text-white/52">
              {t("workout.sets.hasNote")}
            </span>
          ) : null}
        </span>
      </summary>
      <div className="mt-1 rounded-[14px] border border-white/[0.045] bg-black/20 p-3">
        <div className="grid grid-cols-3 gap-2">
        <label className="min-w-0">
            <span className="text-[9px] font-black uppercase text-white/35">
              RPE
            </span>
          <input
            className="mt-1 w-full rounded-xl bg-white/[0.07] px-2 py-2 text-center text-[13px] font-black text-white outline-none"
            inputMode="decimal"
            max="10"
            min="1"
            onChange={(event) =>
              onPatch({ rpe: optionalNumber(event.target.value, 1, 10) })
            }
            placeholder="—"
            value={set.rpe ?? ""}
          />
        </label>
        <label className="min-w-0">
            <span className="text-[9px] font-black uppercase text-white/35">
              RIR
            </span>
          <input
            className="mt-1 w-full rounded-xl bg-white/[0.07] px-2 py-2 text-center text-[13px] font-black text-white outline-none"
            inputMode="numeric"
            max="10"
            min="0"
            onChange={(event) =>
              onPatch({ rir: optionalNumber(event.target.value, 0, 10) })
            }
            placeholder="—"
            value={set.rir ?? ""}
          />
        </label>
        <label className="min-w-0">
          <span className="text-[9px] font-black uppercase text-white/35">
            {t("workout.sets.restSeconds")}
          </span>
          <input
            className="mt-1 w-full rounded-xl bg-white/[0.07] px-2 py-2 text-center text-[13px] font-black text-white outline-none"
            inputMode="numeric"
            max="3600"
            min="0"
            onChange={(event) =>
              onPatch({
                targetRestS: optionalNumber(event.target.value, 0, 3600),
              })
            }
            placeholder="60"
            value={set.targetRestS ?? ""}
          />
        </label>
      </div>
      <label className="mt-2 block">
        <span className="text-[9px] font-black uppercase text-white/35">
          {t("workout.sets.note")}
        </span>
        <textarea
          className="mt-1 min-h-16 w-full resize-none rounded-xl bg-white/[0.07] px-3 py-2 text-[12px] font-semibold text-white outline-none placeholder:text-white/25"
          maxLength={280}
          onChange={(event) => onPatch({ note: event.target.value || null })}
          placeholder={t("workout.sets.notePlaceholder")}
          value={set.note ?? ""}
        />
      </label>
      <p className="mt-2 text-[9.5px] font-semibold leading-snug text-white/28">
        {t("workout.sets.effortHint")}
      </p>
      </div>
    </details>
  );
}

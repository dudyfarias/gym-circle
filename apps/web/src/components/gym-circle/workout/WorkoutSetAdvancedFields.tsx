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
    <details className="rounded-[14px] border border-white/[0.045] bg-black/20 px-3 py-2">
      <summary className="gc-pressable flex cursor-pointer list-none items-center gap-2 text-[10.5px] font-black text-white/45">
        <SlidersHorizontal size={13} />
        {t("workout.sets.advancedForSet", { number: setNumber })}
      </summary>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <label className="min-w-0">
          <span className="text-[9px] font-black uppercase text-white/35">RPE</span>
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
          <span className="text-[9px] font-black uppercase text-white/35">RIR</span>
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
    </details>
  );
}

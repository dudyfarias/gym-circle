"use client";

import { useState } from "react";
import { ChevronRight, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PersonalRecordsSheet } from "./PersonalRecordsSheet";

export function PersonalRecordsLauncher() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="gc-pressable mt-3 flex w-full items-center gap-3 rounded-[18px] border border-[var(--gc-brand)]/12 bg-[var(--gc-brand)]/[0.055] px-4 py-3 text-left"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
          <Trophy size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-black text-white">
            {t("personalRecords.title")}
          </span>
          <span className="mt-0.5 block truncate text-[11px] font-bold text-white/42">
            {t("personalRecords.subtitle")}
          </span>
        </span>
        <ChevronRight className="text-white/30" size={17} />
      </button>
      {open ? <PersonalRecordsSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

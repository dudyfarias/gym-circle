"use client";

import { Calendar, CalendarRange, Check, X } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { simulateHaptic } from "./social/haptics";
import {
  getRecapPeriodKey,
  getRecapPeriodOptions,
  type RecapPeriod,
} from "./social/monthlyRecap";

/**
 * Sprint 5.10 — RecapPeriodPickerSheet.
 *
 * Sheet bottom compacto (max 70dvh) com lista vertical de períodos
 * selecionáveis pro recap social:
 *
 *   - Mês corrente (destaque)
 *   - 5 meses anteriores
 *   - Ano corrente ("2026 (ano todo)") — separado com divisor visual
 *
 * Tap em um item → fecha picker + dispara onSelect(period). Parent
 * usa o period escolhido pra:
 *   1. rodar `buildMonthlyRecap({ period })` novamente
 *   2. abrir o MonthlyRecapSheet com os dados do período
 *
 * Sem state interno de saving — período é só seleção UI, persistência
 * acontece no parent (e nada precisa ser salvo só por mudar de período).
 */

type RecapPeriodPickerSheetProps = {
  open: boolean;
  /** Período atualmente exibido no recap (highlight). */
  currentPeriod: RecapPeriod;
  /** Now pra gerar lista (default = new Date()). */
  now?: Date;
  onSelect: (period: RecapPeriod) => void;
  onClose: () => void;
};

export function RecapPeriodPickerSheet({
  open,
  currentPeriod,
  now,
  onSelect,
  onClose,
}: RecapPeriodPickerSheetProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const periods = useMemo(
    () => getRecapPeriodOptions(now ?? new Date(), { months: 6 }),
    [now],
  );

  const currentKey = getRecapPeriodKey(currentPeriod);

  if (!open) return null;

  function handlePick(period: RecapPeriod) {
    simulateHaptic("brand");
    onSelect(period);
    onClose();
  }

  return (
    <div
      aria-hidden={!open}
      className={[
        "absolute inset-0 z-[70] transition-opacity duration-200",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      ].join(" ")}
    >
      <button
        aria-label={t("common.close")}
        className="absolute inset-0 bg-black/68 backdrop-blur-xl"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        type="button"
      />

      <div
        className={[
          "absolute inset-x-0 bottom-0 mx-auto flex max-w-[480px] flex-col overflow-hidden rounded-t-[32px] border-t border-white/[0.08] bg-[#0a0b0c] shadow-[0_-24px_72px_rgba(0,0,0,0.6)] transition-transform duration-300",
          open ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
        style={{ height: "min(70dvh, 640px)" }}
      >
        {/* Handle bar */}
        <div className="flex shrink-0 justify-center pb-1.5 pt-2.5">
          <div className="h-1 w-9 rounded-full bg-white/[0.18]" />
        </div>

        {/* Header */}
        <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-5 pb-3 pt-1">
          <div />
          <h2 className="text-center text-[15px] font-black text-white">
            {t("recapPeriodPicker.title")}
          </h2>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-9 justify-self-end place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </header>

        <div className="h-px shrink-0 bg-white/[0.06]" />

        <div className="gc-scrollbar flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-3 text-[12px] font-bold text-white/52">
            {t("recapPeriodPicker.subtitle")}
          </p>

          <ul className="flex flex-col gap-1.5">
            {periods.map((period) => {
              const key = getRecapPeriodKey(period);
              const isSelected = key === currentKey;
              const isYear = period.kind === "year";
              const label = formatPeriodLabel(period, locale);

              return (
                <li key={key}>
                  {isYear ? (
                    // Divisor visual antes do item "ano inteiro"
                    <div
                      aria-hidden
                      className="my-2 h-px bg-white/[0.06]"
                    />
                  ) : null}
                  <button
                    aria-label={label}
                    aria-pressed={isSelected}
                    className={[
                      "gc-pressable flex w-full items-center gap-3 rounded-[16px] px-4 py-3 text-left transition-colors",
                      isSelected
                        ? "bg-[var(--gc-brand)]/12 ring-1 ring-[var(--gc-brand)]/32"
                        : "bg-white/[0.04]",
                    ].join(" ")}
                    onClick={() => handlePick(period)}
                    type="button"
                  >
                    <span
                      className={[
                        "grid size-9 shrink-0 place-items-center rounded-[12px]",
                        isSelected
                          ? "bg-[var(--gc-brand)]/22 text-[var(--gc-brand)]"
                          : "bg-white/[0.06] text-white/64",
                      ].join(" ")}
                    >
                      {isYear ? (
                        <CalendarRange size={17} strokeWidth={2.4} />
                      ) : (
                        <Calendar size={17} strokeWidth={2.4} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={[
                          "block truncate text-[14px] font-black capitalize",
                          isSelected ? "text-white" : "text-white/82",
                        ].join(" ")}
                      >
                        {label}
                      </span>
                      {isYear ? (
                        <span className="mt-0.5 block text-[11px] font-bold text-white/52">
                          {t("recapPeriodPicker.yearHint")}
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? (
                      <Check
                        className="shrink-0 text-[var(--gc-brand)]"
                        size={16}
                        strokeWidth={2.6}
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Formata o label do período pro picker.
 *
 *   month → "maio de 2026" (PT-BR) ou "May 2026" (EN)
 *   year  → "2026" (ambos locales)
 */
function formatPeriodLabel(period: RecapPeriod, locale: string): string {
  if (period.kind === "year") return String(period.year);
  // Anchor day 15 UTC midday pra evitar timezone drift.
  const date = new Date(Date.UTC(period.year, period.month - 1, 15, 12));
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(date);
}

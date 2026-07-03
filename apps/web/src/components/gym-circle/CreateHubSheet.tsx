"use client";

import { ArrowRight, Camera, MapPin, Timer, X } from "lucide-react";
import { useTranslation } from "react-i18next";

type CreateHubSheetProps = {
  open: boolean;
  onClose: () => void;
  onStartWorkout: () => void;
  onPostWorkout: () => void;
  onCheckIn: () => void;
};

/**
 * Rastreio de treino (Fase 1) — hub do botão "+" central: junta iniciar
 * treino, postar treino (composer) e check-in num lugar só. Mesmo padrão
 * de bottom-sheet dos overlays (LikesOverlay/FollowListOverlay).
 */
export function CreateHubSheet({
  open,
  onClose,
  onStartWorkout,
  onPostWorkout,
  onCheckIn,
}: CreateHubSheetProps) {
  const { t } = useTranslation();
  if (!open) return null;

  const rows = [
    {
      key: "start",
      icon: <Timer size={22} />,
      title: t("createHub.startWorkout.title"),
      detail: t("createHub.startWorkout.detail"),
      onClick: onStartWorkout,
    },
    {
      key: "post",
      icon: <Camera size={22} />,
      title: t("createHub.postWorkout.title"),
      detail: t("createHub.postWorkout.detail"),
      onClick: onPostWorkout,
    },
    {
      key: "checkin",
      icon: <MapPin size={22} />,
      title: t("createHub.checkIn.title"),
      detail: t("createHub.checkIn.detail"),
      onClick: onCheckIn,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[94] flex items-end justify-center bg-black/66 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={t("createHub.title")}
    >
      <button
        aria-label={t("common.close")}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <section className="gc-screen-enter relative w-full max-w-[480px] rounded-t-[32px] border border-white/[0.09] bg-[#090a0b]/98 px-5 pb-[calc(var(--gc-safe-bottom)+20px)] pt-3 shadow-[0_-28px_90px_rgba(0,0,0,0.72)]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/18" />
        <header className="flex items-start justify-between gap-4 pb-5">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--gc-brand)]">
              {t("createHub.title")}
            </p>
            <h2 className="mt-1 text-[23px] font-black leading-tight text-white">
              {t("createHub.question")}
            </h2>
            <p className="mt-1 max-w-[300px] text-[13px] font-semibold leading-snug text-white/48">
              {t("createHub.subtitle")}
            </p>
          </div>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.055] text-white/82"
            onClick={onClose}
            type="button"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        </header>

        <button
          className="gc-pressable flex w-full items-center gap-3.5 rounded-[24px] border border-[var(--gc-brand)]/28 bg-[var(--gc-brand)]/[0.09] p-4 text-left shadow-[0_16px_40px_rgba(48,213,255,0.08)]"
          onClick={rows[0].onClick}
          type="button"
        >
          <span className="grid size-13 shrink-0 place-items-center rounded-[17px] bg-[var(--gc-brand)] text-[var(--gc-brand-ink)] shadow-[0_0_24px_rgba(92,232,255,0.2)]">
            {rows[0].icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[17px] font-black text-white">
              {rows[0].title}
            </span>
            <span className="mt-0.5 block truncate text-[12.5px] font-bold text-white/50">
              {rows[0].detail}
            </span>
          </span>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)] text-[var(--gc-brand-ink)]">
            <ArrowRight size={17} strokeWidth={2.6} />
          </span>
        </button>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {rows.slice(1).map((row) => (
            <button
              className="gc-pressable flex min-h-[132px] flex-col items-start rounded-[22px] border border-white/[0.08] bg-white/[0.035] p-4 text-left"
              key={row.key}
              onClick={row.onClick}
              type="button"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-white/[0.07] text-white/88">
                {row.icon}
              </span>
              <span className="mt-auto min-w-0 pt-4">
                <span className="block text-[15px] font-black leading-tight text-white">
                  {row.title}
                </span>
                <span className="mt-1 block text-[11.5px] font-bold leading-snug text-white/44">
                  {row.detail}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

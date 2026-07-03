"use client";

import { Camera, ChevronRight, MapPin, Timer, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconButton } from "../ui/IconButton";

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
      iconClass: "bg-[var(--gc-blue)]/12 text-[var(--gc-blue)]",
      title: t("createHub.startWorkout.title"),
      detail: t("createHub.startWorkout.detail"),
      onClick: onStartWorkout,
    },
    {
      key: "post",
      icon: <Camera size={22} />,
      iconClass: "bg-white/[0.06] text-white",
      title: t("createHub.postWorkout.title"),
      detail: t("createHub.postWorkout.detail"),
      onClick: onPostWorkout,
    },
    {
      key: "checkin",
      icon: <MapPin size={22} />,
      iconClass: "bg-[#ff9f0a]/12 text-[#ff9f0a]",
      title: t("createHub.checkIn.title"),
      detail: t("createHub.checkIn.detail"),
      onClick: onCheckIn,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[94] flex items-end justify-center bg-black/54 backdrop-blur-[10px]"
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
      <section className="gc-screen-enter relative w-full max-w-[480px] rounded-t-[32px] border border-white/[0.08] bg-[#0b0c0d]/96 px-4 pb-[calc(var(--gc-safe-bottom)+18px)] pt-3 shadow-[0_-28px_90px_rgba(0,0,0,0.62)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/18" />
        <header className="flex items-center justify-between px-2 pb-1">
          <h2 className="text-[13px] font-black uppercase tracking-[0.12em] text-white/44">
            {t("createHub.title")}
          </h2>
          <IconButton label={t("common.close")} onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div>
          {rows.map((row, index) => (
            <button
              className={[
                "gc-pressable flex w-full items-center gap-3.5 rounded-2xl px-2 py-3.5 text-left",
                index > 0 ? "border-t border-white/[0.06]" : "",
              ].join(" ")}
              key={row.key}
              onClick={row.onClick}
              type="button"
            >
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-[14px] ${row.iconClass}`}
              >
                {row.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-black text-white">{row.title}</span>
                <span className="block text-[12.5px] font-bold text-white/42">{row.detail}</span>
              </span>
              <ChevronRight className="text-white/30" size={18} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

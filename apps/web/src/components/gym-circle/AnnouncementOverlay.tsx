"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import { BrandMark } from "./design-system/BrandMark";
import {
  ANNOUNCEMENTS,
  selectPendingAnnouncement,
} from "./social/announcements";

type AnnouncementOverlayProps = {
  currentUserId: string | null | undefined;
  /** `profiles.contextual_hints_seen`. undefined = ainda carregando. */
  seen: Record<string, string> | undefined;
};

/**
 * Comunicado pontual, mostrado uma vez por pessoa ao abrir o app.
 *
 * O "já vi" é persistido no banco (contextual_hints_seen), então vale entre
 * aparelhos. A marcação é otimista: fechamos na hora e gravamos em seguida —
 * se a gravação falhar, o comunicado reaparece na próxima abertura, que é o
 * erro menos ruim (melhor repetir do que sumir sem ser lido).
 */
export function AnnouncementOverlay({
  currentUserId,
  seen,
}: AnnouncementOverlayProps) {
  const { t } = useTranslation();
  const services = useGymCircleServices();
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const pending = selectPendingAnnouncement(ANNOUNCEMENTS, seen);
  const announcement =
    pending && pending.id !== dismissedId ? pending : null;

  const dismiss = useCallback(() => {
    if (!announcement || !currentUserId) return;
    setDismissedId(announcement.id);
    void services.profiles
      .markContextualHintSeen(currentUserId, announcement.id)
      .catch(() => {
        // Best-effort: reaparece na próxima abertura.
      });
  }, [announcement, currentUserId, services.profiles]);

  // Esc fecha, como em qualquer diálogo.
  useEffect(() => {
    if (!announcement) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [announcement, dismiss]);

  if (!announcement || !currentUserId) return null;

  return (
    <div
      aria-labelledby="gc-announcement-title"
      aria-modal="true"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/76 px-5 backdrop-blur-md"
      role="dialog"
    >
      <div className="relative w-full max-w-[380px] rounded-[26px] border border-white/[0.08] bg-[#0d1012] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <button
          aria-label={t("common.close")}
          className="gc-pressable absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/[0.06] text-white/70"
          onClick={dismiss}
          type="button"
        >
          <X size={17} />
        </button>

        <BrandMark size={26} />

        <h2
          className="mt-4 pr-10 text-[19px] font-black leading-tight text-white"
          id="gc-announcement-title"
        >
          {t(announcement.titleKey)}
        </h2>

        <p className="mt-3 text-[13.5px] font-semibold leading-relaxed text-white/64">
          {t(announcement.bodyKey)}
        </p>

        <button
          className="gc-pressable mt-6 h-12 w-full rounded-full bg-[var(--gc-brand)] text-[13px] font-black text-[var(--gc-brand-ink)]"
          onClick={dismiss}
          type="button"
        >
          {t("announcements.gotIt")}
        </button>
      </div>
    </div>
  );
}

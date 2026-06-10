"use client";

import { X } from "lucide-react";

export function LegalPageBackButton() {
  function handleClose() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign("/");
  }

  return (
    <button
      aria-label="Fechar"
      className="gc-pressable grid size-11 place-items-center rounded-full border border-white/[0.08] bg-white/[0.06] text-white/82"
      onClick={handleClose}
      type="button"
    >
      <X size={19} strokeWidth={2.6} />
    </button>
  );
}

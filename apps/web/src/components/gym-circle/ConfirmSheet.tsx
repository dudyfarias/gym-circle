"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

type ConfirmTone = "destructive" | "default";

type ConfirmSheetProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** "destructive" pinta o botão de Pink. "default" usa branco. */
  tone?: ConfirmTone;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

/**
 * Bottom sheet de confirmação no estilo iOS/Instagram. Substitui
 * window.confirm() — esse último mostra um diálogo nativo do WKWebView
 * que parece web fora do app e quebra a sensação de nativo.
 *
 * Apple Review nota a diferença. Plus, a gente ganha estilo consistente
 * com PostMenuSheet, EditPostSheet, etc.
 */
export function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  tone = "default",
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const confirmClass =
    tone === "destructive"
      ? "text-[var(--gc-pink)]"
      : "text-white";

  return (
    <div className="absolute inset-0 z-[60] flex flex-col justify-end bg-black/72 px-4 pb-[calc(var(--gc-safe-bottom)+1rem)] pt-[calc(var(--gc-safe-top)+5rem)] backdrop-blur-md">
      <button
        aria-label="Fechar"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div className="relative space-y-2">
        <div className="overflow-hidden rounded-[24px] border border-white/[0.1] bg-[#16181b] shadow-[0_28px_72px_rgba(0,0,0,0.6)]">
          <div className="border-b border-white/[0.06] px-6 py-5">
            <div className="flex items-start gap-3">
              {tone === "destructive" ? (
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--gc-pink)]/14 text-[var(--gc-pink)]">
                  <AlertTriangle size={18} strokeWidth={2.6} />
                </span>
              ) : null}
              <div className="space-y-1">
                <p className="text-[16px] font-black text-white">{title}</p>
                {description ? (
                  <p className="text-[13px] font-bold text-white/68">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <button
            className={`gc-pressable flex h-14 w-full items-center justify-center text-[15px] font-black ${confirmClass}`}
            onClick={() => {
              void onConfirm();
            }}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
        <button
          className="gc-pressable flex h-14 w-full items-center justify-center rounded-[24px] border border-white/[0.1] bg-black/72 text-[15px] font-black text-white backdrop-blur-2xl"
          onClick={onClose}
          type="button"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}

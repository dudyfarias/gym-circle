"use client";

import { useEffect } from "react";
import { Ban, Flag, Pencil, Trash2, VolumeX } from "lucide-react";

type PostMenuSheetProps = {
  open: boolean;
  isOwner: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  onBlock?: () => void;
  /** Silencia posts desse autor sem deixar de seguir nem bloquear. */
  onMute?: () => void;
};

/**
 * Action sheet estilo iOS — slide do bottom com 2 ações + cancelar.
 * Aparece quando o dono do post toca no botão de 3 pontos da SocialPostCard.
 */
export function PostMenuSheet({
  open,
  isOwner,
  onClose,
  onEdit,
  onDelete,
  onReport,
  onBlock,
  onMute,
}: PostMenuSheetProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[55] flex flex-col justify-end bg-black/72 px-4 pb-[calc(var(--gc-safe-bottom)+1rem)] pt-[calc(var(--gc-safe-top)+5rem)] backdrop-blur-md">
      <button
        aria-label="Fechar"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div className="relative space-y-2">
        <div className="overflow-hidden rounded-[24px] border border-white/[0.1] bg-[#16181b] shadow-[0_28px_72px_rgba(0,0,0,0.6)]">
          {isOwner ? (
            <>
              <button
                className="gc-pressable flex h-14 w-full items-center justify-center gap-2 border-b border-white/[0.06] text-[15px] font-black text-white"
                onClick={onEdit}
                type="button"
              >
                <Pencil size={17} strokeWidth={2.6} />
                Editar legenda e tipo
              </button>
              <button
                className="gc-pressable flex h-14 w-full items-center justify-center gap-2 text-[15px] font-black text-[var(--gc-pink)]"
                onClick={onDelete}
                type="button"
              >
                <Trash2 size={17} strokeWidth={2.6} />
                Apagar post
              </button>
            </>
          ) : (
            <>
              <button
                className="gc-pressable flex h-14 w-full items-center justify-center gap-2 border-b border-white/[0.06] text-[15px] font-black text-white"
                onClick={onMute}
                type="button"
              >
                <VolumeX size={17} strokeWidth={2.6} />
                Silenciar usuário
              </button>
              <button
                className="gc-pressable flex h-14 w-full items-center justify-center gap-2 border-b border-white/[0.06] text-[15px] font-black text-white"
                onClick={onReport}
                type="button"
              >
                <Flag size={17} strokeWidth={2.6} />
                Denunciar post
              </button>
              <button
                className="gc-pressable flex h-14 w-full items-center justify-center gap-2 text-[15px] font-black text-[var(--gc-pink)]"
                onClick={onBlock}
                type="button"
              >
                <Ban size={17} strokeWidth={2.6} />
                Bloquear usuário
              </button>
            </>
          )}
        </div>
        <button
          className="gc-pressable flex h-14 w-full items-center justify-center rounded-[24px] border border-white/[0.1] bg-black/72 text-[15px] font-black text-white backdrop-blur-2xl"
          onClick={onClose}
          type="button"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

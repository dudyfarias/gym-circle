"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import type { EditPostInput, EnrichedPost } from "./social/types";

type EditPostSheetProps = {
  open: boolean;
  post: EnrichedPost | null;
  onClose: () => void;
  onSave: (postId: string, input: EditPostInput) => Promise<void>;
};

const workoutTypes = [
  { label: "Sem tipo", value: "" },
  { label: "Musculação", value: "Musculação" },
  { label: "Corrida", value: "Corrida" },
  { label: "Bike", value: "Bike" },
  { label: "Funcional", value: "Funcional" },
  { label: "Cardio", value: "Cardio" },
  { label: "Mobilidade", value: "Mobilidade" },
];

export function EditPostSheet({ open, post, onClose, onSave }: EditPostSheetProps) {
  const [caption, setCaption] = useState("");
  const [workoutType, setWorkoutType] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !post) return;
    setCaption(post.caption ?? "");
    setWorkoutType(post.workoutType ?? "");
    setError(null);
  }, [open, post]);

  async function handleSave() {
    if (!post || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(post.id, {
        caption: caption.trim() ? caption.trim() : null,
        workoutType: workoutType.trim() ? workoutType.trim() : null,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !post) return null;

  return (
    <div className="absolute inset-0 z-50 bg-black/94 px-4 py-4 backdrop-blur-2xl">
      <div className="relative mx-auto flex h-full max-h-[840px] min-h-[620px] flex-col overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#0a0b0c] shadow-[0_28px_72px_rgba(0,0,0,0.7)]">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4">
          <p className="text-[17px] font-black">Editar post</p>
          <button
            aria-label="Fechar"
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[24px] bg-zinc-950">
            {post.mediaType === "video" ? (
              <video
                className="h-full w-full object-cover"
                controls={false}
                muted
                playsInline
                preload="metadata"
                src={post.imageUrl}
              />
            ) : (
              <Image
                alt="Mídia do post"
                className="object-cover"
                fill
                sizes="(max-width: 480px) 100vw, 480px"
                src={post.imageUrl}
              />
            )}
            <div className="absolute bottom-2 left-2 rounded-full bg-black/64 px-3 py-1.5 text-[11px] font-bold text-white/72 backdrop-blur-md">
              A mídia não pode ser trocada — apague e poste novamente se precisar.
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-black uppercase text-white/52">
              Legenda
            </span>
            <textarea
              className="min-h-24 w-full resize-none rounded-[16px] border border-white/[0.08] bg-black/40 px-4 py-3 text-[15px] font-semibold text-white outline-none"
              maxLength={300}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Como foi o treino?"
              value={caption}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-black uppercase text-white/52">
              Tipo de treino
            </span>
            <select
              className="h-12 w-full rounded-[16px] border border-white/[0.08] bg-black/40 px-4 text-[15px] font-bold text-white outline-none"
              onChange={(e) => setWorkoutType(e.target.value)}
              value={workoutType}
            >
              {workoutTypes.map((t) => (
                <option className="bg-black" key={t.value || "none"} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          {error ? (
            <p className="rounded-[16px] border border-[var(--gc-pink)]/30 bg-[var(--gc-pink)]/10 p-3 text-[12px] font-bold text-[var(--gc-pink)]">
              {error}
            </p>
          ) : null}
        </div>

        <div className="border-t border-white/[0.06] p-4">
          <button
            className="gc-pressable flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-black disabled:opacity-50"
            disabled={saving}
            onClick={handleSave}
            type="button"
          >
            <Check size={17} strokeWidth={2.8} />
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

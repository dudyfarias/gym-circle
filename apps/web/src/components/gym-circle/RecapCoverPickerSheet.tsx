"use client";

import Image from "next/image";
import { Check, Sparkles, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EnrichedPost } from "./social/types";

/**
 * Sprint 5.5b — RecapCoverPickerSheet.
 *
 * Sheet bottom 92dvh com grid 3-col dos posts do mês corrente. User
 * pode escolher um dos posts como capa do recap mensal, OU resetar
 * pra auto-pick (botão 'Usar foto automática').
 *
 * Persiste via `services.profiles.setMonthlyRecapCover` (Sprint 5.5a).
 * Quando salva, o builder do recap usa essa escolha na próxima vez
 * que reconstruir o MonthlyRecap state.
 */

type RecapCoverPickerSheetProps = {
  open: boolean;
  /** Posts do mês corrente do user dono do recap (já filtrados pelo parent). */
  monthPosts: EnrichedPost[];
  /** Label do mês pra subtitle (ex: "maio de 2026"). */
  monthLabel: string;
  /** ID do post atualmente escolhido (null = auto). */
  selectedPostId: string | null;
  /** Salva (ou reseta se postId = null). Throw → mostra error inline. */
  onSelect: (postId: string | null) => Promise<void>;
  onClose: () => void;
};

export function RecapCoverPickerSheet({
  open,
  monthPosts,
  monthLabel,
  selectedPostId,
  onSelect,
  onClose,
}: RecapCoverPickerSheetProps) {
  const { t } = useTranslation();
  const [savingPostId, setSavingPostId] = useState<string | null>(null);
  const [savingAuto, setSavingAuto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtramos só posts com imagem (vídeos não funcionam bem como capa
  // estática no canvas exportado, o poster fica blur). Ordenação:
  // mais novos primeiro, espelha o feed.
  const photoPosts = useMemo(
    () =>
      monthPosts
        .filter((post) => post.mediaType === "image")
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [monthPosts],
  );

  const handleSelect = useCallback(
    async (postId: string | null) => {
      if (postId === null) {
        if (savingAuto) return;
        setSavingAuto(true);
      } else {
        if (savingPostId === postId) return;
        setSavingPostId(postId);
      }
      setError(null);
      try {
        await onSelect(postId);
        onClose();
      } catch {
        setError(t("recapCoverPicker.errorSave"));
      } finally {
        setSavingAuto(false);
        setSavingPostId(null);
      }
    },
    [onClose, onSelect, savingAuto, savingPostId, t],
  );

  if (!open) return null;

  return (
    <div
      aria-hidden={!open}
      className={[
        "absolute inset-0 z-[72] transition-opacity duration-200",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      ].join(" ")}
    >
      <button
        aria-label={t("recapCoverPicker.closeAria")}
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
        style={{ height: "min(82dvh, 720px)" }}
      >
        <div className="flex shrink-0 justify-center pb-1.5 pt-2.5">
          <div className="h-1 w-9 rounded-full bg-white/[0.18]" />
        </div>

        <header className="grid shrink-0 grid-cols-[1fr_auto] items-center gap-3 px-5 pb-3 pt-1">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-black text-white">
              {t("recapCoverPicker.title")}
            </h2>
            <p className="truncate text-[12px] font-bold capitalize text-white/52">
              {t("recapCoverPicker.subtitle", { month: monthLabel })}
            </p>
          </div>
          <button
            aria-label={t("recapCoverPicker.closeAria")}
            className="gc-pressable grid size-9 place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </header>

        <div className="h-px shrink-0 bg-white/[0.06]" />

        <div className="gc-scrollbar flex-1 overflow-y-auto px-4 py-4">
          {/* Botão "Usar foto automática" — sempre no topo, sinaliza
              "remover escolha" + fall back pro auto-pick. Highlight quando
              não há nenhum override ativo (selectedPostId null). */}
          <button
            aria-label={t("recapCoverPicker.useAuto")}
            aria-pressed={selectedPostId === null}
            className={[
              "gc-pressable mb-3 flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left transition-colors disabled:opacity-60",
              selectedPostId === null
                ? "bg-[var(--gc-brand)]/14 ring-1 ring-[var(--gc-brand)]/40"
                : "bg-white/[0.04] hover:bg-white/[0.07]",
            ].join(" ")}
            disabled={savingAuto || savingPostId !== null}
            onClick={() => void handleSelect(null)}
            type="button"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
              <Sparkles size={18} strokeWidth={2.4} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-black text-white">
                {savingAuto ? t("recapCoverPicker.saving") : t("recapCoverPicker.useAuto")}
              </span>
              {selectedPostId === null ? (
                <span className="block text-[11px] font-bold text-[var(--gc-brand)]">
                  {t("recapCoverPicker.selectedBadge")}
                </span>
              ) : null}
            </span>
            {selectedPostId === null ? (
              <Check
                className="text-[var(--gc-brand)]"
                size={18}
                strokeWidth={2.6}
              />
            ) : null}
          </button>

          {error ? (
            <p className="mb-3 rounded-[12px] border border-[var(--gc-pink)]/30 bg-[var(--gc-pink)]/10 p-3 text-[12px] font-bold text-[var(--gc-pink)]">
              {error}
            </p>
          ) : null}

          {photoPosts.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-white/[0.08] bg-white/[0.02] p-8 text-center">
              <p className="text-[13px] font-bold text-white/52">
                {t("recapCoverPicker.empty")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {photoPosts.map((post) => {
                const isSelected = selectedPostId === post.id;
                const isSaving = savingPostId === post.id;
                return (
                  <button
                    aria-label={t("recapCoverPicker.useThis")}
                    aria-pressed={isSelected}
                    className={[
                      "gc-pressable relative aspect-square overflow-hidden rounded-[12px] transition-all disabled:opacity-60",
                      isSelected
                        ? "ring-2 ring-[var(--gc-brand)] ring-offset-2 ring-offset-[#0a0b0c]"
                        : "ring-1 ring-white/[0.06]",
                    ].join(" ")}
                    disabled={savingAuto || (savingPostId !== null && !isSaving)}
                    key={post.id}
                    onClick={() => void handleSelect(post.id)}
                    type="button"
                  >
                    <Image
                      alt={post.caption || post.workoutType || "Post"}
                      className="object-cover"
                      fill
                      sizes="(max-width: 480px) 33vw, 160px"
                      src={post.thumbnailUrl ?? post.imageUrl}
                    />
                    {isSelected ? (
                      <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-[var(--gc-brand)] text-black shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                        <Check size={13} strokeWidth={3} />
                      </span>
                    ) : null}
                    {isSaving ? (
                      <span className="absolute inset-0 grid place-items-center bg-black/40 text-[10px] font-black text-white">
                        {t("recapCoverPicker.saving")}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export type { RecapCoverPickerSheetProps };

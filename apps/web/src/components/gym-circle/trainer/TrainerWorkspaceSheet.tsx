"use client";

import { useEffect, useState } from "react";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import { BriefcaseBusiness, LoaderCircle, Save, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  createTrainerWorkspace,
  emptyTrainerWorkspaceDraft,
  loadMyTrainerWorkspace,
  loadTrainerWorkspaceMembers,
  trainerWorkspaceDraftFromRow,
  updateTrainerWorkspace,
  validateTrainerWorkspaceDraft,
  type TrainerWorkspaceContext,
  type TrainerWorkspaceDraft,
  type TrainerWorkspaceMember,
} from "./trainerWorkspace";
import { TrainerWorkspaceOnboarding } from "./TrainerWorkspaceOnboarding";
import { TrainerWorkspaceSettings } from "./TrainerWorkspaceSettings";

type TrainerWorkspaceSheetProps = {
  fallbackName: string;
  onChanged?: () => void;
  onClose: () => void;
  open: boolean;
  userId: string;
};

export function TrainerWorkspaceSheet({
  fallbackName,
  onChanged,
  onClose,
  open,
  userId,
}: TrainerWorkspaceSheetProps) {
  const { t } = useTranslation();
  const services = useGymCircleServices();
  const [context, setContext] = useState<TrainerWorkspaceContext | null>(null);
  const [draft, setDraft] = useState<TrainerWorkspaceDraft>(() =>
    emptyTrainerWorkspaceDraft(fallbackName),
  );
  const [members, setMembers] = useState<TrainerWorkspaceMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
      void loadMyTrainerWorkspace(services.client, userId)
        .then(async (nextContext) => {
          if (!active) return;
          setContext(nextContext);
          setDraft(
            nextContext
              ? trainerWorkspaceDraftFromRow(nextContext.workspace)
              : emptyTrainerWorkspaceDraft(fallbackName),
          );
          if (!nextContext) {
            setMembers([]);
            return;
          }
          const nextMembers = await loadTrainerWorkspaceMembers(
            services.client,
            nextContext.workspace.id,
          );
          if (active) setMembers(nextMembers);
        })
        .catch(() => {
          if (active) setError(t("trainer.workspace.errors.load"));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [fallbackName, open, services.client, t, userId]);

  if (!open) return null;

  function updateDraft(patch: Partial<TrainerWorkspaceDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  }

  async function save() {
    const validationError = validateTrainerWorkspaceDraft(draft);
    if (validationError) {
      setError(t(`trainer.workspace.errors.${validationError}`));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const nextContext = context
        ? await updateTrainerWorkspace(
            services.client,
            userId,
            context.workspace.id,
            draft,
          )
        : await createTrainerWorkspace(services.client, userId, draft);
      const nextMembers = await loadTrainerWorkspaceMembers(
        services.client,
        nextContext.workspace.id,
      );
      setContext(nextContext);
      setDraft(trainerWorkspaceDraftFromRow(nextContext.workspace));
      setMembers(nextMembers);
      onChanged?.();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "";
      setError(
        message.includes("already_exists")
          ? t("trainer.workspace.errors.alreadyExists")
          : t("trainer.workspace.errors.save"),
      );
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    !loading &&
    !saving &&
    (!context ||
      (context.membership.role === "owner" && context.workspace.status === "active"));

  return (
    <div
      aria-label={t("trainer.workspace.title")}
      aria-modal="true"
      className="fixed inset-0 z-[112] flex items-end justify-center bg-black/76 backdrop-blur-2xl"
      role="dialog"
    >
      <button
        aria-label={t("common.close")}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div className="relative flex max-h-[94dvh] min-h-[70dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[34px] border border-white/[0.09] bg-[#0d0f11] shadow-[0_-28px_90px_rgba(0,0,0,0.72)]">
        <header className="border-b border-white/[0.06] px-5 pb-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-[var(--gc-brand)]/10 text-[var(--gc-brand)]">
              <BriefcaseBusiness size={18} />
            </span>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-[15px] font-black text-white">
                {context
                  ? context.workspace.name
                  : t("trainer.workspace.title")}
              </p>
              <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/36">
                {context
                  ? t("trainer.workspace.management")
                  : t("trainer.workspace.foundation")}
              </p>
            </div>
            <button
              aria-label={t("common.close")}
              className="gc-pressable grid size-10 place-items-center rounded-full bg-white/[0.06] text-white/72"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-5 pb-6 pt-5">
          {loading ? (
            <div className="grid min-h-[340px] place-items-center text-[var(--gc-brand)]">
              <LoaderCircle className="animate-spin" size={28} />
            </div>
          ) : context ? (
            <TrainerWorkspaceSettings
              context={context}
              disabled={saving}
              draft={draft}
              members={members}
              onChange={updateDraft}
            />
          ) : (
            <TrainerWorkspaceOnboarding
              disabled={saving}
              draft={draft}
              onChange={updateDraft}
            />
          )}

          {error ? (
            <p className="mt-4 rounded-[16px] border border-[var(--gc-pink)]/18 bg-[var(--gc-pink)]/[0.08] px-3 py-2.5 text-[12px] font-bold leading-4 text-[var(--gc-pink)]">
              {error}
            </p>
          ) : null}
        </main>

        {!loading && canSave ? (
          <footer className="border-t border-white/[0.06] bg-black/24 px-5 pb-[calc(var(--gc-safe-bottom)+14px)] pt-3">
            <button
              className="gc-pressable flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-black disabled:opacity-45"
              disabled={saving}
              onClick={() => void save()}
              type="button"
            >
              {saving ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : context ? (
                <Save size={17} />
              ) : null}
              {context
                ? t("trainer.workspace.actions.save")
                : t("trainer.workspace.actions.create")}
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}

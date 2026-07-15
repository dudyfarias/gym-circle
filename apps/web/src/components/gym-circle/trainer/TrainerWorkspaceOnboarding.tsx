"use client";

import { Building2, Check, Dumbbell, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  TRAINER_WORKSPACE_TYPES,
  type TrainerWorkspaceDraft,
  type TrainerWorkspaceType,
} from "./trainerWorkspace";

type TrainerWorkspaceOnboardingProps = {
  draft: TrainerWorkspaceDraft;
  disabled?: boolean;
  onChange: (patch: Partial<TrainerWorkspaceDraft>) => void;
};

const workspaceIcons = {
  individual: Dumbbell,
  advisory: UsersRound,
  studio: Building2,
} satisfies Record<TrainerWorkspaceType, typeof Dumbbell>;

export function TrainerWorkspaceOnboarding({
  draft,
  disabled = false,
  onChange,
}: TrainerWorkspaceOnboardingProps) {
  const { t } = useTranslation();

  return (
    <section>
      <div className="rounded-[24px] border border-[var(--gc-brand)]/16 bg-[var(--gc-brand)]/[0.07] p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--gc-brand)]">
          {t("trainer.workspace.onboarding.eyebrow")}
        </p>
        <h2 className="mt-2 text-[22px] font-black leading-tight text-white">
          {t("trainer.workspace.onboarding.title")}
        </h2>
        <p className="mt-2 text-[13px] font-semibold leading-5 text-white/52">
          {t("trainer.workspace.onboarding.body")}
        </p>
      </div>

      <label className="mt-5 block">
        <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-white/42">
          {t("trainer.workspace.fields.name")}
        </span>
        <input
          className="h-12 w-full rounded-[16px] border border-white/[0.08] bg-white/[0.055] px-4 text-[14px] font-bold text-white outline-none transition focus:border-[var(--gc-brand)]/45 disabled:opacity-50"
          disabled={disabled}
          maxLength={100}
          onChange={(event) => onChange({ name: event.target.value })}
          value={draft.name}
        />
      </label>

      <fieldset className="mt-5" disabled={disabled}>
        <legend className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/42">
          {t("trainer.workspace.fields.type")}
        </legend>
        <div className="grid gap-2">
          {TRAINER_WORKSPACE_TYPES.map((type) => {
            const selected = draft.workspaceType === type;
            const Icon = workspaceIcons[type];
            return (
              <button
                aria-pressed={selected}
                className={[
                  "gc-pressable flex min-h-16 w-full items-center gap-3 rounded-[18px] border px-4 text-left",
                  selected
                    ? "border-[var(--gc-brand)]/36 bg-[var(--gc-brand)]/12"
                    : "border-white/[0.08] bg-white/[0.04]",
                ].join(" ")}
                key={type}
                onClick={() => onChange({ workspaceType: type })}
                type="button"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-white/[0.06] text-[var(--gc-brand)]">
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-black text-white/84">
                    {t(`trainer.workspace.types.${type}`)}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-white/40">
                    {t(`trainer.workspace.typeDescriptions.${type}`)}
                  </span>
                </span>
                {selected ? (
                  <span className="grid size-6 place-items-center rounded-full bg-[var(--gc-brand)] text-black">
                    <Check size={14} strokeWidth={3} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      <p className="mt-4 text-[11px] font-semibold leading-4 text-white/38">
        {t("trainer.workspace.onboarding.scopeNotice")}
      </p>
    </section>
  );
}

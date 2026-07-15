"use client";

import { ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  TrainerWorkspaceContext,
  TrainerWorkspaceDraft,
  TrainerWorkspaceMember,
} from "./trainerWorkspace";
import { TrainerWorkspaceMembersSection } from "./TrainerWorkspaceMembersSection";

type TrainerWorkspaceSettingsProps = {
  context: TrainerWorkspaceContext;
  draft: TrainerWorkspaceDraft;
  disabled?: boolean;
  members: TrainerWorkspaceMember[];
  onChange: (patch: Partial<TrainerWorkspaceDraft>) => void;
};

export function TrainerWorkspaceSettings({
  context,
  draft,
  disabled = false,
  members,
  onChange,
}: TrainerWorkspaceSettingsProps) {
  const { t } = useTranslation();
  const workspace = context.workspace;
  const isOwner = context.membership.role === "owner";
  const canEdit = isOwner && workspace.status === "active" && !disabled;

  return (
    <section>
      {workspace.status !== "active" ? (
        <div className="mb-4 flex gap-2 rounded-[18px] border border-amber-300/16 bg-amber-300/[0.07] p-3 text-amber-100/76">
          <ShieldAlert className="mt-0.5 shrink-0" size={16} />
          <p className="text-[11px] font-bold leading-4">
            {t(`trainer.workspace.statusMessages.${workspace.status}`)}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <InfoCard
          label={t("trainer.workspace.fields.type")}
          value={t(`trainer.workspace.types.${workspace.workspace_type}`)}
        />
        <InfoCard
          label={t("trainer.workspace.fields.role")}
          value={t(`trainer.workspace.roles.${context.membership.role}`)}
        />
      </div>

      <FormField label={t("trainer.workspace.fields.name")}>
        <input
          className={inputClassName}
          disabled={!canEdit}
          maxLength={100}
          onChange={(event) => onChange({ name: event.target.value })}
          value={draft.name}
        />
      </FormField>

      <FormField label={t("trainer.workspace.fields.description")}>
        <textarea
          className={`${inputClassName} min-h-24 resize-none py-3`}
          disabled={!canEdit}
          maxLength={800}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder={t("trainer.workspace.fields.descriptionPlaceholder")}
          value={draft.description}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-2">
        <FormField label={t("trainer.workspace.fields.city")}>
          <input
            className={inputClassName}
            disabled={!canEdit}
            maxLength={80}
            onChange={(event) => onChange({ city: event.target.value })}
            value={draft.city}
          />
        </FormField>
        <FormField label={t("trainer.workspace.fields.state")}>
          <input
            className={inputClassName}
            disabled={!canEdit}
            maxLength={40}
            onChange={(event) => onChange({ state: event.target.value })}
            value={draft.state}
          />
        </FormField>
      </div>

      <TrainerWorkspaceMembersSection members={members} />
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-5 rounded-[18px] border border-white/[0.07] bg-white/[0.04] px-3 py-3">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/32">
        {label}
      </p>
      <p className="mt-1 text-[12px] font-black text-white/74">{value}</p>
    </div>
  );
}

function FormField({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-white/42">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClassName =
  "h-12 w-full rounded-[16px] border border-white/[0.08] bg-white/[0.055] px-4 text-[14px] font-bold text-white outline-none transition focus:border-[var(--gc-brand)]/45 disabled:cursor-not-allowed disabled:opacity-45";

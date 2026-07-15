"use client";

import { useEffect, useState } from "react";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Pencil,
  ShieldAlert,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  loadTrainerProfile,
  type TrainerProfile,
  type TrainerVerificationStatus,
} from "./trainerProfile";
import {
  loadMyTrainerWorkspace,
  type TrainerWorkspaceContext,
} from "./trainerWorkspace";

export function TrainerBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--gc-brand)]/20 bg-[var(--gc-brand)]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em] text-[var(--gc-brand)]">
      <BriefcaseBusiness size={12} strokeWidth={2.7} />
      {t("trainer.badge")}
    </span>
  );
}

export function TrainerVerificationBadge({
  status,
}: {
  status: TrainerVerificationStatus;
}) {
  const { t } = useTranslation();
  if (status !== "verified") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-300">
      <BadgeCheck size={12} strokeWidth={2.8} />
      {t("trainer.verification.verified")}
    </span>
  );
}

type TrainerProfileSectionProps = {
  userId: string;
  isOwnProfile?: boolean;
  onEdit?: () => void;
  onOpenWorkspace?: () => void;
  refreshKey?: number;
  workspaceRefreshKey?: number;
};

export function TrainerProfileSection({
  userId,
  isOwnProfile = false,
  onEdit,
  onOpenWorkspace,
  refreshKey = 0,
  workspaceRefreshKey = 0,
}: TrainerProfileSectionProps) {
  const enabled = process.env.NEXT_PUBLIC_TRAINER_PROFILES_ENABLED === "true";
  const { t } = useTranslation();
  const services = useGymCircleServices();
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [workspaceContext, setWorkspaceContext] =
    useState<TrainerWorkspaceContext | null>(null);
  const canOpenWorkspace = isOwnProfile && Boolean(onOpenWorkspace);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void loadTrainerProfile(services.client, userId)
      .then((next) => {
        if (active) setProfile(next);
      })
      .catch(() => {
        if (active) setProfile(null);
      });
    return () => {
      active = false;
    };
  }, [enabled, refreshKey, services.client, userId]);

  useEffect(() => {
    if (!enabled || !canOpenWorkspace) return;
    let active = true;
    void loadMyTrainerWorkspace(services.client, userId)
      .then((next) => {
        if (active) setWorkspaceContext(next);
      })
      .catch(() => {
        if (active) setWorkspaceContext(null);
      });
    return () => {
      active = false;
    };
  }, [canOpenWorkspace, enabled, services.client, userId, workspaceRefreshKey]);

  if (!enabled || !profile) return null;

  const location = [profile.city, profile.state].filter(Boolean).join(" · ");
  const statusCopy = getOwnerStatusCopy(profile.verification_status, t);

  return (
    <section className="mt-4 overflow-hidden rounded-[24px] border border-[var(--gc-brand)]/16 bg-[linear-gradient(145deg,rgba(48,213,255,0.09),rgba(255,255,255,0.025)_55%,rgba(0,0,0,0.1))] p-4 shadow-[0_18px_48px_rgba(48,213,255,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <TrainerBadge />
            <TrainerVerificationBadge status={profile.verification_status} />
          </div>
          <h2 className="mt-3 text-[18px] font-black leading-tight text-white">
            {profile.professional_name}
          </h2>
          <p className="mt-1 text-[13px] font-bold leading-5 text-white/68">
            {profile.headline}
          </p>
        </div>
        {isOwnProfile && onEdit ? (
          <button
            aria-label={t("trainer.actions.edit")}
            className="gc-pressable grid size-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.06] text-white/76"
            onClick={onEdit}
            type="button"
          >
            <Pencil size={15} strokeWidth={2.5} />
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {profile.specialties.map((specialty) => (
          <span
            className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-black text-white/76"
            key={specialty}
          >
            {t(`trainer.specialties.${specialty}`)}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[12px] font-bold text-white/58">
        <span className="inline-flex items-center gap-1.5">
          <BriefcaseBusiness size={14} className="text-[var(--gc-brand)]" />
          {profile.service_modes.map((mode) => t(`trainer.serviceModes.${mode}`)).join(" · ")}
        </span>
        {location ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={14} className="text-[var(--gc-brand)]" />
            {location}
          </span>
        ) : null}
        {profile.accepts_new_clients ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-300/88">
            <CheckCircle2 size={14} />
            {t("trainer.acceptingClients")}
          </span>
        ) : null}
      </div>

      <p className="mt-3 whitespace-pre-wrap text-[13px] font-semibold leading-5 text-white/64">
        {profile.professional_bio}
      </p>

      {isOwnProfile && statusCopy ? (
        <div className="mt-3 flex items-start gap-2 rounded-[16px] border border-white/[0.07] bg-black/22 px-3 py-2.5 text-[11px] font-bold leading-4 text-white/58">
          <ShieldAlert className="mt-0.5 shrink-0 text-[var(--gc-brand)]" size={14} />
          <span>{statusCopy}</span>
        </div>
      ) : null}

      {isOwnProfile && onOpenWorkspace ? (
        <button
          className="gc-pressable mt-3 flex w-full items-center gap-3 rounded-[18px] border border-[var(--gc-brand)]/14 bg-black/22 px-3 py-3 text-left"
          onClick={onOpenWorkspace}
          type="button"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-[var(--gc-brand)]/10 text-[var(--gc-brand)]">
            <Building2 size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-black text-white/82">
              {workspaceContext?.workspace.name ??
                t("trainer.workspace.actions.create")}
            </span>
            <span className="mt-0.5 block truncate text-[10px] font-bold text-white/40">
              {workspaceContext
                ? `${t(`trainer.workspace.roles.${workspaceContext.membership.role}`)} · ${t(`trainer.workspace.statuses.${workspaceContext.workspace.status}`)}`
                : t("trainer.workspace.actions.createDescription")}
            </span>
          </span>
          <ChevronRight className="shrink-0 text-white/30" size={17} />
        </button>
      ) : null}
    </section>
  );
}

type TFn = (key: string) => string;

export function getOwnerStatusCopy(
  status: TrainerVerificationStatus,
  t: TFn,
): string | null {
  if (status === "verified") return t("trainer.verification.ownerVerified");
  if (status === "pending") return t("trainer.verification.ownerPending");
  if (status === "rejected") return t("trainer.verification.ownerRejected");
  if (status === "suspended") return t("trainer.verification.ownerSuspended");
  return t("trainer.verification.ownerUnverified");
}

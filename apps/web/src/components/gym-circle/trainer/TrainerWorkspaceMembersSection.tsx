"use client";

import { Crown, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TrainerWorkspaceMember } from "./trainerWorkspace";

export function TrainerWorkspaceMembersSection({
  members,
}: {
  members: TrainerWorkspaceMember[];
}) {
  const { t } = useTranslation();

  return (
    <section className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-black text-white">
            {t("trainer.workspace.members.title")}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-white/38">
            {t("trainer.workspace.members.subtitle")}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-black text-white/52">
          <UsersRound size={12} />
          {members.length}
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.035]">
        {members.map((member) => (
          <div
            className="flex min-h-16 items-center gap-3 border-b border-white/[0.06] px-3 last:border-b-0"
            key={member.id}
          >
            {member.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="size-10 rounded-full object-cover"
                src={member.avatarUrl}
              />
            ) : (
              <span className="grid size-10 place-items-center rounded-full bg-[var(--gc-brand)]/10 text-[13px] font-black text-[var(--gc-brand)]">
                {member.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-black text-white/82">
                {member.displayName}
              </span>
              <span className="block truncate text-[11px] font-semibold text-white/38">
                {member.username ? `@${member.username}` : t("trainer.workspace.members.noUsername")}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--gc-brand)]/10 px-2.5 py-1 text-[10px] font-black text-[var(--gc-brand)]">
              {member.role === "owner" ? <Crown size={11} /> : null}
              {t(`trainer.workspace.roles.${member.role}`)}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 rounded-[16px] border border-white/[0.06] bg-black/20 px-3 py-2.5 text-[11px] font-semibold leading-4 text-white/38">
        {t("trainer.workspace.members.invitesLater")}
      </p>
    </section>
  );
}

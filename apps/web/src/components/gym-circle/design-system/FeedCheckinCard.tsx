"use client";

import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/ui/Avatar";
import type { EnrichedCheckin } from "../social/types";

type FeedCheckinCardProps = {
  checkin: EnrichedCheckin;
  formatTime: (createdAt: string) => string;
  onSelectUser?: (userId: string) => void;
};

export function FeedCheckinCard({
  checkin,
  formatTime,
  onSelectUser,
}: FeedCheckinCardProps) {
  const { t } = useTranslation();
  const location = [checkin.gymCity, checkin.gymState]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(92,232,255,0.12),transparent_48%),#0c0d0e] shadow-[0_18px_54px_rgba(0,0,0,0.28)]">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button
          aria-label={t("feedScreen.checkin.openProfile", {
            username: checkin.author.username,
          })}
          className="gc-pressable shrink-0 rounded-full"
          disabled={!onSelectUser}
          onClick={() => onSelectUser?.(checkin.userId)}
          type="button"
        >
          <Avatar
            accent={checkin.author.accent}
            name={checkin.author.name}
            size="sm"
            src={checkin.author.avatarUrl ?? undefined}
          />
        </button>
        <div className="min-w-0 flex-1">
          <button
            className="gc-pressable block max-w-full truncate text-left text-[14px] font-black text-white"
            disabled={!onSelectUser}
            onClick={() => onSelectUser?.(checkin.userId)}
            type="button"
          >
            {checkin.author.name}
          </button>
          <p className="text-[11.5px] font-bold text-white/42">
            @{checkin.author.username} · {formatTime(checkin.createdAt)}
          </p>
        </div>
        <span className="rounded-full bg-[var(--gc-brand)]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[var(--gc-brand)]">
          {t("feedScreen.checkin.badge")}
        </span>
      </div>

      <div className="mx-4 mb-4 flex items-center gap-3 rounded-[20px] border border-[var(--gc-brand)]/12 bg-[var(--gc-brand)]/[0.055] p-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--gc-brand)] text-black shadow-[0_0_28px_rgba(92,232,255,0.2)]">
          <MapPin size={21} strokeWidth={2.8} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-white/38">
            {t("feedScreen.checkin.action")}
          </p>
          <p className="truncate text-[16px] font-black text-white">
            {checkin.gymName}
          </p>
          {location ? (
            <p className="mt-0.5 truncate text-[11.5px] font-bold text-white/42">
              {location}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

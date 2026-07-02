"use client";

import { UserCheck, UserPlus, Users, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { EmptyState, StreakBadge } from "./design-system";
import type { EnrichedUser, FollowActionResult } from "./social/types";

type FollowListKind = "followers" | "following";

type FollowListOverlayProps = {
  currentUserId: string;
  kind: FollowListKind;
  loading?: boolean;
  onClose: () => void;
  onSelectUser?: (userId: string) => void;
  onToggleFollow?: (userId: string) => void | Promise<FollowActionResult>;
  open: boolean;
  users: EnrichedUser[];
};

export function FollowListOverlay({
  currentUserId,
  kind,
  loading = false,
  onClose,
  onSelectUser,
  onToggleFollow,
  open,
  users,
}: FollowListOverlayProps) {
  const { t } = useTranslation();

  if (!open) return null;

  // Sprint 4.6+ i18n: copy localizado por kind. Mantém o pattern original
  // (`COPY[kind]`) mas via i18n key dinâmica `followListOverlay.{kind}.*`.
  const copy = {
    title: t(`followListOverlay.${kind}.title`),
    detail: t(`followListOverlay.${kind}.detail`),
    emptyTitle: t(`followListOverlay.${kind}.emptyTitle`),
    emptyDetail: t(`followListOverlay.${kind}.emptyDetail`),
    closeAria: t(`followListOverlay.${kind}.closeAria`),
  };

  return (
    <div
      className="fixed inset-0 z-[92] flex items-end justify-center bg-black/54 backdrop-blur-[10px]"
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
    >
      <button
        aria-label={copy.closeAria}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <section className="gc-screen-enter relative w-full max-w-[480px] rounded-t-[32px] border border-white/[0.08] bg-[#0b0c0d]/96 px-4 pb-[calc(var(--gc-safe-bottom)+18px)] pt-3 shadow-[0_-28px_90px_rgba(0,0,0,0.62)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/18" />
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid size-10 place-items-center rounded-full bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
              <Users size={17} />
            </div>
            <div>
              <h2 className="text-[18px] font-black">{copy.title}</h2>
              <p className="text-[12px] font-bold text-white/42">{copy.detail}</p>
            </div>
          </div>
          <IconButton label={t("common.close")} onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>

        <div className="gc-scrollbar mt-4 max-h-[62dvh] space-y-1 overflow-y-auto pb-2">
          {loading ? (
            <FollowListSkeleton />
          ) : users.length > 0 ? (
            users.map((user) => {
              const isMe = user.id === currentUserId;
              const following = user.followStatus === "accepted" || user.isFollowing;
              return (
                <div
                  className="flex items-center gap-3 rounded-[24px] px-2 py-2.5"
                  key={user.id}
                >
                  <button
                    className="gc-pressable flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => {
                      onClose();
                      onSelectUser?.(user.id);
                    }}
                    type="button"
                  >
                    <Avatar
                      accent={user.accent}
                      name={user.name}
                      src={user.avatarUrl ?? undefined}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-[14px] font-black text-white">
                          {user.username}
                        </p>
                        <StreakBadge
                          isLit={user.streakLitToday}
                          size="xs"
                          streak={user.currentStreak}
                        />
                      </div>
                      <p className="truncate text-[12px] font-bold text-white/42">
                        {user.name}
                      </p>
                    </div>
                  </button>
                  {!isMe && onToggleFollow ? (
                    <button
                      className={[
                        "gc-pressable inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-[12px] font-black",
                        following
                          ? "bg-white text-black"
                          : "bg-[var(--gc-brand)] text-black",
                      ].join(" ")}
                      onClick={() => void onToggleFollow(user.id)}
                      type="button"
                    >
                      {following ? <UserCheck size={14} /> : <UserPlus size={14} />}
                      {following ? t("common.following") : t("common.follow")}
                    </button>
                  ) : null}
                </div>
              );
            })
          ) : (
            <EmptyState detail={copy.emptyDetail} title={copy.emptyTitle} />
          )}
        </div>
      </section>
    </div>
  );
}

function FollowListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="flex animate-pulse items-center gap-3 px-2 py-2" key={index}>
          <div className="size-11 rounded-full bg-white/[0.08]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-28 rounded-full bg-white/[0.08]" />
            <div className="h-3 w-40 rounded-full bg-white/[0.05]" />
          </div>
        </div>
      ))}
    </div>
  );
}

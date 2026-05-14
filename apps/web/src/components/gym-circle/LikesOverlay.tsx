"use client";

import { Heart, UserCheck, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { EmptyState, StreakBadge } from "./design-system";
import type { EnrichedUser } from "./social/types";

type LikesOverlayProps = {
  currentUserId: string;
  loading?: boolean;
  onClose: () => void;
  onSelectUser?: (userId: string) => void;
  onToggleFollow?: (userId: string) => void;
  open: boolean;
  users: EnrichedUser[];
};

export function LikesOverlay({
  currentUserId,
  loading = false,
  onClose,
  onSelectUser,
  onToggleFollow,
  open,
  users,
}: LikesOverlayProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/54 backdrop-blur-[10px]">
      <button
        aria-label="Fechar curtidas"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <section className="gc-screen-enter relative w-full max-w-[480px] rounded-t-[32px] border border-white/[0.08] bg-[#0b0c0d]/96 px-4 pb-[calc(var(--gc-safe-bottom)+18px)] pt-3 shadow-[0_-28px_90px_rgba(0,0,0,0.62)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/18" />
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid size-10 place-items-center rounded-full bg-[var(--gc-blue)]/12 text-[var(--gc-blue)]">
              <Heart size={17} />
            </div>
            <div>
              <h2 className="text-[18px] font-black">Curtidas</h2>
              <p className="text-[12px] font-bold text-white/42">
                Pessoas que apoiaram esse treino
              </p>
            </div>
          </div>
          <IconButton label="Fechar" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>

        <div className="gc-scrollbar mt-4 max-h-[62dvh] space-y-1 overflow-y-auto pb-2">
          {loading ? (
            <LikesSkeleton />
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
                      onClick={() => onToggleFollow(user.id)}
                      type="button"
                    >
                      {following ? <UserCheck size={14} /> : <UserPlus size={14} />}
                      {following ? "Seguindo" : "Seguir"}
                    </button>
                  ) : null}
                </div>
              );
            })
          ) : (
            <EmptyState
              detail="Quando alguém curtir seu treino, aparece aqui."
              title="Nenhuma curtida ainda"
            />
          )}
        </div>
      </section>
    </div>
  );
}

function LikesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
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

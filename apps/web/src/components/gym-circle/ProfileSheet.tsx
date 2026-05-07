"use client";

import Image from "next/image";
import { CheckCircle2, UserCheck, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import {
  AchievementBadge,
  ProfileHeader,
  StatsWidget,
  StreakBadge,
} from "./design-system";
import type { EnrichedPost, EnrichedUser } from "./social/types";

type ProfileSheetProps = {
  open: boolean;
  user: EnrichedUser | null;
  posts: EnrichedPost[];
  onClose: () => void;
  onToggleFollow: (userId: string) => void | Promise<void>;
};

export function ProfileSheet({ open, user, posts, onClose, onToggleFollow }: ProfileSheetProps) {
  if (!open || !user) return null;

  return (
    <div className="absolute inset-0 z-50 bg-black/94 px-4 py-4 backdrop-blur-2xl">
      <div className="relative mx-auto flex h-full max-h-[840px] min-h-[620px] flex-col overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#0a0b0c] shadow-[0_28px_72px_rgba(0,0,0,0.7)]">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar accent={user.accent} name={user.name} src={undefined} />
            <div className="min-w-0">
              <p className="truncate text-[17px] font-black">{user.name}</p>
              <p className="truncate text-[12px] font-bold text-white/52">@{user.username}</p>
            </div>
          </div>
          <button
            aria-label="Fechar perfil"
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <ProfileHeader user={user} />

          <div className="mt-3 flex gap-2">
            <button
              className={[
                "gc-pressable flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[13px] font-black",
                user.isFollowing
                  ? "bg-white text-black"
                  : "bg-[var(--gc-brand)] text-black",
              ].join(" ")}
              onClick={() => onToggleFollow(user.id)}
              type="button"
            >
              {user.isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
              {user.isFollowing ? "Seguindo" : "Seguir"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatsWidget label="Streak" tone="brand" value={`${user.currentStreak}d`} detail="atual" />
            <StatsWidget label="Maior" tone="blue" value={`${user.longestStreak}d`} detail="recorde" />
            <StatsWidget label="Treinos" tone="brand" value={String(user.workoutsThisMonth)} detail="mes" />
            <StatsWidget label="Followers" tone="blue" value={user.followersCount.toLocaleString("pt-BR")} detail="circle" />
          </div>

          {user.achievements.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {user.achievements.map((a) => (
                <AchievementBadge key={a} label={a} tone="brand" />
              ))}
            </div>
          ) : null}

          <div className="mt-5">
            <h3 className="mb-3 text-[15px] font-extrabold text-white/82">
              Treinos ({posts.length})
            </h3>
            {posts.length === 0 ? (
              <p className="text-[13px] font-bold text-white/44">
                Nenhum treino publicado ainda.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {posts.map((post) => (
                  <div
                    className="relative aspect-square overflow-hidden rounded-[14px] bg-zinc-950"
                    key={post.id}
                  >
                    <Image
                      alt={post.workoutType}
                      className="object-cover"
                      fill
                      sizes="120px"
                      src={post.imageUrl}
                    />
                    <div className="absolute bottom-1 left-1 right-1 flex items-center gap-1 rounded-full bg-black/52 px-2 py-0.5 backdrop-blur-md">
                      <CheckCircle2 className="text-[var(--gc-brand)]" size={10} />
                      <span className="truncate text-[10px] font-black text-white/82">
                        {post.workoutType}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

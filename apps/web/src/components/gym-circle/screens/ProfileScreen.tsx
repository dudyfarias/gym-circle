"use client";

import Image from "next/image";
import {
  Camera,
  Flame,
  LogOut,
  MapPin,
  Pencil,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { MonthlyRecap } from "../social/monthlyRecap";
import { calculateProfileCompletion } from "../social/profile";
import { getStreakLevel } from "../social/streak";
import type { EnrichedPost, EnrichedUser } from "../social/types";
import { TopBar } from "../TopBar";

type ProfileScreenProps = {
  currentUser: EnrichedUser;
  posts: EnrichedPost[];
  /**
   * Reservado pra futura aba "Streak" — não usado na visão refatorada
   * (calendário detalhado vive no MonthlyRecapSheet, aberto via botão).
   */
  monthDays: Array<{ day: number; dateKey: string; trained: boolean }>;
  /**
   * Reservado — descoberta de gente perto saiu do perfil pra busca/feed.
   * Mantemos no contrato pra não quebrar o caller.
   */
  nearbyUsers: EnrichedUser[];
  onToggleFollow: (userId: string) => void | Promise<void>;
  onEditProfile?: () => void;
  onSignOut?: () => void | Promise<void>;
  onSelectUser?: (userId: string) => void;
  onOpenAdmin?: () => void;
  onRequestAccountDeletion?: () => void | Promise<void>;
  hasStory?: boolean;
  storyViewed?: boolean;
  onOpenStory?: () => void;
  monthlyRecap: MonthlyRecap;
  onOpenMonthlyRecap?: () => void;
};

/**
 * Perfil estilo Instagram/Threads: identidade compacta no topo, posts em
 * grid sendo o protagonista. Sem ActivityCircle gigante, sem 4 widgets de
 * métrica em grid 2x2, sem calendário de 30 dias inline. O detalhamento
 * mensal continua acessível via MonthlyRecapSheet (botão de streak).
 */
export function ProfileScreen({
  currentUser,
  posts,
  onEditProfile,
  onSignOut,
  onOpenAdmin,
  onRequestAccountDeletion,
  hasStory,
  storyViewed,
  onOpenStory,
  monthlyRecap,
  onOpenMonthlyRecap,
}: ProfileScreenProps) {
  const currentLevel = getStreakLevel(currentUser.currentStreak);
  const profileCompletion = calculateProfileCompletion(currentUser);
  const mainGym = currentUser.gyms[0];

  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar eyebrow="Gym Circle" title="Perfil" />

      {/* Identidade — avatar + 3 métricas inline (padrão IG/Threads) */}
      <div className="mt-5 flex items-center gap-5">
        {hasStory && onOpenStory ? (
          <button
            aria-label={`Ver story de ${currentUser.name}`}
            className={[
              "gc-pressable shrink-0 rounded-full p-[3px]",
              storyViewed ? "bg-white/[0.14]" : "gc-story-ring",
            ].join(" ")}
            onClick={onOpenStory}
            type="button"
          >
            <div className="rounded-full bg-black p-[2px]">
              <Avatar
                accent={currentUser.accent ?? "var(--gc-brand)"}
                name={currentUser.name}
                size="md"
                src={currentUser.avatarUrl ?? undefined}
              />
            </div>
          </button>
        ) : (
          <Avatar
            accent={currentUser.accent ?? "var(--gc-brand)"}
            name={currentUser.name}
            size="md"
            src={currentUser.avatarUrl ?? undefined}
          />
        )}

        <div className="grid flex-1 grid-cols-3 gap-1 text-center">
          <ProfileStat label="Posts" value={posts.length} />
          <ProfileStat label="Seguidores" value={currentUser.followersCount} />
          <ProfileStat label="Seguindo" value={currentUser.followingCount} />
        </div>
      </div>

      {/* Nome + handle + bio + local */}
      <div className="mt-4">
        <h2 className="truncate text-[18px] font-black leading-tight text-white">
          {currentUser.name}
        </h2>
        <p className="mt-0.5 text-[13px] font-bold text-white/52">
          @{currentUser.username}
        </p>
        {currentUser.bio ? (
          <p className="mt-2 max-w-[420px] text-[14px] font-medium leading-5 text-white/86">
            {currentUser.bio}
          </p>
        ) : null}
        {mainGym || currentUser.location ? (
          <div className="mt-2 flex items-center gap-1 text-[12px] font-bold text-white/52">
            <MapPin size={12} strokeWidth={2.4} />
            <span className="truncate">
              {[mainGym, currentUser.location && currentUser.location !== mainGym ? currentUser.location : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        ) : null}
      </div>

      {/* Ações: Editar / Sair / Admin — todos no mesmo nível */}
      {onEditProfile || onSignOut || onOpenAdmin ? (
        <div className="mt-4 flex gap-2">
          {onEditProfile ? (
            <button
              className="gc-pressable flex h-10 flex-1 items-center justify-center gap-2 rounded-[12px] bg-white/[0.06] text-[13px] font-black text-white"
              onClick={onEditProfile}
              type="button"
            >
              <Pencil size={14} strokeWidth={2.6} />
              Editar perfil
            </button>
          ) : null}
          {onSignOut ? (
            <button
              aria-label="Sair"
              className="gc-pressable grid size-10 place-items-center rounded-[12px] bg-white/[0.06] text-white/72"
              onClick={onSignOut}
              type="button"
            >
              <LogOut size={15} strokeWidth={2.6} />
            </button>
          ) : null}
          {onOpenAdmin ? (
            <button
              aria-label="Admin"
              className="gc-pressable grid size-10 place-items-center rounded-[12px] bg-[var(--gc-brand)]/10 text-[var(--gc-brand)]"
              onClick={onOpenAdmin}
              type="button"
            >
              <ShieldCheck size={15} strokeWidth={2.6} />
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Completar perfil — só aparece quando < 100% */}
      {onEditProfile && profileCompletion.percentage < 100 ? (
        <button
          className="gc-pressable mt-3 flex w-full items-center justify-between gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-left"
          onClick={onEditProfile}
          type="button"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-black text-white">
              Perfil {profileCompletion.percentage}% completo
            </p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-white/46">
              {profileCompletion.missing[0]?.label ?? "Continue preenchendo"}
            </p>
          </div>
          <span className="grid h-7 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)] px-3 text-[11px] font-black text-black">
            Completar
          </span>
        </button>
      ) : null}

      {/* Streak compacto — uma linha, abre o sheet detalhado ao tocar */}
      <button
        className="gc-pressable mt-3 flex w-full items-center justify-between gap-3 rounded-[14px] bg-white/[0.04] px-4 py-3 text-left disabled:opacity-100"
        disabled={!onOpenMonthlyRecap}
        onClick={onOpenMonthlyRecap}
        type="button"
      >
        <div className="flex items-center gap-2">
          <Flame
            className={
              currentUser.streakLitToday ? "text-[var(--gc-brand)]" : "text-white/52"
            }
            size={16}
            strokeWidth={2.4}
          />
          <span className="text-[14px] font-black text-white">
            {currentUser.currentStreak}d
          </span>
          <span className="text-white/30">·</span>
          <span className="text-[13px] font-bold text-white/72">
            {currentLevel.label}
          </span>
        </div>
        {onOpenMonthlyRecap ? (
          <span className="text-[12px] font-bold text-white/42">
            {monthlyRecap.shortMonthLabel} →
          </span>
        ) : null}
      </button>

      {/* Posts grid — protagonista */}
      <PostsGrid posts={posts} />

      {/* Excluir conta — pequeno, no fim */}
      {onRequestAccountDeletion ? (
        <div className="mt-8 flex justify-center">
          <button
            className="gc-pressable inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[12px] font-bold text-[var(--gc-pink)]/72"
            onClick={onRequestAccountDeletion}
            type="button"
          >
            <Trash2 size={13} strokeWidth={2.4} />
            Excluir conta
          </button>
        </div>
      ) : null}
    </section>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[18px] font-black text-white">
        {value.toLocaleString("pt-BR")}
      </p>
      <p className="mt-0.5 text-[11px] font-bold text-white/52">{label}</p>
    </div>
  );
}

function PostsGrid({ posts }: { posts: EnrichedPost[] }) {
  if (posts.length === 0) {
    return (
      <div className="mt-6 grid place-items-center rounded-[20px] border border-dashed border-white/[0.08] bg-white/[0.02] py-14 text-center">
        <Camera className="text-white/32" size={28} strokeWidth={2} />
        <p className="mt-3 text-[13px] font-bold text-white/52">
          Seus treinos vão aparecer aqui
        </p>
      </div>
    );
  }

  return (
    <div className="-mx-5 mt-6">
      <div className="grid grid-cols-3 gap-[2px]">
        {posts.map((post) => (
          <PostThumb key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}

function PostThumb({ post }: { post: EnrichedPost }) {
  return (
    <div className="relative aspect-square overflow-hidden bg-zinc-950">
      {post.mediaType === "video" ? (
        <video
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
          src={post.imageUrl}
        />
      ) : (
        <Image
          alt={post.workoutType || "Treino"}
          className="object-cover"
          fill
          sizes="(max-width: 480px) 33vw, 160px"
          src={post.imageUrl}
        />
      )}
    </div>
  );
}

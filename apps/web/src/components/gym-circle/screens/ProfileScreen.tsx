"use client";

import Image from "next/image";
import {
  Camera,
  Clock,
  Flame,
  LifeBuoy,
  MapPin,
  MoreHorizontal,
  Pencil,
  Play,
  ShieldCheck,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { VideoThumbnail } from "../design-system";
import type { MonthlyRecap } from "../social/monthlyRecap";
import {
  calculateProfileCompletion,
  shouldShowProfileCompletionNotice,
} from "../social/profile";
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
  onSelectUser?: (userId: string) => void;
  onOpenAdmin?: () => void;
  onOpenSettings?: () => void;
  onOpenFollowers?: () => void;
  onOpenFollowing?: () => void;
  hasStory?: boolean;
  storyViewed?: boolean;
  onOpenStory?: () => void;
  monthlyRecap: MonthlyRecap;
  onOpenMonthlyRecap?: () => void;
  onOpenPost?: (postId: string) => void;
  onUseStreakRestore?: () => void | Promise<void>;
  onDismissProfileCompletionNotice?: () => void | Promise<void>;
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
  onOpenAdmin,
  onOpenSettings,
  onOpenFollowers,
  onOpenFollowing,
  hasStory,
  storyViewed,
  onOpenStory,
  monthlyRecap,
  onOpenMonthlyRecap,
  onOpenPost,
  onUseStreakRestore,
  onDismissProfileCompletionNotice,
}: ProfileScreenProps) {
  const currentLevel = getStreakLevel(currentUser.currentStreak);
  const profileCompletion = calculateProfileCompletion(currentUser);
  const mainGym = currentUser.gyms[0];
  const restoreCountdown = formatRestoreCountdown(currentUser.streakRestoreDeadlineAt);
  const canRestoreStreak = Boolean(
    onUseStreakRestore &&
      currentUser.streakRestoreStatus === "available" &&
      currentUser.streakRestoresAvailable > 0 &&
      restoreCountdown,
  );
  const shouldShowCompletionNotice = shouldShowProfileCompletionNotice(
    currentUser,
    profileCompletion,
  );
  const nextCompletionItem = profileCompletion.missing[0];

  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar
        eyebrow="Gym Circle"
        extraAction={
          onOpenSettings ? (
            <IconButton label="Configurações" onClick={onOpenSettings}>
              <MoreHorizontal size={20} strokeWidth={2.7} />
            </IconButton>
          ) : undefined
        }
        title="Perfil"
      />

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
          <ProfileStat
            label="Seguidores"
            onClick={onOpenFollowers}
            value={currentUser.followersCount}
          />
          <ProfileStat
            label="Seguindo"
            onClick={onOpenFollowing}
            value={currentUser.followingCount}
          />
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

      {/* Ações: Editar / Admin — conta e privacidade ficam no menu do topo */}
      {onEditProfile || onOpenAdmin ? (
        <div className="mt-4 flex gap-2">
          {onEditProfile ? (
            <button
              className="gc-pressable flex h-11 flex-1 items-center justify-center gap-2 rounded-[12px] bg-white/[0.06] text-[13px] font-black text-white"
              onClick={onEditProfile}
              type="button"
            >
              <Pencil size={14} strokeWidth={2.6} />
              Editar perfil
            </button>
          ) : null}
          {onOpenAdmin ? (
            <button
              aria-label="Admin"
              className="gc-pressable grid size-11 place-items-center rounded-[12px] bg-[var(--gc-brand)]/10 text-[var(--gc-brand)]"
              onClick={onOpenAdmin}
              type="button"
            >
              <ShieldCheck size={15} strokeWidth={2.6} />
            </button>
          ) : null}
        </div>
      ) : null}

      {onEditProfile && shouldShowCompletionNotice ? (
        <section className="relative mt-3 rounded-[16px] border border-white/[0.08] bg-white/[0.04] p-3 pr-12">
          {onDismissProfileCompletionNotice ? (
            <button
              aria-label="Fechar aviso de completar perfil"
              className="gc-pressable absolute right-2 top-2 grid size-11 place-items-center rounded-full bg-white/[0.05] text-white/48 transition hover:text-white"
              onClick={() => void onDismissProfileCompletionNotice()}
              type="button"
            >
              <X size={15} strokeWidth={2.6} />
            </button>
          ) : null}
          <button
            className="gc-pressable flex w-full items-center justify-between gap-3 text-left"
            onClick={onEditProfile}
            type="button"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-black text-white">
                Perfil {profileCompletion.percentage}% completo
              </p>
              <p className="mt-0.5 truncate text-[11px] font-bold text-white/46">
                {nextCompletionItem?.label ?? "Continue preenchendo"}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#8CFBFF,#30D5FF,#0066FF)] transition-all duration-500"
                  style={{ width: `${profileCompletion.percentage}%` }}
                />
              </div>
            </div>
            <span className="grid h-8 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)] px-3 text-[11px] font-black text-black">
              Completar
            </span>
          </button>
        </section>
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
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-black text-white/62">
            <LifeBuoy size={12} strokeWidth={2.5} />
            {currentUser.streakRestoresAvailable}
          </span>
          {onOpenMonthlyRecap ? (
            <span className="text-[12px] font-bold text-white/42">
              {monthlyRecap.shortMonthLabel} →
            </span>
          ) : null}
        </div>
      </button>

      {canRestoreStreak ? (
        <div className="mt-3 rounded-[18px] border border-[var(--gc-brand)]/20 bg-[var(--gc-brand)]/[0.07] p-4 shadow-[0_18px_55px_rgba(48,213,255,0.08)]">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
              <LifeBuoy size={18} strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-black text-white">
                Restaurar streak?
              </p>
              <p className="mt-1 text-[12px] font-bold leading-4 text-white/58">
                Use 1 restaurador para proteger o dia que passou.
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-black/24 px-2.5 py-1 text-[11px] font-black text-[var(--gc-brand)]">
                <Clock size={12} strokeWidth={2.4} />
                {restoreCountdown}
              </div>
            </div>
            <button
              className="gc-pressable h-9 shrink-0 rounded-full bg-[var(--gc-brand)] px-4 text-[12px] font-black text-black"
              onClick={onUseStreakRestore}
              type="button"
            >
              Restaurar
            </button>
          </div>
        </div>
      ) : null}

      {/* Posts grid — protagonista */}
      <PostsGrid onOpenPost={onOpenPost} posts={posts} />
    </section>
  );
}

function formatRestoreCountdown(deadlineAt?: string | null) {
  if (!deadlineAt) return null;
  const diff = new Date(deadlineAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.max(1, Math.ceil((diff % 3600000) / 60000));
  if (hours <= 0) return `Restam ${minutes}min`;
  return `Restam ${hours}h`;
}

function ProfileStat({
  label,
  onClick,
  value,
}: {
  label: string;
  onClick?: () => void;
  value: number;
}) {
  const content = (
    <>
      <p className="truncate text-[18px] font-black text-white">
        {value.toLocaleString("pt-BR")}
      </p>
      <p className="mt-0.5 text-[11px] font-bold text-white/52">{label}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        className="gc-pressable min-w-0 rounded-[12px] px-1 py-1 text-center"
        onClick={onClick}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="min-w-0 px-1 py-1">
      {content}
    </div>
  );
}

function PostsGrid({
  posts,
  onOpenPost,
}: {
  posts: EnrichedPost[];
  onOpenPost?: (postId: string) => void;
}) {
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
          <PostThumb key={post.id} onOpenPost={onOpenPost} post={post} />
        ))}
      </div>
    </div>
  );
}

function PostThumb({
  post,
  onOpenPost,
}: {
  post: EnrichedPost;
  onOpenPost?: (postId: string) => void;
}) {
  return (
    <button
      aria-label={`Abrir post ${post.mediaType === "video" ? "em vídeo" : "com foto"}`}
      className="gc-pressable relative aspect-square w-full overflow-hidden bg-zinc-950 text-left"
      onClick={() => onOpenPost?.(post.id)}
      type="button"
    >
      {post.mediaType === "video" ? (
        <VideoThumbnail
          className="h-full w-full object-cover"
          poster={post.posterUrl ?? post.thumbnailUrl}
          src={post.imageUrl}
        />
      ) : (
        <Image
          alt={post.workoutType || "Treino"}
          className="object-cover"
          fill
          sizes="(max-width: 480px) 33vw, 160px"
          src={post.thumbnailUrl ?? post.imageUrl}
        />
      )}
      {post.mediaType === "video" ? (
        <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/58 text-white backdrop-blur-md">
          <Play size={12} fill="currentColor" strokeWidth={2.4} />
        </span>
      ) : null}
    </button>
  );
}

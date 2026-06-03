"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  Flame,
  LifeBuoy,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/components/ui/IconButton";
import {
  AchievementArtifact3D,
  ProfileIdentity,
  ProfilePostsGrid,
} from "../design-system";
import {
  equippedAchievementStorageKey,
  getAchievementsV2,
  getFeaturedAchievementsWithEquipped,
} from "../social/gamification";
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
  /** Sprint 3.5.3: abre o `MyCircleSheet` (gamificação rica). */
  onOpenMyCircle?: () => void;
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
  onOpenMyCircle,
  onOpenPost,
  onUseStreakRestore,
  onDismissProfileCompletionNotice,
}: ProfileScreenProps) {
  const { t } = useTranslation();
  const [equippedAchievementIds, setEquippedAchievementIds] = useState<string[]>([]);
  const currentLevel = getStreakLevel(currentUser.currentStreak);
  const profileCompletion = calculateProfileCompletion(currentUser);
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
  const achievements = useMemo(
    () => getAchievementsV2({
      user: currentUser,
      posts,
      postsCount: posts.length,
      hasUsedStreakRestore: Boolean(currentUser.lastStreakRestoreUsedAt),
    }),
    [currentUser, posts],
  );
  const featuredAchievements = getFeaturedAchievementsWithEquipped(
    achievements,
    equippedAchievementIds,
    3,
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(equippedAchievementStorageKey(currentUser.id));
      const parsed = raw ? JSON.parse(raw) : [];
      setEquippedAchievementIds(Array.isArray(parsed) ? parsed.slice(0, 3) : []);
    } catch {
      setEquippedAchievementIds([]);
    }
  }, [currentUser.id]);

  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar
        eyebrow={t("feed.title")}
        extraAction={
          onOpenSettings ? (
            <IconButton label={t("settings.openLabel")} onClick={onOpenSettings}>
              <MoreHorizontal size={20} strokeWidth={2.7} />
            </IconButton>
          ) : undefined
        }
        title={t("profile.title")}
      />

      {/* Identidade compartilhada — mesmo componente do ProfileSheet (Sprint 3 pós-3.4) */}
      <div className="mt-5">
        <ProfileIdentity
          user={currentUser}
          postsCount={posts.length}
          hasStory={hasStory}
          storyViewed={storyViewed}
          onOpenStory={onOpenStory}
          onOpenFollowers={onOpenFollowers}
          onOpenFollowing={onOpenFollowing}
          onOpenMyCircle={onOpenMyCircle}
          actions={
            onEditProfile || onOpenAdmin ? (
              <div className="flex gap-2">
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
            ) : undefined
          }
        />
      </div>

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

      {featuredAchievements.length > 0 ? (
        <button
          className="gc-pressable mt-3 w-full rounded-[18px] border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-left"
          onClick={onOpenMyCircle}
          type="button"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[12px] font-black uppercase tracking-[0.06em] text-white/42">
              Conquistas em destaque
            </p>
            <span className="text-[11px] font-black text-white/38">Hall da Fama →</span>
          </div>
          <div className="flex items-center gap-3">
            {featuredAchievements.map((achievement) => (
              <div className="flex min-w-0 flex-1 items-center gap-2" key={achievement.id}>
                <AchievementArtifact3D achievement={achievement} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-black text-white">
                    {achievement.label}
                  </p>
                  <p className="truncate text-[10px] font-bold text-white/38">
                    {achievement.category}
                  </p>
                </div>
              </div>
            ))}
          </div>
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
      <ProfilePostsGrid
        emptyTitle="Seus treinos vão aparecer aqui"
        onOpenPost={onOpenPost}
        posts={posts}
      />
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

// ProfileStat, PostsGrid e PostThumb migraram pros componentes compartilhados
// `ProfileIdentity` e `ProfilePostsGrid` em `design-system/` (Sprint 3 pós-3.4).
// Ambos agora são usados pelo `ProfileSheet.tsx` também, garantindo paridade
// visual entre a aba "Perfil" e o overlay ao clicar em outro user.

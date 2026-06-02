"use client";

import {
  Clock,
  LifeBuoy,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/components/ui/IconButton";
import { ProfileIdentity, ProfilePostsGrid } from "../design-system";
import {
  calculateProfileCompletion,
  shouldShowProfileCompletionNotice,
} from "../social/profile";
import type { EnrichedPost, EnrichedUser } from "../social/types";
import { TopBar } from "../TopBar";

type ProfileScreenProps = {
  currentUser: EnrichedUser;
  posts: EnrichedPost[];
  /**
   * Reservado pra futura aba "Streak" — não usado na visão refatorada
   * (calendário detalhado vive no MyCircleSheet/MonthlyRecapSheet, abertos
   * via botões do hub MyCircle, não mais via Streak compacto inline).
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
  /** Sprint 3.5.3: abre o `MyCircleSheet` (gamificação rica). */
  onOpenMyCircle?: () => void;
  onOpenPost?: (postId: string) => void;
  onUseStreakRestore?: () => void | Promise<void>;
  onDismissProfileCompletionNotice?: () => void | Promise<void>;
};

/**
 * Perfil estilo Instagram/Threads: identidade compacta no topo, posts em
 * grid sendo o protagonista. Sem ActivityCircle gigante, sem 4 widgets de
 * métrica em grid 2x2, sem calendário de 30 dias inline.
 *
 * Sprint 5.1 (Progress + Gamification): removido o botão "Streak compacto"
 * inline. O detalhamento mensal e o Monthly Recap agora vivem no hub
 * MyCircle (botão dentro do MyCircleSheet) — fonte única.
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
  onOpenMyCircle,
  onOpenPost,
  onUseStreakRestore,
  onDismissProfileCompletionNotice,
}: ProfileScreenProps) {
  const { t } = useTranslation();
  const profileCompletion = calculateProfileCompletion(currentUser);
  const restoreCountdown = formatRestoreCountdown(
    currentUser.streakRestoreDeadlineAt,
    t,
  );
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
                    {t("profile.editProfileAction")}
                  </button>
                ) : null}
                {onOpenAdmin ? (
                  <button
                    aria-label={t("profile.adminAria")}
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
              aria-label={t("profile.completionNotice.closeAria")}
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
                {t("profile.completionNotice.title", {
                  percentage: profileCompletion.percentage,
                })}
              </p>
              <p className="mt-0.5 truncate text-[11px] font-bold text-white/46">
                {nextCompletionItem?.label ?? t("profile.completionNotice.fallback")}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#8CFBFF,#30D5FF,#0066FF)] transition-all duration-500"
                  style={{ width: `${profileCompletion.percentage}%` }}
                />
              </div>
            </div>
            <span className="grid h-8 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)] px-3 text-[11px] font-black text-black">
              {t("profile.completionNotice.cta")}
            </span>
          </button>
        </section>
      ) : null}

      {/* Sprint 5.1 — removido o botão "Streak compacto" inline.
          Streak detalhado + Monthly Recap agora vivem no hub MyCircleSheet
          (acesso pelo tap nos AvatarConsistencyRings do ProfileIdentity).
          Fonte única → reduz duplicação de UI e clarifica hierarquia. */}

      {canRestoreStreak ? (
        <div className="mt-3 rounded-[18px] border border-[var(--gc-brand)]/20 bg-[var(--gc-brand)]/[0.07] p-4 shadow-[0_18px_55px_rgba(48,213,255,0.08)]">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
              <LifeBuoy size={18} strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-black text-white">
                {t("profile.streakRestore.title")}
              </p>
              <p className="mt-1 text-[12px] font-bold leading-4 text-white/58">
                {t("profile.streakRestore.body")}
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
              {t("profile.streakRestore.cta")}
            </button>
          </div>
        </div>
      ) : null}

      {/* Posts grid — protagonista */}
      <ProfilePostsGrid
        emptyTitle={t("profile.emptyPostsTitle")}
        onOpenPost={onOpenPost}
        posts={posts}
      />
    </section>
  );
}

type TFn = (key: string, options?: Record<string, unknown>) => string;

function formatRestoreCountdown(
  deadlineAt: string | null | undefined,
  t: TFn,
): string | null {
  if (!deadlineAt) return null;
  const diff = new Date(deadlineAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.max(1, Math.ceil((diff % 3600000) / 60000));
  if (hours <= 0)
    return t("profile.streakRestore.countdownMinutes", { count: minutes });
  return t("profile.streakRestore.countdownHours", { count: hours });
}

// ProfileStat, PostsGrid e PostThumb migraram pros componentes compartilhados
// `ProfileIdentity` e `ProfilePostsGrid` em `design-system/` (Sprint 3 pós-3.4).
// Ambos agora são usados pelo `ProfileSheet.tsx` também, garantindo paridade
// visual entre a aba "Perfil" e o overlay ao clicar em outro user.

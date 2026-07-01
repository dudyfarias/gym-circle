"use client";

import {
  Camera,
  Clock,
  LifeBuoy,
  MapPin,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  Target,
  User,
  UserCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/components/ui/IconButton";
import {
  ContextualHint,
  FeaturedAchievementsRow,
  ProfileIdentity,
  ProfilePostsGrid,
} from "../design-system";
import {
  getAllAchievements,
  resolveFeaturedAchievements,
  type Achievement,
} from "../social/achievements";
import type { ProfileCompletionItem } from "../social/profile";
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
  /**
   * Sprint 7C.2 — legacy: dismiss MACRO do notice antigo (1 boolean DB).
   * Mantido por compat enquanto outras surfaces não migram pra hint individual.
   * Os chips novos usam o sistema ContextualHint (DB JSONB + localStorage).
   */
  onDismissProfileCompletionNotice?: () => void | Promise<void>;
  /**
   * Sprint 7C.2 — marca um hint individual como visto cross-device.
   * Wire-up no GymCirclePreview (passa social.actions.markContextualHintSeen).
   */
  onMarkContextualHintSeen?: (hintId: string) => Promise<void>;
  /**
   * Sprint 7.5.5 — abre AchievementDetailOverlay quando user toca em
   * card da Featured Achievements row.
   */
  onOpenAchievementDetail?: (achievement: Achievement) => void;
  /**
   * Sprint 15.5 — abre o Hall da Fama (overlay) pelo botão no canto do
   * header das Conquistas em destaque.
   */
  onOpenAchievements?: () => void;
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
  onMarkContextualHintSeen,
  onOpenAchievementDetail,
  onOpenAchievements,
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

  // Sprint 7C.2 — pendingPromptItems = missing items que ainda não foram
  // individualmente dismissados via ContextualHint. Ordenado pelo weight
  // descendente pra mostrar primeiro o que pesa mais (identity > avatar/gym
  // > goal/bio/preferredTimes). Cap em 2 visíveis pra não saturar a UI.
  const seenHintsMap = currentUser.contextualHintsSeen;
  const pendingPromptItems = profileCompletion.missing
    .filter(
      (item) => !seenHintsMap?.[`profile-complete-${item.id}`],
    )
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2);

  // Sprint 7.5.5 — Featured Achievements row.
  // Resolve achievements em 2 modos: (a) user equipou manualmente via
  // profile.featuredAchievements (lookup por composite ID); (b) auto-
  // suggest top 3 por raridade (Relic > Trophy > Medal > Badge).
  // Lista vazia (nenhum earned ainda) → row simplesmente não renderiza.
  const authoredPosts = posts.filter((post) => post.userId === currentUser.id);
  const allAchievements = getAllAchievements({
    user: currentUser,
    postsCount: authoredPosts.length,
    hasUsedStreakRestore: Boolean(currentUser.lastStreakRestoreUsedAt),
    posts: authoredPosts.map((post) => ({
      createdAt: post.createdAt,
      workoutType: post.workoutType ?? null,
      workoutTypes: post.workoutTypes ?? null,
      gymId: post.gymId,
    })),
  });
  // Sprint 15.5 — lógica extraída pro helper compartilhado (MyCircleSheet
  // usa a MESMA regra equipped → suggest).
  const featuredAchievements: Achievement[] = resolveFeaturedAchievements(
    allAchievements,
    currentUser.featuredAchievements,
  );

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

      {/* Sprint 7.5.5 — Conquistas em destaque (Section 13 do brief).
          Row horizontal com até 3 achievements priorizados (Relic > Trophy
          > Medal > Badge). Vazio (user sem nada earned) → row some. */}
      <FeaturedAchievementsRow
        achievements={featuredAchievements}
        onOpenDetail={onOpenAchievementDetail}
        onOpenHall={onOpenAchievements}
      />

      {/* Sprint 7C.2 — Substitui o banner grande por chips inline
          ContextualHint. Cada chip = 1 missing item, dismissable individual.
          Barra fina top mostra progresso geral. Quando nada pendente ou
          completion=100%, seção some inteira.
          Legacy: `onDismissProfileCompletionNotice` (boolean MACRO no DB)
          ainda funciona via fallback — quando o user dismissa todos os
          chips um a um, o auto-tracking abaixo dispara o macro também. */}
      {onEditProfile &&
      shouldShowCompletionNotice &&
      pendingPromptItems.length > 0 ? (
        <section className="mt-3 flex flex-col gap-1.5">
          {/* Mini progress bar — visual cue sutil de "tem progresso a fazer" */}
          <div className="flex items-center gap-2 px-1">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#8CFBFF,#30D5FF,#0066FF)] transition-all duration-500"
                style={{ width: `${profileCompletion.percentage}%` }}
              />
            </div>
            <span className="text-[10px] font-black tabular-nums text-white/52">
              {profileCompletion.percentage}%
            </span>
          </div>
          {pendingPromptItems.map((item) => (
            <ProfileCompletionChip
              item={item}
              key={item.id}
              markSeen={onMarkContextualHintSeen}
              onTap={onEditProfile}
              seenHints={seenHintsMap}
            />
          ))}
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

/**
 * Sprint 7C.2 — chip de prompt contextual pra completar perfil.
 *
 * Encapsula `ContextualHint` (banner) + mapping de ícone Lucide por item.id.
 * Tap no chip body abre EditProfileSheet (via `onTap`). Dismiss via X
 * persiste via `markSeen` (sync DB) + localStorage (instant local).
 *
 * O ícone temático ajuda identificação rápida do campo:
 *   identity → UserCircle (perfil em geral)
 *   avatar   → Camera (foto)
 *   gym      → MapPin (academia/lugar)
 *   goal     → Target (objetivo)
 *   bio      → User (descrição própria)
 *   preferredTimes → Clock (horários)
 */
function ProfileCompletionChip({
  item,
  seenHints,
  markSeen,
  onTap,
}: {
  item: ProfileCompletionItem;
  seenHints?: Record<string, string>;
  markSeen?: (hintId: string) => Promise<void>;
  onTap: () => void;
}) {
  const hintId = `profile-complete-${item.id}`;
  const IconComponent = ICON_BY_COMPLETION_ID[item.id];

  return (
    <ContextualHint
      hintId={hintId}
      markSeen={markSeen}
      seenHints={seenHints}
      variant="banner"
    >
      <button
        className="gc-pressable -my-1 flex w-full items-center gap-2.5 text-left"
        onClick={onTap}
        type="button"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-[10px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
          <IconComponent size={14} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-white/86">
          {item.label}
        </span>
        <span className="shrink-0 text-[14px] font-black text-white/52">→</span>
      </button>
    </ContextualHint>
  );
}

const ICON_BY_COMPLETION_ID: Record<
  ProfileCompletionItem["id"],
  typeof UserCircle
> = {
  identity: UserCircle,
  avatar: Camera,
  gym: MapPin,
  goal: Target,
  bio: User,
  preferredTimes: Clock,
};

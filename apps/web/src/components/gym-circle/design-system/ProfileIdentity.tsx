import { type ReactNode } from "react";
import { Lock, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { EnrichedUser } from "../social/types";
import { AchievementBadge } from "./AchievementBadge";
import { StreakBadge } from "./StreakBadge";

/**
 * ProfileIdentity — Sprint 3 / pós-3.4.
 *
 * Componente compartilhado pela aba "Perfil" (`ProfileScreen`) e pelo overlay
 * ao clicar num user (`ProfileSheet`). Substitui o antigo `ProfileHeader`
 * (que ainda tinha `ActivityCircle` gigante, sports list, instagramUsername
 * inline — coisas que o `ProfileScreen` removeu na refatoração Instagram-like).
 *
 * Layout (inspirado em Instagram/Threads, sem assets copiados):
 *   ●●●  [Posts][Seguidores][Seguindo]
 *   ●
 *   Nome  [🔥7d] [🔒]
 *   @username
 *   Bio...
 *   📍 Smart Fit Vila Mariana
 *   [🏆 Conquista 1]   ← se achievementBadge=true
 *   [ações slot — Editar/Admin ou Follow/Mensagem/Flag/Block]
 *
 * Diferenças que ficam por conta do caller:
 * - `actions` é um slot livre (ReactNode), cada caller compõe sua row.
 * - `streakBadge`, `achievementBadge` toggláveis (default true).
 * - `onOpenFollowers/Following` torna os stats clicáveis.
 */

type ProfileIdentityProps = {
  user: EnrichedUser;
  postsCount: number;
  hasStory?: boolean;
  storyViewed?: boolean;
  onOpenStory?: () => void;
  onOpenFollowers?: () => void;
  onOpenFollowing?: () => void;
  /** Pill discreta `StreakBadge` ao lado do nome. Default `true`. */
  streakBadge?: boolean;
  /** Primeira conquista em destaque abaixo do local. Default `true`. */
  achievementBadge?: boolean;
  /** Slot de ações (Editar/Admin ou Follow/Mensagem/Flag/Block). */
  actions?: ReactNode;
};

export function ProfileIdentity({
  user,
  postsCount,
  hasStory = false,
  storyViewed = false,
  onOpenStory,
  onOpenFollowers,
  onOpenFollowing,
  streakBadge = true,
  achievementBadge = true,
  actions,
}: ProfileIdentityProps) {
  const mainGym = user.gyms[0];
  const locationLabel = [
    mainGym,
    user.location && user.location !== mainGym ? user.location : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const firstAchievement = user.achievements[0];
  const showStreak =
    streakBadge && (user.currentStreak > 0 || user.streakLitToday);

  return (
    <div>
      {/* Avatar + stats row — padrão Instagram/Threads */}
      <div className="flex items-center gap-5">
        {hasStory && onOpenStory ? (
          <button
            aria-label={`Ver story de ${user.name}`}
            className={[
              "gc-pressable shrink-0 rounded-full p-[3px]",
              storyViewed ? "bg-white/[0.14]" : "gc-story-ring",
            ].join(" ")}
            onClick={onOpenStory}
            type="button"
          >
            <div className="rounded-full bg-black p-[2px]">
              <Avatar
                accent={user.accent ?? "var(--gc-brand)"}
                name={user.name}
                size="md"
                src={user.avatarUrl ?? undefined}
              />
            </div>
          </button>
        ) : (
          <Avatar
            accent={user.accent ?? "var(--gc-brand)"}
            name={user.name}
            size="md"
            src={user.avatarUrl ?? undefined}
          />
        )}

        <div className="grid flex-1 grid-cols-3 gap-1 text-center">
          <ProfileStat label="Posts" value={postsCount} />
          <ProfileStat
            label="Seguidores"
            onClick={onOpenFollowers}
            value={user.followersCount}
          />
          <ProfileStat
            label="Seguindo"
            onClick={onOpenFollowing}
            value={user.followingCount}
          />
        </div>
      </div>

      {/* Nome + StreakBadge + lock — uma linha */}
      <div className="mt-4">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="min-w-0 truncate text-[18px] font-black leading-tight text-white">
            {user.name}
          </h2>
          {showStreak ? (
            <StreakBadge
              best={user.longestStreak}
              isLit={user.streakLitToday}
              size="xs"
              streak={user.currentStreak}
            />
          ) : null}
          {user.isPrivate ? (
            <Lock
              aria-label="Perfil privado"
              className="shrink-0 text-white/52"
              size={13}
              strokeWidth={2.6}
            />
          ) : null}
        </div>

        <p className="mt-0.5 text-[13px] font-bold text-white/52">
          @{user.username}
        </p>

        {user.bio ? (
          <p className="mt-2 max-w-[420px] whitespace-pre-line text-[14px] font-medium leading-5 text-white/86">
            {user.bio}
          </p>
        ) : null}

        {locationLabel ? (
          <div className="mt-2 flex items-center gap-1 text-[12px] font-bold text-white/52">
            <MapPin className="shrink-0" size={12} strokeWidth={2.4} />
            <span className="truncate">{locationLabel}</span>
          </div>
        ) : null}

        {achievementBadge && firstAchievement ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <AchievementBadge label={firstAchievement} tone="brand" />
          </div>
        ) : null}
      </div>

      {actions ? <div className="mt-4">{actions}</div> : null}
    </div>
  );
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
  return <div className="min-w-0 px-1 py-1">{content}</div>;
}

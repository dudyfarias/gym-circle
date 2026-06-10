import { type ReactNode } from "react";
import {
  AtSign,
  CalendarDays,
  Clock3,
  Dumbbell,
  Flame,
  Lock,
  MapPin,
  PartyPopper,
  Target,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getStreakLevel } from "../social/streak";
import type { EnrichedUser } from "../social/types";
import { AvatarConsistencyRings } from "./AvatarConsistencyRings";

/**
 * ProfileIdentity — Sprint 3.5.2.
 *
 * Reformulado pra trazer de volta o "círculo" como assinatura visual do
 * Gym Circle. A foto do usuário fica centralizada com 3 rings ao redor
 * (semana / mês / ano — `AvatarConsistencyRings`). Informações ficam
 * ABAIXO da foto, centralizadas.
 *
 * Layout (top → bottom):
 *
 *   [AvatarConsistencyRings]   ← foto + 3 rings (interativo, abre MyCircleSheet)
 *
 *   Nome grande
 *   @username
 *
 *   [🔥 streak] [nível] [📍 academia]   ← chips compactos
 *
 *   Bio
 *
 *   [Posts][Seguidores][Seguindo]
 *
 *   [actions slot — Editar/Admin ou Follow/Mensagem/Flag/Block]
 *
 * Compartilhado por:
 * - `ProfileScreen` (aba "Perfil") — próprio usuário
 * - `ProfileSheet` (overlay) — clicar em user na publicação
 *
 * Decisão importante (Sprint 3.5): streak NÃO vai mais dentro do ring.
 * Vira chip discreto na row de chips. Os rings representam consistência
 * contínua (semana/mês/ano), streak é progresso atual.
 */

type ProfileIdentityProps = {
  user: EnrichedUser;
  postsCount: number;
  hasStory?: boolean;
  storyViewed?: boolean;
  onOpenStory?: () => void;
  onOpenFollowers?: () => void;
  onOpenFollowing?: () => void;
  /** Tap nos rings (e na foto) → abre MyCircleSheet (Fase 3.5.3). */
  onOpenMyCircle?: () => void;
  /** Tamanho dos rings (default 180px — assinatura visual). */
  ringsSize?: number;
  /** Slot de ações (Editar/Admin ou Follow/Mensagem/Flag/Block). */
  actions?: ReactNode;
};

export function ProfileIdentity({
  user,
  postsCount,
  hasStory = false,
  storyViewed = false,
  // onOpenStory recebido mas não usado por enquanto — o tap nos rings vai
  // pro `onOpenMyCircle`. Caller pode adicionar entry-point separado de story
  // (ex: tap no nome) numa próxima sprint.
  onOpenFollowers,
  onOpenFollowing,
  onOpenMyCircle,
  ringsSize = 180,
  actions,
}: ProfileIdentityProps) {
  const { t } = useTranslation();
  const mainGym = user.gyms[0];
  const level = getStreakLevel(user.currentStreak);
  const hasStreakChip = user.currentStreak > 0 || user.streakLitToday;
  const sports = user.sports ?? [];
  const preferredTimes = user.preferredTimes ?? [];
  const detailChips: Array<{ key: string; label: string; Icon: LucideIcon }> = [
    ...(user.goal ? [{ key: "goal", label: user.goal, Icon: Target }] : []),
    ...(user.age
      ? [
          {
            key: "age",
            label: t("profile.ageYears", {
              count: user.age,
              defaultValue: "{{count}} anos",
            }),
            Icon: CalendarDays,
          },
        ]
      : []),
    ...(user.instagramUsername
      ? [{ key: "instagram", label: `@${user.instagramUsername}`, Icon: AtSign }]
      : []),
    ...(preferredTimes.length
      ? [
          {
            key: "preferredTimes",
            label: preferredTimes.slice(0, 2).join(", "),
            Icon: Clock3,
          },
        ]
      : []),
  ];
  const visibleSports = sports.slice(0, 4);
  const hiddenSportsCount = Math.max(sports.length - visibleSports.length, 0);

  return (
    <div className="flex flex-col items-center text-center">
      {/* Assinatura visual: foto centralizada + 3 rings ao redor */}
      <AvatarConsistencyRings
        hasStory={hasStory}
        onTap={onOpenMyCircle}
        size={ringsSize}
        storyViewed={storyViewed}
        user={user}
      />

      {/* Nome + @username */}
      <div className="mt-4 flex w-full max-w-[320px] flex-col items-center gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="min-w-0 truncate text-[22px] font-black leading-tight text-white">
            {user.name}
          </h2>
          {user.isPrivate ? (
            <Lock
              aria-label={t("profile.private")}
              className="shrink-0 text-white/52"
              size={14}
              strokeWidth={2.6}
            />
          ) : null}
        </div>
        <p className="truncate text-[13px] font-bold text-white/52">
          @{user.username}
        </p>
      </div>

      {/* Chips: streak • nível • academia principal */}
      {hasStreakChip || mainGym ? (
        <div className="mt-3 flex max-w-full flex-wrap items-center justify-center gap-1.5">
          {hasStreakChip ? (
            <span
              className={[
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black",
                user.streakLitToday
                  ? "bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]"
                  : "bg-white/[0.06] text-white/72",
              ].join(" ")}
            >
              <Flame
                fill={user.streakLitToday ? "currentColor" : "none"}
                size={11}
                strokeWidth={2.6}
              />
              {user.currentStreak}d
            </span>
          ) : null}
          {hasStreakChip ? (
            <span className="inline-flex items-center rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-black text-white/72">
              {level.shortLabel}
            </span>
          ) : null}
          {mainGym ? (
            <span className="inline-flex max-w-[200px] items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-black text-white/72">
              <MapPin className="shrink-0" size={11} strokeWidth={2.6} />
              <span className="truncate">{mainGym}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Bio */}
      {user.bio ? (
        <p className="mt-3 max-w-[340px] whitespace-pre-line text-[14px] font-medium leading-5 text-white/86">
          {user.bio}
        </p>
      ) : null}

      {detailChips.length > 0 || user.isBirthday || visibleSports.length > 0 ? (
        <div className="mt-3 flex max-w-[360px] flex-wrap items-center justify-center gap-1.5">
          {user.isBirthday ? (
            <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-[var(--gc-brand)]/14 px-2.5 py-1 text-[11px] font-black text-[var(--gc-brand)]">
              <PartyPopper className="shrink-0" size={11} strokeWidth={2.6} />
              <span className="truncate">
                {t("profile.birthdayToday", { defaultValue: "Aniversário hoje" })}
              </span>
            </span>
          ) : null}
          {detailChips.map(({ key, label, Icon }) => (
            <span
              className="inline-flex min-w-0 max-w-[210px] items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-black text-white/72"
              key={key}
            >
              <Icon className="shrink-0" size={11} strokeWidth={2.6} />
              <span className="truncate">{label}</span>
            </span>
          ))}
          {visibleSports.map((sport) => (
            <span
              className="inline-flex min-w-0 max-w-[160px] items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-black text-white/64"
              key={sport}
            >
              <Dumbbell className="shrink-0" size={11} strokeWidth={2.6} />
              <span className="truncate">{sport}</span>
            </span>
          ))}
          {hiddenSportsCount > 0 ? (
            <span className="inline-flex items-center rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-black text-white/54">
              +{hiddenSportsCount}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Stats: Posts • Seguidores • Seguindo */}
      <div className="mt-4 grid w-full max-w-[320px] grid-cols-3 gap-1">
        <ProfileStat label={t("profile.stats.posts")} value={postsCount} />
        <ProfileStat
          label={t("profile.stats.followers")}
          onClick={onOpenFollowers}
          value={user.followersCount}
        />
        <ProfileStat
          label={t("profile.stats.following")}
          onClick={onOpenFollowing}
          value={user.followingCount}
        />
      </div>

      {actions ? <div className="mt-4 w-full max-w-[420px]">{actions}</div> : null}
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
        className="gc-pressable min-w-0 rounded-[12px] px-1 py-1.5 text-center"
        onClick={onClick}
        type="button"
      >
        {content}
      </button>
    );
  }
  return <div className="min-w-0 px-1 py-1.5">{content}</div>;
}

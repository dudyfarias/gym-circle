import { AtSign, BadgeCheck, Cake, Dumbbell, UsersRound } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { buildConsistencyRings } from "../social/streak";
import type { EnrichedUser } from "../social/types";
import { AchievementBadge } from "./AchievementBadge";
import { ActivityCircle } from "./ActivityCircle";
import { StreakBadge } from "./StreakBadge";

type ProfileHeaderProps = {
  user: EnrichedUser;
  compact?: boolean;
  hasStory?: boolean;
  storyViewed?: boolean;
  onOpenStory?: () => void;
};

export function ProfileHeader({
  user,
  compact = false,
  hasStory = false,
  storyViewed = false,
  onOpenStory,
}: ProfileHeaderProps) {
  const avatarSize: "md" | "lg" = compact ? "md" : "lg";
  const avatarFrameClass = compact ? "size-[68px]" : "size-[86px]";
  const activitySize = compact ? 108 : 132;
  const achievementsLimit = compact ? 1 : 2;
  const sportsLimit = compact ? 2 : 3;
  const storyAvatar = (
    <div className={hasStory ? "rounded-full bg-black p-[3px]" : ""}>
      <Avatar
        accent="var(--gc-brand)"
        name={user.name}
        size={avatarSize}
        src={user.avatarUrl ?? undefined}
      />
    </div>
  );
  const rings = buildConsistencyRings({
    activeDaysCount: user.activeDaysCount,
    streakLitToday: user.streakLitToday,
    workoutsThisMonth: user.workoutsThisMonth,
  });

  return (
    <section className={["gc-glass-strong", compact ? "rounded-[30px] p-4" : "rounded-[36px] p-5"].join(" ")}>
      <div className={["flex items-start justify-between", compact ? "gap-3" : "gap-5"].join(" ")}>
        <div className="min-w-0 flex-1">
          {hasStory && onOpenStory ? (
            <button
              aria-label={`Ver story de ${user.name}`}
              className={[
                "gc-pressable relative grid place-items-center rounded-full p-[3px]",
                avatarFrameClass,
                storyViewed ? "bg-white/[0.13]" : "gc-story-ring",
              ].join(" ")}
              onClick={onOpenStory}
              type="button"
            >
              {storyAvatar}
            </button>
          ) : (
            <div className={["grid place-items-center", avatarFrameClass].join(" ")}>
              {storyAvatar}
            </div>
          )}
          <div className="mt-4 flex items-center gap-2">
            <h2
              className={[
                "font-black",
                compact
                  ? "max-w-[150px] text-[22px] leading-[1.02] [overflow-wrap:anywhere]"
                  : "truncate text-[27px] leading-tight",
              ].join(" ")}
            >
              {user.name}
            </h2>
            <BadgeCheck size={20} className="text-[var(--gc-brand)]" fill="currentColor" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StreakBadge
              best={user.longestStreak}
              isLit={user.streakLitToday}
              showLevel
              streak={user.currentStreak}
            />
            <span className="inline-flex h-9 items-center gap-2 rounded-full bg-white/[0.06] px-3 text-[12px] font-black text-white/58">
              <UsersRound size={14} />
              {user.followersCount.toLocaleString("pt-BR")}
            </span>
            {user.age ? (
              <span className="inline-flex h-9 items-center rounded-full bg-white/[0.06] px-3 text-[12px] font-black text-white/58">
                {user.age} anos
              </span>
            ) : null}
          </div>
          <p
            className={[
              "mt-3 overflow-hidden font-bold text-zinc-400",
              compact
                ? "max-h-[42px] max-w-[190px] text-[12px] leading-[18px]"
                : "max-w-[230px] text-[14px] leading-5",
            ].join(" ")}
          >
            {user.bio}
          </p>
          {user.instagramUsername || user.isBirthday ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {user.instagramUsername ? (
                <AchievementBadge
                  icon={<AtSign size={13} />}
                  label={`@${user.instagramUsername}`}
                  tone="blue"
                />
              ) : null}
              {user.isBirthday ? (
                <AchievementBadge
                  icon={<Cake size={13} />}
                  label="Aniversário"
                  tone="energy"
                />
              ) : null}
            </div>
          ) : null}
          {user.sports?.length ? (
            <div className={["mt-3 flex flex-wrap gap-2", compact ? "max-w-[190px]" : "max-w-[240px]"].join(" ")}>
              {user.sports.slice(0, sportsLimit).map((sport) => (
                <span
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.055] px-3 text-[11px] font-black text-white/58"
                  key={sport}
                >
                  <Dumbbell size={12} />
                  {sport}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {user.achievements.slice(0, achievementsLimit).map((achievement) => (
              <AchievementBadge key={achievement} label={achievement} tone="brand" />
            ))}
          </div>
        </div>
        <div className="shrink-0">
          <ActivityCircle
            centerLabel="streak"
            centerValue={String(user.currentStreak)}
            rings={rings}
            size={activitySize}
          />
          <div className="mt-2 flex justify-center gap-2 text-[9px] font-black uppercase text-white/36">
            <span className="text-[var(--gc-consistency-daily)]">Dia</span>
            <span className="text-[var(--gc-consistency-month)]">Mes</span>
            <span className="text-[var(--gc-consistency-year)]">Ano</span>
          </div>
        </div>
      </div>
    </section>
  );
}

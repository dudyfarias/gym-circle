import { AtSign, BadgeCheck, Cake, Dumbbell, UsersRound } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { buildConsistencyRings } from "../social/streak";
import type { EnrichedUser } from "../social/types";
import { AchievementBadge } from "./AchievementBadge";
import { ActivityCircle } from "./ActivityCircle";
import { StreakBadge } from "./StreakBadge";

type ProfileHeaderProps = {
  user: EnrichedUser;
};

export function ProfileHeader({ user }: ProfileHeaderProps) {
  const rings = buildConsistencyRings({
    activeDaysCount: user.activeDaysCount,
    streakLitToday: user.streakLitToday,
    workoutsThisMonth: user.workoutsThisMonth,
  });

  return (
    <section className="gc-glass-strong rounded-[36px] p-5">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <Avatar
            accent="var(--gc-brand)"
            name={user.name}
            size="lg"
            src={user.avatarUrl ?? undefined}
          />
          <div className="mt-4 flex items-center gap-2">
            <h2 className="truncate text-[27px] font-black leading-tight">
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
          <p className="mt-3 max-w-[230px] text-[14px] font-bold leading-5 text-zinc-400">
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
            <div className="mt-3 flex max-w-[240px] flex-wrap gap-2">
              {user.sports.slice(0, 3).map((sport) => (
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
            {user.achievements.slice(0, 2).map((achievement) => (
              <AchievementBadge key={achievement} label={achievement} tone="brand" />
            ))}
          </div>
        </div>
        <div className="shrink-0">
          <ActivityCircle
            centerLabel="streak"
            centerValue={String(user.currentStreak)}
            rings={rings}
            size={132}
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

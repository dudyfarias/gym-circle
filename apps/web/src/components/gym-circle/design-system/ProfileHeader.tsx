import { AtSign, BadgeCheck, Cake, Dumbbell, MapPin } from "lucide-react";
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
  showIdentity?: boolean;
  postsCount?: number;
};

export function ProfileHeader({
  user,
  compact = false,
  hasStory = false,
  storyViewed = false,
  onOpenStory,
  showIdentity = true,
  postsCount,
}: ProfileHeaderProps) {
  const avatarSize: "md" | "lg" = compact ? "md" : "lg";
  const avatarFrameClass = compact ? "size-[68px]" : "size-[86px]";
  const activitySize = compact ? 114 : 142;
  const achievementsLimit = compact ? 1 : 2;
  const sportsLimit = compact ? 2 : 3;
  const mainGym = user.gyms[0];
  const rings = buildConsistencyRings({
    activeDaysCount: user.activeDaysCount,
    streakLitToday: user.streakLitToday,
    workoutsThisMonth: user.workoutsThisMonth,
  });
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

  return (
    <section className={["gc-glass-strong", compact ? "rounded-[30px] p-4" : "rounded-[36px] p-5"].join(" ")}>
      {showIdentity ? (
        <div>
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
              <div className="mt-4 flex min-w-0 items-center gap-2">
                <h2
                  className={[
                    "min-w-0 font-black",
                    compact
                      ? "max-w-[150px] truncate text-[22px] leading-[1.02]"
                      : "truncate text-[27px] leading-tight",
                  ].join(" ")}
                >
                  {user.name}
                </h2>
                <BadgeCheck className="shrink-0 text-[var(--gc-brand)]" fill="currentColor" size={20} />
              </div>
            </div>
            <ActivityCircle
              centerLabel="streak"
              centerValue={String(user.currentStreak)}
              rings={rings}
              showLegend
              size={activitySize}
            />
          </div>
          <ProfileCounters postsCount={postsCount} user={user} />
          <ProfileMeta
            achievementsLimit={achievementsLimit}
            mainGym={mainGym}
            postsCount={postsCount}
            showCounters={false}
            sportsLimit={sportsLimit}
            user={user}
          />
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StreakBadge
                  best={user.longestStreak}
                  isLit={user.streakLitToday}
                  showLevel
                  streak={user.currentStreak}
                />
                {user.isBirthday ? (
                  <AchievementBadge icon={<Cake size={13} />} label="Aniversário" tone="energy" />
                ) : null}
              </div>
            </div>
            <ActivityCircle
              centerLabel="streak"
              centerValue={String(user.currentStreak)}
              rings={rings}
              showLegend
              size={activitySize}
            />
          </div>
          <ProfileCounters postsCount={postsCount} user={user} />
          <ProfileMeta
            compact
            achievementsLimit={achievementsLimit}
            mainGym={mainGym}
            postsCount={postsCount}
            sportsLimit={sportsLimit}
            user={user}
          />
        </div>
      )}
    </section>
  );
}

function ProfileCounters({
  postsCount,
  user,
}: {
  postsCount?: number;
  user: EnrichedUser;
}) {
  const items = [
    { label: "Posts", value: postsCount ?? 0 },
    { label: "Seguidores", value: user.followersCount },
    { label: "Seguindo", value: user.followingCount },
  ];

  return (
    <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-[22px] border border-white/[0.07] bg-white/[0.045]">
      {items.map((item) => (
        <div className="min-w-0 px-2 py-3 text-center" key={item.label}>
          <p className="truncate text-[17px] font-black text-white">
            {item.value.toLocaleString("pt-BR")}
          </p>
          <p className="mt-0.5 text-[8px] font-black leading-none text-white/38">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function ProfileMeta({
  achievementsLimit,
  compact = false,
  mainGym,
  postsCount,
  showCounters = true,
  sportsLimit,
  user,
}: {
  achievementsLimit: number;
  compact?: boolean;
  mainGym?: string;
  postsCount?: number;
  showCounters?: boolean;
  sportsLimit: number;
  user: EnrichedUser;
}) {
  return (
    <>
      {showCounters && !compact ? <ProfileCounters postsCount={postsCount} user={user} /> : null}
      {user.bio ? (
        <p
          className={[
            "mt-3 overflow-hidden font-bold text-zinc-400",
            compact
              ? "max-h-[38px] text-[12px] leading-[19px]"
              : "max-w-[260px] text-[14px] leading-5",
          ].join(" ")}
        >
          {user.bio}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {user.instagramUsername ? (
          <AchievementBadge icon={<AtSign size={13} />} label={`@${user.instagramUsername}`} tone="blue" />
        ) : null}
        {user.age ? (
          <span className="inline-flex h-8 items-center rounded-full bg-white/[0.055] px-3 text-[11px] font-black text-white/58">
            {user.age} anos
          </span>
        ) : null}
        {mainGym ? (
          <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-white/[0.055] px-3 py-2 text-[11px] font-black text-white/58">
            <MapPin className="shrink-0" size={12} />
            <span className="truncate">{mainGym}</span>
          </span>
        ) : null}
        {user.isBirthday && !compact ? (
          <AchievementBadge icon={<Cake size={13} />} label="Aniversário" tone="energy" />
        ) : null}
      </div>
      {user.sports?.length ? (
        <div className={["mt-3 flex flex-wrap gap-2", compact ? "" : "max-w-[260px]"].join(" ")}>
          {user.sports.slice(0, sportsLimit).map((sport) => (
            <span
              className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-white/[0.055] px-3 py-2 text-[11px] font-black text-white/58"
              key={sport}
            >
              <Dumbbell className="shrink-0" size={12} />
              <span className="truncate">{sport}</span>
            </span>
          ))}
        </div>
      ) : null}
      {user.achievements.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {user.achievements.slice(0, achievementsLimit).map((achievement) => (
            <AchievementBadge key={achievement} label={achievement} tone="brand" />
          ))}
        </div>
      ) : null}
    </>
  );
}

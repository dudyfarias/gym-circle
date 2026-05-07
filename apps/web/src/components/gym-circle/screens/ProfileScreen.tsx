import {
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  LogOut,
  MapPin,
  Pencil,
  Trophy,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import {
  AchievementBadge,
  ProfileHeader,
  StatsWidget,
  StreakBadge,
} from "../design-system";
import { formatWorkoutDate } from "../social/streak";
import type { EnrichedUser } from "../social/types";
import { TopBar } from "../TopBar";

type ProfileScreenProps = {
  currentUser: EnrichedUser;
  nearbyUsers: EnrichedUser[];
  onToggleFollow: (userId: string) => void | Promise<void>;
  onEditProfile?: () => void;
  onSignOut?: () => void | Promise<void>;
  onSelectUser?: (userId: string) => void;
};

export function ProfileScreen({
  currentUser,
  nearbyUsers,
  onToggleFollow,
  onEditProfile,
  onSignOut,
  onSelectUser,
}: ProfileScreenProps) {
  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar eyebrow="Perfil" title={currentUser.name} />

      {(onEditProfile || onSignOut) ? (
        <div className="mt-3 flex gap-2">
          {onEditProfile ? (
            <button
              className="gc-pressable flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-4 text-[13px] font-black text-white"
              onClick={onEditProfile}
              type="button"
            >
              <Pencil size={15} strokeWidth={2.6} />
              Editar perfil
            </button>
          ) : null}
          {onSignOut ? (
            <button
              aria-label="Sair"
              className="gc-pressable grid size-11 place-items-center rounded-full border border-white/[0.1] bg-white/[0.04] text-white/72"
              onClick={onSignOut}
              type="button"
            >
              <LogOut size={16} strokeWidth={2.6} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5">
        <ProfileHeader user={currentUser} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatsWidget
          tone="blue"
          detail="Histórico"
          icon={<Trophy size={18} />}
          label="Maior"
          value={`${currentUser.longestStreak}d`}
        />
        <StatsWidget
          tone="brand"
          detail="Maio"
          icon={<CalendarDays size={18} />}
          label="Treinos"
          value={String(currentUser.workoutsThisMonth)}
        />
        <StatsWidget
          tone="brand"
          detail="Com foto"
          icon={<Dumbbell size={18} />}
          label="Dias ativos"
          value={String(currentUser.activeDaysCount)}
        />
        <StatsWidget
          tone="blue"
          detail="Locais"
          icon={<MapPin size={18} />}
          label="Check-ins"
          value={String(currentUser.checkInsCount)}
        />
      </div>

      <div className="gc-ios-sheet mt-4 flex items-center justify-between gap-3 rounded-[24px] p-4">
        <div>
          <p className="text-[13px] font-bold text-white/42">Ultimo treino</p>
          <p className="mt-1 text-[16px] font-black">
            {formatWorkoutDate(currentUser.lastWorkoutDate)}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {currentUser.achievements.map((achievement) => (
            <AchievementBadge key={achievement} label={achievement} tone="brand" />
          ))}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="mb-3 text-[17px] font-extrabold">Mesmo círculo</h3>
        <div className="space-y-3">
          {nearbyUsers.slice(0, 4).map((person) => (
            <div
              className="gc-ios-sheet flex items-center justify-between rounded-[24px] p-4"
              key={person.id}
            >
              <button
                className="gc-pressable flex flex-1 items-center gap-3 text-left"
                onClick={() => onSelectUser?.(person.id)}
                type="button"
              >
                <Avatar accent={person.accent} name={person.name} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[15px] font-bold">{person.name}</p>
                    <StreakBadge
                      isLit={person.streakLitToday}
                      size="xs"
                      streak={person.currentStreak}
                    />
                  </div>
                  <p className="text-[12px] font-semibold text-white/44">
                    {person.goal}
                  </p>
                </div>
              </button>
              <button
                className="gc-pressable"
                onClick={() => onToggleFollow(person.id)}
                type="button"
              >
                <AchievementBadge
                  icon={person.isFollowing ? <CheckCircle2 size={13} /> : undefined}
                  label={person.isFollowing ? "Seguindo" : "Seguir"}
                  tone={person.isFollowing ? "brand" : "blue"}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

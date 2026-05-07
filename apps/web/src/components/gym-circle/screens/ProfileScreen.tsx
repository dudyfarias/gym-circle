import {
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  MapPin,
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
  onToggleFollow: (userId: string) => void;
};

export function ProfileScreen({
  currentUser,
  nearbyUsers,
  onToggleFollow,
}: ProfileScreenProps) {
  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar eyebrow="Perfil" title={currentUser.name} />

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
              <div className="flex items-center gap-3">
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
              </div>
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

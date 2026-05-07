import {
  Navigation,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AchievementBadge, GymCheckInCard, StreakBadge } from "../design-system";
import type { EnrichedUser } from "../social/types";
import { TopBar } from "../TopBar";

type CheckInScreenProps = {
  currentUser: EnrichedUser;
  nearbyUsers: EnrichedUser[];
  checkInsToday: number;
  onCheckIn: (gymName: string) => void;
  onToggleFollow: (userId: string) => void;
};

export function CheckInScreen({
  currentUser,
  nearbyUsers,
  checkInsToday,
  onCheckIn,
  onToggleFollow,
}: CheckInScreenProps) {
  const gymName = "Pulse Club";

  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar eyebrow="Check-in" title={gymName} />

      <div className="mt-5">
        <GymCheckInCard
          activePeople={checkInsToday + 19}
          circleCount={8}
          currentStreak={currentUser.currentStreak}
          focus="Força"
          longestStreak={currentUser.longestStreak}
          name={gymName}
          onCheckIn={() => onCheckIn(gymName)}
          peakTime="18h"
          streakLitToday={currentUser.streakLitToday}
        />
      </div>

      <button
        className="gc-pressable mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-black text-black"
        type="button"
      >
        <Navigation size={19} strokeWidth={2.8} />
        Abrir rotas
      </button>

      <div className="mt-5">
        <h3 className="mb-3 text-[17px] font-extrabold">Treinando por aqui</h3>
        <div className="space-y-3">
          {nearbyUsers.slice(0, 5).map((person) => (
            <div
              className="gc-ios-sheet flex items-center justify-between rounded-[24px] p-4"
              key={person.id}
            >
              <div className="flex items-center gap-3">
                <Avatar
                  accent={person.accent}
                  name={person.name}
                  src={person.avatarUrl ?? undefined}
                />
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
                    {person.goal} · {person.checkInsCount} check-ins
                  </p>
                </div>
              </div>
              <button
                className="gc-pressable"
                onClick={() => onToggleFollow(person.id)}
                type="button"
              >
                <AchievementBadge
                  label={
                    person.followStatus === "accepted"
                      ? "Seguindo"
                      : person.followStatus === "pending"
                        ? "Pendente"
                        : person.isPrivate
                          ? "Solicitar"
                          : "Seguir"
                  }
                  tone={
                    person.followStatus === "accepted"
                      ? "brand"
                      : person.followStatus === "pending"
                        ? "energy"
                        : "blue"
                  }
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

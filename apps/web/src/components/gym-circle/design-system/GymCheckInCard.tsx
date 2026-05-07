import { CheckCircle2, Clock3, Dumbbell, MapPin, UsersRound } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { StreakBadge } from "./StreakBadge";

type GymCheckInCardProps = {
  name: string;
  activePeople: number;
  peakTime: string;
  focus: string;
  circleCount: number;
  currentStreak: number;
  longestStreak: number;
  streakLitToday: boolean;
  onCheckIn: () => void;
};

export function GymCheckInCard({
  name,
  activePeople,
  peakTime,
  focus,
  circleCount,
  currentStreak,
  longestStreak,
  streakLitToday,
  onCheckIn,
}: GymCheckInCardProps) {
  return (
    <section className="gc-glass-strong rounded-[36px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-5 grid size-16 place-items-center rounded-[24px] bg-[var(--gc-brand)]/14 text-[var(--gc-brand)] shadow-[0_0_28px_rgba(92,232,255,0.18)]">
            <MapPin size={28} strokeWidth={2.5} />
          </div>
          <p className="text-[13px] font-bold text-white/48">{name}</p>
          <h2 className="mt-1 text-[30px] font-black leading-tight">
            {activePeople} pessoas treinando
          </h2>
          <div className="mt-4 flex items-center gap-2">
            <StreakBadge
              best={longestStreak}
              isLit={streakLitToday}
              showLevel
              size="sm"
              streak={currentStreak}
            />
            <span className="text-[12px] font-bold text-white/42">
              seu status no check-in
            </span>
          </div>
        </div>
        <IconButton active label="Confirmar check-in" onClick={onCheckIn}>
          <CheckCircle2 size={19} strokeWidth={2.8} />
        </IconButton>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        {[
          { label: "Pico", value: peakTime, icon: Clock3 },
          { label: "Foco", value: focus, icon: Dumbbell },
          { label: "Circle", value: String(circleCount), icon: UsersRound },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div
              className="rounded-[22px] bg-white/[0.055] p-3 text-center"
              key={item.label}
            >
              <Icon className="mx-auto mb-2 text-white/54" size={17} />
              <p className="text-[12px] font-bold text-white/38">{item.label}</p>
              <p className="mt-1 text-[14px] font-black">{item.value}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

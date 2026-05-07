import { Check } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatsWidget, StreakCard } from "../design-system";
import { getAllStreakLevels, getStreakLevel } from "../social/streak";
import type { EnrichedUser } from "../social/types";
import { TopBar } from "../TopBar";

type StreakScreenProps = {
  currentUser: EnrichedUser;
  monthDays: Array<{
    day: number;
    dateKey: string;
    trained: boolean;
  }>;
};

export function StreakScreen({ currentUser, monthDays }: StreakScreenProps) {
  const currentLevel = getStreakLevel(currentUser.currentStreak);

  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar eyebrow="Consistência" title="Streak" />

      <div className="mt-5">
        <StreakCard
          activeDaysCount={currentUser.activeDaysCount}
          current={currentUser.currentStreak}
          isLit={currentUser.streakLitToday}
          longest={currentUser.longestStreak}
          monthWorkouts={currentUser.workoutsThisMonth}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatsWidget
          tone="blue"
          detail="Seu recorde"
          label="Maior streak"
          value={String(currentUser.longestStreak)}
        />
        <StatsWidget
          tone="brand"
          detail="Com foto"
          label="Treinos mês"
          value={String(currentUser.workoutsThisMonth)}
        />
        <StatsWidget
          tone="brand"
          detail="Historico"
          label="Dias ativos"
          value={String(currentUser.activeDaysCount)}
        />
        <StatsWidget
          tone="blue"
          detail="Social"
          label="Check-ins"
          value={String(currentUser.checkInsCount)}
        />
      </div>

      <GlassCard className="mt-5 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[17px] font-extrabold">Níveis</h3>
          <span className="text-[12px] font-black text-white/36">
            status público
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {getAllStreakLevels().map((level) => (
            <div
              className={[
                "rounded-[22px] border p-3",
                level.id === currentLevel.id
                  ? "border-[var(--gc-consistency-month)]/28 bg-[var(--gc-consistency-quiet)]"
                  : "border-white/[0.07] bg-white/[0.04]",
              ].join(" ")}
              key={level.id}
            >
              <p className="text-[14px] font-black">{level.label}</p>
              <p className="mt-1 text-[12px] font-bold text-white/42">
                {level.minDays}+ dias
              </p>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="mt-5 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[17px] font-extrabold">Maio</h3>
          <span className="rounded-full bg-[var(--gc-consistency-quiet)] px-3 py-2 text-[12px] font-extrabold text-[var(--gc-consistency-daily)]">
            {currentUser.workoutsThisMonth} treinos
          </span>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {monthDays.map((item) => (
            <div
              className={[
                "grid aspect-square place-items-center rounded-full text-[12px] font-extrabold transition-transform duration-200",
                item.trained
                  ? "bg-[radial-gradient(circle_at_35%_25%,var(--gc-consistency-daily),var(--gc-consistency-month)_52%,var(--gc-consistency-year))] text-black shadow-[0_0_18px_rgba(48,213,255,0.32)]"
                  : "bg-white/[0.055] text-white/34",
              ].join(" ")}
              key={item.day}
            >
              {item.trained ? <Check size={14} strokeWidth={3} /> : item.day}
            </div>
          ))}
        </div>
      </GlassCard>
    </section>
  );
}

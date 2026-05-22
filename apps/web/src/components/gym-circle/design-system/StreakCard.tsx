import { Flame, ShieldCheck } from "lucide-react";
import {
  buildConsistencyRings,
  formatStreakDays,
  getConsistencyProgress,
  getStreakLevel,
} from "../social/streak";
import { ActivityCircle } from "./ActivityCircle";
import { AchievementBadge } from "./AchievementBadge";
import { StreakBadge } from "./StreakBadge";

type StreakCardProps = {
  current: number;
  longest: number;
  /** Sprint 3.5: opcional. Quando não vier, derivamos um fallback. */
  weekWorkouts?: number;
  monthWorkouts: number;
  /** Year-scoped (vem de `user_stats.active_days_this_year` no Supabase). */
  activeDaysCount: number;
  isLit: boolean;
};

export function StreakCard({
  current,
  longest,
  weekWorkouts,
  monthWorkouts,
  activeDaysCount,
  isLit,
}: StreakCardProps) {
  const level = getStreakLevel(current);
  // Sprint 3.5: novo input dos rings = workoutsThisWeek/Month/Year (denominador
  // do período inteiro). Sem `weekWorkouts` explícito, estimamos pelo streak
  // atual (no máximo 7 dias) — fallback razoável até GamificationService trazer
  // dado real via `user_activity_days`.
  const weekCount = weekWorkouts ?? Math.min(current, 7);
  const consistencyInput = {
    workoutsThisWeek: weekCount,
    workoutsThisMonth: monthWorkouts,
    workoutsThisYear: activeDaysCount,
  };
  const progress = getConsistencyProgress(consistencyInput);
  const rings = buildConsistencyRings(consistencyInput);

  return (
    <section className="gc-brand-card rounded-[36px] p-5">
      <div className="flex items-center justify-between gap-5">
        <div className="min-w-0">
          <AchievementBadge
            icon={<ShieldCheck size={15} strokeWidth={2.6} />}
            label={isLit ? "Badge aceso hoje" : "Pronto para acender"}
            tone="brand"
          />
          <h2 className="mt-5 text-[36px] font-black leading-[0.95]">
            {formatStreakDays(current)}
          </h2>
          <p className="mt-2 text-[14px] font-bold text-zinc-400">
            {isLit
              ? `Status ${level.label.toLowerCase()} aceso no circle.`
              : `Status ${level.label.toLowerCase()} aguardando seu post.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StreakBadge best={longest} isLit={isLit} showLevel streak={current} />
            <AchievementBadge label={`${monthWorkouts} treinos no mes`} tone="brand" />
          </div>
        </div>
        <ActivityCircle
          centerLabel="dias"
          centerValue={String(current)}
          rings={rings}
          size={138}
        />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          {
            label: "Dia",
            value: isLit ? "aceso" : "pendente",
            color: "var(--gc-consistency-daily)",
          },
          {
            label: "Mês",
            value: `${Math.round(progress.month)}%`,
            color: "var(--gc-consistency-month)",
          },
          {
            label: "Ano",
            value: `${Math.round(progress.year)}%`,
            color: "var(--gc-consistency-year)",
          },
        ].map((item) => (
          <div
            className="rounded-[18px] border border-white/[0.07] bg-white/[0.04] px-3 py-2"
            key={item.label}
          >
            <p
              className="text-[11px] font-black uppercase"
              style={{ color: item.color }}
            >
              {item.label}
            </p>
            <p className="mt-1 text-[12px] font-black text-white/72">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/32 px-3 py-2 text-[12px] font-black text-white/72 backdrop-blur-xl">
        <Flame size={14} className="text-[var(--gc-consistency-daily)]" fill="currentColor" />
        Quem posta, cresce.
      </div>
    </section>
  );
}

import type { ReactNode } from "react";
import { CalendarDays, ChevronRight, Lock, MapPin, Share2, Sparkles } from "lucide-react";
import type { MonthlyRecap } from "../social/monthlyRecap";

type MonthlyRecapCardProps = {
  recap: MonthlyRecap;
  onOpen?: () => void;
};

export function MonthlyRecapCard({ recap, onOpen }: MonthlyRecapCardProps) {
  const ctaLabel = recap.isAvailable
    ? "Criar post do mês"
    : `Libera em ${recap.releaseLabel}`;

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#070809] p-4 shadow-[0_24px_68px_rgba(0,0,0,0.46)]">
      {recap.coverImageUrl ? (
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center opacity-[0.34] blur-[1px] saturate-[0.9]"
          style={{ backgroundImage: `url(${recap.coverImageUrl})` }}
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.42),rgba(0,0,0,0.96)),radial-gradient(circle_at_82%_12%,rgba(48,213,255,0.26),transparent_34%),radial-gradient(circle_at_12%_92%,rgba(0,102,255,0.24),transparent_42%)]" />

      <div className="relative">
        <div className="mb-7 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-10 place-items-center rounded-full bg-[var(--gc-brand)]/13 text-[var(--gc-brand)] shadow-[0_0_24px_rgba(48,213,255,0.18)]">
              <Sparkles size={18} strokeWidth={2.6} />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/42">
                Resumo mensal
              </p>
              <p className="text-[14px] font-black capitalize text-white">
                {recap.monthLabel}
              </p>
            </div>
          </div>
          <span
            className={[
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-black",
              recap.isAvailable
                ? "bg-[var(--gc-brand)] text-black"
                : "border border-white/[0.1] bg-white/[0.05] text-white/52",
            ].join(" ")}
          >
            {recap.isAvailable ? <Share2 size={13} /> : <Lock size={13} />}
            {recap.isAvailable ? "Pronto" : `${recap.daysUntilRelease}d`}
          </span>
        </div>

        <div className="max-w-[260px]">
          <p className="text-[13px] font-bold text-white/48">Seu mês em movimento</p>
          <h3 className="mt-1 text-[42px] font-black leading-none tracking-normal text-white">
            {recap.trainedDaysLabel}
          </h3>
          <p className="mt-2 text-[13px] font-bold leading-5 text-white/58">
            Visual pronto para Instagram, liberado no fechamento do mês.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <RecapMiniStat
            icon={<CalendarDays size={14} />}
            label="Mais treinado"
            value={recap.topWorkoutType}
          />
          <RecapMiniStat
            icon={<MapPin size={14} />}
            label="Lugar"
            value={recap.topLocation}
          />
        </div>

        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.12]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#8CFBFF,#30D5FF,#0066FF)] shadow-[0_0_22px_rgba(48,213,255,0.32)]"
            style={{ width: `${recap.progressPercent}%` }}
          />
        </div>

        <button
          className={[
            "gc-pressable mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[13px] font-black transition-opacity",
            recap.isAvailable
              ? "bg-white text-black"
              : "cursor-not-allowed border border-white/[0.1] bg-white/[0.04] text-white/42",
          ].join(" ")}
          disabled={!recap.isAvailable}
          onClick={onOpen}
          type="button"
        >
          {ctaLabel}
          {recap.isAvailable ? <ChevronRight size={16} strokeWidth={3} /> : null}
        </button>
      </div>
    </section>
  );
}

function RecapMiniStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-white/[0.08] bg-black/36 p-3 backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-1.5 text-[var(--gc-brand)]">
        {icon}
        <p className="text-[10px] font-black uppercase text-white/36">{label}</p>
      </div>
      <p className="truncate text-[13px] font-black text-white">{value}</p>
    </div>
  );
}

import { Crown, Flame, Shield, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { formatStreakDays, getStreakLevel } from "../social/streak";

type StreakBadgeProps = {
  streak: number;
  isLit?: boolean;
  best?: number;
  size?: "xs" | "sm" | "md";
  showLevel?: boolean;
  className?: string;
};

const sizeClass = {
  xs: "h-6 gap-1.5 px-1.5 pr-2 text-[10px]",
  sm: "h-8 gap-2 px-2 pr-2.5 text-[11px]",
  md: "h-9 gap-2 px-2.5 pr-3 text-[12px]",
};

const iconSize = {
  xs: 9,
  sm: 10,
  md: 11,
};

const ringSize = {
  xs: "size-[17px]",
  sm: "size-[20px]",
  md: "size-[22px]",
};

const coreSize = {
  xs: "size-[13px]",
  sm: "size-4",
  md: "size-[18px]",
};

const levelColor = {
  cyan: "var(--gc-consistency-daily)",
  electric: "var(--gc-consistency-month)",
  blue: "var(--gc-consistency-mid)",
  deep: "var(--gc-consistency-year)",
};

const levelIcon = {
  iniciante: Sparkles,
  consistente: Flame,
  elite: Shield,
  lendario: Crown,
};

export function StreakBadge({
  streak,
  isLit = true,
  best,
  size = "sm",
  showLevel = false,
  className = "",
}: StreakBadgeProps) {
  const level = getStreakLevel(streak);
  const Icon = levelIcon[level.id];
  const label = showLevel ? `${level.shortLabel} · ${streak}d` : `${streak}d`;
  const streakLabel = formatStreakDays(streak);
  const bestLabel = typeof best === "number" ? formatStreakDays(best) : null;
  const title = `${level.label} · ${streakLabel}${bestLabel ? ` · melhor ${bestLabel}` : ""}`;

  return (
    <span
      aria-label={`Streak atual de ${streakLabel}${
        bestLabel ? `, melhor ${bestLabel}` : ""
      }, badge ${isLit ? "aceso hoje" : "apagado hoje"}`}
      className={[
        "inline-flex shrink-0 items-center rounded-full border font-black backdrop-blur-xl",
        sizeClass[size],
        isLit ? "gc-streak-badge-lit" : "gc-streak-badge-dim",
        className,
      ].join(" ")}
      style={{
        "--gc-streak-color": levelColor[level.tone],
      } as CSSProperties}
      title={isLit ? `${title} · aceso hoje` : `${title} · poste para acender hoje`}
    >
      <span
        aria-hidden="true"
        className={["gc-streak-ring grid shrink-0 place-items-center rounded-full", ringSize[size]].join(" ")}
      >
        <span
          className={[
            "grid place-items-center rounded-full bg-[#090b0c]",
            coreSize[size],
          ].join(" ")}
        >
          <Icon size={iconSize[size]} fill="currentColor" strokeWidth={2.4} />
        </span>
      </span>
      {label}
    </span>
  );
}

import type { ReactNode } from "react";

type AchievementBadgeProps = {
  label: string;
  icon?: ReactNode;
  tone?: "brand" | "blue" | "deep" | "green" | "orange" | "pink" | "energy";
};

const toneClass = {
  brand: "bg-[var(--gc-brand)]/14 text-[var(--gc-brand)] shadow-[0_0_22px_rgba(92,232,255,0.16)]",
  blue: "bg-[var(--gc-consistency-month)]/14 text-[var(--gc-consistency-month)] shadow-[0_0_22px_rgba(48,213,255,0.16)]",
  deep: "bg-[var(--gc-consistency-year)]/14 text-[var(--gc-consistency-daily)] shadow-[0_0_22px_rgba(0,102,255,0.14)]",
  green: "bg-[var(--gc-green)]/14 text-[var(--gc-green)] shadow-[0_0_22px_rgba(48,213,255,0.14)]",
  orange: "bg-[var(--gc-orange)]/14 text-[var(--gc-orange)] shadow-[0_0_22px_rgba(255,159,10,0.14)]",
  pink: "bg-[var(--gc-pink)]/14 text-[var(--gc-pink)] shadow-[0_0_22px_rgba(255,45,85,0.14)]",
  energy: "bg-[var(--gc-energy)]/14 text-[var(--gc-energy)] shadow-[0_0_22px_rgba(140,251,255,0.14)]",
};

export function AchievementBadge({
  label,
  icon,
  tone = "brand",
}: AchievementBadgeProps) {
  return (
    <span
      className={[
        "inline-flex h-9 items-center gap-2 rounded-full px-3 text-[12px] font-black",
        toneClass[tone],
      ].join(" ")}
    >
      {icon}
      {label}
    </span>
  );
}

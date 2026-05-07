import type { ReactNode } from "react";

type StatsWidgetProps = {
  label: string;
  value: string;
  detail?: string;
  icon?: ReactNode;
  tone?: "brand" | "energy" | "blue" | "pink" | "orange" | "green";
};

const toneClass = {
  brand: "text-[var(--gc-brand)]",
  energy: "text-[var(--gc-energy)]",
  blue: "text-[var(--gc-blue)]",
  pink: "text-[var(--gc-pink)]",
  orange: "text-[var(--gc-orange)]",
  green: "text-[var(--gc-green)]",
};

export function StatsWidget({
  label,
  value,
  detail,
  icon,
  tone = "brand",
}: StatsWidgetProps) {
  return (
    <div className="gc-ios-sheet gc-pressable min-h-[132px] rounded-[26px] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-[13px] font-bold text-white/50">{label}</span>
        {icon ? (
          <span className={["grid size-8 place-items-center", toneClass[tone]].join(" ")}>
            {icon}
          </span>
        ) : null}
      </div>
      <p className={["text-[34px] font-black leading-none", toneClass[tone]].join(" ")}>
        {value}
      </p>
      {detail ? (
        <p className="mt-2 text-[13px] font-bold text-zinc-400">{detail}</p>
      ) : null}
    </div>
  );
}

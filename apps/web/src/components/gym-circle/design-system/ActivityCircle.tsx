import type { CSSProperties } from "react";

type ActivityCircleProps = {
  rings: Array<{
    id?: string;
    label?: string;
    color: string;
    glow?: string;
    value: number;
  }>;
  size?: number;
  centerValue?: string;
  centerLabel?: string;
  showLegend?: boolean;
};

export function ActivityCircle({
  rings,
  size = 152,
  centerValue,
  centerLabel,
  showLegend = false,
}: ActivityCircleProps) {
  const strokeWidth = Math.max(8, Math.round(size * 0.064));
  const gap = strokeWidth + Math.max(5, Math.round(size * 0.035));
  const center = size / 2;
  const centerValueSize = Math.max(24, Math.round(size * 0.24));
  const centerLabelSize = Math.max(9, Math.round(size * 0.075));
  const legend = [
    { id: "day", label: "Dia", color: "var(--gc-consistency-daily)" },
    { id: "month", label: "Mês", color: "var(--gc-consistency-month)" },
    { id: "year", label: "Ano", color: "var(--gc-consistency-year)" },
  ];

  return (
    <div
      aria-label={`Consistency rings: ${rings
        .map((ring) => `${ring.label ?? "ring"} ${Math.round(ring.value)}%`)
        .join(", ")}`}
      className="shrink-0"
      style={{ width: size }}
    >
      <div className="relative" style={{ height: size, width: size }}>
        <svg
          aria-hidden="true"
          className="absolute inset-0 overflow-visible"
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          width={size}
        >
          {rings.map((ring, index) => {
            const radius = center - strokeWidth / 2 - index * gap;
            const progress = Math.max(0, Math.min(ring.value, 100));
            const dashTarget = 100 - progress;

            return (
              <g key={`${ring.id ?? ring.color}-${index}`}>
                <circle
                  className="gc-activity-ring-track"
                  cx={center}
                  cy={center}
                  fill="none"
                  pathLength={100}
                  r={radius}
                  stroke="rgba(140,251,255,0.075)"
                  strokeWidth={strokeWidth}
                />
                <circle
                  className="gc-activity-ring-value"
                  cx={center}
                  cy={center}
                  fill="none"
                  pathLength={100}
                  r={radius}
                  stroke={ring.color}
                  strokeDasharray={100}
                  strokeDashoffset={dashTarget}
                  strokeLinecap="round"
                  strokeWidth={strokeWidth}
                  style={
                    {
                      "--gc-ring-target": dashTarget,
                      "--gc-ring-glow": ring.glow ?? "rgba(48,213,255,0.22)",
                      animationDelay: `${index * 110}ms`,
                      filter: ring.glow ? `drop-shadow(0 0 8px ${ring.glow})` : undefined,
                    } as CSSProperties
                  }
                />
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div className="max-w-[58%]">
            {centerValue ? (
              <p className="font-black leading-none" style={{ fontSize: centerValueSize }}>
                {centerValue}
              </p>
            ) : null}
            {centerLabel ? (
              <p
                className="mt-1 font-black uppercase leading-none text-white/44"
                style={{ fontSize: centerLabelSize }}
              >
                {centerLabel}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      {showLegend ? (
        <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[9px] font-black uppercase tracking-[0.08em]">
          {legend.map((item) => (
            <span className="truncate" key={item.id} style={{ color: item.color }}>
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useId } from "react";

export type WorkoutProgressChartPoint = {
  id: string;
  label: string;
  value: number | null;
};

type WorkoutProgressChartProps = {
  ariaLabel: string;
  emptyLabel: string;
  formatValue: (value: number) => string;
  points: WorkoutProgressChartPoint[];
  title: string;
};

const WIDTH = 340;
const HEIGHT = 168;
const PADDING_X = 18;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 24;

function finiteValue(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Gráfico leve, sem dependência externa. A representação visual é duplicada
 * numa lista acessível, então leitores de tela não dependem do SVG.
 */
export function WorkoutProgressChart({
  ariaLabel,
  emptyLabel,
  formatValue,
  points,
  title,
}: WorkoutProgressChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const validPoints = points.filter(
    (
      point,
    ): point is WorkoutProgressChartPoint & { value: number } =>
      finiteValue(point.value),
  );

  if (
    validPoints.length === 0 ||
    !validPoints.some((point) => point.value > 0)
  ) {
    return (
      <div className="rounded-[22px] border border-white/[0.07] bg-white/[0.025] px-4 py-7 text-center">
        <p className="text-[13px] font-bold leading-5 text-white/48">
          {emptyLabel}
        </p>
      </div>
    );
  }

  const values = validPoints.map((point) => point.value);
  const maximum = Math.max(...values);
  const minimum = Math.min(...values);
  const domainPadding = maximum === minimum ? Math.max(1, maximum * 0.12) : 0;
  const domainMin = Math.max(0, minimum - domainPadding);
  const domainMax = maximum + domainPadding;
  const domain = Math.max(1, domainMax - domainMin);
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const plotWidth = WIDTH - PADDING_X * 2;
  const pointIndex = new Map(points.map((point, index) => [point.id, index]));
  const coordinates = validPoints.map((point) => {
    const index = pointIndex.get(point.id) ?? 0;
    const x =
      points.length <= 1
        ? WIDTH / 2
        : PADDING_X + (index / (points.length - 1)) * plotWidth;
    const y =
      PADDING_TOP +
      (1 - ((point.value ?? domainMin) - domainMin) / domain) * plotHeight;
    return { ...point, x, y };
  });
  const line = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  const area = `${line} L${coordinates.at(-1)?.x ?? WIDTH - PADDING_X},${HEIGHT - PADDING_BOTTOM} L${coordinates[0]?.x ?? PADDING_X},${HEIGHT - PADDING_BOTTOM} Z`;
  const latest = coordinates.at(-1);

  return (
    <figure
      aria-label={ariaLabel}
      className="overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#0b0d0e]"
      role="img"
    >
      <figcaption className="flex items-end justify-between gap-3 px-4 pt-4">
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-white/42">
          {title}
        </span>
        {latest?.value != null ? (
          <span className="text-[15px] font-black tabular-nums text-white">
            {formatValue(latest.value)}
          </span>
        ) : null}
      </figcaption>

      <svg
        aria-hidden="true"
        className="mt-1 h-auto w-full"
        preserveAspectRatio="none"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--gc-brand)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--gc-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => {
          const y = PADDING_TOP + ratio * plotHeight;
          return (
            <line
              key={ratio}
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="1"
              x1={PADDING_X}
              x2={WIDTH - PADDING_X}
              y1={y}
              y2={y}
            />
          );
        })}
        {coordinates.length > 1 ? (
          <>
            <path d={area} fill={`url(#${gradientId})`} />
            <path
              d={line}
              fill="none"
              stroke="var(--gc-brand)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
            />
          </>
        ) : null}
        {coordinates.map((point, index) => (
          <g key={point.id}>
            <circle
              cx={point.x}
              cy={point.y}
              fill={
                index === coordinates.length - 1
                  ? "var(--gc-brand)"
                  : "#0b0d0e"
              }
              r={index === coordinates.length - 1 ? 5 : 3.5}
              stroke="var(--gc-brand)"
              strokeWidth="2.5"
            />
          </g>
        ))}
        <text
          fill="rgba(255,255,255,0.38)"
          fontSize="9"
          fontWeight="800"
          x={PADDING_X}
          y={HEIGHT - 7}
        >
          {points[0]?.label ?? ""}
        </text>
        <text
          fill="rgba(255,255,255,0.38)"
          fontSize="9"
          fontWeight="800"
          textAnchor="end"
          x={WIDTH - PADDING_X}
          y={HEIGHT - 7}
        >
          {points.at(-1)?.label ?? ""}
        </text>
      </svg>

      <ol className="sr-only">
        {validPoints.map((point) => (
          <li key={point.id}>
            {point.label}: {formatValue(point.value)}
          </li>
        ))}
      </ol>
    </figure>
  );
}

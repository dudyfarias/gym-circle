"use client";

import { HeartPulse } from "lucide-react";
import { useMemo } from "react";
import type { ActivityHeartRateSample } from "@gym-circle/core";

type ActivityHeartRateSectionProps = {
  samples: ActivityHeartRateSample[];
  average: number | null;
  minimum: number | null;
  maximum: number | null;
  locale: string;
  timeZone: string;
  labels: {
    title: string;
    average: string;
    minimum: string;
    maximum: string;
  };
};

const WIDTH = 400;
const HEIGHT = 170;
const LEFT = 14;
const RIGHT = 14;
const TOP = 24;
const BOTTOM = 34;

export function ActivityHeartRateSection({
  samples,
  average,
  minimum,
  maximum,
  locale,
  timeZone,
  labels,
}: ActivityHeartRateSectionProps) {
  const chart = useMemo(() => {
    const valid = samples
      .flatMap((sample) => {
        const time = Date.parse(sample.timestamp);
        return Number.isFinite(time) && sample.bpm >= 20 && sample.bpm <= 260
          ? [{ time, bpm: sample.bpm }]
          : [];
      })
      .sort((first, second) => first.time - second.time);
    if (valid.length < 2) return null;
    const firstTime = valid[0].time;
    const lastTime = valid.at(-1)?.time ?? firstTime;
    const minBpm = Math.min(...valid.map((sample) => sample.bpm));
    const maxBpm = Math.max(...valid.map((sample) => sample.bpm));
    const bpmSpan = Math.max(12, maxBpm - minBpm);
    const timeSpan = Math.max(1, lastTime - firstTime);
    const points = valid.map((sample) => ({
      x: LEFT + ((sample.time - firstTime) / timeSpan) * (WIDTH - LEFT - RIGHT),
      y:
        TOP +
        (1 - (sample.bpm - minBpm) / bpmSpan) * (HEIGHT - TOP - BOTTOM),
    }));
    const formatTime = (timestamp: number) =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }).format(new Date(timestamp));
    return {
      path: points
        .map((point, index) =>
          `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
        )
        .join(" "),
      firstLabel: formatTime(firstTime),
      middleLabel: formatTime(firstTime + timeSpan / 2),
      lastLabel: formatTime(lastTime),
    };
  }, [locale, samples, timeZone]);

  if (!chart) return null;

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <HeartPulse className="text-[#FF5A49]" size={20} strokeWidth={2.5} />
        <h3 className="text-[20px] font-black text-white">{labels.title}</h3>
      </div>
      <div className="overflow-hidden rounded-[24px] border border-white/[0.055] bg-white/[0.045] p-4">
        <svg
          aria-label={labels.title}
          className="w-full"
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        >
          <defs>
            <linearGradient id="gc-heart-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#FF5A49" stopOpacity="0.28" />
              <stop offset="1" stopColor="#FF5A49" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
              x1={LEFT}
              x2={WIDTH - RIGHT}
              y1={TOP + ratio * (HEIGHT - TOP - BOTTOM)}
              y2={TOP + ratio * (HEIGHT - TOP - BOTTOM)}
            />
          ))}
          <path
            d={`${chart.path} L${WIDTH - RIGHT} ${HEIGHT - BOTTOM} L${LEFT} ${HEIGHT - BOTTOM} Z`}
            fill="url(#gc-heart-gradient)"
          />
          <path
            d={chart.path}
            fill="none"
            stroke="#FF5A49"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <text fill="rgba(255,255,255,0.42)" fontSize="11" x={LEFT} y={HEIGHT - 10}>
            {chart.firstLabel}
          </text>
          <text
            fill="rgba(255,255,255,0.42)"
            fontSize="11"
            textAnchor="middle"
            x={WIDTH / 2}
            y={HEIGHT - 10}
          >
            {chart.middleLabel}
          </text>
          <text
            fill="rgba(255,255,255,0.42)"
            fontSize="11"
            textAnchor="end"
            x={WIDTH - RIGHT}
            y={HEIGHT - 10}
          >
            {chart.lastLabel}
          </text>
        </svg>
        <div className="mt-1 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3">
          <HeartRateValue label={labels.minimum} value={minimum} />
          <HeartRateValue label={labels.average} value={average} />
          <HeartRateValue label={labels.maximum} value={maximum} />
        </div>
      </div>
    </section>
  );
}

function HeartRateValue({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-[9px] font-black uppercase tracking-[0.08em] text-white/38">
        {label}
      </p>
      <p className="mt-1 text-[16px] font-black tabular-nums text-[#FF5A49]">
        {value ? `${Math.round(value)} bpm` : "—"}
      </p>
    </div>
  );
}

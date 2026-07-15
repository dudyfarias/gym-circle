type ActivityMetric = {
  label: string;
  value: string;
  color: string;
  hint?: string | null;
};

export function ActivityMetricGrid({ metrics }: { metrics: ActivityMetric[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-[24px] border border-white/[0.055] bg-white/[0.045] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
      {metrics.map((metric) => (
        <div className="min-w-0" key={metric.label}>
          <p className="text-[12px] font-bold leading-tight text-white/55">
            {metric.label}
          </p>
          <p
            className="mt-1 truncate text-[24px] font-black leading-none tabular-nums"
            style={{ color: metric.color }}
          >
            {metric.value}
          </p>
          {metric.hint ? (
            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.08em] text-white/32">
              {metric.hint}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

import { Bike, Footprints, MapPin } from "lucide-react";
import { WorkoutRouteMap } from "./WorkoutRouteMap";

type OutdoorActivityHeroProps = {
  activityType: string;
  title: string;
  dateLabel: string;
  timeLabel: string | null;
  distanceLabel: string | null;
  locationLabel: string | null;
  route: number[][] | null;
  mapLabel: string;
  mapUnavailableLabel: string;
  sourceBadge?: React.ReactNode;
};

export function OutdoorActivityHero({
  activityType,
  title,
  dateLabel,
  timeLabel,
  distanceLabel,
  locationLabel,
  route,
  mapLabel,
  mapUnavailableLabel,
  sourceBadge,
}: OutdoorActivityHeroProps) {
  const Icon = activityType === "ride" ? Bike : Footprints;
  return (
    <section className="relative -mx-5 -mt-3 min-h-[270px] overflow-hidden rounded-b-[32px] border-b border-white/[0.07] bg-[radial-gradient(circle_at_25%_20%,rgba(48,213,255,0.18),transparent_45%),#0a1115]">
      {route ? (
        <WorkoutRouteMap
          className="absolute inset-0 size-full"
          fallbackLabel={mapUnavailableLabel}
          label={mapLabel}
          route={route}
          showAttribution={false}
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:28px_28px]" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10" />
      <div className="relative flex min-h-[270px] flex-col justify-end px-5 pb-5 pt-16">
        {locationLabel ? (
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-white/66">
            <MapPin size={13} strokeWidth={2.6} />
            <span className="truncate">{locationLabel}</span>
          </p>
        ) : null}
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--gc-blue)]">
              <Icon size={14} strokeWidth={2.8} />
              {dateLabel}
            </p>
            <h2 className="mt-1 text-[28px] font-black leading-[0.98] text-white">
              {title}
            </h2>
            {distanceLabel ? (
              <p className="mt-2 text-[31px] font-black leading-none tabular-nums text-[var(--gc-blue)]">
                {distanceLabel}
              </p>
            ) : null}
            {timeLabel ? (
              <p className="mt-2 text-[12px] font-bold text-white/55">{timeLabel}</p>
            ) : null}
          </div>
          {sourceBadge ? <div className="max-w-[45%] shrink-0">{sourceBadge}</div> : null}
        </div>
        {!route ? (
          <p className="mt-3 text-[11px] font-semibold text-white/38">
            {mapUnavailableLabel}
          </p>
        ) : null}
      </div>
    </section>
  );
}

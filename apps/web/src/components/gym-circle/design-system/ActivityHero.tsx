import { Bike, Dumbbell, Footprints, MapPin, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { WorkoutRouteMap } from "./WorkoutRouteMap";

type ActivityHeroProps = {
  activityType: string;
  title: string;
  dateLabel: string;
  timeLabel: string | null;
  primaryMetric: string;
  locationLabel: string | null;
  locationCoordinate?: [number, number] | null;
  route: number[][] | null;
  mapLabel: string;
  mapUnavailableLabel: string;
  sourceBadge?: React.ReactNode;
};

const ICONS: Record<string, LucideIcon> = {
  strength: Dumbbell,
  run: Footprints,
  walk: Footprints,
  ride: Bike,
  other: Play,
};

/**
 * Hero único para qualquer modalidade. Rotas continuam vindas do rastreio ou
 * Apple Saúde; o pin/nome do local vem do Gym Circle e tem precedência visual.
 */
export function ActivityHero({
  activityType,
  title,
  dateLabel,
  timeLabel,
  primaryMetric,
  locationLabel,
  locationCoordinate,
  route,
  mapLabel,
  mapUnavailableLabel,
  sourceBadge,
}: ActivityHeroProps) {
  const Icon = ICONS[activityType] ?? Play;
  const hasMap = Boolean(route || locationCoordinate);

  return (
    <section className="relative -mx-5 -mt-3 min-h-[340px] overflow-hidden rounded-b-[34px] border-b border-white/[0.07] bg-[radial-gradient(circle_at_25%_20%,rgba(48,213,255,0.2),transparent_48%),#0a1115]">
      {hasMap ? (
        <WorkoutRouteMap
          center={locationCoordinate}
          className="absolute inset-0 size-full"
          fallbackLabel={mapUnavailableLabel}
          label={mapLabel}
          route={route}
          showAttribution
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:28px_28px]" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/48 to-black/10" />
      <div className="relative flex min-h-[340px] flex-col justify-end px-5 pb-5 pt-20">
        {locationLabel ? (
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-black text-white/78 drop-shadow-md">
            <MapPin size={14} strokeWidth={2.8} />
            <span className="truncate">{locationLabel}</span>
          </p>
        ) : null}
        <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--gc-blue)]">
          <Icon size={14} strokeWidth={2.8} />
          {dateLabel}
        </p>
        <h2 className="mt-1 text-[34px] font-black leading-[0.96] text-white drop-shadow-lg">
          {title}
        </h2>
        <p className="mt-2 text-[32px] font-black leading-none tabular-nums text-[var(--gc-blue)] drop-shadow-lg">
          {primaryMetric}
        </p>
        <div className="mt-3 flex items-end justify-between gap-3">
          {timeLabel ? (
            <p className="min-w-0 text-[12px] font-bold text-white/62">
              {timeLabel}
            </p>
          ) : (
            <span />
          )}
          {sourceBadge ? <div className="max-w-[52%] shrink-0">{sourceBadge}</div> : null}
        </div>
      </div>
    </section>
  );
}

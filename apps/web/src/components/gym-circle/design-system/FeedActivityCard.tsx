"use client";

import { ImagePlus, MapPin, MoreHorizontal, Route, Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getSportLocalizedName } from "@gym-circle/core/domain";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import type { EnrichedActivity } from "../social/types";
import {
  formatElapsed,
  formatKm,
  formatPace,
  paceFromDistance,
} from "../workout/workoutElapsed";
import { WorkoutRouteMap } from "./WorkoutRouteMap";

type FeedActivityCardProps = {
  activity: EnrichedActivity;
  formatTime: (createdAt: string) => string;
  /** Dono: adicionar foto → o composer promove a entrada a post. */
  onAddPhoto?: (activity: EnrichedActivity) => void;
  onOpenMenu?: (activityId: string) => void;
  /** Tocar nos stats (área sem botões) → overlay de detalhes (Apple). */
  onOpenDetails?: (activity: EnrichedActivity) => void;
  onSelectGym?: (gymId: string) => void;
  onSelectUser?: (userId: string) => void;
};

/**
 * Rastreio de treino — ENTRADA de atividade no feed (espelho do
 * FeedCheckinCard): treino sem foto, com as mesmas infos de post (legenda,
 * local, tags). "Adicionar fotos" promove a post/carrossel.
 */
export function FeedActivityCard({
  activity,
  formatTime,
  onAddPhoto,
  onOpenMenu,
  onOpenDetails,
  onSelectGym,
  onSelectUser,
}: FeedActivityCardProps) {
  const { i18n, t } = useTranslation();
  const typeLabel = getSportLocalizedName(
    activity.activityType,
    i18n.language,
  );
  const locationLabel = activity.gymName ?? activity.locationName;

  // Fase 2 (GPS outdoor): rota gravada → destaque vira distância; tempo,
  // ritmo e elevação descem pra linha secundária.
  const hasRoute = (activity.distanceM ?? 0) > 0;
  const pace = hasRoute
    ? paceFromDistance(
        activity.distanceM ?? 0,
        activity.movingS ?? activity.elapsedS,
      )
    : null;
  const secondaryStats = [
    hasRoute ? formatElapsed(activity.elapsedS) : null,
    pace != null ? formatPace(pace) : null,
    hasRoute && (activity.elevationGainM ?? 0) >= 1
      ? `${Math.round(activity.elevationGainM ?? 0)} m`
      : null,
    activity.avgHr ? `${activity.avgHr} bpm` : null,
    activity.totalCalories ? `${Math.round(activity.totalCalories)} kcal` : null,
  ].filter(Boolean);

  return (
    <article className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(48,213,255,0.1),transparent_48%),#0c0d0e] shadow-[0_18px_54px_rgba(0,0,0,0.28)]">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button
          aria-label={t("feedScreen.activity.openProfile", {
            username: activity.author.username,
          })}
          className="gc-pressable shrink-0 rounded-full"
          disabled={!onSelectUser}
          onClick={() => onSelectUser?.(activity.userId)}
          type="button"
        >
          <Avatar
            accent={activity.author.accent}
            name={activity.author.name}
            size="sm"
            src={activity.author.avatarUrl ?? undefined}
          />
        </button>
        <div className="min-w-0 flex-1">
          <button
            className="gc-pressable block max-w-full truncate text-left text-[14px] font-black text-white"
            disabled={!onSelectUser}
            onClick={() => onSelectUser?.(activity.userId)}
            type="button"
          >
            {activity.author.name}
          </button>
          <p className="text-[11.5px] font-bold text-white/42">
            @{activity.author.username} · {formatTime(activity.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-[var(--gc-blue)]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[var(--gc-blue)]">
            {t("feedScreen.activity.badge")}
          </span>
          {onOpenMenu ? (
            <IconButton
              className="size-11"
              label={t("feed.post.menuOpenLabel")}
              onClick={() => onOpenMenu(activity.id)}
            >
              <MoreHorizontal size={18} />
            </IconButton>
          ) : null}
        </div>
      </div>

      {/* Stats do treino (tipo + duração/distância + extras quando existem).
          Tocar → overlay de detalhes estilo Apple (área sem botões). */}
      <button
        className="gc-pressable mx-4 mb-3 flex w-[calc(100%_-_2rem)] items-center gap-3 rounded-[20px] border border-[var(--gc-blue)]/12 bg-[var(--gc-blue)]/[0.055] p-4 text-left disabled:cursor-default"
        disabled={!onOpenDetails}
        onClick={() => onOpenDetails?.(activity)}
        type="button"
      >
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--gc-blue)] text-black shadow-[0_0_28px_rgba(48,213,255,0.2)]">
          {hasRoute ? (
            <Route size={21} strokeWidth={2.8} />
          ) : (
            <Timer size={21} strokeWidth={2.8} />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-white/38">
            {typeLabel}
          </p>
          <p className="text-[20px] font-black leading-tight text-white">
            {hasRoute
              ? formatKm(activity.distanceM ?? 0)
              : formatElapsed(activity.elapsedS)}
          </p>
          {secondaryStats.length > 0 ? (
            <p className="mt-0.5 text-[11.5px] font-bold text-white/42">
              {secondaryStats.join(" · ")}
            </p>
          ) : null}
        </div>
      </button>

      {/* Mini-mapa real da rota (legado: atividades antigas ainda sem post). */}
      {activity.route && activity.route.length >= 2 ? (
        <div className="mx-4 mb-3 overflow-hidden rounded-[20px] border border-[var(--gc-blue)]/10 bg-[var(--gc-blue)]/[0.045]">
          <button
            aria-label={t("workoutDetail.mapTitle")}
            className="gc-pressable block w-full"
            disabled={!onOpenDetails}
            onClick={() => onOpenDetails?.(activity)}
            type="button"
          >
            <WorkoutRouteMap
              className="h-32 w-full"
              label={t("workoutDetail.mapTitle")}
              route={activity.route}
              showAttribution={false}
            />
          </button>
          <a
            className="block bg-black/35 px-2 py-1 text-right text-[8px] font-bold text-white/46"
            href="https://www.openstreetmap.org/copyright"
            rel="noreferrer"
            target="_blank"
          >
            © OpenStreetMap
          </a>
        </div>
      ) : null}

      {/* Legenda + tags (mesmas infos de um post) */}
      {activity.caption ? (
        <p className="mx-4 mb-3 text-[13.5px] font-semibold leading-snug text-white/86">
          <button
            className="gc-pressable mr-1.5 font-black text-white"
            disabled={!onSelectUser}
            onClick={() => onSelectUser?.(activity.userId)}
            type="button"
          >
            {activity.author.username}
          </button>
          {activity.caption}
        </p>
      ) : null}

      {/* Local */}
      {locationLabel ? (
        <button
          className="gc-pressable mx-4 mb-3 flex items-center gap-1.5 text-[12px] font-bold text-white/48"
          disabled={!onSelectGym || !activity.gymId}
          onClick={() => activity.gymId && onSelectGym?.(activity.gymId)}
          type="button"
        >
          <MapPin size={13} strokeWidth={2.6} />
          <span className="truncate">{locationLabel}</span>
        </button>
      ) : null}

      {onAddPhoto ? (
        <button
          className="gc-pressable mx-4 mb-4 flex h-11 w-[calc(100%_-_2rem)] items-center justify-center gap-2 rounded-full bg-[var(--gc-blue)] text-[13px] font-black text-black"
          onClick={() => onAddPhoto(activity)}
          type="button"
        >
          <ImagePlus size={17} strokeWidth={2.6} />
          {t("feedScreen.activity.addPhoto")}
        </button>
      ) : null}
    </article>
  );
}

"use client";

import {
  SPORT_CATEGORY_IDS,
  getSportLocalizedName,
  normalizeSportSearchText,
  searchSports,
  type SportDefinition,
  type SportIconKey,
} from "@gym-circle/core/domain";
import {
  Activity,
  Bike,
  CircleDot,
  Dumbbell,
  Footprints,
  HeartPulse,
  Mountain,
  MoveRight,
  PersonStanding,
  Search,
  ShipWheel,
  Sparkles,
  Star,
  Timer,
  Trophy,
  Waves,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useSportCatalogPersonalization } from "./useSportCatalogPersonalization";

const ICONS: Record<SportIconKey, LucideIcon> = {
  activity: Activity,
  bike: Bike,
  "boxing-glove": Trophy,
  "circle-dot": CircleDot,
  dumbbell: Dumbbell,
  footprints: Footprints,
  "heart-pulse": HeartPulse,
  mountain: Mountain,
  "move-right": MoveRight,
  "person-standing": PersonStanding,
  racket: CircleDot,
  "ship-wheel": ShipWheel,
  sparkles: Sparkles,
  timer: Timer,
  trophy: Trophy,
  waves: Waves,
};

function capabilityLabel(sport: SportDefinition, language: string) {
  const capabilities = sport.trackingCapabilities;
  const portuguese = language.toLowerCase().startsWith("pt");
  if (capabilities.supportsStrengthSets) {
    return portuguese ? "Séries, carga e descanso" : "Sets, load and rest";
  }
  if (capabilities.supportsGPS) {
    return portuguese ? "GPS, distância e rota" : "GPS, distance and route";
  }
  if (capabilities.supportsDistance) {
    return portuguese ? "Tempo e distância" : "Time and distance";
  }
  if (capabilities.supportsIntervals) {
    return portuguese ? "Tempo e intervalos" : "Time and intervals";
  }
  return portuguese ? "Tempo e esforço" : "Time and effort";
}

type CompactSportCardProps = {
  favorite: boolean;
  language: string;
  onFavorite: (sport: SportDefinition) => void;
  onStart: (sport: SportDefinition, eventTimeStamp: number) => void;
  sport: SportDefinition;
};

function CompactSportCard({
  favorite,
  language,
  onFavorite,
  onStart,
  sport,
}: CompactSportCardProps) {
  const { t } = useTranslation();
  const Icon = ICONS[sport.icon];
  return (
    <article className="relative flex min-h-[92px] items-center gap-3 rounded-[20px] border border-white/[0.07] bg-[#0b1012] p-3">
      <button
        aria-label={getSportLocalizedName(sport, language)}
        className="gc-pressable flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={(event) => onStart(sport, event.timeStamp)}
        type="button"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
          <Icon size={19} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-black text-white">
            {getSportLocalizedName(sport, language)}
          </span>
          <span className="mt-1 block truncate text-[10.5px] font-bold text-white/38">
            {capabilityLabel(sport, language)}
          </span>
        </span>
      </button>
      <button
        aria-label={
          favorite
            ? t("workout.sports.removeFavorite")
            : t("workout.sports.addFavorite")
        }
        aria-pressed={favorite}
        className="gc-pressable grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.055] text-white/45"
        onClick={() => onFavorite(sport)}
        type="button"
      >
        <Star
          className={favorite ? "text-[#ffd60a]" : ""}
          fill={favorite ? "currentColor" : "none"}
          size={15}
        />
      </button>
    </article>
  );
}

export function SportCatalogSection({
  activeSportId,
  children,
  enabled,
  onStart,
  userId,
}: {
  activeSportId?: string | null;
  children?: ReactNode;
  enabled: boolean;
  onStart: (sport: SportDefinition) => void;
  userId: string;
}) {
  const { i18n, t } = useTranslation();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [showAll, setShowAll] = useState(false);
  const openedAtRef = useRef(0);
  const trackedQueryRef = useRef("");
  const personalization = useSportCatalogPersonalization({
    activeSportId,
    enabled,
    userId,
  });
  const {
    favoriteIds,
    rankedSports,
    toggleFavorite: persistFavorite,
    track,
    usageCountBySport,
  } = personalization;
  const normalizedQuery = normalizeSportSearchText(query);
  const searched = useMemo(
    () => searchSports(query, rankedSports),
    [query, rankedSports],
  );
  const filtered = useMemo(
    () =>
      category === "all"
        ? searched
        : searched.filter((sport) => sport.category === category),
    [category, searched],
  );
  const mostUsed = useMemo(() => {
    const personalized = rankedSports.filter(
      (sport) =>
        favoriteIds.has(sport.id) ||
        (usageCountBySport.get(sport.id) ?? 0) > 0,
    );
    return (personalized.length > 0
      ? personalized
      : rankedSports
    ).slice(0, 6);
  }, [favoriteIds, rankedSports, usageCountBySport]);
  const visibleSports =
    showAll || normalizedQuery || category !== "all"
      ? filtered
      : filtered.slice(0, 12);

  useEffect(() => {
    if (!enabled) return;
    openedAtRef.current = window.performance.now();
    void track("sport_catalog_opened", {
      catalog_size: rankedSports.length,
    });
  }, [enabled, rankedSports.length, track]);

  useEffect(() => {
    if (!enabled || normalizedQuery.length < 2) return;
    const timer = window.setTimeout(() => {
      if (trackedQueryRef.current === normalizedQuery) return;
      trackedQueryRef.current = normalizedQuery;
      void track("sport_searched", {
        query_length: normalizedQuery.length,
        results_count: filtered.length,
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    enabled,
    filtered.length,
    normalizedQuery,
    track,
  ]);

  const startSport = (
    sport: SportDefinition,
    eventTimeStamp: number = openedAtRef.current,
  ) => {
    void track("sport_started", {
      sport_id: sport.id,
      time_to_start_ms: Math.max(0, eventTimeStamp - openedAtRef.current),
    });
    onStart(sport);
  };

  const toggleFavorite = (sport: SportDefinition) => {
    void persistFavorite(sport).catch(() => {
      // O estado otimista é revertido pelo hook; iniciar treino não é afetado.
    });
  };

  return (
    <section className="mt-7">
      <label className="flex h-12 items-center gap-3 rounded-[18px] border border-white/[0.07] bg-white/[0.045] px-4">
        <Search className="shrink-0 text-white/36" size={18} />
        <input
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[14px] font-bold text-white outline-none placeholder:text-white/32"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("workout.sports.searchPlaceholder")}
          type="search"
          value={query}
        />
      </label>

      {children}

      {!normalizedQuery && category === "all" ? (
        <div className="mt-7">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <h3 className="text-[16px] font-black text-white">
                {t("workout.sports.mostUsed")}
              </h3>
              <p className="mt-0.5 text-[11px] font-bold text-white/40">
                {t("workout.sports.personalizedHint")}
              </p>
            </div>
          </div>
          <div className="gc-scrollbar -mx-5 mt-3 flex snap-x gap-2.5 overflow-x-auto px-5 pb-2">
            {mostUsed.map((sport) => {
              const Icon = ICONS[sport.icon];
              return (
                <button
                  className="gc-pressable flex min-w-[116px] snap-start flex-col items-start rounded-[19px] border border-[var(--gc-brand)]/12 bg-[var(--gc-brand)]/[0.055] p-3 text-left"
                  key={sport.id}
                  onClick={(event) => startSport(sport, event.timeStamp)}
                  type="button"
                >
                  <Icon
                    className="text-[var(--gc-brand)]"
                    size={20}
                    strokeWidth={2.4}
                  />
                  <span className="mt-3 w-full truncate text-[12px] font-black text-white">
                    {getSportLocalizedName(sport, i18n.language)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-7 flex items-end justify-between gap-3 px-1">
        <div>
          <h3 className="text-[16px] font-black text-white">
            {normalizedQuery
              ? t("workout.sports.searchResults")
              : t("workout.sports.all")}
          </h3>
          <p className="mt-0.5 text-[11px] font-bold text-white/40">
            {t("workout.sports.resultCount", { count: filtered.length })}
          </p>
        </div>
        {!normalizedQuery && category === "all" && filtered.length > 12 ? (
          <button
            className="gc-pressable text-[11.5px] font-black text-[var(--gc-brand)]"
            onClick={() => setShowAll((current) => !current)}
            type="button"
          >
            {showAll
              ? t("workout.sports.showLess")
              : t("workout.sports.showAll")}
          </button>
        ) : null}
      </div>

      <div className="gc-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
        {["all", ...SPORT_CATEGORY_IDS].map((categoryId) => (
          <button
            aria-pressed={category === categoryId}
            className={[
              "gc-pressable shrink-0 rounded-full px-3 py-2 text-[10.5px] font-black",
              category === categoryId
                ? "bg-[var(--gc-brand)] text-[var(--gc-brand-ink)]"
                : "bg-white/[0.055] text-white/52",
            ].join(" ")}
            key={categoryId}
            onClick={() => setCategory(categoryId)}
            type="button"
          >
            {t(`workout.sports.categories.${categoryId}`)}
          </button>
        ))}
      </div>

      {visibleSports.length > 0 ? (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {visibleSports.map((sport) => (
            <CompactSportCard
              favorite={favoriteIds.has(sport.id)}
              key={sport.id}
              language={i18n.language}
              onFavorite={toggleFavorite}
              onStart={startSport}
              sport={sport}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-[20px] border border-dashed border-white/[0.08] px-5 py-8 text-center">
          <p className="text-[13px] font-black text-white/62">
            {t("workout.sports.empty")}
          </p>
          <p className="mt-1 text-[11px] font-bold text-white/36">
            {t("workout.sports.emptyHint")}
          </p>
        </div>
      )}
    </section>
  );
}

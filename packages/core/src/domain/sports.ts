export const SPORT_CATEGORY_IDS = [
  "strength",
  "cardio",
  "sports",
  "racket",
  "water",
  "wellness",
  "functional",
  "combat",
  "outdoor",
  "machines",
  "other",
] as const;

export type SportCategoryId = (typeof SPORT_CATEGORY_IDS)[number];

export type SportTrackingCapabilities = {
  supportsGPS: boolean;
  supportsStrengthSets: boolean;
  supportsHeartRate: boolean;
  supportsRoute: boolean;
  supportsDistance: boolean;
  supportsCalories: boolean;
  supportsIntervals: boolean;
  supportsWorkoutPlan: boolean;
  supportsStructuredSteps: boolean;
  supportsRestTimer: boolean;
  supportsRpe: boolean;
};

export type SportIconKey =
  | "activity"
  | "bike"
  | "boxing-glove"
  | "circle-dot"
  | "dumbbell"
  | "footprints"
  | "heart-pulse"
  | "mountain"
  | "move-right"
  | "person-standing"
  | "racket"
  | "ship-wheel"
  | "sparkles"
  | "timer"
  | "trophy"
  | "waves";

export type SportDefinition = {
  /** Identificador canônico persistido em activities.activity_type. */
  id: string;
  activityType: string;
  localizedName: {
    ptBR: string;
    en: string;
  };
  aliases: readonly string[];
  icon: SportIconKey;
  category: SportCategoryId;
  trackingCapabilities: SportTrackingCapabilities;
  /** Popularidade editorial inicial; uso real sempre tem prioridade. */
  popularity: number;
  enabled: boolean;
  defaultOrder: number;
};

const DURATION: SportTrackingCapabilities = {
  supportsGPS: false,
  supportsStrengthSets: false,
  supportsHeartRate: true,
  supportsRoute: false,
  supportsDistance: false,
  supportsCalories: true,
  supportsIntervals: false,
  supportsWorkoutPlan: false,
  supportsStructuredSteps: false,
  supportsRestTimer: false,
  supportsRpe: true,
};

const GPS_ROUTE: SportTrackingCapabilities = {
  ...DURATION,
  supportsGPS: true,
  supportsRoute: true,
  supportsDistance: true,
  supportsIntervals: true,
};

const STRENGTH: SportTrackingCapabilities = {
  ...DURATION,
  supportsStrengthSets: true,
  supportsWorkoutPlan: true,
  supportsRestTimer: true,
};

function sport<
  const Definition extends Omit<SportDefinition, "activityType" | "enabled"> & {
    enabled?: boolean;
  },
>(
  definition: Definition,
): Definition & { activityType: Definition["id"]; enabled: boolean } {
  return {
    ...definition,
    activityType: definition.id,
    enabled: definition.enabled ?? true,
  };
}

/**
 * Fonte única de verdade das modalidades do Gym Circle.
 *
 * As capacidades descrevem o que o app suporta AGORA. Modalidades novas
 * começam com duração, FC/calorias quando uma fonte real fornece esses dados e
 * RPE opcional; recursos futuros não são anunciados prematuramente.
 */
export const SPORT_CATALOG = [
  sport({
    id: "strength",
    localizedName: { ptBR: "Musculação", en: "Strength Training" },
    aliases: ["weights", "weight training", "gym", "resistance training"],
    icon: "dumbbell",
    category: "strength",
    trackingCapabilities: STRENGTH,
    popularity: 100,
    defaultOrder: 0,
  }),
  sport({
    id: "run",
    localizedName: { ptBR: "Corrida", en: "Running" },
    aliases: ["running", "run", "jogging", "jog"],
    icon: "move-right",
    category: "cardio",
    trackingCapabilities: GPS_ROUTE,
    popularity: 96,
    defaultOrder: 1,
  }),
  sport({
    id: "walk",
    localizedName: { ptBR: "Caminhada", en: "Walking" },
    aliases: ["walking", "walk", "caminhar"],
    icon: "footprints",
    category: "cardio",
    trackingCapabilities: GPS_ROUTE,
    popularity: 94,
    defaultOrder: 2,
  }),
  sport({
    id: "ride",
    localizedName: { ptBR: "Bike", en: "Cycling" },
    aliases: ["bike", "bicycle", "cycling", "ciclismo", "bicicleta"],
    icon: "bike",
    category: "cardio",
    trackingCapabilities: GPS_ROUTE,
    popularity: 90,
    defaultOrder: 3,
  }),
  sport({
    id: "pilates",
    localizedName: { ptBR: "Pilates", en: "Pilates" },
    aliases: ["reformer", "mat pilates"],
    icon: "person-standing",
    category: "wellness",
    trackingCapabilities: DURATION,
    popularity: 78,
    defaultOrder: 4,
  }),
  sport({
    id: "tennis",
    localizedName: { ptBR: "Tênis", en: "Tennis" },
    aliases: ["tenis", "tennis", "court tennis"],
    icon: "racket",
    category: "racket",
    trackingCapabilities: { ...DURATION, supportsIntervals: true },
    popularity: 76,
    defaultOrder: 5,
  }),
  sport({
    id: "padel",
    localizedName: { ptBR: "Padel", en: "Padel" },
    aliases: ["pádel", "paddle tennis"],
    icon: "racket",
    category: "racket",
    trackingCapabilities: { ...DURATION, supportsIntervals: true },
    popularity: 69,
    defaultOrder: 6,
  }),
  sport({
    id: "beach-tennis",
    localizedName: { ptBR: "Beach Tennis", en: "Beach Tennis" },
    aliases: ["beachtennis", "tenis de praia", "tênis de praia"],
    icon: "racket",
    category: "racket",
    trackingCapabilities: { ...DURATION, supportsIntervals: true },
    popularity: 82,
    defaultOrder: 7,
  }),
  sport({
    id: "football",
    localizedName: { ptBR: "Futebol", en: "Soccer" },
    aliases: ["soccer", "football", "campo"],
    icon: "circle-dot",
    category: "sports",
    trackingCapabilities: { ...DURATION, supportsIntervals: true },
    popularity: 92,
    defaultOrder: 8,
  }),
  sport({
    id: "futsal",
    localizedName: { ptBR: "Futsal", en: "Futsal" },
    aliases: ["indoor soccer", "futebol de salão", "futebol de salao"],
    icon: "circle-dot",
    category: "sports",
    trackingCapabilities: { ...DURATION, supportsIntervals: true },
    popularity: 73,
    defaultOrder: 9,
  }),
  sport({
    id: "basketball",
    localizedName: { ptBR: "Basquete", en: "Basketball" },
    aliases: ["basket", "basketball", "basquete"],
    icon: "circle-dot",
    category: "sports",
    trackingCapabilities: { ...DURATION, supportsIntervals: true },
    popularity: 68,
    defaultOrder: 10,
  }),
  sport({
    id: "volleyball",
    localizedName: { ptBR: "Vôlei", en: "Volleyball" },
    aliases: ["volei", "volleyball", "volley"],
    icon: "circle-dot",
    category: "sports",
    trackingCapabilities: DURATION,
    popularity: 66,
    defaultOrder: 11,
  }),
  sport({
    id: "swimming",
    localizedName: { ptBR: "Natação", en: "Swimming" },
    aliases: ["natacao", "swim", "swimming", "pool"],
    icon: "waves",
    category: "water",
    trackingCapabilities: { ...DURATION, supportsDistance: true, supportsIntervals: true },
    popularity: 79,
    defaultOrder: 12,
  }),
  sport({
    id: "cross-training",
    localizedName: { ptBR: "Cross Training", en: "Cross Training" },
    aliases: ["crosstraining", "cross train", "circuit training"],
    icon: "activity",
    category: "functional",
    trackingCapabilities: { ...DURATION, supportsIntervals: true, supportsRestTimer: true },
    popularity: 72,
    defaultOrder: 13,
  }),
  sport({
    id: "crossfit",
    localizedName: { ptBR: "CrossFit", en: "CrossFit" },
    aliases: ["cross fit", "wod"],
    icon: "activity",
    category: "functional",
    trackingCapabilities: { ...DURATION, supportsIntervals: true, supportsRestTimer: true },
    popularity: 81,
    defaultOrder: 14,
  }),
  sport({
    id: "functional",
    localizedName: { ptBR: "Funcional", en: "Functional Training" },
    aliases: ["functional", "functional training", "treino funcional"],
    icon: "activity",
    category: "functional",
    trackingCapabilities: { ...DURATION, supportsIntervals: true, supportsRestTimer: true },
    popularity: 84,
    defaultOrder: 15,
  }),
  sport({
    id: "hiit",
    localizedName: { ptBR: "HIIT", en: "HIIT" },
    aliases: ["high intensity interval training", "intervalado"],
    icon: "timer",
    category: "functional",
    trackingCapabilities: { ...DURATION, supportsIntervals: true, supportsRestTimer: true },
    popularity: 80,
    defaultOrder: 16,
  }),
  sport({
    id: "yoga",
    localizedName: { ptBR: "Yoga", en: "Yoga" },
    aliases: ["ioga", "yoga flow", "vinyasa", "hatha"],
    icon: "person-standing",
    category: "wellness",
    trackingCapabilities: DURATION,
    popularity: 77,
    defaultOrder: 17,
  }),
  sport({
    id: "stretching",
    localizedName: { ptBR: "Alongamento", en: "Stretching" },
    aliases: ["stretch", "stretching", "flexibility"],
    icon: "person-standing",
    category: "wellness",
    trackingCapabilities: DURATION,
    popularity: 61,
    defaultOrder: 18,
  }),
  sport({
    id: "mobility",
    localizedName: { ptBR: "Mobilidade", en: "Mobility" },
    aliases: ["mobility", "mobilidade articular"],
    icon: "person-standing",
    category: "wellness",
    trackingCapabilities: DURATION,
    popularity: 63,
    defaultOrder: 19,
  }),
  sport({
    id: "calisthenics",
    localizedName: { ptBR: "Calistenia", en: "Calisthenics" },
    aliases: ["calisthenics", "street workout", "bodyweight"],
    icon: "dumbbell",
    category: "strength",
    trackingCapabilities: { ...DURATION, supportsRestTimer: true },
    popularity: 70,
    defaultOrder: 20,
  }),
  sport({
    id: "climbing",
    localizedName: { ptBR: "Escalada", en: "Climbing" },
    aliases: ["climbing", "bouldering", "escalada indoor"],
    icon: "mountain",
    category: "sports",
    trackingCapabilities: DURATION,
    popularity: 55,
    defaultOrder: 21,
  }),
  sport({
    id: "rowing",
    localizedName: { ptBR: "Remo", en: "Rowing" },
    aliases: ["rowing", "row", "erg", "ergometer"],
    icon: "ship-wheel",
    category: "cardio",
    trackingCapabilities: { ...DURATION, supportsDistance: true, supportsIntervals: true },
    popularity: 58,
    defaultOrder: 22,
  }),
  sport({
    id: "elliptical",
    localizedName: { ptBR: "Elíptico", en: "Elliptical" },
    aliases: ["eliptico", "elliptical", "cross trainer"],
    icon: "activity",
    category: "machines",
    trackingCapabilities: { ...DURATION, supportsDistance: true },
    popularity: 60,
    defaultOrder: 23,
  }),
  sport({
    id: "stair-climber",
    localizedName: { ptBR: "Escada", en: "Stair Climber" },
    aliases: ["stair", "stairs", "stairmaster", "simulador de escada"],
    icon: "activity",
    category: "machines",
    trackingCapabilities: DURATION,
    popularity: 62,
    defaultOrder: 24,
  }),
  sport({
    id: "boxing",
    localizedName: { ptBR: "Boxe", en: "Boxing" },
    aliases: ["boxing", "box"],
    icon: "boxing-glove",
    category: "combat",
    trackingCapabilities: { ...DURATION, supportsIntervals: true },
    popularity: 67,
    defaultOrder: 25,
  }),
  sport({
    id: "martial-arts",
    localizedName: { ptBR: "Artes Marciais", en: "Martial Arts" },
    aliases: ["martial", "martial arts", "lutas", "jiu jitsu", "karate", "judô", "judo", "muay thai"],
    icon: "trophy",
    category: "combat",
    trackingCapabilities: { ...DURATION, supportsIntervals: true },
    popularity: 65,
    defaultOrder: 26,
  }),
  sport({
    id: "dance",
    localizedName: { ptBR: "Dança", en: "Dance" },
    aliases: ["danca", "dance", "zumba", "ballet"],
    icon: "sparkles",
    category: "wellness",
    trackingCapabilities: DURATION,
    popularity: 64,
    defaultOrder: 27,
  }),
  sport({
    id: "hiking",
    localizedName: { ptBR: "Trilha", en: "Hiking" },
    aliases: ["hike", "hiking", "trekking", "trail", "trilha"],
    icon: "mountain",
    category: "outdoor",
    // GPS de trilha será ativado quando a ponte nativa aceitar essa modalidade.
    trackingCapabilities: DURATION,
    popularity: 59,
    defaultOrder: 28,
  }),
  sport({
    id: "other",
    localizedName: { ptBR: "Outro", en: "Other" },
    aliases: ["other", "outro", "atividade"],
    icon: "heart-pulse",
    category: "other",
    trackingCapabilities: DURATION,
    popularity: 10,
    defaultOrder: 29,
  }),
] as const satisfies readonly SportDefinition[];

export type SportId = (typeof SPORT_CATALOG)[number]["id"];

const SPORTS_BY_ID = new Map<string, SportDefinition>(
  SPORT_CATALOG.map((item) => [item.id, item]),
);

export function isSportId(value: unknown): value is SportId {
  return typeof value === "string" && SPORTS_BY_ID.has(value);
}

export function getSportDefinition(
  value: string | null | undefined,
): SportDefinition {
  return (
    (value ? SPORTS_BY_ID.get(value) : undefined) ??
    SPORTS_BY_ID.get("other")!
  );
}

export function getSportLocalizedName(
  value: string | SportDefinition,
  locale = "pt-BR",
): string {
  const definition =
    typeof value === "string" ? getSportDefinition(value) : value;
  return locale.toLowerCase().startsWith("pt")
    ? definition.localizedName.ptBR
    : definition.localizedName.en;
}

export function normalizeSportSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchableSportText(definition: SportDefinition): string {
  return normalizeSportSearchText(
    [
      definition.localizedName.ptBR,
      definition.localizedName.en,
      definition.id,
      ...definition.aliases,
    ].join(" "),
  );
}

export function searchSports(
  query: string,
  catalog: readonly SportDefinition[] = SPORT_CATALOG,
): SportDefinition[] {
  const normalized = normalizeSportSearchText(query);
  if (!normalized) return catalog.filter((item) => item.enabled);
  const tokens = normalized.split(/\s+/);
  return catalog.filter((item) => {
    if (!item.enabled) return false;
    const searchable = searchableSportText(item);
    return tokens.every((token) => searchable.includes(token));
  });
}

export type SportRankingSignals = {
  activeSportId?: string | null;
  favoriteSportIds?: ReadonlySet<string>;
  usageCountBySport?: ReadonlyMap<string, number>;
  lastUsedAtBySport?: ReadonlyMap<string, string>;
  recommendedSportIds?: readonly string[];
};

/**
 * Ordenação determinística:
 * treino ativo → favoritos → frequência → recência → recomendação → catálogo.
 */
export function rankSports(
  catalog: readonly SportDefinition[],
  signals: SportRankingSignals = {},
): SportDefinition[] {
  const recommendationRank = new Map(
    (signals.recommendedSportIds ?? []).map((id, index) => [id, index]),
  );
  return catalog
    .filter((item) => item.enabled)
    .slice()
    .sort((left, right) => {
      const activeDelta =
        Number(right.id === signals.activeSportId) -
        Number(left.id === signals.activeSportId);
      if (activeDelta) return activeDelta;

      const favoriteDelta =
        Number(signals.favoriteSportIds?.has(right.id) ?? false) -
        Number(signals.favoriteSportIds?.has(left.id) ?? false);
      if (favoriteDelta) return favoriteDelta;

      const usageDelta =
        (signals.usageCountBySport?.get(right.id) ?? 0) -
        (signals.usageCountBySport?.get(left.id) ?? 0);
      if (usageDelta) return usageDelta;

      const recentDelta = (
        signals.lastUsedAtBySport?.get(right.id) ?? ""
      ).localeCompare(signals.lastUsedAtBySport?.get(left.id) ?? "");
      if (recentDelta) return recentDelta;

      const leftRecommendation =
        recommendationRank.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightRecommendation =
        recommendationRank.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      if (leftRecommendation !== rightRecommendation) {
        return leftRecommendation - rightRecommendation;
      }

      return (
        left.defaultOrder - right.defaultOrder ||
        right.popularity - left.popularity ||
        left.id.localeCompare(right.id)
      );
    });
}

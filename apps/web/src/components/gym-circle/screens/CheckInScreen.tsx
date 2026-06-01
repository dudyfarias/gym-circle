"use client";

import Image from "next/image";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Camera,
  Check,
  Clock,
  Loader2,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import {
  GymSearchSheet,
  type LocatedPlaceCandidate,
  type PlaceCandidate,
} from "../GymSearchSheet";
import type {
  EnrichedPost,
  EnrichedUser,
  GymLocationOption,
  GymUser,
} from "../social/types";
import { TopBar } from "../TopBar";

type CheckInScreenProps = {
  currentUser: EnrichedUser;
  gyms: GymLocationOption[];
  posts: EnrichedPost[];
  users: Record<string, GymUser>;
  onCheckIn: (gymName: string) => void | Promise<void>;
  onSelectUser?: (userId: string) => void;
  onCatalogPlace?: (place: LocatedPlaceCandidate) => Promise<GymLocationOption>;
};

type PeopleFilter = "today" | "week";

function formatPostTime(iso: string, locale = "pt-BR"): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function isTodayInSP(iso: string): boolean {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const that = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
  return today === that;
}

function isWithinLastDays(iso: string, days: number): boolean {
  const ms = Date.now() - new Date(iso).getTime();
  return ms < days * 24 * 60 * 60 * 1000;
}

function formatRelativeDay(iso: string, t: TFunction, locale = "pt-BR"): string {
  if (isTodayInSP(iso)) return formatPostTime(iso, locale);
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days <= 1) return t("checkIn.time.yesterday");
  if (days <= 7) return t("checkIn.time.daysAgo", { count: days });
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}

/**
 * Check-in vira "lugar vivo" centrado na ÚLTIMA academia do user:
 * - Tela default: card grande com último gym treinado + lugares perto
 *   auto-fetched + amigos que treinaram lá.
 * - Selected state: detalhe da academia com toggle "Hoje | Semana" pra
 *   ver quem treinou ali em cada janela de tempo.
 */
export function CheckInScreen({
  currentUser,
  gyms,
  posts,
  users,
  onCheckIn,
  onSelectUser,
  onCatalogPlace,
}: CheckInScreenProps) {
  const { t } = useTranslation();
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [localGyms, setLocalGyms] = useState<GymLocationOption[]>([]);
  const [cataloging, setCataloging] = useState(false);
  const [checkinPending, setCheckinPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>("today");

  // Nearby places state — fetched inline na tela default
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<PlaceCandidate[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const allGyms = useMemo<GymLocationOption[]>(() => {
    const merged = new Map<string, GymLocationOption>();
    for (const gym of gyms) merged.set(gym.id, gym);
    for (const gym of localGyms) merged.set(gym.id, gym);
    return Array.from(merged.values());
  }, [gyms, localGyms]);

  // ÚLTIMA academia do user — derivada do post mais recente do próprio user
  // que tem gym_id válido. Mais robusto que confiar em "main_gym_id" do
  // perfil (que é manual e pode não bater com onde o user treinou ontem).
  const lastGym = useMemo<GymLocationOption | null>(() => {
    const myPostsWithGym = posts
      .filter((post) => post.userId === currentUser.id && post.gymId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    if (myPostsWithGym.length === 0) return null;
    const lastGymId = myPostsWithGym[0].gymId;
    return allGyms.find((gym) => gym.id === lastGymId) ?? null;
  }, [allGyms, currentUser.id, posts]);

  const selectedGym = useMemo(
    () => allGyms.find((gym) => gym.id === selectedGymId) ?? null,
    [allGyms, selectedGymId],
  );

  const isViewingDetail = Boolean(selectedGym);

  // Posts do gym ativo (selecionado ou último)
  const activeGymId = selectedGym?.id ?? lastGym?.id ?? null;
  const gymPosts = useMemo(() => {
    if (!activeGymId) return [] as EnrichedPost[];
    return posts.filter((post) => post.gymId === activeGymId);
  }, [posts, activeGymId]);

  // Amigos (users que eu sigo) com post no último gym
  const friendsAtLastGym = useMemo(() => {
    if (!lastGym) return [] as Array<{ user: GymUser; lastPost: EnrichedPost }>;
    const lastGymPosts = posts.filter(
      (post) => post.gymId === lastGym.id && post.userId !== currentUser.id,
    );
    const seen = new Map<string, EnrichedPost>();
    // Pra cada user, pega o post mais recente
    for (const post of [...lastGymPosts].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )) {
      if (!seen.has(post.userId)) seen.set(post.userId, post);
    }

    const out: Array<{ user: GymUser; lastPost: EnrichedPost }> = [];
    for (const [userId, lastPost] of seen) {
      const userInfo = users[userId];
      if (!userInfo) continue;
      // followStatus "accepted" = amizade efetiva (pública ou privada
      // aceita). Sigo mas pendente fica de fora — não é amigo ainda.
      if (userInfo.followStatus !== "accepted") continue;
      out.push({ user: userInfo, lastPost });
      if (out.length >= 8) break;
    }
    return out;
  }, [currentUser.id, lastGym, posts, users]);

  // Pessoas no gym ativo, filtradas por hoje OU últimos 7 dias
  const peopleAtGym = useMemo(() => {
    if (gymPosts.length === 0) {
      return [] as Array<{ user: GymUser; post: EnrichedPost }>;
    }
    const filterFn = (post: EnrichedPost) =>
      peopleFilter === "today"
        ? isTodayInSP(post.createdAt)
        : isWithinLastDays(post.createdAt, 7);

    const sorted = [...gymPosts]
      .filter(filterFn)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    const seen = new Set<string>();
    const out: Array<{ user: GymUser; post: EnrichedPost }> = [];
    for (const post of sorted) {
      if (seen.has(post.userId)) continue;
      const userInfo = users[post.userId];
      if (!userInfo) continue;
      seen.add(post.userId);
      out.push({ user: userInfo, post });
      if (out.length >= 12) break;
    }
    return out;
  }, [gymPosts, peopleFilter, users]);

  const recentPosts = useMemo(() => {
    return [...gymPosts]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 9);
  }, [gymPosts]);

  function openGymDetail(gymId: string | null) {
    setSelectedGymId(gymId);
    setPeopleFilter("today");
    setFeedback(null);
  }

  // Geolocation pra fetch de nearby places na tela default
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // sem GPS — só esconde a seção de nearby
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 9000 },
    );
  }, []);

  const fetchNearby = useCallback(async (lat: number, lng: number) => {
    setNearbyLoading(true);
    try {
      const res = await fetch(`/api/places/nearby?lat=${lat}&lng=${lng}&radius=1500`);
      if (!res.ok) {
        setNearbyPlaces([]);
        return;
      }
      const data = (await res.json()) as { results: PlaceCandidate[] };
      setNearbyPlaces(data.results);
    } catch {
      setNearbyPlaces([]);
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!coords || isViewingDetail) return;
    queueMicrotask(() => void fetchNearby(coords.lat, coords.lng));
  }, [coords, fetchNearby, isViewingDetail]);

  async function handleCatalogPlace(place: PlaceCandidate) {
    if (!onCatalogPlace || cataloging) return;
    setCataloging(true);
    try {
      if (place.provider === "registered" && place.gymId) {
        openGymDetail(place.gymId);
        setSearchOpen(false);
        return;
      }

      if (typeof place.latitude !== "number" || typeof place.longitude !== "number") {
        setFeedback(t("checkIn.errors.locationRequired"));
        return;
      }

      const cataloged = await onCatalogPlace({
        ...place,
        latitude: place.latitude,
        longitude: place.longitude,
      });
      setLocalGyms((current) =>
        current.some((gym) => gym.id === cataloged.id)
          ? current
          : [...current, cataloged],
      );
      openGymDetail(cataloged.id);
      setSearchOpen(false);
    } finally {
      setCataloging(false);
    }
  }

  async function handleSelectNearby(place: PlaceCandidate) {
    // Tap num lugar perto = catalogar (se ainda não tá no banco) + virar
    // o gym selecionado pra detalhe.
    await handleCatalogPlace(place);
  }

  async function handleCheckIn(gymName: string) {
    if (checkinPending) return;
    setCheckinPending(true);
    setFeedback(null);
    try {
      await onCheckIn(gymName);
      setFeedback(t("checkIn.feedback.confirmed", { gymName }));
    } finally {
      setCheckinPending(false);
    }
  }

  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar
        eyebrow={t("checkIn.topBar.eyebrow")}
        title={selectedGym?.name ?? lastGym?.name ?? t("checkIn.topBar.title")}
      />

      {isViewingDetail && selectedGym ? (
        <SelectedGymView
          checkinPending={checkinPending}
          feedback={feedback}
          gym={selectedGym}
          onCheckIn={() => void handleCheckIn(selectedGym.name)}
          onChangeFilter={setPeopleFilter}
          onChangeGym={() => openGymDetail(null)}
          onSelectUser={onSelectUser}
          peopleAtGym={peopleAtGym}
          peopleFilter={peopleFilter}
          recentPosts={recentPosts}
        />
      ) : (
        <DefaultView
          checkinPending={checkinPending}
          feedback={feedback}
          friendsAtLastGym={friendsAtLastGym}
          lastGym={lastGym}
          nearbyLoading={nearbyLoading}
          nearbyPlaces={nearbyPlaces}
          onCheckInLast={(gymName) => void handleCheckIn(gymName)}
          onOpenLastDetail={() => lastGym && openGymDetail(lastGym.id)}
          onOpenSearch={() => setSearchOpen(true)}
          onSelectNearby={handleSelectNearby}
          onSelectUser={onSelectUser}
          searchEnabled={Boolean(onCatalogPlace)}
        />
      )}

      <GymSearchSheet
        onClose={() => setSearchOpen(false)}
        registeredGyms={allGyms}
        onSelect={handleCatalogPlace}
        open={searchOpen}
        title={t("checkIn.search.sheetTitle")}
      />
    </section>
  );
}

// =====================================================================
// Default view (sem gym selecionado pra detalhe)
// =====================================================================

type DefaultViewProps = {
  lastGym: GymLocationOption | null;
  nearbyPlaces: PlaceCandidate[];
  nearbyLoading: boolean;
  friendsAtLastGym: Array<{ user: GymUser; lastPost: EnrichedPost }>;
  searchEnabled: boolean;
  checkinPending: boolean;
  feedback: string | null;
  onOpenLastDetail: () => void;
  onCheckInLast: (gymName: string) => void;
  onOpenSearch: () => void;
  onSelectNearby: (place: PlaceCandidate) => void | Promise<void>;
  onSelectUser?: (userId: string) => void;
};

function DefaultView({
  lastGym,
  nearbyPlaces,
  nearbyLoading,
  friendsAtLastGym,
  searchEnabled,
  checkinPending,
  feedback,
  onOpenLastDetail,
  onCheckInLast,
  onOpenSearch,
  onSelectNearby,
  onSelectUser,
}: DefaultViewProps) {
  return (
    <>
      {lastGym ? (
        <LastGymCard
          checkinPending={checkinPending}
          feedback={feedback}
          gym={lastGym}
          onCheckIn={() => onCheckInLast(lastGym.name)}
          onOpenDetail={onOpenLastDetail}
        />
      ) : (
        <EmptyHero
          onOpenSearch={onOpenSearch}
          searchEnabled={searchEnabled}
        />
      )}

      <NearbyPlacesList
        loading={nearbyLoading}
        onOpenSearch={onOpenSearch}
        onSelect={onSelectNearby}
        places={nearbyPlaces}
        searchEnabled={searchEnabled}
      />

      {lastGym && friendsAtLastGym.length > 0 ? (
        <FriendsAtLastGymList
          friends={friendsAtLastGym}
          gymName={lastGym.name}
          onSelectUser={onSelectUser}
        />
      ) : null}
    </>
  );
}

function LastGymCard({
  gym,
  onCheckIn,
  onOpenDetail,
  checkinPending,
  feedback,
}: {
  gym: GymLocationOption;
  onCheckIn: () => void;
  onOpenDetail: () => void;
  checkinPending: boolean;
  feedback: string | null;
}) {
  const { t } = useTranslation();

  return (
    <div className="mt-5 overflow-hidden rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(48,213,255,0.08),rgba(255,255,255,0.02)_50%,transparent)] p-5">
      <p className="text-[11px] font-black uppercase tracking-wide text-white/42">
        {t("checkIn.lastGym.eyebrow")}
      </p>
      <button
        className="gc-pressable mt-2 flex w-full items-start gap-3 text-left"
        onClick={onOpenDetail}
        type="button"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
          <MapPin size={20} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[20px] font-black leading-tight text-white">
            {gym.name}
          </span>
          {gym.city || gym.address ? (
            <span className="mt-0.5 block truncate text-[12px] font-bold text-white/52">
              {[gym.address, gym.city].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </span>
      </button>
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <button
          className="gc-pressable flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-black shadow-[0_0_22px_rgba(92,232,255,0.28)] disabled:opacity-50 disabled:shadow-none"
          disabled={checkinPending}
          onClick={onCheckIn}
          type="button"
        >
          {checkinPending ? (
            <Loader2 className="animate-spin" size={15} strokeWidth={2.6} />
          ) : (
            <Check size={16} strokeWidth={2.8} />
          )}
          {checkinPending ? t("checkIn.actions.confirming") : t("checkIn.actions.imHere")}
        </button>
        <button
          aria-label={t("checkIn.lastGym.detailsAria")}
          className="gc-pressable grid size-12 place-items-center rounded-full border border-white/[0.1] bg-white/[0.04] text-white/72"
          onClick={onOpenDetail}
          type="button"
        >
          <span className="text-[15px] font-black">→</span>
        </button>
      </div>
      {feedback ? (
        <p className="mt-2 text-center text-[12px] font-bold text-[var(--gc-brand)]">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

function EmptyHero({
  searchEnabled,
  onOpenSearch,
}: {
  searchEnabled: boolean;
  onOpenSearch: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="mt-5 rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-6 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
        <MapPin size={24} strokeWidth={2.2} />
      </span>
      <h2 className="mt-3 text-[18px] font-black text-white">
        {t("checkIn.empty.title")}
      </h2>
      <p className="mx-auto mt-1 max-w-[280px] text-[13px] font-bold text-white/52">
        {t("checkIn.empty.detail")}
      </p>
      <button
        className="gc-pressable mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-black shadow-[0_0_22px_rgba(92,232,255,0.28)] disabled:opacity-60"
        disabled={!searchEnabled}
        onClick={onOpenSearch}
        type="button"
      >
        <Search size={16} strokeWidth={2.6} />
        {t("checkIn.empty.searchCta")}
      </button>
    </div>
  );
}

function NearbyPlacesList({
  places,
  loading,
  onSelect,
  onOpenSearch,
  searchEnabled,
}: {
  places: PlaceCandidate[];
  loading: boolean;
  onSelect: (place: PlaceCandidate) => void | Promise<void>;
  onOpenSearch: () => void;
  searchEnabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-black uppercase tracking-wide text-white/42">
          {t("checkIn.nearby.title")}
        </h3>
        {searchEnabled ? (
          <button
            className="gc-pressable text-[12px] font-black text-[var(--gc-brand)]"
            onClick={onOpenSearch}
            type="button"
          >
            {t("checkIn.nearby.search")}
          </button>
        ) : null}
      </div>

      {loading && places.length === 0 ? (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-[16px] bg-white/[0.04] py-6 text-[12px] font-bold text-white/52">
          <Loader2 className="animate-spin" size={14} strokeWidth={2.4} />
          {t("checkIn.nearby.loading")}
        </div>
      ) : null}

      {!loading && places.length === 0 ? (
        <div className="mt-3 rounded-[16px] border border-white/[0.06] bg-white/[0.02] p-4 text-center">
          <p className="text-[12px] font-bold text-white/52">
            {t("checkIn.nearby.empty")}
          </p>
          {searchEnabled ? (
            <button
              className="gc-pressable mt-2 text-[12px] font-black text-[var(--gc-brand)]"
              onClick={onOpenSearch}
              type="button"
            >
              {t("checkIn.nearby.register")}
            </button>
          ) : null}
        </div>
      ) : null}

      {places.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {places.slice(0, 5).map((place) => (
            <li key={place.providerId}>
              <button
                className="gc-pressable flex w-full items-center gap-3 rounded-[16px] bg-white/[0.04] p-3 text-left"
                onClick={() => void onSelect(place)}
                type="button"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/72">
                  <MapPin size={15} strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-black text-white">
                    {place.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[11px] font-bold text-white/52">
                    {place.distanceKm !== null ? (
                      <span className="text-[var(--gc-brand)]">
                        {place.distanceKm < 0.1
                          ? t("checkIn.distance.here")
                          : place.distanceKm < 1
                            ? `${Math.round(place.distanceKm * 1000)}m`
                            : `${place.distanceKm.toFixed(1).replace(".", ",")}km`}
                      </span>
                    ) : null}
                    {place.address || place.city ? (
                      <span className="truncate">
                        {[place.address, place.city].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FriendsAtLastGymList({
  friends,
  gymName,
  onSelectUser,
}: {
  friends: Array<{ user: GymUser; lastPost: EnrichedPost }>;
  gymName: string;
  onSelectUser?: (userId: string) => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <div className="mt-6">
      <h3 className="text-[13px] font-black uppercase tracking-wide text-white/42">
        {t("checkIn.friendsAtGym.title", { gymName })}
      </h3>
      <ul className="mt-3 space-y-2">
        {friends.map(({ user, lastPost }) => (
          <li key={user.id}>
            <button
              className="gc-pressable flex w-full items-center gap-3 rounded-[16px] bg-white/[0.04] p-3 text-left"
              onClick={() => onSelectUser?.(user.id)}
              type="button"
            >
              <Avatar
                accent={user.accent}
                name={user.name}
                size="sm"
                src={user.avatarUrl ?? undefined}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-black text-white">
                  {user.name}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-white/52">
                  <Clock size={10} strokeWidth={2.6} />
                  {formatRelativeDay(lastPost.createdAt, t, i18n.language)}
                  {lastPost.workoutType ? ` · ${lastPost.workoutType}` : ""}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// =====================================================================
// Selected gym view (detalhe completo, com toggle hoje/semana)
// =====================================================================

type SelectedGymViewProps = {
  gym: GymLocationOption;
  peopleAtGym: Array<{ user: GymUser; post: EnrichedPost }>;
  peopleFilter: PeopleFilter;
  recentPosts: EnrichedPost[];
  checkinPending: boolean;
  feedback: string | null;
  onCheckIn: () => void;
  onChangeFilter: (filter: PeopleFilter) => void;
  onChangeGym: () => void;
  onSelectUser?: (userId: string) => void;
};

function SelectedGymView({
  gym,
  peopleAtGym,
  peopleFilter,
  recentPosts,
  checkinPending,
  feedback,
  onCheckIn,
  onChangeFilter,
  onChangeGym,
  onSelectUser,
}: SelectedGymViewProps) {
  const { t, i18n } = useTranslation();

  return (
    <>
      <div className="mt-5 flex items-start gap-3 rounded-[20px] border border-white/[0.08] bg-white/[0.03] p-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
          <MapPin size={20} strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-black text-white">{gym.name}</p>
          {gym.city || gym.address ? (
            <p className="mt-0.5 truncate text-[12px] font-bold text-white/52">
              {[gym.address, gym.city].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
        <button
          aria-label={t("checkIn.selected.changePlace")}
          className="gc-pressable grid size-11 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/72"
          onClick={onChangeGym}
          type="button"
        >
          <X size={15} strokeWidth={2.4} />
        </button>
      </div>

      <button
        className="gc-pressable mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[15px] font-black text-black shadow-[0_0_24px_rgba(92,232,255,0.32)] disabled:opacity-50 disabled:shadow-none"
        disabled={checkinPending}
        onClick={onCheckIn}
        type="button"
      >
        {checkinPending ? (
          <Loader2 className="animate-spin" size={17} strokeWidth={2.6} />
        ) : (
          <Check size={18} strokeWidth={2.8} />
        )}
        {checkinPending ? t("checkIn.actions.confirming") : t("checkIn.actions.trainingHere")}
      </button>
      {feedback ? (
        <p className="mt-2 text-center text-[12px] font-bold text-[var(--gc-brand)]">
          {feedback}
        </p>
      ) : null}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-black text-white">{t("checkIn.selected.peopleTitle")}</h3>
          <PeopleFilterToggle filter={peopleFilter} onChange={onChangeFilter} />
        </div>

        {peopleAtGym.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {peopleAtGym.map(({ user, post }) => (
              <li key={user.id}>
                <button
                  className="gc-pressable flex w-full items-center gap-3 rounded-[16px] bg-white/[0.04] p-3 text-left"
                  onClick={() => onSelectUser?.(user.id)}
                  type="button"
                >
                  <Avatar
                    accent={user.accent}
                    name={user.name}
                    size="sm"
                    src={user.avatarUrl ?? undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-black text-white">
                      {user.name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-white/52">
                      <Clock size={10} strokeWidth={2.6} />
                      {peopleFilter === "today"
                        ? formatPostTime(post.createdAt, i18n.language)
                        : formatRelativeDay(post.createdAt, t, i18n.language)}
                      {post.workoutType ? ` · ${post.workoutType}` : ""}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3 rounded-[16px] border border-white/[0.06] bg-white/[0.02] p-4 text-center">
            <p className="text-[12px] font-bold text-white/52">
              {peopleFilter === "today"
                ? t("checkIn.selected.emptyToday")
                : t("checkIn.selected.emptyWeek")}
            </p>
          </div>
        )}
      </div>

      {recentPosts.length > 0 ? (
        <div className="mt-6">
          <h3 className="mb-3 text-[15px] font-black text-white">
            {t("checkIn.selected.recentPosts")}
          </h3>
          <div className="-mx-5 grid grid-cols-3 gap-[2px]">
            {recentPosts.map((post) => (
              <CheckInPostThumb
                key={post.id}
                onSelectUser={onSelectUser}
                post={post}
              />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function PeopleFilterToggle({
  filter,
  onChange,
}: {
  filter: PeopleFilter;
  onChange: (filter: PeopleFilter) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex h-8 items-center rounded-full bg-white/[0.05] p-0.5">
      <button
        aria-pressed={filter === "today"}
        className={[
          "gc-pressable rounded-full px-3 text-[11px] font-black transition-colors",
          filter === "today"
            ? "bg-white text-black"
            : "text-white/52",
        ].join(" ")}
        onClick={() => onChange("today")}
        type="button"
      >
        {t("checkIn.filters.today")}
      </button>
      <button
        aria-pressed={filter === "week"}
        className={[
          "gc-pressable rounded-full px-3 text-[11px] font-black transition-colors",
          filter === "week"
            ? "bg-white text-black"
            : "text-white/52",
        ].join(" ")}
        onClick={() => onChange("week")}
        type="button"
      >
        {t("checkIn.filters.week")}
      </button>
    </div>
  );
}

function CheckInPostThumb({
  post,
  onSelectUser,
}: {
  post: EnrichedPost;
  onSelectUser?: (userId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      aria-label={t("checkIn.postThumb.aria", {
        type: post.workoutType ?? t("checkIn.postThumb.defaultType"),
      })}
      className="gc-pressable relative aspect-square overflow-hidden bg-zinc-950"
      onClick={() => onSelectUser?.(post.userId)}
      type="button"
    >
      {post.mediaType === "video" ? (
        <video
          className="h-full w-full object-cover"
          muted
          playsInline
          poster={post.posterUrl ?? post.thumbnailUrl ?? undefined}
          preload="metadata"
          src={post.imageUrl}
        />
      ) : (
        <Image
          alt={post.workoutType || t("checkIn.postThumb.defaultType")}
          className="object-cover"
          fill
          sizes="(max-width: 480px) 33vw, 160px"
          src={post.thumbnailUrl ?? post.imageUrl}
        />
      )}
      <span className="pointer-events-none absolute bottom-1 right-1 rounded-full bg-black/64 px-1.5 py-0.5 text-[9px] font-black text-white backdrop-blur-md">
        <Camera className="inline" size={9} strokeWidth={2.6} />
      </span>
    </button>
  );
}

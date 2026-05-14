"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Check,
  Loader2,
  LocateFixed,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import type { GymLocationOption } from "./social/types";

/**
 * Shape consolidado dos lugares vindos da busca, dos próximos auto-fetched,
 * E do cadastro manual. Provider distingue origem (analytics + future use).
 */
export type PlaceCandidate = {
  provider: "registered" | "nominatim" | "overpass" | "manual";
  providerId: string;
  gymId?: string;
  name: string;
  address: string;
  neighborhood: string | null;
  city: string;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  kind: string;
};

export type LocatedPlaceCandidate = PlaceCandidate & {
  latitude: number;
  longitude: number;
};

type GymSearchSheetProps = {
  open: boolean;
  registeredGyms?: GymLocationOption[];
  onClose: () => void;
  onSelect: (candidate: PlaceCandidate) => void | Promise<void>;
  title?: string;
};

type Status = "idle" | "locating" | "ready" | "denied" | "unsupported";

type ReverseAddress = {
  address: string;
  neighborhood: string | null;
  city: string;
  state: string | null;
  displayName: string;
};

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number | null): string {
  if (km === null) return "";
  if (km < 0.1) return "aqui";
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 10) return `${km.toFixed(1).replace(".", ",")}km`;
  return `${Math.round(km)}km`;
}

function getKindLabel(kind: string): string {
  const lc = kind.toLowerCase();
  if (lc.includes("gym") || lc.includes("fitness")) return "Academia";
  if (lc.includes("sport")) return "Esporte";
  if (lc.includes("stadium") || lc.includes("pitch")) return "Estádio";
  if (lc.includes("park") || lc.includes("track")) return "Parque";
  return "Lugar";
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function getSearchText(candidate: PlaceCandidate): string {
  return normalizeText(
    [candidate.name, candidate.address, candidate.neighborhood, candidate.city, candidate.state]
      .filter(Boolean)
      .join(" "),
  );
}

function getSourceLabel(candidate: PlaceCandidate): string {
  if (candidate.provider === "registered") return "Cadastrada";
  if (candidate.provider === "overpass") return "Próxima";
  if (candidate.provider === "nominatim") return "Google/Localização";
  return "Manual";
}

function isSameApproxPlace(a: PlaceCandidate, b: PlaceCandidate): boolean {
  const aName = normalizeText(a.name);
  const bName = normalizeText(b.name);
  if (!aName || !bName) return false;

  const nameLooksSame =
    aName === bName ||
    (aName.length > 6 && bName.includes(aName)) ||
    (bName.length > 6 && aName.includes(bName));
  if (!nameLooksSame) return false;

  if (
    typeof a.latitude === "number" &&
    typeof a.longitude === "number" &&
    typeof b.latitude === "number" &&
    typeof b.longitude === "number"
  ) {
    return (
      calculateDistanceKm(
        { lat: a.latitude, lng: a.longitude },
        { lat: b.latitude, lng: b.longitude },
      ) <= 0.25
    );
  }

  const aCity = normalizeText(a.city);
  const bCity = normalizeText(b.city);
  const sameCity = Boolean(aCity && bCity && aCity === bCity);
  const aAddress = normalizeText(a.address);
  const bAddress = normalizeText(b.address);
  const sameAddress =
    Boolean(aAddress && bAddress && aAddress === bAddress) ||
    Boolean(aAddress && bAddress && aAddress.includes(bAddress)) ||
    Boolean(aAddress && bAddress && bAddress.includes(aAddress));

  return sameCity || sameAddress;
}

function dedupeCandidates(candidates: PlaceCandidate[]): PlaceCandidate[] {
  const deduped: PlaceCandidate[] = [];

  for (const candidate of candidates) {
    const duplicateIndex = deduped.findIndex((item) => isSameApproxPlace(item, candidate));
    if (duplicateIndex === -1) {
      deduped.push(candidate);
      continue;
    }

    // A academia já cadastrada no banco sempre ganha de resultados externos.
    if (
      candidate.provider === "registered" &&
      deduped[duplicateIndex]?.provider !== "registered"
    ) {
      deduped[duplicateIndex] = candidate;
    }
  }

  return deduped;
}

function gymToCandidate(
  gym: GymLocationOption,
  coords: { lat: number; lng: number } | null,
): PlaceCandidate {
  const hasCoordinates =
    typeof gym.latitude === "number" && typeof gym.longitude === "number";
  return {
    provider: "registered",
    providerId: `registered/${gym.id}`,
    gymId: gym.id,
    name: gym.name,
    address: gym.address ?? "",
    neighborhood: null,
    city: gym.city ?? "",
    state: gym.state ?? null,
    latitude: gym.latitude ?? null,
    longitude: gym.longitude ?? null,
    distanceKm:
      coords && hasCoordinates
        ? calculateDistanceKm(coords, {
            lat: gym.latitude as number,
            lng: gym.longitude as number,
          })
        : null,
    kind: "gym",
  };
}

/**
 * Sheet full-screen pra buscar academia/lugar. Fluxo:
 *
 * 1) Mostra academias cadastradas no banco.
 * 2) Se o usuário tocar em "Usar minha localização", busca próximos em
 *    /api/places/nearby e mistura com a base cadastrada.
 * 3) Se digita, debounced text search via /api/places/search.
 * 4) Cadastro manual exige GPS ativo, porque academia nova precisa ter
 *    latitude/longitude para entrar no catálogo.
 */
export function GymSearchSheet({
  open,
  registeredGyms = [],
  onClose,
  onSelect,
  title = "Onde você treinou?",
}: GymSearchSheetProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceCandidate[]>([]);
  const [nearby, setNearby] = useState<PlaceCandidate[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [selecting, setSelecting] = useState(false);

  // Cadastro manual
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerKind, setRegisterKind] = useState("gym");
  const [registerAddress, setRegisterAddress] = useState<ReverseAddress | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(
    async (searchTerm: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSearching(true);
      setSearchError(null);

      const params = new URLSearchParams({ q: searchTerm });
      if (coords) {
        params.set("lat", String(coords.lat));
        params.set("lng", String(coords.lng));
      }

      try {
        const res = await fetch(`/api/places/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Busca falhou");
        }
        const data = (await res.json()) as { results: PlaceCandidate[] };
        setResults(data.results);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setSearchError(err instanceof Error ? err.message : "Erro ao buscar.");
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [coords],
  );

  const runNearby = useCallback(async (lat: number, lng: number) => {
    setNearbyLoading(true);
    try {
      const res = await fetch(`/api/places/nearby?lat=${lat}&lng=${lng}&radius=2500`);
      if (!res.ok) {
        setNearby([]);
        return;
      }
      const data = (await res.json()) as { results: PlaceCandidate[] };
      setNearby(data.results);
    } catch {
      setNearby([]);
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    setStatus("locating");
    setSearchError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setStatus("ready");
      },
      (err) => {
        setNearby([]);
        setCoords(null);
        if (err.code === 1) setStatus("denied");
        else setStatus("idle");
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 9000 },
    );
  }, []);

  const handleSelect = useCallback(
    async (candidate: PlaceCandidate) => {
      if (selecting) return;
      setSelecting(true);
      try {
        await onSelect(candidate);
      } finally {
        setSelecting(false);
      }
    },
    [onSelect, selecting],
  );

  /**
   * Resolve cidade/estado do GPS atual via reverse geocode. Sem city
   * o RLS rejeita o INSERT (constraint exige city >= 2 chars). Falhas
   * caem num default brando "Brasil" — usuário não fica preso.
   */
  const loadReverseAddress = useCallback(async () => {
    if (!coords || registerAddress) return;
    try {
      const res = await fetch(`/api/places/reverse?lat=${coords.lat}&lng=${coords.lng}`);
      if (!res.ok) return;
      const data = (await res.json()) as ReverseAddress;
      setRegisterAddress(data);
    } catch {
      // ignorar — fallback no submit
    }
  }, [coords, registerAddress]);

  const handleRegister = useCallback(async () => {
    const name = registerName.trim();
    if (name.length < 3) {
      setRegisterError("Nome precisa ter pelo menos 3 letras.");
      return;
    }

    if (!coords) {
      setRegisterError("Para cadastrar uma academia, use sua localização primeiro.");
      return;
    }

    setRegisterLoading(true);
    setRegisterError(null);

    let resolvedAddress = registerAddress;
    if (!resolvedAddress) {
      try {
        const res = await fetch(`/api/places/reverse?lat=${coords.lat}&lng=${coords.lng}`);
        if (res.ok) resolvedAddress = (await res.json()) as ReverseAddress;
      } catch {
        // continua sem reverse
      }
    }

    const candidate: PlaceCandidate = {
      provider: "manual",
      providerId: `manual/${coords.lat.toFixed(5)}/${coords.lng.toFixed(5)}/${Date.now()}`,
      name,
      address: resolvedAddress?.address ?? "",
      neighborhood: resolvedAddress?.neighborhood ?? null,
      // RLS exige city >= 2 chars — fallback amplo se reverse falhar
      city: resolvedAddress?.city || "Brasil",
      state: resolvedAddress?.state ?? null,
      latitude: coords.lat,
      longitude: coords.lng,
      distanceKm: 0,
      kind: registerKind,
    };

    try {
      await onSelect(candidate);
      // Cleanup só roda se o caller não fechar o sheet por conta própria
      setRegisterOpen(false);
      setRegisterName("");
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : "Não foi possível cadastrar.");
    } finally {
      setRegisterLoading(false);
    }
  }, [
    coords,
    onSelect,
    registerAddress,
    registerKind,
    registerName,
  ]);

  // Reset state quando o sheet abre
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setQuery("");
      setResults([]);
      setSearchError(null);
      setRegisterOpen(false);
      setRegisterName("");
      setRegisterError(null);
      setRegisterAddress(null);
      setCoords(null);
      setNearby([]);
      setStatus("idle");
    });
    const id = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open]);

  // Auto-fetch lugares próximos quando coords ficam prontas.
  // queueMicrotask defere a chamada (que faz setState síncrono internamente)
  // pra fora do effect body, satisfazendo o Next 16 lint.
  useEffect(() => {
    if (!open || !coords) return;
    queueMicrotask(() => void runNearby(coords.lat, coords.lng));
  }, [coords, open, runNearby]);

  // Pré-carrega reverse geocode quando abre form de cadastro
  useEffect(() => {
    if (!registerOpen) return;
    queueMicrotask(() => void loadReverseAddress());
  }, [registerOpen, loadReverseAddress]);

  // Debounced text search
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      queueMicrotask(() => {
        setResults([]);
        setSearchError(null);
      });
      return;
    }

    const timer = window.setTimeout(() => {
      void runSearch(trimmed);
    }, 280);

    return () => window.clearTimeout(timer);
  }, [query, open, runSearch]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (status === "locating") return "Pegando sua localização...";
    if (status === "ready") return "Academias próximas e cadastradas";
    if (status === "denied") return "Permissão negada — busque por nome";
    if (status === "unsupported") return "GPS indisponível — busca por nome";
    return "Busque pelo nome ou use sua localização";
  }, [status]);

  const registeredCandidates = useMemo(() => {
    const trimmed = query.trim();
    const normalizedQuery = normalizeText(trimmed);
    const origin = coords ? { lat: coords.lat, lng: coords.lng } : null;
    const candidates = registeredGyms.map((gym) => gymToCandidate(gym, origin));

    const filtered = candidates.filter((candidate) => {
      if (normalizedQuery.length >= 2) {
        return getSearchText(candidate).includes(normalizedQuery);
      }
      if (origin && candidate.distanceKm !== null) {
        return candidate.distanceKm <= 8;
      }
      return true;
    });

    return filtered
      .sort((a, b) => {
        if (a.distanceKm !== null && b.distanceKm !== null) {
          return a.distanceKm - b.distanceKm;
        }
        if (a.distanceKm !== null) return -1;
        if (b.distanceKm !== null) return 1;
        return a.name.localeCompare(b.name, "pt-BR");
      })
      .slice(0, origin ? 30 : 40);
  }, [coords, query, registeredGyms]);

  // O que mostrar na lista: banco sempre entra primeiro; API complementa.
  const isSearching = query.trim().length >= 2;
  const apiResults = isSearching ? results : nearby;
  const visibleResults = useMemo(
    () => dedupeCandidates([...registeredCandidates, ...apiResults]),
    [apiResults, registeredCandidates],
  );
  const showRegisterCTA = !registerOpen;

  if (!open) return null;

  return (
    <div className="gc-safe-overlay absolute inset-0 z-50 bg-black/94 backdrop-blur-2xl">
      <div className="relative mx-auto flex h-full max-h-[840px] min-h-[620px] flex-col overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#0a0b0c] shadow-[0_28px_72px_rgba(0,0,0,0.7)]">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/36">
              Buscar lugar
            </p>
            <h2 className="text-[19px] font-black">{title}</h2>
          </div>
          <button
            aria-label="Fechar"
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={onClose}
            type="button"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        </header>

        <div className="border-b border-white/[0.06] p-4">
          <div className="flex h-12 items-center gap-3 rounded-full bg-white/[0.06] px-4">
            <Search className="text-white/52" size={17} strokeWidth={2.4} />
            <input
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              className="w-full bg-transparent text-[15px] font-bold text-white outline-none placeholder:text-white/36"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Bluefit, Pacaembu, sua academia..."
              ref={inputRef}
              spellCheck={false}
              type="search"
              value={query}
            />
            {searching ? (
              <Loader2 className="animate-spin text-white/52" size={16} strokeWidth={2.4} />
            ) : null}
          </div>
          <p className="mt-2 flex items-center gap-1.5 px-1 text-[11px] font-bold text-white/42">
            <LocateFixed size={11} strokeWidth={2.4} />
            {statusLabel}
          </p>
          <button
            className="gc-pressable mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] text-[13px] font-black text-white disabled:opacity-50"
            disabled={status === "locating"}
            onClick={requestLocation}
            type="button"
          >
            {status === "locating" ? (
              <Loader2 className="animate-spin" size={15} strokeWidth={2.4} />
            ) : coords ? (
              <RefreshCw size={15} strokeWidth={2.4} />
            ) : (
              <LocateFixed size={15} strokeWidth={2.4} />
            )}
            {status === "locating"
              ? "Localizando..."
              : coords
                ? "Atualizar localização"
                : "Usar minha localização"}
          </button>
          <p className="mt-2 px-1 text-[11px] font-bold leading-4 text-white/34">
            Usamos sua localização apenas para encontrar academias próximas. Você pode
            escolher sem liberar GPS.
          </p>
        </div>

        <div className="gc-scrollbar flex-1 overflow-y-auto">
          {searchError && isSearching ? (
            <div className="px-5 py-6 text-center">
              <p className="text-[13px] font-bold text-[var(--gc-pink)]">
                {searchError}
              </p>
            </div>
          ) : null}

          {/* Header de seção: "Lugares perto" vs "Resultados pra X" */}
          {!registerOpen && visibleResults.length > 0 ? (
            <p className="px-5 pt-4 text-[11px] font-black uppercase tracking-wide text-white/42">
              {isSearching
                ? `Resultados para "${query.trim()}"`
                : coords
                  ? "Perto de você"
                  : "Academias cadastradas"}
            </p>
          ) : null}

          {/* Lista de resultados (search ou nearby) */}
          {!registerOpen && visibleResults.length > 0 ? (
            <ul className="mt-2 divide-y divide-white/[0.05]">
              {visibleResults.map((candidate) => (
                <li key={candidate.providerId}>
                  <button
                    className="gc-pressable flex w-full items-start gap-3 px-5 py-4 text-left disabled:opacity-50"
                    disabled={selecting}
                    onClick={() => void handleSelect(candidate)}
                    type="button"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/72">
                      <MapPin size={16} strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-black text-white">
                        {candidate.name}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] font-bold text-white/52">
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                            candidate.provider === "registered"
                              ? "bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]"
                              : "bg-white/[0.05] text-white/52",
                          ].join(" ")}
                        >
                          {getSourceLabel(candidate)}
                        </span>
                        <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white/52">
                          {getKindLabel(candidate.kind)}
                        </span>
                        {candidate.distanceKm !== null ? (
                          <span className="text-[var(--gc-brand)]">
                            {formatDistance(candidate.distanceKm)}
                          </span>
                        ) : null}
                        {candidate.address || candidate.city ? (
                          <span className="truncate">
                            {[candidate.address, candidate.city]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Loading nearby (1ª vez ainda buscando) */}
          {!registerOpen && !isSearching && nearbyLoading && nearby.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
              <Loader2
                aria-hidden
                className="animate-spin text-white/40"
                size={22}
                strokeWidth={2.2}
              />
              <p className="text-[12px] font-bold text-white/42">
                Procurando lugares no seu entorno...
              </p>
            </div>
          ) : null}

          {/* Empty state da search por texto */}
          {!registerOpen && isSearching && !searching && visibleResults.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[13px] font-bold text-white/52">
                Nada encontrado pra &ldquo;{query.trim()}&rdquo;.
              </p>
              <p className="mt-1 text-[12px] font-bold text-white/40">
                Tenta variações ou só o nome principal.
              </p>
            </div>
          ) : null}

          {/* Empty state nearby (sem resultados, GPS ok) */}
          {!registerOpen &&
          !isSearching &&
          !nearbyLoading &&
          visibleResults.length === 0 &&
          coords ? (
            <div className="px-5 py-10 text-center">
              <Building2
                aria-hidden
                className="mx-auto text-white/22"
                size={36}
                strokeWidth={1.8}
              />
              <p className="mt-3 text-[13px] font-bold text-white/52">
                Nenhum lugar mapeado no seu entorno.
              </p>
              <p className="mt-1 text-[12px] font-bold text-white/40">
                Pode cadastrar o seu — vai ficar fixo aqui pra outros encontrarem.
              </p>
            </div>
          ) : null}

          {/* Sem GPS — pede pra digitar */}
          {!registerOpen &&
          !isSearching &&
          !coords &&
          status !== "locating" &&
          visibleResults.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Building2
                aria-hidden
                className="mx-auto text-white/22"
                size={36}
                strokeWidth={1.8}
              />
              <p className="mt-3 text-[13px] font-bold text-white/52">
                Digite o nome ou use sua localização.
              </p>
            </div>
          ) : null}

          {/* CTA "Cadastrar este lugar" — sempre visível quando GPS ok */}
          {showRegisterCTA ? (
            <div className="border-t border-white/[0.04] px-5 py-4">
              <button
                className="gc-pressable flex w-full items-center gap-3 rounded-[16px] border border-dashed border-white/[0.14] bg-white/[0.02] px-4 py-3.5 text-left"
                onClick={() => setRegisterOpen(true)}
                type="button"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
                  <Plus size={18} strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-black text-white">
                    Não achei meu lugar
                  </span>
                  <span className="mt-0.5 block text-[12px] font-bold text-white/52">
                    Cadastrar manualmente — fica fixo pra outros encontrarem
                  </span>
                </span>
              </button>
            </div>
          ) : null}

          {/* Form de cadastro inline */}
          {registerOpen ? (
            <div className="space-y-4 border-t border-white/[0.04] p-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-white/42">
                  Nome do lugar
                </p>
                <input
                  autoCapitalize="words"
                  className="mt-2 h-12 w-full rounded-[14px] border border-white/[0.08] bg-white/[0.05] px-4 text-[15px] font-bold text-white outline-none placeholder:text-white/30"
                  maxLength={80}
                  onChange={(event) => setRegisterName(event.target.value)}
                  placeholder="Ex: Bluefit Vila Mariana, Pista do Pacaembu"
                  value={registerName}
                />
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-white/42">
                  Tipo
                </p>
                <select
                  className="mt-2 h-11 w-full rounded-[14px] bg-white/[0.05] px-3 text-[14px] font-bold text-white outline-none"
                  onChange={(event) => setRegisterKind(event.target.value)}
                  value={registerKind}
                >
                  <option className="bg-black" value="gym">Academia</option>
                  <option className="bg-black" value="sports_centre">Centro esportivo</option>
                  <option className="bg-black" value="stadium">Estádio</option>
                  <option className="bg-black" value="track">Pista de corrida</option>
                  <option className="bg-black" value="park">Parque</option>
                  <option className="bg-black" value="place">Outro</option>
                </select>
              </div>

              <div className="flex items-start gap-2 rounded-[14px] bg-white/[0.04] px-3 py-3">
                <MapPin
                  className={[
                    "shrink-0",
                    coords ? "text-[var(--gc-brand)]" : "text-white/42",
                  ].join(" ")}
                  size={14}
                  strokeWidth={2.4}
                />
                <p className="text-[12px] font-bold leading-5 text-white/72">
                  {coords ? (
                    <>
                      Vai ficar pinado{" "}
                      <span className="text-white">
                        {registerAddress?.displayName
                          ? registerAddress.displayName.split(",").slice(0, 2).join(",")
                          : "na sua localização atual"}
                      </span>
                      . Outros usuários nessa região vão achar quando pesquisarem.
                    </>
                  ) : (
                    <>
                      Para cadastrar uma academia nova, primeiro toque em{" "}
                      <span className="text-white">Usar minha localização</span>.
                    </>
                  )}
                </p>
              </div>

              {!coords ? (
                <button
                  className="gc-pressable flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] text-[13px] font-black text-white disabled:opacity-50"
                  disabled={status === "locating"}
                  onClick={requestLocation}
                  type="button"
                >
                  {status === "locating" ? (
                    <Loader2 className="animate-spin" size={15} strokeWidth={2.4} />
                  ) : (
                    <LocateFixed size={15} strokeWidth={2.4} />
                  )}
                  {status === "locating" ? "Localizando..." : "Usar localização para cadastrar"}
                </button>
              ) : null}

              {registerError ? (
                <p className="text-[12px] font-bold text-[var(--gc-pink)]">
                  {registerError}
                </p>
              ) : null}

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <button
                  className="gc-pressable flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-black disabled:opacity-50"
                  disabled={registerLoading || registerName.trim().length < 3 || !coords}
                  onClick={() => void handleRegister()}
                  type="button"
                >
                  {registerLoading ? (
                    <Loader2 className="animate-spin" size={15} strokeWidth={2.4} />
                  ) : (
                    <Check size={15} strokeWidth={2.6} />
                  )}
                  {registerLoading ? "Cadastrando..." : "Cadastrar e usar"}
                </button>
                <button
                  className="gc-pressable grid size-12 place-items-center rounded-full border border-white/[0.1] bg-white/[0.04] text-white/72"
                  disabled={registerLoading}
                  onClick={() => setRegisterOpen(false)}
                  type="button"
                  aria-label="Cancelar cadastro"
                >
                  <X size={16} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

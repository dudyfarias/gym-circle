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
import {
  buildLocationResultSections,
  formatDistance,
  getKindLabel,
  getSourceLabel,
  isSameApproxPlace,
  type PlaceCandidate,
} from "./social/locationSearch";

export type { LocatedPlaceCandidate, PlaceCandidate } from "./social/locationSearch";

type GymSearchSheetProps = {
  open: boolean;
  registeredGyms?: GymLocationOption[];
  recentCandidates?: PlaceCandidate[];
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
  recentCandidates = [],
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
  const [registerManualAddress, setRegisterManualAddress] = useState("");
  const [registerManualCity, setRegisterManualCity] = useState("");
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

    const manualCity = registerManualCity.trim();
    const manualAddress = registerManualAddress.trim();

    const candidate: PlaceCandidate = {
      provider: "manual",
      providerId: `manual/${coords.lat.toFixed(5)}/${coords.lng.toFixed(5)}/${Date.now()}`,
      name,
      address: manualAddress || resolvedAddress?.address || "",
      neighborhood: manualCity || resolvedAddress?.neighborhood || null,
      // RLS exige city >= 2 chars — fallback amplo se reverse falhar
      city: manualCity || resolvedAddress?.city || resolvedAddress?.neighborhood || "Brasil",
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
    registerManualAddress,
    registerManualCity,
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
      setRegisterManualAddress("");
      setRegisterManualCity("");
      setRegisterError(null);
      setRegisterAddress(null);
      setNearby([]);
    });
    const id = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (coords) return;
    if (typeof navigator === "undefined" || !navigator.permissions) return;

    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((permission) => {
        if (permission.state === "granted") requestLocation();
        if (permission.state === "denied") setStatus("denied");
      })
      .catch(() => undefined);
  }, [coords, open, requestLocation]);

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

  const currentLocationCandidate = useMemo<PlaceCandidate | null>(() => {
    if (!coords) return null;
    return {
      provider: "current",
      providerId: `current/${coords.lat.toFixed(5)}/${coords.lng.toFixed(5)}`,
      name: "Localização atual",
      address: "",
      neighborhood: null,
      city: "",
      state: null,
      latitude: coords.lat,
      longitude: coords.lng,
      distanceKm: 0,
      kind: "current",
    };
  }, [coords]);

  const sections = useMemo(
    () =>
      buildLocationResultSections({
        apiResults: query.trim().length >= 2 ? results : nearby,
        coords,
        currentLocationCandidate,
        query,
        recentCandidates,
        registeredGyms,
      }),
    [coords, currentLocationCandidate, nearby, query, recentCandidates, registeredGyms, results],
  );

  const visibleResults = sections.isSearching
    ? sections.search
    : [...sections.recent, ...sections.nearby];
  const similarRegistered = useMemo(() => {
    const name = registerName.trim() || query.trim();
    if (name.length < 3) return null;
    const candidate: PlaceCandidate = {
      provider: "manual",
      providerId: "manual/draft",
      name,
      address: registerManualAddress,
      neighborhood: registerManualCity || null,
      city: registerManualCity,
      state: null,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      distanceKm: null,
      kind: registerKind,
    };
    return (
      [...sections.recent, ...sections.nearby, ...sections.search].find((item) =>
        isSameApproxPlace(item, candidate),
      ) ?? null
    );
  }, [
    coords,
    query,
    registerKind,
    registerManualAddress,
    registerManualCity,
    registerName,
    sections.nearby,
    sections.recent,
    sections.search,
  ]);
  const isSearching = sections.isSearching;
  const showRegisterCTA = !registerOpen;
  const openRegister = useCallback(() => {
    setRegisterName((current) => current || query.trim());
    setRegisterOpen(true);
  }, [query]);

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
          {status !== "denied" ? (
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
                  : "Usar minha localização para encontrar academias próximas"}
            </button>
          ) : null}
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

          {!registerOpen && isSearching ? (
            <CandidateSection
              candidates={sections.search}
              onSelect={handleSelect}
              selecting={selecting}
              title={`Resultados para "${query.trim()}"`}
            />
          ) : null}

          {!registerOpen && !isSearching && sections.recent.length > 0 ? (
            <CandidateSection
              candidates={sections.recent}
              onSelect={handleSelect}
              selecting={selecting}
              title="Recentes"
            />
          ) : null}

          {!registerOpen && !isSearching && sections.nearby.length > 0 ? (
            <CandidateSection
              candidates={sections.nearby}
              onSelect={handleSelect}
              selecting={selecting}
              title="Perto de você"
            />
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
                onClick={openRegister}
                type="button"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
                  <Plus size={18} strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-black text-white">
                    {query.trim()
                      ? `Cadastrar "${query.trim()}"`
                      : "Cadastrar nova academia"}
                  </span>
                  <span className="mt-0.5 block text-[12px] font-bold text-white/52">
                    Nome, tipo e localização. Fica fixo pra outros encontrarem.
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
                  <option className="bg-black" value="park">Parque</option>
                  <option className="bg-black" value="studio">Estúdio</option>
                  <option className="bg-black" value="place">Outro</option>
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wide text-white/42">
                    Endereço
                  </p>
                  <input
                    autoCapitalize="words"
                    className="mt-2 h-11 w-full rounded-[14px] border border-white/[0.08] bg-white/[0.05] px-3 text-[14px] font-bold text-white outline-none placeholder:text-white/30"
                    maxLength={90}
                    onChange={(event) => setRegisterManualAddress(event.target.value)}
                    placeholder="Opcional"
                    value={registerManualAddress}
                  />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wide text-white/42">
                    Cidade/bairro
                  </p>
                  <input
                    autoCapitalize="words"
                    className="mt-2 h-11 w-full rounded-[14px] border border-white/[0.08] bg-white/[0.05] px-3 text-[14px] font-bold text-white outline-none placeholder:text-white/30"
                    maxLength={60}
                    onChange={(event) => setRegisterManualCity(event.target.value)}
                    placeholder="Opcional"
                    value={registerManualCity}
                  />
                </div>
              </div>

              {similarRegistered ? (
                <div className="rounded-[14px] border border-[var(--gc-brand)]/18 bg-[var(--gc-brand)]/8 px-3 py-2 text-[12px] font-bold leading-5 text-white/68">
                  Já existe algo parecido:{" "}
                  <button
                    className="gc-pressable font-black text-[var(--gc-brand)]"
                    onClick={() => void handleSelect(similarRegistered)}
                    type="button"
                  >
                    {similarRegistered.name}
                  </button>
                </div>
              ) : null}

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

function CandidateSection({
  candidates,
  onSelect,
  selecting,
  title,
}: {
  candidates: PlaceCandidate[];
  onSelect: (candidate: PlaceCandidate) => void | Promise<void>;
  selecting: boolean;
  title: string;
}) {
  if (candidates.length === 0) return null;

  return (
    <section>
      <p className="px-5 pt-4 text-[11px] font-black uppercase tracking-wide text-white/42">
        {title}
      </p>
      <ul className="mt-2 divide-y divide-white/[0.05]">
        {candidates.map((candidate) => (
          <li key={candidate.providerId}>
            <button
              className="gc-pressable flex w-full items-start gap-3 px-5 py-4 text-left disabled:opacity-50"
              disabled={selecting}
              onClick={() => void onSelect(candidate)}
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
                      candidate.provider === "registered" || candidate.provider === "current"
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
                      {[candidate.address, candidate.city].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

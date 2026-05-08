"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, LocateFixed, Loader2, MapPin, Search, X } from "lucide-react";

/**
 * Mesmo shape retornado pelo /api/places/search. Não importa do route
 * direto pra evitar coupling entre cliente e server route — duplicar
 * o tipo é mais barato que criar package compartilhado nesse momento.
 */
export type PlaceCandidate = {
  provider: "nominatim";
  providerId: string;
  name: string;
  address: string;
  neighborhood: string | null;
  city: string;
  state: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  kind: string;
};

type GymSearchSheetProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (candidate: PlaceCandidate) => void | Promise<void>;
};

type Status = "idle" | "locating" | "ready" | "denied" | "unsupported";

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

/**
 * Sheet full-screen pra buscar academia/lugar via Nominatim. Padrão
 * iOS/Apple Maps: search bar no topo, lista de resultados embaixo,
 * cada item mostra nome + endereço + distância.
 *
 * Props enxutas: o caller decide o que fazer com o candidato selecionado
 * (catalogar via gymService.findOrCreateFromPlace, vincular ao user, etc).
 */
export function GymSearchSheet({ open, onClose, onSelect }: GymSearchSheetProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [selecting, setSelecting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Função de busca declarada ANTES dos effects que a referenciam pra
   * evitar TDZ (Next 16 strict lint flag). Cancela request anterior via
   * AbortController quando o user digita rápido.
   */
  const runSearch = useCallback(
    async (searchTerm: string) => {
      // Cancela request anterior se ainda voando
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

  // Reset state quando o sheet abre (não quando fecha — close é fast)
  useEffect(() => {
    if (!open) return;
    // queueMicrotask defere o setState pra fora do effect body sync.
    // O Next 16 lint rule "Calling setState synchronously within an effect"
    // detecta o pattern síncrono como causa de cascading renders.
    queueMicrotask(() => {
      setQuery("");
      setResults([]);
      setSearchError(null);
    });
    const id = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open]);

  // Geolocation — uma vez por abertura. setStatus deferido por microtask.
  useEffect(() => {
    if (!open) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      queueMicrotask(() => setStatus("unsupported"));
      return;
    }
    queueMicrotask(() => setStatus("locating"));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setStatus("ready");
      },
      (err) => {
        if (err.code === 1) setStatus("denied");
        else setStatus("idle");
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 9000 },
    );
  }, [open]);

  // Debounced search — dispara 280ms após o user parar de digitar.
  // runSearch já está declarado acima → sem TDZ.
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

  // Cancela request pendente ao desmontar
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (status === "locating") return "Pegando sua localização...";
    if (status === "ready") return "Resultados perto de você";
    if (status === "denied") return "Sem GPS — busca por nome em todo o Brasil";
    if (status === "unsupported") return "GPS indisponível — busca por nome";
    return "Digite para buscar";
  }, [status]);

  if (!open) return null;

  return (
    <div className="gc-safe-overlay absolute inset-0 z-50 bg-black/94 backdrop-blur-2xl">
      <div className="relative mx-auto flex h-full max-h-[840px] min-h-[620px] flex-col overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#0a0b0c] shadow-[0_28px_72px_rgba(0,0,0,0.7)]">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/36">
              Buscar lugar
            </p>
            <h2 className="text-[19px] font-black">Onde você treinou?</h2>
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
        </div>

        <div className="gc-scrollbar flex-1 overflow-y-auto">
          {searchError ? (
            <div className="px-5 py-6 text-center">
              <p className="text-[13px] font-bold text-[var(--gc-pink)]">
                {searchError}
              </p>
              <p className="mt-2 text-[12px] font-bold text-white/42">
                Tente reformular o nome ou esperar alguns segundos.
              </p>
            </div>
          ) : null}

          {!searchError && query.trim().length < 2 ? (
            <div className="px-5 py-10 text-center">
              <Building2
                aria-hidden
                className="mx-auto text-white/22"
                size={36}
                strokeWidth={1.8}
              />
              <p className="mt-3 text-[13px] font-bold text-white/52">
                Comece digitando o nome da academia, parque ou lugar.
              </p>
              {status === "denied" ? (
                <p className="mx-auto mt-2 max-w-[260px] text-[11px] font-bold text-white/40">
                  Libere a localização no navegador pra ordenar resultados pelos mais próximos.
                </p>
              ) : null}
            </div>
          ) : null}

          {!searchError && query.trim().length >= 2 && !searching && results.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[13px] font-bold text-white/52">
                Nada encontrado pra &ldquo;{query.trim()}&rdquo;.
              </p>
              <p className="mt-1 text-[12px] font-bold text-white/40">
                Tenta variações ou só o nome principal (ex: &ldquo;Bluefit&rdquo;).
              </p>
            </div>
          ) : null}

          {results.length > 0 ? (
            <ul className="divide-y divide-white/[0.05]">
              {results.map((candidate) => (
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
                        <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white/52">
                          {getKindLabel(candidate.kind)}
                        </span>
                        {candidate.distanceKm !== null ? (
                          <span className="text-[var(--gc-brand)]">
                            {formatDistance(candidate.distanceKm)}
                          </span>
                        ) : null}
                        <span className="truncate">
                          {[candidate.address, candidate.city]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import type { ChangeEvent } from "react";
import { useMemo, useRef, useState } from "react";
import {
  buildGoogleMapsSearchUrl,
  buildGoogleMapsUrlFromCoordinates,
  resolveApproximateLocationName,
  type Coordinates,
} from "@gym-circle/core";
import {
  Camera,
  Check,
  ChevronDown,
  LocateFixed,
  RefreshCw,
  Search,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import type {
  CreateWorkoutPostInput,
  EnrichedUser,
  GymLocationOption,
  PostLocationSource,
  PostMediaType,
} from "../social/types";
import { TopBar } from "../TopBar";
import {
  GymSearchSheet,
  type LocatedPlaceCandidate,
  type PlaceCandidate,
} from "../GymSearchSheet";

type PostScreenProps = {
  currentUser: EnrichedUser;
  gyms?: GymLocationOption[];
  onPublish: (input: CreateWorkoutPostInput) => void | Promise<void>;
  onUploadImage?: (file: File) => Promise<string>;
  taggableUsers?: EnrichedUser[];
  /**
   * Cataloga um lugar buscado via Maps no banco (dedup + insert) e
   * vincula ao perfil do user. Se ausente, o botão "Buscar academia"
   * não aparece. O parent resolve via `gymService.findOrCreateFromPlace`.
   */
  onCatalogPlace?: (place: LocatedPlaceCandidate) => Promise<GymLocationOption>;
};

const workoutTypes = [
  { label: "Sem tipo", value: "" },
  { label: "Musculação", value: "Musculação" },
  { label: "Corrida", value: "Corrida" },
  { label: "Bike", value: "Bike" },
  { label: "Funcional", value: "Funcional" },
  { label: "Cardio", value: "Cardio" },
  { label: "Mobilidade", value: "Mobilidade" },
  { label: "Outro", value: "Outro" },
];

type SelectableLocationSource = Exclude<PostLocationSource, "custom">;
type CurrentLocationStatus =
  | "idle"
  | "requesting"
  | "found"
  | "denied"
  | "error"
  | "unsupported";

const locationOptions: Array<{ label: string; value: SelectableLocationSource }> = [
  { label: "Nenhuma", value: "none" },
  { label: "Academia cadastrada", value: "gym" },
  { label: "Localização atual", value: "current" },
];

function getMediaType(file: File): PostMediaType {
  return file.type.startsWith("video/") ? "video" : "image";
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Algo saiu errado. Tente de novo.";
}

function getLocationError(err: unknown): { status: CurrentLocationStatus; message: string } {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? Number((err as { code?: unknown }).code)
      : 0;

  if (code === 1) {
    return {
      status: "denied",
      message: "Permissão negada. Você pode remover a localização e postar normalmente.",
    };
  }

  if (code === 3) {
    return {
      status: "error",
      message: "Tempo esgotado. Tente novamente ou remova a localização.",
    };
  }

  return {
    status: "error",
    message: "Não conseguimos encontrar sua localização agora.",
  };
}

function getGymMeta(gym: GymLocationOption): string {
  return [gym.address, gym.city, gym.state].filter(Boolean).join(" · ");
}

function getGymMapsUrl(gym: GymLocationOption): string {
  if (typeof gym.latitude === "number" && typeof gym.longitude === "number") {
    return buildGoogleMapsUrlFromCoordinates({
      latitude: gym.latitude,
      longitude: gym.longitude,
    });
  }

  return buildGoogleMapsSearchUrl(
    [gym.name, gym.address, gym.city, gym.state].filter(Boolean).join(", "),
  );
}

function getLocationStatusCopy(
  status: CurrentLocationStatus,
  accuracy: number | null,
): { title: string; detail: string } {
  switch (status) {
    case "requesting":
      return {
        title: "Pedindo permissão",
        detail: "O navegador vai solicitar acesso ao GPS.",
      };
    case "found":
      return {
        title: "Localização encontrada",
        detail: accuracy
          ? `Precisão aproximada de ${Math.round(accuracy)} m.`
          : "Seu post vai mostrar apenas localização aproximada.",
      };
    case "denied":
      return {
        title: "Permissão negada",
        detail: "Remova a localização ou libere o acesso no navegador.",
      };
    case "unsupported":
      return {
        title: "GPS indisponível",
        detail: "Este navegador não suporta localização atual.",
      };
    case "error":
      return {
        title: "Erro ao localizar",
        detail: "Tente novamente em alguns segundos.",
      };
    case "idle":
    default:
      return {
        title: "Localização atual",
        detail: "Use GPS para salvar o ponto do treino sem expor coordenadas no feed.",
      };
  }
}

export function PostScreen({
  currentUser,
  gyms = [],
  onPublish,
  onUploadImage,
  onCatalogPlace,
  taggableUsers = [],
}: PostScreenProps) {
  const [caption, setCaption] = useState("");
  // Academias catalogadas durante essa sessão de post (via search sheet) —
  // se juntam às `gyms` recebidas via prop pra que o select reconheça.
  const [localGyms, setLocalGyms] = useState<GymLocationOption[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [cataloging, setCataloging] = useState(false);
  const [workoutType, setWorkoutType] = useState("");
  const [customWorkoutType, setCustomWorkoutType] = useState("");
  const [locationMode, setLocationMode] = useState<SelectableLocationSource>("none");
  const [selectedGymId, setSelectedGymId] = useState("");
  const [locationName, setLocationName] = useState("");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<CurrentLocationStatus>("idle");
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [mediaType, setMediaType] = useState<PostMediaType>("image");
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  // Default = feed + story. Story acende o badge do streak; feed dá conteúdo
  // permanente. Ambos saem da mesma upload — escolher é caso de power user.
  const [postToFeed, setPostToFeed] = useState(true);
  const [postToStory, setPostToStory] = useState(true);
  const [friendQuery, setFriendQuery] = useState("");
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const resolvedWorkoutType = useMemo(() => {
    if (workoutType === "Outro") {
      return customWorkoutType.trim() || null;
    }
    return workoutType.trim() || null;
  }, [customWorkoutType, workoutType]);

  const registeredGyms = useMemo<GymLocationOption[]>(() => {
    // Mescla 3 fontes priorizando dados ricos:
    //   1) gyms (tabela real do banco — vem do parent)
    //   2) localGyms (catalogadas no fluxo de busca dessa sessão)
    //   3) currentUser.gyms (só nomes, fallback final)
    // Dedup por id pra não duplicar quando o catalog refresh trouxer
    // a mesma gym que acabou de ser inserida.
    const merged = new Map<string, GymLocationOption>();
    for (const gym of gyms) merged.set(gym.id, gym);
    for (const gym of localGyms) merged.set(gym.id, gym);
    if (merged.size > 0) return Array.from(merged.values());
    return currentUser.gyms.map((name, index) => ({
      id: `profile-gym-${index}`,
      name,
      address: null,
      city: currentUser.location || null,
      state: null,
      latitude: null,
      longitude: null,
    }));
  }, [currentUser.gyms, currentUser.location, gyms, localGyms]);

  const searchableGyms = useMemo<GymLocationOption[]>(() => {
    const merged = new Map<string, GymLocationOption>();
    for (const gym of gyms) merged.set(gym.id, gym);
    for (const gym of localGyms) merged.set(gym.id, gym);
    return Array.from(merged.values());
  }, [gyms, localGyms]);

  const selectedGym = useMemo(
    () => registeredGyms.find((gym) => gym.id === selectedGymId) ?? null,
    [registeredGyms, selectedGymId],
  );

  const selectedTaggedUsers = useMemo(
    () =>
      taggedUserIds
        .map((id) => taggableUsers.find((user) => user.id === id))
        .filter((user): user is EnrichedUser => Boolean(user)),
    [taggableUsers, taggedUserIds],
  );

  const friendSuggestions = useMemo(() => {
    const query = friendQuery.trim().toLowerCase();
    if (query.length < 2) return [];
    return taggableUsers
      .filter((user) => user.id !== currentUser.id)
      .filter((user) => !taggedUserIds.includes(user.id))
      .filter(
        (user) =>
          user.username.toLowerCase().includes(query) ||
          user.name.toLowerCase().includes(query),
      )
      .slice(0, 6);
  }, [currentUser.id, friendQuery, taggableUsers, taggedUserIds]);

  const resolvedLocation = useMemo(() => {
    if (locationMode === "none") {
      return {
        source: "none" as const,
        name: null,
        gymId: null,
        latitude: null,
        longitude: null,
        googleMapsUrl: null,
      };
    }

    if (locationMode === "gym" && selectedGym) {
      return {
        source: "gym" as const,
        name: selectedGym.name,
        gymId: selectedGym.id.startsWith("profile-gym-") ? null : selectedGym.id,
        latitude: selectedGym.latitude ?? null,
        longitude: selectedGym.longitude ?? null,
        googleMapsUrl: getGymMapsUrl(selectedGym),
      };
    }

    if (locationMode === "current" && coordinates) {
      return {
        source: "current" as const,
        name: locationName.trim() || "Localização atual",
        gymId: null,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        googleMapsUrl: buildGoogleMapsUrlFromCoordinates(coordinates),
      };
    }

    return {
      source: "none" as const,
      name: null,
      gymId: null,
      latitude: null,
      longitude: null,
      googleMapsUrl: null,
    };
  }, [coordinates, locationMode, locationName, selectedGym]);

  const locationReady =
    locationMode === "none" ||
    (locationMode === "gym" && Boolean(selectedGym)) ||
    (locationMode === "current" && Boolean(coordinates));

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setUploadError("Escolha uma foto ou vídeo.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setPublishError(null);
    setMediaType(getMediaType(file));

    try {
      const url = onUploadImage ? await onUploadImage(file) : URL.createObjectURL(file);
      setImageUrl(url);
    } catch (err) {
      setUploadError(getErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  }

  function removeLocation() {
    setLocationMode("none");
    setSelectedGymId("");
    setLocationName("");
    setCoordinates(null);
    setLocationAccuracy(null);
    setLocationStatus("idle");
    setLocationError(null);
  }

  /**
   * Cataloga o place vindo da busca via parent callback, vincula como
   * gym selecionada, e fecha o sheet. Se falhar (RLS, network), mostra
   * erro inline na seção Local.
   */
  async function handleCatalogPlace(place: PlaceCandidate) {
    if (!onCatalogPlace || cataloging) return;
    setCataloging(true);
    setSearchError(null);
    try {
      if (place.provider === "registered" && place.gymId) {
        setLocationMode("gym");
        setSelectedGymId(place.gymId);
        setSearchOpen(false);
        return;
      }

      if (typeof place.latitude !== "number" || typeof place.longitude !== "number") {
        setSearchError("Para cadastrar academia, a localização dela é obrigatória.");
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
      setLocationMode("gym");
      setSelectedGymId(cataloged.id);
      setSearchOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Não foi possível salvar o local.";
      setSearchError(message);
    } finally {
      setCataloging(false);
    }
  }

  function handleLocationModeChange(next: SelectableLocationSource) {
    setLocationMode(next);
    setLocationError(null);
    setPublishError(null);

    if (next === "none") {
      removeLocation();
      return;
    }

    if (next === "gym") {
      setCoordinates(null);
      setLocationName("");
      setLocationAccuracy(null);
      setLocationStatus("idle");
      setSelectedGymId((current) => current || registeredGyms[0]?.id || "");
      return;
    }

    if (next !== "current") {
      setCoordinates(null);
      return;
    }

    void requestCurrentLocation();
  }

  async function requestCurrentLocation() {
    setLocationMode("current");
    setSelectedGymId("");
    setLocationError(null);
    setPublishError(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationStatus("unsupported");
      setLocationError("Seu navegador não liberou localização.");
      return;
    }

    setLocationStatus("requesting");
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 30000,
          timeout: 9000,
        });
      });
      const nextCoordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      const approximateLocation = await resolveApproximateLocationName(nextCoordinates);
      setCoordinates(nextCoordinates);
      setLocationAccuracy(position.coords.accuracy ?? null);
      setLocationName(approximateLocation?.label ?? "Localização atual");
      setLocationStatus("found");
    } catch (err) {
      const next = getLocationError(err);
      setCoordinates(null);
      setLocationAccuracy(null);
      setLocationStatus(next.status);
      setLocationError(next.message);
    }
  }

  async function publishWorkout() {
    if (publishing) return;

    if (!imageUrl.trim()) {
      setPublishError("Escolha uma foto ou vídeo para publicar.");
      return;
    }

    if (!postToFeed && !postToStory) {
      setPublishError("Escolha pelo menos um destino: feed ou story.");
      return;
    }

    if (locationMode === "gym" && !selectedGym) {
      setPublishError("Escolha uma academia cadastrada ou remova a localização.");
      return;
    }

    if (locationMode === "current" && !coordinates) {
      setPublishError("Permita o GPS, tente de novo ou remova a localização antes de postar.");
      return;
    }

    setPublishing(true);
    setPublishError(null);
    try {
      await onPublish({
        caption,
        workoutType: resolvedWorkoutType,
        gymId: resolvedLocation.gymId,
        gymName: resolvedLocation.name ?? "",
        imageUrl,
        mediaType,
        locationSource: resolvedLocation.source,
        locationName: resolvedLocation.name,
        locationLatitude: resolvedLocation.latitude,
        locationLongitude: resolvedLocation.longitude,
        locationGoogleMapsUrl: resolvedLocation.googleMapsUrl,
        taggedUserIds,
        destinations: { feed: postToFeed, story: postToStory },
      });
    } catch (err) {
      setPublishError(getErrorMessage(err));
    } finally {
      setPublishing(false);
    }
  }

  const hasDestination = postToFeed || postToStory;
  const canPublish =
    imageUrl.trim().length > 0 &&
    hasDestination &&
    locationReady &&
    !uploading &&
    !publishing;

  const publishLabel = useMemo(() => {
    if (publishing) return "Publicando...";
    if (postToFeed && postToStory) return "Publicar";
    if (postToFeed) return "Publicar no feed";
    if (postToStory) return "Publicar story";
    return "Escolha um destino";
  }, [postToFeed, postToStory, publishing]);

  const destinationHint = useMemo(() => {
    if (postToFeed && postToStory) return "Vai pro feed e pro story (24h)";
    if (postToFeed) return "Só no feed";
    if (postToStory) return "Só no story (some em 24h)";
    return "Escolha um destino em Mais opções";
  }, [postToFeed, postToStory]);

  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar eyebrow="Post de treino" title="Publicar" />

      {/* Inputs invisíveis pra câmera e galeria */}
      <input
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />
      <input
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        ref={cameraInputRef}
        type="file"
      />

      {/* Área de mídia: protagonista quando preenchida, CTA simples quando vazia */}
      {imageUrl ? (
        <div className="mt-4 overflow-hidden rounded-[24px] bg-black">
          <div className="relative aspect-[4/5]">
            {mediaType === "video" ? (
              <video
                autoPlay
                className="h-full w-full object-cover"
                loop
                muted
                playsInline
                preload="auto"
                src={imageUrl}
              />
            ) : (
              <Image
                alt="Mídia do treino"
                className="object-cover"
                fill
                sizes="(max-width: 480px) 100vw, 480px"
                src={imageUrl}
              />
            )}
            <button
              aria-label="Trocar mídia"
              className="gc-pressable absolute right-3 top-3 grid size-11 place-items-center rounded-full bg-black/72 text-white backdrop-blur-md"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <RefreshCw size={16} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex aspect-[4/5] flex-col items-center justify-center gap-5 rounded-[24px] border border-white/[0.06] bg-white/[0.02] px-6">
          <div className="grid size-16 place-items-center rounded-full bg-white/[0.06] text-white/72">
            <Camera size={26} strokeWidth={2.2} />
          </div>
          <p className="text-center text-[14px] font-bold text-white/56">
            Adicione uma foto ou vídeo do treino
          </p>
          <div className="flex w-full max-w-[260px] flex-col gap-2">
            <button
              className="gc-pressable flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-black disabled:opacity-55"
              disabled={uploading}
              onClick={() => cameraInputRef.current?.click()}
              type="button"
            >
              <Camera size={16} strokeWidth={2.5} />
              {uploading ? "Enviando..." : "Tirar foto"}
            </button>
            <button
              className="gc-pressable flex h-12 items-center justify-center gap-2 rounded-full bg-white/[0.06] text-[14px] font-bold text-white disabled:opacity-55"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <Upload size={16} strokeWidth={2.4} />
              Escolher da galeria
            </button>
          </div>
        </div>
      )}

      {uploadError ? (
        <p className="mt-3 text-[12px] font-bold text-[var(--gc-pink)]">
          Upload falhou: {uploadError}
        </p>
      ) : null}

      {/* Caption + opções + publicar — só aparecem quando tem mídia */}
      {imageUrl ? (
        <>
          <textarea
            aria-label="Legenda do post"
            className="mt-4 min-h-[88px] w-full resize-none bg-transparent text-[16px] font-medium leading-6 text-white outline-none placeholder:text-white/32"
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Como foi o treino?"
            value={caption}
          />

          <details className="group mt-2 rounded-[18px] border border-white/[0.06] open:bg-white/[0.02]">
            <summary className="gc-pressable flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] font-bold text-white/68 [&::-webkit-details-marker]:hidden">
              <span>Mais opções</span>
              <ChevronDown
                className="transition-transform group-open:rotate-180"
                size={16}
                strokeWidth={2.4}
              />
            </summary>
            <div className="space-y-4 px-4 pb-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-white/42">
                  Tipo de treino
                </p>
                <select
                  className="mt-2 h-11 w-full rounded-[14px] bg-white/[0.05] px-3 text-[14px] font-bold text-white outline-none"
                  onChange={(event) => setWorkoutType(event.target.value)}
                  value={workoutType}
                >
                  {workoutTypes.map((type) => (
                    <option className="bg-black" key={type.value || "none"} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {workoutType === "Outro" ? (
                  <input
                    className="mt-2 h-11 w-full rounded-[14px] border border-white/[0.08] bg-white/[0.05] px-3 text-[14px] font-bold text-white outline-none placeholder:text-white/30"
                    onChange={(event) => setCustomWorkoutType(event.target.value)}
                    placeholder="Nome do treino"
                    value={customWorkoutType}
                  />
                ) : null}
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-white/42">
                  Marcar amigos
                </p>
                {selectedTaggedUsers.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedTaggedUsers.map((user) => (
                      <button
                        className="gc-pressable inline-flex h-9 items-center gap-2 rounded-full bg-[var(--gc-brand)]/12 px-3 text-[12px] font-black text-[var(--gc-brand)]"
                        key={user.id}
                        onClick={() =>
                          setTaggedUserIds((current) =>
                            current.filter((id) => id !== user.id),
                          )
                        }
                        type="button"
                      >
                        @{user.username}
                        <X size={13} strokeWidth={2.8} />
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="relative mt-2">
                  <UserPlus
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/42"
                    size={15}
                    strokeWidth={2.5}
                  />
                  <input
                    className="h-11 w-full rounded-[14px] border border-white/[0.08] bg-white/[0.05] pl-9 pr-3 text-[14px] font-bold text-white outline-none placeholder:text-white/30"
                    onChange={(event) => setFriendQuery(event.target.value)}
                    placeholder="Buscar por @username"
                    value={friendQuery}
                  />
                </div>
                {friendSuggestions.length > 0 ? (
                  <div className="mt-2 overflow-hidden rounded-[18px] border border-white/[0.07] bg-black/40">
                    {friendSuggestions.map((user) => (
                      <button
                        className="gc-pressable flex h-11 w-full items-center justify-between px-3 text-left text-[13px] font-bold text-white hover:bg-white/[0.05]"
                        key={user.id}
                        onClick={() => {
                          setTaggedUserIds((current) => [...current, user.id]);
                          setFriendQuery("");
                        }}
                        type="button"
                      >
                        <span className="truncate">{user.name}</span>
                        <span className="shrink-0 text-white/42">@{user.username}</span>
                      </button>
                    ))}
                  </div>
                ) : friendQuery.trim().length >= 2 ? (
                  <p className="mt-2 px-1 text-[11px] font-bold text-white/36">
                    Nenhum usuário encontrado.
                  </p>
                ) : null}
                {selectedTaggedUsers.length > 0 ? (
                  <p className="mt-2 px-1 text-[11px] font-bold leading-4 text-white/38">
                    A marcação só conta streak depois que a pessoa aceitar.
                  </p>
                ) : null}
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-white/42">
                  Local
                </p>
                {/* Search via Maps — caminho principal pra encontrar academia/parque/etc.
                    Quando o user seleciona, automaticamente vira locationMode="gym"
                    com a gym recém-catalogada selecionada. */}
                {onCatalogPlace ? (
                  <button
                    className="gc-pressable mt-2 flex h-11 w-full items-center gap-3 rounded-[14px] border border-white/[0.1] bg-white/[0.03] px-3 text-left text-[14px] font-bold text-white"
                    disabled={cataloging}
                    onClick={() => {
                      setSearchError(null);
                      setSearchOpen(true);
                    }}
                    type="button"
                  >
                    <Search className="text-white/52" size={15} strokeWidth={2.4} />
                    <span className="flex-1 truncate">
                      {selectedGym
                        ? selectedGym.name
                        : "Buscar academia, parque, lugar..."}
                    </span>
                    {selectedGym ? (
                      <span className="rounded-full bg-[var(--gc-brand)]/14 px-2 py-0.5 text-[10px] font-black text-[var(--gc-brand)]">
                        Selecionado
                      </span>
                    ) : null}
                  </button>
                ) : null}
                {searchError ? (
                  <p className="mt-2 px-1 text-[11px] font-bold text-[var(--gc-pink)]">
                    {searchError}
                  </p>
                ) : null}

                <select
                  className="mt-2 h-11 w-full rounded-[14px] bg-white/[0.05] px-3 text-[14px] font-bold text-white outline-none"
                  onChange={(event) =>
                    handleLocationModeChange(event.target.value as SelectableLocationSource)
                  }
                  value={locationMode}
                >
                  {locationOptions.map((option) => (
                    <option className="bg-black" key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {locationMode === "gym" && registeredGyms.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    <select
                      className="h-11 w-full rounded-[14px] bg-white/[0.05] px-3 text-[14px] font-bold text-white outline-none"
                      onChange={(event) => setSelectedGymId(event.target.value)}
                      value={selectedGymId}
                    >
                      {registeredGyms.map((gym) => (
                        <option className="bg-black" key={gym.id} value={gym.id}>
                          {gym.name}
                        </option>
                      ))}
                    </select>
                    {selectedGym ? (
                      <p className="px-1 text-[12px] font-bold text-white/44">
                        {getGymMeta(selectedGym) || "Vai mostrar só nome no post."}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {locationMode === "gym" && registeredGyms.length === 0 ? (
                  <p className="mt-2 px-1 text-[12px] font-bold text-white/44">
                    Você não cadastrou nenhuma academia ainda.
                  </p>
                ) : null}

                {locationMode === "current" ? (
                  <div className="mt-2 space-y-2">
                    {(() => {
                      const copy = getLocationStatusCopy(locationStatus, locationAccuracy);
                      return (
                        <div className="flex items-start gap-2 px-1">
                          <LocateFixed
                            className={
                              locationStatus === "found"
                                ? "shrink-0 text-[var(--gc-brand)]"
                                : "shrink-0 text-white/52"
                            }
                            size={14}
                          />
                          <div className="min-w-0">
                            <p className="text-[12px] font-black text-white">{copy.title}</p>
                            <p className="text-[11px] font-bold leading-4 text-white/46">
                              {copy.detail}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                    <button
                      className="gc-pressable flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white/[0.06] text-[12px] font-black text-white disabled:opacity-50"
                      disabled={locationStatus === "requesting"}
                      onClick={requestCurrentLocation}
                      type="button"
                    >
                      <RefreshCw
                        className={locationStatus === "requesting" ? "animate-spin" : undefined}
                        size={13}
                      />
                      {locationStatus === "requesting"
                        ? "Localizando..."
                        : coordinates
                          ? "Atualizar localização"
                          : "Tentar localizar"}
                    </button>
                  </div>
                ) : null}

                {locationError ? (
                  <p className="mt-2 px-1 text-[11px] font-bold text-[var(--gc-pink)]">
                    {locationError}
                  </p>
                ) : null}
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-white/42">
                  Onde postar
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <DestinationToggle
                    active={postToFeed}
                    label="Feed"
                    onToggle={() => setPostToFeed((value) => !value)}
                  />
                  <DestinationToggle
                    active={postToStory}
                    label="Story (24h)"
                    onToggle={() => setPostToStory((value) => !value)}
                  />
                </div>
              </div>
            </div>
          </details>

          <div className="mt-4 space-y-2">
            <button
              className="gc-pressable flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[15px] font-black text-black shadow-[0_0_24px_rgba(92,232,255,0.32)] disabled:bg-white/[0.05] disabled:text-white/30 disabled:shadow-none"
              disabled={!canPublish}
              onClick={publishWorkout}
              type="button"
            >
              {!publishing ? <Check size={18} strokeWidth={2.8} /> : null}
              {publishLabel}
            </button>
            <p className="text-center text-[11px] font-bold text-white/40">
              {destinationHint}
            </p>
            {publishError ? (
              <p className="text-center text-[12px] font-bold text-[var(--gc-pink)]">
                {publishError}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      <GymSearchSheet
        onClose={() => setSearchOpen(false)}
        registeredGyms={searchableGyms}
        onSelect={handleCatalogPlace}
        open={searchOpen}
        title="Escolher academia"
      />
    </section>
  );
}

type DestinationToggleProps = {
  active: boolean;
  label: string;
  onToggle: () => void;
};

/**
 * Toggle simples Feed/Story. Sem descrição extra — labels claros já bastam,
 * e o destinationHint embaixo do publicar resume o estado.
 */
function DestinationToggle({ active, label, onToggle }: DestinationToggleProps) {
  return (
    <button
      aria-label={`${active ? "Desativar" : "Ativar"} ${label}`}
      aria-pressed={active}
      className={[
        "gc-pressable flex h-11 items-center justify-center gap-2 rounded-full text-[13px] font-black",
        active
          ? "bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]"
          : "bg-white/[0.05] text-white/56",
      ].join(" ")}
      onClick={onToggle}
      type="button"
    >
      <span
        className={[
          "grid size-4 place-items-center rounded-full",
          active ? "bg-[var(--gc-brand)] text-black" : "border border-white/22",
        ].join(" ")}
      >
        {active ? <Check size={10} strokeWidth={3.6} /> : null}
      </span>
      {label}
    </button>
  );
}

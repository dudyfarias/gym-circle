"use client";

import type { ChangeEvent } from "react";
import { useMemo, useRef, useState } from "react";
import {
  buildGoogleMapsSearchUrl,
  buildGoogleMapsUrlFromCoordinates,
  type Coordinates,
} from "@gym-circle/core";
import {
  Camera,
  Check,
  ChevronDown,
  Plus,
  RefreshCw,
  Search,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  CreateWorkoutPostInput,
  EnrichedUser,
  GymLocationOption,
  PostLocationSource,
  PostMediaItem,
  PostMediaType,
} from "../social/types";
import { TopBar } from "../TopBar";
import { MediaCarousel } from "../design-system/MediaCarousel";
import { PinchZoomImage } from "../design-system/PinchZoomImage";

// Sprint 13 — limite do carrossel (alinhado com a regra de produto).
const MAX_MEDIA = 10;
import {
  GymSearchSheet,
  type LocatedPlaceCandidate,
  type PlaceCandidate,
} from "../GymSearchSheet";
import { HapticsService } from "../native/HapticsService";
import { NativeMediaPickerService } from "../native/NativeMediaPickerService";

type PostScreenProps = {
  currentUser: EnrichedUser;
  gyms?: GymLocationOption[];
  onPublish: (input: CreateWorkoutPostInput) => void | Promise<void>;
  onUploadImage?: (file: File) => Promise<string | WorkoutMediaUploadResult>;
  taggableUsers?: EnrichedUser[];
  /**
   * Cataloga um lugar buscado via Maps no banco (dedup + insert) e
   * vincula ao perfil do user. Se ausente, o botão "Buscar academia"
   * não aparece. O parent resolve via `gymService.findOrCreateFromPlace`.
   */
  onCatalogPlace?: (place: LocatedPlaceCandidate) => Promise<GymLocationOption>;
  recentLocations?: PlaceCandidate[];
};

type WorkoutMediaUploadResult = {
  imageUrl: string;
  thumbnailUrl?: string | null;
  posterUrl?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  mediaDurationSeconds?: number | null;
  blurDataUrl?: string | null;
};

// IDs em PT-BR (valor) são source-of-truth — persistidos no DB como
// `workout_type`. O lookup abaixo só traduz o LABEL visual.
const workoutTypes: ReadonlyArray<{ key: string; value: string }> = [
  { key: "none", value: "" },
  { key: "musculacao", value: "Musculação" },
  { key: "corrida", value: "Corrida" },
  { key: "bike", value: "Bike" },
  { key: "funcional", value: "Funcional" },
  { key: "cardio", value: "Cardio" },
  { key: "mobilidade", value: "Mobilidade" },
  { key: "outro", value: "Outro" },
];

type SelectableLocationSource = Exclude<PostLocationSource, "custom">;

function getMediaType(file: File): PostMediaType {
  return file.type.startsWith("video/") ? "video" : "image";
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

export function PostScreen({
  currentUser,
  gyms = [],
  onPublish,
  onUploadImage,
  onCatalogPlace,
  recentLocations = [],
  taggableUsers = [],
}: PostScreenProps) {
  const { t } = useTranslation();
  const getErrorMessage = (err: unknown) =>
    err instanceof Error ? err.message : t("postScreen.publish.errors.generic");
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
  const [imageUrl, setImageUrl] = useState("");
  const [mediaMeta, setMediaMeta] = useState<Omit<WorkoutMediaUploadResult, "imageUrl">>({});
  const [mediaType, setMediaType] = useState<PostMediaType>("image");
  // Sprint 13 — carrossel: lista ordenada. imageUrl/mediaMeta/mediaType acima
  // continuam sendo a CAPA (= item 0), pra toda a lógica existente
  // (canPublish, preview single, publish) seguir funcionando sem reescrita.
  const [mediaItems, setMediaItems] = useState<PostMediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  // Default = feed + story. Story acende o badge do streak; feed dá conteúdo
  // permanente. Ambos saem da mesma upload — escolher é caso de power user.
  const [postToFeed, setPostToFeed] = useState(true);
  const [postToStory, setPostToStory] = useState(true);
  const [friendQuery, setFriendQuery] = useState("");
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  // Sprint 12.3 — trava re-entrância do picker. O `uploading` só cobre o upload,
  // não a fase "câmera/galeria aberta": sem isso, um segundo toque (ou reabrir)
  // dispara outro present e dá race no WKWebView iOS (câmera fecha sozinha +
  // botão trava). Ref (não state) pra não re-renderizar e pegar o valor na hora.
  const pickerBusyRef = useRef(false);

  const resolvedWorkoutType = useMemo(() => {
    if (workoutType === "Outro") {
      return customWorkoutType.trim() || null;
    }
    return workoutType.trim() || null;
  }, [customWorkoutType, workoutType]);
  // Sprint 13 — workout_types[] (até 5). A UI hoje seleciona 1; quando o
  // multi-select de chips entrar, é só este memo coletar o array completo.
  const resolvedWorkoutTypes = useMemo<string[]>(
    () => (resolvedWorkoutType ? [resolvedWorkoutType] : []),
    [resolvedWorkoutType],
  );

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
        name: locationName.trim() || t("postScreen.location.currentDefault"),
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

  const selectedLocationLabel = useMemo(() => {
    if (locationMode === "gym" && selectedGym) return selectedGym.name;
    if (locationMode === "current" && locationName) return locationName;
    return "";
  }, [locationMode, locationName, selectedGym]);

  const selectedLocationMeta = useMemo(() => {
    if (locationMode === "gym" && selectedGym) {
      return getGymMeta(selectedGym) || t("postScreen.location.gymMetaFallback");
    }
    if (locationMode === "current" && coordinates) {
      return t("postScreen.location.currentNote");
    }
    return "";
  }, [coordinates, locationMode, selectedGym, t]);

  // Sprint 13 — sobe UM arquivo e devolve o item (sem tocar no state). Os
  // callers (câmera = single/replace, galeria = multi/append) controlam o state.
  async function uploadOne(file: File): Promise<PostMediaItem | null> {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setUploadError(t("postScreen.publish.errors.uploadInvalidType"));
      return null;
    }
    const type = getMediaType(file);
    const uploaded = onUploadImage ? await onUploadImage(file) : URL.createObjectURL(file);
    if (typeof uploaded === "string") {
      return { mediaType: type, imageUrl: uploaded };
    }
    return {
      mediaType: type,
      imageUrl: uploaded.imageUrl,
      thumbnailUrl: uploaded.thumbnailUrl ?? null,
      posterUrl: uploaded.posterUrl ?? null,
      mediaWidth: uploaded.mediaWidth ?? null,
      mediaHeight: uploaded.mediaHeight ?? null,
      mediaDurationSeconds: uploaded.mediaDurationSeconds ?? null,
      blurDataUrl: uploaded.blurDataUrl ?? null,
    };
  }

  // Espelha o item 0 (capa) no state legado que o resto do composer/publish lê.
  function applyCover(item: PostMediaItem | null) {
    if (!item) {
      setImageUrl("");
      setMediaMeta({});
      setMediaType("image");
      return;
    }
    setImageUrl(item.imageUrl);
    setMediaType(item.mediaType);
    setMediaMeta({
      thumbnailUrl: item.thumbnailUrl ?? null,
      posterUrl: item.posterUrl ?? null,
      mediaWidth: item.mediaWidth ?? null,
      mediaHeight: item.mediaHeight ?? null,
      mediaDurationSeconds: item.mediaDurationSeconds ?? null,
      blurDataUrl: item.blurDataUrl ?? null,
    });
  }

  // Câmera / 1 arquivo → MÍDIA ÚNICA (substitui a seleção atual).
  async function uploadSelectedFile(file: File) {
    setUploading(true);
    setUploadError(null);
    setPublishError(null);
    try {
      const item = await uploadOne(file);
      if (item) {
        setMediaItems([item]);
        applyCover(item);
      }
    } catch (err) {
      setUploadError(getErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  }

  // Galeria → multi: sobe vários, APPEND (cap MAX_MEDIA). Capa = item 0.
  async function uploadGalleryFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    setPublishError(null);
    try {
      const room = Math.max(0, MAX_MEDIA - mediaItems.length);
      const picked: PostMediaItem[] = [];
      for (const f of files.slice(0, room)) {
        const item = await uploadOne(f);
        if (item) picked.push(item);
      }
      if (picked.length > 0) {
        const next = [...mediaItems, ...picked].slice(0, MAX_MEDIA);
        setMediaItems(next);
        applyCover(next[0]);
      }
    } catch (err) {
      setUploadError(getErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeMediaAt(index: number) {
    const next = mediaItems.filter((_, i) => i !== index);
    setMediaItems(next);
    applyCover(next[0] ?? null);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    // Câmera (1) ou galeria web (N). 1 = single (replace); N = carrossel.
    if (files.length === 1) await uploadSelectedFile(files[0]);
    else await uploadGalleryFiles(files);
  }

  async function openNativeCamera() {
    // Guard de re-entrância: ignora toques enquanto um picker já está aberto
    // ou um upload em curso (evita double-present → race no WKWebView).
    if (pickerBusyRef.current || uploading) return;
    pickerBusyRef.current = true;
    void HapticsService.selection();
    try {
      if (await NativeMediaPickerService.isNativePlatform()) {
        // Nativo: usa SÓ o plugin. null = usuário cancelou/negou → não faz
        // nada. NÃO cair no <input capture> HTML aqui: apresentá-lo logo após
        // dispensar a câmera nativa quebra a apresentação do WKWebView (câmera
        // abre e fecha sozinha em ~1s, e o botão para de responder).
        const nativeMedia = await NativeMediaPickerService.takePhoto();
        if (nativeMedia?.file) await uploadSelectedFile(nativeMedia.file);
      } else {
        // Web/PWA: sem plugin nativo → input HTML com capture é o caminho certo.
        cameraInputRef.current?.click();
      }
    } finally {
      pickerBusyRef.current = false;
    }
  }

  async function openNativeGallery() {
    if (pickerBusyRef.current || uploading) return;
    pickerBusyRef.current = true;
    void HapticsService.selection();
    try {
      if (await NativeMediaPickerService.isNativePlatform()) {
        // Sprint 13 — galeria = carrossel: seleção MÚLTIPLA (foto+vídeo), append.
        const results = await NativeMediaPickerService.pickWorkoutMediaMultiple();
        if (results.length > 0) {
          await uploadGalleryFiles(results.map((r) => r.file));
        }
      } else {
        // Web/PWA: <input multiple> → handleFileChange decide single vs multi.
        fileInputRef.current?.click();
      }
    } finally {
      pickerBusyRef.current = false;
    }
  }

  function removeLocation() {
    setLocationMode("none");
    setSelectedGymId("");
    setLocationName("");
    setCoordinates(null);
  }

  /**
   * Cataloga o place vindo da busca via parent callback, vincula como
   * gym selecionada, e fecha o sheet. Se falhar (RLS, network), mostra
   * erro inline na seção Local.
   */
  async function handleCatalogPlace(place: PlaceCandidate) {
    if (cataloging) return;
    setCataloging(true);
    setSearchError(null);
    try {
      if (
        place.provider === "current" &&
        typeof place.latitude === "number" &&
        typeof place.longitude === "number"
      ) {
        void HapticsService.selection();
        setLocationMode("current");
        setSelectedGymId("");
        setCoordinates({
          latitude: place.latitude,
          longitude: place.longitude,
        });
        setLocationName(place.name || t("postScreen.location.currentDefault"));
        setSearchOpen(false);
        return;
      }

      if (place.provider === "registered" && place.gymId) {
        void HapticsService.selection();
        setLocationMode("gym");
        setSelectedGymId(place.gymId);
        setCoordinates(null);
        setLocationName("");
        setSearchOpen(false);
        return;
      }

      if (!onCatalogPlace) {
        setSearchError(t("postScreen.location.errors.cantCatalog"));
        return;
      }

      if (typeof place.latitude !== "number" || typeof place.longitude !== "number") {
        setSearchError(t("postScreen.location.errors.needsCoordinates"));
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
      void HapticsService.selection();
      setLocationMode("gym");
      setSelectedGymId(cataloged.id);
      setSearchOpen(false);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t("postScreen.location.errors.saveFailed");
      setSearchError(message);
    } finally {
      setCataloging(false);
    }
  }

  async function publishWorkout() {
    if (publishing) return;

    if (!imageUrl.trim()) {
      setPublishError(t("postScreen.publish.errors.needsMedia"));
      return;
    }

    if (!postToFeed && !postToStory) {
      setPublishError(t("postScreen.publish.errors.needsDestination"));
      return;
    }

    if (locationMode === "gym" && !selectedGym) {
      setPublishError(t("postScreen.publish.errors.needsGym"));
      return;
    }

    if (locationMode === "current" && !coordinates) {
      setPublishError(t("postScreen.publish.errors.needsCurrentLocation"));
      return;
    }

    setPublishing(true);
    setPublishError(null);
    try {
      await onPublish({
        caption,
        workoutType: resolvedWorkoutType,
        // Sprint 13 — carrossel (>1 mídia) + tags (workoutTypes = array).
        media: mediaItems.length > 1 ? mediaItems : undefined,
        workoutTypes: resolvedWorkoutTypes.length > 0 ? resolvedWorkoutTypes : null,
        gymId: resolvedLocation.gymId,
        gymName: resolvedLocation.name ?? "",
        imageUrl,
        thumbnailUrl: mediaMeta.thumbnailUrl ?? null,
        posterUrl: mediaMeta.posterUrl ?? null,
        mediaWidth: mediaMeta.mediaWidth ?? null,
        mediaHeight: mediaMeta.mediaHeight ?? null,
        mediaDurationSeconds: mediaMeta.mediaDurationSeconds ?? null,
        blurDataUrl: mediaMeta.blurDataUrl ?? null,
        mediaType,
        locationSource: resolvedLocation.source,
        locationName: resolvedLocation.name,
        locationLatitude: resolvedLocation.latitude,
        locationLongitude: resolvedLocation.longitude,
        locationGoogleMapsUrl: resolvedLocation.googleMapsUrl,
        taggedUserIds,
        destinations: { feed: postToFeed, story: postToStory },
      });
      void HapticsService.success();
    } catch (err) {
      void HapticsService.error();
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
    if (publishing) return t("postScreen.publish.publishing");
    if (postToFeed && postToStory) return t("postScreen.publish.ctaBoth");
    if (postToFeed) return t("postScreen.publish.ctaFeed");
    if (postToStory) return t("postScreen.publish.ctaStory");
    return t("postScreen.publish.ctaNoDestination");
  }, [postToFeed, postToStory, publishing, t]);

  const destinationHint = useMemo(() => {
    if (postToFeed && postToStory) return t("postScreen.destinations.hintBoth");
    if (postToFeed) return t("postScreen.destinations.hintFeed");
    if (postToStory) return t("postScreen.destinations.hintStory");
    return t("postScreen.destinations.hintNone");
  }, [postToFeed, postToStory, t]);

  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar
        eyebrow={t("postScreen.topBar.eyebrow")}
        title={t("postScreen.topBar.title")}
      />

      {/* Inputs invisíveis pra câmera e galeria */}
      <input
        accept="image/*,video/*"
        className="hidden"
        multiple
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
        <div className="mt-4 space-y-2">
          <div className="overflow-hidden rounded-[24px] bg-black">
            {/* Sprint 13 — >1 mídia: preview em carrossel (swipe pra revisar). */}
            {mediaItems.length > 1 ? (
              <MediaCarousel altText={t("postScreen.media.alt")} media={mediaItems} />
            ) : (
              <div className={mediaType === "video" ? "relative aspect-[4/5]" : "relative"}>
                {mediaType === "video" ? (
                  <video
                    autoPlay
                    className="h-full w-full object-cover"
                    loop
                    muted
                    playsInline
                    poster={mediaMeta.posterUrl ?? mediaMeta.thumbnailUrl ?? undefined}
                    preload="metadata"
                    src={imageUrl}
                  />
                ) : (
                  <PinchZoomImage
                    alt={t("postScreen.media.alt")}
                    blurDataUrl={mediaMeta.blurDataUrl}
                    className="w-full"
                    hqSrc={
                      mediaMeta.thumbnailUrl && imageUrl !== mediaMeta.thumbnailUrl
                        ? imageUrl
                        : undefined
                    }
                    sizes="(max-width: 480px) 100vw, 480px"
                    src={mediaMeta.thumbnailUrl ?? imageUrl}
                  />
                )}
                <button
                  aria-label={t("postScreen.media.swapAria")}
                  className="gc-pressable absolute right-3 top-3 grid size-11 place-items-center rounded-full bg-black/72 text-white backdrop-blur-md"
                  onClick={openNativeGallery}
                  type="button"
                >
                  <RefreshCw size={16} strokeWidth={2.4} />
                </button>
              </div>
            )}
          </div>

          {/* Strip de gerenciamento do carrossel: remover item + adicionar mais. */}
          {mediaItems.length > 1 ? (
            <div className="gc-scrollbar flex gap-2 overflow-x-auto pb-1">
              {mediaItems.map((item, index) => (
                <div
                  className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-black"
                  key={index}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    className="h-full w-full object-cover"
                    src={item.thumbnailUrl ?? item.imageUrl}
                  />
                  <button
                    aria-label={t("postScreen.media.remove")}
                    className="gc-pressable absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-black/72 text-white"
                    onClick={() => removeMediaAt(index)}
                    type="button"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              {mediaItems.length < MAX_MEDIA ? (
                <button
                  aria-label={t("postScreen.media.addMore")}
                  className="gc-pressable grid size-16 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white/60 disabled:opacity-50"
                  disabled={uploading}
                  onClick={openNativeGallery}
                  type="button"
                >
                  <Plus size={18} />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 flex aspect-[4/5] flex-col items-center justify-center gap-5 rounded-[24px] border border-white/[0.06] bg-white/[0.02] px-6">
          <div className="grid size-16 place-items-center rounded-full bg-white/[0.06] text-white/72">
            <Camera size={26} strokeWidth={2.2} />
          </div>
          <p className="text-center text-[14px] font-bold text-white/56">
            {t("postScreen.media.emptyHint")}
          </p>
          <div className="flex w-full max-w-[260px] flex-col gap-2">
            <button
              className="gc-pressable flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-black disabled:opacity-55"
              disabled={uploading}
              onClick={openNativeCamera}
              type="button"
            >
              <Camera size={16} strokeWidth={2.5} />
              {uploading ? t("postScreen.media.uploading") : t("postScreen.media.takePhoto")}
            </button>
            <button
              className="gc-pressable flex h-12 items-center justify-center gap-2 rounded-full bg-white/[0.06] text-[14px] font-bold text-white disabled:opacity-55"
              disabled={uploading}
              onClick={openNativeGallery}
              type="button"
            >
              <Upload size={16} strokeWidth={2.4} />
              {t("postScreen.media.pickGallery")}
            </button>
          </div>
        </div>
      )}

      {uploadError ? (
        <p className="mt-3 text-[12px] font-bold text-[var(--gc-pink)]">
          {t("postScreen.media.uploadFailed", { message: uploadError })}
        </p>
      ) : null}

      {/* Caption + opções + publicar — só aparecem quando tem mídia */}
      {imageUrl ? (
        <>
          <textarea
            aria-label={t("postScreen.caption.aria")}
            className="mt-4 min-h-[88px] w-full resize-none bg-transparent text-[16px] font-medium leading-6 text-white outline-none placeholder:text-white/32"
            onChange={(event) => setCaption(event.target.value)}
            placeholder={t("postScreen.caption.placeholder")}
            value={caption}
          />

          <details className="group mt-2 rounded-[18px] border border-white/[0.06] open:bg-white/[0.02]">
            <summary className="gc-pressable flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] font-bold text-white/68 [&::-webkit-details-marker]:hidden">
              <span>{t("postScreen.moreOptions")}</span>
              <ChevronDown
                className="transition-transform group-open:rotate-180"
                size={16}
                strokeWidth={2.4}
              />
            </summary>
            <div className="space-y-4 px-4 pb-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-white/42">
                  {t("postScreen.workoutType.label")}
                </p>
                <select
                  className="mt-2 h-11 w-full rounded-[14px] bg-white/[0.05] px-3 text-[14px] font-bold text-white outline-none"
                  onChange={(event) => setWorkoutType(event.target.value)}
                  value={workoutType}
                >
                  {workoutTypes.map((type) => (
                    <option className="bg-black" key={type.key} value={type.value}>
                      {t(`postScreen.workoutType.options.${type.key}`)}
                    </option>
                  ))}
                </select>
                {workoutType === "Outro" ? (
                  <input
                    className="mt-2 h-11 w-full rounded-[14px] border border-white/[0.08] bg-white/[0.05] px-3 text-[14px] font-bold text-white outline-none placeholder:text-white/30"
                    onChange={(event) => setCustomWorkoutType(event.target.value)}
                    placeholder={t("postScreen.workoutType.customPlaceholder")}
                    value={customWorkoutType}
                  />
                ) : null}
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-white/42">
                  {t("postScreen.tagFriends.label")}
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
                    placeholder={t("postScreen.tagFriends.searchPlaceholder")}
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
                    {t("postScreen.tagFriends.empty")}
                  </p>
                ) : null}
                {selectedTaggedUsers.length > 0 ? (
                  <p className="mt-2 px-1 text-[11px] font-bold leading-4 text-white/38">
                    {t("postScreen.tagFriends.streakNote")}
                  </p>
                ) : null}
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-white/42">
                  {t("postScreen.location.label")}
                </p>
                <button
                  className="gc-pressable mt-2 flex min-h-11 w-full items-center gap-3 rounded-[14px] border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-left text-[14px] font-bold text-white"
                  disabled={cataloging}
                  onClick={() => {
                    setSearchError(null);
                    setSearchOpen(true);
                  }}
                  type="button"
                >
                  <Search className="shrink-0 text-white/52" size={15} strokeWidth={2.4} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {selectedLocationLabel || t("postScreen.location.searchPlaceholder")}
                    </span>
                    {selectedLocationMeta ? (
                      <span className="mt-0.5 block truncate text-[11px] font-bold text-white/42">
                        {selectedLocationMeta}
                      </span>
                    ) : null}
                  </span>
                  {selectedLocationLabel ? (
                    <span className="shrink-0 rounded-full bg-[var(--gc-brand)]/14 px-2 py-0.5 text-[10px] font-black text-[var(--gc-brand)]">
                      {t("postScreen.location.selectedBadge")}
                    </span>
                  ) : null}
                </button>
                {selectedLocationLabel ? (
                  <button
                    className="gc-pressable mt-2 h-9 rounded-full bg-white/[0.05] px-3 text-[12px] font-black text-white/68"
                    onClick={removeLocation}
                    type="button"
                  >
                    {t("postScreen.location.remove")}
                  </button>
                ) : null}
                {searchError ? (
                  <p className="mt-2 px-1 text-[11px] font-bold text-[var(--gc-pink)]">
                    {searchError}
                  </p>
                ) : null}

              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-white/42">
                  {t("postScreen.destinations.label")}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <DestinationToggle
                    active={postToFeed}
                    label={t("postScreen.destinations.feed")}
                    onToggle={() => setPostToFeed((value) => !value)}
                  />
                  <DestinationToggle
                    active={postToStory}
                    label={t("postScreen.destinations.story")}
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
        recentCandidates={recentLocations}
        registeredGyms={searchableGyms}
        onSelect={handleCatalogPlace}
        open={searchOpen}
        title={t("postScreen.location.sheetTitle")}
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
  const { t } = useTranslation();
  return (
    <button
      aria-label={t(
        active
          ? "postScreen.destinations.toggleAriaActive"
          : "postScreen.destinations.toggleAriaInactive",
        { label },
      )}
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

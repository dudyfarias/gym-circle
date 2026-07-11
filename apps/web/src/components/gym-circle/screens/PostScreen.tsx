"use client";

import type { ChangeEvent } from "react";
import { useMemo, useRef, useState } from "react";
import {
  buildGoogleMapsSearchUrl,
  buildGoogleMapsUrlFromCoordinates,
  type Coordinates,
} from "@gym-circle/core";
import {
  ArrowLeft,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Upload,
  UserPlus,
  Video,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  ComposerActivityContext,
  CreateWorkoutPostInput,
  EnrichedUser,
  GymLocationOption,
  PostLocationSource,
  PostMediaItem,
  PostMediaType,
} from "../social/types";
import { MediaCarousel } from "../design-system/MediaCarousel";
import { PinchZoomImage } from "../design-system/PinchZoomImage";
import { VideoThumbnail } from "../design-system/VideoThumbnail";
import { formatElapsed } from "../workout/workoutElapsed";
import { createWorkoutShareCoverFile } from "../workout/workoutShareCover";

// Sprint 13 — limite do carrossel (alinhado com a regra de produto).
const MAX_MEDIA = 10;
import { GymSearchSheet, type LocatedPlaceCandidate, type PlaceCandidate } from "../GymSearchSheet";
import { HapticsService } from "../native/HapticsService";
import { NativeMediaPickerService } from "../native/NativeMediaPickerService";
import { allSettledWithConcurrency, getMediaUploadConcurrency } from "../mediaUploadQueue";
import { getMediaFileType, isSupportedMediaFile } from "../mediaFileType";
import { errorMessage } from "../errorMessage";
import type { MediaUploadProgress } from "../resumableUpload";

type PostScreenProps = {
  currentUser: EnrichedUser;
  gyms?: GymLocationOption[];
  onCancel: () => void;
  onPublish: (input: CreateWorkoutPostInput) => void | Promise<void>;
  onCreateCheckin?: (gymId: string, workoutDate?: string) => void | Promise<void>;
  onUploadImage?: (
    file: File,
    onProgress?: (progress: MediaUploadProgress) => void,
  ) => Promise<string | WorkoutMediaUploadResult>;
  taggableUsers?: EnrichedUser[];
  /**
   * Cataloga um lugar buscado via Maps no banco (dedup + insert) e
   * vincula ao perfil do user. Se ausente, o botão "Buscar academia"
   * não aparece. O parent resolve via `gymService.findOrCreateFromPlace`.
   */
  onCatalogPlace?: (place: LocatedPlaceCandidate) => Promise<GymLocationOption>;
  recentLocations?: PlaceCandidate[];
  /**
   * "Registrar treino" — quando presente (YYYY-MM-DD), o composer entra em modo
   * retroativo: data travada no topo, vai só pro feed (sem story) e o post é
   * gravado naquele dia (preenche o calendário). Ausente = post normal de hoje.
   */
  workoutDate?: string;
  /**
   * Rastreio de treino (Fase 1): treino recém-encerrado virando post. Foto é
   * OPCIONAL — sem mídia, geramos a capa de stats em canvas na hora do publish.
   */
  activityContext?: ComposerActivityContext | null;
};

// Rastreio de treino → tag preset do composer (values PT-BR do banco).
const ACTIVITY_TYPE_TO_WORKOUT_VALUE: Record<string, string> = {
  strength: "Musculação",
  run: "Corrida",
  ride: "Bike",
  walk: "Cardio",
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
type ComposerStep = "media" | "details";

function getMediaType(file: File): PostMediaType {
  return getMediaFileType(file) ?? "image";
}

/// Mídia em upload no strip (preview local instantâneo + estado de carregando).
type PendingUpload = {
  id: string;
  previewUrl: string | null;
  mediaType: PostMediaType;
  status: "uploading" | "error";
  progress: number;
};

function EditableMediaThumbnail({ item }: { item: PostMediaItem }) {
  if (item.mediaType === "video") {
    const poster = item.posterUrl ?? item.thumbnailUrl ?? null;
    return poster ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt="" className="h-full w-full object-cover" src={poster} />
    ) : (
      <VideoThumbnail className="h-full w-full object-cover" src={item.imageUrl} />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className="h-full w-full object-cover"
      src={item.thumbnailUrl ?? item.imageUrl}
    />
  );
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
  onCancel,
  onPublish,
  onCreateCheckin,
  onUploadImage,
  onCatalogPlace,
  recentLocations = [],
  taggableUsers = [],
  workoutDate,
  activityContext = null,
}: PostScreenProps) {
  const { t } = useTranslation();
  // "Registrar treino": modo retroativo (dia treinado sem mídia).
  const isBackdated = Boolean(workoutDate && !activityContext);
  // Posts promovidos de uma atividade precisam herdar o mesmo workout_date
  // para passar pela validação do banco, sem virar o fluxo "Registrar treino".
  const publishWorkoutDate = workoutDate ?? activityContext?.workoutDate;
  const backdatedLabel = workoutDate
    ? `${workoutDate.slice(8, 10)}/${workoutDate.slice(5, 7)}/${workoutDate.slice(0, 4)}`
    : "";
  const getErrorMessage = (err: unknown) =>
    errorMessage(err, t("postScreen.publish.errors.generic"));
  const activityTypeLabel = activityContext
    ? (ACTIVITY_TYPE_TO_WORKOUT_VALUE[activityContext.activityType] ??
      t("workout.types.other"))
    : "";
  const [caption, setCaption] = useState(activityContext?.caption ?? "");
  const [composerStep, setComposerStep] = useState<ComposerStep>(
    activityContext?.initialComposerStep ?? "media",
  );
  // Academias catalogadas durante essa sessão de post (via search sheet) —
  // se juntam às `gyms` recebidas via prop pra que o select reconheça.
  const [localGyms, setLocalGyms] = useState<GymLocationOption[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [cataloging, setCataloging] = useState(false);
  // Sprint 13 — até 5 tags (multi-select de chips). Guarda os VALORES escolhidos.
  // Treino rastreado pré-seleciona a tag correspondente ao tipo.
  const [selectedWorkoutValues, setSelectedWorkoutValues] = useState<string[]>(() => {
    if (activityContext?.workoutTypes?.length) {
      return activityContext.workoutTypes.slice(0, 5);
    }
    const preset = activityContext
      ? ACTIVITY_TYPE_TO_WORKOUT_VALUE[activityContext.activityType]
      : undefined;
    return preset ? [preset] : [];
  });
  const [customWorkoutType, setCustomWorkoutType] = useState("");
  const [locationMode, setLocationMode] = useState<SelectableLocationSource>(
    activityContext?.gymId
      ? "gym"
      : typeof activityContext?.locationLatitude === "number" &&
          typeof activityContext.locationLongitude === "number"
        ? "current"
        : "none",
  );
  const [selectedGymId, setSelectedGymId] = useState(
    activityContext?.gymId ?? "",
  );
  const [locationName, setLocationName] = useState(
    activityContext?.locationName ?? "",
  );
  const [coordinates, setCoordinates] = useState<Coordinates | null>(
    typeof activityContext?.locationLatitude === "number" &&
      typeof activityContext.locationLongitude === "number"
      ? {
          latitude: activityContext.locationLatitude,
          longitude: activityContext.locationLongitude,
        }
      : null,
  );
  const [imageUrl, setImageUrl] = useState("");
  const [mediaMeta, setMediaMeta] = useState<Omit<WorkoutMediaUploadResult, "imageUrl">>({});
  const [mediaType, setMediaType] = useState<PostMediaType>("image");
  // Sprint 13 — carrossel: lista ordenada. imageUrl/mediaMeta/mediaType acima
  // continuam sendo a CAPA (= item 0), pra toda a lógica existente
  // (canPublish, preview single, publish) seguir funcionando sem reescrita.
  const [mediaItems, setMediaItems] = useState<PostMediaItem[]>([]);
  // Mídias em upload: aparecem NA HORA no strip com animação de carregando
  // (preview via objectURL) — antes a tela ficava "travada" até o vídeo subir.
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  // Progresso real do lote: nº de mídias que já terminaram de subir / total.
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  // Default = feed + story. Story acende o badge do streak; feed dá conteúdo
  // permanente. Ambos saem da mesma upload — escolher é caso de power user.
  // Treino rastreado default = só feed (a capa gerada não é story material).
  const [postToFeed, setPostToFeed] = useState(true);
  const [postToStory, setPostToStory] = useState(!activityContext);
  const [friendQuery, setFriendQuery] = useState("");
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  // Sprint 12.3 — trava re-entrância do picker. O `uploading` só cobre o upload,
  // não a fase "câmera/galeria aberta": sem isso, um segundo toque (ou reabrir)
  // dispara outro present e dá race no WKWebView iOS (câmera fecha sozinha +
  // botão trava). Ref (não state) pra não re-renderizar e pegar o valor na hora.
  const pickerBusyRef = useRef(false);

  function showComposerStep(step: ComposerStep) {
    setComposerStep(step);
    window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ block: "start" });
    });
  }

  // Sprint 13 — resolve as tags escolhidas (chips + "Outro" custom), cap 5. A
  // primeira (resolvedWorkoutType) vira a primária em posts.workout_type.
  const resolvedWorkoutTypes = useMemo<string[]>(() => {
    const out: string[] = [];
    for (const value of selectedWorkoutValues) {
      if (value === "Outro") {
        const custom = customWorkoutType.trim();
        if (custom) out.push(custom);
      } else if (value.trim()) {
        out.push(value.trim());
      }
    }
    return out.slice(0, 5);
  }, [customWorkoutType, selectedWorkoutValues]);
  const resolvedWorkoutType = resolvedWorkoutTypes[0] ?? null;

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
          user.username.toLowerCase().includes(query) || user.name.toLowerCase().includes(query),
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
  }, [coordinates, locationMode, locationName, selectedGym, t]);

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
  async function uploadOne(
    file: File,
    onProgress?: (progress: MediaUploadProgress) => void,
  ): Promise<PostMediaItem | null> {
    if (!isSupportedMediaFile(file)) {
      setUploadError(t("postScreen.publish.errors.uploadInvalidType"));
      return null;
    }
    const type = getMediaType(file);
    const uploaded = onUploadImage
      ? await onUploadImage(file, onProgress)
      : URL.createObjectURL(file);
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

  // Câmera / 1 arquivo → MÍDIA ÚNICA (substitui a seleção atual). Mostra a capa
  // de carregando na hora (preview local) — antes a tela ficava parada no vídeo.
  async function uploadSelectedFile(file: File) {
    setUploadError(null);
    setPublishError(null);
    if (!isSupportedMediaFile(file)) {
      setUploadError(t("postScreen.publish.errors.uploadInvalidType"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      return;
    }
    const placeholder: PendingUpload = {
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      previewUrl: URL.createObjectURL(file),
      mediaType: getMediaType(file),
      status: "uploading",
      progress: 0,
    };
    setPendingUploads((prev) => [...prev, placeholder]);
    setUploading(true);
    try {
      const item = await uploadOne(file, (progress) => {
        setPendingUploads((current) =>
          current.map((pending) =>
            pending.id === placeholder.id
              ? { ...pending, progress: progress.percentage }
              : pending,
          ),
        );
      });
      if (item) {
        setMediaItems([item]);
        applyCover(item);
      }
    } catch (err) {
      setUploadError(getErrorMessage(err));
    } finally {
      if (placeholder.previewUrl) {
      URL.revokeObjectURL(placeholder.previewUrl);
      }
      setPendingUploads((prev) => prev.filter((x) => x.id !== placeholder.id));
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  }

  // Galeria → multi: sobe vários EM PARALELO, APPEND (cap MAX_MEDIA). Os thumbs
  // aparecem na hora com animação de carregando (placeholders), e cada um é
  // trocado pela mídia real quando o upload termina. Capa = item 0.
  async function uploadGalleryFiles(files: File[]) {
    if (files.length === 0) return;
    setUploadError(null);
    setPublishError(null);
    const room = Math.max(0, MAX_MEDIA - mediaItems.length - pendingUploads.length);
    const chosen = files
      .slice(0, room)
      .filter(isSupportedMediaFile);
    if (chosen.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    // 1) placeholders NA HORA (preview instantâneo via objectURL).
    const placeholders: PendingUpload[] = chosen.map((file) => ({
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      // Não cria <video>/object URL para cada pendência: quatro decoders
      // simultâneos já bastavam para o iOS reiniciar o WebView.
      previewUrl: getMediaType(file) === "video" ? null : URL.createObjectURL(file),
      mediaType: getMediaType(file),
      status: "uploading",
      progress: 0,
    }));
    setPendingUploads((prev) => [...prev, ...placeholders]);
    setUploading(true);
    // Progresso REAL do lote: conta cada mídia que termina de subir.
    let done = 0;
    setUploadProgress({ done: 0, total: chosen.length });
    try {
      // 2) concorrência limitada: vídeos sequenciais no iPhone evitam que
      // múltiplos decoders/canvas/uploads reiniciem o WebView inteiro.
      const settled = await allSettledWithConcurrency(
        chosen,
        getMediaUploadConcurrency(chosen),
        (file, index) =>
          uploadOne(file, (progress) => {
            const placeholderId = placeholders[index]?.id;
            setPendingUploads((current) =>
              current.map((pending) =>
                pending.id === placeholderId
                  ? { ...pending, progress: progress.percentage }
                  : pending,
              ),
            );
          }).finally(() => {
            done += 1;
            setUploadProgress({ done, total: chosen.length });
          }),
      );
      const picked: PostMediaItem[] = [];
      let firstError: unknown = null;
      for (const result of settled) {
        if (result.status === "fulfilled" && result.value) picked.push(result.value);
        else if (result.status === "rejected" && !firstError) firstError = result.reason;
      }
      if (picked.length > 0) {
        const next = [...mediaItems, ...picked].slice(0, MAX_MEDIA);
        setMediaItems(next);
        applyCover(next[0]);
      }
      if (firstError) setUploadError(getErrorMessage(firstError));
    } catch (err) {
      setUploadError(getErrorMessage(err));
    } finally {
      placeholders.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
      setPendingUploads((prev) => prev.filter((x) => !placeholders.some((ph) => ph.id === x.id)));
      setUploadProgress(null);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeMediaAt(index: number) {
    const next = mediaItems.filter((_, i) => i !== index);
    setMediaItems(next);
    applyCover(next[0] ?? null);
  }

  async function handleGalleryFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    // Galeria sempre adiciona. Antes, selecionar UMA mídia ao tocar em "+"
    // apagava o carrossel atual ao cair no fluxo single/replace da câmera.
    await uploadGalleryFiles(files);
  }

  async function handleCameraFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) await uploadSelectedFile(file);
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

  function openGallery() {
    if (uploading) return;
    void HapticsService.selection();
    // O chooseFromGallery do @capacitor/camera 8.2 pode voltar vazio no iOS
    // quando o PHAsset não expõe fullSizeImageURL. O input do WKWebView usa o
    // picker do sistema e entrega File diretamente, sem URI -> fetch -> Blob.
    fileInputRef.current?.click();
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
        mediaItems.length > 0 &&
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
        current.some((gym) => gym.id === cataloged.id) ? current : [...current, cataloged],
      );
      void HapticsService.selection();
      setLocationMode("gym");
      setSelectedGymId(cataloged.id);
      setSearchOpen(false);
    } catch (err) {
      setSearchError(
        errorMessage(err, t("postScreen.location.errors.saveFailed")),
      );
    } finally {
      setCataloging(false);
    }
  }

  async function publishWorkout() {
    if (publishing) return;

    if (!imageUrl.trim() && !activityContext) {
      if (!onCreateCheckin || !selectedGym || resolvedLocation.gymId === null) {
        setPublishError("Selecione um local cadastrado para fazer check-in.");
        return;
      }
      setPublishing(true);
      setPublishError(null);
      try {
        await onCreateCheckin(resolvedLocation.gymId, publishWorkoutDate);
        void HapticsService.success();
      } catch (err) {
        void HapticsService.error();
        setPublishError(getErrorMessage(err));
      } finally {
        setPublishing(false);
      }
      return;
    }

    if (!isBackdated && !postToFeed && !postToStory) {
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
      let publishImageUrl = imageUrl;
      let publishMediaType = mediaType;
      let publishMediaMeta = mediaMeta;
      let publishMedia =
        mediaItems.length > 1 ? mediaItems : undefined;

      // Treino rastreado SEM foto precisa continuar sendo post social real.
      // Como o contrato atual do banco exige `posts.image_url`, geramos uma
      // capa leve de stats, fazemos upload e publicamos com source_activity_id.
      if (!publishImageUrl.trim() && activityContext) {
        const generatedCover = await createWorkoutShareCoverFile({
          activityType: activityContext.activityType,
          elapsedS: activityContext.elapsedS,
          movingS: activityContext.movingS ?? null,
          distanceM: activityContext.distanceM ?? null,
          elevationGainM: activityContext.elevationGainM ?? null,
          workoutDate: activityContext.workoutDate,
          workoutTypeLabel: resolvedWorkoutType || activityTypeLabel,
          locationLabel: resolvedLocation.name,
        });
        const cover = await uploadOne(generatedCover);
        if (!cover?.imageUrl) {
          throw new Error(t("postScreen.publish.errors.coverFailed"));
        }
        publishImageUrl = cover.imageUrl;
        publishMediaType = "image";
        publishMediaMeta = {
          thumbnailUrl: cover.thumbnailUrl ?? null,
          posterUrl: cover.posterUrl ?? null,
          mediaWidth: cover.mediaWidth ?? 1200,
          mediaHeight: cover.mediaHeight ?? 1500,
          mediaDurationSeconds: cover.mediaDurationSeconds ?? null,
          blurDataUrl: cover.blurDataUrl ?? null,
        };
        publishMedia = undefined;
        setMediaItems([cover]);
        applyCover(cover);
      }

      await onPublish({
        caption,
        workoutType: resolvedWorkoutType,
        // Sprint 13 — carrossel (>1 mídia) + tags (workoutTypes = array).
        media: publishMedia,
        workoutTypes: resolvedWorkoutTypes.length > 0 ? resolvedWorkoutTypes : null,
        gymId: resolvedLocation.gymId,
        gymName: resolvedLocation.name ?? "",
        imageUrl: publishImageUrl,
        thumbnailUrl: publishMediaMeta.thumbnailUrl ?? null,
        posterUrl: publishMediaMeta.posterUrl ?? null,
        mediaWidth: publishMediaMeta.mediaWidth ?? null,
        mediaHeight: publishMediaMeta.mediaHeight ?? null,
        mediaDurationSeconds: publishMediaMeta.mediaDurationSeconds ?? null,
        blurDataUrl: publishMediaMeta.blurDataUrl ?? null,
        mediaType: publishMediaType,
        locationSource: resolvedLocation.source,
        locationName: resolvedLocation.name,
        locationLatitude: resolvedLocation.latitude,
        locationLongitude: resolvedLocation.longitude,
        locationGoogleMapsUrl: resolvedLocation.googleMapsUrl,
        taggedUserIds,
        // Backdated (registrar treino) vai só pro feed (preenche o calendário).
        destinations: isBackdated
          ? { feed: true, story: false }
          : { feed: postToFeed, story: postToStory },
        workoutDate: publishWorkoutDate,
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
  // Sem mídia: treino rastreado publica mesmo assim (capa gerada); sem
  // atividade vira rascunho de check-in (comportamento original).
  const isActivityDraft = mediaItems.length === 0 && Boolean(activityContext);
  const isCheckinDraft = mediaItems.length === 0 && !activityContext;
  const canPublish =
    !uploading &&
    !publishing &&
    (isCheckinDraft
      ? Boolean(onCreateCheckin && resolvedLocation.gymId)
      : isActivityDraft
        ? hasDestination && locationReady
        : imageUrl.trim().length > 0 && hasDestination && locationReady);

  const publishLabel = useMemo(() => {
    if (publishing) return t("postScreen.publish.publishing");
    if (isCheckinDraft) return "Fazer check-in";
    if (isBackdated) return t("postScreen.registerWorkout.cta");
    if (postToFeed && postToStory) return t("postScreen.publish.ctaBoth");
    if (postToFeed) return t("postScreen.publish.ctaFeed");
    if (postToStory) return t("postScreen.publish.ctaStory");
    return t("postScreen.publish.ctaNoDestination");
  }, [isBackdated, isCheckinDraft, postToFeed, postToStory, publishing, t]);

  const destinationHint = useMemo(() => {
    if (postToFeed && postToStory) return t("postScreen.destinations.hintBoth");
    if (postToFeed) return t("postScreen.destinations.hintFeed");
    if (postToStory) return t("postScreen.destinations.hintStory");
    return t("postScreen.destinations.hintNone");
  }, [postToFeed, postToStory, t]);

  return (
    <section
      className="gc-screen-enter min-h-screen px-5 pb-6"
      data-gc-no-screen-swipe
      ref={sectionRef}
    >
      <header className="sticky top-0 z-20 -mx-5 flex min-h-20 items-center justify-between border-b border-white/[0.06] bg-black/92 px-5 backdrop-blur-xl">
        <button
          aria-label={t(
            composerStep === "details" ? "postScreen.steps.back" : "postScreen.steps.cancel",
          )}
          className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.06] text-white"
          onClick={() => (composerStep === "details" ? showComposerStep("media") : onCancel())}
          type="button"
        >
          {composerStep === "details" ? (
            <ArrowLeft size={20} strokeWidth={2.4} />
          ) : (
            <X size={20} strokeWidth={2.4} />
          )}
        </button>
        <div className="min-w-0 px-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.13em] text-white/36">
            {isBackdated ? t("postScreen.registerWorkout.eyebrow") : t("postScreen.topBar.eyebrow")}
          </p>
          <h1 className="truncate text-[18px] font-black text-white">
            {isBackdated
              ? t("postScreen.registerWorkout.title", {
                  date: backdatedLabel,
                })
              : t(
                  composerStep === "media"
                    ? "postScreen.steps.mediaTitle"
                    : "postScreen.steps.detailsTitle",
                )}
          </h1>
        </div>
        {composerStep === "media" ? (
          <button
            aria-label={t("postScreen.steps.next")}
            className="gc-pressable grid size-11 place-items-center rounded-full bg-[var(--gc-brand)] text-black disabled:bg-white/[0.06] disabled:text-white/24"
            disabled={uploading}
            onClick={() => showComposerStep("details")}
            type="button"
          >
            {uploading ? (
              <Loader2 className="animate-spin" size={19} />
            ) : (
              <ChevronRight size={22} strokeWidth={2.8} />
            )}
          </button>
        ) : (
          <span aria-hidden className="size-11" />
        )}
      </header>

      {/* Registrar treino: aviso de data travada (post retroativo). */}
      {isBackdated ? (
        <div className="mt-3 flex items-center gap-2 rounded-[16px] border border-[var(--gc-brand)]/24 bg-[var(--gc-brand)]/10 px-4 py-3">
          <Calendar className="shrink-0 text-[var(--gc-brand)]" size={16} strokeWidth={2.4} />
          <p className="text-[12px] font-bold text-white/72">
            {t("postScreen.registerWorkout.notice", { date: backdatedLabel })}
          </p>
        </div>
      ) : null}

      {/* Rastreio de treino: treino encerrado virando post (foto opcional). */}
      {activityContext ? (
        <div className="mt-3 rounded-[16px] border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
          <p className="text-[12.5px] font-black text-emerald-300">
            {t("postScreen.activity.title", {
              type: activityTypeLabel,
              elapsed: formatElapsed(activityContext.elapsedS),
            })}
          </p>
          <p className="mt-0.5 text-[12px] font-bold text-white/56">
            {t("postScreen.activity.notice")}
          </p>
        </div>
      ) : null}

      {/* Inputs invisíveis pra câmera e galeria */}
      <input
        accept="image/*,video/*"
        className="hidden"
        multiple
        onChange={handleGalleryFileChange}
        ref={fileInputRef}
        type="file"
      />
      <input
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraFileChange}
        ref={cameraInputRef}
        type="file"
      />

      {composerStep === "media" ? (
        <>
          {/* Passo 1: mídia ocupa a tela; teclado e campos pesados ainda não
              existem. O usuário só avança quando todos os uploads terminam. */}
      {imageUrl || pendingUploads.length > 0 ? (
        <div className="mt-4 space-y-2">
          <div className="overflow-hidden rounded-[24px] bg-black">
            {mediaItems.length === 0 && pendingUploads.length > 0 ? (
              // Só upload em curso (ainda sem mídia pronta): capa de carregando.
              <div className="relative aspect-[4/5]">
                {pendingUploads[0].mediaType === "video" ? (
                      <div className="grid h-full w-full place-items-center bg-white/[0.035] text-white/52">
                        <Video size={42} strokeWidth={1.8} />
                      </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className="h-full w-full object-cover"
                        src={pendingUploads[0].previewUrl ?? ""}
                  />
                )}
                <div className="absolute inset-0 grid place-items-center bg-black/45">
                  <div className="grid place-items-center gap-2">
                    <Loader2 className="size-9 animate-spin text-white" />
                    <span className="text-[12px] font-black text-white">
                      {pendingUploads[0].progress}%
                    </span>
                  </div>
                </div>
              </div>
            ) : /* Sprint 13 — >1 mídia: preview em carrossel (swipe pra revisar). */
            mediaItems.length > 1 ? (
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
                  onClick={openGallery}
                  type="button"
                >
                  <RefreshCw size={16} strokeWidth={2.4} />
                </button>
              </div>
            )}
          </div>

          {/* Strip de gerenciamento do carrossel: remover item + adicionar mais.
              Inclui os thumbs em UPLOAD (animação de carregando) na hora. */}
          {mediaItems.length + pendingUploads.length > 1 ? (
            <div className="gc-scrollbar flex gap-2 overflow-x-auto pb-1">
              {mediaItems.map((item, index) => (
                <div
                  className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-black"
                  key={`${item.imageUrl}-${index}`}
                >
                  <EditableMediaThumbnail item={item} />
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
              {/* Thumbs em upload: preview local + animação de carregando. */}
              {pendingUploads.map((pending) => (
                <div
                  className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-black"
                  key={pending.id}
                >
                  {pending.mediaType === "video" ? (
                        <div className="grid h-full w-full place-items-center bg-white/[0.035] text-white/52">
                          <Video size={20} strokeWidth={1.8} />
                        </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                          src={pending.previewUrl ?? ""}
                    />
                  )}
                  <div className="absolute inset-0 grid animate-pulse place-items-center bg-black/45">
                    {pending.status === "error" ? (
                      <span className="text-[10px] font-black text-amber-300">!</span>
                    ) : (
                      <span className="text-[10px] font-black text-white">
                        {pending.progress}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {mediaItems.length + pendingUploads.length < MAX_MEDIA ? (
                <button
                  aria-label={t("postScreen.media.addMore")}
                  className="gc-pressable grid size-16 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white/60 disabled:opacity-50"
                  disabled={uploading}
                  onClick={openGallery}
                  type="button"
                >
                  <Plus size={18} />
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Barra de progresso REAL do lote (nº de mídias já enviadas / total). */}
          {uploadProgress && uploadProgress.total > 1 ? (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[12px] font-bold text-white/60">
                <span>{t("postScreen.media.uploading")}</span>
                <span>
                  {uploadProgress.done}/{uploadProgress.total}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[var(--gc-brand)] transition-[width] duration-300 ease-out"
                  style={{
                    width: `${Math.round((uploadProgress.done / uploadProgress.total) * 100)}%`,
                  }}
                />
              </div>
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
              onClick={openGallery}
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
        </>
      ) : (
        <>
          {/* Passo 2: usa somente o poster/thumbnail da capa. Nenhum decoder de
              vídeo fica disputando memória com teclado, busca e localização. */}
          <div className="mt-4 flex items-center gap-3 rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-3">
            <div className="size-20 shrink-0 overflow-hidden rounded-[14px] bg-black">
              {mediaItems.length === 0 ? (
                <div className="grid h-full w-full place-items-center bg-[var(--gc-brand)]/10 text-[var(--gc-brand)]">
                  <Search size={24} strokeWidth={2.2} />
                </div>
              ) : mediaItems[0]?.mediaType === "video" &&
              !mediaItems[0]?.posterUrl &&
              !mediaItems[0]?.thumbnailUrl ? (
                <div className="grid h-full w-full place-items-center text-white/52">
                  <Video size={24} strokeWidth={1.8} />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={t("postScreen.media.alt")}
                  className="h-full w-full object-cover"
                  src={
                    mediaItems[0]?.posterUrl ??
                    mediaItems[0]?.thumbnailUrl ??
                    mediaItems[0]?.imageUrl ??
                    imageUrl
                  }
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-black text-white">
                {mediaItems.length === 0
                  ? activityContext
                    ? t("postScreen.steps.activityNoMedia")
                    : t("postScreen.steps.checkinNoMedia")
                  : t("postScreen.steps.mediaReady", {
                      count: mediaItems.length,
                    })}
              </p>
              <p className="mt-1 text-[11px] font-bold text-white/42">
                {mediaItems.length === 0
                  ? activityContext
                    ? t("postScreen.steps.activityNoMediaHint")
                    : t("postScreen.steps.checkinNoMediaHint")
                  : t("postScreen.steps.mediaReadyHint")}
              </p>
            </div>
            <button
              className="gc-pressable h-9 shrink-0 rounded-full bg-white/[0.07] px-3 text-[12px] font-black text-white"
              onClick={() => showComposerStep("media")}
              type="button"
            >
              {t("postScreen.steps.editMedia")}
            </button>
          </div>

          {/* Caption + opções + publicar — só no segundo passo. */}
      {imageUrl || activityContext ? (
        <>
          <textarea
            aria-label={t("postScreen.caption.aria")}
            className="mt-4 min-h-[88px] w-full resize-none bg-transparent text-[16px] font-medium leading-6 text-white outline-none placeholder:text-white/32"
            onChange={(event) => setCaption(event.target.value)}
            placeholder={
              activityContext
                ? t("postScreen.caption.activityPlaceholder")
                : t("postScreen.caption.placeholder")
            }
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
                {/* Sprint 13 — multi-select de até 5 tags (chips toggle). */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {workoutTypes.map((type) => {
                    const selected = selectedWorkoutValues.includes(type.value);
                    const full = selectedWorkoutValues.length >= 5;
                    return (
                      <button
                        className={[
                          "gc-pressable rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors disabled:opacity-35",
                          selected
                            ? "bg-[var(--gc-brand)] text-black"
                            : "bg-white/[0.05] text-white/72",
                        ].join(" ")}
                        disabled={!selected && full}
                        key={type.key}
                        onClick={() => {
                          void HapticsService.selection();
                          setSelectedWorkoutValues((prev) =>
                            prev.includes(type.value)
                              ? prev.filter((v) => v !== type.value)
                              : prev.length >= 5
                                ? prev
                                : [...prev, type.value],
                          );
                        }}
                        type="button"
                      >
                        {t(`postScreen.workoutType.options.${type.key}`)}
                      </button>
                    );
                  })}
                </div>
                {selectedWorkoutValues.includes("Outro") ? (
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
                              setTaggedUserIds((current) => current.filter((id) => id !== user.id))
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

              {/* Registrar treino vai só pro feed (sem story) — esconde o toggle. */}
              {isBackdated ? null : (
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
              )}
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
              {isBackdated
                    ? t("postScreen.registerWorkout.hint", {
                        date: backdatedLabel,
                      })
                : destinationHint}
            </p>
            {publishError ? (
              <p className="text-center text-[12px] font-bold text-[var(--gc-pink)]">
                {publishError}
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-white/42">
              {t("postScreen.location.label")}
            </p>
            <button
              className="gc-pressable mt-2 flex min-h-12 w-full items-center gap-3 rounded-[16px] border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-left text-[14px] font-bold text-white"
              disabled={cataloging}
              onClick={() => {
                setSearchError(null);
                setSearchOpen(true);
              }}
              type="button"
            >
              <Search className="shrink-0 text-white/52" size={16} strokeWidth={2.4} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  {selectedLocationLabel || "Buscar academia ou local"}
                </span>
                {selectedLocationMeta ? (
                  <span className="mt-0.5 block truncate text-[11px] text-white/42">
                    {selectedLocationMeta}
                  </span>
                ) : null}
              </span>
            </button>
          </div>
          <button
            className="gc-pressable flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[15px] font-black text-black disabled:bg-white/[0.05] disabled:text-white/30"
            disabled={!canPublish}
            onClick={publishWorkout}
            type="button"
          >
            <Check size={18} strokeWidth={2.8} />
            {publishLabel}
          </button>
          <p className="text-center text-[11px] font-bold text-white/40">
            Sem mídia, a publicação aparece como check-in e continua contando no streak.
          </p>
          {publishError ? (
            <p className="text-center text-[12px] font-bold text-[var(--gc-pink)]">
              {publishError}
            </p>
          ) : null}
        </div>
      )}
        </>
      )}

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
        active ? "bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]" : "bg-white/[0.05] text-white/56",
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

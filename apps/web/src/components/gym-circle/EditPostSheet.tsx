"use client";

import Image from "next/image";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ChevronRight,
  Check,
  ImagePlus,
  Plus,
  Search,
  UserPlus,
  Video,
  X,
} from "lucide-react";
import {
  GymSearchSheet,
  type LocatedPlaceCandidate,
  type PlaceCandidate,
} from "./GymSearchSheet";
import { MediaCarousel } from "./design-system/MediaCarousel";
import { PinchZoomImage } from "./design-system/PinchZoomImage";
import { VideoThumbnail } from "./design-system/VideoThumbnail";
import {
  allSettledWithConcurrency,
  getMediaUploadConcurrency,
} from "./mediaUploadQueue";
import { getMediaFileType, isSupportedMediaFile } from "./mediaFileType";
import type { MediaUploadProgress } from "./resumableUpload";
import type {
  EditPostInput,
  EnrichedCheckin,
  EnrichedPost,
  EnrichedUser,
  GymLocationOption,
  PostMediaItem,
  PostMediaType,
  PromoteCheckinInput,
} from "./social/types";

// Sprint 14 — limite do carrossel (igual ao composer).
const MAX_MEDIA = 10;

type UploadResult = {
  imageUrl: string;
  thumbnailUrl?: string | null;
  posterUrl?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  mediaDurationSeconds?: number | null;
  blurDataUrl?: string | null;
};

type EditPostSheetProps = {
  open: boolean;
  post: EnrichedPost | null;
  checkin?: EnrichedCheckin | null;
  taggableUsers?: EnrichedUser[];
  onClose: () => void;
  onSave: (postId: string, input: EditPostInput) => Promise<void>;
  onPromoteCheckin?: (
    checkinId: string,
    input: PromoteCheckinInput,
  ) => Promise<void>;
  onUpdateCheckin?: (checkinId: string, gymId: string) => Promise<void>;
  onConvertPostToCheckin?: (postId: string, gymId: string) => Promise<void>;
  gyms?: GymLocationOption[];
  recentLocations?: PlaceCandidate[];
  onCatalogPlace?: (place: LocatedPlaceCandidate) => Promise<GymLocationOption>;
  // Sprint 14 — necessário pra adicionar novas mídias ao post.
  onUploadImage?: (
    file: File,
    onProgress?: (progress: MediaUploadProgress) => void,
  ) => Promise<string | UploadResult>;
};

// Workout types: value PT-BR é source-of-truth no DB.
// key indexa o label i18n via postScreen.workoutType.options.{key}
// (reutilizamos o mesmo namespace do composer).
const workoutTypes: ReadonlyArray<{ key: string; value: string }> = [
  { key: "none", value: "" },
  { key: "musculacao", value: "Musculação" },
  { key: "corrida", value: "Corrida" },
  { key: "bike", value: "Bike" },
  { key: "funcional", value: "Funcional" },
  { key: "cardio", value: "Cardio" },
  { key: "mobilidade", value: "Mobilidade" },
];

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

type PendingUpload = {
  id: string;
  previewUrl: string | null;
  mediaType: PostMediaType;
  status: "uploading" | "error";
  progress: number;
};

function getMediaType(file: File): PostMediaType {
  return getMediaFileType(file) ?? "image";
}

function isAutomaticWorkoutCoverPost(post: EnrichedPost | null) {
  if (!post?.workout) return false;
  const media = post.media?.[0];
  const mediaWidth = media?.mediaWidth ?? post.mediaWidth;
  const mediaHeight = media?.mediaHeight ?? post.mediaHeight;
  const mediaType = media?.mediaType ?? post.mediaType;
  return mediaType === "image" && mediaWidth === 1200 && mediaHeight === 1500;
}

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

// Sprint 14 — lista de mídias atual do post (post.media já vem ≥1; senão, capa).
function postToMediaItems(post: EnrichedPost): PostMediaItem[] {
  if (isAutomaticWorkoutCoverPost(post)) return [];
  if (post.media && post.media.length > 0) return post.media;
  return [
    {
      mediaType: post.mediaType,
      imageUrl: post.imageUrl,
      thumbnailUrl: post.thumbnailUrl ?? null,
      posterUrl: post.posterUrl ?? null,
      blurDataUrl: post.blurDataUrl ?? null,
      mediaWidth: post.mediaWidth ?? null,
      mediaHeight: post.mediaHeight ?? null,
      mediaDurationSeconds: post.mediaDurationSeconds ?? null,
    },
  ];
}

export function EditPostSheet({
  open,
  post,
  checkin = null,
  taggableUsers = [],
  onClose,
  onSave,
  onPromoteCheckin,
  onUpdateCheckin,
  onConvertPostToCheckin,
  gyms = [],
  recentLocations = [],
  onCatalogPlace,
  onUploadImage,
}: EditPostSheetProps) {
  const { t } = useTranslation();
  const [caption, setCaption] = useState("");
  const [workoutType, setWorkoutType] = useState("");
  const [friendQuery, setFriendQuery] = useState("");
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"media" | "details">("media");
  const [selectedGymId, setSelectedGymId] = useState("");
  const [localGyms, setLocalGyms] = useState<GymLocationOption[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cataloging, setCataloging] = useState(false);
  // Sprint 14 — mídias editáveis. mediaChanged evita reescrever (e perder) o
  // carrossel quando o user só edita legenda/tipo.
  const [mediaItems, setMediaItems] = useState<PostMediaItem[]>([]);
  const [mediaChanged, setMediaChanged] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isPromotingCheckin = Boolean(checkin);
  const isAutomaticWorkoutCover = isAutomaticWorkoutCoverPost(post);
  const targetUserId = post?.userId ?? checkin?.userId ?? null;
  const searchableGyms = useMemo(() => {
    const merged = new Map<string, GymLocationOption>();
    for (const gym of gyms) merged.set(gym.id, gym);
    for (const gym of localGyms) merged.set(gym.id, gym);
    return Array.from(merged.values());
  }, [gyms, localGyms]);
  const selectedGym =
    searchableGyms.find((gym) => gym.id === selectedGymId) ?? null;

  async function uploadOne(
    file: File,
    onProgress?: (progress: MediaUploadProgress) => void,
  ): Promise<PostMediaItem | null> {
    if (!isSupportedMediaFile(file)) {
      return null;
    }
    const type = getMediaType(file);
    const uploaded = onUploadImage
      ? await onUploadImage(file, onProgress)
      : URL.createObjectURL(file);
    if (typeof uploaded === "string") return { mediaType: type, imageUrl: uploaded };
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

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    const room = Math.max(0, MAX_MEDIA - mediaItems.length - pendingUploads.length);
    const chosen = files
      .slice(0, room)
      .filter(isSupportedMediaFile);
    if (chosen.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    // Placeholders na hora (preview local) com animação de carregando.
    const placeholders: PendingUpload[] = chosen.map((file) => ({
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      previewUrl: getMediaType(file) === "video"
        ? null
        : URL.createObjectURL(file),
      mediaType: getMediaType(file),
      status: "uploading",
      progress: 0,
    }));
    setPendingUploads((prev) => [...prev, ...placeholders]);
    setUploading(true);
    try {
      const settled = await allSettledWithConcurrency(
        chosen,
        getMediaUploadConcurrency(chosen),
        (file, index) => {
          const placeholderId = placeholders[index]?.id;
          return uploadOne(file, (progress) => {
            setPendingUploads((current) =>
              current.map((pending) =>
                pending.id === placeholderId
                  ? { ...pending, progress: progress.percentage }
                  : pending,
              ),
            );
          });
        },
      );
      const picked: PostMediaItem[] = [];
      let firstError: unknown = null;
      for (const result of settled) {
        if (result.status === "fulfilled" && result.value) picked.push(result.value);
        else if (result.status === "rejected" && !firstError) firstError = result.reason;
      }
      if (picked.length > 0) {
        setMediaItems((prev) => [...prev, ...picked].slice(0, MAX_MEDIA));
        setMediaChanged(true);
      }
      if (firstError) setError((firstError as Error).message ?? t("editPost.errors.save"));
    } catch (err) {
      setError((err as Error).message ?? t("editPost.errors.save"));
    } finally {
      placeholders.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
      setPendingUploads((prev) =>
        prev.filter((x) => !placeholders.some((ph) => ph.id === x.id)),
      );
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeMediaAt(index: number) {
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
    setMediaChanged(true);
  }

  function openGallery() {
    if (uploading || mediaItems.length >= MAX_MEDIA) {
      return;
    }
    // Mesmo caminho do composer: o input do WKWebView entrega File direto e
    // evita o chooseFromGallery 8.2, que pode voltar vazio para PHAssets.
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) await addFiles(files);
  }

  // Só reinicializa o form UMA vez por alvo aberto. Antes o efeito dependia
  // do OBJETO `post` inteiro e chamava setStep("media") toda vez que o feed
  // reconstruía o post (realtime/refresh) — o que jogava o usuário de volta
  // pra etapa da foto no meio da edição. Agora reseta só quando abre pra um
  // post/check-in diferente (por id).
  const initializedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open || (!post && !checkin)) {
      initializedForRef.current = null;
      return;
    }
    const targetKey = `${post?.id ?? ""}:${checkin?.id ?? ""}`;
    if (initializedForRef.current === targetKey) return;
    initializedForRef.current = targetKey;
    const id = window.setTimeout(() => {
      setCaption(post?.caption ?? "");
      setWorkoutType(post?.workoutType ?? "");
      setFriendQuery("");
      setTaggedUserIds([]);
      setError(null);
      setMediaItems(post ? postToMediaItems(post) : []);
      setMediaChanged(false);
      setStep("media");
      setSelectedGymId(post?.gymId ?? checkin?.gymId ?? "");
      setLocalGyms([]);
    }, 0);
    return () => window.clearTimeout(id);
  }, [checkin, open, post]);

  async function handlePlace(place: PlaceCandidate) {
    setError(null);
    if (place.provider === "registered" && place.gymId) {
      setSelectedGymId(place.gymId);
      setSearchOpen(false);
      return;
    }
    if (!onCatalogPlace) {
      setError("Não foi possível cadastrar este local.");
      return;
    }
    if (typeof place.latitude !== "number" || typeof place.longitude !== "number") {
      setError("Este local precisa de coordenadas para ser cadastrado.");
      return;
    }
    setCataloging(true);
    try {
      const gym = await onCatalogPlace({
        ...place,
        latitude: place.latitude,
        longitude: place.longitude,
      });
      setLocalGyms((current) =>
        current.some((item) => item.id === gym.id) ? current : [...current, gym],
      );
      setSelectedGymId(gym.id);
      setSearchOpen(false);
    } catch (err) {
      setError((err as Error).message ?? "Não foi possível salvar o local.");
    } finally {
      setCataloging(false);
    }
  }

  const activeParticipantIds = useMemo(() => {
    const ids = new Set<string>();
    for (const participant of post?.participants ?? []) {
      if (participant.status !== "rejected") ids.add(participant.taggedUserId);
    }
    return ids;
  }, [post?.participants]);

  const selectedUsers = useMemo(
    () => taggedUserIds.map((id) => taggableUsers.find((user) => user.id === id)).filter(Boolean) as EnrichedUser[],
    [taggableUsers, taggedUserIds],
  );

  const friendResults = useMemo(() => {
    if (!targetUserId) return [];
    const query = normalizeSearch(friendQuery);
    if (query.length < 1) return [];
    return taggableUsers
      .filter((user) => user.id !== targetUserId)
      .filter((user) => !activeParticipantIds.has(user.id))
      .filter((user) => !taggedUserIds.includes(user.id))
      .filter((user) => {
        const haystack = normalizeSearch(`${user.name} ${user.username}`);
        return haystack.includes(query);
      })
      .slice(0, 6);
  }, [
    activeParticipantIds,
    friendQuery,
    taggableUsers,
    taggedUserIds,
    targetUserId,
  ]);

  const acceptedParticipants = post?.acceptedParticipants ?? [];
  const pendingParticipants = post?.pendingParticipants ?? [];

  async function handleSave() {
    if ((!post && !checkin) || saving) return;
    if (!selectedGym && mediaItems.length === 0 && !isAutomaticWorkoutCover) {
      setError("Selecione um local cadastrado para manter como check-in.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const commonInput = {
        caption: caption.trim() ? caption.trim() : null,
        workoutType: workoutType.trim() ? workoutType.trim() : null,
        workoutTypes: workoutType.trim() ? [workoutType.trim()] : [],
        gymId: selectedGym?.id ?? null,
        taggedUserIds:
          taggedUserIds.length > 0 ? taggedUserIds : undefined,
      };
      if (checkin) {
        if (mediaItems.length === 0) {
          if (!onUpdateCheckin || !selectedGym) {
            setError("Não foi possível atualizar este check-in.");
            return;
          }
          await onUpdateCheckin(checkin.id, selectedGym.id);
        } else {
          if (!onPromoteCheckin) {
            setError(t("editCheckin.errors.mediaRequired"));
            return;
          }
          await onPromoteCheckin(checkin.id, {
            ...commonInput,
            gymId: selectedGym?.id ?? checkin.gymId,
            media: mediaItems,
          });
        }
      } else if (post) {
        if (mediaItems.length === 0 && isAutomaticWorkoutCover) {
          await onSave(post.id, {
            ...commonInput,
            media: undefined,
          });
        } else if (mediaItems.length === 0) {
          if (!onConvertPostToCheckin || !selectedGym) {
            setError("Selecione um local para transformar o post em check-in.");
            return;
          }
          await onConvertPostToCheckin(post.id, selectedGym.id);
        } else {
          await onSave(post.id, {
            ...commonInput,
            // Só manda media se o usuário alterou o conjunto.
            media: mediaChanged ? mediaItems : undefined,
          });
        }
      }
      onClose();
    } catch (err) {
      setError((err as Error).message ?? t("editPost.errors.save"));
    } finally {
      setSaving(false);
    }
  }

  if (!open || (!post && !checkin)) return null;

  return (
    <div className="gc-safe-overlay absolute inset-0 z-[85] bg-black/94 backdrop-blur-2xl">
      <div className="relative mx-auto flex h-full max-h-[840px] min-h-[620px] flex-col overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#0a0b0c] shadow-[0_28px_72px_rgba(0,0,0,0.7)]">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4">
          <p className="text-[17px] font-black">
            {t(isPromotingCheckin ? "editCheckin.title" : "editPost.title")}
          </p>
          <button
            aria-label={step === "details" ? "Voltar" : t("common.close")}
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={() => (step === "details" ? setStep("media") : onClose())}
            type="button"
          >
            {step === "details" ? <ArrowLeft size={19} /> : <X size={19} />}
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {step === "media" ? (
            <>
          {/* Sprint 14 — mídias EDITÁVEIS: carrossel + remover + adicionar até 10. */}
          <input
            accept="image/*,video/*"
            className="hidden"
            multiple
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />
          <div className="overflow-hidden rounded-[24px] bg-black">
            {mediaItems.length > 1 ? (
              <MediaCarousel altText={t("editPost.mediaAlt")} media={mediaItems} />
            ) : mediaItems.length === 1 && mediaItems[0].mediaType === "video" ? (
              <div className="relative aspect-[4/5]">
                <video
                  className="h-full w-full object-cover"
                  controls={false}
                  muted
                  playsInline
                  poster={
                    mediaItems[0].posterUrl ?? mediaItems[0].thumbnailUrl ?? undefined
                  }
                  preload="metadata"
                  src={mediaItems[0].imageUrl}
                />
              </div>
            ) : mediaItems.length === 1 ? (
              <PinchZoomImage
                alt={t("editPost.mediaAlt")}
                blurDataUrl={mediaItems[0].blurDataUrl ?? undefined}
                className="w-full"
                sizes="(max-width: 480px) 100vw, 480px"
                src={mediaItems[0].thumbnailUrl ?? mediaItems[0].imageUrl}
              />
            ) : (
              <button
                className="gc-pressable flex aspect-[4/5] w-full flex-col items-center justify-center gap-3 border border-dashed border-white/12 bg-white/[0.025] px-6 text-center"
                disabled={uploading}
                onClick={openGallery}
                type="button"
              >
                <span className="grid size-14 place-items-center rounded-full bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
                  <ImagePlus size={24} />
                </span>
                <span className="text-[15px] font-black text-white">
                  {t("editCheckin.addMedia")}
                </span>
                <span className="text-[12px] font-bold text-white/42">
                  {t("editCheckin.addMediaHint")}
                </span>
              </button>
            )}
          </div>
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
            </>
          ) : (
            <>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-black uppercase text-white/52">
              {t("editPost.captionLabel")}
            </span>
            <textarea
              className="min-h-24 w-full resize-none rounded-[16px] border border-white/[0.08] bg-black/40 px-4 py-3 text-[15px] font-semibold text-white outline-none"
              maxLength={300}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t("postScreen.caption.placeholder")}
              value={caption}
            />
          </label>

          <div>
            <span className="mb-1.5 block text-[12px] font-black uppercase text-white/52">
              Localização
            </span>
            <button
              className="gc-pressable flex min-h-12 w-full items-center gap-3 rounded-[16px] border border-white/[0.08] bg-black/40 px-4 py-3 text-left"
              disabled={cataloging}
              onClick={() => setSearchOpen(true)}
              type="button"
            >
              <Search className="shrink-0 text-white/52" size={17} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold text-white">
                  {selectedGym?.name ?? "Buscar academia ou local"}
                </span>
                {selectedGym?.address || selectedGym?.city ? (
                  <span className="mt-0.5 block truncate text-[11px] font-bold text-white/42">
                    {[selectedGym.address, selectedGym.city, selectedGym.state]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                ) : null}
              </span>
              <ChevronRight className="text-white/36" size={17} />
            </button>
            {selectedGym && !checkin ? (
              <button
                className="gc-pressable mt-2 rounded-full bg-white/[0.05] px-3 py-2 text-[12px] font-bold text-white/58"
                onClick={() => setSelectedGymId("")}
                type="button"
              >
                Remover localização
              </button>
            ) : null}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-black uppercase text-white/52">
              {t("editPost.workoutTypeLabel")}
            </span>
            <select
              className="h-12 w-full rounded-[16px] border border-white/[0.08] bg-black/40 px-4 text-[15px] font-bold text-white outline-none"
              onChange={(e) => setWorkoutType(e.target.value)}
              value={workoutType}
            >
              {workoutTypes.map((type) => (
                <option className="bg-black" key={type.key} value={type.value}>
                  {type.key === "none"
                    ? t("editPost.workoutTypeNone")
                    : t(`postScreen.workoutType.options.${type.key}`)}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-black uppercase text-white/52">
                  {t("editPost.tagFriends.label")}
                </p>
                <p className="mt-0.5 text-[12px] font-bold text-white/42">
                  {t("editPost.tagFriends.hint")}
                </p>
              </div>
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
                <UserPlus size={18} />
              </div>
            </div>

            {acceptedParticipants.length > 0 || pendingParticipants.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {acceptedParticipants.map((user) => (
                  <span
                    className="rounded-full border border-[var(--gc-brand)]/28 bg-[var(--gc-brand)]/10 px-3 py-1.5 text-[12px] font-black text-[var(--gc-brand)]"
                    key={`accepted-${user.id}`}
                  >
                    {t("editPost.tagFriends.accepted", { username: user.username })}
                  </span>
                ))}
                {pendingParticipants.map((user) => (
                  <span
                    className="rounded-full border border-white/[0.1] bg-white/[0.06] px-3 py-1.5 text-[12px] font-black text-white/60"
                    key={`pending-${user.id}`}
                  >
                    {t("editPost.tagFriends.pending", { username: user.username })}
                  </span>
                ))}
              </div>
            ) : null}

            {selectedUsers.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <button
                    className="gc-pressable flex items-center gap-1.5 rounded-full border border-[var(--gc-brand)]/32 bg-[var(--gc-brand)]/12 px-3 py-1.5 text-[12px] font-black text-[var(--gc-brand)]"
                    key={user.id}
                    onClick={() =>
                      setTaggedUserIds((ids) => ids.filter((id) => id !== user.id))
                    }
                    type="button"
                  >
                    @{user.username}
                    <X size={13} />
                  </button>
                ))}
              </div>
            ) : null}

            <input
              className="h-12 w-full rounded-[16px] border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
              onChange={(event) => setFriendQuery(event.target.value)}
              placeholder={t("editPost.tagFriends.searchPlaceholder")}
              value={friendQuery}
            />

            {friendResults.length > 0 ? (
              <div className="mt-2 overflow-hidden rounded-[18px] border border-white/[0.06] bg-black/34">
                {friendResults.map((user) => (
                  <button
                    className="gc-pressable flex w-full items-center gap-3 border-b border-white/[0.05] px-3 py-3 text-left last:border-b-0"
                    key={user.id}
                    onClick={() => {
                      setTaggedUserIds((ids) => [...ids, user.id]);
                      setFriendQuery("");
                    }}
                    type="button"
                  >
                    {user.avatarUrl ? (
                      <Image
                        alt={user.name}
                        className="size-10 rounded-full object-cover"
                        height={40}
                        src={user.avatarUrl}
                        width={40}
                      />
                    ) : (
                      <span className="grid size-10 place-items-center rounded-full bg-[var(--gc-brand)]/16 text-[14px] font-black text-[var(--gc-brand)]">
                        {user.name.slice(0, 1)}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-black text-white">
                        {user.name}
                      </span>
                      <span className="block truncate text-[12px] font-bold text-white/45">
                        @{user.username}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : friendQuery.trim() ? (
              <p className="mt-2 text-[12px] font-bold text-white/36">
                {t("editPost.tagFriends.empty")}
              </p>
            ) : null}
          </div>
            </>
          )}

          {error ? (
            <p className="rounded-[16px] border border-[var(--gc-pink)]/30 bg-[var(--gc-pink)]/10 p-3 text-[12px] font-bold text-[var(--gc-pink)]">
              {error}
            </p>
          ) : null}
        </div>

        <div className="border-t border-white/[0.06] p-4">
          {step === "media" ? (
            <div className="space-y-2">
              {post && mediaChanged && mediaItems.length > 0 ? (
                <button
                  className="gc-pressable flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-black disabled:opacity-50"
                  disabled={saving || uploading}
                  onClick={handleSave}
                  type="button"
                >
                  <Check size={17} strokeWidth={2.8} />
                  {saving ? t("editPost.saving") : t("editPost.saveCarousel")}
                </button>
              ) : null}
              <button
                className="gc-pressable flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white/[0.08] text-[14px] font-black text-white disabled:opacity-50"
                disabled={uploading}
                onClick={() => setStep("details")}
                type="button"
              >
                {t("editPost.continue")}
                <ChevronRight size={18} strokeWidth={2.8} />
              </button>
            </div>
          ) : (
            <button
              className="gc-pressable flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-black disabled:opacity-50"
              disabled={
                saving ||
                uploading ||
                (mediaItems.length === 0 && !selectedGym && !isAutomaticWorkoutCover)
              }
              onClick={handleSave}
              type="button"
            >
              <Check size={17} strokeWidth={2.8} />
              {saving
                ? t("editPost.saving")
                : mediaItems.length === 0 && !isAutomaticWorkoutCover
                  ? "Salvar como check-in"
                  : t(isPromotingCheckin ? "editCheckin.save" : "editPost.save")}
            </button>
          )}
        </div>
      </div>
      <GymSearchSheet
        onClose={() => setSearchOpen(false)}
        onSelect={handlePlace}
        open={searchOpen}
        recentCandidates={recentLocations}
        registeredGyms={searchableGyms}
        title="Editar localização"
      />
    </div>
  );
}

"use client";

import Image from "next/image";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Plus, UserPlus, X } from "lucide-react";
import { MediaCarousel } from "./design-system/MediaCarousel";
import { PinchZoomImage } from "./design-system/PinchZoomImage";
import type {
  EditPostInput,
  EnrichedPost,
  EnrichedUser,
  PostMediaItem,
  PostMediaType,
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
  taggableUsers?: EnrichedUser[];
  onClose: () => void;
  onSave: (postId: string, input: EditPostInput) => Promise<void>;
  // Sprint 14 — necessário pra adicionar novas mídias ao post.
  onUploadImage?: (file: File) => Promise<string | UploadResult>;
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
  previewUrl: string;
  mediaType: PostMediaType;
  status: "uploading" | "error";
};

function getMediaType(file: File): PostMediaType {
  return file.type.startsWith("video/") ? "video" : "image";
}

// Sprint 14 — lista de mídias atual do post (post.media já vem ≥1; senão, capa).
function postToMediaItems(post: EnrichedPost): PostMediaItem[] {
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
  taggableUsers = [],
  onClose,
  onSave,
  onUploadImage,
}: EditPostSheetProps) {
  const { t } = useTranslation();
  const [caption, setCaption] = useState("");
  const [workoutType, setWorkoutType] = useState("");
  const [friendQuery, setFriendQuery] = useState("");
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sprint 14 — mídias editáveis. mediaChanged evita reescrever (e perder) o
  // carrossel quando o user só edita legenda/tipo.
  const [mediaItems, setMediaItems] = useState<PostMediaItem[]>([]);
  const [mediaChanged, setMediaChanged] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function uploadOne(file: File): Promise<PostMediaItem | null> {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      return null;
    }
    const type = getMediaType(file);
    const uploaded = onUploadImage
      ? await onUploadImage(file)
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
      .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (chosen.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    // Placeholders na hora (preview local) com animação de carregando.
    const placeholders: PendingUpload[] = chosen.map((file) => ({
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      previewUrl: URL.createObjectURL(file),
      mediaType: getMediaType(file),
      status: "uploading",
    }));
    setPendingUploads((prev) => [...prev, ...placeholders]);
    setUploading(true);
    try {
      // Sobe em paralelo; preserva a ordem.
      const settled = await Promise.allSettled(chosen.map((f) => uploadOne(f)));
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
      placeholders.forEach((p) => URL.revokeObjectURL(p.previewUrl));
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
    if (uploading || mediaItems.length >= MAX_MEDIA) return;
    // Sprint 14.2 — galeria via <input multiple> (PHPicker nativo do iOS direto,
    // sem o overhead/lentidão do plugin chooseFromGallery). handleFileChange
    // faz o upload.
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) await addFiles(files);
  }

  useEffect(() => {
    if (!open || !post) return;
    const id = window.setTimeout(() => {
      setCaption(post.caption ?? "");
      setWorkoutType(post.workoutType ?? "");
      setFriendQuery("");
      setTaggedUserIds([]);
      setError(null);
      setMediaItems(postToMediaItems(post));
      setMediaChanged(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, post]);

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
    if (!post) return [];
    const query = normalizeSearch(friendQuery);
    if (query.length < 1) return [];
    return taggableUsers
      .filter((user) => user.id !== post.userId)
      .filter((user) => !activeParticipantIds.has(user.id))
      .filter((user) => !taggedUserIds.includes(user.id))
      .filter((user) => {
        const haystack = normalizeSearch(`${user.name} ${user.username}`);
        return haystack.includes(query);
      })
      .slice(0, 6);
  }, [activeParticipantIds, friendQuery, post, taggableUsers, taggedUserIds]);

  const acceptedParticipants = post?.acceptedParticipants ?? [];
  const pendingParticipants = post?.pendingParticipants ?? [];

  async function handleSave() {
    if (!post || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(post.id, {
        caption: caption.trim() ? caption.trim() : null,
        workoutType: workoutType.trim() ? workoutType.trim() : null,
        taggedUserIds: taggedUserIds.length > 0 ? taggedUserIds : undefined,
        // Sprint 14 — só manda media se o user mexeu (evita reescrever/perder
        // o carrossel quando edita só legenda/tipo).
        media: mediaChanged ? mediaItems : undefined,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message ?? t("editPost.errors.save"));
    } finally {
      setSaving(false);
    }
  }

  if (!open || !post) return null;

  return (
    <div className="gc-safe-overlay absolute inset-0 z-[85] bg-black/94 backdrop-blur-2xl">
      <div className="relative mx-auto flex h-full max-h-[840px] min-h-[620px] flex-col overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#0a0b0c] shadow-[0_28px_72px_rgba(0,0,0,0.7)]">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4">
          <p className="text-[17px] font-black">{t("editPost.title")}</p>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
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
            ) : null}
          </div>
          <div className="gc-scrollbar flex gap-2 overflow-x-auto pb-1">
            {mediaItems.map((item, index) => (
              <div
                className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-black"
                key={item.imageUrl}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  src={item.thumbnailUrl ?? item.imageUrl}
                />
                {mediaItems.length > 1 ? (
                  <button
                    aria-label={t("postScreen.media.remove")}
                    className="gc-pressable absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-black/72 text-white"
                    onClick={() => removeMediaAt(index)}
                    type="button"
                  >
                    <X size={11} />
                  </button>
                ) : null}
              </div>
            ))}
            {/* Thumbs em upload: preview local + animação de carregando. */}
            {pendingUploads.map((pending) => (
              <div
                className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-black"
                key={pending.id}
              >
                {pending.mediaType === "video" ? (
                  <video
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                    src={pending.previewUrl}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className="h-full w-full object-cover" src={pending.previewUrl} />
                )}
                <div className="absolute inset-0 grid animate-pulse place-items-center bg-black/45">
                  {pending.status === "error" ? (
                    <span className="text-[10px] font-black text-amber-300">!</span>
                  ) : (
                    <Loader2 className="size-5 animate-spin text-white" />
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

          {error ? (
            <p className="rounded-[16px] border border-[var(--gc-pink)]/30 bg-[var(--gc-pink)]/10 p-3 text-[12px] font-bold text-[var(--gc-pink)]">
              {error}
            </p>
          ) : null}
        </div>

        <div className="border-t border-white/[0.06] p-4">
          <button
            className="gc-pressable flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-black disabled:opacity-50"
            disabled={saving}
            onClick={handleSave}
            type="button"
          >
            <Check size={17} strokeWidth={2.8} />
            {saving ? t("editPost.saving") : t("editPost.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Check, UserPlus, X } from "lucide-react";
import { PinchZoomImage } from "./design-system/PinchZoomImage";
import type { EditPostInput, EnrichedPost, EnrichedUser } from "./social/types";

type EditPostSheetProps = {
  open: boolean;
  post: EnrichedPost | null;
  taggableUsers?: EnrichedUser[];
  onClose: () => void;
  onSave: (postId: string, input: EditPostInput) => Promise<void>;
};

const workoutTypes = [
  { label: "Sem tipo", value: "" },
  { label: "Musculação", value: "Musculação" },
  { label: "Corrida", value: "Corrida" },
  { label: "Bike", value: "Bike" },
  { label: "Funcional", value: "Funcional" },
  { label: "Cardio", value: "Cardio" },
  { label: "Mobilidade", value: "Mobilidade" },
];

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function EditPostSheet({
  open,
  post,
  taggableUsers = [],
  onClose,
  onSave,
}: EditPostSheetProps) {
  const [caption, setCaption] = useState("");
  const [workoutType, setWorkoutType] = useState("");
  const [friendQuery, setFriendQuery] = useState("");
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !post) return;
    const id = window.setTimeout(() => {
      setCaption(post.caption ?? "");
      setWorkoutType(post.workoutType ?? "");
      setFriendQuery("");
      setTaggedUserIds([]);
      setError(null);
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
      });
      onClose();
    } catch (err) {
      setError((err as Error).message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !post) return null;

  return (
    <div className="gc-safe-overlay absolute inset-0 z-[85] bg-black/94 backdrop-blur-2xl">
      <div className="relative mx-auto flex h-full max-h-[840px] min-h-[620px] flex-col overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#0a0b0c] shadow-[0_28px_72px_rgba(0,0,0,0.7)]">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4">
          <p className="text-[17px] font-black">Editar post</p>
          <button
            aria-label="Fechar"
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div
            className={[
              "relative overflow-hidden rounded-[24px] bg-black",
              post.mediaType === "video" ? "aspect-[4/5]" : "",
            ].join(" ")}
          >
            {post.mediaType === "video" ? (
              <video
                className="h-full w-full object-cover"
                controls={false}
                muted
                playsInline
                poster={post.posterUrl ?? post.thumbnailUrl ?? undefined}
                preload="metadata"
                src={post.imageUrl}
              />
            ) : (
              <PinchZoomImage
                alt="Mídia do post"
                blurDataUrl={post.blurDataUrl}
                className="w-full"
                hqSrc={
                  post.thumbnailUrl && post.imageUrl !== post.thumbnailUrl
                    ? post.imageUrl
                    : undefined
                }
                sizes="(max-width: 480px) 100vw, 480px"
                src={post.thumbnailUrl ?? post.imageUrl}
              />
            )}
            <div className="absolute bottom-2 left-2 rounded-full bg-black/64 px-3 py-1.5 text-[11px] font-bold text-white/72 backdrop-blur-md">
              A mídia não pode ser trocada — apague e poste novamente se precisar.
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-black uppercase text-white/52">
              Legenda
            </span>
            <textarea
              className="min-h-24 w-full resize-none rounded-[16px] border border-white/[0.08] bg-black/40 px-4 py-3 text-[15px] font-semibold text-white outline-none"
              maxLength={300}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Como foi o treino?"
              value={caption}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-black uppercase text-white/52">
              Tipo de treino
            </span>
            <select
              className="h-12 w-full rounded-[16px] border border-white/[0.08] bg-black/40 px-4 text-[15px] font-bold text-white outline-none"
              onChange={(e) => setWorkoutType(e.target.value)}
              value={workoutType}
            >
              {workoutTypes.map((t) => (
                <option className="bg-black" key={t.value || "none"} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-black uppercase text-white/52">
                  Marcar amigos
                </p>
                <p className="mt-0.5 text-[12px] font-bold text-white/42">
                  Envia uma solicitação. Só conta streak depois do aceite.
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
                    @{user.username} aceitou
                  </span>
                ))}
                {pendingParticipants.map((user) => (
                  <span
                    className="rounded-full border border-white/[0.1] bg-white/[0.06] px-3 py-1.5 text-[12px] font-black text-white/60"
                    key={`pending-${user.id}`}
                  >
                    @{user.username} pendente
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
              placeholder="Buscar por username..."
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
                Nenhum usuário encontrado.
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
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

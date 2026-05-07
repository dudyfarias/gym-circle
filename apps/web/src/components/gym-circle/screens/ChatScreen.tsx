"use client";

import Image from "next/image";
import { FormEvent, useMemo, useRef, useState } from "react";
import { ImagePlus, MessageCircle, Search, Send } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { AchievementBadge, StreakBadge } from "../design-system";
import type {
  ChatMessage,
  EnrichedUser,
  SendChatMessageInput,
} from "../social/types";
import { TopBar } from "../TopBar";

type ChatScreenProps = {
  currentUser: EnrichedUser;
  suggestedUsers: EnrichedUser[];
  messages?: ChatMessage[];
  onSelectUser?: (userId: string) => void;
  onSendMessage?: (input: SendChatMessageInput) => Promise<void> | void;
  onUploadImage?: (file: File) => Promise<string>;
};

export function ChatScreen({
  currentUser,
  suggestedUsers,
  messages = [],
  onSelectUser,
  onSendMessage,
  onUploadImage,
}: ChatScreenProps) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [chatQuery, setChatQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const visiblePeople = useMemo(() => {
    const q = chatQuery.trim().replace(/^@/, "").toLowerCase();
    if (q) {
      return suggestedUsers
        .filter((user) => user.username.toLowerCase().includes(q))
        .slice(0, 10);
    }
    return suggestedUsers
      .filter((user) =>
        messages.some(
          (message) =>
            (message.senderId === currentUser.id && message.receiverId === user.id) ||
            (message.senderId === user.id && message.receiverId === currentUser.id),
        ),
      )
      .slice(0, 10);
  }, [chatQuery, currentUser.id, messages, suggestedUsers]);
  const selectedUser =
    suggestedUsers.find((user) => user.id === selectedUserId) ??
    visiblePeople[0];

  const thread = useMemo(() => {
    if (!selectedUser) return [];
    return messages.filter(
      (message) =>
        (message.senderId === currentUser.id && message.receiverId === selectedUser.id) ||
        (message.senderId === selectedUser.id && message.receiverId === currentUser.id),
    );
  }, [currentUser.id, messages, selectedUser]);

  async function send(input: Omit<SendChatMessageInput, "receiverId">) {
    if (!selectedUser || !onSendMessage || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSendMessage({ receiverId: selectedUser.id, ...input });
      setDraft("");
    } catch (err) {
      setError((err as Error).message ?? "Falha ao enviar");
    } finally {
      setSending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    await send({ body: draft });
  }

  async function handleMedia(file: File | undefined) {
    if (!file || !selectedUser || !onSendMessage || sending) return;
    const mediaType = file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("image/")
        ? "image"
        : null;
    if (!mediaType) {
      setError("Envie uma foto ou vídeo.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const mediaUrl = onUploadImage ? await onUploadImage(file) : URL.createObjectURL(file);
      await onSendMessage({ receiverId: selectedUser.id, mediaUrl, mediaType });
    } catch (err) {
      setError((err as Error).message ?? "Falha ao enviar mídia");
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="gc-screen-enter flex min-h-screen flex-col px-5 pb-6">
      <TopBar eyebrow="Circle" title="Chat" />

      <div className="gc-glass-strong mt-5 rounded-[32px] p-4">
        <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/28 px-4">
          <Search size={16} className="text-white/42" />
          <input
            className="h-12 flex-1 bg-transparent text-[14px] font-bold text-white outline-none placeholder:text-white/28"
            onChange={(event) => setChatQuery(event.target.value)}
            placeholder="Buscar @username"
            type="search"
            value={chatQuery}
          />
        </div>
        <div className="gc-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1">
          {visiblePeople.map((person) => (
            <button
              className="gc-pressable w-[68px] shrink-0 text-center"
              key={person.id}
              onClick={() => setSelectedUserId(person.id)}
              type="button"
            >
              <div
                className={[
                  "mx-auto rounded-full p-[2px]",
                  person.id === selectedUser?.id ? "gc-story-ring" : "bg-white/[0.12]",
                ].join(" ")}
              >
                <div className="rounded-full bg-black p-[3px]">
                  <Avatar
                    accent={person.accent}
                    name={person.name}
                    size="md"
                    src={person.avatarUrl ?? undefined}
                  />
                </div>
              </div>
              <p className="mt-2 truncate text-[11px] font-black text-white/58">
                {person.name.split(" ")[0]}
              </p>
            </button>
          ))}
          {visiblePeople.length === 0 ? (
            <p className="py-3 text-[12px] font-bold text-white/38">
              {chatQuery ? "Nenhum @username encontrado." : "Busque pelo @username para iniciar uma conversa."}
            </p>
          ) : null}
        </div>
      </div>

      {selectedUser ? (
        <div className="mt-4 flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-[32px] border border-white/[0.08] bg-white/[0.035]">
          <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4">
            <button
              className="gc-pressable flex min-w-0 items-center gap-3 text-left"
              onClick={() => onSelectUser?.(selectedUser.id)}
              type="button"
            >
              <Avatar
                accent={selectedUser.accent}
                name={selectedUser.name}
                src={selectedUser.avatarUrl ?? undefined}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[15px] font-black">{selectedUser.name}</p>
                  <StreakBadge
                    isLit={selectedUser.streakLitToday}
                    size="xs"
                    streak={selectedUser.currentStreak}
                  />
                </div>
                <p className="truncate text-[12px] font-bold text-white/44">
                  {selectedUser.gyms[0] ?? selectedUser.goal}
                </p>
              </div>
            </button>
            <AchievementBadge icon={<MessageCircle size={13} />} label="DM" tone="blue" />
          </header>

          <div className="gc-scrollbar flex-1 space-y-2 overflow-y-auto p-4">
            {thread.length > 0 ? (
              thread.map((message) => {
                const mine = message.senderId === currentUser.id;
                return (
                  <div
                    className={["flex", mine ? "justify-end" : "justify-start"].join(" ")}
                    key={message.id}
                  >
                    <div
                      className={[
                        "max-w-[78%] overflow-hidden rounded-[22px] px-3 py-2 text-[13px] font-bold leading-5",
                        mine
                          ? "bg-[var(--gc-brand)] text-black"
                          : "bg-white/[0.08] text-white",
                      ].join(" ")}
                    >
                      {message.mediaUrl && message.mediaType === "video" ? (
                        <video
                          className="mb-1 aspect-square w-44 rounded-[16px] bg-black/20 object-cover"
                          controls
                          playsInline
                          preload="metadata"
                          src={message.mediaUrl}
                        />
                      ) : message.mediaUrl ? (
                        <div className="relative mb-1 aspect-square w-44 overflow-hidden rounded-[16px] bg-black/20">
                          <Image
                            alt="Mídia enviada no chat"
                            className="object-cover"
                            fill
                            sizes="176px"
                            src={message.mediaUrl}
                          />
                        </div>
                      ) : null}
                      {message.body ? <p>{message.body}</p> : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <p className="text-[16px] font-black">Comece a conversa</p>
                  <p className="mt-2 max-w-[260px] text-[13px] font-bold text-white/44">
                    Envie uma mensagem, foto ou vídeo para combinar treino.
                  </p>
                </div>
              </div>
            )}
          </div>

          <form className="flex items-center gap-2 border-t border-white/[0.06] p-3" onSubmit={submit}>
            <IconButton
              className="size-11"
              label="Enviar foto ou vídeo"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus size={18} />
            </IconButton>
            <input
              accept="image/*,video/*"
              className="hidden"
              onChange={(event) => handleMedia(event.target.files?.[0])}
              ref={fileRef}
              type="file"
            />
            <input
              className="h-11 min-w-0 flex-1 rounded-full border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Mensagem..."
              value={draft}
            />
            <button
              aria-label="Enviar mensagem"
              className="gc-pressable grid size-11 place-items-center rounded-full bg-[var(--gc-brand)] text-black disabled:opacity-50"
              disabled={sending || !draft.trim() || !onSendMessage}
              type="submit"
            >
              <Send size={17} strokeWidth={2.6} />
            </button>
          </form>
          {error ? (
            <p className="px-4 pb-3 text-[12px] font-bold text-[var(--gc-pink)]">{error}</p>
          ) : null}
        </div>
      ) : (
        <div className="gc-ios-sheet mt-5 rounded-[24px] p-5 text-center">
          <p className="text-[16px] font-black">Seu chat está pronto</p>
          <p className="mt-2 text-[13px] font-bold text-white/48">
            Quando o circle crescer, suas conversas aparecem aqui.
          </p>
        </div>
      )}
    </section>
  );
}

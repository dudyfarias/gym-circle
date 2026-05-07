"use client";

import Image from "next/image";
import { FormEvent, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  AtSign,
  Camera,
  Flame,
  ImagePlus,
  MessageCircle,
  PenLine,
  Search,
  Send,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { EmptyState, StreakBadge } from "../design-system";
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
  onThreadOpen?: (userId: string) => Promise<void> | void;
  onThreadViewChange?: (open: boolean) => void;
  onUploadImage?: (file: File) => Promise<string>;
};

type ConversationItem = {
  user: EnrichedUser;
  messages: ChatMessage[];
  last: ChatMessage | null;
  unread: number;
};

function formatMessageTime(createdAt?: string | null): string {
  if (!createdAt) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function getMessagePreview(message: ChatMessage | null): string {
  if (!message) return "Comece a conversa";
  if (message.body) return message.body;
  if (message.mediaType === "video") return "Vídeo enviado";
  if (message.mediaUrl) return "Foto enviada";
  return "Mensagem";
}

function getStatusCopy(user: EnrichedUser): string {
  return user.streakLitToday ? "treinou hoje" : "ainda não acendeu o círculo";
}

function getOtherUserId(message: ChatMessage, currentUserId: string): string {
  return message.senderId === currentUserId ? message.receiverId : message.senderId;
}

export function ChatScreen({
  currentUser,
  suggestedUsers,
  messages,
  onSelectUser,
  onSendMessage,
  onThreadOpen,
  onThreadViewChange,
  onUploadImage,
}: ChatScreenProps) {
  const safeMessages = useMemo(() => messages ?? [], [messages]);
  const loading = messages === undefined;
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [chatQuery, setChatQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const usersById = useMemo(() => {
    const map = new Map<string, EnrichedUser>();
    for (const user of suggestedUsers) {
      if (user.id !== currentUser.id) map.set(user.id, user);
    }
    return map;
  }, [currentUser.id, suggestedUsers]);

  const friends = useMemo(
    () =>
      suggestedUsers
        .filter((user) => user.followStatus === "accepted" || user.isFollowing)
        .sort((a, b) => b.currentStreak - a.currentStreak)
        .slice(0, 14),
    [suggestedUsers],
  );

  const conversations = useMemo<ConversationItem[]>(() => {
    const grouped = new Map<string, ChatMessage[]>();
    for (const message of safeMessages) {
      const otherId = getOtherUserId(message, currentUser.id);
      const list = grouped.get(otherId) ?? [];
      list.push(message);
      grouped.set(otherId, list);
    }

    return Array.from(grouped.entries())
      .map(([userId, threadMessages]) => {
        const user = usersById.get(userId);
        if (!user) return null;
        const sortedMessages = [...threadMessages].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        const last = sortedMessages.at(-1) ?? null;
        const unread = sortedMessages.filter(
          (message) => message.receiverId === currentUser.id && !message.readAt,
        ).length;
        return { user, messages: sortedMessages, last, unread };
      })
      .filter((item): item is ConversationItem => Boolean(item))
      .sort((a, b) => {
        const aTime = a.last ? new Date(a.last.createdAt).getTime() : 0;
        const bTime = b.last ? new Date(b.last.createdAt).getTime() : 0;
        return bTime - aTime || b.user.currentStreak - a.user.currentStreak;
      });
  }, [currentUser.id, safeMessages, usersById]);

  const searchResults = useMemo(() => {
    const q = chatQuery.trim().replace(/^@/, "").toLowerCase();
    if (!q) return [];
    return suggestedUsers
      .filter((user) => user.id !== currentUser.id)
      .filter((user) => user.username.toLowerCase().includes(q))
      .sort((a, b) => {
        const aStarts = a.username.toLowerCase().startsWith(q) ? 1 : 0;
        const bStarts = b.username.toLowerCase().startsWith(q) ? 1 : 0;
        return bStarts - aStarts || b.currentStreak - a.currentStreak;
      })
      .slice(0, 12);
  }, [chatQuery, currentUser.id, suggestedUsers]);

  const selectedUser = selectedUserId ? usersById.get(selectedUserId) ?? null : null;

  useEffect(() => {
    onThreadViewChange?.(Boolean(selectedUser));
    return () => onThreadViewChange?.(false);
  }, [onThreadViewChange, selectedUser]);

  const thread = useMemo(() => {
    if (!selectedUser) return [];
    return safeMessages
      .filter(
        (message) =>
          (message.senderId === currentUser.id && message.receiverId === selectedUser.id) ||
          (message.senderId === selectedUser.id && message.receiverId === currentUser.id),
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [currentUser.id, safeMessages, selectedUser]);

  const selectedUnreadCount = useMemo(
    () =>
      thread.filter((message) => message.receiverId === currentUser.id && !message.readAt)
        .length,
    [currentUser.id, thread],
  );

  useEffect(() => {
    if (!selectedUser || selectedUnreadCount === 0) return;
    void onThreadOpen?.(selectedUser.id);
  }, [onThreadOpen, selectedUnreadCount, selectedUser]);

  useEffect(() => {
    if (!selectedUser) return;
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [selectedUser, thread.length]);

  function openThread(userId: string) {
    setSelectedUserId(userId);
    setChatQuery("");
    setError(null);
  }

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
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  if (selectedUser) {
    return (
      <ConversationView
        currentUser={currentUser}
        draft={draft}
        error={error}
        fileRef={fileRef}
        cameraRef={cameraRef}
        onBack={() => setSelectedUserId(null)}
        onDraftChange={setDraft}
        onMedia={handleMedia}
        onQuickReaction={() => send({ body: "🔥" })}
        onSelectUser={onSelectUser}
        onSubmit={submit}
        sending={sending}
        selectedUser={selectedUser}
        thread={thread}
        threadEndRef={threadEndRef}
        uploadDisabled={!onSendMessage || sending}
      />
    );
  }

  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar eyebrow="Circle" title="Mensagens" />

      <div className="mt-5 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.055] px-4 backdrop-blur-2xl">
          <Search size={16} className="text-white/42" />
          <input
            className="h-12 min-w-0 flex-1 bg-transparent text-[14px] font-bold text-white outline-none placeholder:text-white/28"
            onChange={(event) => setChatQuery(event.target.value)}
            placeholder="Buscar @username"
            ref={searchRef}
            type="search"
            value={chatQuery}
          />
        </div>
        <IconButton
          className="size-12 border-[var(--gc-brand)]/20 bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]"
          label="Nova conversa"
          onClick={() => searchRef.current?.focus()}
        >
          <PenLine size={18} />
        </IconButton>
      </div>

      {friends.length > 0 ? (
        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="text-[12px] font-black uppercase tracking-[0.08em] text-white/42">
              Amigos
            </p>
            <span className="text-[11px] font-black text-white/34">
              seguindo
            </span>
          </div>
          <div className="gc-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-1">
            {friends.map((person) => (
              <button
                className="gc-pressable w-[70px] shrink-0 text-center"
                key={person.id}
                onClick={() => openThread(person.id)}
                type="button"
              >
                <div className="relative mx-auto size-14">
                  <div className="rounded-full bg-white/[0.1] p-[2px]">
                    <div className="rounded-full bg-black p-[3px]">
                      <Avatar
                        accent={person.accent}
                        name={person.name}
                        size="md"
                        src={person.avatarUrl ?? undefined}
                      />
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1">
                    <StreakBadge
                      isLit={person.streakLitToday}
                      size="xs"
                      streak={person.currentStreak}
                    />
                  </div>
                </div>
                <p className="mt-2 truncate text-[11px] font-black text-white/58">
                  {person.name.split(" ")[0]}
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {chatQuery.trim() ? (
        <section className="mt-5 space-y-2">
          <p className="px-1 text-[12px] font-black uppercase tracking-[0.08em] text-white/42">
            Resultados
          </p>
          {searchResults.length > 0 ? (
            searchResults.map((user) => (
              <UserSearchRow key={user.id} onOpen={openThread} user={user} />
            ))
          ) : (
            <EmptyState
              detail="Para começar uma conversa, você precisa saber o @username."
              title="Nenhum usuário encontrado"
            />
          )}
        </section>
      ) : (
        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="text-[12px] font-black uppercase tracking-[0.08em] text-white/42">
              Conversas
            </p>
            {conversations.length > 0 ? (
              <span className="text-[11px] font-black text-white/34">
                {conversations.length}
              </span>
            ) : null}
          </div>
          {loading ? (
            <ChatSkeleton />
          ) : conversations.length > 0 ? (
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <ConversationRow
                  conversation={conversation}
                  currentUserId={currentUser.id}
                  key={conversation.user.id}
                  onOpen={openThread}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              action={
                <button
                  className="gc-pressable h-12 rounded-full bg-[var(--gc-brand)] px-5 text-[14px] font-black text-black"
                  onClick={() => searchRef.current?.focus()}
                  type="button"
                >
                  Nova conversa
                </button>
              }
              detail="Busque um @username ou abra um amigo para combinar treino."
              title="Nenhuma conversa ainda"
            />
          )}
        </section>
      )}
    </section>
  );
}

type ConversationRowProps = {
  conversation: ConversationItem;
  currentUserId: string;
  onOpen: (userId: string) => void;
};

function ConversationRow({
  conversation,
  currentUserId,
  onOpen,
}: ConversationRowProps) {
  const { user, last, unread } = conversation;
  const mine = last?.senderId === currentUserId;

  return (
    <button
      className="gc-pressable flex w-full items-center gap-3 rounded-[26px] px-2 py-3 text-left transition-colors hover:bg-white/[0.045]"
      onClick={() => onOpen(user.id)}
      type="button"
    >
      <div className="relative shrink-0">
        <Avatar accent={user.accent} name={user.name} src={user.avatarUrl ?? undefined} />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-[var(--gc-brand)] text-[10px] font-black text-black shadow-[0_0_18px_rgba(92,232,255,0.28)]">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[15px] font-black text-white">{user.name}</p>
          <StreakBadge isLit={user.streakLitToday} size="xs" streak={user.currentStreak} />
        </div>
        <p className="mt-0.5 truncate text-[12px] font-bold text-white/44">
          {mine ? "Você: " : ""}
          {getMessagePreview(last)}
        </p>
        <p className="mt-0.5 truncate text-[11px] font-bold text-white/30">
          @{user.username}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-[11px] font-black text-white/34">
          {formatMessageTime(last?.createdAt)}
        </span>
        <span
          className={[
            "size-2 rounded-full",
            unread > 0 ? "bg-[var(--gc-brand)] shadow-[0_0_14px_rgba(92,232,255,0.48)]" : "bg-transparent",
          ].join(" ")}
        />
      </div>
    </button>
  );
}

function UserSearchRow({
  user,
  onOpen,
}: {
  user: EnrichedUser;
  onOpen: (userId: string) => void;
}) {
  return (
    <button
      className="gc-pressable flex w-full items-center gap-3 rounded-[26px] bg-white/[0.035] px-3 py-3 text-left"
      onClick={() => onOpen(user.id)}
      type="button"
    >
      <Avatar accent={user.accent} name={user.name} src={user.avatarUrl ?? undefined} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[15px] font-black text-white">{user.name}</p>
          <StreakBadge isLit={user.streakLitToday} size="xs" streak={user.currentStreak} />
        </div>
        <p className="mt-0.5 flex items-center gap-1 text-[12px] font-bold text-white/42">
          <AtSign size={12} />
          <span className="truncate">{user.username}</span>
        </p>
      </div>
      <span className="rounded-full bg-[var(--gc-brand)]/12 px-3 py-2 text-[11px] font-black text-[var(--gc-brand)]">
        Mensagem
      </span>
    </button>
  );
}

type ConversationViewProps = {
  cameraRef: RefObject<HTMLInputElement | null>;
  currentUser: EnrichedUser;
  draft: string;
  error: string | null;
  fileRef: RefObject<HTMLInputElement | null>;
  onBack: () => void;
  onDraftChange: (value: string) => void;
  onMedia: (file: File | undefined) => void | Promise<void>;
  onQuickReaction: () => void;
  onSelectUser?: (userId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  selectedUser: EnrichedUser;
  sending: boolean;
  thread: ChatMessage[];
  threadEndRef: RefObject<HTMLDivElement | null>;
  uploadDisabled: boolean;
};

function ConversationView({
  cameraRef,
  currentUser,
  draft,
  error,
  fileRef,
  onBack,
  onDraftChange,
  onMedia,
  onQuickReaction,
  onSelectUser,
  onSubmit,
  selectedUser,
  sending,
  thread,
  threadEndRef,
  uploadDisabled,
}: ConversationViewProps) {
  return (
    <section className="gc-screen-enter flex min-h-screen flex-col px-3 pb-5">
      <header className="sticky top-0 z-30 -mx-3 flex items-center gap-3 border-b border-white/[0.06] bg-black/82 px-4 pb-3 pt-[calc(var(--gc-safe-top)+14px)] backdrop-blur-2xl">
        <button
          aria-label="Voltar"
          className="gc-pressable grid size-11 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft size={20} />
        </button>
        <button
          className="gc-pressable flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => onSelectUser?.(selectedUser.id)}
          type="button"
        >
          <Avatar
            accent={selectedUser.accent}
            name={selectedUser.name}
            src={selectedUser.avatarUrl ?? undefined}
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-[15px] font-black text-white">
                {selectedUser.name}
              </p>
              <StreakBadge
                isLit={selectedUser.streakLitToday}
                size="xs"
                streak={selectedUser.currentStreak}
              />
            </div>
            <p className="truncate text-[12px] font-bold text-white/42">
              @{selectedUser.username} · {getStatusCopy(selectedUser)}
            </p>
          </div>
        </button>
      </header>

      <div className="flex-1 space-y-3 px-1 py-5">
        {thread.length > 0 ? (
          thread.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              mine={message.senderId === currentUser.id}
            />
          ))
        ) : (
          <div className="grid min-h-[48vh] place-items-center text-center">
            <div>
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--gc-brand)]/12 text-[var(--gc-brand)] shadow-[0_0_28px_rgba(92,232,255,0.16)]">
                <MessageCircle size={24} />
              </div>
              <p className="mt-4 text-[18px] font-black">Comece a conversa</p>
              <p className="mx-auto mt-2 max-w-[260px] text-[13px] font-bold leading-5 text-white/44">
                Envie uma mensagem ou mídia para combinar treino com {selectedUser.name.split(" ")[0]}.
              </p>
            </div>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      <form
        className="sticky bottom-2 z-30 flex items-center gap-2 rounded-[28px] border border-white/[0.08] bg-[#111214]/92 p-2 shadow-[0_18px_54px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
        onSubmit={onSubmit}
      >
        <IconButton
          className="size-10 border-white/[0.08] bg-white/[0.055]"
          disabled={uploadDisabled}
          label="Abrir câmera"
          onClick={() => cameraRef.current?.click()}
        >
          <Camera size={17} />
        </IconButton>
        <IconButton
          className="size-10 border-white/[0.08] bg-white/[0.055]"
          disabled={uploadDisabled}
          label="Enviar foto ou vídeo"
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus size={17} />
        </IconButton>
        <input
          accept="image/*,video/*"
          className="hidden"
          onChange={(event) => onMedia(event.target.files?.[0])}
          ref={fileRef}
          type="file"
        />
        <input
          accept="image/*,video/*"
          capture="environment"
          className="hidden"
          onChange={(event) => onMedia(event.target.files?.[0])}
          ref={cameraRef}
          type="file"
        />
        <input
          className="h-10 min-w-0 flex-1 rounded-full bg-white/[0.06] px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Mensagem..."
          value={draft}
        />
        {draft.trim() ? (
          <button
            aria-label="Enviar mensagem"
            className="gc-pressable grid size-10 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)] text-black disabled:opacity-50"
            disabled={sending}
            type="submit"
          >
            <Send size={16} strokeWidth={2.7} />
          </button>
        ) : (
          <button
            aria-label="Enviar reação"
            className="gc-pressable grid size-10 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)]/12 text-[var(--gc-brand)] disabled:opacity-50"
            disabled={sending}
            onClick={onQuickReaction}
            type="button"
          >
            <Flame size={17} fill="currentColor" />
          </button>
        )}
      </form>
      {error ? (
        <p className="px-4 pt-2 text-center text-[12px] font-bold text-[var(--gc-pink)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function MessageBubble({
  message,
  mine,
}: {
  message: ChatMessage;
  mine: boolean;
}) {
  return (
    <div
      className={["flex gc-screen-enter", mine ? "justify-end" : "justify-start"].join(" ")}
      style={{ animationDuration: "300ms" }}
    >
      <div
        className={[
          "max-w-[78%] overflow-hidden rounded-[24px] px-3 py-2 text-[14px] font-bold leading-5 shadow-[0_10px_24px_rgba(0,0,0,0.18)]",
          mine
            ? "rounded-br-[8px] bg-[var(--gc-brand)] text-black"
            : "rounded-bl-[8px] bg-white/[0.09] text-white",
        ].join(" ")}
      >
        {message.mediaUrl && message.mediaType === "video" ? (
          <video
            className="mb-1 aspect-square w-48 rounded-[18px] bg-black/20 object-cover"
            controls
            playsInline
            preload="metadata"
            src={message.mediaUrl}
          />
        ) : message.mediaUrl ? (
          <div className="relative mb-1 aspect-square w-48 overflow-hidden rounded-[18px] bg-black/20">
            <Image
              alt="Mídia enviada no chat"
              className="object-cover"
              fill
              sizes="192px"
              src={message.mediaUrl}
            />
          </div>
        ) : null}
        {message.body ? <p>{message.body}</p> : null}
        <p className={["mt-1 text-[10px] font-black", mine ? "text-black/42" : "text-white/32"].join(" ")}>
          {formatMessageTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          className="flex animate-pulse items-center gap-3 rounded-[26px] px-2 py-3"
          key={index}
        >
          <div className="size-12 rounded-full bg-white/[0.08]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-32 rounded-full bg-white/[0.08]" />
            <div className="h-3 w-48 rounded-full bg-white/[0.055]" />
          </div>
        </div>
      ))}
    </div>
  );
}

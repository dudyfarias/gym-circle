"use client";

import Image from "next/image";
import { FormEvent, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  AtSign,
  Camera,
  Check,
  Flame,
  ImagePlus,
  MessageCircle,
  PenLine,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { EmptyState, StreakBadge, SwipeRevealDelete } from "../design-system";
import type {
  ChatConversation,
  ChatMessage,
  EnrichedUser,
  SendChatMessageInput,
} from "../social/types";
import { TopBar } from "../TopBar";

type ChatScreenProps = {
  currentUser: EnrichedUser;
  suggestedUsers: EnrichedUser[];
  messages?: ChatMessage[];
  conversations?: ChatConversation[];
  selectedUserId?: string | null;
  onSelectedUserIdChange?: (userId: string | null) => void;
  onSelectUser?: (userId: string) => void;
  onSendMessage?: (input: SendChatMessageInput) => Promise<void> | void;
  onCreateGroupConversation?: (input: {
    name: string;
    memberIds: string[];
    imageUrl?: string | null;
  }) => Promise<string> | string;
  onDeleteConversation?: (userId: string) => Promise<void> | void;
  onDeleteConversationById?: (conversationId: string) => Promise<void> | void;
  onThreadOpen?: (userId: string) => Promise<void> | void;
  onConversationOpen?: (conversationId: string) => Promise<void> | void;
  onThreadViewChange?: (open: boolean) => void;
  onUploadImage?: (file: File) => Promise<string>;
};

type ConversationItem = {
  id: string | null;
  type: "direct" | "group";
  user: EnrichedUser | null;
  members: EnrichedUser[];
  name: string;
  imageUrl: string | null;
  messages: ChatMessage[];
  last: ChatMessage | null;
  unread: number;
  lastReadAt: string | null;
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
  if (message.replyToStory) return "Respondeu ao story";
  if (message.storyId) return "Compartilhou um story";
  if (message.body) return message.body;
  if (message.mediaType === "video") return "Vídeo enviado";
  if (message.mediaUrl) return "Foto enviada";
  return "Mensagem";
}

function getStatusCopy(user: EnrichedUser): string {
  return user.streakLitToday ? "treinou hoje" : "ainda não acendeu o círculo";
}

function getOtherUserId(message: ChatMessage, currentUserId: string): string | null {
  return message.senderId === currentUserId ? message.receiverId : message.senderId;
}

function getGroupName(members: EnrichedUser[], fallback?: string | null): string {
  if (fallback?.trim()) return fallback.trim();
  if (members.length === 0) return "Grupo Gym Circle";
  return members
    .slice(0, 3)
    .map((member) => member.name.split(" ")[0])
    .join(", ");
}

export function ChatScreen({
  currentUser,
  suggestedUsers,
  messages,
  conversations,
  selectedUserId: controlledSelectedUserId,
  onSelectedUserIdChange,
  onSelectUser,
  onSendMessage,
  onCreateGroupConversation,
  onDeleteConversation,
  onDeleteConversationById,
  onThreadOpen,
  onConversationOpen,
  onThreadViewChange,
  onUploadImage,
}: ChatScreenProps) {
  const safeMessages = useMemo(() => messages ?? [], [messages]);
  const safeConversations = useMemo(() => conversations ?? [], [conversations]);
  const loading = messages === undefined;
  const [internalSelectedUserId, setInternalSelectedUserId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [groupComposerOpen, setGroupComposerOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([]);
  const [chatQuery, setChatQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const usersById = useMemo(() => {
    const map = new Map<string, EnrichedUser>();
    for (const user of [currentUser, ...suggestedUsers]) {
      map.set(user.id, user);
    }
    return map;
  }, [currentUser, suggestedUsers]);

  const friends = useMemo(
    () =>
      suggestedUsers
        .filter((user) => user.followStatus === "accepted" || user.isFollowing)
        .sort((a, b) => b.currentStreak - a.currentStreak)
        .slice(0, 14),
    [suggestedUsers],
  );

  const conversationItems = useMemo<ConversationItem[]>(() => {
    const messagesByConversation = new Map<string, ChatMessage[]>();
    const legacyDirect = new Map<string, ChatMessage[]>();

    for (const message of safeMessages) {
      if (message.conversationId) {
        const list = messagesByConversation.get(message.conversationId) ?? [];
        list.push(message);
        messagesByConversation.set(message.conversationId, list);
        continue;
      }
      const otherId = getOtherUserId(message, currentUser.id);
      if (!otherId) continue;
      const list = legacyDirect.get(otherId) ?? [];
      list.push(message);
      legacyDirect.set(otherId, list);
    }

    const items = safeConversations
      .map<ConversationItem | null>((conversation) => {
        const rawMessages = messagesByConversation.get(conversation.id) ?? [];
        const sortedMessages = [...rawMessages].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        const last = sortedMessages.at(-1) ?? null;
        if (conversation.type === "group") {
          const members = conversation.memberIds
            .filter((id) => id !== currentUser.id)
            .map((id) => usersById.get(id))
            .filter((user): user is EnrichedUser => Boolean(user));
          const lastReadAt = conversation.lastReadAt
            ? new Date(conversation.lastReadAt).getTime()
            : 0;
          const unread = sortedMessages.filter(
            (message) =>
              message.senderId !== currentUser.id &&
              new Date(message.createdAt).getTime() > lastReadAt,
          ).length;
          return {
            id: conversation.id,
            type: "group" as const,
            user: null,
            members,
            name: getGroupName(members, conversation.name),
            imageUrl: conversation.imageUrl,
            messages: sortedMessages,
            last,
            unread,
            lastReadAt: conversation.lastReadAt,
          };
        }

        const otherUserId =
          conversation.memberIds.find((id) => id !== currentUser.id) ??
          (last ? getOtherUserId(last, currentUser.id) : null);
        const user = otherUserId ? usersById.get(otherUserId) ?? null : null;
        if (!user) return null;
        const unread = sortedMessages.filter(
          (message) => message.receiverId === currentUser.id && !message.readAt,
        ).length;
        return {
          id: conversation.id,
          type: "direct" as const,
          user,
          members: [user],
          name: user.name,
          imageUrl: user.avatarUrl,
          messages: sortedMessages,
          last,
          unread,
          lastReadAt: conversation.lastReadAt,
        };
      })
      .filter((item): item is ConversationItem => Boolean(item));

    const knownDirectUserIds = new Set(
      items
        .filter((item) => item.type === "direct" && item.user)
        .map((item) => item.user?.id),
    );
    for (const [userId, threadMessages] of legacyDirect.entries()) {
      if (knownDirectUserIds.has(userId)) continue;
      const user = usersById.get(userId);
      if (!user) continue;
      const sortedMessages = [...threadMessages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      const last = sortedMessages.at(-1) ?? null;
      items.push({
        id: null,
        type: "direct",
        user,
        members: [user],
        name: user.name,
        imageUrl: user.avatarUrl,
        messages: sortedMessages,
        last,
        unread: sortedMessages.filter(
          (message) => message.receiverId === currentUser.id && !message.readAt,
        ).length,
        lastReadAt: null,
      });
    }

    return items.sort((a, b) => {
      const aTime =
        (a.last ? new Date(a.last.createdAt).getTime() : 0) ||
        (a.lastReadAt ? new Date(a.lastReadAt).getTime() : 0);
      const bTime =
        (b.last ? new Date(b.last.createdAt).getTime() : 0) ||
        (b.lastReadAt ? new Date(b.lastReadAt).getTime() : 0);
      return bTime - aTime || b.unread - a.unread;
    });
  }, [currentUser.id, safeConversations, safeMessages, usersById]);

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

  const hasControlledSelectedUserId = controlledSelectedUserId !== undefined;
  const selectedUserId = hasControlledSelectedUserId
    ? controlledSelectedUserId
    : internalSelectedUserId;
  const selectedDirectItem = selectedUserId
    ? conversationItems.find(
        (item) => item.type === "direct" && item.user?.id === selectedUserId,
      )
    : null;
  const selectedAdHocUser =
    selectedUserId && !selectedDirectItem ? usersById.get(selectedUserId) ?? null : null;
  const selectedConversation = selectedConversationId
    ? conversationItems.find((item) => item.id === selectedConversationId) ?? null
    : null;
  const selectedThread = useMemo<ConversationItem | null>(() => {
    if (selectedConversation) return selectedConversation;
    if (selectedDirectItem) return selectedDirectItem;
    if (!selectedAdHocUser) return null;
    return {
      id: null,
      type: "direct",
      user: selectedAdHocUser,
      members: [selectedAdHocUser],
      name: selectedAdHocUser.name,
      imageUrl: selectedAdHocUser.avatarUrl,
      messages: [],
      last: null,
      unread: 0,
      lastReadAt: null,
    };
  }, [selectedAdHocUser, selectedConversation, selectedDirectItem]);

  useEffect(() => {
    onThreadViewChange?.(Boolean(selectedThread));
    return () => onThreadViewChange?.(false);
  }, [onThreadViewChange, selectedThread]);

  useEffect(() => {
    if (!selectedThread || selectedThread.unread === 0) return;
    if (selectedThread.type === "group" && selectedThread.id) {
      void onConversationOpen?.(selectedThread.id);
      return;
    }
    if (selectedThread.user) void onThreadOpen?.(selectedThread.user.id);
  }, [onConversationOpen, onThreadOpen, selectedThread]);

  useEffect(() => {
    if (!selectedThread) return;
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [selectedThread, selectedThread?.messages.length]);

  function setSelectedUser(userId: string | null) {
    if (onSelectedUserIdChange) onSelectedUserIdChange(userId);
    else setInternalSelectedUserId(userId);
  }

  function openDirectThread(userId: string) {
    const existing = conversationItems.find(
      (item) => item.type === "direct" && item.user?.id === userId,
    );
    setSelectedConversationId(existing?.id ?? null);
    setSelectedUser(userId);
    setGroupComposerOpen(false);
    setChatQuery("");
    setError(null);
  }

  function openConversation(conversation: ConversationItem) {
    setSelectedConversationId(conversation.id);
    setSelectedUser(conversation.type === "direct" ? conversation.user?.id ?? null : null);
    setGroupComposerOpen(false);
    setChatQuery("");
    setError(null);
  }

  function closeThread() {
    setSelectedConversationId(null);
    setSelectedUser(null);
  }

  function toggleGroupMember(userId: string) {
    setSelectedGroupMemberIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  async function createGroup() {
    if (!onCreateGroupConversation || selectedGroupMemberIds.length === 0 || sending) return;
    setSending(true);
    setError(null);
    try {
      const conversationId = await onCreateGroupConversation({
        name: groupName.trim() || "Grupo Gym Circle",
        memberIds: selectedGroupMemberIds,
      });
      setSelectedConversationId(conversationId);
      setSelectedUser(null);
      setGroupName("");
      setSelectedGroupMemberIds([]);
      setGroupComposerOpen(false);
    } catch (err) {
      setError((err as Error).message ?? "Falha ao criar grupo");
    } finally {
      setSending(false);
    }
  }

  async function deleteConversation(conversation: ConversationItem) {
    if (deletingConversationId || deletingUserId) return;
    setError(null);
    try {
      if (conversation.id && onDeleteConversationById) {
        setDeletingConversationId(conversation.id);
        await onDeleteConversationById(conversation.id);
        if (selectedConversationId === conversation.id) closeThread();
        return;
      }
      if (conversation.user && onDeleteConversation) {
        setDeletingUserId(conversation.user.id);
        await onDeleteConversation(conversation.user.id);
        if (selectedUserId === conversation.user.id) closeThread();
      }
    } catch (err) {
      setError((err as Error).message ?? "Falha ao apagar conversa");
    } finally {
      setDeletingConversationId(null);
      setDeletingUserId(null);
    }
  }

  async function send(input: Omit<SendChatMessageInput, "receiverId" | "conversationId">) {
    if (!selectedThread || !onSendMessage || sending) return;
    setSending(true);
    setError(null);
    try {
      if (selectedThread.type === "group" && selectedThread.id) {
        await onSendMessage({ conversationId: selectedThread.id, ...input });
      } else if (selectedThread.user) {
        await onSendMessage({ receiverId: selectedThread.user.id, ...input });
      }
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
    if (!file || !selectedThread || !onSendMessage || sending) return;
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
      if (selectedThread.type === "group" && selectedThread.id) {
        await onSendMessage({ conversationId: selectedThread.id, mediaUrl, mediaType });
      } else if (selectedThread.user) {
        await onSendMessage({ receiverId: selectedThread.user.id, mediaUrl, mediaType });
      }
    } catch (err) {
      setError((err as Error).message ?? "Falha ao enviar mídia");
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  if (selectedThread) {
    return (
      <ConversationView
        currentUser={currentUser}
        draft={draft}
        error={error}
        fileRef={fileRef}
        cameraRef={cameraRef}
        onBack={closeThread}
        onDraftChange={setDraft}
        onMedia={handleMedia}
        onQuickReaction={() => send({ body: "🔥" })}
        onSelectUser={onSelectUser}
        onSubmit={submit}
        sending={sending}
        thread={selectedThread}
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
          label="Novo grupo"
          onClick={() => setGroupComposerOpen((value) => !value)}
        >
          {groupComposerOpen ? <X size={18} /> : <PenLine size={18} />}
        </IconButton>
      </div>
      {error ? (
        <p className="mt-3 px-2 text-[12px] font-bold text-[var(--gc-pink)]">{error}</p>
      ) : null}

      {groupComposerOpen ? (
        <GroupComposer
          candidates={chatQuery.trim() ? searchResults : friends}
          disabled={!onCreateGroupConversation || sending}
          groupName={groupName}
          onCreate={createGroup}
          onGroupNameChange={setGroupName}
          onToggleMember={toggleGroupMember}
          selectedIds={selectedGroupMemberIds}
        />
      ) : null}

      {friends.length > 0 ? (
        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="text-[12px] font-black uppercase tracking-[0.08em] text-white/42">
              Amigos
            </p>
            <span className="text-[11px] font-black text-white/34">seguindo</span>
          </div>
          <div className="gc-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-1">
            {friends.map((person) => (
              <button
                className="gc-pressable w-[70px] shrink-0 text-center"
                key={person.id}
                onClick={() =>
                  groupComposerOpen ? toggleGroupMember(person.id) : openDirectThread(person.id)
                }
                type="button"
              >
                <div className="relative mx-auto size-14">
                  <div
                    className={[
                      "rounded-full p-[2px]",
                      selectedGroupMemberIds.includes(person.id)
                        ? "bg-[var(--gc-brand)]"
                        : "bg-white/[0.1]",
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

      {chatQuery.trim() && !groupComposerOpen ? (
        <section className="mt-5 space-y-2">
          <p className="px-1 text-[12px] font-black uppercase tracking-[0.08em] text-white/42">
            Resultados
          </p>
          {searchResults.length > 0 ? (
            searchResults.map((user) => (
              <UserSearchRow key={user.id} onOpen={openDirectThread} user={user} />
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
            {conversationItems.length > 0 ? (
              <span className="text-[11px] font-black text-white/34">
                {conversationItems.length}
              </span>
            ) : null}
          </div>
          {loading ? (
            <ChatSkeleton />
          ) : conversationItems.length > 0 ? (
            <div className="space-y-1">
              {conversationItems.map((conversation) => (
                <ConversationRow
                  conversation={conversation}
                  currentUserId={currentUser.id}
                  deleting={
                    Boolean(conversation.id && deletingConversationId === conversation.id) ||
                    Boolean(conversation.user && deletingUserId === conversation.user.id)
                  }
                  key={conversation.id ?? conversation.user?.id ?? conversation.name}
                  onDelete={
                    onDeleteConversationById || onDeleteConversation
                      ? deleteConversation
                      : undefined
                  }
                  onOpen={openConversation}
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
              detail="Busque um @username ou crie um grupo para combinar treino."
              title="Nenhuma conversa ainda"
            />
          )}
        </section>
      )}
    </section>
  );
}

function GroupComposer({
  candidates,
  disabled,
  groupName,
  onCreate,
  onGroupNameChange,
  onToggleMember,
  selectedIds,
}: {
  candidates: EnrichedUser[];
  disabled: boolean;
  groupName: string;
  onCreate: () => void;
  onGroupNameChange: (value: string) => void;
  onToggleMember: (userId: string) => void;
  selectedIds: string[];
}) {
  return (
    <section className="mt-4 rounded-[28px] border border-white/[0.08] bg-white/[0.045] p-3 backdrop-blur-2xl">
      <div className="flex items-center gap-2">
        <div className="grid size-11 place-items-center rounded-full bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
          <Users size={18} />
        </div>
        <input
          className="h-11 min-w-0 flex-1 rounded-full bg-black/30 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
          onChange={(event) => onGroupNameChange(event.target.value)}
          placeholder="Nome do grupo"
          value={groupName}
        />
        <button
          className="gc-pressable grid size-11 place-items-center rounded-full bg-[var(--gc-brand)] text-black disabled:opacity-40"
          disabled={disabled || selectedIds.length === 0}
          onClick={onCreate}
          type="button"
        >
          <Check size={18} strokeWidth={2.7} />
        </button>
      </div>
      <div className="gc-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {candidates.length > 0 ? (
          candidates.map((user) => (
            <button
              className={[
                "gc-pressable inline-flex shrink-0 items-center gap-2 rounded-full border px-2 py-1.5",
                selectedIds.includes(user.id)
                  ? "border-[var(--gc-brand)] bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]"
                  : "border-white/[0.08] bg-black/28 text-white/68",
              ].join(" ")}
              key={user.id}
              onClick={() => onToggleMember(user.id)}
              type="button"
            >
              <Avatar
                accent={user.accent}
                name={user.name}
                size="sm"
                src={user.avatarUrl ?? undefined}
              />
              <span className="max-w-[96px] truncate text-[12px] font-black">
                {user.username}
              </span>
            </button>
          ))
        ) : (
          <p className="px-2 py-2 text-[12px] font-bold text-white/38">
            Busque por @username para adicionar pessoas.
          </p>
        )}
      </div>
    </section>
  );
}

type ConversationRowProps = {
  conversation: ConversationItem;
  currentUserId: string;
  deleting?: boolean;
  onDelete?: (conversation: ConversationItem) => void;
  onOpen: (conversation: ConversationItem) => void;
};

function ConversationRow({
  conversation,
  currentUserId,
  deleting = false,
  onDelete,
  onOpen,
}: ConversationRowProps) {
  const { last, unread } = conversation;
  const mine = last?.senderId === currentUserId;
  const content = (
    <button
      className="gc-pressable flex w-full min-w-0 items-center gap-3 px-2 py-3 text-left"
      onClick={() => onOpen(conversation)}
      type="button"
    >
      <div className="relative shrink-0">
        {conversation.type === "group" ? (
          <GroupAvatar members={conversation.members} imageUrl={conversation.imageUrl} />
        ) : conversation.user ? (
          <Avatar
            accent={conversation.user.accent}
            name={conversation.user.name}
            src={conversation.user.avatarUrl ?? undefined}
          />
        ) : null}
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-[var(--gc-brand)] text-[10px] font-black text-black shadow-[0_0_18px_rgba(92,232,255,0.28)]">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[15px] font-black text-white">{conversation.name}</p>
          {conversation.user ? (
            <StreakBadge
              isLit={conversation.user.streakLitToday}
              size="xs"
              streak={conversation.user.currentStreak}
            />
          ) : (
            <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-black text-white/44">
              grupo
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[12px] font-bold text-white/44">
          {mine ? "Você: " : ""}
          {getMessagePreview(last)}
        </p>
        <p className="mt-0.5 truncate text-[11px] font-bold text-white/30">
          {conversation.type === "group"
            ? conversation.members.map((member) => `@${member.username}`).join(", ")
            : conversation.user
              ? `@${conversation.user.username}`
              : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-[11px] font-black text-white/34">
          {formatMessageTime(last?.createdAt)}
        </span>
        <span
          className={[
            "size-2 rounded-full",
            unread > 0
              ? "bg-[var(--gc-brand)] shadow-[0_0_14px_rgba(92,232,255,0.48)]"
              : "bg-transparent",
          ].join(" ")}
        />
      </div>
    </button>
  );

  if (!onDelete) return content;

  return (
    <SwipeRevealDelete
      className="rounded-[26px]"
      contentClassName="rounded-[26px] bg-black transition-colors hover:bg-white/[0.045]"
      deleteLabel={`Apagar conversa ${conversation.name}`}
      disabled={deleting}
      onDelete={() => onDelete(conversation)}
      revealWidth={74}
    >
      {content}
    </SwipeRevealDelete>
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
  sending: boolean;
  thread: ConversationItem;
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
  sending,
  thread,
  threadEndRef,
  uploadDisabled,
}: ConversationViewProps) {
  const headerUser = thread.user;
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
          onClick={() => headerUser && onSelectUser?.(headerUser.id)}
          type="button"
        >
          {thread.type === "group" ? (
            <GroupAvatar members={thread.members} imageUrl={thread.imageUrl} />
          ) : headerUser ? (
            <Avatar
              accent={headerUser.accent}
              name={headerUser.name}
              src={headerUser.avatarUrl ?? undefined}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-[15px] font-black text-white">{thread.name}</p>
              {headerUser ? (
                <StreakBadge
                  isLit={headerUser.streakLitToday}
                  size="xs"
                  streak={headerUser.currentStreak}
                />
              ) : null}
            </div>
            <p className="truncate text-[12px] font-bold text-white/42">
              {headerUser
                ? `@${headerUser.username} · ${getStatusCopy(headerUser)}`
                : `${thread.members.length + 1} pessoas no grupo`}
            </p>
          </div>
        </button>
      </header>

      <div className="flex-1 space-y-3 px-1 py-5">
        {thread.messages.length > 0 ? (
          thread.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              mine={message.senderId === currentUser.id}
              sender={thread.type === "group" ? thread.members.find((m) => m.id === message.senderId) : undefined}
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
                Envie uma mensagem ou mídia para combinar treino.
              </p>
            </div>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      <form
        className="sticky bottom-[calc(var(--gc-safe-bottom)+0.5rem)] z-30 flex items-center gap-2 rounded-[28px] border border-white/[0.08] bg-[#111214]/92 p-2 shadow-[0_18px_54px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
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

function GroupAvatar({
  imageUrl,
  members,
}: {
  imageUrl: string | null;
  members: EnrichedUser[];
}) {
  if (imageUrl) {
    return (
      <div className="relative size-12 overflow-hidden rounded-full bg-white/[0.08]">
        <Image alt="Grupo" className="object-cover" fill sizes="48px" src={imageUrl} />
      </div>
    );
  }
  const first = members[0];
  const second = members[1];
  return (
    <div className="relative grid size-12 place-items-center rounded-full bg-white/[0.06]">
      {first ? (
        <div className="absolute left-1 top-1">
          <Avatar
            accent={first.accent}
            name={first.name}
            size="sm"
            src={first.avatarUrl ?? undefined}
          />
        </div>
      ) : null}
      {second ? (
        <div className="absolute bottom-1 right-1">
          <Avatar
            accent={second.accent}
            name={second.name}
            size="sm"
            src={second.avatarUrl ?? undefined}
          />
        </div>
      ) : (
        <Users size={18} className="text-white/54" />
      )}
    </div>
  );
}

function MessageBubble({
  message,
  mine,
  sender,
}: {
  message: ChatMessage;
  mine: boolean;
  sender?: EnrichedUser;
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
        {!mine && sender ? (
          <p className="mb-1 text-[10px] font-black text-white/34">@{sender.username}</p>
        ) : null}
        {message.storyId && message.storyPreviewUrl ? (
          <div
            className={[
              "mb-2 overflow-hidden rounded-[18px] border p-2",
              mine
                ? "border-black/10 bg-black/10"
                : "border-white/[0.08] bg-black/24",
            ].join(" ")}
          >
            <div className="relative h-24 w-36 overflow-hidden rounded-[14px] bg-black/24">
              <Image
                alt={message.replyToStory ? "Story respondido" : "Story compartilhado"}
                className="object-cover"
                fill
                sizes="144px"
                src={message.storyPreviewUrl}
              />
            </div>
            <p
              className={[
                "mt-2 text-[11px] font-black",
                mine ? "text-black/54" : "text-white/48",
              ].join(" ")}
            >
              {message.replyToStory ? "Resposta ao story" : "Story compartilhado"}
            </p>
          </div>
        ) : null}
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

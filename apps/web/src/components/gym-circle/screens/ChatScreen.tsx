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
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { EmptyState, StreakBadge, SwipeRevealDelete } from "../design-system";
import type {
  ChatConversation,
  ChatMessage,
  EnrichedUser,
  SendChatMessageInput,
} from "../social/types";
import {
  filterKnownChatUsers,
  mergeChatUsers,
  normalizeChatSearchQuery,
} from "../social/chatSearch";
import { TopBar } from "../TopBar";

type ChatScreenProps = {
  currentUser: EnrichedUser;
  suggestedUsers: EnrichedUser[];
  knownUsers?: EnrichedUser[];
  messages?: ChatMessage[];
  conversations?: ChatConversation[];
  selectedUserId?: string | null;
  selectedUser?: EnrichedUser | null;
  loading?: boolean;
  onSelectedUserIdChange?: (userId: string | null) => void;
  onSelectUser?: (userId: string) => void;
  onSearchUsers?: (query: string) => Promise<EnrichedUser[]>;
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

// t function type (matches react-i18next's TFunction return signature)
type TFn = (key: string, options?: Record<string, unknown>) => string;

function formatMessageTime(createdAt: string | null | undefined, locale: string): string {
  if (!createdAt) return "";
  // Use current i18n locale for time formatting (en uses 12h, pt-BR uses 24h by default)
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function getMessagePreview(message: ChatMessage | null, t: TFn): string {
  if (!message) return t("chatScreen.messagePreview.empty");
  if (message.replyToStory) return t("chatScreen.messagePreview.storyReply");
  if (message.storyId) return t("chatScreen.messagePreview.storyShare");
  if (message.body) return message.body;
  if (message.mediaType === "video") return t("chatScreen.messagePreview.videoSent");
  if (message.mediaUrl) return t("chatScreen.messagePreview.photoSent");
  return t("chatScreen.messagePreview.fallback");
}

function getStatusCopy(user: EnrichedUser, t: TFn): string {
  return user.streakLitToday
    ? t("chatScreen.userStatus.trainedToday")
    : t("chatScreen.userStatus.notLit");
}

function getOtherUserId(message: ChatMessage, currentUserId: string): string | null {
  return message.senderId === currentUserId ? message.receiverId : message.senderId;
}

function getGroupName(members: EnrichedUser[], t: TFn, fallback?: string | null): string {
  if (fallback?.trim()) return fallback.trim();
  if (members.length === 0) return t("chatScreen.groupComposer.defaultGroupName");
  return members
    .slice(0, 3)
    .map((member) => member.name.split(" ")[0])
    .join(", ");
}

export function ChatScreen({
  currentUser,
  suggestedUsers,
  knownUsers = [],
  messages,
  conversations,
  selectedUserId: controlledSelectedUserId,
  selectedUser,
  loading: loadingProp,
  onSelectedUserIdChange,
  onSelectUser,
  onSearchUsers,
  onSendMessage,
  onCreateGroupConversation,
  onDeleteConversation,
  onDeleteConversationById,
  onThreadOpen,
  onConversationOpen,
  onThreadViewChange,
  onUploadImage,
}: ChatScreenProps) {
  const { t } = useTranslation();
  const safeMessages = useMemo(() => messages ?? [], [messages]);
  const safeConversations = useMemo(() => conversations ?? [], [conversations]);
  const loading = loadingProp ?? messages === undefined;
  const [internalSelectedUserId, setInternalSelectedUserId] = useState<string | null>(null);
  const [selectedDirectUser, setSelectedDirectUser] = useState<EnrichedUser | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [groupComposerOpen, setGroupComposerOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([]);
  const [chatQuery, setChatQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingSearchQuery, setPendingSearchQuery] = useState<string | null>(null);
  const [remoteSearch, setRemoteSearch] = useState<{
    query: string;
    users: EnrichedUser[];
  }>({ query: "", users: [] });
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  // Sprint 3 — Fase 3.4: ref do container scroll da lista de mensagens.
  // Necessário pra scroll programático sem usar `scrollIntoView({block:"end"})`,
  // que em iOS WebView faz o body inteiro pular quando o teclado anima e
  // causa o sintoma "conversa se mexendo sozinha".
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const normalizedChatQuery = useMemo(
    () => normalizeChatSearchQuery(chatQuery),
    [chatQuery],
  );

  const seedUsers = useMemo(
    () =>
      mergeChatUsers(
        [currentUser],
        knownUsers,
        suggestedUsers,
        selectedUser ? [selectedUser] : [],
        selectedDirectUser ? [selectedDirectUser] : [],
      ),
    [currentUser, knownUsers, selectedDirectUser, selectedUser, suggestedUsers],
  );

  const localSearchResults = useMemo(
    () => filterKnownChatUsers(seedUsers, currentUser.id, normalizedChatQuery),
    [currentUser.id, normalizedChatQuery, seedUsers],
  );

  useEffect(() => {
    if (!normalizedChatQuery || !onSearchUsers) return;

    let cancelled = false;
    const searchId = window.setTimeout(() => {
      setPendingSearchQuery(normalizedChatQuery);
      setError(null);
      void onSearchUsers(normalizedChatQuery)
        .then((users) => {
          if (!cancelled) setRemoteSearch({ query: normalizedChatQuery, users });
        })
        .catch((err) => {
          if (!cancelled) {
            setRemoteSearch({ query: normalizedChatQuery, users: [] });
            setError((err as Error).message || t("chatScreen.errors.searchUsers"));
          }
        })
        .finally(() => {
          if (!cancelled) setPendingSearchQuery(null);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(searchId);
    };
  }, [normalizedChatQuery, onSearchUsers, t]);

  const remoteSearchResults = useMemo(
    () => (remoteSearch.query === normalizedChatQuery ? remoteSearch.users : []),
    [normalizedChatQuery, remoteSearch],
  );
  const isSearchingCurrentQuery = pendingSearchQuery === normalizedChatQuery;

  const searchResults = useMemo(
    () =>
      mergeChatUsers(remoteSearchResults, localSearchResults)
        .filter((user) => user.id !== currentUser.id)
        .slice(0, 12),
    [currentUser.id, localSearchResults, remoteSearchResults],
  );

  const usersById = useMemo(() => {
    const map = new Map<string, EnrichedUser>();
    for (const user of mergeChatUsers(seedUsers, searchResults)) {
      map.set(user.id, user);
    }
    return map;
  }, [searchResults, seedUsers]);

  const friends = useMemo(
    () =>
      seedUsers
        .filter((user) => user.id !== currentUser.id)
        .filter((user) => user.followStatus === "accepted" || user.isFollowing)
        .sort((a, b) => b.currentStreak - a.currentStreak)
        .slice(0, 14),
    [currentUser.id, seedUsers],
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
          const unread = conversation.unreadCount ?? sortedMessages.filter(
            (message) =>
              message.senderId !== currentUser.id &&
              new Date(message.createdAt).getTime() > lastReadAt,
          ).length;
          return {
            id: conversation.id,
            type: "group" as const,
            user: null,
            members,
            name: getGroupName(members, t, conversation.name),
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
        const unread = conversation.unreadCount ?? sortedMessages.filter(
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
  }, [currentUser.id, safeConversations, safeMessages, t, usersById]);

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

  const selectedThreadType = selectedThread?.type ?? null;
  const selectedConversationOpenId =
    selectedThreadType === "group" ? selectedThread?.id ?? null : null;
  const selectedDirectOpenUserId =
    selectedThreadType === "direct" ? selectedThread?.user?.id ?? null : null;

  useEffect(() => {
    if (selectedConversationOpenId) {
      void onConversationOpen?.(selectedConversationOpenId);
      return;
    }
    if (selectedDirectOpenUserId) void onThreadOpen?.(selectedDirectOpenUserId);
  }, [
    onConversationOpen,
    onThreadOpen,
    selectedConversationOpenId,
    selectedDirectOpenUserId,
  ]);

  useEffect(() => {
    if (!selectedThread) return;
    // Scroll manual no container interno (não no body) pra não mexer no
    // layout quando o teclado iOS anima. requestAnimationFrame garante que
    // o novo conteúdo já foi pintado antes de medirmos `scrollHeight`.
    const node = messagesContainerRef.current;
    if (!node) return;
    const raf = window.requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [selectedThread, selectedThread?.messages.length]);

  function setSelectedUser(userId: string | null) {
    if (onSelectedUserIdChange) onSelectedUserIdChange(userId);
    else setInternalSelectedUserId(userId);
  }

  function openDirectThread(userId: string) {
    const existing = conversationItems.find(
      (item) => item.type === "direct" && item.user?.id === userId,
    );
    setSelectedDirectUser(existing?.user ?? usersById.get(userId) ?? null);
    setSelectedConversationId(existing?.id ?? null);
    setSelectedUser(userId);
    setGroupComposerOpen(false);
    setChatQuery("");
    setError(null);
  }

  function openConversation(conversation: ConversationItem) {
    setSelectedConversationId(conversation.id);
    setSelectedDirectUser(conversation.type === "direct" ? conversation.user : null);
    setSelectedUser(conversation.type === "direct" ? conversation.user?.id ?? null : null);
    setGroupComposerOpen(false);
    setChatQuery("");
    setError(null);
  }

  function closeThread() {
    setSelectedConversationId(null);
    setSelectedDirectUser(null);
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
        name: groupName.trim() || t("chatScreen.groupComposer.defaultGroupName"),
        memberIds: selectedGroupMemberIds,
      });
      setSelectedConversationId(conversationId);
      setSelectedUser(null);
      setGroupName("");
      setSelectedGroupMemberIds([]);
      setGroupComposerOpen(false);
    } catch (err) {
      setError((err as Error).message ?? t("chatScreen.errors.createGroup"));
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
      setError((err as Error).message ?? t("chatScreen.errors.deleteConversation"));
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
      setError((err as Error).message ?? t("chatScreen.errors.send"));
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
      setError(t("chatScreen.media.uploadInvalidType"));
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
      setError((err as Error).message ?? t("chatScreen.errors.sendMedia"));
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
        messagesContainerRef={messagesContainerRef}
        sending={sending}
        thread={selectedThread}
        threadEndRef={threadEndRef}
        uploadDisabled={!onSendMessage || sending}
      />
    );
  }

  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar
        eyebrow={t("chatScreen.topBar.eyebrow")}
        title={t("chatScreen.topBar.title")}
      />

      <div className="mt-5 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.055] px-4 backdrop-blur-2xl">
          <Search size={16} className="text-white/42" />
          <input
            className="h-12 min-w-0 flex-1 bg-transparent text-[14px] font-bold text-white outline-none placeholder:text-white/28"
            onChange={(event) => setChatQuery(event.target.value)}
            placeholder={t("chatScreen.search.placeholder")}
            ref={searchRef}
            type="search"
            value={chatQuery}
          />
        </div>
        <IconButton
          className="size-12 border-[var(--gc-brand)]/20 bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]"
          label={t("chatScreen.search.newGroupAria")}
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
          loading={isSearchingCurrentQuery}
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
              {t("chatScreen.sections.friends")}
            </p>
            <span className="text-[11px] font-black text-white/34">
              {t("chatScreen.sections.following")}
            </span>
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
            {t("chatScreen.sections.results")}
          </p>
          {searchResults.length > 0 ? (
            searchResults.map((user) => (
              <UserSearchRow key={user.id} onOpen={openDirectThread} user={user} />
            ))
          ) : isSearchingCurrentQuery ? (
            <EmptyState
              detail={t("chatScreen.empty.searchingDetail")}
              title={t("chatScreen.empty.searchingTitle")}
            />
          ) : (
            <EmptyState
              detail={t("chatScreen.empty.noUsersDetail")}
              title={t("chatScreen.empty.noUsersTitle")}
            />
          )}
        </section>
      ) : (
        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="text-[12px] font-black uppercase tracking-[0.08em] text-white/42">
              {t("chatScreen.sections.conversations")}
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
                  {t("chatScreen.empty.newConversationCta")}
                </button>
              }
              detail={t("chatScreen.empty.noConversationsDetail")}
              title={t("chatScreen.empty.noConversationsTitle")}
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
  loading = false,
  onCreate,
  onGroupNameChange,
  onToggleMember,
  selectedIds,
}: {
  candidates: EnrichedUser[];
  disabled: boolean;
  groupName: string;
  loading?: boolean;
  onCreate: () => void;
  onGroupNameChange: (value: string) => void;
  onToggleMember: (userId: string) => void;
  selectedIds: string[];
}) {
  const { t } = useTranslation();
  return (
    <section className="mt-4 rounded-[28px] border border-white/[0.08] bg-white/[0.045] p-3 backdrop-blur-2xl">
      <div className="flex items-center gap-2">
        <div className="grid size-11 place-items-center rounded-full bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
          <Users size={18} />
        </div>
        <input
          className="h-11 min-w-0 flex-1 rounded-full bg-black/30 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
          onChange={(event) => onGroupNameChange(event.target.value)}
          placeholder={t("chatScreen.groupComposer.namePlaceholder")}
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
        ) : loading ? (
          <p className="px-2 py-2 text-[12px] font-bold text-white/38">
            {t("chatScreen.groupComposer.loading")}
          </p>
        ) : (
          <p className="px-2 py-2 text-[12px] font-bold text-white/38">
            {t("chatScreen.groupComposer.prompt")}
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
  const { t, i18n } = useTranslation();
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
              {t("chatScreen.groupComposer.groupBadge")}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[12px] font-bold text-white/44">
          {mine ? t("chatScreen.messagePreview.yourPrefix") : ""}
          {getMessagePreview(last, t)}
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
          {formatMessageTime(last?.createdAt, i18n.language)}
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
      deleteLabel={t("chatScreen.conversation.deleteAria", { name: conversation.name })}
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
  const { t } = useTranslation();
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
        {t("chatScreen.conversation.messageCta")}
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
  messagesContainerRef: RefObject<HTMLDivElement | null>;
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
  messagesContainerRef,
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
  const { t } = useTranslation();
  const headerUser = thread.user;
  return (
    // Sprint 3 — Fase 3.4: refactor anti-teclado-voando.
    // `h-[100dvh]` (dynamic viewport) shrinka com o teclado iOS 16+ em vez de
    // ficar fixo em 100vh do viewport original. Combinado com o
    // `overflow-y-auto` no container interno de mensagens (abaixo) e o form
    // como last-child do flex column (sem `sticky bottom`), o input fica
    // naturalmente preso ao fim do flex container e sobe junto com o
    // teclado — sem hack de cálculo manual.
    <section className="gc-screen-enter flex h-[100dvh] flex-col px-3">
      <header className="shrink-0 -mx-3 flex items-center gap-3 border-b border-white/[0.06] bg-black/82 px-4 pb-3 pt-[calc(var(--gc-safe-top)+14px)] backdrop-blur-2xl">
        <button
          aria-label={t("chatScreen.conversation.backAria")}
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
                ? `@${headerUser.username} · ${getStatusCopy(headerUser, t)}`
                : t("chatScreen.conversation.groupMembersCount", {
                    count: thread.members.length + 1,
                  })}
            </p>
          </div>
        </button>
      </header>

      <div
        ref={messagesContainerRef}
        className="flex-1 space-y-3 overflow-y-auto px-1 py-5"
      >
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
          <div className="grid h-full place-items-center text-center">
            <div>
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--gc-brand)]/12 text-[var(--gc-brand)] shadow-[0_0_28px_rgba(92,232,255,0.16)]">
                <MessageCircle size={24} />
              </div>
              <p className="mt-4 text-[18px] font-black">
                {t("chatScreen.emptyThread.title")}
              </p>
              <p className="mx-auto mt-2 max-w-[260px] text-[13px] font-bold leading-5 text-white/44">
                {t("chatScreen.emptyThread.detail")}
              </p>
            </div>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      <form
        className="shrink-0 mt-2 mb-[calc(var(--gc-safe-bottom)+0.5rem)] flex items-center gap-2 rounded-[28px] border border-white/[0.08] bg-[#111214]/92 p-2 shadow-[0_18px_54px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
        onSubmit={onSubmit}
      >
        <IconButton
          className="size-10 border-white/[0.08] bg-white/[0.055]"
          disabled={uploadDisabled}
          label={t("chatScreen.conversation.openCameraAria")}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera size={17} />
        </IconButton>
        <IconButton
          className="size-10 border-white/[0.08] bg-white/[0.055]"
          disabled={uploadDisabled}
          label={t("chatScreen.conversation.openGalleryAria")}
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
          aria-label={t("chatScreen.conversation.messageAria")}
          className="h-10 min-w-0 flex-1 rounded-full bg-white/[0.06] px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
          enterKeyHint="send"
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={t("chatScreen.conversation.messagePlaceholder")}
          value={draft}
        />
        {draft.trim() ? (
          <button
            aria-label={t("chatScreen.conversation.sendAria")}
            className="gc-pressable grid size-11 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)] text-black disabled:opacity-50"
            disabled={sending}
            type="submit"
          >
            <Send size={16} strokeWidth={2.7} />
          </button>
        ) : (
          <button
            aria-label={t("chatScreen.conversation.reactAria")}
            className="gc-pressable grid size-11 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)]/12 text-[var(--gc-brand)] disabled:opacity-50"
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
  const { t } = useTranslation();
  if (imageUrl) {
    return (
      <div className="relative size-12 overflow-hidden rounded-full bg-white/[0.08]">
        <Image
          alt={t("chatScreen.media.groupAlt")}
          className="object-cover"
          fill
          sizes="48px"
          src={imageUrl}
        />
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
  const { t, i18n } = useTranslation();
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
                alt={t(
                  message.replyToStory
                    ? "chatScreen.story.replyAlt"
                    : "chatScreen.story.shareAlt",
                )}
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
              {t(
                message.replyToStory
                  ? "chatScreen.story.replyLabel"
                  : "chatScreen.story.shareLabel",
              )}
            </p>
          </div>
        ) : null}
        {message.mediaUrl && message.mediaType === "video" ? (
          <video
            className="mb-1 aspect-square w-48 rounded-[18px] bg-black/20 object-cover"
            controls
            playsInline
            poster={message.posterUrl ?? message.thumbnailUrl ?? undefined}
            preload="metadata"
            src={message.mediaUrl}
          />
        ) : message.mediaUrl ? (
          <div className="relative mb-1 aspect-square w-48 overflow-hidden rounded-[18px] bg-black/20">
            <Image
              alt={t("chatScreen.media.chatAlt")}
              className="object-cover"
              fill
              sizes="192px"
              src={message.thumbnailUrl ?? message.mediaUrl}
            />
          </div>
        ) : null}
        {message.body ? <p>{message.body}</p> : null}
        <p className={["mt-1 text-[10px] font-black", mine ? "text-black/42" : "text-white/32"].join(" ")}>
          {formatMessageTime(message.createdAt, i18n.language)}
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

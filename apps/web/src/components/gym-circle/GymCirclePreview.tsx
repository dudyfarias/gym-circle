"use client";

import { type TouchEvent, useCallback, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { FloatingCreatePostButton, StoryViewer, ToastFeedback } from "./design-system";
import { BottomNav, type ScreenKey } from "./BottomNav";
import { CheckInScreen } from "./screens/CheckInScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { FeedScreen } from "./screens/FeedScreen";
import { PostScreen } from "./screens/PostScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { SearchSheetProvider } from "./SearchSheetContext";
import { UserSearchSheet } from "./UserSearchSheet";
import { ProfileSheet } from "./ProfileSheet";
import { EditProfileSheet } from "./EditProfileSheet";
import { EditPostSheet } from "./EditPostSheet";
import { NotificationsSheet } from "./NotificationsSheet";
import { PostMenuSheet } from "./PostMenuSheet";
import type { EnrichedPost, EnrichedUser, SocialBundle } from "./social/types";

type GymCirclePreviewProps = {
  social: SocialBundle;
  onUploadImage?: (file: File) => Promise<string>;
  onUploadChatImage?: (file: File) => Promise<string>;
  onUploadAvatar?: (file: File) => Promise<string>;
};

export function GymCirclePreview({
  social,
  onUploadImage,
  onUploadChatImage,
  onUploadAvatar,
}: GymCirclePreviewProps) {
  const [activeScreen, setActiveScreen] = useState<ScreenKey>("feed");
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpenId, setProfileOpenId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [postMenuId, setPostMenuId] = useState<string | null>(null);
  const [editPostId, setEditPostId] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const allUsers = useMemo<EnrichedUser[]>(() => {
    const fromUsers = social.users
      ? (Object.values(social.users) as EnrichedUser[])
      : [];
    if (fromUsers.length > 0) return fromUsers;
    const seen = new Set<string>();
    const out: EnrichedUser[] = [social.currentUser];
    seen.add(social.currentUser.id);
    for (const u of social.suggestedUsers) {
      if (!seen.has(u.id)) {
        seen.add(u.id);
        out.push(u);
      }
    }
    return out;
  }, [social.users, social.currentUser, social.suggestedUsers]);

  const usersById = useMemo<Record<string, EnrichedUser>>(() => {
    const record: Record<string, EnrichedUser> = {};
    for (const u of allUsers) record[u.id] = u;
    return record;
  }, [allUsers]);

  const usersByUsername = useMemo(() => {
    const record = new Map<string, EnrichedUser>();
    for (const u of allUsers) record.set(u.username.toLowerCase(), u);
    return record;
  }, [allUsers]);

  const resolveUser = useCallback(
    (username: string) => usersByUsername.get(username.toLowerCase()),
    [usersByUsername],
  );

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const openProfile = useCallback((userId: string) => {
    setProfileOpenId(userId);
  }, []);
  const closeProfile = useCallback(() => setProfileOpenId(null), []);
  const openEditProfile = useCallback(() => setEditOpen(true), []);
  const closeEditProfile = useCallback(() => setEditOpen(false), []);
  const openNotifications = useCallback(() => setNotificationsOpen(true), []);
  const closeNotifications = useCallback(() => setNotificationsOpen(false), []);

  const editPost = social.actions.editPost;
  const deletePost = social.actions.deletePost;
  const canManageOwnPost = Boolean(editPost && deletePost);

  const openPostMenu = useCallback(
    (postId: string) => {
      if (!canManageOwnPost) return;
      setPostMenuId(postId);
    },
    [canManageOwnPost],
  );
  const closePostMenu = useCallback(() => setPostMenuId(null), []);
  const closeEditPost = useCallback(() => setEditPostId(null), []);

  const handleStartEditPost = useCallback(() => {
    if (!postMenuId) return;
    setEditPostId(postMenuId);
    setPostMenuId(null);
  }, [postMenuId]);

  const handleConfirmDeletePost = useCallback(async () => {
    if (!postMenuId || !deletePost) return;
    const ok =
      typeof window === "undefined"
        ? true
        : window.confirm("Apagar esse post? Não dá pra desfazer.");
    if (!ok) return;
    setPostMenuId(null);
    await deletePost(postMenuId);
  }, [postMenuId, deletePost]);

  const editPostTarget: EnrichedPost | null = useMemo(() => {
    if (!editPostId) return null;
    return social.feedPosts.find((p) => p.id === editPostId) ?? null;
  }, [editPostId, social.feedPosts]);

  const sheetContextValue = useMemo(
    () => ({
      openSearch,
      openProfile,
      openEditProfile,
      openNotifications,
      unreadNotifications: social.unreadNotifications ?? 0,
    }),
    [
      openSearch,
      openProfile,
      openEditProfile,
      openNotifications,
      social.unreadNotifications,
    ],
  );

  const signOut = social.actions.signOut;
  const handleSignOut = useMemo(() => {
    if (!signOut) return undefined;
    return async () => {
      if (signOut) {
        await signOut();
      }
    };
  }, [signOut]);

  const handleEditProfile = social.actions.updateProfile ? openEditProfile : undefined;

  const refresh = social.refresh;
  const triggerRefresh = useCallback(async () => {
    if (!refresh || refreshing) return;
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh, refreshing]);

  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if ((scrollRef.current?.scrollTop ?? 0) <= 0) {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    }
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const startY = touchStartYRef.current;
    if (startY === null || (scrollRef.current?.scrollTop ?? 0) > 0) return;
    const currentY = event.touches[0]?.clientY ?? startY;
    const delta = currentY - startY;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }
    setPullDistance(Math.min(94, delta * 0.48));
  }, []);

  const handleTouchEnd = useCallback(() => {
    const shouldRefresh = pullDistance > 62;
    touchStartYRef.current = null;
    setPullDistance(0);
    if (shouldRefresh) void triggerRefresh();
  }, [pullDistance, triggerRefresh]);

  const profileSheetUser = profileOpenId ? usersById[profileOpenId] ?? null : null;
  const profileSheetPosts = useMemo(() => {
    if (!profileOpenId) return [];
    return social.feedPosts.filter((p) => p.userId === profileOpenId);
  }, [profileOpenId, social.feedPosts]);
  const currentUserPosts = useMemo(
    () => social.feedPosts.filter((p) => p.userId === social.currentUser.id),
    [social.feedPosts, social.currentUser.id],
  );

  const screen = useMemo(() => {
    switch (activeScreen) {
      case "profile":
        return (
          <ProfileScreen
            currentUser={social.currentUser}
            monthDays={social.socialStats.monthDays}
            nearbyUsers={social.nearbyUsers}
            onEditProfile={handleEditProfile}
            onSelectUser={openProfile}
            onSignOut={handleSignOut}
            onToggleFollow={social.actions.toggleFollow}
            posts={currentUserPosts}
          />
        );
      case "chat":
        return (
          <ChatScreen
            messages={social.chatMessages ?? []}
            currentUser={social.currentUser}
            onSendMessage={social.actions.sendChatMessage}
            onSelectUser={openProfile}
            onUploadImage={onUploadChatImage}
            suggestedUsers={social.suggestedUsers}
          />
        );
      case "post":
        return (
          <PostScreen
            currentUser={social.currentUser}
            onPublish={async (input) => {
              await social.actions.publishWorkout(input);
              setActiveScreen("feed");
            }}
            onUploadImage={onUploadImage}
          />
        );
      case "checkin":
        return (
          <CheckInScreen
            checkInsToday={social.socialStats.checkInsToday}
            currentUser={social.currentUser}
            nearbyUsers={social.nearbyUsers}
            onCheckIn={social.actions.checkIn}
            onToggleFollow={social.actions.toggleFollow}
          />
        );
      case "feed":
      default:
        return (
          <FeedScreen
            currentUser={social.currentUser}
            feedPosts={social.feedPosts}
            formatTime={social.formatPostClock}
            onCommentPost={social.actions.commentPost}
            onCreatePost={() => setActiveScreen("post")}
            onLikePost={social.actions.likePost}
            onOpenPostMenu={canManageOwnPost ? openPostMenu : undefined}
            onOpenStory={social.actions.openStory}
            onSelectUser={openProfile}
            onToggleFollow={social.actions.toggleFollow}
            resolveUser={resolveUser}
            stories={social.storyBubbles}
            suggestedUsers={social.suggestedUsers}
          />
        );
    }
  }, [
    activeScreen,
    social,
    onUploadImage,
    onUploadChatImage,
    handleEditProfile,
    handleSignOut,
    openProfile,
    resolveUser,
    canManageOwnPost,
    openPostMenu,
    currentUserPosts,
  ]);

  return (
    <SearchSheetProvider value={sheetContextValue}>
      <main className="min-h-[100dvh] bg-black text-white lg:bg-[#050505]">
        <div className="relative mx-auto h-[100dvh] min-h-[100dvh] w-full max-w-[480px] overflow-hidden border-white/[0.06] bg-black shadow-[0_0_90px_rgba(0,0,0,0.92)] lg:border-x">
          <div className="gc-phone-shell flex h-full min-h-0 flex-col">
            <div
              className="pointer-events-none absolute left-1/2 top-[calc(var(--gc-safe-top)+10px)] z-40 grid size-10 -translate-x-1/2 place-items-center rounded-full border border-white/[0.08] bg-black/72 text-[var(--gc-brand)] opacity-0 shadow-[0_0_28px_rgba(48,213,255,0.18)] backdrop-blur-2xl transition-opacity duration-200"
              style={{ opacity: pullDistance > 8 || refreshing ? 1 : 0 }}
            >
              <RefreshCw
                className={refreshing ? "animate-spin" : undefined}
                size={18}
                style={{ transform: refreshing ? undefined : `rotate(${pullDistance * 2.2}deg)` }}
              />
            </div>
            <div
              className="gc-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24"
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
              onTouchStart={handleTouchStart}
              ref={scrollRef}
            >
              <div
                className="min-h-full"
                style={{
                  transform: pullDistance ? `translateY(${pullDistance}px)` : undefined,
                  transition: pullDistance ? undefined : "transform 260ms var(--gc-ease-ios)",
                }}
              >
                {screen}
              </div>
            </div>
            <BottomNav active={activeScreen} onChange={setActiveScreen} />
          </div>
          {activeScreen === "feed" ? (
            <FloatingCreatePostButton onClick={() => setActiveScreen("post")} />
          ) : null}
          <StoryViewer onClose={social.actions.closeStory} story={social.selectedStory} />
          <UserSearchSheet
            currentUserId={social.currentUser.id}
            onClose={closeSearch}
            onToggleFollow={(userId) => {
              social.actions.toggleFollow(userId);
            }}
            open={searchOpen}
            users={allUsers}
          />
          <ProfileSheet
            currentUserId={social.currentUser.id}
            onClose={closeProfile}
            onToggleFollow={social.actions.toggleFollow}
            open={profileOpenId !== null}
            posts={profileSheetPosts}
            user={profileSheetUser}
          />
          {social.actions.updateProfile ? (
            <EditProfileSheet
              currentUser={social.currentUser}
              onClose={closeEditProfile}
              onSave={social.actions.updateProfile}
              onUploadAvatar={onUploadAvatar}
              open={editOpen}
            />
          ) : null}
          <NotificationsSheet
            currentUserId={social.currentUser.id}
            onAcceptFollowRequest={social.actions.acceptFollowRequest}
            onClose={closeNotifications}
            onRejectFollowRequest={social.actions.rejectFollowRequest}
            onSelectUser={(userId) => {
              setNotificationsOpen(false);
              openProfile(userId);
            }}
            open={notificationsOpen}
            users={usersById}
          />
          <PostMenuSheet
            onClose={closePostMenu}
            onDelete={handleConfirmDeletePost}
            onEdit={handleStartEditPost}
            open={postMenuId !== null}
          />
          {editPost ? (
            <EditPostSheet
              onClose={closeEditPost}
              onSave={editPost}
              open={editPostId !== null}
              post={editPostTarget}
            />
          ) : null}
          <ToastFeedback feedback={social.feedback} />
        </div>
      </main>
    </SearchSheetProvider>
  );
}

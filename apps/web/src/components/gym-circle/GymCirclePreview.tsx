"use client";

import { type TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  calculateDistanceKm,
  formatDistanceKm,
  type Coordinates,
} from "@gym-circle/core";
import { RefreshCw } from "lucide-react";
import { FloatingCreatePostButton, StoryViewer, ToastFeedback } from "./design-system";
import { BottomNav, type ScreenKey } from "./BottomNav";
import { CheckInScreen } from "./screens/CheckInScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { FeedScreen } from "./screens/FeedScreen";
import { PostScreen } from "./screens/PostScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { SearchSheetProvider } from "./SearchSheetContext";
import { AdminPanelSheet } from "./AdminPanelSheet";
import { UserSearchSheet } from "./UserSearchSheet";
import { ProfileSheet } from "./ProfileSheet";
import { EditProfileSheet } from "./EditProfileSheet";
import { EditPostSheet } from "./EditPostSheet";
import { MonthlyRecapSheet } from "./MonthlyRecapSheet";
import { NotificationsSheet } from "./NotificationsSheet";
import { PostMenuSheet } from "./PostMenuSheet";
import { buildMonthlyRecap } from "./social/monthlyRecap";
import type { EnrichedPost, EnrichedUser, SocialBundle } from "./social/types";
import { getAdjacentStoryId, getStoryForUser } from "./social/stories";
import { useViewerLocation } from "./social/useViewerLocation";

const NO_SCREEN_SWIPE_SELECTOR =
  "button,a,input,textarea,select,video,[contenteditable='true'],[data-gc-no-screen-swipe]";
const SCREEN_SWIPE_THRESHOLD = 132;
const SCREEN_SWIPE_MAX_VERTICAL = 34;
const SCREEN_SWIPE_DOMINANCE = 2.15;

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
  const [adminOpen, setAdminOpen] = useState(false);
  const [monthlyRecapOpen, setMonthlyRecapOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [postMenuId, setPostMenuId] = useState<string | null>(null);
  const [editPostId, setEditPostId] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [chatThreadOpen, setChatThreadOpen] = useState(false);
  const viewerLocation = useViewerLocation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchLastYRef = useRef<number | null>(null);
  const touchLastXRef = useRef<number | null>(null);
  const touchStartScreenRef = useRef<ScreenKey>("feed");
  const touchIgnoreScreenSwipeRef = useRef(false);
  const screenOrder: ScreenKey[] = useMemo(
    () => ["feed", "chat", "post", "checkin", "profile"],
    [],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0, top: 0 });
  }, [activeScreen]);

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
  const openAdmin = useCallback(() => setAdminOpen(true), []);
  const closeAdmin = useCallback(() => setAdminOpen(false), []);

  const editPost = social.actions.editPost;
  const deletePost = social.actions.deletePost;
  const canManageOwnPost = Boolean(editPost && deletePost);

  const openPostMenu = useCallback(
    (postId: string) => {
      setPostMenuId(postId);
    },
    [],
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
  const postMenuTarget: EnrichedPost | null = useMemo(() => {
    if (!postMenuId) return null;
    return social.feedPosts.find((p) => p.id === postMenuId) ?? null;
  }, [postMenuId, social.feedPosts]);

  const hasDistancePosts = useMemo(
    () =>
      social.feedPosts.some(
        (post) =>
          post.userId !== social.currentUser.id &&
          post.locationSource === "current" &&
          typeof post.locationLatitude === "number" &&
          typeof post.locationLongitude === "number",
      ),
    [social.currentUser.id, social.feedPosts],
  );

  const feedPosts = useMemo<EnrichedPost[]>(() => {
    const viewerCoordinates = viewerLocation.coordinates;
    if (!viewerCoordinates) return social.feedPosts;

    return social.feedPosts.map((post) => {
      if (
        post.userId === social.currentUser.id ||
        post.locationSource !== "current" ||
        typeof post.locationLatitude !== "number" ||
        typeof post.locationLongitude !== "number"
      ) {
        return { ...post, distanceKm: null, distanceLabel: null };
      }

      const postCoordinates: Coordinates = {
        latitude: post.locationLatitude,
        longitude: post.locationLongitude,
      };
      const distanceKm = calculateDistanceKm(viewerCoordinates, postCoordinates);

      return {
        ...post,
        distanceKm,
        distanceLabel: `${formatDistanceKm(distanceKm)} de você`,
      };
    });
  }, [social.currentUser.id, social.feedPosts, viewerLocation.coordinates]);

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

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const updateKeyboardState = () => {
      setKeyboardOpen(window.innerHeight - viewport.height > 120);
    };
    updateKeyboardState();
    viewport.addEventListener("resize", updateKeyboardState);
    viewport.addEventListener("scroll", updateKeyboardState);
    return () => {
      viewport.removeEventListener("resize", updateKeyboardState);
      viewport.removeEventListener("scroll", updateKeyboardState);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

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

  const handleTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      const target = event.target;
      touchIgnoreScreenSwipeRef.current =
        target instanceof Element && Boolean(target.closest(NO_SCREEN_SWIPE_SELECTOR));
      const touch = event.touches[0];
      touchStartXRef.current = touch?.clientX ?? null;
      touchLastXRef.current = touch?.clientX ?? null;
      touchLastYRef.current = touch?.clientY ?? null;
      touchStartScreenRef.current = activeScreen;
      touchStartYRef.current = touch?.clientY ?? null;
    },
    [activeScreen],
  );

  const handleTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (touchIgnoreScreenSwipeRef.current) return;
    const startY = touchStartYRef.current;
    const touch = event.touches[0];
    touchLastXRef.current = touch?.clientX ?? touchLastXRef.current;
    touchLastYRef.current = touch?.clientY ?? touchLastYRef.current;
    if (startY === null || (scrollRef.current?.scrollTop ?? 0) > 0) return;
    const currentY = touch?.clientY ?? startY;
    const delta = currentY - startY;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }
    setPullDistance(Math.min(94, delta * 0.48));
  }, []);

  const handleTouchEnd = useCallback(() => {
    const shouldRefresh = pullDistance > 62;
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    const endX = touchLastXRef.current;
    const endY = touchLastYRef.current;
    const ignoreScreenSwipe = touchIgnoreScreenSwipeRef.current;
    touchStartYRef.current = null;
    touchStartXRef.current = null;
    touchLastXRef.current = null;
    touchLastYRef.current = null;
    touchIgnoreScreenSwipeRef.current = false;
    setPullDistance(0);
    if (ignoreScreenSwipe) return;
    if (shouldRefresh) void triggerRefresh();
    if (shouldRefresh || startX === null || startY === null || endX === null || endY === null) return;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    if (
      Math.abs(deltaX) < SCREEN_SWIPE_THRESHOLD ||
      Math.abs(deltaY) > SCREEN_SWIPE_MAX_VERTICAL ||
      Math.abs(deltaX) < Math.abs(deltaY) * SCREEN_SWIPE_DOMINANCE
    ) {
      return;
    }
    const currentIndex = screenOrder.indexOf(touchStartScreenRef.current);
    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    const next = screenOrder[nextIndex];
    if (next) setActiveScreen(next);
  }, [pullDistance, screenOrder, triggerRefresh]);

  const profileSheetUser = profileOpenId ? usersById[profileOpenId] ?? null : null;
  const profileSheetPosts = useMemo(() => {
    if (!profileOpenId) return [];
    return feedPosts.filter((p) => p.userId === profileOpenId);
  }, [feedPosts, profileOpenId]);
  const currentUserPosts = useMemo(
    () => feedPosts.filter((p) => p.userId === social.currentUser.id),
    [feedPosts, social.currentUser.id],
  );
  const monthlyRecap = useMemo(
    () => buildMonthlyRecap({ now, posts: currentUserPosts, user: social.currentUser }),
    [currentUserPosts, now, social.currentUser],
  );
  const selectedStoryId = social.selectedStory?.id ?? null;
  const nextStoryId = useMemo(
    () => getAdjacentStoryId(social.storyBubbles, selectedStoryId, 1),
    [selectedStoryId, social.storyBubbles],
  );
  const previousStoryId = useMemo(
    () => getAdjacentStoryId(social.storyBubbles, selectedStoryId, -1),
    [selectedStoryId, social.storyBubbles],
  );
  const currentUserStory = useMemo(
    () => getStoryForUser(social.storyBubbles, social.currentUser.id),
    [social.currentUser.id, social.storyBubbles],
  );
  const profileSheetStory = useMemo(
    () => (profileOpenId ? getStoryForUser(social.storyBubbles, profileOpenId) : null),
    [profileOpenId, social.storyBubbles],
  );
  const openStoryById = useCallback(
    (storyId: string | null) => {
      if (!storyId) {
        social.actions.closeStory();
        return;
      }
      social.actions.openStory(storyId);
    },
    [social.actions],
  );
  const openNextStory = useCallback(
    () => openStoryById(nextStoryId),
    [nextStoryId, openStoryById],
  );
  const openPreviousStory = useCallback(() => {
    if (previousStoryId) openStoryById(previousStoryId);
  }, [openStoryById, previousStoryId]);

  useEffect(() => {
    const urls = [
      ...social.feedPosts
        .filter((post) => post.mediaType !== "video")
        .slice(0, 5)
        .map((post) => post.imageUrl),
      ...social.storyBubbles
        .filter((story) => story.mediaType !== "video")
        .slice(0, 4)
        .map((story) => story.imageUrl),
      ...allUsers
        .map((user) => user.avatarUrl)
        .filter((url): url is string => Boolean(url))
        .slice(0, 12),
    ];

    for (const url of Array.from(new Set(urls))) {
      const image = new window.Image();
      image.decoding = "async";
      image.src = url;
    }
  }, [allUsers, social.feedPosts, social.storyBubbles]);

  const screen = useMemo(() => {
    switch (activeScreen) {
      case "profile":
        return (
          <ProfileScreen
            currentUser={social.currentUser}
            monthDays={social.socialStats.monthDays}
            nearbyUsers={social.nearbyUsers}
            onEditProfile={handleEditProfile}
            onOpenAdmin={social.currentUser.username.toLowerCase() === "dudy" ? openAdmin : undefined}
            onRequestAccountDeletion={social.actions.requestAccountDeletion
              ? async () => {
                  const ok = window.confirm("Excluir sua conta? Seu perfil será desativado e o pedido ficará pendente para processamento interno.");
                  if (!ok) return;
                  await social.actions.requestAccountDeletion?.("Solicitado pelo usuário no app");
                }
              : undefined}
            onSelectUser={openProfile}
            onSignOut={handleSignOut}
            onToggleFollow={social.actions.toggleFollow}
            posts={currentUserPosts}
            monthlyRecap={monthlyRecap}
            onOpenMonthlyRecap={() => setMonthlyRecapOpen(true)}
            hasStory={Boolean(currentUserStory)}
            storyViewed={currentUserStory?.viewed ?? false}
            onOpenStory={
              currentUserStory
                ? () => openStoryById(currentUserStory.id)
                : undefined
            }
          />
        );
      case "chat":
        return (
          <ChatScreen
            messages={social.chatMessages ?? []}
            currentUser={social.currentUser}
            onSendMessage={social.actions.sendChatMessage}
            onSelectUser={openProfile}
            onThreadOpen={social.actions.markChatThreadRead}
            onThreadViewChange={setChatThreadOpen}
            onUploadImage={onUploadChatImage}
            suggestedUsers={social.suggestedUsers}
          />
        );
      case "post":
        return (
          <PostScreen
            currentUser={social.currentUser}
            gyms={social.gyms ?? []}
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
            onSelectUser={openProfile}
            onToggleFollow={social.actions.toggleFollow}
          />
        );
      case "feed":
      default:
        return (
          <FeedScreen
            currentUser={social.currentUser}
            feedPosts={feedPosts}
            formatTime={social.formatPostClock}
            hasDistancePosts={hasDistancePosts}
            onCommentPost={social.actions.commentPost}
            onCreatePost={() => setActiveScreen("post")}
            onLikePost={social.actions.likePost}
            onOpenPostMenu={openPostMenu}
            onOpenStory={social.actions.openStory}
            onEditProfile={handleEditProfile}
            onFindPeople={openSearch}
            onRequestViewerLocation={viewerLocation.request}
            onSelectUser={openProfile}
            onToggleFollow={social.actions.toggleFollow}
            resolveUser={resolveUser}
            stories={social.storyBubbles}
            suggestedUsers={social.suggestedUsers}
            viewerLocationError={viewerLocation.error}
            viewerLocationStatus={viewerLocation.status}
          />
        );
    }
  }, [
    activeScreen,
    feedPosts,
    hasDistancePosts,
    social,
    onUploadImage,
    onUploadChatImage,
    handleEditProfile,
    handleSignOut,
    openAdmin,
    openSearch,
    openProfile,
    resolveUser,
    openPostMenu,
    currentUserPosts,
    monthlyRecap,
    currentUserStory,
    openStoryById,
    viewerLocation.error,
    viewerLocation.request,
    viewerLocation.status,
  ]);

  return (
    <SearchSheetProvider value={sheetContextValue}>
      <main className="min-h-[100dvh] bg-black text-white">
        <div className="relative mx-auto h-[100dvh] min-h-[100dvh] w-full max-w-none overflow-hidden bg-black shadow-none sm:max-w-[480px] lg:border-x lg:border-white/[0.06] lg:shadow-[0_0_90px_rgba(0,0,0,0.92)]">
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
            {!keyboardOpen && !(activeScreen === "chat" && chatThreadOpen) ? (
              <BottomNav
                active={activeScreen}
                onChange={setActiveScreen}
                unreadMessages={social.unreadMessages ?? 0}
              />
            ) : null}
          </div>
          {activeScreen === "feed" && !keyboardOpen ? (
            <FloatingCreatePostButton onClick={() => setActiveScreen("post")} />
          ) : null}
          <StoryViewer
            currentUserId={social.currentUser.id}
            hasNext={Boolean(nextStoryId)}
            hasPrevious={Boolean(previousStoryId)}
            onClose={social.actions.closeStory}
            onDeleteStory={social.actions.deleteStory}
            onLikeStory={social.actions.likeStory}
            onNext={openNextStory}
            onPrevious={openPreviousStory}
            onMuteStoryAuthor={social.actions.muteStoryAuthor}
            onReportStory={social.actions.reportStory}
            onReplyStory={social.actions.replyToStory}
            onSelectUser={(userId) => {
              social.actions.closeStory();
              openProfile(userId);
            }}
            onShareStoryToChat={social.actions.shareStoryToChat}
            onUnfollowUser={social.actions.toggleFollow}
            shareTargets={social.suggestedUsers.filter((user) => user.id !== social.currentUser.id)}
            story={social.selectedStory}
          />
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
            onBlockUser={social.actions.blockUser}
            onClose={closeProfile}
            onReportUser={social.actions.reportUser}
            hasStory={Boolean(profileSheetStory)}
            storyViewed={profileSheetStory?.viewed ?? false}
            onOpenStory={
              profileSheetStory
                ? () => {
                    closeProfile();
                    openStoryById(profileSheetStory.id);
                  }
                : undefined
            }
            onToggleFollow={social.actions.toggleFollow}
            open={profileOpenId !== null}
            posts={profileSheetPosts}
            user={profileSheetUser}
          />
          <MonthlyRecapSheet
            onClose={() => setMonthlyRecapOpen(false)}
            open={monthlyRecapOpen}
            recap={monthlyRecap}
            user={social.currentUser}
          />
          {social.actions.updateProfile ? (
            <EditProfileSheet
              currentUser={social.currentUser}
              onClose={closeEditProfile}
              gyms={social.gyms ?? []}
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
          <AdminPanelSheet onClose={closeAdmin} open={adminOpen} />
          <PostMenuSheet
            isOwner={Boolean(canManageOwnPost && postMenuTarget?.userId === social.currentUser.id)}
            onBlock={() => {
              const userId = postMenuTarget?.userId;
              setPostMenuId(null);
              if (userId) void social.actions.blockUser?.(userId);
            }}
            onClose={closePostMenu}
            onDelete={handleConfirmDeletePost}
            onEdit={handleStartEditPost}
            onReport={() => {
              const target = postMenuTarget;
              setPostMenuId(null);
              if (target) void social.actions.reportPost?.(target.id, target.userId);
            }}
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

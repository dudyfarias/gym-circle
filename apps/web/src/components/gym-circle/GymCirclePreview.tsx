"use client";

import { useCallback, useMemo, useState } from "react";
import { StoryViewer, ToastFeedback } from "./design-system";
import { BottomNav, type ScreenKey } from "./BottomNav";
import { CheckInScreen } from "./screens/CheckInScreen";
import { FeedScreen } from "./screens/FeedScreen";
import { PostScreen } from "./screens/PostScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { StreakScreen } from "./screens/StreakScreen";
import { SearchSheetProvider } from "./SearchSheetContext";
import { UserSearchSheet } from "./UserSearchSheet";
import { ProfileSheet } from "./ProfileSheet";
import { EditProfileSheet } from "./EditProfileSheet";
import { NotificationsSheet } from "./NotificationsSheet";
import type { EnrichedUser, SocialBundle } from "./social/types";

type GymCirclePreviewProps = {
  social: SocialBundle;
  onUploadImage?: (file: File) => Promise<string>;
  onUploadAvatar?: (file: File) => Promise<string>;
};

export function GymCirclePreview({
  social,
  onUploadImage,
  onUploadAvatar,
}: GymCirclePreviewProps) {
  const [activeScreen, setActiveScreen] = useState<ScreenKey>("feed");
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpenId, setProfileOpenId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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

  const handleSignOut = useMemo(() => {
    if (!social.actions.signOut) return undefined;
    return async () => {
      if (social.actions.signOut) {
        await social.actions.signOut();
      }
    };
  }, [social.actions.signOut]);

  const handleEditProfile = social.actions.updateProfile ? openEditProfile : undefined;

  const profileSheetUser = profileOpenId ? usersById[profileOpenId] ?? null : null;
  const profileSheetPosts = useMemo(() => {
    if (!profileOpenId) return [];
    return social.feedPosts.filter((p) => p.userId === profileOpenId);
  }, [profileOpenId, social.feedPosts]);

  const screen = useMemo(() => {
    switch (activeScreen) {
      case "profile":
        return (
          <ProfileScreen
            currentUser={social.currentUser}
            nearbyUsers={social.nearbyUsers}
            onEditProfile={handleEditProfile}
            onSelectUser={openProfile}
            onSignOut={handleSignOut}
            onToggleFollow={social.actions.toggleFollow}
          />
        );
      case "post":
        return (
          <PostScreen
            currentUser={social.currentUser}
            onPublish={(input) => {
              social.actions.publishWorkout(input);
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
      case "streak":
        return (
          <StreakScreen
            currentUser={social.currentUser}
            monthDays={social.socialStats.monthDays}
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
    handleEditProfile,
    handleSignOut,
    openProfile,
    resolveUser,
  ]);

  return (
    <SearchSheetProvider value={sheetContextValue}>
      <main className="min-h-screen bg-black text-white lg:bg-[#050505]">
        <div className="relative mx-auto min-h-screen w-full max-w-[480px] overflow-hidden border-white/[0.06] bg-black shadow-[0_0_90px_rgba(0,0,0,0.92)] lg:border-x">
          <div className="gc-phone-shell flex min-h-screen flex-col">
            <div className="flex-1">{screen}</div>
            <BottomNav active={activeScreen} onChange={setActiveScreen} />
          </div>
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
            onClose={closeNotifications}
            onSelectUser={(userId) => {
              setNotificationsOpen(false);
              openProfile(userId);
            }}
            open={notificationsOpen}
            users={usersById}
          />
          <ToastFeedback feedback={social.feedback} />
        </div>
      </main>
    </SearchSheetProvider>
  );
}

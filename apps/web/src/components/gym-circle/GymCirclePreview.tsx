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
import type { EnrichedUser, SocialBundle } from "./social/types";

type GymCirclePreviewProps = {
  social: SocialBundle;
  onUploadImage?: (file: File) => Promise<string>;
};

export function GymCirclePreview({ social, onUploadImage }: GymCirclePreviewProps) {
  const [activeScreen, setActiveScreen] = useState<ScreenKey>("feed");
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const searchValue = useMemo(() => ({ openSearch }), [openSearch]);
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

  const screen = useMemo(() => {
    switch (activeScreen) {
      case "profile":
        return (
          <ProfileScreen
            currentUser={social.currentUser}
            nearbyUsers={social.nearbyUsers}
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
            onToggleFollow={social.actions.toggleFollow}
            stories={social.storyBubbles}
            suggestedUsers={social.suggestedUsers}
          />
        );
    }
  }, [activeScreen, social, onUploadImage]);

  return (
    <SearchSheetProvider value={searchValue}>
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
            onToggleFollow={social.actions.toggleFollow}
            open={searchOpen}
            users={allUsers}
          />
          <ToastFeedback feedback={social.feedback} />
        </div>
      </main>
    </SearchSheetProvider>
  );
}

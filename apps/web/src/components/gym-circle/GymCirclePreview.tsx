"use client";

import dynamic from "next/dynamic";
import { type TouchEvent, type UIEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  calculateDistanceKm,
  formatDistanceKm,
  type Coordinates,
} from "@gym-circle/core";
import { RefreshCw } from "lucide-react";
import { FloatingCreatePostButton, ToastFeedback } from "./design-system";
import { preloadImage } from "./design-system/imageCache";
import { BottomNav, type ScreenKey } from "./BottomNav";
import { CheckInScreen } from "./screens/CheckInScreen";
import { FeedScreen } from "./screens/FeedScreen";
import { SearchSheetProvider } from "./SearchSheetContext";
import { buildMonthlyRecap } from "./social/monthlyRecap";
import { getLikesOverlayUsers } from "./social/likes";
import { getRecentPostLocations } from "./social/locationSearch";
import type { EnrichedPost, EnrichedUser, SocialBundle } from "./social/types";
import { getAdjacentStoryId } from "./social/stories";
import { useViewerLocation } from "./social/useViewerLocation";
import {
  attachCapacitorKeyboardListeners,
  type KeyboardPluginLike,
} from "./keyboardDetection";
import { markPerf, measurePerf } from "./performance";

const ChatScreen = dynamic(
  () => import("./screens/ChatScreen").then((module) => module.ChatScreen),
  { ssr: false },
);
const PostScreen = dynamic(
  () => import("./screens/PostScreen").then((module) => module.PostScreen),
  { ssr: false },
);
const ProfileScreen = dynamic(
  () => import("./screens/ProfileScreen").then((module) => module.ProfileScreen),
  { ssr: false },
);
const StoryViewer = dynamic(
  () => import("./design-system/StoryViewer").then((module) => module.StoryViewer),
  { ssr: false },
);
const AdminPanelSheet = dynamic(
  () => import("./AdminPanelSheet").then((module) => module.AdminPanelSheet),
  { ssr: false },
);
const UserSearchSheet = dynamic(
  () => import("./UserSearchSheet").then((module) => module.UserSearchSheet),
  { ssr: false },
);
const ProfileSheet = dynamic(
  () => import("./ProfileSheet").then((module) => module.ProfileSheet),
  { ssr: false },
);
const EditProfileSheet = dynamic(
  () => import("./EditProfileSheet").then((module) => module.EditProfileSheet),
  { ssr: false },
);
const EditPostSheet = dynamic(
  () => import("./EditPostSheet").then((module) => module.EditPostSheet),
  { ssr: false },
);
const MonthlyRecapSheet = dynamic(
  () => import("./MonthlyRecapSheet").then((module) => module.MonthlyRecapSheet),
  { ssr: false },
);
const NotificationsSheet = dynamic(
  () => import("./NotificationsSheet").then((module) => module.NotificationsSheet),
  { ssr: false },
);
const ConfirmSheet = dynamic(
  () => import("./ConfirmSheet").then((module) => module.ConfirmSheet),
  { ssr: false },
);
const PostMenuSheet = dynamic(
  () => import("./PostMenuSheet").then((module) => module.PostMenuSheet),
  { ssr: false },
);
const CommentsBottomSheet = dynamic(
  () =>
    import("./CommentsBottomSheet").then((module) => module.CommentsBottomSheet),
  { ssr: false },
);
const LikesOverlay = dynamic(
  () => import("./LikesOverlay").then((module) => module.LikesOverlay),
  { ssr: false },
);
const FollowListOverlay = dynamic(
  () => import("./FollowListOverlay").then((module) => module.FollowListOverlay),
  { ssr: false },
);
const MyCircleSheet = dynamic(
  () => import("./MyCircleSheet").then((module) => module.MyCircleSheet),
  { ssr: false },
);
const AccountSettingsSheet = dynamic(
  () => import("./AccountSettingsSheet").then((module) => module.AccountSettingsSheet),
  { ssr: false },
);

const NO_SCREEN_SWIPE_SELECTOR =
  "button,a,input,textarea,select,video,[contenteditable='true'],[data-gc-no-screen-swipe]";
const SCREEN_SWIPE_THRESHOLD = 132;
const SCREEN_SWIPE_MAX_VERTICAL = 34;
const SCREEN_SWIPE_DOMINANCE = 2.15;

type GymCirclePreviewProps = {
  social: SocialBundle;
  onUploadImage?: (file: File) => Promise<
    | string
    | {
        imageUrl: string;
        thumbnailUrl?: string | null;
        posterUrl?: string | null;
        mediaWidth?: number | null;
        mediaHeight?: number | null;
        mediaDurationSeconds?: number | null;
        blurDataUrl?: string | null;
      }
  >;
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
  // Sprint 3.5.3: MyCircleSheet pode ser aberto pro próprio user OU pra
  // outro user via tap nos rings do ProfileIdentity. Guardamos o id.
  const [myCircleUserId, setMyCircleUserId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [monthlyRecapOpen, setMonthlyRecapOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [postMenuId, setPostMenuId] = useState<string | null>(null);
  const [editPostId, setEditPostId] = useState<string | null>(null);
  const [postDetailId, setPostDetailId] = useState<string | null>(null);
  const [likesPostId, setLikesPostId] = useState<string | null>(null);
  const [followListOverlay, setFollowListOverlay] = useState<{
    kind: "followers" | "following";
    loading: boolean;
    users: EnrichedUser[];
  } | null>(null);
  const [chatTargetUserId, setChatTargetUserId] = useState<string | null>(null);
  // Sheet de confirmação genérico — substitui window.confirm em ações
  // destrutivas. `intent` decide qual handler dispara no botão "Confirmar".
  const [confirmIntent, setConfirmIntent] = useState<
    | { kind: "delete-post"; postId: string }
    | { kind: "delete-account" }
    | { kind: "sign-out" }
    | { kind: "suspend-account" }
    | { kind: "restore-streak" }
    | null
  >(null);
  const [restorePromptDismissedKey, setRestorePromptDismissedKey] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [chatThreadOpen, setChatThreadOpen] = useState(false);
  // scrollState dirige a visibilidade direcional do chrome durante scroll do feed:
  //   "top"   → topo (scrollY <= 12): header E footer visíveis.
  //   "down"  → rolando pra baixo (delta>6): esconde HEADER, mantém footer pro
  //             usuário continuar navegando entre tabs durante leitura profunda.
  //   "up"    → rolando pra cima (delta<-8): mantém HEADER, esconde FOOTER
  //             (clean experience ao voltar pro topo).
  // FloatingCreatePostButton tem comportamento próprio: ao sumir por scroll,
  // só volta numa nova abertura/montagem do app.
  const [scrollState, setScrollState] = useState<"top" | "down" | "up">("top");
  const [createPostButtonHiddenForSession, setCreatePostButtonHiddenForSession] =
    useState(false);
  const viewerLocation = useViewerLocation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchLastYRef = useRef<number | null>(null);
  const touchLastXRef = useRef<number | null>(null);
  const touchStartScreenRef = useRef<ScreenKey>("feed");
  const touchIgnoreScreenSwipeRef = useRef(false);
  const touchPullingToRefreshRef = useRef(false);
  const screenOrder: ScreenKey[] = useMemo(
    () => ["feed", "chat", "post", "checkin", "profile"],
    [],
  );
  const refreshChatAction = social.actions.refreshChat;
  const refreshPostDetailsAction = social.actions.refreshPostDetails;

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_PERF_DEBUG === "true") {
      console.info("[GymCircleBoot] feed mounted");
    }
    measurePerf("app_boot_ms", "app_boot_start", "app_boot_end");
  }, []);

  useEffect(() => {
    if (activeScreen !== "chat") return;
    void refreshChatAction?.();
  }, [activeScreen, refreshChatAction]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0, top: 0 });
    lastScrollTopRef.current = 0;
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

  const followedUsers = useMemo(
    () =>
      allUsers.filter(
        (user) =>
          user.id !== social.currentUser.id &&
          (user.followStatus === "accepted" || user.isFollowing),
      ),
    [allUsers, social.currentUser.id],
  );

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
    markPerf("profile_open_start");
    void social.actions.refreshProfilePosts?.(userId);
    setProfileOpenId(userId);
    window.requestAnimationFrame(() => {
      measurePerf("profile_open_ms", "profile_open_start", "profile_open_end");
    });
  }, [social.actions]);
  const closeProfile = useCallback(() => setProfileOpenId(null), []);
  // Sprint 3.5.3: handlers do MyCircleSheet.
  const openMyCircle = useCallback((userId: string) => {
    setMyCircleUserId(userId);
  }, []);
  const closeMyCircle = useCallback(() => setMyCircleUserId(null), []);
  const openChatWithUser = useCallback((userId: string) => {
    setProfileOpenId(null);
    setChatTargetUserId(userId);
    setActiveScreen("chat");
  }, []);
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
  const openPostDetail = useCallback(
    (postId: string) => {
      setPostDetailId(postId);
      void refreshPostDetailsAction?.(postId);
    },
    [refreshPostDetailsAction],
  );
  const closePostDetail = useCallback(() => setPostDetailId(null), []);
  const openLikes = useCallback(
    (postId: string) => {
      setLikesPostId(postId);
      void refreshPostDetailsAction?.(postId);
    },
    [refreshPostDetailsAction],
  );
  const closeLikes = useCallback(() => setLikesPostId(null), []);
  const closeFollowListOverlay = useCallback(() => setFollowListOverlay(null), []);
  const openFollowListOverlay = useCallback(
    async (kind: "followers" | "following") => {
      setFollowListOverlay({ kind, loading: true, users: [] });
      try {
        const users =
          (await social.actions.listFollowUsers?.(social.currentUser.id, kind)) ?? [];
        setFollowListOverlay({ kind, loading: false, users });
      } catch {
        setFollowListOverlay({ kind, loading: false, users: [] });
      }
    },
    [social.actions, social.currentUser.id],
  );
  const toggleFollowFromFollowList = useCallback(
    async (userId: string) => {
      const result = await social.actions.toggleFollow(userId);
      const followStatus =
        result && typeof result === "object" && "followStatus" in result
          ? result.followStatus
          : "none";
      setFollowListOverlay((current) =>
        current
          ? {
              ...current,
              users: current.users.map((user) =>
                user.id === userId
                  ? {
                      ...user,
                      followStatus,
                      isFollowing: followStatus === "accepted",
                    }
                  : user,
              ),
            }
          : current,
      );
      return { followStatus };
    },
    [social.actions],
  );

  const handleStartEditPost = useCallback(() => {
    if (!postMenuId) return;
    setEditPostId(postMenuId);
    setPostMenuId(null);
  }, [postMenuId]);

  const handleConfirmDeletePost = useCallback(() => {
    if (!postMenuId || !deletePost) return;
    setConfirmIntent({ kind: "delete-post", postId: postMenuId });
    setPostMenuId(null);
  }, [postMenuId, deletePost]);

  const editPostTarget: EnrichedPost | null = useMemo(() => {
    if (!editPostId) return null;
    return (social.profilePosts ?? social.feedPosts).find((p) => p.id === editPostId) ?? null;
  }, [editPostId, social.feedPosts, social.profilePosts]);
  const postMenuTarget: EnrichedPost | null = useMemo(() => {
    if (!postMenuId) return null;
    return (social.profilePosts ?? social.feedPosts).find((p) => p.id === postMenuId) ?? null;
  }, [postMenuId, social.feedPosts, social.profilePosts]);

  const hasDistancePosts = useMemo(
    () =>
      social.feedPosts.some(
        (post) =>
          post.userId !== social.currentUser.id &&
          (post.locationSource === "current" || post.locationSource === "gym") &&
          typeof post.locationLatitude === "number" &&
          typeof post.locationLongitude === "number",
      ),
    [social.currentUser.id, social.feedPosts],
  );

  const addViewerDistance = useCallback((posts: EnrichedPost[]) => {
    const viewerCoordinates = viewerLocation.coordinates;
    if (!viewerCoordinates) return posts;

    return posts.map((post) => {
      if (
        post.userId === social.currentUser.id ||
        (post.locationSource !== "current" && post.locationSource !== "gym") ||
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
  }, [social.currentUser.id, viewerLocation.coordinates]);

  const feedPosts = useMemo<EnrichedPost[]>(
    () => addViewerDistance(social.feedPosts),
    [addViewerDistance, social.feedPosts],
  );

  const profilePosts = useMemo<EnrichedPost[]>(
    () => addViewerDistance(social.profilePosts ?? social.feedPosts),
    [addViewerDistance, social.feedPosts, social.profilePosts],
  );
  const postDetailTarget: EnrichedPost | null = useMemo(() => {
    if (!postDetailId) return null;
    return profilePosts.find((p) => p.id === postDetailId) ?? null;
  }, [postDetailId, profilePosts]);
  const likesTarget: EnrichedPost | null = useMemo(() => {
    if (!likesPostId) return null;
    return profilePosts.find((post) => post.id === likesPostId) ?? null;
  }, [likesPostId, profilePosts]);

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
  const handleEditProfile = social.actions.updateProfile ? openEditProfile : undefined;
  const toggleFollowIgnoringResult = useCallback(
    async (userId: string) => {
      await social.actions.toggleFollow(userId);
    },
    [social.actions],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cleanups: Array<() => void> = [];

    // Web detection: works in mobile browser/PWA where window.innerHeight stays
    // constant and visualViewport.height shrinks with the keyboard.
    if (window.visualViewport) {
      const viewport = window.visualViewport;
      const updateKeyboardState = () => {
        setKeyboardOpen(window.innerHeight - viewport.height > 120);
      };
      updateKeyboardState();
      viewport.addEventListener("resize", updateKeyboardState);
      viewport.addEventListener("scroll", updateKeyboardState);
      cleanups.push(() => {
        viewport.removeEventListener("resize", updateKeyboardState);
        viewport.removeEventListener("scroll", updateKeyboardState);
      });
    }

    // Native detection via Capacitor Keyboard plugin. In iOS Capacitor with
    // resize:"native" the WebView itself shrinks, so the visualViewport
    // heuristic above never triggers. attachCapacitorKeyboardListeners is
    // fully defensive — it tolerates addListener returning a handle either
    // synchronously or as a Promise, and never throws (see keyboardDetection
    // unit tests). A previous version assumed a Promise and crashed the app
    // on login inside the native iOS shell.
    const capKeyboard = (
      window as unknown as {
        Capacitor?: { Plugins?: { Keyboard?: KeyboardPluginLike } };
      }
    ).Capacitor?.Plugins?.Keyboard;

    if (capKeyboard) {
      cleanups.push(
        attachCapacitorKeyboardListeners(capKeyboard, setKeyboardOpen),
      );
    }

    // Sprint 3 — Fase 3.4: dismiss global do teclado em tap-fora-de-input.
    // Sintoma reportado: "entra o teclado e não conseguimos tirar da tela".
    // Causa: no iOS WebView, tap em <button>/<div>/<span> não tira foco do
    // input ativo automaticamente, então o teclado nativo fica preso.
    // Solução: ouvir `pointerdown` na raiz e blur o input ativo se o user
    // tocou em algo que não é editável. Não interfere em buttons (eles já
    // disparam suas ações antes do blur), nem em sheets (o backdrop fecha
    // sheet E teclado juntos, comportamento desejado).
    function handleGlobalPointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      // Se tap caiu em (ou dentro de) um editor, mantém o foco.
      if (target.closest('input, textarea, [contenteditable="true"]')) return;
      const active = document.activeElement as HTMLElement | null;
      if (!active) return;
      const isEditable =
        active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.getAttribute("contenteditable") === "true";
      if (isEditable && typeof active.blur === "function") {
        active.blur();
      }
    }
    document.addEventListener("pointerdown", handleGlobalPointerDown);
    cleanups.push(() =>
      document.removeEventListener("pointerdown", handleGlobalPointerDown),
    );

    return () => cleanups.forEach((fn) => fn());
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (social.currentUser.streakLitToday || social.currentUser.currentStreak <= 0) return;

    const localHour = now.getHours();
    if (localHour < 18) return;

    const dayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
    }).format(now);
    const storageKey = `gym-circle:streak-risk-notified:${social.currentUser.id}:${dayKey}`;
    try {
      if (window.localStorage.getItem(storageKey)) return;
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Sem localStorage, evita bloquear a UX; no máximo o aviso aparece de novo.
    }

    const title = "Seu círculo ainda está apagado";
    const body = "Poste uma foto ou story do treino para manter sua presença de hoje.";
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((registration) =>
          registration.showNotification(title, {
            body,
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            tag: `streak-risk-${dayKey}`,
          }),
        )
        .catch(() => {
          new Notification(title, { body });
        });
      return;
    }
    new Notification(title, { body });
  }, [
    now,
    social.currentUser.currentStreak,
    social.currentUser.id,
    social.currentUser.streakLitToday,
  ]);

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

  const scrollFeedToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
    setScrollState("top");
  }, []);

  const handleAppScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const nextTop = event.currentTarget.scrollTop;
      const previousTop = lastScrollTopRef.current;
      const delta = nextTop - previousTop;
      lastScrollTopRef.current = nextTop;

      if (activeScreen !== "feed") return;
      // Thresholds 6/-8 absorvem micro-jitter do inertial scroll do iOS.
      if (nextTop <= 12) {
        setScrollState("top");
        return;
      }
      if (delta > 6) {
        setScrollState("down");
        setCreatePostButtonHiddenForSession(true);
        return;
      }
      if (delta < -8) setScrollState("up");
    },
    [activeScreen],
  );

  const handleBottomNavChange = useCallback(
    (screen: ScreenKey) => {
      if (screen === "feed" && activeScreen === "feed") {
        scrollFeedToTop();
        return;
      }
      if (screen === "feed") setScrollState("top");
      setActiveScreen(screen);
    },
    [activeScreen, scrollFeedToTop],
  );

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
      touchPullingToRefreshRef.current = false;
    },
    [activeScreen],
  );

  const handleTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (touchIgnoreScreenSwipeRef.current || refreshing) return;
    const startY = touchStartYRef.current;
    const startX = touchStartXRef.current;
    const touch = event.touches[0];
    touchLastXRef.current = touch?.clientX ?? touchLastXRef.current;
    touchLastYRef.current = touch?.clientY ?? touchLastYRef.current;
    if (startY === null || (scrollRef.current?.scrollTop ?? 0) > 0) return;
    const currentY = touch?.clientY ?? startY;
    const currentX = touch?.clientX ?? startX ?? 0;
    const delta = currentY - startY;
    const deltaX = startX === null ? 0 : currentX - startX;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }
    if (delta < 10 || delta < Math.abs(deltaX) * 1.25) return;
    touchPullingToRefreshRef.current = true;
    event.preventDefault();
    setPullDistance(Math.min(94, delta * 0.48));
  }, [refreshing]);

  const handleTouchEnd = useCallback(() => {
    const shouldRefresh = pullDistance > 62;
    const wasPullingToRefresh = touchPullingToRefreshRef.current;
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
    touchPullingToRefreshRef.current = false;
    setPullDistance(0);
    if (ignoreScreenSwipe) return;
    if (shouldRefresh) void triggerRefresh();
    if (
      wasPullingToRefresh ||
      shouldRefresh ||
      startX === null ||
      startY === null ||
      endX === null ||
      endY === null
    ) {
      return;
    }
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
    if (next) {
      if (next === "feed") setScrollState("top");
      setActiveScreen(next);
    }
  }, [pullDistance, screenOrder, triggerRefresh]);

  // Sprint 3.5.3: derivados do MyCircleSheet (próprio user OU outro).
  const myCircleUser = useMemo<EnrichedUser | null>(() => {
    if (!myCircleUserId) return null;
    if (myCircleUserId === social.currentUser.id) return social.currentUser;
    return usersById[myCircleUserId] ?? null;
  }, [myCircleUserId, social.currentUser, usersById]);
  const myCircleUserPosts = useMemo<EnrichedPost[]>(() => {
    if (!myCircleUserId) return [];
    return profilePosts.filter(
      (p) =>
        p.userId === myCircleUserId ||
        p.acceptedParticipants?.some((participant) => participant.id === myCircleUserId),
    );
  }, [profilePosts, myCircleUserId]);

  const profileSheetUser = profileOpenId ? usersById[profileOpenId] ?? null : null;
  const profileSheetPosts = useMemo(() => {
    if (!profileOpenId) return [];
    return profilePosts.filter(
      (p) =>
        p.userId === profileOpenId ||
        p.acceptedParticipants?.some((participant) => participant.id === profileOpenId),
    );
  }, [profilePosts, profileOpenId]);
  const currentUserPosts = useMemo(
    () =>
      profilePosts.filter(
        (p) =>
          p.userId === social.currentUser.id ||
          p.acceptedParticipants?.some(
            (participant) => participant.id === social.currentUser.id,
          ),
      ),
    [profilePosts, social.currentUser.id],
  );
  const monthlyRecap = useMemo(
    () => buildMonthlyRecap({ now, posts: currentUserPosts, user: social.currentUser }),
    [currentUserPosts, now, social.currentUser],
  );
  const recentPostLocations = useMemo(
    () =>
      getRecentPostLocations(
        social.currentUser.id,
        currentUserPosts,
        social.gyms ?? [],
      ),
    [currentUserPosts, social.currentUser.id, social.gyms],
  );
  const restoreCountdown = useMemo(
    () => formatRestoreCountdown(social.currentUser.streakRestoreDeadlineAt, now),
    [now, social.currentUser.streakRestoreDeadlineAt],
  );
  const canUseStreakRestore = Boolean(
    social.actions.useStreakRestore &&
      social.currentUser.streakRestoreStatus === "available" &&
      social.currentUser.streakRestoresAvailable > 0 &&
      restoreCountdown,
  );
  const restorePromptKey = canUseStreakRestore
    ? `${social.currentUser.streakRestoreMissedDate ?? "missed"}:${social.currentUser.streakRestoreDeadlineAt}`
    : null;
  const restorePromptOpen = Boolean(
    canUseStreakRestore &&
      restorePromptKey &&
      restorePromptDismissedKey !== restorePromptKey &&
      !confirmIntent,
  );
  const activeConfirmKind = restorePromptOpen ? "restore-streak" : confirmIntent?.kind ?? null;
  const storyGroups = useMemo(() => social.storyGroups ?? [], [social.storyGroups]);
  const selectedStoryId = social.selectedStory?.id ?? null;
  const selectedStorySequence = useMemo(
    () => social.selectedStoryGroup?.stories ?? [],
    [social.selectedStoryGroup?.stories],
  );
  const nextStoryId = useMemo(
    () => getAdjacentStoryId(selectedStorySequence, selectedStoryId, 1),
    [selectedStoryId, selectedStorySequence],
  );
  const previousStoryId = useMemo(
    () => getAdjacentStoryId(selectedStorySequence, selectedStoryId, -1),
    [selectedStoryId, selectedStorySequence],
  );

  // Sprint 2.3: pré-carrega + pré-decodifica a mídia da PRÓXIMA story
  // assim que o user abre uma. Quando avançar (swipe/tap), a próxima já
  // está pronta — troca instantânea sem flash preto.
  // Pula vídeos (file inteiro é grande demais; <video preload="metadata"
  // nativo já cuida do necessário).
  useEffect(() => {
    if (!nextStoryId) return;
    const nextStory = selectedStorySequence.find((s) => s.id === nextStoryId);
    if (!nextStory) return;
    if (nextStory.mediaType === "video") return;
    const src = nextStory.imageUrl;
    if (!src) return;
    void preloadImage(src);
  }, [nextStoryId, selectedStorySequence]);

  const currentUserStoryGroup = useMemo(
    () => storyGroups.find((group) => group.id === social.currentUser.id) ?? null,
    [social.currentUser.id, storyGroups],
  );
  const profileSheetStoryGroup = useMemo(
    () => (profileOpenId ? storyGroups.find((group) => group.id === profileOpenId) ?? null : null),
    [profileOpenId, storyGroups],
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
        .slice(0, 3)
        .map((post) => post.thumbnailUrl ?? post.imageUrl),
      ...social.storyBubbles
        .filter((story) => story.mediaType !== "video")
        .slice(0, 2)
        .map((story) => story.thumbnailUrl ?? story.imageUrl),
      ...storyGroups
        .flatMap((group) => group.stories)
        .filter((story) => story.mediaType !== "video")
        .slice(0, 2)
        .map((story) => story.thumbnailUrl ?? story.imageUrl),
      ...allUsers
        .map((user) => user.avatarUrl)
        .filter((url): url is string => Boolean(url))
        .slice(0, 8),
    ];

    for (const url of Array.from(new Set(urls))) {
      const image = new window.Image();
      image.decoding = "async";
      image.src = url;
    }
  }, [allUsers, social.feedPosts, social.storyBubbles, storyGroups]);

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
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenFollowers={() => void openFollowListOverlay("followers")}
            onOpenFollowing={() => void openFollowListOverlay("following")}
            onSelectUser={openProfile}
            onToggleFollow={toggleFollowIgnoringResult}
            posts={currentUserPosts}
            onOpenPost={openPostDetail}
            monthlyRecap={monthlyRecap}
            onOpenMonthlyRecap={() => setMonthlyRecapOpen(true)}
            onOpenMyCircle={() => openMyCircle(social.currentUser.id)}
            onUseStreakRestore={social.actions.useStreakRestore}
            onDismissProfileCompletionNotice={
              social.actions.dismissProfileCompletionNotice
            }
            hasStory={Boolean(currentUserStoryGroup)}
            storyViewed={currentUserStoryGroup?.viewed ?? false}
            onOpenStory={
              currentUserStoryGroup
                ? () => openStoryById(currentUserStoryGroup.id)
                : undefined
            }
          />
        );
      case "chat":
        return (
          <ChatScreen
            conversations={social.chatConversations ?? []}
            loading={social.chatLoading && !social.chatHydrated}
            messages={social.chatMessages ?? []}
            currentUser={social.currentUser}
            knownUsers={allUsers}
            onConversationOpen={social.actions.markChatConversationRead}
            onCreateGroupConversation={social.actions.createGroupConversation}
            onDeleteConversation={social.actions.deleteChatConversation}
            onDeleteConversationById={social.actions.deleteChatConversationById}
            onSearchUsers={social.actions.searchProfiles}
            onSendMessage={social.actions.sendChatMessage}
            onSelectUser={openProfile}
            onSelectedUserIdChange={setChatTargetUserId}
            onThreadOpen={social.actions.markChatThreadRead}
            onThreadViewChange={setChatThreadOpen}
            onUploadImage={onUploadChatImage}
            selectedUserId={chatTargetUserId}
            selectedUser={chatTargetUserId ? usersById[chatTargetUserId] ?? null : null}
            suggestedUsers={social.suggestedUsers}
          />
        );
      case "post":
        return (
          <PostScreen
            currentUser={social.currentUser}
            gyms={social.gyms ?? []}
            onCatalogPlace={social.actions.catalogPlace}
            onPublish={async (input) => {
              await social.actions.publishWorkout(input);
              setScrollState("top");
              setActiveScreen("feed");
            }}
            onUploadImage={onUploadImage}
            recentLocations={recentPostLocations}
            taggableUsers={allUsers.filter((user) => user.id !== social.currentUser.id)}
          />
        );
      case "checkin":
        return (
          <CheckInScreen
            currentUser={social.currentUser}
            gyms={social.gyms ?? []}
            onCatalogPlace={social.actions.catalogPlace}
            onCheckIn={social.actions.checkIn}
            onSelectUser={openProfile}
            posts={social.feedPosts}
            users={social.users ?? {}}
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
            headerHidden={scrollState === "down"}
            feedHasMore={social.feedHasMore}
            feedLoadingMore={social.feedLoadingMore}
            onCreatePost={() => setActiveScreen("post")}
            onLikePost={social.actions.likePost}
            onLoadMoreFeed={social.actions.loadMoreFeed}
            onOpenLikes={openLikes}
            // Sprint 3.6.6 bug fix: este wire estava errado —
            // `social.actions.refreshPostDetails` é só uma DATA action
            // (refetch likes/comments do post), não abre o sheet. O
            // handler local `openPostDetail` faz `setPostDetailId(postId)`
            // E chama o refresh em paralelo (linhas 299-305). Sem isso,
            // clicar em "comentar" no feed só refazia o fetch sem abrir
            // o `CommentsBottomSheet` — o user reportou "não consegue
            // comentar em posts de outras pessoas".
            // Pattern correto: as linhas 883/1128 já usam `openPostDetail`
            // pro mesmo callback (`onOpenPost`) nos profile sheets.
            onOpenPostDetails={openPostDetail}
            onOpenPostMenu={openPostMenu}
            onOpenStory={social.actions.openStory}
            onSharePostToChat={social.actions.sharePostToChat}
            onDismissViewerLocationPrompt={viewerLocation.dismiss}
            onRequestViewerLocation={viewerLocation.request}
            onSelectUser={openProfile}
            onToggleFollow={toggleFollowIgnoringResult}
            resolveUser={resolveUser}
            stories={storyGroups}
            postShareTargets={followedUsers}
            suggestedUsers={social.suggestedUsers}
            viewerLocationError={viewerLocation.error}
            viewerLocationStatus={viewerLocation.status}
            loading={Boolean(social.homeLoading)}
          />
        );
    }
  }, [
    activeScreen,
    chatTargetUserId,
    allUsers,
    followedUsers,
    feedPosts,
    scrollState,
    hasDistancePosts,
    social,
    onUploadImage,
    onUploadChatImage,
    handleEditProfile,
    toggleFollowIgnoringResult,
    openAdmin,
    openProfile,
    openFollowListOverlay,
    openPostDetail,
    openLikes,
    usersById,
    resolveUser,
    openPostMenu,
    currentUserPosts,
    monthlyRecap,
    recentPostLocations,
    currentUserStoryGroup,
    storyGroups,
    openStoryById,
    viewerLocation.dismiss,
    viewerLocation.error,
    viewerLocation.request,
    viewerLocation.status,
  ]);

  return (
    <SearchSheetProvider value={sheetContextValue}>
      <main className="min-h-[100dvh] bg-black text-white">
        <div className="relative mx-auto h-[100dvh] min-h-[100dvh] w-full max-w-none overflow-hidden bg-black shadow-none sm:max-w-[480px] lg:border-x lg:border-white/[0.06] lg:shadow-[0_0_90px_rgba(0,0,0,0.92)]">
          <div className="gc-phone-shell relative h-full">
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
            {/* Scroll area ocupa a tela inteira; BottomNav abaixo é posicionado
                absolute pra eliminar a faixa preta que ficava atrás dele no
                layout flex-col anterior. O feed sangra até o fundo, e o pill
                do tab bar com backdrop-blur sobrepõe o conteúdo (iOS-style). */}
            <div
              className="gc-scrollbar h-full overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+96px)]"
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
              onTouchStart={handleTouchStart}
              onScroll={handleAppScroll}
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
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
                <div className="pointer-events-auto">
                  <BottomNav
                    active={activeScreen}
                    hidden={activeScreen === "feed" && scrollState === "up"}
                    onChange={handleBottomNavChange}
                    unreadMessages={social.unreadMessages ?? 0}
                  />
                </div>
              </div>
            ) : null}
          </div>
          {activeScreen === "feed" && !keyboardOpen ? (
            <FloatingCreatePostButton
              hidden={createPostButtonHiddenForSession}
              onClick={() => setActiveScreen("post")}
            />
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
            onUnfollowUser={toggleFollowIgnoringResult}
            shareTargets={social.suggestedUsers.filter((user) => user.id !== social.currentUser.id)}
            story={social.selectedStory}
          />
          <UserSearchSheet
            currentUserId={social.currentUser.id}
            onClose={closeSearch}
            onSelectUser={(userId) => {
              closeSearch();
              openProfile(userId);
            }}
            onToggleFollow={(userId) => {
              void social.actions.toggleFollow(userId);
            }}
            onSearchUsers={social.actions.searchProfiles}
            open={searchOpen}
            users={allUsers}
          />
          <ProfileSheet
            currentUserId={social.currentUser.id}
            onBlockUser={social.actions.blockUser}
            onClose={closeProfile}
            onMessageUser={openChatWithUser}
            onReportUser={social.actions.reportUser}
            hasStory={Boolean(profileSheetStoryGroup)}
            storyViewed={profileSheetStoryGroup?.viewed ?? false}
            onOpenStory={
              profileSheetStoryGroup
                ? () => {
                    closeProfile();
                    openStoryById(profileSheetStoryGroup.id);
                  }
                : undefined
            }
            onToggleFollow={toggleFollowIgnoringResult}
            open={profileOpenId !== null}
            onOpenMyCircle={() => profileSheetUser && openMyCircle(profileSheetUser.id)}
            onOpenPost={openPostDetail}
            posts={profileSheetPosts}
            user={profileSheetUser}
          />
          <MyCircleSheet
            hasStory={
              myCircleUser?.id === social.currentUser.id
                ? Boolean(currentUserStoryGroup)
                : Boolean(profileSheetStoryGroup)
            }
            isOwn={myCircleUser?.id === social.currentUser.id}
            onClose={closeMyCircle}
            open={myCircleUserId !== null}
            posts={myCircleUserPosts}
            storyViewed={
              myCircleUser?.id === social.currentUser.id
                ? currentUserStoryGroup?.viewed ?? false
                : profileSheetStoryGroup?.viewed ?? false
            }
            user={myCircleUser}
          />
          <CommentsBottomSheet
            currentUser={social.currentUser}
            currentUserId={social.currentUser.id}
            formatTime={social.formatPostClock}
            mentionUsers={followedUsers}
            onClose={closePostDetail}
            onCommentPost={social.actions.commentPost}
            onDeleteComment={social.actions.deleteComment}
            onLikeComment={social.actions.likeComment}
            onSelectUser={(userId) => {
              closePostDetail();
              openProfile(userId);
            }}
            open={postDetailId !== null}
            post={postDetailTarget}
            resolveUser={resolveUser}
          />
          <LikesOverlay
            currentUserId={social.currentUser.id}
            onClose={closeLikes}
            onSelectUser={(userId) => {
              closeLikes();
              openProfile(userId);
            }}
            onToggleFollow={toggleFollowIgnoringResult}
            open={likesPostId !== null}
            users={
              likesTarget
                ? getLikesOverlayUsers({
                    currentUserId: social.currentUser.id,
                    likedByPreview: likesTarget.likedByPreview,
                    likedByUsers: likesTarget.likedByUsers,
                    postOwnerId: likesTarget.userId,
                  })
                : []
            }
          />
          <FollowListOverlay
            currentUserId={social.currentUser.id}
            kind={followListOverlay?.kind ?? "followers"}
            loading={followListOverlay?.loading ?? false}
            onClose={closeFollowListOverlay}
            onSelectUser={(userId) => {
              closeFollowListOverlay();
              openProfile(userId);
            }}
            onToggleFollow={toggleFollowFromFollowList}
            open={followListOverlay !== null}
            users={followListOverlay?.users ?? []}
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
              onCatalogPlace={social.actions.catalogPlace}
              onSave={social.actions.updateProfile}
              onUploadAvatar={onUploadAvatar}
              open={editOpen}
            />
          ) : null}
          <NotificationsSheet
            currentUserId={social.currentUser.id}
            onAcceptFollowRequest={social.actions.acceptFollowRequest}
            onAcceptPostTag={social.actions.acceptPostTag}
            onAcceptStoryTag={social.actions.acceptStoryTag}
            onClose={closeNotifications}
            onFollowBack={social.actions.toggleFollow}
            onRejectFollowRequest={social.actions.rejectFollowRequest}
            onRejectPostTag={social.actions.rejectPostTag}
            onRejectStoryTag={social.actions.rejectStoryTag}
            onSelectUser={(userId) => {
              setNotificationsOpen(false);
              openProfile(userId);
            }}
            open={notificationsOpen}
            users={usersById}
          />
          <AdminPanelSheet onClose={closeAdmin} open={adminOpen} />
          <AccountSettingsSheet
            onClose={() => setSettingsOpen(false)}
            onDeleteAccount={
              social.actions.requestAccountDeletion
                ? () => {
                    setSettingsOpen(false);
                    setConfirmIntent({ kind: "delete-account" });
                  }
                : undefined
            }
            onSignOut={
              signOut
                ? () => {
                    setSettingsOpen(false);
                    setConfirmIntent({ kind: "sign-out" });
                  }
                : undefined
            }
            onSuspendAccount={
              social.actions.suspendAccount
                ? () => {
                    setSettingsOpen(false);
                    setConfirmIntent({ kind: "suspend-account" });
                  }
                : undefined
            }
            open={settingsOpen}
          />
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
            onMute={() => {
              const userId = postMenuTarget?.userId;
              setPostMenuId(null);
              if (userId) void social.actions.mutePostAuthor?.(userId);
            }}
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
              taggableUsers={allUsers.filter((user) => user.id !== social.currentUser.id)}
            />
          ) : null}
          <ConfirmSheet
            cancelLabel="Cancelar"
            confirmLabel={
              activeConfirmKind === "delete-account"
                ? "Excluir minha conta"
                : activeConfirmKind === "suspend-account"
                  ? "Suspender conta"
                  : activeConfirmKind === "sign-out"
                    ? "Sair"
                    : activeConfirmKind === "restore-streak"
                      ? "Restaurar"
                      : "Apagar post"
            }
            description={
              activeConfirmKind === "delete-account"
                ? "Seu perfil será desativado e o pedido fica pendente pra processamento interno. Você pode pedir restauração contatando suporte antes do prazo final."
                : activeConfirmKind === "suspend-account"
                  ? "Sua conta ficará oculta do feed, busca, stories e sugestões. Você será desconectado e receberá um link por email para reativar."
                  : activeConfirmKind === "sign-out"
                    ? "Você volta para a tela inicial. Sua conta continua ativa e seus dados permanecem salvos."
                    : activeConfirmKind === "restore-streak"
                      ? `Use 1 restaurador para proteger o dia que passou. ${restoreCountdown ?? "A janela está quase acabando."}`
                      : "Não dá pra desfazer. O post some do feed e do seu perfil."
            }
            onClose={() => {
              if (restorePromptOpen && restorePromptKey) {
                setRestorePromptDismissedKey(restorePromptKey);
                return;
              }
              setConfirmIntent(null);
            }}
            onConfirm={async () => {
              if (restorePromptOpen) {
                if (restorePromptKey) setRestorePromptDismissedKey(restorePromptKey);
                await social.actions.useStreakRestore?.();
                return;
              }
              const intent = confirmIntent;
              if (!intent) return;
              setConfirmIntent(null);
              if (intent.kind === "delete-post" && deletePost) {
                if (postDetailId === intent.postId) closePostDetail();
                await deletePost(intent.postId);
                return;
              }
              if (intent.kind === "delete-account") {
                await social.actions.requestAccountDeletion?.(
                  "Solicitado pelo usuário no app",
                );
                return;
              }
              if (intent.kind === "suspend-account") {
                await social.actions.suspendAccount?.();
                return;
              }
              if (intent.kind === "sign-out") {
                await social.actions.signOut?.();
                return;
              }
              if (intent.kind === "restore-streak") {
                await social.actions.useStreakRestore?.();
              }
            }}
            open={Boolean(activeConfirmKind)}
            title={
              activeConfirmKind === "delete-account"
                ? "Excluir sua conta?"
                : activeConfirmKind === "suspend-account"
                  ? "Suspender sua conta?"
                  : activeConfirmKind === "sign-out"
                    ? "Sair da conta?"
                    : activeConfirmKind === "restore-streak"
                      ? "Restaurar streak?"
                      : "Apagar esse post?"
            }
            tone={
              activeConfirmKind === "restore-streak" || activeConfirmKind === "sign-out"
                ? "default"
                : "destructive"
            }
          />
          <ToastFeedback feedback={social.feedback} />
        </div>
      </main>
    </SearchSheetProvider>
  );
}

function formatRestoreCountdown(deadlineAt: string | null | undefined, now: Date) {
  if (!deadlineAt) return null;
  const diff = new Date(deadlineAt).getTime() - now.getTime();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.max(1, Math.ceil((diff % 3600000) / 60000));
  if (hours <= 0) return `Restam ${minutes}min`;
  return `Restam ${hours}h`;
}

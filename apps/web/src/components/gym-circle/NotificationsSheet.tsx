"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AtSign,
  BellRing,
  Check,
  Heart,
  Loader2,
  MessageCircle,
  UserCheck,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import {
  isSocialBellNotificationKind,
  type NotificationRow,
  type ProfileRow,
  type SocialBellNotificationKind,
} from "@gym-circle/core";
import { Avatar } from "@/components/ui/Avatar";
import {
  getFollowCtaState,
  normalizeFollowActionResult,
} from "./social/followCta";
import type { EnrichedUser, FollowActionResult, FollowStatus } from "./social/types";

// ---------------------------------------------------------------------
// Sprint 10.5 — Hidratação dinâmica de actors de notificação.
//
// O `users` prop vem do parent (`usersById`) hidratado uma vez no boot.
// Notificações que chegam DEPOIS do boot (user novo seguiu, curtiu, etc)
// têm actor_id ausente nesse dict → cai no fallback "Alguém" + avatar "?".
//
// Fix: após carregar a lista de notifs, coletar os actor_id sem
// correspondência e fazer fetch batch via profilesService.byUserIds().
// Mantemos um state local `actorsExtra` que merge no render.
// ---------------------------------------------------------------------

const ACCENT_PALETTE = [
  "var(--gc-brand)",
  "var(--gc-consistency-month)",
  "var(--gc-blue)",
  "var(--gc-consistency-year)",
  "var(--gc-consistency-daily)",
  "var(--gc-consistency-mid)",
];

function accentForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ACCENT_PALETTE[Math.abs(hash) % ACCENT_PALETTE.length];
}

/**
 * Converte ProfileRow num EnrichedUser "magro" pra display de notif.
 * Campos não relevantes pra notif (stats, achievements, etc) recebem
 * defaults seguros. Se o user for selecionado, abre o ProfileSheet
 * completo que faz seu próprio fetch — não vamos cair em UI broken.
 */
function actorFromProfileRow(row: ProfileRow): EnrichedUser {
  return {
    id: row.user_id,
    createdAt: row.created_at ?? undefined,
    name: row.display_name ?? row.username ?? "Gym Circle",
    username: row.username ?? "usuario",
    accent: accentForId(row.user_id),
    avatarUrl: row.avatar_url ?? null,
    bio: row.bio ?? "",
    goal: row.fitness_goal ?? "",
    instagramUsername: row.instagram_username ?? null,
    birthDate: row.birth_date ?? null,
    age: null,
    isBirthday: false,
    sports: row.sports ?? [],
    onboardingCompletedAt: null,
    profileCompletionNoticeDismissed: false,
    alphaTermsAcceptedAt: null,
    privacyPolicyAcceptedAt: null,
    accountStatus: row.account_status ?? "active",
    suspendedAt: null,
    reactivationSentAt: null,
    reactivationExpiresAt: null,
    mainGymId: row.main_gym_id ?? null,
    location: "",
    gyms: [],
    preferredTimes: row.preferred_training_times ?? [],
    currentStreak: 0,
    longestStreak: 0,
    lastWorkoutDate: "",
    workoutsThisWeek: 0,
    workoutsThisMonth: 0,
    activeDaysCount: 0,
    streakRestoresAvailable: 0,
    lastStreakRestoreUsedAt: null,
    lastStreakRestoreEarnedAt: null,
    streakRestoreDeadlineAt: null,
    streakRestoreMissedDate: null,
    streakRestoreStatus: null,
    checkInsCount: 0,
    achievements: [],
    followersCount: 0,
    followingCount: 0,
    isFollowing: false,
    followStatus: "none",
    isPrivate: row.is_private ?? false,
    workoutDays: [],
    streakLitToday: false,
    streakPresenceSource: "none",
  };
}

type NotificationsSheetProps = {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  users: Record<string, EnrichedUser>;
  onSelectUser?: (userId: string) => void;
  onFollowBack?: (userId: string) => void | FollowActionResult | Promise<void | FollowActionResult>;
  onAcceptFollowRequest?: (requesterId: string) => void | Promise<void>;
  onRejectFollowRequest?: (requesterId: string) => void | Promise<void>;
  onAcceptPostTag?: (postId: string) => void | Promise<void>;
  onRejectPostTag?: (postId: string) => void | Promise<void>;
  onAcceptStoryTag?: (storyId: string) => void | Promise<void>;
  onRejectStoryTag?: (storyId: string) => void | Promise<void>;
};

type TagDecision = "accepted" | "rejected";
type TagDecisionOverrides = Record<string, TagDecision>;

const KIND_ICON = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  mention: AtSign,
  follow_request: BellRing,
  story_like: Heart,
  post_tag: AtSign,
  story_tag: AtSign,
} satisfies Record<SocialBellNotificationKind, LucideIcon>;

// Mapping de notification kind → key i18n. Resolve via t() no JSX.
const KIND_LABEL_KEY = {
  like: "notificationsSheet.kinds.like",
  comment: "notificationsSheet.kinds.comment",
  follow: "notificationsSheet.kinds.follow",
  mention: "notificationsSheet.kinds.mention",
  follow_request: "notificationsSheet.kinds.followRequest",
  story_like: "notificationsSheet.kinds.storyLike",
  post_tag: "notificationsSheet.kinds.postTag",
  story_tag: "notificationsSheet.kinds.storyTag",
} satisfies Record<SocialBellNotificationKind, string>;

// t function type (matches react-i18next's TFunction return signature)
type TFn = (key: string, options?: Record<string, unknown>) => string;

const KIND_TONE = {
  like: "text-[var(--gc-consistency-month)]",
  comment: "text-[var(--gc-brand)]",
  follow: "text-[var(--gc-consistency-month)]",
  mention: "text-[var(--gc-consistency-daily)]",
  follow_request: "text-[var(--gc-brand)]",
  story_like: "text-[var(--gc-consistency-month)]",
  post_tag: "text-[var(--gc-brand)]",
  story_tag: "text-[var(--gc-brand)]",
} satisfies Record<SocialBellNotificationKind, string>;

function normalizeNotificationKind(kind: string): SocialBellNotificationKind | null {
  return isSocialBellNotificationKind(kind) ? kind : null;
}

function formatRelative(iso: string, now: number, t: TFn): string {
  const diff = now - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return t("notificationsSheet.relative.now");
  const min = Math.floor(sec / 60);
  if (min < 60) return t("notificationsSheet.relative.min", { count: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("notificationsSheet.relative.hour", { count: hr });
  const days = Math.floor(hr / 24);
  return t("notificationsSheet.relative.day", { count: days });
}

export function NotificationsSheet({
  open,
  onClose,
  currentUserId,
  users,
  onSelectUser,
  onFollowBack,
  onAcceptFollowRequest,
  onRejectFollowRequest,
  onAcceptPostTag,
  onRejectPostTag,
  onAcceptStoryTag,
  onRejectStoryTag,
}: NotificationsSheetProps) {
  const { t } = useTranslation();
  const services = useGymCircleServices();
  const [items, setItems] = useState<NotificationRow[]>([]);
  // Sprint 10.5 — actors hidratados dinamicamente além do `users` prop.
  const [actorsExtra, setActorsExtra] = useState<Record<string, EnrichedUser>>({});
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [followBackBusyId, setFollowBackBusyId] = useState<string | null>(null);
  const [followBackOverrides, setFollowBackOverrides] = useState<
    Record<string, FollowStatus>
  >({});
  const [tagActionBusyId, setTagActionBusyId] = useState<string | null>(null);
  const [tagDecisionOverrides, setTagDecisionOverrides] = useState<TagDecisionOverrides>(
    {},
  );

  const followBack = useCallback(
    async (userId: string) => {
      if (!onFollowBack) return;
      setFollowBackBusyId(userId);
      try {
        const result = await onFollowBack(userId);
        const next = normalizeFollowActionResult(result);
        if (next) {
          setFollowBackOverrides((current) => ({ ...current, [userId]: next }));
        }
      } finally {
        setFollowBackBusyId(null);
      }
    },
    [onFollowBack],
  );

  const hydrateTagDecisions = useCallback(
    async (list: NotificationRow[]) => {
      const postIds = Array.from(
        new Set(
          list
            .filter(
              (notification) =>
                normalizeNotificationKind(notification.kind) === "post_tag" &&
                Boolean(notification.post_id),
            )
            .map((notification) => notification.post_id as string),
        ),
      );
      const storyIds = Array.from(
        new Set(
          list
            .filter(
              (notification) =>
                normalizeNotificationKind(notification.kind) === "story_tag" &&
                Boolean(notification.story_id),
            )
            .map((notification) => notification.story_id as string),
        ),
      );

      const [postResult, storyResult] = await Promise.all([
        postIds.length > 0
          ? services.client
              .from("post_participants")
              .select("post_id,status")
              .eq("tagged_user_id", currentUserId)
              .in("post_id", postIds)
          : Promise.resolve({ data: [], error: null }),
        storyIds.length > 0
          ? services.client
              .from("story_participants")
              .select("story_id,status")
              .eq("tagged_user_id", currentUserId)
              .in("story_id", storyIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (postResult.error || storyResult.error) {
        return { decisions: {} as TagDecisionOverrides, items: list };
      }

      const postStatusById = new Map(
        ((postResult.data ?? []) as Array<{ post_id: string; status: string | null }>).map(
          (row) => [row.post_id, row.status],
        ),
      );
      const storyStatusById = new Map(
        ((storyResult.data ?? []) as Array<{ story_id: string; status: string | null }>).map(
          (row) => [row.story_id, row.status],
        ),
      );
      const decisions: TagDecisionOverrides = {};
      const items = list.filter((notification) => {
        const kind = normalizeNotificationKind(notification.kind);
        if (kind === "post_tag" && notification.post_id) {
          const status = postStatusById.get(notification.post_id);
          if (!status) return false;
          if (status === "rejected") return false;
          if (status === "accepted") decisions[notification.id] = "accepted";
        }
        if (kind === "story_tag" && notification.story_id) {
          const status = storyStatusById.get(notification.story_id);
          if (!status) return false;
          if (status === "rejected") return false;
          if (status === "accepted") decisions[notification.id] = "accepted";
        }
        return true;
      });

      return { decisions, items };
    },
    [currentUserId, services.client],
  );

  const refresh = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const list = await services.notifications.listForUser(currentUserId);
      const { decisions, items: visibleItems } = await hydrateTagDecisions(list);
      setTagDecisionOverrides(decisions);
      setItems(visibleItems);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, hydrateTagDecisions, open, services.notifications]);

  const acceptPostTag = useCallback(
    async (notification: NotificationRow) => {
      if (!notification.post_id || !onAcceptPostTag) return;
      setTagActionBusyId(notification.id);
      try {
        await onAcceptPostTag(notification.post_id);
        setTagDecisionOverrides((current) => ({
          ...current,
          [notification.id]: "accepted",
        }));
      } finally {
        setTagActionBusyId(null);
      }
    },
    [onAcceptPostTag],
  );

  const rejectPostTag = useCallback(
    async (notification: NotificationRow) => {
      if (!notification.post_id || !onRejectPostTag) return;
      setTagActionBusyId(notification.id);
      try {
        await onRejectPostTag(notification.post_id);
        setTagDecisionOverrides((current) => ({
          ...current,
          [notification.id]: "rejected",
        }));
        setItems((current) => current.filter((item) => item.id !== notification.id));
      } finally {
        setTagActionBusyId(null);
      }
    },
    [onRejectPostTag],
  );

  const acceptStoryTag = useCallback(
    async (notification: NotificationRow) => {
      if (!notification.story_id || !onAcceptStoryTag) return;
      setTagActionBusyId(notification.id);
      try {
        await onAcceptStoryTag(notification.story_id);
        setTagDecisionOverrides((current) => ({
          ...current,
          [notification.id]: "accepted",
        }));
      } finally {
        setTagActionBusyId(null);
      }
    },
    [onAcceptStoryTag],
  );

  const rejectStoryTag = useCallback(
    async (notification: NotificationRow) => {
      if (!notification.story_id || !onRejectStoryTag) return;
      setTagActionBusyId(notification.id);
      try {
        await onRejectStoryTag(notification.story_id);
        setTagDecisionOverrides((current) => ({
          ...current,
          [notification.id]: "rejected",
        }));
        setItems((current) => current.filter((item) => item.id !== notification.id));
      } finally {
        setTagActionBusyId(null);
      }
    },
    [onRejectStoryTag],
  );

  useEffect(() => {
    if (!open) return;
    const refreshId = window.setTimeout(() => {
      setNow(Date.now());
      void refresh();
    }, 0);
    const channel = services.client
      .channel(`notifications:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      window.clearTimeout(refreshId);
      services.client.removeChannel(channel);
    };
  }, [services, currentUserId, open, refresh]);

  // Sprint 10.5 — hidrata actor_ids que faltam no `users` prop.
  // Dispara quando items muda. Idempotente: só busca ids ainda ausentes
  // em users + actorsExtra. Falha graceful: erros ficam silenciosos pq
  // o fallback "Alguém" continua visível, nunca quebra a tela.
  useEffect(() => {
    if (!open || items.length === 0) return;
    const wanted = new Set<string>();
    for (const n of items) {
      if (!n.actor_id) continue;
      if (users[n.actor_id]) continue;
      if (actorsExtra[n.actor_id]) continue;
      wanted.add(n.actor_id);
    }
    if (wanted.size === 0) return;
    let cancelled = false;
    void services.profiles
      .byUserIds(Array.from(wanted))
      .then((rows) => {
        if (cancelled || rows.length === 0) return;
        setActorsExtra((current) => {
          const next = { ...current };
          for (const row of rows) {
            next[row.user_id] = actorFromProfileRow(row);
          }
          return next;
        });
      })
      .catch(() => {
        // ignore: fallback "Alguém" continua exibido
      });
    return () => {
      cancelled = true;
    };
  }, [items, open, services.profiles, users, actorsExtra]);

  // Sprint 10.5 — merge final usado em todas as renderizações.
  const mergedUsers = useMemo<Record<string, EnrichedUser>>(
    () => ({ ...users, ...actorsExtra }),
    [users, actorsExtra],
  );

  // Marca todas como lidas quando o sheet abre
  useEffect(() => {
    if (!open) return;
    services.notifications.markAllRead(currentUserId).catch(() => {
      /* ignora */
    });
  }, [open, services, currentUserId]);

  const grouped = useMemo(() => {
    const today: NotificationRow[] = [];
    const earlier: NotificationRow[] = [];
    for (const n of items.filter((item) => isSocialBellNotificationKind(item.kind))) {
      if (now - new Date(n.created_at).getTime() < 24 * 60 * 60 * 1000) today.push(n);
      else earlier.push(n);
    }
    return { today, earlier };
  }, [items, now]);

  if (!open) return null;

  return (
    <div className="gc-safe-overlay absolute inset-0 z-50 bg-black/94 backdrop-blur-2xl">
      <div className="relative mx-auto flex h-full max-h-[840px] min-h-[620px] flex-col overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#0a0b0c] shadow-[0_28px_72px_rgba(0,0,0,0.7)]">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4">
          <p className="text-[17px] font-black">{t("notificationsSheet.title")}</p>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && items.length === 0 ? (
            <p className="mt-10 text-center text-[13px] font-bold text-white/52">
              {t("notificationsSheet.loading")}
            </p>
          ) : items.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <p className="text-[16px] font-black">
                  {t("notificationsSheet.empty.title")}
                </p>
                <p className="mt-2 text-[13px] font-bold text-white/52">
                  {t("notificationsSheet.empty.detail")}
                </p>
              </div>
            </div>
          ) : (
            <>
              {grouped.today.length > 0 ? (
                <Section
                  now={now}
                  title={t("notificationsSheet.sections.today")}
                  items={grouped.today}
                  users={mergedUsers}
                  onSelectUser={onSelectUser}
                  onFollowBack={followBack}
                  followBackBusyId={followBackBusyId}
                  followBackOverrides={followBackOverrides}
                  onAcceptFollowRequest={onAcceptFollowRequest}
                  onRejectFollowRequest={onRejectFollowRequest}
                  onAcceptPostTag={acceptPostTag}
                  onRejectPostTag={rejectPostTag}
                  onAcceptStoryTag={acceptStoryTag}
                  onRejectStoryTag={rejectStoryTag}
                  tagActionBusyId={tagActionBusyId}
                  tagDecisionOverrides={tagDecisionOverrides}
                />
              ) : null}
              {grouped.earlier.length > 0 ? (
                <Section
                  now={now}
                  title={t("notificationsSheet.sections.earlier")}
                  items={grouped.earlier}
                  users={mergedUsers}
                  onSelectUser={onSelectUser}
                  onFollowBack={followBack}
                  followBackBusyId={followBackBusyId}
                  followBackOverrides={followBackOverrides}
                  onAcceptFollowRequest={onAcceptFollowRequest}
                  onRejectFollowRequest={onRejectFollowRequest}
                  onAcceptPostTag={acceptPostTag}
                  onRejectPostTag={rejectPostTag}
                  onAcceptStoryTag={acceptStoryTag}
                  onRejectStoryTag={rejectStoryTag}
                  tagActionBusyId={tagActionBusyId}
                  tagDecisionOverrides={tagDecisionOverrides}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  users,
  now,
  onSelectUser,
  onFollowBack,
  followBackBusyId,
  followBackOverrides,
  onAcceptFollowRequest,
  onRejectFollowRequest,
  onAcceptPostTag,
  onRejectPostTag,
  onAcceptStoryTag,
  onRejectStoryTag,
  tagActionBusyId,
  tagDecisionOverrides,
}: {
  title: string;
  items: NotificationRow[];
  users: Record<string, EnrichedUser>;
  now: number;
  onSelectUser?: (userId: string) => void;
  onFollowBack?: (userId: string) => void | FollowActionResult | Promise<void | FollowActionResult>;
  followBackBusyId?: string | null;
  followBackOverrides?: Record<string, FollowStatus>;
  onAcceptFollowRequest?: (requesterId: string) => void | Promise<void>;
  onRejectFollowRequest?: (requesterId: string) => void | Promise<void>;
  onAcceptPostTag?: (notification: NotificationRow) => void | Promise<void>;
  onRejectPostTag?: (notification: NotificationRow) => void | Promise<void>;
  onAcceptStoryTag?: (notification: NotificationRow) => void | Promise<void>;
  onRejectStoryTag?: (notification: NotificationRow) => void | Promise<void>;
  tagActionBusyId?: string | null;
  tagDecisionOverrides?: TagDecisionOverrides;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-[12px] font-black uppercase text-white/42">{title}</h3>
      <ul className="space-y-2">
        {items.map((n) => {
          const kind = normalizeNotificationKind(n.kind);
          if (!kind) return null;
          const Icon = KIND_ICON[kind];
          const tone = KIND_TONE[kind];
          const actor = users[n.actor_id];
          const unread = !n.read_at;
          const isFollowRequest = kind === "follow_request";
          const isFollowNotification = kind === "follow";
          const isPostTag = kind === "post_tag" && Boolean(n.post_id);
          const isStoryTag = kind === "story_tag" && Boolean(n.story_id);
          const tagDecision = tagDecisionOverrides?.[n.id];
          const tagActionBusy = tagActionBusyId === n.id;
          const showPostTagActions = Boolean(
            isPostTag &&
              tagDecision !== "accepted" &&
              tagDecision !== "rejected" &&
              onAcceptPostTag &&
              onRejectPostTag,
          );
          const showStoryTagActions = Boolean(
            isStoryTag &&
              tagDecision !== "accepted" &&
              tagDecision !== "rejected" &&
              onAcceptStoryTag &&
              onRejectStoryTag,
          );
          const followBackState = actor
            ? getFollowCtaState({
                isFollowBackContext: true,
                overrideStatus: followBackOverrides?.[actor.id],
                user: actor,
              })
            : null;
          const canFollowBack = Boolean(
            isFollowNotification &&
              actor &&
              onFollowBack &&
              followBackState &&
              !followBackState.disabled,
          );
          const followBackBusy = Boolean(actor && followBackBusyId === actor.id);
          // Se o solicitante já foi aprovado em outra aba (followStatus 'accepted')
          // ou se a relação não existe mais (none), oculta os botões.
          const stillPending =
            isFollowRequest && actor?.followStatus !== "accepted";
          return (
            <li
              className={[
                "flex flex-col gap-3 rounded-[20px] border p-3",
                unread
                  ? "border-[var(--gc-brand)]/24 bg-[var(--gc-brand)]/6"
                  : "border-white/[0.06] bg-white/[0.02]",
              ].join(" ")}
              key={n.id}
            >
              <div className="flex items-center gap-3">
                <button
                  aria-label={t("notificationsSheet.viewActorAria", {
                    name: actor?.name ?? t("notificationsSheet.actorFallback"),
                  })}
                  className="gc-pressable shrink-0"
                  // Sprint 11.2 — abre por actor_id direto (não depende do
                  // objeto `actor` estar hidratado). A ProfileSheet faz seu
                  // próprio fetch por ID; gatear em `actor` deixava o tap
                  // morto enquanto a hidratação async não completava (ou
                  // nunca, se RLS bloqueasse o profile no batch).
                  onClick={() => {
                    if (n.actor_id) onSelectUser?.(n.actor_id);
                  }}
                  type="button"
                >
                  <Avatar
                    accent={actor?.accent ?? "var(--gc-brand)"}
                    name={actor?.name ?? "?"}
                    src={actor?.avatarUrl ?? undefined}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-white/82">
                    <button
                      className="gc-pressable text-white"
                      // Sprint 11.2 — abre por actor_id direto (ver comment no avatar acima)
                      onClick={() => {
                        if (n.actor_id) onSelectUser?.(n.actor_id);
                      }}
                      type="button"
                    >
                      {actor?.name ?? t("notificationsSheet.actorFallback")}
                    </button>{" "}
                    <span className="font-semibold text-white/64">{t(KIND_LABEL_KEY[kind])}</span>
                  </p>
                  {n.body ? (
                    <p className="mt-0.5 truncate text-[12px] font-semibold text-white/52">
                      &ldquo;{n.body}&rdquo;
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {isFollowNotification && actor ? (
                    <button
                      aria-label={
                        followBackState?.status === "accepted"
                          ? t("notificationsSheet.followBack.alreadyFollowingAria", {
                              name: actor.name,
                            })
                          : followBackState?.status === "pending"
                            ? t("notificationsSheet.followBack.pendingAria", {
                                name: actor.name,
                              })
                            : t("notificationsSheet.followBack.actionAria", {
                                label: followBackState?.label ?? t("common.follow"),
                                name: actor.name,
                              })
                      }
                      className={[
                        "gc-pressable inline-flex h-10 min-w-[92px] items-center justify-center gap-1.5 rounded-full border px-3 text-[12px] font-black transition disabled:opacity-100",
                        followBackState?.status === "accepted"
                          ? "border-[var(--gc-blue)]/34 bg-[var(--gc-blue)]/12 text-[var(--gc-blue)]"
                          : followBackState?.status === "pending"
                            ? "border-white/[0.12] bg-white/[0.06] text-white/54"
                            : "border-[var(--gc-blue)]/42 bg-[var(--gc-blue)] text-black shadow-[0_0_18px_rgba(48,213,255,0.34)]",
                      ].join(" ")}
                      disabled={!canFollowBack || followBackBusy}
                      onClick={() => void onFollowBack?.(actor.id)}
                      type="button"
                    >
                      {followBackBusy ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : followBackState?.status === "accepted" ? (
                        <UserCheck size={16} strokeWidth={2.7} />
                      ) : followBackState?.status === "pending" ? (
                        <BellRing size={15} strokeWidth={2.6} />
                      ) : (
                        <UserPlus size={16} strokeWidth={2.7} />
                      )}
                      <span>{followBackBusy ? "..." : followBackState?.label ?? t("common.follow")}</span>
                    </button>
                  ) : (
                    <Icon className={tone} size={18} fill="none" />
                  )}
                  <span className="text-[10px] font-black text-white/36">
                    {formatRelative(n.created_at, now, t)}
                  </span>
                </div>
              </div>

              {isFollowRequest && stillPending && actor && onAcceptFollowRequest && onRejectFollowRequest ? (
                <div className="flex gap-2">
                  <button
                    className="gc-pressable flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--gc-brand)] text-[12px] font-black text-black"
                    onClick={() => onAcceptFollowRequest(actor.id)}
                    type="button"
                  >
                    <Check size={14} strokeWidth={2.8} />
                    {t("notificationsSheet.followRequest.accept")}
                  </button>
                  <button
                    className="gc-pressable flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] text-[12px] font-black text-white/72"
                    onClick={() => onRejectFollowRequest(actor.id)}
                    type="button"
                  >
                    {t("notificationsSheet.followRequest.reject")}
                  </button>
                </div>
              ) : null}

              {isFollowRequest && actor?.followStatus === "accepted" ? (
                <p className="text-[11px] font-bold text-white/40">
                  {t("notificationsSheet.followRequest.accepted")}
                </p>
              ) : null}

              {isPostTag && tagDecision === "accepted" ? (
                <p className="text-[11px] font-bold text-[var(--gc-brand)]/80">
                  {t("notificationsSheet.postTag.accepted")}
                </p>
              ) : null}

              {showPostTagActions ? (
                <div className="flex gap-2">
                  <button
                    className="gc-pressable flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--gc-brand)] text-[12px] font-black text-black"
                    disabled={tagActionBusy}
                    onClick={() => void onAcceptPostTag?.(n)}
                    type="button"
                  >
                    {tagActionBusy ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <Check size={14} strokeWidth={2.8} />
                    )}
                    {t("notificationsSheet.postTag.accept")}
                  </button>
                  <button
                    className="gc-pressable flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] text-[12px] font-black text-white/72"
                    disabled={tagActionBusy}
                    onClick={() => void onRejectPostTag?.(n)}
                    type="button"
                  >
                    {t("notificationsSheet.postTag.reject")}
                  </button>
                </div>
              ) : null}

              {isStoryTag && tagDecision === "accepted" ? (
                <p className="text-[11px] font-bold text-[var(--gc-brand)]/80">
                  {t("notificationsSheet.storyTag.accepted")}
                </p>
              ) : null}

              {showStoryTagActions ? (
                <div className="flex gap-2">
                  <button
                    className="gc-pressable flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--gc-brand)] text-[12px] font-black text-black"
                    disabled={tagActionBusy}
                    onClick={() => void onAcceptStoryTag?.(n)}
                    type="button"
                  >
                    {tagActionBusy ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <Check size={14} strokeWidth={2.8} />
                    )}
                    {t("notificationsSheet.storyTag.accept")}
                  </button>
                  <button
                    className="gc-pressable flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] text-[12px] font-black text-white/72"
                    disabled={tagActionBusy}
                    onClick={() => void onRejectStoryTag?.(n)}
                    type="button"
                  >
                    {t("notificationsSheet.storyTag.reject")}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

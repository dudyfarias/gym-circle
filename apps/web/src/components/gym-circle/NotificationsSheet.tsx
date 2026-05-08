"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import type { NotificationRow } from "@gym-circle/core";
import { Avatar } from "@/components/ui/Avatar";
import type { EnrichedUser } from "./social/types";

type NotificationsSheetProps = {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  users: Record<string, EnrichedUser>;
  onSelectUser?: (userId: string) => void;
  onFollowBack?: (userId: string) => void | Promise<void>;
  onAcceptFollowRequest?: (requesterId: string) => void | Promise<void>;
  onRejectFollowRequest?: (requesterId: string) => void | Promise<void>;
};

const KIND_ICON = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  mention: AtSign,
  follow_request: BellRing,
  story_like: Heart,
  story_reply: MessageCircle,
} as const;

const KIND_LABEL = {
  like: "curtiu seu treino",
  comment: "comentou seu treino",
  follow: "começou a seguir você",
  mention: "mencionou você",
  follow_request: "quer te seguir",
  story_like: "curtiu seu story",
  story_reply: "respondeu seu story",
} as const;

const KIND_TONE = {
  like: "text-[var(--gc-consistency-month)]",
  comment: "text-[var(--gc-brand)]",
  follow: "text-[var(--gc-consistency-month)]",
  mention: "text-[var(--gc-consistency-daily)]",
  follow_request: "text-[var(--gc-brand)]",
  story_like: "text-[var(--gc-consistency-month)]",
  story_reply: "text-[var(--gc-brand)]",
} as const;

type NotificationKind = keyof typeof KIND_ICON;

function normalizeNotificationKind(kind: string): NotificationKind {
  return kind in KIND_ICON ? (kind as NotificationKind) : "mention";
}

function formatRelative(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  return `${days}d`;
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
}: NotificationsSheetProps) {
  const services = useGymCircleServices();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [followBackBusyId, setFollowBackBusyId] = useState<string | null>(null);

  const followBack = useCallback(
    async (userId: string) => {
      if (!onFollowBack) return;
      setFollowBackBusyId(userId);
      try {
        await onFollowBack(userId);
      } finally {
        setFollowBackBusyId(null);
      }
    },
    [onFollowBack],
  );

  const refresh = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const list = await services.notifications.listForUser(currentUserId);
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, [services, currentUserId, open]);

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
    for (const n of items) {
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
          <p className="text-[17px] font-black">Notificações</p>
          <button
            aria-label="Fechar"
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
              Carregando...
            </p>
          ) : items.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <p className="text-[16px] font-black">Tudo limpo</p>
                <p className="mt-2 text-[13px] font-bold text-white/52">
                  Quando alguém curtir seus treinos, te seguir ou te marcar, aparece aqui.
                </p>
              </div>
            </div>
          ) : (
            <>
              {grouped.today.length > 0 ? (
                <Section
                  now={now}
                  title="Hoje"
                  items={grouped.today}
                  users={users}
                  onSelectUser={onSelectUser}
                  onFollowBack={followBack}
                  followBackBusyId={followBackBusyId}
                  onAcceptFollowRequest={onAcceptFollowRequest}
                  onRejectFollowRequest={onRejectFollowRequest}
                />
              ) : null}
              {grouped.earlier.length > 0 ? (
                <Section
                  now={now}
                  title="Anteriores"
                  items={grouped.earlier}
                  users={users}
                  onSelectUser={onSelectUser}
                  onFollowBack={followBack}
                  followBackBusyId={followBackBusyId}
                  onAcceptFollowRequest={onAcceptFollowRequest}
                  onRejectFollowRequest={onRejectFollowRequest}
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
  onAcceptFollowRequest,
  onRejectFollowRequest,
}: {
  title: string;
  items: NotificationRow[];
  users: Record<string, EnrichedUser>;
  now: number;
  onSelectUser?: (userId: string) => void;
  onFollowBack?: (userId: string) => void | Promise<void>;
  followBackBusyId?: string | null;
  onAcceptFollowRequest?: (requesterId: string) => void | Promise<void>;
  onRejectFollowRequest?: (requesterId: string) => void | Promise<void>;
}) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-[12px] font-black uppercase text-white/42">{title}</h3>
      <ul className="space-y-2">
        {items.map((n) => {
          const kind = normalizeNotificationKind(n.kind);
          const Icon = KIND_ICON[kind];
          const tone = KIND_TONE[kind];
          const actor = users[n.actor_id];
          const unread = !n.read_at;
          const isFollowRequest = kind === "follow_request";
          const isFollowNotification = kind === "follow";
          const isFollowingBack = actor?.followStatus === "accepted";
          const isFollowBackPending = actor?.followStatus === "pending";
          const canFollowBack = Boolean(
            isFollowNotification &&
              actor &&
              onFollowBack &&
              !isFollowingBack &&
              !isFollowBackPending,
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
                  aria-label={`Ver ${actor?.name ?? "perfil"}`}
                  className="gc-pressable shrink-0"
                  onClick={() => actor && onSelectUser?.(actor.id)}
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
                      onClick={() => actor && onSelectUser?.(actor.id)}
                      type="button"
                    >
                      {actor?.name ?? "Alguém"}
                    </button>{" "}
                    <span className="font-semibold text-white/64">{KIND_LABEL[kind]}</span>
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
                        isFollowingBack
                          ? `Você já segue ${actor.name}`
                          : isFollowBackPending
                            ? `Solicitação enviada para ${actor.name}`
                            : `Seguir ${actor.name} de volta`
                      }
                      className={[
                        "gc-pressable grid size-9 place-items-center rounded-full border transition disabled:opacity-100",
                        isFollowingBack
                          ? "border-[var(--gc-blue)]/34 bg-[var(--gc-blue)]/12 text-[var(--gc-blue)]"
                          : isFollowBackPending
                            ? "border-white/[0.12] bg-white/[0.06] text-white/54"
                            : "border-[var(--gc-blue)]/42 bg-[var(--gc-blue)] text-black shadow-[0_0_18px_rgba(48,213,255,0.34)]",
                      ].join(" ")}
                      disabled={!canFollowBack || followBackBusy}
                      onClick={() => void onFollowBack?.(actor.id)}
                      type="button"
                    >
                      {followBackBusy ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : isFollowingBack ? (
                        <UserCheck size={16} strokeWidth={2.7} />
                      ) : isFollowBackPending ? (
                        <BellRing size={15} strokeWidth={2.6} />
                      ) : (
                        <UserPlus size={16} strokeWidth={2.7} />
                      )}
                    </button>
                  ) : (
                    <Icon className={tone} size={18} fill="none" />
                  )}
                  <span className="text-[10px] font-black text-white/36">
                    {formatRelative(n.created_at, now)}
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
                    Aceitar
                  </button>
                  <button
                    className="gc-pressable flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] text-[12px] font-black text-white/72"
                    onClick={() => onRejectFollowRequest(actor.id)}
                    type="button"
                  >
                    Recusar
                  </button>
                </div>
              ) : null}

              {isFollowRequest && actor?.followStatus === "accepted" ? (
                <p className="text-[11px] font-bold text-white/40">Solicitação aceita.</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

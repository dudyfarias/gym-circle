"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Heart, Send, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "./design-system/EmptyState";
import { StreakBadge } from "./design-system/StreakBadge";
import { SwipeRevealDelete } from "./design-system/SwipeRevealDelete";
import {
  attachCapacitorKeyboardListeners,
  type KeyboardPluginLike,
} from "./keyboardDetection";
import { MentionText } from "./MentionText";
import { simulateHaptic } from "./social/haptics";
import type { EnrichedPost, EnrichedUser } from "./social/types";

/**
 * CommentsBottomSheet — Sprint 3 / Fase 3.3.
 *
 * Sheet dedicado a comentários, inspirado na UX do Instagram (apenas UX,
 * sem assets copiados). Substitui o `PostDetailSheet` que reabria o post
 * inteiro num overlay.
 *
 * Comportamento:
 * - Backdrop com tap pra fechar (botão a11y).
 * - Handle bar no topo (drag indicator visual; sem gesto real ainda — adiado
 *   pra Sprint 4 quando o resto do app tiver swipe-to-dismiss).
 * - Lista scrollável com `commentPreviews` (o hook social já carrega
 *   comentários completos via `refreshPostDetails(postId)` quando o sheet
 *   abre — wire-up em `GymCirclePreview.tsx`).
 * - Reactions row sticky com emojis rápidos. Tap envia o emoji como
 *   comentário (haptic selection).
 * - Input fixo no rodapé com avatar do `currentUser`. Mention auto-complete
 *   `@username` reusando o padrão do `SocialPostCard`.
 * - Keyboard handling: usa `attachCapacitorKeyboardListeners` (defensivo —
 *   ver `keyboardDetection.ts` pro contexto do bug iOS) + `visualViewport`
 *   como fallback web/PWA.
 *
 * Fora de escopo desta fase:
 * - Replies aninhados — `GymComment` não tem `parentCommentId` no backend.
 *   Documentado em `docs/native-feel-sprint-3.md` como pendência futura.
 * - Swipe-to-dismiss real — visual handle ok, gesto fica pra Sprint 4.
 */

const REACTION_EMOJIS = ["❤️", "🙌", "🔥", "👏", "🥲", "😍", "😮", "😂"] as const;

type CommentsBottomSheetProps = {
  open: boolean;
  post: EnrichedPost | null;
  currentUserId: string;
  currentUser?: EnrichedUser;
  formatTime: (createdAt: string) => string;
  onClose: () => void;
  onCommentPost: (postId: string, body: string) => void | Promise<void>;
  onDeleteComment?: (postId: string, commentId: string) => void | Promise<void>;
  onLikeComment?: (postId: string, commentId: string) => void | Promise<void>;
  onSelectUser?: (userId: string) => void;
  resolveUser?: (username: string) => { id: string } | undefined;
  mentionUsers?: EnrichedUser[];
};

type MentionMatch = {
  start: number;
  end: number;
  query: string;
};

function getDraftMentionMatch(value: string, caretIndex: number): MentionMatch | null {
  const safeCaret = Math.max(0, Math.min(caretIndex, value.length));
  const prefix = value.slice(0, safeCaret);
  const start = prefix.lastIndexOf("@");
  if (start < 0) return null;

  const before = value[start - 1];
  if (before && !/[\s([]/.test(before)) return null;

  const query = prefix.slice(start + 1);
  if (!/^[a-zA-Z0-9_.]{0,32}$/.test(query)) return null;

  return {
    start,
    end: safeCaret,
    query: query.toLowerCase(),
  };
}

export function CommentsBottomSheet({
  open,
  post,
  currentUserId,
  currentUser,
  formatTime,
  onClose,
  onCommentPost,
  onDeleteComment,
  onLikeComment,
  onSelectUser,
  resolveUser,
  mentionUsers = [],
}: CommentsBottomSheetProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [caretIndex, setCaretIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset envolve no handler de close — evitamos `setState` dentro de useEffect
  // (regra react-hooks/set-state-in-effect), que dispararia cascade re-renders.
  // O `open` change só pode acontecer via callback do parent, então centralizar
  // no close handler é equivalente e mais previsível.
  function handleClose() {
    setDraft("");
    setCaretIndex(0);
    setKeyboardOpen(false);
    onClose();
  }

  // Keyboard detection híbrida: Capacitor nativo + visualViewport fallback.
  // Veja `keyboardDetection.ts` pra história do crash iOS que motivou a abstração.
  useEffect(() => {
    if (!open) return;

    let detachNative: (() => void) | undefined;

    void (async () => {
      try {
        const mod = await import("@capacitor/keyboard").catch(() => null);
        // Cast pra KeyboardPluginLike porque `KeyboardPlugin.addListener` tem
        // overloads tipados específicos (keyboardWillShow vs keyboardDidShow
        // com signatures de callback diferentes), e nosso wrapper aceita um
        // tipo mais permissivo. Forma compatível em runtime — só os tipos
        // estáticos divergem.
        const plugin = mod?.Keyboard as KeyboardPluginLike | undefined;
        if (plugin) {
          detachNative = attachCapacitorKeyboardListeners(plugin, setKeyboardOpen);
        }
      } catch {
        // Plugin missing/misbehaving — visualViewport fallback assume.
      }
    })();

    if (typeof window === "undefined" || !window.visualViewport) {
      return () => detachNative?.();
    }

    const viewport = window.visualViewport;
    const handleResize = () => {
      // Heurística: se a viewport encolheu > 100px, assumimos keyboard aberto.
      // (Web/PWA não tem evento dedicado.)
      const heightDiff = window.innerHeight - viewport.height;
      setKeyboardOpen(heightDiff > 100);
    };
    viewport.addEventListener("resize", handleResize);
    return () => {
      viewport.removeEventListener("resize", handleResize);
      detachNative?.();
    };
  }, [open]);

  const mentionMatch = useMemo(
    () => getDraftMentionMatch(draft, caretIndex),
    [draft, caretIndex],
  );

  const mentionSuggestions = useMemo(() => {
    if (!mentionMatch) return [];
    const query = mentionMatch.query;
    return mentionUsers
      .filter((user) => user.id !== currentUserId)
      .filter((user) => user.followStatus === "accepted" || user.isFollowing)
      .filter((user) => {
        const username = user.username.toLowerCase();
        const name = user.name.toLowerCase();
        return username.includes(query) || name.includes(query);
      })
      .slice(0, 5);
  }, [currentUserId, mentionMatch, mentionUsers]);

  if (!post) return null;

  const commentsCount = post.commentsCount ?? post.commentPreviews.length;

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!post) return;
    const body = draft.trim();
    if (!body || submitting) return;

    setSubmitting(true);
    // Haptic ANTES do await — feedback imediato mesmo se o callback for
    // assíncrono (otimista local + supabase ack depois).
    simulateHaptic("success");
    try {
      await onCommentPost(post.id, body);
      setDraft("");
      setCaretIndex(0);
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReaction(emoji: string) {
    if (!post || submitting) return;
    setSubmitting(true);
    simulateHaptic("brand"); // "brand" → HapticLevel "selection" (haptics.ts:4)
    try {
      await onCommentPost(post.id, emoji);
    } finally {
      setSubmitting(false);
    }
  }

  function updateCaret() {
    window.setTimeout(() => {
      setCaretIndex(inputRef.current?.selectionStart ?? draft.length);
    }, 0);
  }

  function selectMention(user: EnrichedUser) {
    if (!mentionMatch) return;
    const replacement = `@${user.username} `;
    const nextDraft =
      draft.slice(0, mentionMatch.start) +
      replacement +
      draft.slice(mentionMatch.end);
    const nextCaret = mentionMatch.start + replacement.length;
    setDraft(nextDraft);
    setCaretIndex(nextCaret);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  // Padding-bottom dinâmico:
  // - Teclado fechado: respeita safe-area-inset-bottom (home bar do iPhone)
  // - Teclado aberto: zera a safe-area (o WebView já reservou espaço)
  const formStyle: CSSProperties = {
    paddingBottom: keyboardOpen ? 12 : "max(12px, env(safe-area-inset-bottom))",
  };

  return (
    <div
      aria-hidden={!open}
      className={[
        "absolute inset-0 z-[68] transition-opacity duration-200",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      ].join(" ")}
    >
      <button
        aria-label={t("comments.close")}
        className="absolute inset-0 bg-black/94 backdrop-blur-xl"
        onClick={handleClose}
        tabIndex={open ? 0 : -1}
        type="button"
      />

      <div
        className={[
          "absolute inset-x-0 bottom-0 mx-auto flex max-w-[480px] flex-col rounded-t-[32px] border-t border-white/[0.08] bg-[#0c0d0e] shadow-[0_-24px_72px_rgba(0,0,0,0.6)] transition-transform duration-300",
          open ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
        style={{ height: "min(82dvh, 720px)" }}
      >
        {/* Drag handle (visual only) */}
        <div className="flex justify-center pb-1.5 pt-2.5">
          <div className="h-1 w-9 rounded-full bg-white/[0.18]" />
        </div>

        {/* Header */}
        <header className="grid grid-cols-[1fr_auto_1fr] items-center px-4 pb-3 pt-1">
          <div />
          <h2 className="text-center text-[15px] font-black text-white">
            {t("comments.title")}
          </h2>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-9 justify-self-end place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={handleClose}
            type="button"
          >
            <X size={17} />
          </button>
        </header>

        <div className="h-px bg-white/[0.06]" />

        {/* Comments list — Sprint 1 stabilization: superfície dedicada a
            comentários. Mantém só contexto textual leve; mídia/card do feed
            não entra aqui pra evitar re-render pesado e falta de espaço. */}
        <div className="gc-scrollbar flex-1 overflow-y-auto">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar
                accent={post.author.accent}
                name={post.author.name}
                size="sm"
                src={post.author.avatarUrl ?? undefined}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-black text-white">
                  @{post.author.username}
                </p>
                <p className="truncate text-[12px] font-semibold text-white/46">
                  {formatTime(post.createdAt)}
                </p>
              </div>
              <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-black text-white/52">
                {commentsCount.toLocaleString()} comentários
              </span>
            </div>
            {post.caption ? (
              <p className="mt-2 line-clamp-2 text-[13px] font-normal leading-5 text-white/72">
                {post.caption}
              </p>
            ) : null}
          </div>
          <div className="px-4 py-4">
          {post.commentPreviews.length === 0 ? (
            <div className="grid h-full place-items-center">
              <EmptyState
                detail={t("comments.empty.detail")}
                title={t("comments.empty.title")}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {post.commentPreviews.map((comment) => {
                const commentLikesCount = comment.likesCount ?? 0;
                const commentLiked = Boolean(comment.likedByCurrentUser);
                const canLikeComment =
                  comment.userId !== currentUserId && Boolean(onLikeComment);
                const isOwn = comment.userId === currentUserId;

                const content = (
                  <div className="flex items-start gap-3 px-1 py-1">
                    <button
                      aria-label={t("feed.post.openProfile", { name: comment.author.name })}
                      className="gc-pressable shrink-0"
                      onClick={() => onSelectUser?.(comment.author.id)}
                      type="button"
                    >
                      <Avatar
                        accent={comment.author.accent}
                        name={comment.author.name}
                        size="sm"
                        src={comment.author.avatarUrl ?? undefined}
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="inline-flex min-w-0 items-center gap-1.5 align-middle">
                        <button
                          className="gc-pressable text-[13px] font-bold text-white"
                          onClick={() => onSelectUser?.(comment.author.id)}
                          type="button"
                        >
                          {comment.author.username}
                        </button>
                        <StreakBadge
                          isLit={comment.author.streakLitToday}
                          size="xs"
                          streak={comment.author.currentStreak}
                        />
                        <span className="text-[11px] font-bold text-white/36">
                          {formatTime(comment.createdAt)}
                        </span>
                      </div>
                      <div className="text-[13px] font-normal leading-5 text-white/80">
                        <MentionText
                          onSelectUser={onSelectUser}
                          resolveUser={resolveUser}
                          text={comment.body}
                        />
                      </div>
                    </div>
                    {canLikeComment ? (
                      <button
                        aria-label={
                          commentLiked
                            ? t("comments.unlike")
                            : t("comments.like")
                        }
                        className={[
                          "gc-pressable grid min-h-9 min-w-9 place-items-center rounded-full",
                          commentLiked
                            ? "text-[var(--gc-blue)] drop-shadow-[0_0_14px_rgba(48,213,255,0.42)]"
                            : "text-white/40",
                        ].join(" ")}
                        onClick={() => {
                          simulateHaptic("like");
                          void onLikeComment?.(post.id, comment.id);
                        }}
                        type="button"
                      >
                        <span className="flex items-center gap-1">
                          <Heart
                            fill={commentLiked ? "currentColor" : "none"}
                            size={14}
                            strokeWidth={2.4}
                          />
                          {commentLikesCount > 0 ? (
                            <span className="text-[10px] font-black">
                              {commentLikesCount}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ) : commentLikesCount > 0 ? (
                      <span className="inline-flex min-h-8 items-center gap-1 rounded-full bg-black/20 px-2 text-[10px] font-black text-white/34">
                        <Heart size={12} strokeWidth={2.4} />
                        {commentLikesCount}
                      </span>
                    ) : null}
                  </div>
                );

                if (!isOwn || !onDeleteComment) {
                  return <div key={comment.id}>{content}</div>;
                }
                return (
                  <SwipeRevealDelete
                    className="rounded-[18px]"
                    contentClassName="rounded-[18px]"
                    deleteLabel={t("comments.delete")}
                    key={comment.id}
                    onDelete={() => onDeleteComment(post.id, comment.id)}
                    revealWidth={58}
                  >
                    {content}
                  </SwipeRevealDelete>
                );
              })}
              {commentsCount > post.commentPreviews.length ? (
                <p className="pt-1 text-center text-[12px] font-bold text-white/36">
                  {t("comments.showingOf", {
                    shown: post.commentPreviews.length,
                    total: commentsCount.toLocaleString(),
                  })}
                </p>
              ) : null}
            </div>
          )}
          </div>
        </div>

        {/* Reactions row */}
        <div className="border-t border-white/[0.06]">
          <div className="gc-scrollbar flex gap-1 overflow-x-auto px-3 py-2">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                aria-label={t("comments.reactWith", { emoji })}
                className="gc-pressable grid min-h-11 min-w-11 place-items-center rounded-full text-[22px] hover:bg-white/[0.05] disabled:opacity-40"
                disabled={submitting}
                key={emoji}
                onClick={() => void sendReaction(emoji)}
                type="button"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Input form */}
        <form
          className="relative flex items-center gap-2 border-t border-white/[0.06] px-4 pt-3"
          onSubmit={submitComment}
          style={formStyle}
        >
          {mentionSuggestions.length > 0 ? (
            <div className="absolute inset-x-3 bottom-[calc(100%+8px)] z-20 overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#101214]/96 shadow-[0_18px_52px_rgba(0,0,0,0.46)] backdrop-blur-2xl">
              {mentionSuggestions.map((user) => (
                <button
                  className="gc-pressable flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.06]"
                  key={user.id}
                  onClick={() => selectMention(user)}
                  onMouseDown={(event) => event.preventDefault()}
                  type="button"
                >
                  <Avatar
                    accent={user.accent}
                    name={user.name}
                    size="sm"
                    src={user.avatarUrl ?? undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-black text-white">
                      @{user.username}
                    </p>
                    <p className="truncate text-[11px] font-bold text-white/42">
                      {user.name}
                    </p>
                  </div>
                  <StreakBadge
                    isLit={user.streakLitToday}
                    size="xs"
                    streak={user.currentStreak}
                  />
                </button>
              ))}
            </div>
          ) : null}
          {currentUser ? (
            <Avatar
              accent={currentUser.accent}
              name={currentUser.name}
              size="sm"
              src={currentUser.avatarUrl ?? undefined}
            />
          ) : null}
          <input
            aria-label="Comentário"
            className="h-11 min-w-0 flex-1 rounded-full border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
            enterKeyHint="send"
            onChange={(event) => {
              setDraft(event.target.value);
              setCaretIndex(event.target.selectionStart ?? event.target.value.length);
            }}
            onClick={updateCaret}
            onFocus={updateCaret}
            onKeyUp={updateCaret}
            placeholder={t("comments.placeholder")}
            ref={inputRef}
            value={draft}
          />
          <button
            aria-label={t("comments.send")}
            className="gc-pressable grid size-11 place-items-center rounded-full bg-[var(--gc-brand)] text-black disabled:opacity-50"
            disabled={!draft.trim() || submitting}
            type="submit"
          >
            <Send size={17} strokeWidth={2.6} />
          </button>
        </form>
      </div>
    </div>
  );
}

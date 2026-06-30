"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Heart, Loader2, RotateCw, Send, X } from "lucide-react";
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
import type { EnrichedComment, EnrichedPost, EnrichedUser } from "./social/types";

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
  onCommentPost: (
    postId: string,
    body: string,
    parentCommentId?: string | null,
  ) => void | Promise<void>;
  onDeleteComment?: (postId: string, commentId: string) => void | Promise<void>;
  onLikeComment?: (postId: string, commentId: string) => void | Promise<void>;
  onSelectUser?: (userId: string) => void;
  resolveUser?: (username: string) => { id: string } | undefined;
  mentionUsers?: EnrichedUser[];
  /** Detalhes (comentários) sendo carregados — mostra spinner em vez de vazio. */
  loading?: boolean;
  /** Falha ao carregar os comentários — mostra erro + retry em vez de vazio. */
  loadError?: boolean;
  /** Re-tenta carregar os detalhes do post. */
  onRetry?: () => void;
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
  loading = false,
  loadError = false,
  onRetry,
}: CommentsBottomSheetProps) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState("");
  const [caretIndex, setCaretIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  // Sprint 12.1 — alvo da resposta (threading 1 nível, estilo Instagram).
  const [replyTarget, setReplyTarget] = useState<{
    parentCommentId: string;
    username: string;
  } | null>(null);
  // Quais comentários-pai têm a lista de respostas expandida ("Ver N respostas").
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(
    () => new Set(),
  );
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset envolve no handler de close — evitamos `setState` dentro de useEffect
  // (regra react-hooks/set-state-in-effect), que dispararia cascade re-renders.
  // O `open` change só pode acontecer via callback do parent, então centralizar
  // no close handler é equivalente e mais previsível.
  function handleClose() {
    setDraft("");
    setCaretIndex(0);
    setKeyboardOpen(false);
    setReplyTarget(null);
    setExpandedReplies(new Set());
    onClose();
  }

  // Sprint 12.1 — inicia uma resposta: fixa o alvo, prefilla "@username " e foca.
  // threadParentId é sempre o comentário de TOPO (replies achatam em 1 nível).
  function startReply(threadParentId: string, username: string) {
    setReplyTarget({ parentCommentId: threadParentId, username });
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      next.add(threadParentId);
      return next;
    });
    const mention = `@${username} `;
    setDraft(mention);
    setCaretIndex(mention.length);
    simulateHaptic("brand");
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(mention.length, mention.length);
    });
  }

  function cancelReply() {
    if (replyTarget) {
      const mention = `@${replyTarget.username} `;
      if (draft === mention) setDraft("");
    }
    setReplyTarget(null);
  }

  function toggleReplies(parentCommentId: string) {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(parentCommentId)) next.delete(parentCommentId);
      else next.add(parentCommentId);
      return next;
    });
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

  // Sprint 12.1 — usa a lista COMPLETA (commentThread) pra render threaded; cai
  // de volta em commentPreviews quando o hook não popula (mock/demo de marketing).
  const allComments = post.commentThread ?? post.commentPreviews;
  const topLevelComments = allComments.filter((c) => !c.parentCommentId);
  const repliesByParent = new Map<string, EnrichedComment[]>();
  for (const c of allComments) {
    if (!c.parentCommentId) continue;
    const list = repliesByParent.get(c.parentCommentId) ?? [];
    list.push(c);
    repliesByParent.set(c.parentCommentId, list);
  }

  const commentsCount = post.commentsCount ?? allComments.length;

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!post) return;
    const body = draft.trim();
    if (!body || submitting) return;
    if (body.length > 600) {
      setSubmitError(t("comments.submitError"));
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    // Haptic ANTES do await — feedback imediato mesmo se o callback for
    // assíncrono (otimista local + supabase ack depois).
    simulateHaptic("success");
    try {
      await onCommentPost(post.id, body, replyTarget?.parentCommentId ?? null);
      setDraft("");
      setCaretIndex(0);
      setReplyTarget(null);
    } catch {
      // Antes a falha era silenciosa: o botão voltava ao normal e nada aparecia.
      setSubmitError(t("comments.submitError"));
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

  // post já é não-nulo aqui (early return acima). Captura local pra fechar sobre
  // ele dentro de renderCommentRow sem reclamar de narrowing em closure aninhada.
  const activePost = post;

  // Sprint 12.1 — render de UM comentário (reusado por top-level e resposta).
  // threadParentId é sempre o comentário de TOPO (replies achatam em 1 nível,
  // estilo Instagram); isReply controla indentação. Mantém swipe-to-delete pros
  // próprios. Username + @menções sempre em negrito (font-black / MentionText).
  function renderCommentRow(
    comment: EnrichedComment,
    threadParentId: string,
    isReply: boolean,
  ) {
    const commentLikesCount = comment.likesCount ?? 0;
    const commentLiked = Boolean(comment.likedByCurrentUser);
    const canLikeComment =
      comment.userId !== currentUserId && Boolean(onLikeComment);
    const isOwn = comment.userId === currentUserId;
    // Sprint 12.2 — apaga via swipe se for o autor do comentário OU o dono do
    // post (moderação). A RLS post_comments_delete_author_or_owner confirma.
    const isPostOwner = activePost.userId === currentUserId;
    const canDelete = (isOwn || isPostOwner) && Boolean(onDeleteComment);

    const content = (
      <div
        className={[
          "flex items-start gap-2.5 px-1 py-1",
          isReply ? "pl-11" : "",
        ].join(" ")}
      >
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
              className="gc-pressable text-[13px] font-black text-white"
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
          <div className="text-[13px] font-semibold leading-5 text-white/80">
            <MentionText
              onSelectUser={onSelectUser}
              resolveUser={resolveUser}
              text={comment.body}
            />
          </div>
          <button
            className="gc-pressable mt-1 text-[11px] font-black text-white/40 hover:text-white/72"
            onClick={() => startReply(threadParentId, comment.author.username)}
            type="button"
          >
            {t("comments.reply")}
          </button>
        </div>
        {canLikeComment ? (
          <button
            aria-label={commentLiked ? t("comments.unlike") : t("comments.like")}
            className={[
              "gc-pressable grid min-h-9 min-w-9 place-items-center rounded-full",
              commentLiked
                ? "text-[var(--gc-blue)] drop-shadow-[0_0_14px_rgba(48,213,255,0.42)]"
                : "text-white/40",
            ].join(" ")}
            onClick={() => {
              simulateHaptic("like");
              void onLikeComment?.(activePost.id, comment.id);
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
                <span className="text-[10px] font-black">{commentLikesCount}</span>
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

    if (!canDelete || !onDeleteComment) {
      return <div key={comment.id}>{content}</div>;
    }
    return (
      <SwipeRevealDelete
        className="rounded-[18px]"
        // bg-[#0c0d0e] (cor do sheet) torna a camada que desliza OPACA — sem
        // isso a lixeira `absolute` atrás vazava pelo conteúdo transparente e
        // ficava visível o tempo todo. Agora só aparece ao arrastar p/ esquerda.
        contentClassName="rounded-[18px] bg-[#0c0d0e]"
        deleteLabel={t("comments.delete")}
        key={comment.id}
        onDelete={() => onDeleteComment(activePost.id, comment.id)}
        revealWidth={58}
      >
        {content}
      </SwipeRevealDelete>
    );
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
        // z-[80]: acima do PostDetailOverlay (z-[72]). Quando os comentários são
        // abertos de DENTRO do post em tela cheia, o sheet precisa ficar por
        // cima — antes (z-[68]) abria invisível atrás do post.
        "absolute inset-0 z-[80] transition-opacity duration-200",
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
                {t("comments.headerCount", {
                  count: commentsCount,
                  formatted: commentsCount.toLocaleString(i18n.language),
                })}
              </span>
            </div>
            {post.caption ? (
              <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-5 text-white/72">
                {post.caption}
              </p>
            ) : null}
          </div>
          <div className="px-4 py-4">
          {loading && topLevelComments.length === 0 ? (
            // Carregando (antes mostrava "nenhum comentário" durante o fetch).
            <div className="grid place-items-center py-10">
              <Loader2 className="size-6 animate-spin text-white/40" strokeWidth={2.4} />
            </div>
          ) : loadError && topLevelComments.length === 0 ? (
            // Falha ao carregar (antes virava lista vazia silenciosa).
            <div className="grid place-items-center gap-3 py-10 text-center">
              <p className="text-[13px] font-bold text-white/52">
                {t("comments.loadError")}
              </p>
              {onRetry ? (
                <button
                  className="gc-pressable inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-4 py-2 text-[12px] font-black text-white"
                  onClick={onRetry}
                  type="button"
                >
                  <RotateCw size={13} strokeWidth={2.6} />
                  {t("common.retry")}
                </button>
              ) : null}
            </div>
          ) : topLevelComments.length === 0 ? (
            <div className="grid h-full place-items-center">
              <EmptyState
                detail={t("comments.empty.detail")}
                title={t("comments.empty.title")}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {topLevelComments.map((comment) => {
                const replies = repliesByParent.get(comment.id) ?? [];
                const isExpanded = expandedReplies.has(comment.id);
                return (
                  <div className="space-y-1.5" key={comment.id}>
                    {renderCommentRow(comment, comment.id, false)}
                    {replies.length > 0 ? (
                      isExpanded ? (
                        <div className="space-y-1.5">
                          {replies.map((reply) =>
                            renderCommentRow(reply, comment.id, true),
                          )}
                          <button
                            className="gc-pressable pl-11 text-[12px] font-bold text-white/40 hover:text-white/64"
                            onClick={() => toggleReplies(comment.id)}
                            type="button"
                          >
                            {t("comments.hideReplies")}
                          </button>
                        </div>
                      ) : (
                        <button
                          className="gc-pressable flex items-center gap-2 pl-11 text-[12px] font-bold text-white/46 hover:text-white/70"
                          onClick={() => toggleReplies(comment.id)}
                          type="button"
                        >
                          <span className="h-px w-6 bg-white/18" />
                          {t("comments.viewReplies", { count: replies.length })}
                        </button>
                      )
                    ) : null}
                  </div>
                );
              })}
              {commentsCount > allComments.length ? (
                <p className="pt-1 text-center text-[12px] font-bold text-white/36">
                  {t("comments.showingOf", {
                    shown: allComments.length,
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

        {/* Sprint 12.1 — banner "Respondendo @fulano" quando há resposta em curso */}
        {replyTarget ? (
          <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] bg-[var(--gc-brand)]/[0.05] px-4 py-2">
            <span className="truncate text-[12px] font-bold text-white/58">
              {t("comments.replyingTo", { username: replyTarget.username })}
            </span>
            <button
              aria-label={t("comments.cancelReply")}
              className="gc-pressable grid size-7 shrink-0 place-items-center rounded-full bg-white/[0.08] text-white/64"
              onClick={cancelReply}
              type="button"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        {/* Erro de envio (antes falhava em silêncio: passava de 600 chars, RLS,
            rede) — agora mostra a mensagem e preserva o texto digitado. */}
        {submitError ? (
          <div className="border-t border-[var(--gc-pink)]/24 bg-[var(--gc-pink)]/[0.08] px-4 py-2">
            <span className="text-[12px] font-bold text-[var(--gc-pink)]">
              {submitError}
            </span>
          </div>
        ) : null}

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
            aria-label={t("comments.inputAria")}
            className="h-11 min-w-0 flex-1 rounded-full border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
            enterKeyHint="send"
            maxLength={600}
            onChange={(event) => {
              setDraft(event.target.value);
              setCaretIndex(event.target.selectionStart ?? event.target.value.length);
              if (submitError) setSubmitError(null);
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

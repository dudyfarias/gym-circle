"use client";

import { HelpCircle, Lock, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BadgeIcon } from "./design-system";
import {
  countEarnedBadges,
  getEarnedBadges,
  type Badge,
} from "./social/gamification";
import type { EnrichedPost, EnrichedUser } from "./social/types";

/**
 * Sprint 5.4 — BadgesSheet (página dedicada).
 *
 * Tela full-height sheet que mostra TODOS os badges com mais detalhe
 * que o grid compacto do MyCircleSheet. Acesso via tap em "Ver todos →"
 * na seção F do MyCircleSheet ou diretamente em qualquer badge do grid.
 *
 * Estrutura (top → bottom):
 *
 *   A. Header — X close + título.
 *   B. Hero — barra de progresso "{earned}/{total} conquistadas".
 *   C. Filter chips — Todos / Conquistados / Próximos / Secretos.
 *   D. Grid 2-col — card grande por badge com:
 *      - Ícone único maior (40px via BadgeIcon)
 *      - Label + descrição completa
 *      - Progress bar quando aplica (current/target)
 *      - Estado misterioso pra secret badges não-earned
 *
 * Privacy: este sheet só abre pelo MyCircleSheet, que já checa
 * `canSeeDetails`. Logo, badges aqui são sempre do user dono do
 * MyCircle aberto (próprio ou outro com follow).
 */

type BadgesSheetProps = {
  open: boolean;
  user: EnrichedUser | null;
  posts: EnrichedPost[];
  onClose: () => void;
  /**
   * Sprint 7.5.2 — abre AchievementDetailOverlay full-screen Apple Fitness
   * style. Quando ausente, cards continuam decorativos (back-compat).
   */
  onOpenAchievementDetail?: (badge: Badge) => void;
};

type FilterKey = "all" | "earned" | "next" | "secret";

const FILTER_KEYS: ReadonlyArray<FilterKey> = ["all", "earned", "next", "secret"];

export function BadgesSheet({
  open,
  user,
  posts,
  onClose,
  onOpenAchievementDetail,
}: BadgesSheetProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterKey>("all");

  // Sprint 5.4 — computa badges aqui (evita re-deriving no parent).
  // Quando user é null (defensive), renderiza array vazio que ativa o
  // empty state. Posts são mapeados pra GamificationPostSnapshot shape
  // (mesmo padrão do MyCircleSheet).
  const badges = useMemo<Badge[]>(() => {
    if (!user) return [];
    return getEarnedBadges({
      user,
      postsCount: posts.length,
      hasUsedStreakRestore: Boolean(user.lastStreakRestoreUsedAt),
      posts: posts.map((post) => ({
        createdAt: post.createdAt,
        workoutType: post.workoutType ?? null,
        gymId: post.gymId,
      })),
    });
  }, [posts, user]);

  const total = badges.length;
  const earned = useMemo(() => countEarnedBadges(badges), [badges]);
  const percentage = total > 0 ? Math.round((earned / total) * 100) : 0;

  const filteredBadges = useMemo(() => {
    switch (filter) {
      case "earned":
        return badges.filter((b) => b.earned);
      case "next":
        // Sprint 5.4 — "Próximos" = públicos não-earned ordenados por
        // proporção de progresso (mesma heurística do getNextBadge).
        return badges
          .filter((b) => !b.earned && !b.secret)
          .sort((a, b) => {
            const aPct = a.progress
              ? (a.progress.current / a.progress.target) * 100
              : -1;
            const bPct = b.progress
              ? (b.progress.current / b.progress.target) * 100
              : -1;
            return bPct - aPct;
          });
      case "secret":
        return badges.filter((b) => b.secret);
      case "all":
      default:
        return badges;
    }
  }, [badges, filter]);

  if (!open) return null;

  const isEmpty = filteredBadges.length === 0;

  return (
    <div
      aria-hidden={!open}
      className={[
        "absolute inset-0 z-[70] transition-opacity duration-200",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      ].join(" ")}
    >
      <button
        aria-label={t("badgesSheet.closeAria")}
        className="absolute inset-0 bg-black/68 backdrop-blur-xl"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        type="button"
      />

      <div
        className={[
          "absolute inset-x-0 bottom-0 mx-auto flex max-w-[480px] flex-col overflow-hidden rounded-t-[32px] border-t border-white/[0.08] bg-[#0a0b0c] shadow-[0_-24px_72px_rgba(0,0,0,0.6)] transition-transform duration-300",
          open ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
        style={{ height: "min(92dvh, 880px)" }}
      >
        {/* Handle bar */}
        <div className="flex shrink-0 justify-center pb-1.5 pt-2.5">
          <div className="h-1 w-9 rounded-full bg-white/[0.18]" />
        </div>

        {/* A. Header */}
        <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-5 pb-3 pt-1">
          <div />
          <h2 className="text-center text-[15px] font-black text-white">
            {t("badgesSheet.title")}
          </h2>
          <button
            aria-label={t("badgesSheet.closeAria")}
            className="gc-pressable grid size-9 justify-self-end place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </header>

        <div className="h-px shrink-0 bg-white/[0.06]" />

        <div className="gc-scrollbar flex-1 overflow-y-auto px-5 pb-8 pt-5">
          {/* B. Hero progress */}
          <section className="rounded-[20px] bg-white/[0.035] p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[12px] font-black uppercase tracking-[0.08em] text-white/52">
                {t("badgesSheet.hero", { earned, total })}
              </p>
              <p className="text-[18px] font-black text-white">{percentage}%</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#8CFBFF,#30D5FF,#0066FF)] transition-[width] duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </section>

          {/* C. Filter chips */}
          <section className="mt-5 -mx-1 flex gap-2 overflow-x-auto pb-1">
            {FILTER_KEYS.map((key) => {
              const active = filter === key;
              return (
                <button
                  aria-pressed={active}
                  className={[
                    "gc-pressable shrink-0 rounded-full px-4 py-2 text-[12px] font-black transition-colors",
                    active
                      ? "bg-[var(--gc-brand)] text-black"
                      : "bg-white/[0.05] text-white/68 hover:bg-white/[0.08]",
                  ].join(" ")}
                  key={key}
                  onClick={() => setFilter(key)}
                  type="button"
                >
                  {t(`badgesSheet.filter.${key}`)}
                </button>
              );
            })}
          </section>

          {/* D. Grid de cards */}
          <section className="mt-5">
            {isEmpty ? (
              <div className="rounded-[20px] border border-dashed border-white/[0.08] bg-white/[0.02] p-8 text-center">
                <p className="text-[13px] font-bold text-white/52">
                  {t(`badgesSheet.empty.${filter}`)}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {filteredBadges.map((badge) => (
                  <BadgeCard
                    badge={badge}
                    key={badge.id}
                    onTap={
                      onOpenAchievementDetail
                        ? () => onOpenAchievementDetail(badge)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * Card grande de badge com ícone, label, descrição completa e progress
 * bar quando aplicável. Lida com 4 estados visuais:
 *   1. earned + public → ícone único colorido + label + description
 *   2. !earned + public → ícone dim + label + description + progress
 *   3. !earned + secret → cadeado misterioso + "???" + hint genérico
 *   4. earned + secret → ícone único + label real (revealed)
 *
 * Sprint 7.5.2 — quando `onTap` fornecido, card inteiro vira tappable
 * (botão) que abre o AchievementDetailOverlay full-screen Apple Fitness
 * style. Sem onTap, segue como div decorativa (back-compat).
 */
function BadgeCard({ badge, onTap }: { badge: Badge; onTap?: () => void }) {
  const { t } = useTranslation();
  const isMystery = badge.secret && !badge.earned;
  const Tag = onTap ? "button" : "div";

  return (
    <Tag
      aria-label={
        isMystery
          ? t("badgesSheet.secretMystery")
          : `${badge.label} — ${badge.description}`
      }
      className={[
        "flex w-full flex-col gap-2 rounded-[18px] p-3 text-left transition-colors",
        isMystery
          ? "bg-white/[0.03] text-white/36"
          : badge.earned
            ? "bg-white/[0.05]"
            : "bg-white/[0.025] text-white/68",
        onTap ? "gc-pressable" : "",
      ].join(" ")}
      onClick={onTap}
      type={onTap ? "button" : undefined}
    >
      {isMystery ? (
        <span className="grid size-10 place-items-center rounded-[14px] bg-white/[0.06] text-white/40">
          <HelpCircle size={20} strokeWidth={2.4} />
        </span>
      ) : badge.earned ? (
        <BadgeIcon className="size-10" earned iconKey={badge.iconKey} size={22} />
      ) : (
        <span className="grid size-10 place-items-center rounded-[14px] bg-white/[0.04] text-white/40">
          <Lock size={18} strokeWidth={2.4} />
        </span>
      )}

      <div className="min-w-0 space-y-1">
        <p
          className={[
            "text-[13px] font-black",
            badge.earned ? "text-white" : "text-white/72",
          ].join(" ")}
        >
          {isMystery ? "???" : badge.label}
        </p>
        <p className="text-[11px] font-bold leading-4 text-white/52">
          {isMystery ? t("badgesSheet.secretHint") : badge.description}
        </p>
      </div>

      {!isMystery && !badge.earned && badge.progress ? (
        <div className="mt-1">
          <div className="mb-1 flex items-baseline justify-between text-[10px] font-black text-white/42">
            <span>
              {t("badgesSheet.progress", {
                current: badge.progress.current,
                target: badge.progress.target,
              })}
            </span>
            <span>
              {Math.min(
                100,
                Math.round((badge.progress.current / badge.progress.target) * 100),
              )}
              %
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-[var(--gc-brand)]/72 transition-[width] duration-500"
              style={{
                width: `${Math.min(
                  100,
                  Math.round((badge.progress.current / badge.progress.target) * 100),
                )}%`,
              }}
            />
          </div>
        </div>
      ) : null}
    </Tag>
  );
}

export type { BadgesSheetProps };

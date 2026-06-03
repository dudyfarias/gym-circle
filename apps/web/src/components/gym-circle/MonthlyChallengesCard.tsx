"use client";

import { Check, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MonthlyChallengeData } from "./social/monthlyChallenges";

/**
 * Sprint 7.5.6 — MonthlyChallengesCard.
 *
 * Card no MyCircleSheet listando os 4 desafios do mês corrente (easy/
 * medium/hard/legendary) com progresso real-time. Visual diferenciado
 * por dificuldade:
 *
 *   easy      → cyan (acessível)
 *   medium    → blue (mais difícil)
 *   hard      → purple (raro)
 *   legendary → gold (extremo)
 *
 * Completed challenges ganham um check brilhante + tone destaque do
 * troféu. Estado "expirado mas não completou" (futuro, quando mês acabar)
 * usa cor cinza dim — mostra que oportunidade passou.
 */

type MonthlyChallengesCardProps = {
  challenges: ReadonlyArray<MonthlyChallengeData>;
  monthLabel: string;
};

export function MonthlyChallengesCard({
  challenges,
  monthLabel,
}: MonthlyChallengesCardProps) {
  const { t } = useTranslation();

  if (challenges.length === 0) return null;

  // Ordenar por dificuldade ascendente
  const ordered = [...challenges].sort(
    (a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty],
  );

  return (
    <section className="mt-8">
      <h4 className="mb-3 text-[13px] font-black uppercase tracking-[0.06em] text-white/44">
        {t("monthlyChallenges.title", { month: monthLabel })}
      </h4>
      <div className="space-y-2">
        {ordered.map((challenge) => (
          <ChallengeRow challenge={challenge} key={challenge.id} />
        ))}
      </div>
    </section>
  );
}

function ChallengeRow({ challenge }: { challenge: MonthlyChallengeData }) {
  const { t } = useTranslation();
  const tone = DIFFICULTY_TONE[challenge.difficulty];
  const isCompleted = challenge.completedAt !== null;
  const pct = Math.min(
    100,
    Math.round((challenge.progress / challenge.goalTarget) * 100),
  );

  return (
    <div
      className={[
        "rounded-[16px] border border-white/[0.06] px-4 py-3 transition-colors",
        isCompleted ? tone.completedBg : "bg-white/[0.035]",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <span
          className={[
            "grid size-10 shrink-0 place-items-center rounded-[12px]",
            isCompleted ? tone.iconBg : "bg-white/[0.06] text-white/64",
          ].join(" ")}
        >
          {isCompleted ? (
            <Check size={18} strokeWidth={2.8} />
          ) : (
            <Trophy size={18} strokeWidth={2.4} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-black text-white">
              {challenge.title}
            </span>
            <span
              className={[
                "shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-[0.04em]",
                tone.chip,
              ].join(" ")}
            >
              {t(`monthlyChallenges.difficulty.${challenge.difficulty}`)}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-[11.5px] font-bold text-white/56">
            {challenge.description}
          </p>
        </div>
        <span className="shrink-0 text-[12px] font-black tabular-nums text-white/82">
          {challenge.progress}/{challenge.goalTarget}
        </span>
      </div>
      {!isCompleted ? (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={[
              "h-full rounded-full transition-[width] duration-500",
              tone.progressBar,
            ].join(" ")}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

const DIFFICULTY_ORDER = {
  easy: 0,
  medium: 1,
  hard: 2,
  legendary: 3,
} as const;

const DIFFICULTY_TONE: Record<
  "easy" | "medium" | "hard" | "legendary",
  {
    chip: string;
    iconBg: string;
    completedBg: string;
    progressBar: string;
  }
> = {
  easy: {
    chip: "bg-[#22D3EE]/16 text-[#22D3EE]",
    iconBg: "bg-[#22D3EE]/20 text-[#22D3EE]",
    completedBg: "bg-[#22D3EE]/8 border-[#22D3EE]/16",
    progressBar: "bg-[#22D3EE]/72",
  },
  medium: {
    chip: "bg-[var(--gc-brand)]/16 text-[var(--gc-brand)]",
    iconBg: "bg-[var(--gc-brand)]/20 text-[var(--gc-brand)]",
    completedBg: "bg-[var(--gc-brand)]/8 border-[var(--gc-brand)]/16",
    progressBar: "bg-[var(--gc-brand)]/72",
  },
  hard: {
    chip: "bg-[#A78BFA]/16 text-[#A78BFA]",
    iconBg: "bg-[#A78BFA]/20 text-[#A78BFA]",
    completedBg: "bg-[#A78BFA]/8 border-[#A78BFA]/16",
    progressBar: "bg-[#A78BFA]/72",
  },
  legendary: {
    chip: "bg-[#FBBF24]/16 text-[#FBBF24]",
    iconBg: "bg-[#FBBF24]/20 text-[#FBBF24]",
    completedBg: "bg-[#FBBF24]/8 border-[#FBBF24]/20",
    progressBar: "bg-[#FBBF24]/82",
  },
};

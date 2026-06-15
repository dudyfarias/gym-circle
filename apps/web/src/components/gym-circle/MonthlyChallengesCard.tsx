"use client";

import { Check, HelpCircle, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AchievementRarity } from "./social/achievements";
import {
  formatChallengePeriodLabel,
  type MonthlyChallengeData,
} from "./social/monthlyChallenges";

/**
 * Sprint 7.5.6 — MonthlyChallengesCard.
 *
 * Card no MyCircleSheet listando os desafios do mês corrente com progresso
 * real-time. Sprint 22 — visual por RARIDADE (não mais "dificuldade"):
 *
 *   comum     → cinza   (1 pt)
 *   incomum   → verde   (2 pts)
 *   raro      → azul    (3 pts)
 *   épico     → roxo    (5 pts)
 *   lendário  → laranja (10 pts)
 *
 * Completed challenges ganham um check brilhante + tone destaque do
 * troféu. Estado "expirado mas não completou" (futuro, quando mês acabar)
 * usa cor cinza dim — mostra que oportunidade passou.
 */

type MonthlyChallengesCardProps = {
  challenges: ReadonlyArray<MonthlyChallengeData>;
};

export function MonthlyChallengesCard({
  challenges,
}: MonthlyChallengesCardProps) {
  const { t, i18n } = useTranslation();

  if (challenges.length === 0) return null;

  // O mês do título vem do PERÍODO real dos desafios (periodKey, SP), não da
  // navegação do calendário — senão o label troca de mês mas a lista não.
  const monthLabel = formatChallengePeriodLabel(
    challenges[0].periodKey,
    i18n.language,
  );

  // Ordenar por raridade ascendente (comum → lendário)
  const ordered = [...challenges].sort(
    (a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity],
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
  const tone = RARITY_TONE[challenge.rarity];
  const isCompleted = challenge.completedAt !== null;
  // Sprint 7.5.10 — esconde título/descrição/progresso pra secret
  // challenges não completados. Quando completar, revela tudo.
  const isMystery = challenge.isSecret && !isCompleted;
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
            isCompleted
              ? tone.iconBg
              : isMystery
                ? "bg-white/[0.04] text-white/40"
                : "bg-white/[0.06] text-white/64",
          ].join(" ")}
        >
          {isCompleted ? (
            <Check size={18} strokeWidth={2.8} />
          ) : isMystery ? (
            <HelpCircle size={20} strokeWidth={2.2} />
          ) : (
            <Trophy size={18} strokeWidth={2.4} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={[
                "truncate text-[13px] font-black",
                isMystery ? "text-white/56" : "text-white",
              ].join(" ")}
            >
              {isMystery ? "???" : challenge.title}
            </span>
            <span
              className={[
                "shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-[0.04em]",
                tone.chip,
              ].join(" ")}
            >
              {t(`monthlyChallenges.rarity.${challenge.rarity}`)}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-[11.5px] font-bold text-white/56">
            {isMystery
              ? t("monthlyChallenges.secretHint")
              : challenge.description}
          </p>
        </div>
        {!isMystery ? (
          <span className="shrink-0 text-[12px] font-black tabular-nums text-white/82">
            {challenge.progress}/{challenge.goalTarget}
          </span>
        ) : null}
      </div>
      {!isCompleted && !isMystery ? (
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

// Sprint 22 — ordem e tom por RARIDADE (paleta da Sprint 19:
// cinza/verde/azul/roxo/laranja).
const RARITY_ORDER: Record<AchievementRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

const RARITY_TONE: Record<
  AchievementRarity,
  {
    chip: string;
    iconBg: string;
    completedBg: string;
    progressBar: string;
  }
> = {
  common: {
    chip: "bg-[#9CA3AF]/16 text-[#D1D5DB]",
    iconBg: "bg-[#9CA3AF]/20 text-[#D1D5DB]",
    completedBg: "bg-[#9CA3AF]/8 border-[#9CA3AF]/16",
    progressBar: "bg-[#9CA3AF]/72",
  },
  uncommon: {
    chip: "bg-[#34D399]/16 text-[#34D399]",
    iconBg: "bg-[#34D399]/20 text-[#34D399]",
    completedBg: "bg-[#34D399]/8 border-[#34D399]/16",
    progressBar: "bg-[#34D399]/72",
  },
  rare: {
    chip: "bg-[#3B82F6]/16 text-[#60A5FA]",
    iconBg: "bg-[#3B82F6]/20 text-[#60A5FA]",
    completedBg: "bg-[#3B82F6]/8 border-[#3B82F6]/16",
    progressBar: "bg-[#3B82F6]/72",
  },
  epic: {
    chip: "bg-[#A855F7]/16 text-[#C084FC]",
    iconBg: "bg-[#A855F7]/20 text-[#C084FC]",
    completedBg: "bg-[#A855F7]/8 border-[#A855F7]/16",
    progressBar: "bg-[#A855F7]/72",
  },
  legendary: {
    chip: "bg-[#F59E0B]/16 text-[#FBBF24]",
    iconBg: "bg-[#F59E0B]/20 text-[#FBBF24]",
    completedBg: "bg-[#F59E0B]/8 border-[#F59E0B]/20",
    progressBar: "bg-[#F59E0B]/82",
  },
};

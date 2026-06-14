"use client";

import { Flame, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { simulateHaptic } from "./social/haptics";
import type {
  CircleRankingRow,
  RankingPeriod,
  RankingScope,
} from "./social/supabaseSocialTypes";

/**
 * Sprint 19 — Competição. Substitui o placeholder "Em breve" no MyCircle.
 * Ranking por pontos (treino + bônus + conquistas), escolhível por escopo
 * (amigos/geral) e recorte (semana/mês/ano). Dados via RPC get_circle_ranking
 * carregados sob demanda (o pai passa `ranking` + `onLoad`).
 */

type CompetitionSectionProps = {
  ranking: {
    rows: CircleRankingRow[];
    scope: RankingScope;
    period: RankingPeriod;
    loading: boolean;
  };
  onLoad: (scope: RankingScope, period: RankingPeriod) => void | Promise<void>;
  currentUserId: string;
};

const SCOPES: RankingScope[] = ["circle", "global"];
const PERIODS: RankingPeriod[] = ["week", "month", "year"];

export function CompetitionSection({
  ranking,
  onLoad,
  currentUserId,
}: CompetitionSectionProps) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<RankingScope>("circle");
  const [period, setPeriod] = useState<RankingPeriod>("week");

  useEffect(() => {
    void onLoad(scope, period);
  }, [onLoad, scope, period]);

  // Só mostra rows quando batem com a seleção atual (evita flash de dado velho).
  const fresh = ranking.scope === scope && ranking.period === period;
  const rows = fresh ? ranking.rows : [];
  const me = rows.find((row) => row.user_id === currentUserId);
  const showEmpty = !ranking.loading && fresh && rows.length <= 1;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-[13px] font-black uppercase tracking-[0.06em] text-white/44">
          <Trophy size={14} strokeWidth={2.6} />
          {t("myCircle.competition.title")}
        </h4>
        <SegmentedControl
          value={scope}
          options={SCOPES}
          onChange={(next) => {
            simulateHaptic("brand");
            setScope(next);
          }}
          label={(s) => t(`myCircle.competition.scope.${s}`)}
        />
      </div>

      <SegmentedControl
        className="mb-3"
        value={period}
        options={PERIODS}
        onChange={(next) => {
          simulateHaptic("brand");
          setPeriod(next);
        }}
        label={(p) => t(`myCircle.competition.period.${p}`)}
        full
      />

      {me ? <YourPointsCard row={me} /> : null}

      {ranking.loading && !fresh ? (
        <RankingSkeleton />
      ) : showEmpty ? (
        <p className="rounded-[16px] border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-6 text-center text-[12px] font-bold text-white/52">
          {scope === "circle"
            ? t("myCircle.competition.emptyCircle")
            : t("myCircle.competition.emptyGlobal")}
        </p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((row) => (
            <RankingRow
              key={row.user_id}
              row={row}
              isMe={row.user_id === currentUserId}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  full,
  className,
}: {
  value: T;
  options: T[];
  onChange: (next: T) => void;
  label: (option: T) => string;
  full?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        "flex gap-1 rounded-full bg-white/[0.05] p-1",
        full ? "w-full" : "",
        className ?? "",
      ].join(" ")}
    >
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            onClick={() => !active && onChange(option)}
            className={[
              "gc-pressable rounded-full px-3 py-1.5 text-[12px] font-black transition-colors",
              full ? "flex-1" : "",
              active
                ? "bg-[var(--gc-brand)] text-black"
                : "text-white/64 hover:text-white",
            ].join(" ")}
          >
            {label(option)}
          </button>
        );
      })}
    </div>
  );
}

function YourPointsCard({ row }: { row: CircleRankingRow }) {
  const { t } = useTranslation();
  const total = row.total_points ?? 0;
  const workoutPoints = (row.workout_days ?? 0) * 10;
  const achievementPoints = row.achievement_points ?? 0;
  const bonusPoints = Math.max(0, total - workoutPoints - achievementPoints);

  return (
    <div className="mb-3 rounded-[18px] border border-[var(--gc-brand)]/24 bg-[var(--gc-brand)]/[0.06] p-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-white/52">
            {t("myCircle.competition.yourPoints")}
          </p>
          <p className="mt-0.5 text-[28px] font-black leading-none text-[var(--gc-brand)] tabular-nums">
            {total}
          </p>
        </div>
        <p className="text-[12px] font-black text-white/72">
          {t("myCircle.competition.rankBadge", { position: row.rank ?? "—" })}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <BreakdownCell value={workoutPoints} label={t("myCircle.competition.breakdown.workouts")} />
        <BreakdownCell value={bonusPoints} label={t("myCircle.competition.breakdown.bonus")} />
        <BreakdownCell value={achievementPoints} label={t("myCircle.competition.breakdown.achievements")} />
      </div>
    </div>
  );
}

function BreakdownCell({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[12px] bg-white/[0.04] py-2">
      <p className="text-[15px] font-black tabular-nums text-white">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold text-white/48">{label}</p>
    </div>
  );
}

const MEDAL_TONE: Record<number, string> = {
  1: "bg-[#FBBF24]/20 text-[#FBBF24]",
  2: "bg-[#CBD5E1]/20 text-[#CBD5E1]",
  3: "bg-[#D97706]/20 text-[#F59E0B]",
};

function RankingRow({ row, isMe }: { row: CircleRankingRow; isMe: boolean }) {
  const { t } = useTranslation();
  const rank = row.rank ?? 0;
  const name = row.display_name ?? row.username ?? "—";
  return (
    <li
      className={[
        "flex items-center gap-3 rounded-[16px] px-3 py-2.5 transition-colors",
        isMe
          ? "border border-[var(--gc-brand)]/32 bg-[var(--gc-brand)]/[0.07]"
          : "bg-white/[0.035]",
      ].join(" ")}
    >
      <span
        className={[
          "grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-black tabular-nums",
          MEDAL_TONE[rank] ?? "bg-white/[0.06] text-white/64",
        ].join(" ")}
      >
        {rank}
      </span>
      <Avatar url={row.avatar_url} name={name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-black text-white">{name}</p>
        <p className="flex items-center gap-1 text-[11px] font-bold text-white/52">
          <Flame
            size={11}
            strokeWidth={2.6}
            className={row.badge_is_active_today ? "text-[var(--gc-pink)]" : "text-white/36"}
          />
          {row.current_streak ?? 0}d ·{" "}
          {t("myCircle.competition.workoutsCount", { count: row.workout_days ?? 0 })}
        </p>
      </div>
      <span className="shrink-0 text-[15px] font-black tabular-nums text-[var(--gc-brand)]">
        {row.total_points ?? 0}
        <span className="ml-0.5 text-[10px] font-bold text-white/40">
          {t("myCircle.competition.pts")}
        </span>
      </span>
    </li>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        loading="lazy"
        className="size-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[13px] font-black text-white/72">
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

function RankingSkeleton() {
  return (
    <ol className="space-y-1.5">
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-[16px] bg-white/[0.035] px-3 py-2.5"
        >
          <span className="size-7 shrink-0 rounded-full bg-white/[0.06]" />
          <span className="size-9 shrink-0 rounded-full bg-white/[0.06]" />
          <span className="h-3 flex-1 rounded-full bg-white/[0.06]" />
          <span className="h-4 w-8 rounded-full bg-white/[0.06]" />
        </li>
      ))}
    </ol>
  );
}

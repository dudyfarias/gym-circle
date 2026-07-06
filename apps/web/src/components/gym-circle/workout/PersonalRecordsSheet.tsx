"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Dumbbell,
  Medal,
  RefreshCw,
  Timer,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  type PersonalRecord,
  type PersonalRecordLeaderboardRow,
  usePersonalRecords,
} from "./usePersonalRecords";

type PersonalRecordsSheetProps = {
  onClose: () => void;
};

function formatDuration(totalSeconds: number): string {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatValue(record: Pick<PersonalRecord, "unit" | "value" | "reps">) {
  if (record.unit === "seconds") return formatDuration(record.value);
  const weight = Number.isInteger(record.value)
    ? String(record.value)
    : record.value.toFixed(1).replace(".", ",");
  return record.reps ? `${weight} kg × ${record.reps}` : `${weight} kg`;
}

export function PersonalRecordsSheet({ onClose }: PersonalRecordsSheetProps) {
  const { t } = useTranslation();
  const { records, loading, error, refresh, loadLeaderboard } =
    usePersonalRecords();
  const [selected, setSelected] = useState<PersonalRecord | null>(null);
  const [leaders, setLeaders] = useState<PersonalRecordLeaderboardRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  async function openLeaderboard(record: PersonalRecord) {
    setSelected(record);
    setLeaderboardLoading(true);
    try {
      setLeaders(await loadLeaderboard(record));
    } catch {
      setLeaders([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }

  return (
    <div
      aria-label={t("personalRecords.title")}
      aria-modal="true"
      className="fixed inset-0 z-[96] flex justify-center overflow-y-auto bg-black/94 backdrop-blur-md"
      role="dialog"
    >
      <div className="flex min-h-full w-full max-w-[480px] flex-col px-5 pb-[calc(var(--gc-safe-bottom)+24px)] pt-[calc(var(--gc-safe-top)+14px)]">
        <header className="mb-5 flex items-center gap-3">
          {selected ? (
            <button
              aria-label={t("common.back")}
              className="gc-pressable grid size-10 place-items-center rounded-full bg-white/[0.07] text-white"
              onClick={() => setSelected(null)}
              type="button"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <span className="grid size-10 place-items-center rounded-[14px] bg-[#97ff00]/12 text-[#97ff00]">
              <Trophy size={19} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[19px] font-black text-white">
              {selected
                ? t("personalRecords.rankingTitle")
                : t("personalRecords.title")}
            </p>
            <p className="mt-0.5 text-[11.5px] font-bold text-white/42">
              {selected
                ? t("personalRecords.rankingSubtitle")
                : t("personalRecords.subtitle")}
            </p>
          </div>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-10 place-items-center rounded-full bg-white/[0.07] text-white/82"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        {selected ? (
          <>
            <div className="mb-4 rounded-[22px] border border-[#97ff00]/16 bg-[#97ff00]/[0.06] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#97ff00]">
                {selected.exerciseName ??
                  t(`personalRecords.metrics.${selected.metricKey}`)}
              </p>
              <p className="mt-1 text-[34px] font-black tracking-[-0.04em] text-white tabular-nums">
                {formatValue(selected)}
              </p>
            </div>
            {leaderboardLoading ? (
              <p className="py-12 text-center text-[13px] font-bold text-white/45">
                {t("common.loading")}
              </p>
            ) : leaders.length === 0 ? (
              <p className="py-12 text-center text-[13px] font-bold text-white/45">
                {t("personalRecords.rankingEmpty")}
              </p>
            ) : (
              <div className="grid gap-2">
                {leaders.map((leader) => (
                  <div
                    className="flex items-center gap-3 rounded-[18px] bg-white/[0.045] px-4 py-3"
                    key={leader.userId}
                  >
                    <span className="grid size-8 place-items-center rounded-full bg-white/[0.07] text-[12px] font-black text-white/72">
                      {leader.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-black text-white">
                        {leader.displayName}
                      </p>
                      <p className="truncate text-[11px] font-bold text-white/38">
                        @{leader.username}
                      </p>
                    </div>
                    <p className="text-[15px] font-black text-white tabular-nums">
                      {formatValue(leader)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : loading ? (
          <p className="py-12 text-center text-[13px] font-bold text-white/45">
            {t("common.loading")}
          </p>
        ) : error ? (
          <button
            className="gc-pressable mx-auto mt-8 flex items-center gap-2 rounded-full bg-white/[0.07] px-4 py-3 text-[13px] font-black text-white"
            onClick={() => void refresh()}
            type="button"
          >
            <RefreshCw size={15} />
            {t("common.retry")}
          </button>
        ) : records.length === 0 ? (
          <div className="mt-8 rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-6 text-center">
            <Medal className="mx-auto text-white/35" size={30} />
            <p className="mt-3 text-[16px] font-black text-white">
              {t("personalRecords.emptyTitle")}
            </p>
            <p className="mt-1 text-[12.5px] font-bold leading-5 text-white/45">
              {t("personalRecords.emptyBody")}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {records.map((record) => (
              <article
                className="rounded-[22px] border border-white/[0.07] bg-[#0b0d0e] p-4"
                key={record.id}
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-[15px] bg-[var(--gc-brand)]/10 text-[var(--gc-brand)]">
                    {record.unit === "kg" ? (
                      <Dumbbell size={19} />
                    ) : (
                      <Timer size={19} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-black text-white">
                      {record.exerciseName ??
                        t(`personalRecords.metrics.${record.metricKey}`)}
                    </p>
                    <p className="mt-1 text-[28px] font-black tracking-[-0.04em] text-white tabular-nums">
                      {formatValue(record)}
                    </p>
                    {record.isEstimated ? (
                      <p className="mt-1 text-[10.5px] font-bold text-white/38">
                        {t("personalRecords.estimated")}
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  className="gc-pressable mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-white/[0.055] py-2.5 text-[12.5px] font-black text-white/76"
                  onClick={() => void openLeaderboard(record)}
                  type="button"
                >
                  <Users size={15} />
                  {t("personalRecords.openRanking")}
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

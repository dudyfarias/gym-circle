"use client";

import { useEffect, useState } from "react";
import { Activity, Ban, Flag, Flame, ImageIcon, Trash2, Users, X } from "lucide-react";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import type {
  AccountDeletionRequestRow,
  AlphaAdminDailyMetricRow,
  AlphaAdminSummaryRow,
  ReportRow,
  UserBlockRow,
} from "@gym-circle/core";
import { StatsWidget } from "./design-system";

type AdminPanelSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function AdminPanelSheet({ open, onClose }: AdminPanelSheetProps) {
  const services = useGymCircleServices();
  const [summary, setSummary] = useState<AlphaAdminSummaryRow | null>(null);
  const [daily, setDaily] = useState<AlphaAdminDailyMetricRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [blocks, setBlocks] = useState<UserBlockRow[]>([]);
  const [deletions, setDeletions] = useState<AccountDeletionRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    Promise.all([
      services.admin.summary(),
      services.admin.dailyMetrics(10),
      services.admin.reports(12),
      services.admin.blocks(12),
      services.admin.deletionRequests(12),
    ])
      .then(([nextSummary, nextDaily, nextReports, nextBlocks, nextDeletions]) => {
        if (!alive) return;
        setSummary(nextSummary);
        setDaily(nextDaily);
        setReports(nextReports);
        setBlocks(nextBlocks);
        setDeletions(nextDeletions);
        setError(null);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "Não foi possível carregar o admin.");
      });
    return () => {
      alive = false;
    };
  }, [open, services.admin]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[56] bg-black/94 px-4 py-4 backdrop-blur-2xl">
      <div className="relative mx-auto flex h-full max-h-[860px] max-w-[480px] flex-col overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#090a0b]">
        <header className="flex items-center justify-between border-b border-white/[0.06] p-4">
          <div>
            <p className="text-[12px] font-black uppercase text-[var(--gc-brand)]">Alpha admin</p>
            <h2 className="text-[24px] font-black">Gym Circle</h2>
          </div>
          <button
            aria-label="Fechar admin"
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.06]"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {error ? (
            <p className="rounded-[18px] border border-[var(--gc-pink)]/30 bg-[var(--gc-pink)]/10 p-3 text-[12px] font-bold text-[var(--gc-pink)]">
              {error}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <StatsWidget icon={<Users size={18} />} label="Usuários" tone="blue" value={String(summary?.users_registered ?? 0)} detail="cadastros" />
            <StatsWidget icon={<ImageIcon size={18} />} label="Posts" tone="brand" value={String(summary?.posts_today ?? 0)} detail="hoje" />
            <StatsWidget icon={<Activity size={18} />} label="Ativos" tone="blue" value={String(summary?.active_users_today ?? 0)} detail="hoje" />
            <StatsWidget icon={<Flame size={18} />} label="Streaks" tone="brand" value={String(summary?.streaks_lit_today ?? 0)} detail="acesos" />
            <StatsWidget icon={<Flag size={18} />} label="Denúncias" tone="blue" value={String(summary?.open_reports ?? 0)} detail="abertas" />
            <StatsWidget icon={<Ban size={18} />} label="Bloqueios" tone="brand" value={String(summary?.blocks_total ?? 0)} detail="total" />
          </div>

          <Section title="Últimos dias">
            <div className="space-y-2">
              {daily.map((item) => (
                <div className="rounded-[20px] bg-white/[0.045] p-3" key={item.metric_date}>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-black">{item.metric_date}</p>
                    <p className="text-[12px] font-bold text-white/48">{item.active_users ?? 0} ativos</p>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[11px] font-black text-white/58">
                    <span>{item.posts_created ?? 0} posts</span>
                    <span>{item.stories_created ?? 0} stories</span>
                    <span>{item.streaks_lit ?? 0} streaks</span>
                    <span>{item.users_registered ?? 0} signups</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Denúncias">
            <Rows
              empty="Nenhuma denúncia aberta."
              rows={reports.map((report) => ({
                id: report.id,
                title: report.reason,
                detail: `${report.status} · ${new Date(report.created_at).toLocaleString("pt-BR")}`,
              }))}
            />
          </Section>

          <Section title="Bloqueios">
            <Rows
              empty="Nenhum bloqueio registrado."
              rows={blocks.map((block) => ({
                id: `${block.blocker_id}-${block.blocked_id}`,
                title: block.reason || "Bloqueio social",
                detail: `${block.created_at.slice(0, 10)} · ${block.blocker_id.slice(0, 6)} → ${block.blocked_id.slice(0, 6)}`,
              }))}
            />
          </Section>

          <Section title="Exclusão de conta">
            <Rows
              empty="Nenhum pedido em aberto."
              rows={deletions.map((request) => ({
                id: request.id,
                title: request.reason || "Pedido de exclusão",
                detail: `${request.status} · ${new Date(request.created_at).toLocaleString("pt-BR")}`,
                icon: <Trash2 size={14} />,
              }))}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-3 text-[15px] font-black text-white/82">{title}</h3>
      {children}
    </section>
  );
}

function Rows({
  rows,
  empty,
}: {
  rows: Array<{ id: string; title: string; detail: string; icon?: React.ReactNode }>;
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="rounded-[20px] bg-white/[0.04] p-4 text-[13px] font-bold text-white/44">{empty}</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div className="flex items-center gap-3 rounded-[20px] bg-white/[0.045] p-3" key={row.id}>
          <div className="grid size-9 place-items-center rounded-full bg-white/[0.07] text-white/62">
            {row.icon ?? <Flag size={14} />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-black">{row.title}</p>
            <p className="truncate text-[11px] font-bold text-white/42">{row.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

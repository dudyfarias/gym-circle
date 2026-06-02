"use client";

import Image from "next/image";
import { Camera, Download, Share2, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { BrandMark } from "./design-system";
import type { MonthlyRecap } from "./social/monthlyRecap";
import type { EnrichedUser } from "./social/types";

type MonthlyRecapSheetProps = {
  open: boolean;
  recap: MonthlyRecap;
  user: EnrichedUser;
  onClose: () => void;
  /**
   * Sprint 5.5b — quando fornecido, mostra um botão "Trocar foto" abaixo
   * do poster que abre o RecapCoverPickerSheet. Parent (GymCirclePreview)
   * gerencia o state do picker. Sem isso, o recap continua funcional
   * mas sem user-pick UI (compat com smoke tests anteriores).
   */
  onOpenCoverPicker?: () => void;
};

type TFn = (key: string, options?: Record<string, unknown>) => string;

export function MonthlyRecapSheet({
  open,
  recap,
  user,
  onClose,
  onOpenCoverPicker,
}: MonthlyRecapSheetProps) {
  const { t } = useTranslation();
  const [sharing, setSharing] = useState(false);

  const shareRecap = useCallback(async () => {
    if (!recap.isAvailable || sharing) return;
    setSharing(true);
    try {
      const file = await createRecapShareFile(recap, user, t);
      if (
        typeof navigator !== "undefined" &&
        "share" in navigator &&
        "canShare" in navigator &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          text: t("monthlyRecap.share.text", { value: recap.trainedDaysLabel }),
          title: t("monthlyRecap.share.title"),
        });
        return;
      }

      const url = window.URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setSharing(false);
    }
  }, [recap, sharing, t, user]);

  if (!open) return null;

  return (
    <div className="gc-safe-overlay absolute inset-0 z-50 bg-black/94 backdrop-blur-2xl">
      <div className="relative mx-auto flex h-full max-h-[840px] min-h-[620px] flex-col overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#070809] shadow-[0_28px_72px_rgba(0,0,0,0.7)]">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/36">
              {t("monthlyRecap.eyebrow")}
            </p>
            <h2 className="text-[19px] font-black">{t("monthlyRecap.title")}</h2>
          </div>
          <button
            aria-label={t("monthlyRecap.closeAria")}
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>

        <div className="gc-scrollbar flex-1 overflow-y-auto px-4 py-5">
          <RecapPoster recap={recap} user={user} />
          {onOpenCoverPicker ? (
            <button
              className="gc-pressable mx-auto mt-4 flex h-10 items-center gap-2 rounded-full bg-white/[0.06] px-4 text-[12px] font-black text-white/82 hover:bg-white/[0.1]"
              onClick={onOpenCoverPicker}
              type="button"
            >
              <Camera size={14} strokeWidth={2.4} />
              {t("recapCoverPicker.title")}
            </button>
          ) : null}
          <p className="mx-auto mt-4 max-w-[310px] text-center text-[12px] font-bold leading-5 text-white/42">
            {t("monthlyRecap.hint")}
          </p>
        </div>

        <footer className="grid grid-cols-[1fr_auto] gap-2 border-t border-white/[0.06] p-4">
          <button
            className="gc-pressable flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[13px] font-black text-black disabled:opacity-60"
            disabled={sharing}
            onClick={shareRecap}
            type="button"
          >
            <Share2 size={16} strokeWidth={2.7} />
            {sharing
              ? t("monthlyRecap.share.generating")
              : t("monthlyRecap.share.cta")}
          </button>
          <button
            aria-label={t("monthlyRecap.share.downloadAria")}
            className="gc-pressable grid size-12 place-items-center rounded-full border border-white/[0.1] bg-white/[0.05] text-white"
            disabled={sharing}
            onClick={shareRecap}
            type="button"
          >
            <Download size={17} strokeWidth={2.7} />
          </button>
        </footer>
      </div>
    </div>
  );
}

function RecapPoster({ recap, user }: { recap: MonthlyRecap; user: EnrichedUser }) {
  const { t } = useTranslation();
  return (
    <article className="relative mx-auto aspect-[4/5] w-full max-w-[360px] overflow-hidden rounded-[34px] border border-white/[0.08] bg-black shadow-[0_24px_80px_rgba(0,0,0,0.52)]">
      {recap.coverImageUrl ? (
        <Image
          alt={t("monthlyRecap.poster.alt")}
          className="object-cover opacity-70"
          fill
          sizes="360px"
          src={recap.coverImageUrl}
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.16),rgba(0,0,0,0.88)),radial-gradient(circle_at_82%_18%,rgba(48,213,255,0.38),transparent_32%),radial-gradient(circle_at_15%_88%,rgba(0,102,255,0.34),transparent_38%)]" />

      <div className="absolute inset-0 flex flex-col p-6">
        <div className="flex items-start justify-between">
          <BrandMark size={34} />
          <RecapRings
            month={recap.monthProgressPercent}
            week={recap.weekProgressPercent}
            year={recap.yearProgressPercent}
          />
        </div>

        <div className="mt-auto">
          <p className="text-[12px] font-black uppercase tracking-[0.18em] text-white/48">
            {t("monthlyRecap.poster.brandTitle")}
          </p>
          <h3 className="mt-2 text-[50px] font-black capitalize leading-none text-white">
            {recap.shortMonthLabel}
          </h3>
          <div className="mt-5 rounded-[28px] border border-white/[0.1] bg-black/46 p-4 backdrop-blur-2xl">
            <p className="text-[13px] font-bold text-white/52">
              {t("monthlyRecap.poster.trainedLabel")}
            </p>
            <p className="mt-1 text-[58px] font-black leading-none text-[var(--gc-brand)]">
              {recap.trainedDays}
            </p>
            <p className="mt-1 text-[15px] font-black text-white">
              {recap.trainedDaysUnit} {t("monthlyRecap.poster.trainedInMonth")}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <PosterStat
                label={t("monthlyRecap.poster.topWorkoutLabel")}
                value={recap.topWorkoutType}
              />
              <PosterStat
                label={t("monthlyRecap.poster.topLocationLabel")}
                value={recap.topLocation}
              />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <p className="text-[13px] font-black text-white/74">
              {t("monthlyRecap.poster.tagline")}
            </p>
            <div className="rounded-full bg-black/42 px-2.5 py-1 text-[10px] font-black text-white/72 backdrop-blur-xl">
              @{user.username}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * 3 anéis aninhados (Apple Fitness idiom): ano (externo, azul deep) ·
 * mês (médio, ciano) · semana (interno, mais claro). Mostramos rings sem
 * texto inline pra ficar limpo na composição — o card já tem "Você treinou
 * X dias" em destaque.
 */
function RecapRings({ week, month, year }: { week: number; month: number; year: number }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-[18px] bg-black/42 p-2 backdrop-blur-xl">
      <svg
        aria-label={t("monthlyRecap.poster.ringsAria", { year, month, week })}
        height={68}
        role="img"
        viewBox="0 0 84 84"
        width={68}
      >
        <RingArc color="var(--gc-consistency-year)" percent={year} radius={36} />
        <RingArc color="var(--gc-consistency-month)" percent={month} radius={26} />
        <RingArc color="var(--gc-consistency-daily)" percent={week} radius={16} />
      </svg>
    </div>
  );
}

/**
 * Um ring (track + progress). Track é uma linha leve do mesmo color
 * com opacity baixa pra dar contexto do "100%". Progress arc rotaciona
 * -90deg pra começar no topo (12h), igual Apple Fitness.
 */
function RingArc({
  color,
  percent,
  radius,
}: {
  color: string;
  percent: number;
  radius: number;
}) {
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.max(0, Math.min(100, percent)) / 100);
  return (
    <g style={{ transform: "rotate(-90deg)", transformOrigin: "42px 42px" }}>
      <circle
        cx={42}
        cy={42}
        fill="none"
        opacity={0.18}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={42}
        cy={42}
        fill="none"
        r={radius}
        stroke={color}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    </g>
  );
}

function PosterStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-white/[0.08] p-3">
      <p className="text-[9px] font-black uppercase text-white/36">{label}</p>
      <p className="mt-1 truncate text-[13px] font-black text-white">{value}</p>
    </div>
  );
}

async function createRecapShareFile(
  recap: MonthlyRecap,
  user: EnrichedUser,
  t: TFn,
): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(t("monthlyRecap.errors.canvasUnavailable"));

  drawRecapBackground(ctx, recap);
  await drawCoverImage(ctx, recap.coverImageUrl);
  drawRecapText(ctx, recap, user, t);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error(t("monthlyRecap.errors.generateImage")));
    }, "image/png");
  });
  return new File([blob], `gym-circle-${user.username}-${recap.monthKey}.png`, {
    type: "image/png",
  });
}

function drawRecapBackground(ctx: CanvasRenderingContext2D, recap: MonthlyRecap) {
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, "#02080C");
  gradient.addColorStop(0.55, "#000000");
  gradient.addColorStop(1, "#071B3A");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1350);

  ctx.fillStyle = "rgba(48,213,255,0.22)";
  ctx.beginPath();
  ctx.arc(890, 190, 270, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0,102,255,0.24)";
  ctx.beginPath();
  ctx.arc(120, 1220, 340, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(72, 996, Math.round(936 * (recap.progressPercent / 100)), 10);
}

async function drawCoverImage(ctx: CanvasRenderingContext2D, url: string | null) {
  if (!url) return;
  try {
    const image = await loadImage(url);
    const ratio = Math.max(1080 / image.width, 1350 / image.height);
    const width = image.width * ratio;
    const height = image.height * ratio;
    ctx.globalAlpha = 0.48;
    ctx.drawImage(image, (1080 - width) / 2, (1350 - height) / 2, width, height);
    ctx.globalAlpha = 1;
    const overlay = ctx.createLinearGradient(0, 0, 0, 1350);
    overlay.addColorStop(0, "rgba(0,0,0,0.18)");
    overlay.addColorStop(0.62, "rgba(0,0,0,0.74)");
    overlay.addColorStop(1, "rgba(0,0,0,0.94)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, 1080, 1350);
  } catch {
    // CORS pode bloquear imagens externas; o card continua exportável com fundo premium.
  }
}

function drawRecapText(
  ctx: CanvasRenderingContext2D,
  recap: MonthlyRecap,
  user: EnrichedUser,
  t: TFn,
) {
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 42px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(t("monthlyRecap.canvas.brandTitle"), 72, 104);

  // Anéis no canto superior direito (espelha o RecapPoster JSX).
  drawRecapRings(ctx, {
    cx: 920,
    cy: 170,
    week: recap.weekProgressPercent,
    month: recap.monthProgressPercent,
    year: recap.yearProgressPercent,
  });

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 96px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(capitalize(recap.shortMonthLabel), 72, 770);
  ctx.font = "800 36px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillText(t("monthlyRecap.poster.trainedLabel"), 72, 850);

  ctx.fillStyle = "#8CFBFF";
  ctx.font = "900 176px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(String(recap.trainedDays), 72, 1010);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 46px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(
    `${recap.trainedDaysUnit} ${t("monthlyRecap.poster.trainedInMonth")}`,
    72,
    1070,
  );

  drawCanvasStat(
    ctx,
    t("monthlyRecap.poster.topWorkoutLabel"),
    recap.topWorkoutType,
    72,
    1168,
  );
  drawCanvasStat(
    ctx,
    t("monthlyRecap.poster.topLocationLabel"),
    recap.topLocation,
    560,
    1168,
  );

  ctx.fillStyle = "rgba(255,255,255,0.76)";
  ctx.font = "900 34px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(t("monthlyRecap.poster.tagline"), 72, 1290);

  // @username no canto inferior direito — discreto, balanceando "Train together"
  drawUsernameBadge(ctx, user.username, 1008, 1290);
}

/**
 * Desenha os 3 anéis (ano externo, mês médio, semana interno) no canvas.
 * Espelha geometricamente o componente RecapRings do RecapPoster.
 */
function drawRecapRings(
  ctx: CanvasRenderingContext2D,
  { cx, cy, week, month, year }: { cx: number; cy: number; week: number; month: number; year: number },
) {
  const strokeWidth = 14;
  const rings: Array<{ radius: number; percent: number; color: string }> = [
    { radius: 80, percent: year, color: "#0066FF" },
    { radius: 58, percent: month, color: "#30D5FF" },
    { radius: 36, percent: week, color: "#8CFBFF" },
  ];

  for (const ring of rings) {
    // Track (background) — opacidade baixa, mesma cor
    ctx.strokeStyle = ring.color;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Progress arc — começa no topo (12h = -π/2), avança no sentido horário
    const clamped = Math.max(0, Math.min(100, ring.percent));
    if (clamped <= 0) continue;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (clamped / 100) * Math.PI * 2;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy, ring.radius, startAngle, endAngle);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

/**
 * Pílula com @username no canto inferior direito da arte.
 * Anchor x é a borda DIREITA da pill (não a esquerda) — o callsite
 * passa onde a pill termina, e a função mede o texto pra alinhar.
 */
function drawUsernameBadge(
  ctx: CanvasRenderingContext2D,
  username: string,
  rightX: number,
  centerY: number,
) {
  const text = `@${username}`;
  ctx.font = "900 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  const textWidth = ctx.measureText(text).width;
  const paddingX = 22;
  const height = 44;
  const width = textWidth + paddingX * 2;
  const x = rightX - width;
  const y = centerY - height / 2;

  ctx.fillStyle = "rgba(0,0,0,0.42)";
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fillText(text, x + paddingX, y + height / 2 + 8);
}

function drawCanvasStat(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
) {
  ctx.fillStyle = "rgba(255,255,255,0.09)";
  roundRect(ctx, x, y, 448, 108, 28);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = "900 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(label.toUpperCase(), x + 28, y + 38);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 34px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(truncateCanvasText(ctx, value, 380), x + 28, y + 80);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function truncateCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let next = text;
  while (next.length > 1 && ctx.measureText(`${next}...`).width > maxWidth) {
    next = next.slice(0, -1);
  }
  return `${next}...`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}

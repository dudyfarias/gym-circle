"use client";

import Image from "next/image";
import { Camera, Download, Share2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
  // Pré-geramos o poster ao abrir o sheet. No iOS/WKWebView, `navigator.share`
  // exige "transient user activation": se a gente fizer `await` (gerar canvas,
  // carregar a foto da capa pela rede) ANTES de chamar share() dentro do clique,
  // a activation expira e share() lança NotAllowedError — era o motivo do botão
  // "não fazer nada". Com o File pronto antes do tap, o clique chama share()
  // sem nenhum await no meio e o gesto é preservado.
  // Guardamos o File junto do monthKey que o gerou pra nunca compartilhar o
  // poster de um mês obsoleto (ex.: após trocar de período no picker).
  const [shareFile, setShareFile] = useState<{ key: string; file: File } | null>(
    null,
  );

  useEffect(() => {
    if (!open || !recap.isAvailable) return;
    let cancelled = false;
    const key = recap.monthKey;
    void createRecapShareFile(recap, user, t)
      .then((file) => {
        if (!cancelled) setShareFile({ key, file });
      })
      .catch(() => {
        // Falha na pré-geração: deixa o clique gerar sob demanda + fallback.
      });
    return () => {
      cancelled = true;
    };
  }, [open, recap, user, t]);

  const shareRecap = useCallback(async () => {
    if (!recap.isAvailable || sharing) return;
    setSharing(true);
    try {
      // Usa o File pré-gerado DESTE mês (preserva a user activation). Só gera
      // na hora se ainda não estiver pronto — aí o fallback de texto/imagem
      // cobre o iOS.
      const ready =
        shareFile && shareFile.key === recap.monthKey ? shareFile.file : null;
      const file = ready ?? (await createRecapShareFile(recap, user, t));
      const canUseShare =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function";

      if (
        canUseShare &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            text: t("monthlyRecap.share.text", {
              value: recap.trainedDaysLabel,
            }),
            title: t("monthlyRecap.share.title"),
          });
          return;
        } catch (error) {
          // Usuário cancelou o share sheet → encerra sem fallback ruidoso.
          if ((error as Error)?.name === "AbortError") return;
          // Qualquer outro erro (ex.: activation perdida) → cai pros fallbacks.
        }
      }

      // Fallback 1 — share só de texto/URL (Web Share L1 funciona no WKWebView
      // mesmo quando files não é suportado).
      if (canUseShare) {
        try {
          await navigator.share({
            text: t("monthlyRecap.share.text", {
              value: recap.trainedDaysLabel,
            }),
            title: t("monthlyRecap.share.title"),
          });
          return;
        } catch (error) {
          if ((error as Error)?.name === "AbortError") return;
        }
      }

      // Fallback 2 — abre a imagem pra salvar/compartilhar manualmente. No
      // WKWebView o <a download> é inerte, então tentamos window.open primeiro.
      const url = window.URL.createObjectURL(file);
      const opened = window.open(url, "_blank");
      if (!opened) {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
      }
      window.setTimeout(() => window.URL.revokeObjectURL(url), 10_000);
    } finally {
      setSharing(false);
    }
  }, [recap, sharing, shareFile, t, user]);

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
      {/* Sprint 5.5c — foto 100% background sem desbotar. A foto escolhida
          pelo user (ou auto-pick) é o protagonista. Stats viram overlay
          sutil no canto superior esquerdo, estilo widget fitness do iPhone. */}
      {recap.coverImageUrl ? (
        <Image
          alt={t("monthlyRecap.poster.alt")}
          className="object-cover"
          fill
          sizes="360px"
          src={recap.coverImageUrl}
        />
      ) : null}

      {/* Scrim duplo:
          1. Gradient vertical pra escurecer top-left (área dos stats)
          2. Vinheta sutil pra centralizar atenção. Sem dominar a foto. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.62)_0%,rgba(0,0,0,0.18)_45%,rgba(0,0,0,0.16)_55%,rgba(0,0,0,0.78)_100%)]" />

      <div className="absolute inset-0 flex flex-col p-5">
        {/* Top row: stats overlay esquerda + RecapRings direita */}
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <PosterStatStack
              label={recap.shortMonthLabel}
              value={recap.trainedDays.toString()}
              suffix={`${recap.trainedDaysUnit} ${t("monthlyRecap.poster.trainedInMonth")}`}
              isHero
            />
            <PosterStatStack
              label={t("monthlyRecap.poster.topWorkoutLabel")}
              value={recap.topWorkoutType}
            />
            <PosterStatStack
              label={t("monthlyRecap.poster.topLocationLabel")}
              value={recap.topLocation}
            />
          </div>
          <RecapRings
            month={recap.monthProgressPercent}
            week={recap.weekProgressPercent}
            year={recap.yearProgressPercent}
          />
        </div>

        {/* Bottom row: BrandMark + tagline esquerda + @username pill direita */}
        <div className="mt-auto flex items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <BrandMark size={24} />
            <p
              className="text-[11px] font-black uppercase tracking-[0.14em] text-white/74"
              style={{ textShadow: "0 1px 4px rgba(0,0,0,0.72)" }}
            >
              {t("monthlyRecap.poster.tagline")}
            </p>
          </div>
          <div className="rounded-full bg-black/52 px-3 py-1.5 text-[10px] font-black text-white/86 backdrop-blur-xl">
            @{user.username}
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * Sprint 5.5c — stat block estilo widget fitness do iPhone.
 * Label uppercase pequeno em cima + número grande + suffix opcional.
 * `isHero` aumenta o número (workouts contados) e adiciona cor brand.
 * text-shadow garante leitura sobre qualquer foto.
 */
function PosterStatStack({
  label,
  value,
  suffix,
  isHero = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  isHero?: boolean;
}) {
  const numberShadow = "0 2px 8px rgba(0,0,0,0.72)";
  const textShadow = "0 1px 4px rgba(0,0,0,0.72)";
  return (
    <div>
      <p
        className="text-[10px] font-black uppercase tracking-[0.12em] text-white/74"
        style={{ textShadow }}
      >
        {label}
      </p>
      <p
        className={
          isHero
            ? "leading-none text-[44px] font-black text-[var(--gc-brand)]"
            : "leading-none text-[22px] font-black text-white"
        }
        style={{ textShadow: numberShadow }}
      >
        {value}
      </p>
      {suffix ? (
        <p
          className="mt-0.5 text-[11px] font-black text-white/82"
          style={{ textShadow }}
        >
          {suffix}
        </p>
      ) : null}
    </div>
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

/**
 * Sprint 5.5c — background fica premium em ambos os casos:
 * - Com foto: drawCoverImage sobrescreve com a foto cheia + scrim sutil
 * - Sem foto (mês sem posts): este gradient vira o background final
 */
function drawRecapBackground(ctx: CanvasRenderingContext2D, _recap: MonthlyRecap) {
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
}

/**
 * Sprint 5.5c — foto cheia (alpha 1.0) com scrim duplo sutil pra leitura.
 * Espelha o JSX: top escuro pra stats, bottom escuro pra brandmark/username.
 * Meio mais claro pra deixar a foto "respirar" no centro.
 */
async function drawCoverImage(ctx: CanvasRenderingContext2D, url: string | null) {
  if (!url) return;
  try {
    const image = await loadImage(url);
    const ratio = Math.max(1080 / image.width, 1350 / image.height);
    const width = image.width * ratio;
    const height = image.height * ratio;
    ctx.drawImage(image, (1080 - width) / 2, (1350 - height) / 2, width, height);

    const overlay = ctx.createLinearGradient(0, 0, 0, 1350);
    overlay.addColorStop(0, "rgba(0,0,0,0.62)");
    overlay.addColorStop(0.45, "rgba(0,0,0,0.18)");
    overlay.addColorStop(0.55, "rgba(0,0,0,0.16)");
    overlay.addColorStop(1, "rgba(0,0,0,0.78)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, 1080, 1350);
  } catch {
    // CORS pode bloquear imagens externas; o card continua exportável com
    // fundo premium do drawRecapBackground.
  }
}

/**
 * Helper: text drawing com shadow garantida pra legibilidade sobre foto.
 * Espelha o `text-shadow` CSS do JSX PosterStatStack.
 */
function drawShadowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  shadowBlur = 8,
) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.72)";
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetY = 2;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawRecapText(
  ctx: CanvasRenderingContext2D,
  recap: MonthlyRecap,
  user: EnrichedUser,
  t: TFn,
) {
  // Sprint 5.5c — Layout estilo iPhone widget:
  //   Top-left: stack de stats (mês hero + mais treinado + lugar)
  //   Top-right: RecapRings
  //   Bottom-left: BrandMark + tagline
  //   Bottom-right: @username pill

  // === Hero stat: mês em label + workout count + suffix ===
  ctx.fillStyle = "rgba(255,255,255,0.74)";
  ctx.font = "900 26px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawShadowText(ctx, capitalize(recap.shortMonthLabel).toUpperCase(), 72, 130);

  ctx.fillStyle = "#8CFBFF";
  ctx.font = "900 156px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawShadowText(ctx, String(recap.trainedDays), 72, 280, 14);

  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.font = "900 34px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawShadowText(
    ctx,
    `${recap.trainedDaysUnit} ${t("monthlyRecap.poster.trainedInMonth")}`,
    72,
    332,
  );

  // === Mais treinado stat ===
  ctx.fillStyle = "rgba(255,255,255,0.74)";
  ctx.font = "900 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawShadowText(ctx, t("monthlyRecap.poster.topWorkoutLabel").toUpperCase(), 72, 446);
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.font = "900 56px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawShadowText(ctx, truncateCanvasText(ctx, recap.topWorkoutType, 580), 72, 506, 12);

  // === Lugar stat ===
  ctx.fillStyle = "rgba(255,255,255,0.74)";
  ctx.font = "900 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawShadowText(ctx, t("monthlyRecap.poster.topLocationLabel").toUpperCase(), 72, 612);
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.font = "900 48px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawShadowText(ctx, truncateCanvasText(ctx, recap.topLocation, 580), 72, 666, 12);

  // === RecapRings top-right (espelha JSX) ===
  drawRecapRings(ctx, {
    cx: 920,
    cy: 200,
    week: recap.weekProgressPercent,
    month: recap.monthProgressPercent,
    year: recap.yearProgressPercent,
  });

  // === Bottom-left: BRAND CIRCLE pill em texto ===
  ctx.fillStyle = "rgba(255,255,255,0.74)";
  ctx.font = "900 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawShadowText(ctx, t("monthlyRecap.canvas.brandTitle"), 72, 1244);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "900 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawShadowText(ctx, t("monthlyRecap.poster.tagline"), 72, 1290);

  // === Bottom-right: @username pill (mantém helper antigo) ===
  drawUsernameBadge(ctx, user.username, 1008, 1280);
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

"use client";

import Image from "next/image";
import { Download, Share2, X } from "lucide-react";
import { useCallback, useState } from "react";
import { BrandMark } from "./design-system";
import type { MonthlyRecap } from "./social/monthlyRecap";
import type { EnrichedUser } from "./social/types";

type MonthlyRecapSheetProps = {
  open: boolean;
  recap: MonthlyRecap;
  user: EnrichedUser;
  onClose: () => void;
};

export function MonthlyRecapSheet({
  open,
  recap,
  user,
  onClose,
}: MonthlyRecapSheetProps) {
  const [sharing, setSharing] = useState(false);

  const shareRecap = useCallback(async () => {
    if (!recap.isAvailable || sharing) return;
    setSharing(true);
    try {
      const file = await createRecapShareFile(recap, user);
      if (
        typeof navigator !== "undefined" &&
        "share" in navigator &&
        "canShare" in navigator &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          text: `Meu mês no Gym Circle: ${recap.trainedDaysLabel} treinando.`,
          title: "Gym Circle Recap",
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
  }, [recap, sharing, user]);

  if (!open) return null;

  return (
    <div className="gc-safe-overlay absolute inset-0 z-50 bg-black/94 backdrop-blur-2xl">
      <div className="relative mx-auto flex h-full max-h-[840px] min-h-[620px] flex-col overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#070809] shadow-[0_28px_72px_rgba(0,0,0,0.7)]">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/36">
              Pronto para Instagram
            </p>
            <h2 className="text-[19px] font-black">Resumo do mês</h2>
          </div>
          <button
            aria-label="Fechar resumo"
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>

        <div className="gc-scrollbar flex-1 overflow-y-auto px-4 py-5">
          <RecapPoster recap={recap} user={user} />
          <p className="mx-auto mt-4 max-w-[310px] text-center text-[12px] font-bold leading-5 text-white/42">
            O arquivo sai em formato vertical para story ou post. No iPhone, use Compartilhar e escolha Instagram.
          </p>
        </div>

        <footer className="grid grid-cols-[1fr_auto] gap-2 border-t border-white/[0.06] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            className="gc-pressable flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[13px] font-black text-black disabled:opacity-60"
            disabled={sharing}
            onClick={shareRecap}
            type="button"
          >
            <Share2 size={16} strokeWidth={2.7} />
            {sharing ? "Gerando..." : "Compartilhar"}
          </button>
          <button
            aria-label="Baixar imagem"
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
  return (
    <article className="relative mx-auto aspect-[4/5] w-full max-w-[360px] overflow-hidden rounded-[34px] border border-white/[0.08] bg-black shadow-[0_24px_80px_rgba(0,0,0,0.52)]">
      {recap.coverImageUrl ? (
        <Image
          alt="Treino do mês"
          className="object-cover opacity-70"
          fill
          sizes="360px"
          src={recap.coverImageUrl}
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.16),rgba(0,0,0,0.88)),radial-gradient(circle_at_82%_18%,rgba(48,213,255,0.38),transparent_32%),radial-gradient(circle_at_15%_88%,rgba(0,102,255,0.34),transparent_38%)]" />

      <div className="absolute inset-0 flex flex-col p-6">
        <div className="flex items-center justify-between">
          <BrandMark size={34} />
          <div className="rounded-full bg-black/42 px-3 py-1 text-[11px] font-black text-white/82 backdrop-blur-xl">
            @{user.username}
          </div>
        </div>

        <div className="mt-auto">
          <p className="text-[12px] font-black uppercase tracking-[0.18em] text-white/48">
            Gym Circle Recap
          </p>
          <h3 className="mt-2 text-[50px] font-black capitalize leading-none text-white">
            {recap.shortMonthLabel}
          </h3>
          <div className="mt-5 rounded-[28px] border border-white/[0.1] bg-black/46 p-4 backdrop-blur-2xl">
            <p className="text-[13px] font-bold text-white/52">Você treinou</p>
            <p className="mt-1 text-[58px] font-black leading-none text-[var(--gc-brand)]">
              {recap.trainedDays}
            </p>
            <p className="mt-1 text-[15px] font-black text-white">
              {recap.trainedDaysUnit} neste mês
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <PosterStat label="Mais treinado" value={recap.topWorkoutType} />
              <PosterStat label="Lugar" value={recap.topLocation} />
            </div>
          </div>
          <p className="mt-4 text-[13px] font-black text-white/74">
            Train together.
          </p>
        </div>
      </div>
    </article>
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

async function createRecapShareFile(recap: MonthlyRecap, user: EnrichedUser): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");

  drawRecapBackground(ctx, recap);
  await drawCoverImage(ctx, recap.coverImageUrl);
  drawRecapText(ctx, recap, user);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("Não foi possível gerar a imagem"));
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

function drawRecapText(ctx: CanvasRenderingContext2D, recap: MonthlyRecap, user: EnrichedUser) {
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 42px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("GYM CIRCLE", 72, 104);
  ctx.font = "800 34px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.68)";
  ctx.fillText(`@${user.username}`, 72, 154);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 96px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(capitalize(recap.shortMonthLabel), 72, 770);
  ctx.font = "800 36px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillText("Você treinou", 72, 850);

  ctx.fillStyle = "#8CFBFF";
  ctx.font = "900 176px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(String(recap.trainedDays), 72, 1010);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 46px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(`${recap.trainedDaysUnit} neste mês`, 72, 1070);

  drawCanvasStat(ctx, "Mais treinado", recap.topWorkoutType, 72, 1168);
  drawCanvasStat(ctx, "Lugar", recap.topLocation, 560, 1168);

  ctx.fillStyle = "rgba(255,255,255,0.76)";
  ctx.font = "900 34px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("Train together.", 72, 1290);
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

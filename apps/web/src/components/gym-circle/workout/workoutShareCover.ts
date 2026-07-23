"use client";

import {
  getSportDefinition,
  type ActivityType,
} from "@gym-circle/core/domain";
import {
  formatElapsed,
  formatKm,
  formatPace,
  paceFromDistance,
} from "./workoutElapsed";

export type WorkoutShareCoverInput = {
  activityType: ActivityType;
  elapsedS: number;
  movingS?: number | null;
  distanceM?: number | null;
  elevationGainM?: number | null;
  workoutDate?: string | null;
  workoutTypeLabel: string;
  locationLabel?: string | null;
};

export type WorkoutShareCoverSummary = {
  title: string;
  primaryLabel: string;
  primaryValue: string;
  secondary: string[];
};

const COVER_WIDTH = 1200;
const COVER_HEIGHT = 1500;

function clampText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  if (context.measureText(text).width <= maxWidth) return text;
  let next = text;
  while (next.length > 1 && context.measureText(`${next}…`).width > maxWidth) {
    next = next.slice(0, -1);
  }
  return `${next}…`;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function dateLabel(workoutDate?: string | null) {
  if (!workoutDate || !/^\d{4}-\d{2}-\d{2}$/.test(workoutDate)) return null;
  return `${workoutDate.slice(8, 10)}/${workoutDate.slice(5, 7)}`;
}

export function buildWorkoutShareCoverSummary(
  input: WorkoutShareCoverInput,
): WorkoutShareCoverSummary {
  const isRouteActivity =
    getSportDefinition(input.activityType).trackingCapabilities.supportsRoute;
  const distanceM = input.distanceM ?? 0;
  const movingS = input.movingS ?? input.elapsedS;
  const pace =
    isRouteActivity && distanceM > 0
      ? paceFromDistance(distanceM, movingS)
      : null;
  const secondary = [
    isRouteActivity && distanceM > 0 ? formatElapsed(input.elapsedS) : null,
    pace != null ? formatPace(pace) : null,
    (input.elevationGainM ?? 0) >= 1
      ? `${Math.round(input.elevationGainM ?? 0)} m`
      : null,
    input.locationLabel ?? null,
  ].filter((value): value is string => Boolean(value));

  return {
    title: input.workoutTypeLabel || "Treino",
    primaryLabel: isRouteActivity && distanceM > 0 ? "Distância" : "Tempo",
    primaryValue:
      isRouteActivity && distanceM > 0
        ? formatKm(distanceM)
        : formatElapsed(input.elapsedS),
    secondary,
  };
}

export async function createWorkoutShareCoverFile(
  input: WorkoutShareCoverInput,
): Promise<File> {
  if (typeof document === "undefined") {
    throw new Error("A capa automática só pode ser gerada no navegador.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = COVER_WIDTH;
  canvas.height = COVER_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Não foi possível preparar a capa automática do treino.");
  }

  const summary = buildWorkoutShareCoverSummary(input);
  const date = dateLabel(input.workoutDate);

  const gradient = context.createLinearGradient(0, 0, COVER_WIDTH, COVER_HEIGHT);
  gradient.addColorStop(0, "#071113");
  gradient.addColorStop(0.42, "#0b1719");
  gradient.addColorStop(1, "#020405");
  context.fillStyle = gradient;
  context.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);

  const glow = context.createRadialGradient(930, 270, 0, 930, 270, 520);
  glow.addColorStop(0, "rgba(92, 232, 255, 0.34)");
  glow.addColorStop(1, "rgba(92, 232, 255, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);

  context.save();
  drawRoundedRect(context, 96, 126, COVER_WIDTH - 192, COVER_HEIGHT - 252, 70);
  context.fillStyle = "rgba(255,255,255,0.055)";
  context.fill();
  context.strokeStyle = "rgba(255,255,255,0.12)";
  context.lineWidth = 3;
  context.stroke();
  context.restore();

  context.font = "900 42px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillStyle = "rgba(255,255,255,0.46)";
  context.letterSpacing = "7px";
  context.fillText("GYM CIRCLE", 148, 225);
  context.letterSpacing = "0px";

  context.font = "900 84px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillStyle = "#ffffff";
  context.fillText(clampText(context, summary.title, 740), 148, 340);

  if (date) {
    context.font = "900 36px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillStyle = "rgba(92,232,255,0.92)";
    const width = context.measureText(date).width + 58;
    drawRoundedRect(context, COVER_WIDTH - 148 - width, 220, width, 64, 32);
    context.fillStyle = "rgba(92,232,255,0.13)";
    context.fill();
    context.fillStyle = "rgba(92,232,255,0.95)";
    context.fillText(date, COVER_WIDTH - 148 - width + 29, 263);
  }

  context.font = "900 38px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillStyle = "rgba(255,255,255,0.44)";
  context.letterSpacing = "8px";
  context.fillText(summary.primaryLabel.toUpperCase(), 148, 540);
  context.letterSpacing = "0px";

  context.font = "900 170px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillStyle = "#5ce8ff";
  context.fillText(summary.primaryValue, 148, 725);

  const secondary = summary.secondary.slice(0, 3);
  secondary.forEach((value, index) => {
    const y = 890 + index * 118;
    context.font = "900 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillStyle = "rgba(255,255,255,0.42)";
    context.letterSpacing = "5px";
    context.fillText(
      index === 0 ? "RESUMO" : index === 1 ? "RITMO" : "EXTRA",
      148,
      y,
    );
    context.letterSpacing = "0px";
    context.font = "900 56px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillStyle = "#ffffff";
    context.fillText(clampText(context, value, 820), 148, y + 64);
  });

  context.font = "800 32px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillStyle = "rgba(255,255,255,0.36)";
  context.fillText("Toque para ver os detalhes do treino", 148, 1290);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Não foi possível exportar a capa automática."));
      },
      "image/png",
      0.92,
    );
  });

  return new File([blob], `gym-circle-workout-${Date.now()}.png`, {
    type: "image/png",
  });
}

"use client";

import { useMemo } from "react";

type RouteSketchProps = {
  /** Polyline [[lat, lng], ...] downsampled — só pro sketch (sem tiles). */
  route: number[][];
  className?: string;
};

const VIEW_W = 320;
const VIEW_H = 96;
const PAD = 14;

/**
 * Rastreio de treino (Fase 2) — sketch da rota: polyline normalizada em SVG,
 * traço azul + pontos de início/fim. Sem tiles de mapa de propósito (leve e
 * espelha o Canvas nativo). Descarta rotas degeneradas (< 2 pontos).
 */
export function RouteSketch({ route, className }: RouteSketchProps) {
  const geometry = useMemo(() => {
    const coords = route.filter(
      (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]),
    );
    if (coords.length < 2) return null;

    const lats = coords.map((p) => p[0]);
    const lngs = coords.map((p) => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const spanLat = Math.max(maxLat - minLat, 0.0001);
    const spanLng = Math.max(maxLng - minLng, 0.0001);
    const drawW = VIEW_W - PAD * 2;
    const drawH = VIEW_H - PAD * 2;
    // Mantém a proporção da rota (sem esticar).
    const scale = Math.min(drawW / spanLng, drawH / spanLat);
    const offsetX = PAD + (drawW - spanLng * scale) / 2;
    const offsetY = PAD + (drawH - spanLat * scale) / 2;

    const project = (lat: number, lng: number): [number, number] => [
      offsetX + (lng - minLng) * scale,
      offsetY + (maxLat - lat) * scale,
    ];

    const points = coords.map((p) => project(p[0], p[1]));
    return {
      path: points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" "),
      start: points[0],
      end: points[points.length - 1],
    };
  }, [route]);

  if (!geometry) return null;

  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d={geometry.path}
        fill="none"
        stroke="var(--gc-blue)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={geometry.start[0]} cy={geometry.start[1]} r={3.5} fill="var(--gc-blue)" />
      <circle cx={geometry.end[0]} cy={geometry.end[1]} r={3.5} fill="#ffffff" />
    </svg>
  );
}

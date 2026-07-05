"use client";

import { useMemo } from "react";

type WorkoutRouteMapProps = {
  route: number[][];
  className?: string;
  label: string;
};

const WIDTH = 420;
const HEIGHT = 220;
const TILE_SIZE = 256;
const PADDING = 34;

function clampLatitude(latitude: number) {
  return Math.max(-85.05112878, Math.min(85.05112878, latitude));
}

function worldPoint(latitude: number, longitude: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const lat = (clampLatitude(latitude) * Math.PI) / 180;
  return {
    x: ((longitude + 180) / 360) * scale,
    y:
      (0.5 -
        Math.log((1 + Math.sin(lat)) / (1 - Math.sin(lat))) /
          (4 * Math.PI)) *
      scale,
  };
}

/**
 * Mapa real da rota sem SDK pesado: tiles OpenStreetMap + polyline SVG
 * projetada no mesmo Web Mercator dos tiles. O card pequeno continua usando
 * RouteSketch; o detalhe usa esta superfície geográfica.
 */
export function WorkoutRouteMap({
  route,
  className,
  label,
}: WorkoutRouteMapProps) {
  const geometry = useMemo(() => {
    const coordinates = route.filter(
      (point) =>
        Array.isArray(point) &&
        point.length >= 2 &&
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1]) &&
        Math.abs(point[0]) <= 90 &&
        Math.abs(point[1]) <= 180,
    );
    if (coordinates.length < 2) return null;

    let zoom = 18;
    let projected = coordinates.map(([latitude, longitude]) =>
      worldPoint(latitude, longitude, zoom),
    );
    while (zoom > 3) {
      const xs = projected.map((point) => point.x);
      const ys = projected.map((point) => point.y);
      if (
        Math.max(...xs) - Math.min(...xs) <= WIDTH - PADDING * 2 &&
        Math.max(...ys) - Math.min(...ys) <= HEIGHT - PADDING * 2
      ) {
        break;
      }
      zoom -= 1;
      projected = coordinates.map(([latitude, longitude]) =>
        worldPoint(latitude, longitude, zoom),
      );
    }

    const xs = projected.map((point) => point.x);
    const ys = projected.map((point) => point.y);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const originX = centerX - WIDTH / 2;
    const originY = centerY - HEIGHT / 2;
    const tileCount = 2 ** zoom;
    const tiles: Array<{
      key: string;
      url: string;
      left: number;
      top: number;
    }> = [];

    const minTileX = Math.floor(originX / TILE_SIZE);
    const maxTileX = Math.floor((originX + WIDTH) / TILE_SIZE);
    const minTileY = Math.max(0, Math.floor(originY / TILE_SIZE));
    const maxTileY = Math.min(
      tileCount - 1,
      Math.floor((originY + HEIGHT) / TILE_SIZE),
    );
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
        tiles.push({
          key: `${zoom}/${wrappedX}/${tileY}`,
          url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`,
          left: tileX * TILE_SIZE - originX,
          top: tileY * TILE_SIZE - originY,
        });
      }
    }

    const screenPoints = projected.map((point) => ({
      x: point.x - originX,
      y: point.y - originY,
    }));
    return {
      path: screenPoints
        .map(
          (point, index) =>
            `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
        )
        .join(" "),
      start: screenPoints[0],
      end: screenPoints.at(-1),
      tiles,
    };
  }, [route]);

  if (!geometry?.start || !geometry.end) return null;

  return (
    <div
      aria-label={label}
      className={["relative overflow-hidden bg-[#111518]", className]
        .filter(Boolean)
        .join(" ")}
      role="img"
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full"
        preserveAspectRatio="xMidYMid slice"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        {geometry.tiles.map((tile) => (
          <image
            height={TILE_SIZE}
            href={tile.url}
            key={tile.key}
            width={TILE_SIZE}
            x={tile.left}
            y={tile.top}
          />
        ))}
        <rect fill="black" fillOpacity="0.12" height={HEIGHT} width={WIDTH} />
        <path
          d={geometry.path}
          fill="none"
          stroke="#061118"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.62"
          strokeWidth={7}
        />
        <path
          d={geometry.path}
          fill="none"
          stroke="var(--gc-blue)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={4}
        />
        <circle
          cx={geometry.start.x}
          cy={geometry.start.y}
          fill="var(--gc-blue)"
          r={6}
          stroke="white"
          strokeWidth={2}
        />
        <circle
          cx={geometry.end.x}
          cy={geometry.end.y}
          fill="white"
          r={6}
          stroke="#071116"
          strokeWidth={2}
        />
      </svg>
      <a
        className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[8px] font-bold text-white/75"
        href="https://www.openstreetmap.org/copyright"
        rel="noreferrer"
        target="_blank"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}
